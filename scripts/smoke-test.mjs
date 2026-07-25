#!/usr/bin/env node
/**
 * dist/ に対する静的スモークテスト
 *
 * 3つの「静かに壊れる」障害を機械的に検出する:
 *   1. 計測タグの silent failure（window.gtag 未定義でイベントが飛ばない）
 *   2. 画像圧縮パイプラインの通し忘れ（ページ重量の肥大）
 *   3. 拡張子と実体フォーマットの不一致（.png なのに中身が JPEG 等）
 *
 * 使い方:
 *   npm run build && npm test              # ステージングビルド（計測チェックはskip）
 *   DEPLOY_TARGET=production npm run build && npm test   # 本番相当（計測チェックも実施）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

// ---- 予算（超えたら fail）----------------------------------------------
const PAGE_IMAGE_BUDGET_BYTES = 4 * 1024 * 1024;   // 1ページが参照する画像の合計
const SINGLE_IMAGE_BUDGET_BYTES = 600 * 1024;      // 画像1枚あたり
const DEAD_WEIGHT_BUDGET_BYTES = 5 * 1024 * 1024;  // どのページからも参照されない画像の総量

/** どのページからか参照された dist 上の実ファイル（CHECK 3/4 で使う） */
const referencedFiles = new Set();

const failures = [];
const warnings = [];
const notes = [];

function fail(check, msg) { failures.push(`[${check}] ${msg}`); }
function warn(check, msg) { warnings.push(`[${check}] ${msg}`); }
function note(msg) { notes.push(msg); }

// ---- ユーティリティ ------------------------------------------------------
function walk(dir, filter) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, filter));
    else if (!filter || filter(p)) out.push(p);
  }
  return out;
}

/** マジックバイトから実フォーマットを判定 */
function sniffFormat(buf) {
  if (buf.length < 12) return 'unknown';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';
  if (buf.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))) return 'ico';
  const head = buf.subarray(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg';
  return 'unknown';
}

const EXT_TO_FORMAT = {
  '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp',
  '.gif': 'gif', '.svg': 'svg', '.ico': 'ico', '.avif': 'avif',
};

/**
 * HTML から「実際にブラウザがダウンロードする」画像パスを抽出する。
 *
 * <picture> は webp source と png/jpg フォールバックの両方が書かれているが、
 * モダンブラウザが取得するのは1つだけ。両方数えると重量を過大評価して
 * テストがオオカミ少年になるため、picture 内は最初の <source> だけを数える。
 * 参照の生存確認（リンク切れ検出）には全候補が必要なので、両方返す。
 */
function extractImageRefs(html) {
  const downloaded = new Set(); // 重量計算用（picture は1枚に畳む）
  const all = new Set();        // 存在チェック用（フォールバック含む全部）

  const norm = (raw) => {
    if (!raw) return null;
    let u = raw.trim();
    if (!u || u.startsWith('data:') || /^https?:\/\//.test(u)) return null;
    u = u.split('?')[0].split('#')[0];
    if (!EXT_TO_FORMAT[extname(u).toLowerCase()]) return null;
    return u;
  };
  const addAll = (raw) => { const u = norm(raw); if (u) all.add(u); };
  const addBoth = (raw) => { const u = norm(raw); if (u) { all.add(u); downloaded.add(u); } };

  // <picture>: 先頭 source を採用画像とし、内部の img/その他 source は存在チェックのみ
  const pictures = [...html.matchAll(/<picture\b[\s\S]*?<\/picture>/gi)].map((m) => m[0]);
  for (const pic of pictures) {
    const sources = [...pic.matchAll(/<source\b[^>]*?\bsrcset=["']([^"']+)["']/gi)]
      .map((m) => m[1].split(',')[0].trim().split(/\s+/)[0]);
    const imgSrc = (pic.match(/<img\b[^>]*?\ssrc=["']([^"']+)["']/i) || [])[1];
    const chosen = sources[0] || imgSrc;
    addBoth(chosen);
    for (const s of sources) addAll(s);
    addAll(imgSrc);
  }

  // picture の外にある単独の img / srcset / preload / CSS url()
  const outside = html.replace(/<picture\b[\s\S]*?<\/picture>/gi, '');
  for (const m of outside.matchAll(/<img\b[^>]*?\ssrc=["']([^"']+)["']/gi)) addBoth(m[1]);
  for (const m of outside.matchAll(/\bsrcset=["']([^"']+)["']/gi)) addBoth(m[1].split(',')[0].trim().split(/\s+/)[0]);
  for (const m of outside.matchAll(/<link\b[^>]*?\brel=["']preload["'][^>]*?\bhref=["']([^"']+)["']/gi)) addBoth(m[1]);
  for (const m of outside.matchAll(/url\((['"]?)([^)'"]+)\1\)/gi)) addBoth(m[2]);

  return { downloaded: [...downloaded], all: [...all] };
}

/** URL パス（/madoa-lp/images/x.jpg 等）を dist 上の実ファイルへ解決 */
function resolveToDist(urlPath) {
  const clean = urlPath.replace(/^\.?\//, '');
  const candidates = [
    join(DIST, clean),
    join(DIST, clean.replace(/^madoa-lp\//, '')), // GitHub Pages の base 付き
  ];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) || null;
}

const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(2)}MB`;
const fmtKB = (b) => `${Math.round(b / 1024)}KB`;

// ---- 事前チェック --------------------------------------------------------
if (!existsSync(DIST)) {
  console.error('dist/ がありません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const htmlFiles = walk(DIST, (p) => p.endsWith('.html'));
if (htmlFiles.length === 0) {
  console.error('dist/ に HTML がありません。ビルドが失敗している可能性があります。');
  process.exit(1);
}

// 本番ビルドか判定（計測タグは isProduction ゲートの中にあるため）
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const isProductionBuild = !/name=["']robots["'][^>]*noindex/i.test(indexHtml);

console.log(`dist/ = ${htmlFiles.length} ページ / ビルド種別: ${isProductionBuild ? 'production' : 'staging (noindex)'}\n`);

// ==========================================================================
// CHECK 1: 計測コードの silent failure
// ==========================================================================
if (!isProductionBuild) {
  note('CHECK 1 (計測) は staging ビルドのため skip。`DEPLOY_TARGET=production npm run build` 後に再実行すると検証されます。');
} else {
  for (const file of htmlFiles) {
    const rel = relative(DIST, file);
    const html = readFileSync(file, 'utf8');

    const usesGtag = /\bgtag\s*\(/.test(html);
    const usesFbq = /\bfbq\s*\(/.test(html);

    // 方針: gtag の定義を外部タグローダー任せにしない。
    // 外部ローダーが gtag を生やさなくなっても `if (window.gtag)` ガードは何も言わずに
    // イベントを捨てるだけなので、ページ内に必ずスタブを置くことを機械的に強制する。
    if (usesGtag) {
      const hasGtagDefinition =
        /window\.gtag\s*=/.test(html) ||
        /function\s+gtag\s*\(/.test(html) ||
        /googletagmanager\.com\/(gtag\/js|gtm\.js)/.test(html);
      if (!hasGtagDefinition) {
        fail('計測', `${rel}: gtag() を呼んでいるが gtag の定義（スタブ or gtag.js）がページ内に無い。イベントは silent に破棄される`);
      }
      if (!/dataLayer/.test(html)) {
        warn('計測', `${rel}: dataLayer が見当たらない。スタブが dataLayer.push 形式でないと後から gtag.js を読んでもイベントを回収できない`);
      }
    }
    if (usesFbq && !/connect\.facebook\.net\/[^"']*fbevents\.js/.test(html)) {
      fail('計測', `${rel}: fbq() を呼んでいるが fbevents.js のローダーが無い`);
    }

    // CTA が存在するのにクリックリスナーが無いページを検出
    const hasCta = /href=["'](tel:|https:\/\/lin\.ee|https:\/\/line\.me)/.test(html);
    if (hasCta && !usesGtag && !usesFbq) {
      fail('計測', `${rel}: 電話/LINE の CTA があるのに計測スクリプトが1つも入っていない`);
    }
  }
}

// ==========================================================================
// CHECK 2: ページ画像重量（圧縮パイプライン通し忘れの検出）
// ==========================================================================
for (const file of htmlFiles) {
  const rel = relative(DIST, file);
  const html = readFileSync(file, 'utf8');
  const { downloaded, all } = extractImageRefs(html);

  let total = 0;
  const missing = [];
  const heavy = [];

  // 存在チェックはフォールバック含む全参照に対して行う（404 の静止画を見逃さない）
  for (const ref of all) {
    const p = resolveToDist(ref);
    if (!p) missing.push(ref);
    else referencedFiles.add(p);
  }
  // 重量は実際にダウンロードされる分だけ合計する
  for (const ref of downloaded) {
    const p = resolveToDist(ref);
    if (!p) continue;
    const size = statSync(p).size;
    total += size;
    if (size > SINGLE_IMAGE_BUDGET_BYTES) heavy.push(`${ref} (${fmtKB(size)})`);
  }

  const label = `${rel}: 取得画像 ${downloaded.length}枚 / 合計 ${fmtMB(total)}`;
  if (total > PAGE_IMAGE_BUDGET_BYTES) {
    fail('画像重量', `${label} — 予算 ${fmtMB(PAGE_IMAGE_BUDGET_BYTES)} 超過。圧縮パイプラインを通し忘れている可能性`);
  } else {
    console.log(`  OK  ${label}`);
  }
  for (const h of heavy) {
    warn('画像重量', `${rel}: ${h} が単体 ${fmtKB(SINGLE_IMAGE_BUDGET_BYTES)} 超`);
  }
  for (const m of missing) {
    fail('リンク切れ', `${rel}: 参照画像が dist に存在しない → ${m}`);
  }
}

// ==========================================================================
// CHECK 3: 拡張子と実体フォーマットの一致
//   LP から参照されている画像 → fail（表示崩れ・配信不整合の実害あり）
//   配信されているだけの素材   → warn（広告入稿時などに効いてくる）
// ==========================================================================
const imageFiles = walk(DIST, (p) => EXT_TO_FORMAT[extname(p).toLowerCase()]);
let mismatch = 0;
for (const file of imageFiles) {
  const rel = relative(DIST, file);
  const expected = EXT_TO_FORMAT[extname(file).toLowerCase()];
  if (expected === 'avif') continue; // sniff 未対応
  const actual = sniffFormat(readFileSync(file).subarray(0, 512));
  if (actual === 'unknown') {
    warn('画像形式', `${rel}: フォーマットを判定できませんでした`);
    continue;
  }
  if (actual === expected) continue;
  mismatch++;
  const msg = `${rel}: 拡張子は ${expected} だが中身は ${actual}`;
  if (referencedFiles.has(file)) fail('画像形式', msg);
  else warn('画像形式', `${msg}（LP未参照の素材）`);
}
console.log(`  OK  画像形式チェック: ${imageFiles.length}枚を検査（不一致 ${mismatch}件）`);

// ==========================================================================
// CHECK 4: 配信されているがどのページからも参照されていない画像（デッドウェイト）
//   広告素材やバックアップを public/ に置くと本番へ丸ごと転送される
// ==========================================================================
const orphans = imageFiles.filter((f) => !referencedFiles.has(f));
const orphanBytes = orphans.reduce((s, f) => s + statSync(f).size, 0);
if (orphanBytes > DEAD_WEIGHT_BUDGET_BYTES) {
  warn('デッドウェイト', `LPから未参照の画像が ${orphans.length}件 / ${fmtMB(orphanBytes)} 配信対象に含まれています（上位: ${
    orphans.sort((a, b) => statSync(b).size - statSync(a).size).slice(0, 3)
      .map((f) => `${relative(DIST, f)} ${fmtKB(statSync(f).size)}`).join(', ')})`);
} else {
  console.log(`  OK  未参照画像 ${orphans.length}件 / ${fmtMB(orphanBytes)}`);
}
console.log('');

// ==========================================================================
// 結果
// ==========================================================================
for (const n of notes) console.log(`NOTE  ${n}`);
for (const w of warnings) console.log(`WARN  ${w}`);
if (notes.length || warnings.length) console.log('');

if (failures.length) {
  console.error(`FAIL  ${failures.length}件`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS  すべてのスモークテストを通過（warning ${warnings.length}件）`);
