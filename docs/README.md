# docs/ の歩き方

MADOA（株式会社三喜）LPプロジェクトのドキュメント。何がどこにあるかの索引。

## 常に見るもの

| ファイル | 内容 |
|---|---|
| `tracking.md` | 計測の正。Pixel / GA4 / Google広告 / Clarity の状態、カスタムコンバージョンのID、過去に踏んだ地雷 |
| `utm-links.md` | 導線別のUTM付きリンク集 |
| `ads/2026-07-meta-launch.md` | 現在進行中のMeta広告。個人向け（配信中）と法人向け（出稿準備中）のブリーフ |

## 打ち合わせ

| ディレクトリ | 内容 | 作り方 |
|---|---|---|
| `client-notes/YYYY-MM-DD.md` | 議事録。要約・話した内容・TODO・テスティモニアル候補・反省点・次回 | `/meeting-pull`（Meet終了10分後にGeminiメモから自動生成） |
| `agendas/YYYY-MM-DD-agenda.md` | アジェンダ。Google Doc と同内容 + 古田向け内部チェックリスト | `/agenda` |

議事録の冒頭には出典（Google Doc URL）と `source_trust` を必ず書く。
Geminiの自動メモは**日時と数値を誤ることがある**ので、文字起こし原文で裏を取ってから議事録に落とす。

## 案件別

| ファイル | 内容 |
|---|---|
| `ads/2026-05-08-meta-ads-draft.md` | 初期の広告案（羽田野さん作成分の検討経緯） |
| `hatano-instructions-madoa-banner-2026-05-31.md` | 羽田野さんへのバナー制作指示 |
| `mf-invoice-api-2026-07-25.md` | マネーフォワード請求書のAPI/MCP連携可否の調査結果 |
| `2026-06-29-gemini-cli-mf-demo.md` | Gemini CLI / Anti-Gravity のデモ記録 |
| `subsidy-guidebook/outline.md` | 補助金ガイドブックの構成案 |

## リポジトリ内の他の置き場

| パス | 内容 |
|---|---|
| `ad-assets/` | 広告クリエイティブ素材。**LPから参照しない**（public/ に置くと本番に配信されるため外に出してある） |
| `_unused-assets/` | LPから参照されなくなった画像の退避先。旧デザインのサムネイル、差し替え前の写真など |
| `scripts/smoke-test.mjs` | dist/ に対する静的スモークテスト。`npm test` で実行 |
| `scripts/generate_madoa_ads*.py` | gpt-image でのバナー生成スクリプト |

## 環境

- 本番: `lp.madoa.co.jp`（Xserver）。`DEPLOY_TARGET=production npm run build` → `rsync -avz --delete dist/ xserver:~/madoa.co.jp/public_html/lp.madoa.co.jp/`
- ステージング: `37designfk.github.io/madoa-lp/`（GitHub Pages・main への push で自動デプロイ・noindex）

**デプロイ前に `npm run test:prod` を通すこと。** CIには組み込み済みだが、本番のrsyncは手動なので忘れやすい。
