# 法人LP 見積もり依頼フォーム 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 法人LP（`/business/`）に見積もり依頼フォームを設置し、送信をメール通知・自動返信・広告計測につなげて 2026-08-17（月）の法人向け広告配信に間に合わせる。

**Architecture:** LP側は Astro の静的コンポーネント。フォームは `fetch` で共通基盤 `forms.37d.jp/submit`（Cloudflare Worker + D1 + Amazon SES）へ POST し、成功したら `/business/thanks/` へ遷移する。計測イベントはサンクスページの到達で1回だけ送出する。Worker には自動返信機能を追加するが、文面は D1 の `sites` 行に持たせ、未設定のクライアントには一切影響させない。

**Tech Stack:** Astro 5 / Tailwind CSS 4 / Cloudflare Workers（Hono 4）/ D1 / Amazon SES / wrangler 3

**設計の出典:** `docs/superpowers/specs/2026-08-09-business-lp-form-design.md`

## Global Constraints

- **絵文字を使わない。** コード・コメント・UI文言・コミットメッセージすべてで禁止（古田さん指示）
- **ビジネスロジックのコメントは日本語で書く**
- **既存のLP本体（Hero・TrustBar・Problems・Subsidy・Reasons・FAQ）を変更しない。** 7/25 に菊池様のチェックを通っている
- **シークレットを平文でファイルに書かない。** 1Password (`op`) 経由、`op://` 参照のみ
- **本番デプロイ前に `DEPLOY_TARGET=production npm run build` が通ることを確認する**
- **サイトID は `madoa-lp`**、D1 のデータベース名は `forms_endpoint`（アンダースコア）、`database_id` は `429cfcde-d460-4078-bcba-48dc79ac8bd4`
- **フォームのフィールド名は `name` と `phone` を厳守する。** Worker はこの2つを専用カラムへ振り分ける（`forms-endpoint/src/index.ts:170-192`）。`tel` などの別名で送ると `phone` 列が空になる
- **電話番号の表記は `078-597-2722`、受付時間は `8:30〜17:30（土日祝休み）`**
- **住所の表記は `〒651-1113 神戸市北区鈴蘭台南町8丁目3-2`。** `src/components/Footer.astro` の記載が正
- **本番URLは `https://lp.madoa.co.jp`。** Worker の Origin 検証がこの文字列と完全一致で照合する

## リポジトリが2つにまたがる

| 作業 | リポジトリ | パス |
|---|---|---|
| Worker・D1 | forms-endpoint | `/Users/kenfuruta/forms-endpoint` |
| LP | madoa-lp | `/Users/kenfuruta/madoa-lp` |

**コミットは各リポジトリで別々に行う。** タスクごとにどちらで作業するか明記してある。

## テストについて（正直な前提）

**どちらのリポジトリにもユニットテストのハーネスが無い。** forms-endpoint は `npm run typecheck`（`tsc --noEmit`）のみ、madoa-lp は `npm test`（`scripts/smoke-test.mjs` が `dist/` を静的検査）のみ。

このスコープのためにテストフレームワークを新規導入するのは釣り合わない（YAGNI）。代わりに各タスクの検証は次の3つで行う。すべて実際に実行できるコマンドとして書いてある。

1. `npm run typecheck` / `DEPLOY_TARGET=production npm run build`（壊れていないこと）
2. `curl` による実HTTPリクエスト（Worker の振る舞い）
3. `npm test`（LPの計測タグ・画像・リンク切れ）

## File Structure

### forms-endpoint（共通基盤・全クライアント共有）

| ファイル | 変更 | 責務 |
|---|---|---|
| `src/types.ts` | 修正 | `SiteRow` に自動返信の2カラムを足す |
| `src/index.ts` | 修正 | `message` を必須から外す。`/submit` に自動返信を足す。`logSubmission` の status に `autoreply-failed` を足す |
| （D1 `sites` テーブル） | 修正 | `autoreply_subject` / `autoreply_body` カラム追加、`madoa-lp` 行を INSERT |

### madoa-lp（LP）

| ファイル | 変更 | 責務 |
|---|---|---|
| `src/layouts/Layout.astro` | 修正 | 全ページ共通の `submit` リスナーを削除する（二重計上の除去） |
| `src/components/business/BusinessForm.astro` | 新規 | 見積もり依頼フォームの表示と送信のみ。計測は持たない |
| `src/pages/business/thanks/index.astro` | 新規 | 送信完了ページ。計測イベントの送出はここが唯一の場所 |
| `src/pages/business/index.astro` | 修正 | `BusinessForm` を差し込む |
| `docs/tracking.md` | 修正 | 法人LPの計測イベントとカスタムコンバージョンを追記 |

---

## Task 1: Worker の必須判定を緩め、madoa-lp を D1 に登録する

**作業リポジトリ:** `/Users/kenfuruta/forms-endpoint`

**Files:**
- Modify: `src/index.ts:69-78`（必須フィールド判定）
- D1: `sites` テーブルへ1行 INSERT

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: `https://forms.37d.jp/submit` が `site_id=madoa-lp` を受け付け、`message` 空でも 200 を返す状態。後続のフォーム実装が依存する

**背景:** 現在の `/submit` は `name` / `email` / `message` の3つが揃わないと 400 を返す。設計ではご相談内容は任意なので、このままだと相談内容を空欄にした人が全員弾かれる。どの項目を必須にするかはフォームごとの要件であって、共通基盤が一律に強制するものではない。既存3クライアントは各自の HTML で `required` を付けているため、サーバー側を緩めても実際の入力体験は変わらない。

- [ ] **Step 1: 現状の挙動を確認する（変更前のベースライン）**

```bash
cd /Users/kenfuruta/forms-endpoint
curl -s -X POST https://forms.37d.jp/submit \
  -H 'Content-Type: application/json' \
  -d '{"site_id":"test-37d","name":"テスト太郎","email":"ken.furuta@37design.co.jp","message":""}'
```

Expected: `{"ok":false,"error":"missing-fields"}`

これが「相談内容を空にすると弾かれる」ことの実証。この出力を控えておく。

- [ ] **Step 2: 必須判定から message を外す**

`src/index.ts` の該当箇所を次のとおり書き換える。

変更前:
```ts
  // 必須フィールド
  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const message = (payload.message || "").trim();
  if (!name || !email || !message) {
    return c.json({ ok: false, error: "missing-fields" }, 400);
  }
```

変更後:
```ts
  // 必須フィールド。
  // どの項目を必須にするかはフォームごとの要件なので、共通基盤で強制するのは
  // 通知メールとログの体裁に最低限必要な name と email だけにする。
  // 相談内容の入力を求めるかどうかは各LPの HTML の required で決める
  // （法人LPの見積もり依頼フォームは相談内容を任意にしている）
  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const message = (payload.message || "").trim();
  if (!name || !email) {
    return c.json({ ok: false, error: "missing-fields" }, 400);
  }
```

- [ ] **Step 3: 型チェックを通す**

```bash
cd /Users/kenfuruta/forms-endpoint && npm run typecheck
```

Expected: エラーなしで終了（exit 0）

- [ ] **Step 4: 通知メール本文で message が空のときの体裁を確認する**

`src/index.ts` の `buildBody` は `message` をそのまま `[本文]` の下に置くため、空だと見出しだけが残る。空のときは「（記載なし）」に置き換える。

`buildBody` の中の該当行を書き換える。

変更前:
```ts
    "[本文]",
    message,
```

変更後:
```ts
    "[本文]",
    message || "（記載なし）",
```

- [ ] **Step 5: 型チェックとドライランを通す**

```bash
cd /Users/kenfuruta/forms-endpoint && npm run typecheck && npx wrangler deploy --dry-run
```

Expected: どちらもエラーなし。`--dry-run` は「Total Upload」のサイズが出て終わる

- [ ] **Step 6: madoa-lp を D1 に登録する**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"INSERT INTO sites (site_id, domain, to_email, subject_prefix, allowed_origins)
 VALUES ('madoa-lp', 'lp.madoa.co.jp', 'ken.furuta@37design.co.jp', '[まどあ]', 'https://lp.madoa.co.jp');"
```

Expected: `"success": true` と `"changes": 1`

`turnstile_site_key` / `turnstile_secret_key` は NULL のまま。既存3クライアントも未設定で、スパム対策はハニーポットで足りている。

- [ ] **Step 7: 登録内容を読み返して確認する**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"SELECT site_id, domain, to_email, subject_prefix, allowed_origins, enabled FROM sites WHERE site_id='madoa-lp';" \
--json 2>/dev/null | python3 -c "import sys,json; [print(r) for r in json.load(sys.stdin)[0]['results']]"
```

Expected: `allowed_origins` が `https://lp.madoa.co.jp`、`enabled` が `1` であること

- [ ] **Step 8: Worker をデプロイする**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler deploy
```

Expected: `Deployed forms-endpoint` とバージョンIDが出る

**注意:** これは全クライアント共有の基盤。デプロイ中は数秒フォームが止まる。

- [ ] **Step 9: 相談内容が空でも通ることを実際に確認する**

```bash
curl -s -X POST https://forms.37d.jp/submit \
  -H 'Content-Type: application/json' \
  -d '{"site_id":"madoa-lp","name":"テスト太郎","email":"ken.furuta@37design.co.jp","phone":"078-000-0000","company":"テスト商事","message":""}'
```

Expected: `{"ok":true,"messageId":"..."}`

Step 1 で 400 だったものが 200 になっていること。`ken.furuta@37design.co.jp` に件名 `[まどあ] お問い合わせ: テスト太郎様より` のメールが届き、本文の `[本文]` の下が `（記載なし）`、`電話: 078-000-0000`、`[その他]` に `company: テスト商事` が入っていること。

- [ ] **Step 10: 既存クライアントが壊れていないことを確認する**

```bash
curl -s -X POST https://forms.37d.jp/submit \
  -H 'Content-Type: application/json' \
  -d '{"site_id":"test-37d","name":"回帰確認","email":"ken.furuta@37design.co.jp","message":"既存クライアントの疎通確認"}'
```

Expected: `{"ok":true,"messageId":"..."}` とメール受信

- [ ] **Step 11: Origin 検証が効いていることを確認する**

```bash
curl -s -X POST https://forms.37d.jp/submit \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://evil.example.com' \
  -d '{"site_id":"madoa-lp","name":"不正Origin","email":"ken.furuta@37design.co.jp"}'
```

Expected: `{"ok":false,"error":"origin-not-allowed"}`

ここが 200 を返すなら `allowed_origins` の登録を間違えている。Step 7 に戻る。

- [ ] **Step 12: コミット**

```bash
cd /Users/kenfuruta/forms-endpoint
git add src/index.ts
git commit -m "$(cat <<'EOF'
修正: 必須項目から message を外し、空欄時の本文の体裁を整える

どの項目を必須にするかはフォームごとの要件で、共通基盤が一律に強制する
ものではない。法人LPの見積もり依頼フォームは相談内容を任意にするため。
既存クライアントは各自の HTML で required を付けているので入力体験は変わらない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RexD3TisPEqWvRSRSu6ydA
EOF
)"
```

---

## Task 2: Worker に自動返信メールを追加する

**作業リポジトリ:** `/Users/kenfuruta/forms-endpoint`

**Files:**
- Modify: `src/types.ts`（`SiteRow` に2フィールド）
- Modify: `src/index.ts`（`logSubmission` の status 型、`/submit` に自動返信処理）
- D1: `sites` に2カラム追加、`madoa-lp` 行に文面を投入

**Interfaces:**
- Consumes: Task 1 の `madoa-lp` 行
- Produces: `sites.autoreply_subject` と `sites.autoreply_body` が両方 NULL でないサイトについて、`/submit` が訪問者宛に自動返信を送る。既存クライアントは NULL なので送らない

**背景:** 現在の `/submit` は訪問者のメールアドレスを Reply-To に入れているだけで、訪問者宛には何も送っていない。`/send`（任意宛先へ送る汎用エンドポイント）を LP のフロントから叩く方式は採らない。公開ページから任意宛先に送れるエンドポイントを呼ばせるとスパムの踏み台になるため。

- [ ] **Step 1: D1 に自動返信用のカラムを追加する**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"ALTER TABLE sites ADD COLUMN autoreply_subject TEXT;"
```

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"ALTER TABLE sites ADD COLUMN autoreply_body TEXT;"
```

Expected: どちらも `"success": true`

SQLite の `ALTER TABLE ADD COLUMN` は1文につき1カラムしか足せないので2回に分ける。

- [ ] **Step 2: 既存クライアントが NULL のままであることを確認する**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"SELECT site_id, autoreply_subject IS NULL AS subj_null, autoreply_body IS NULL AS body_null FROM sites;" \
--json 2>/dev/null | python3 -c "import sys,json; [print(r) for r in json.load(sys.stdin)[0]['results']]"
```

Expected: 全5行（test-37d / omoie / yoshiichi-com / 37design-co-jp / madoa-lp）で `subj_null` と `body_null` がともに `1`

- [ ] **Step 3: SiteRow に型を足す**

`src/types.ts` の `SiteRow` を書き換える。

変更前:
```ts
export interface SiteRow {
  site_id: string;
  domain: string;
  to_email: string;
  subject_prefix: string;
  allowed_origins: string;
  turnstile_site_key: string | null;
  turnstile_secret_key: string | null;
  enabled: number;
}
```

変更後:
```ts
export interface SiteRow {
  site_id: string;
  domain: string;
  to_email: string;
  subject_prefix: string;
  allowed_origins: string;
  turnstile_site_key: string | null;
  turnstile_secret_key: string | null;
  enabled: number;
  /**
   * 訪問者への自動返信。件名と本文が両方そろっているサイトだけ送る。
   * NULL のクライアントには一切送らないので、既存サイトの挙動は変わらない。
   * 本文中の {{name}} は送信者の氏名に置き換わる
   */
  autoreply_subject: string | null;
  autoreply_body: string | null;
}
```

- [ ] **Step 4: logSubmission の status に autoreply-failed を足す**

`src/index.ts` の `logSubmission` のシグネチャを書き換える。

変更前:
```ts
  status: "sent" | "failed" | "spam",
```

変更後:
```ts
  status: "sent" | "failed" | "spam" | "autoreply-failed",
```

`submissions.status` は TEXT カラムなので DB スキーマの変更は要らない。

- [ ] **Step 5: 自動返信の送信処理を書く**

`src/index.ts` の `/submit` の末尾、通知メールのログを取ったあとに追加する。

変更前:
```ts
  await logSubmission(c.env, siteId, payload, ip, ua, send.messageId, "sent", null);
  return c.json({ ok: true, messageId: send.messageId });
});
```

変更後:
```ts
  await logSubmission(c.env, siteId, payload, ip, ua, send.messageId, "sent", null);

  // 訪問者への自動返信。件名と本文が両方 D1 に入っているサイトだけ送る。
  // 成功ログ(status: "sent")より後に置くこと。先に置くと、自動返信だけ失敗した
  // ケースが後続の "sent" 行に埋もれて見えなくなる
  if (site.autoreply_subject && site.autoreply_body) {
    const reply = await sesSend({
      region: c.env.SES_REGION,
      accessKeyId: c.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      from: c.env.SES_FROM_ADDRESS,
      fromName: c.env.SES_FROM_NAME,
      to: [email],
      // 訪問者が返信したら担当者に届くようにする
      replyTo: site.to_email.split(",").map((s) => s.trim()).filter(Boolean)[0],
      subject: site.autoreply_subject,
      bodyText: site.autoreply_body.replace(/\{\{name\}\}/g, name),
    });
    // 自動返信の失敗でフォーム送信全体を失敗にしない。通知メールが担当者に届いて
    // いれば商談は成立する。訪問者に「送信に失敗しました」と見せて二重送信させる
    // 方が損失が大きい
    if (!reply.ok) {
      await logSubmission(c.env, siteId, payload, ip, ua, null, "autoreply-failed", reply.error);
    }
  }

  return c.json({ ok: true, messageId: send.messageId });
});
```

`email` は Step 4 より前の必須判定で空でないことが保証されているため、追加のガードは要らない。

- [ ] **Step 6: 型チェックとドライランを通す**

```bash
cd /Users/kenfuruta/forms-endpoint && npm run typecheck && npx wrangler deploy --dry-run
```

Expected: どちらもエラーなし

- [ ] **Step 7: madoa-lp の自動返信文面を D1 に投入する**

ヒアドキュメントを一時ファイルにして流し込む。一時ファイルは `$CLAUDE_JOB_DIR/tmp` に置く。

```bash
cat > "$CLAUDE_JOB_DIR/tmp/madoa-autoreply.sql" <<'SQL'
UPDATE sites SET
  autoreply_subject = '【まどあ】お見積もりのご依頼を承りました',
  autoreply_body = '{{name}} 様

このたびは、まどあ（株式会社三喜）へお見積もりのご依頼をいただき
ありがとうございます。

内容を確認のうえ、担当者より2営業日以内にご連絡いたします。
現地を確認させていただいたうえで、補助金がいくら使えるかを含めて
お見積もりをお出しします。

お急ぎの場合は、お電話でもご相談を承ります。
　電話 078-597-2722（受付 8:30〜17:30 土日祝休み）

--------------------------------------------------
まどあ / 株式会社三喜
〒651-1113 神戸市北区鈴蘭台南町8丁目3-2
電話 078-597-2722
https://lp.madoa.co.jp/business/
--------------------------------------------------
※このメールは送信専用です。ご返信いただいた場合は担当者に届きます。'
WHERE site_id = 'madoa-lp';
SQL
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --file="$CLAUDE_JOB_DIR/tmp/madoa-autoreply.sql"
```

Expected: `"success": true` と `"changes": 1`

**「2営業日以内」は菊池様の確認待ちの文言。** 確認が取れて変更が必要になったら、この UPDATE を打ち直すだけでよい（Worker の再デプロイもLPのビルドも不要）。

- [ ] **Step 8: 投入した文面を読み返す**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"SELECT autoreply_subject, autoreply_body FROM sites WHERE site_id='madoa-lp';" \
--json 2>/dev/null | python3 -c "
import sys,json
r = json.load(sys.stdin)[0]['results'][0]
print(r['autoreply_subject']); print('---'); print(r['autoreply_body'])"
```

Expected: 改行が保たれていること、`{{name}} 様` で始まること、住所が `〒651-1113 神戸市北区鈴蘭台南町8丁目3-2` であること

- [ ] **Step 9: デプロイ**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler deploy
```

- [ ] **Step 10: 自動返信が届くことを実際に確認する**

```bash
curl -s -X POST https://forms.37d.jp/submit \
  -H 'Content-Type: application/json' \
  -d '{"site_id":"madoa-lp","name":"自動返信テスト","email":"ken.furuta@37design.co.jp","phone":"078-000-0000","company":"テスト商事","message":"自動返信の確認"}'
```

Expected: `{"ok":true,...}` と、`ken.furuta@37design.co.jp` に**2通**届く。

1. 通知メール（件名 `[まどあ] お問い合わせ: 自動返信テスト様より`）
2. 自動返信（件名 `【まどあ】お見積もりのご依頼を承りました`、本文冒頭が `自動返信テスト 様`）

自動返信で確認すること: `{{name}}` が置換されていること、改行が崩れていないこと、返信すると `ken.furuta@37design.co.jp` に返ること（Reply-To ヘッダ）。

- [ ] **Step 11: 既存クライアントに自動返信が飛ばないことを確認する**

```bash
curl -s -X POST https://forms.37d.jp/submit \
  -H 'Content-Type: application/json' \
  -d '{"site_id":"test-37d","name":"自動返信なし確認","email":"ken.furuta@37design.co.jp","message":"既存クライアントには自動返信が飛ばないこと"}'
```

Expected: `{"ok":true,...}` と、届くメールは**通知メール1通だけ**。`【まどあ】` の件名が来たら Step 5 の条件分岐が壊れている

- [ ] **Step 12: コミット**

```bash
cd /Users/kenfuruta/forms-endpoint
git add src/types.ts src/index.ts
git commit -m "$(cat <<'EOF'
機能: 訪問者への自動返信メールを追加

文面は sites テーブルに持たせ、件名と本文が両方入っているサイトだけ送る。
NULL の既存クライアントには一切送らない。

自動返信の失敗で /submit 全体を失敗にはしない。通知メールが担当者に届いて
いれば商談は成立するので、訪問者に送信失敗を見せて二重送信させる方が損失が大きい。
失敗は status: autoreply-failed でログに残す。

/send をフロントから叩く方式は採らなかった。公開ページから任意宛先に送れる
エンドポイントを呼ばせるとスパムの踏み台になるため。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RexD3TisPEqWvRSRSu6ydA
EOF
)"
```

---

## Task 3: 全ページ共通の submit リスナーを削除する

**作業リポジトリ:** `/Users/kenfuruta/madoa-lp`

**Files:**
- Modify: `src/layouts/Layout.astro:220-224`

**Interfaces:**
- Consumes: なし
- Produces: フォーム送信時に `generate_lead` が自動発火しない状態。Task 4 のサンクスページが計測の唯一の発火点になる前提

**背景:** `Layout.astro` には全ページ共通の `submit` リスナーがあり、コメントに「現状フォームなし、将来のフォーム設置時に発火」と書かれている。今回フォームを設置するので、このまま放置するとサンクスページと合わせて `generate_lead` が2回、`fbq Lead` が2回飛ぶ。

設計では計測の発火点をサンクスページ1箇所に決めている。送信の成否をURLで判定できる方が確実で、フォーム側に持たせると JS エラー時の取りこぼしが起きるため。したがって**このリスナーを消す**のが正しい。

さらに、このリスナーは `capture: true` で全フォームを拾うため、将来 LP に検索ボックスや絞り込みフォームを置いたときも `generate_lead` を撃ってしまう。消す理由はこの点でも十分にある。

- [ ] **Step 1: 削除前に発火経路を確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -n "generate_lead\|addEventListener('submit'" src/layouts/Layout.astro
```

Expected: `submit` リスナーと `generate_lead` がそれぞれ1箇所ずつ、220行目付近に出る。ここ以外に `generate_lead` が無いことを確認する

- [ ] **Step 2: リスナーを削除し、理由をコメントで残す**

`src/layouts/Layout.astro` の該当箇所を書き換える。

変更前:
```js
        // フォーム送信完了（現状フォームなし、将来のフォーム設置時に発火）
        document.addEventListener('submit', function(){
          if (window.gtag) gtag('event', 'generate_lead');
          if (window.fbq) fbq('track', 'Lead', { content_name: 'Contact Form' });
        }, true);
```

変更後:
```js
        // フォーム送信の計測はここでは行わない。
        // 送信完了の判定はサンクスページ（/business/thanks/）への到達で行い、
        // generate_lead と Lead はそこで1回だけ撃つ。
        // ここに submit リスナーを置くと、送信ボタンを押した時点とサンクスページ
        // 到達時の2回発火して二重計上になる。加えて capture:true で全フォームを
        // 拾うため、検索ボックスのような無関係なフォームでも成果として記録される
```

- [ ] **Step 3: 他に generate_lead を撃つ箇所が無いことを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -rn "gtag('event', 'generate_lead'" src/
```

Expected: 出力なし（この時点ではサンクスページがまだ無いため）

**単に `generate_lead` を grep しないこと。** Step 2 で置いたコメントの本文に
`generate_lead` という文字列が含まれるため、必ず1件ヒットして誤判定になる。
判定したいのは「実際に撃つコードが残っていないか」なので、呼び出しの形で検索する。

- [ ] **Step 4: ビルドとスモークテストを通す**

```bash
cd /Users/kenfuruta/madoa-lp && DEPLOY_TARGET=production npm run build && npm test
```

Expected: `PASS すべてのスモークテストを通過`

計測チェック（CHECK 1）は `gtag(` を呼ぶページにスタブがあることを見る。リスナーを消しても `click_line` / `click_phone` の `gtag(` 呼び出しは残っているので、この検査は引き続き有効に働く。

- [ ] **Step 5: コミット**

```bash
cd /Users/kenfuruta/madoa-lp
git add src/layouts/Layout.astro
git commit -m "$(cat <<'EOF'
修正: 全ページ共通の submit リスナーを削除し、二重計上を防ぐ

フォーム設置を見越して置かれていたリスナーだが、計測の発火点は
サンクスページ1箇所に決めたため、残すと generate_lead が2回飛ぶ。
capture:true で全フォームを拾う点も、検索ボックス等を置いたときに
誤って成果として記録される原因になる。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RexD3TisPEqWvRSRSu6ydA
EOF
)"
```

---

## Task 4: サンクスページを作る

**作業リポジトリ:** `/Users/kenfuruta/madoa-lp`

**Files:**
- Create: `src/pages/business/thanks/index.astro`

**Interfaces:**
- Consumes: Task 3（共通 submit リスナーが消えていること）
- Produces: `/business/thanks/` が到達時に `gtag('event','generate_lead',{location:'business-form'})` と `fbq('track','Lead',{content_name:'Business Estimate Form'})` を1回送出する。Task 5 のフォームがこの URL へ遷移する。Task 7 のカスタムコンバージョンがこの URL を条件に使う

**設計上の注意:**

- `noindex` を true にする。サンクスページが検索結果に出ると、フォームを通らずに直接到達した人が成果としてカウントされる
- `preloadImage` に `images/logo.svg` を渡す。既定は `images/mainimage.webp`（トップのFV画像）で、サンクスページでは使わないため preload すると無駄な転送になる
- 計測スクリプトは `is:inline` で書く。Astro のバンドルを通すと `window.gtag` の初期化順より先に走る恐れがある
- `Layout` の計測ガード（本番ホスト判定・関係者の印）はそのまま効くので、`?internal=1` を踏んだブラウザでは発火しない

- [ ] **Step 1: サンクスページを作る**

`src/pages/business/thanks/index.astro` を新規作成する。

```astro
---
import Layout from '../../../layouts/Layout.astro';
import Footer from '../../../components/Footer.astro';

const base = import.meta.env.BASE_URL;
---

<Layout
  title="お見積もりのご依頼を受け付けました | 神戸のMADOA"
  description="お見積もりのご依頼を受け付けました。担当者より2営業日以内にご連絡いたします。"
  variant="line"
  ogImage="business.jpg"
  noindex={true}
  preloadImage="images/logo.svg"
>
  <section class="bg-gradient-to-br from-primary-700 to-primary-900 py-20 md:py-28">
    <div class="max-w-2xl mx-auto px-4 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-9 h-9 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </div>

      <h1 class="text-2xl md:text-3xl font-bold text-white mb-4">
        お見積もりのご依頼を<br class="sm:hidden" />受け付けました
      </h1>

      <p class="text-white text-lg mb-2">
        担当者より2営業日以内にご連絡いたします。
      </p>
      <p class="text-primary-200 mb-10">
        ご入力いただいたメールアドレス宛に、受付確認のメールをお送りしました。<br />
        届かない場合は迷惑メールフォルダをご確認ください。
      </p>

      <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
        <p class="text-white font-bold mb-3">お急ぎの場合はお電話でも承ります</p>
        <a
          href="tel:078-597-2722"
          class="inline-flex items-center gap-3 bg-[#0080c4] hover:bg-[#0073ad] text-white font-bold py-4 px-8 rounded-full text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
          078-597-2722
        </a>
        <p class="text-primary-200 text-sm mt-3">受付時間: 8:30〜17:30（土日祝休み）</p>
      </div>

      <a href={`${base}business/`} class="text-primary-100 underline hover:text-white transition-colors">
        法人向けのご案内に戻る
      </a>
    </div>
  </section>

  <Footer variant="line" />
</Layout>

<script is:inline>
  // 見積もり依頼の完了イベント。発火はこのページの1箇所だけ。
  // フォーム側の submit で撃つと、送信失敗やリダイレクト前の離脱でも成果に
  // なってしまうため、実際に完了ページへ着いたことを条件にしている。
  // window.gtag のスタブと Meta Pixel は Layout が本番ビルドのときだけ用意する。
  // 関係者の印（?internal=1）が付いた端末では window.fbq 自体が存在せず、
  // GA4 も ga-disable で止まるため、ここは素通りして何も送られない
  if (window.gtag) gtag('event', 'generate_lead', { location: 'business-form' });
  if (window.fbq) fbq('track', 'Lead', { content_name: 'Business Estimate Form' });
</script>
```

- [ ] **Step 2: ビルドが通り、ページが生成されることを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && DEPLOY_TARGET=production npm run build && ls -la dist/business/thanks/index.html
```

Expected: `dist/business/thanks/index.html` が存在する

- [ ] **Step 3: noindex が入っていることを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -o 'name="robots"[^>]*' dist/business/thanks/index.html
```

Expected: `name="robots" content="noindex, nofollow"`

**出力が空なら失敗。** 本番ビルドでは `noindex` prop を渡したページだけがこのタグを持つ。サンクスページが検索結果に出ると、フォームを通らない到達が成果として計上される。

- [ ] **Step 4: 計測イベントが埋め込まれていることを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -o "generate_lead[^;]*" dist/business/thanks/index.html && grep -c "fbevents.js" dist/business/thanks/index.html
```

Expected: `generate_lead', { location: 'business-form' }` が出て、`fbevents.js` が1件以上

- [ ] **Step 5: 法人LP本体では generate_lead が撃たれないことを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -c "gtag('event', 'generate_lead'" dist/business/index.html
```

Expected: `0`

1以上なら Task 3 の削除が反映されていない。二重計上の状態なので Task 3 に戻る。

**単に `generate_lead` を grep すると 1 が返る。** Task 3 で置いたコメントが
`is:inline` スクリプト内にあり、本番ビルドの出力にそのまま残るため
（`dist/business/index.html:180` 付近）。撃っているかどうかは呼び出しの形で判定する。

- [ ] **Step 6: スモークテストを通す**

```bash
cd /Users/kenfuruta/madoa-lp && npm test
```

Expected: `PASS すべてのスモークテストを通過`

`business/thanks/index.html` の行が `OK` で出ていること。画像重量が予算内であること。

- [ ] **Step 7: コミット**

```bash
cd /Users/kenfuruta/madoa-lp
git add src/pages/business/thanks/index.astro
git commit -m "$(cat <<'EOF'
実装: 法人LPのサンクスページを追加し、計測の発火点をここに一本化

noindex を入れる。検索結果に出るとフォームを通らない到達が成果になるため。
preload はロゴにする。既定のトップFV画像はこのページで使わない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RexD3TisPEqWvRSRSu6ydA
EOF
)"
```

---

## Task 5: 見積もり依頼フォームを作り、法人LPに組み込む

**作業リポジトリ:** `/Users/kenfuruta/madoa-lp`

**Files:**
- Create: `src/components/business/BusinessForm.astro`
- Modify: `src/pages/business/index.astro`

**Interfaces:**
- Consumes: Task 1（`site_id=madoa-lp` が D1 に登録済み、`message` が任意）、Task 4（`/business/thanks/` が存在する）
- Produces: `/business/` に `id="estimate-form"` のセクションが表示され、送信すると `/business/thanks/` へ遷移する

**送信方式の決定:** ネイティブの form POST は使わない。`action="https://forms.37d.jp/submit"` で素直に送るとブラウザが forms.37d.jp へ遷移し、訪問者に JSON が表示される。`fetch` で送り、成功したら `location.href` でサンクスページへ移す。

**Content-Type の決定:** `FormData` をそのまま `fetch` の body に渡す（multipart/form-data）。これは CORS のセーフリスト対象なので preflight が発生しない。JSON にすると OPTIONS の往復が1回増え、失敗点も1つ増える。Worker は `application/json` 以外を `c.req.formData()` で処理するので受け側の変更は不要。

**フィールド名:** `name` と `phone` は Worker が専用カラムへ振り分ける名前なので厳守する。`company` / `address` は `[その他]` 欄に入る。

- [ ] **Step 1: フォームコンポーネントを作る**

`src/components/business/BusinessForm.astro` を新規作成する。

```astro
---
const base = import.meta.env.BASE_URL;
---

<section id="estimate-form" class="bg-gray-50 py-16 md:py-24" data-track-location="estimate-form">
  <div class="max-w-2xl mx-auto px-4">
    <div class="text-center mb-10">
      <h2 class="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
        無料でお見積もりに伺います
      </h2>
      <p class="text-gray-600 text-lg">
        現地を確認させていただいたうえで、補助金がいくら使えるかを含めてお出しします。
      </p>
      <p class="text-gray-500 text-sm mt-2">
        ご依頼いただいても、その場での契約をお願いすることはありません。
      </p>
    </div>

    <!-- novalidate は付けない。必須チェックはブラウザ標準に任せる（JSに依存させない） -->
    <form id="business-estimate-form" class="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-5">
      <!-- 送信失敗時にだけ出す。行き止まりにせず電話へ逃がす -->
      <div id="form-error" class="hidden rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
        送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。<br />
        お急ぎの場合は <a href="tel:078-597-2722" class="font-bold underline">078-597-2722</a> へお電話ください。
      </div>

      <div>
        <label for="f-company" class="block font-bold text-gray-900 mb-1.5">
          法人名・店舗名 <span class="text-red-600 text-sm">必須</span>
        </label>
        <input type="text" id="f-company" name="company" required autocomplete="organization"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
      </div>

      <div>
        <label for="f-name" class="block font-bold text-gray-900 mb-1.5">
          ご担当者名 <span class="text-red-600 text-sm">必須</span>
        </label>
        <input type="text" id="f-name" name="name" required autocomplete="name"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
      </div>

      <div>
        <label for="f-phone" class="block font-bold text-gray-900 mb-1.5">
          電話番号 <span class="text-red-600 text-sm">必須</span>
        </label>
        <input type="tel" id="f-phone" name="phone" required autocomplete="tel" inputmode="tel"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
      </div>

      <div>
        <label for="f-email" class="block font-bold text-gray-900 mb-1.5">
          メールアドレス <span class="text-red-600 text-sm">必須</span>
        </label>
        <input type="email" id="f-email" name="email" required autocomplete="email"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
        <p class="text-gray-500 text-sm mt-1.5">お見積もりの送付先になります。</p>
      </div>

      <div>
        <label for="f-address" class="block font-bold text-gray-900 mb-1.5">物件の所在地</label>
        <input type="text" id="f-address" name="address" placeholder="神戸市北区..."
          class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none" />
      </div>

      <div>
        <label for="f-message" class="block font-bold text-gray-900 mb-1.5">ご相談内容</label>
        <textarea id="f-message" name="message" rows="4" placeholder="窓の枚数、お困りごとなど（分かる範囲で構いません）"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"></textarea>
      </div>

      <!-- ハニーポット。人間には見えない。botが埋めるとWorker側が破棄する -->
      <div class="absolute w-px h-px overflow-hidden -m-px" aria-hidden="true">
        <label for="f-website">ウェブサイト</label>
        <input type="text" id="f-website" name="website" tabindex="-1" autocomplete="off" />
      </div>

      <button type="submit" id="form-submit"
        class="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-4 px-8 rounded-full text-lg transition-all shadow-lg hover:shadow-xl">
        無料見積もりを依頼する
      </button>

      <p class="text-gray-500 text-sm text-center">
        しつこい営業は一切いたしません。
      </p>
    </form>
  </div>
</section>

<script is:inline define:vars={{ thanksUrl: `${base}business/thanks/` }}>
  (function () {
    var form = document.getElementById('business-estimate-form');
    if (!form) return;
    var button = document.getElementById('form-submit');
    var errorBox = document.getElementById('form-error');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorBox.classList.add('hidden');
      // 二重送信の防止。押した直後に落とす
      button.disabled = true;
      button.textContent = '送信中...';

      try {
        var data = new FormData(form);
        data.append('site_id', 'madoa-lp');
        // FormData をそのまま渡すと multipart/form-data になる。
        // これは CORS のセーフリスト対象なので preflight(OPTIONS)が発生しない
        var res = await fetch('https://forms.37d.jp/submit', { method: 'POST', body: data });
        var json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || 'send-failed');
        // 計測イベントはサンクスページ側で1回だけ撃つ。ここでは撃たない
        location.href = thanksUrl;
      } catch (err) {
        errorBox.classList.remove('hidden');
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        button.disabled = false;
        button.textContent = '無料見積もりを依頼する';
      }
    });
  })();
</script>
```

- [ ] **Step 2: 法人LPにフォームを差し込む**

`src/pages/business/index.astro` を2箇所変更する。

import の追加（`BusinessFaq` の import の直後に置く）:

変更前:
```astro
import BusinessFaq from '../../components/business/BusinessFaq.astro';
import Cta from '../../components/Cta.astro';
```

変更後:
```astro
import BusinessFaq from '../../components/business/BusinessFaq.astro';
import BusinessForm from '../../components/business/BusinessForm.astro';
import Cta from '../../components/Cta.astro';
```

配置（`Cta` の直前に入れる。LINE・電話は残して3択にする。電話をかけたい層を取りこぼさないため）:

変更前:
```astro
  <BusinessFaq />
  <Cta variant="line" />
```

変更後:
```astro
  <BusinessFaq />
  <BusinessForm />
  <Cta variant="line" />
```

- [ ] **Step 3: ビルドを通す**

```bash
cd /Users/kenfuruta/madoa-lp && DEPLOY_TARGET=production npm run build && npm test
```

Expected: `PASS すべてのスモークテストを通過`

- [ ] **Step 4: フォームが出力されていることを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -o 'name="\(company\|name\|phone\|email\|address\|message\|website\)"' dist/business/index.html | sort -u
```

Expected: 7つすべてが出る

```
name="address"
name="company"
name="email"
name="message"
name="name"
name="phone"
name="website"
```

`name="tel"` が混じっていたら Worker が `phone` 列に振り分けられない。修正する。

- [ ] **Step 5: 遷移先URLが正しく埋まっていることを確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -o 'thanksUrl[^<]*' dist/business/index.html | head -3
```

Expected: `thanksUrl` に `/business/thanks/` が入っていること（本番ビルドなら `"/business/thanks/"`）

- [ ] **Step 6: 法人LPで generate_lead が撃たれないままであることを再確認する**

```bash
cd /Users/kenfuruta/madoa-lp && grep -c "gtag('event', 'generate_lead'" dist/business/index.html
```

Expected: `0`

Task 4 Step 5 と同じ理由で、呼び出しの形で検索する。

- [ ] **Step 7: ローカルで実際に送信してみる**

```bash
cd /Users/kenfuruta/madoa-lp && npm run preview
```

ブラウザで `http://localhost:4321/business/` を開き、フォームに入力して送信する。

確認すること:
1. 必須4項目を空のまま送信ボタンを押すとブラウザの標準バリデーションが止める
2. モバイル幅（375px）で入力欄がはみ出さない
3. 送信ボタンを押すと「送信中...」になり、二度押しできない

**ただしこの段階では送信は失敗する。** `npm run preview` の Origin は `http://localhost:4321` で、Worker の `allowed_origins`（`https://lp.madoa.co.jp`）に含まれないため 403 が返る。エラーメッセージが出て電話番号が案内されること、ボタンが押せる状態に戻ることを確認する。これがエラー処理の実地確認になる。

実際の送信確認は Task 6（本番デプロイ後）で行う。

- [ ] **Step 8: コミット**

```bash
cd /Users/kenfuruta/madoa-lp
git add src/components/business/BusinessForm.astro src/pages/business/index.astro
git commit -m "$(cat <<'EOF'
実装: 法人LPに見積もり依頼フォームを設置

見出しは「無料でお見積もりに伺います」。8/8の打ち合わせで、お問い合わせでは
なく見積もり訪問の形にすると決めた。必須は法人名・担当者名・電話・メールの4つ。

送信は fetch で forms.37d.jp へ。ネイティブ POST だと訪問者に JSON が
表示されてしまう。FormData のまま送ることで CORS の preflight を避ける。
フィールド名の name と phone は Worker が専用カラムに振り分ける名前なので変えない。

LINE・電話は残して3択にした。電話をかけたい層を取りこぼさないため。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RexD3TisPEqWvRSRSu6ydA
EOF
)"
```

---

## Task 6: 本番へデプロイし、実送信で通しを確認する

**作業リポジトリ:** `/Users/kenfuruta/madoa-lp`

**Files:** なし（デプロイのみ）

**Interfaces:**
- Consumes: Task 1〜5 すべて
- Produces: `https://lp.madoa.co.jp/business/` に本番のフォームが出ている状態。Task 7 のカスタムコンバージョン設定がこの URL でテストできる

- [ ] **Step 1: 本番ビルドとスモークテスト**

```bash
cd /Users/kenfuruta/madoa-lp && DEPLOY_TARGET=production npm run build && npm test
```

Expected: `PASS すべてのスモークテストを通過`

- [ ] **Step 2: デプロイ**

```bash
cd /Users/kenfuruta/madoa-lp && rsync -avz --delete dist/ xserver:~/madoa.co.jp/public_html/lp.madoa.co.jp/
```

Expected: `business/thanks/index.html` が転送ファイルの一覧に出る

- [ ] **Step 3: Xserver のサーバーキャッシュを削除する**

**このステップを飛ばすと配信が古いままになる。** 2026-08-08 に実際に発生した（`docs/tracking.md` 参照）。Xアクセラレータとは別機能なので注意。

古田さんに Xserver サーバーパネルで次を実行してもらう。

**サーバーパネル > 高速化 > サーバーキャッシュ設定 > `lp.madoa.co.jp` > キャッシュ削除**

- [ ] **Step 4: 本番にフォームが出ていることを確認する**

```bash
curl -s https://lp.madoa.co.jp/business/ | grep -c 'id="business-estimate-form"'
```

Expected: `1`

**クエリを付けずに確認すること。** `?v=1` を付けるとキャッシュを回避してしまい、実際の訪問者が見ているものと違うものを見ることになる。0 が返るなら Step 3 のキャッシュ削除が効いていない。

- [ ] **Step 5: サンクスページが本番に出ていることを確認する**

```bash
curl -s https://lp.madoa.co.jp/business/thanks/ | grep -o 'name="robots"[^>]*'
```

Expected: `name="robots" content="noindex, nofollow"`

- [ ] **Step 6: 実際にフォームから送信する**

**`?internal=1` を踏んだブラウザで行う。** 本番の計測にテスト送信が混ざらないようにするため。

1. `https://lp.madoa.co.jp/?internal=1` を開く（普段使うブラウザ。LINE内蔵ブラウザでは効かない）
2. `https://lp.madoa.co.jp/business/` を開く
3. フォームに入力して送信する

確認すること:
- `/business/thanks/` に遷移すること
- `ken.furuta@37design.co.jp` に通知メールが届くこと
- 入力したメールアドレスに自動返信が届くこと
- ブラウザのコンソールで `window.fbq` が `undefined`、`window['ga-disable-G-1RZELJ5W9F']` が `true` であること（印が効いていて計測されていないこと）

- [ ] **Step 7: 印を外したブラウザで計測が飛ぶことを確認する**

シークレットウィンドウで `https://lp.madoa.co.jp/business/thanks/` を直接開き、開発者ツールのコンソールで確認する。

```js
window.dataLayer.filter(a => a[1] === 'generate_lead')
```

Expected: 1件だけ入っている（2件あれば二重計上。Task 3 の削除を確認する）

ネットワークタブで `facebook.com/tr` へのリクエストに `ev=Lead` が含まれることも確認する。

- [ ] **Step 8: D1 に記録が残っていることを確認する**

```bash
cd /Users/kenfuruta/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"SELECT created_at, name, email, phone, status FROM submissions WHERE site_id='madoa-lp' ORDER BY id DESC LIMIT 5;" \
--json 2>/dev/null | python3 -c "import sys,json; [print(r) for r in json.load(sys.stdin)[0]['results']]"
```

Expected: Step 6 の送信が `status: sent` で入っており、`phone` 列が空でないこと

**`phone` が None なら** フォームのフィールド名が `phone` になっていない。Task 5 Step 4 に戻る。

**`status: autoreply-failed` の行があれば** 自動返信の送信に失敗している。Task 2 Step 10 の確認に戻る。

---

## Task 7: Meta広告のカスタムコンバージョンを作る

**作業リポジトリ:** なし（Meta広告マネージャの操作）

**Files:**
- Modify: `docs/tracking.md`（madoa-lp リポジトリ）

**Interfaces:**
- Consumes: Task 6（本番にサンクスページが出ていること）
- Produces: 法人LP向けの成果が広告レポートに表示される状態

**背景:** 既存のカスタムコンバージョン（`LINEクリック_補助金LP` / `電話クリック_補助金LP`）は URL contains `lp.madoa.co.jp/subsidy` で定義されており、`/business/` にはマッチしない。このまま出稿すると成果が出ても広告レポート上は0件に見える。

- [ ] **Step 1: イベントマネージャで発火を確認する**

Meta広告マネージャ > イベントマネージャ > データソース > Pixel `971517092154665` > テストイベント

シークレットウィンドウで `https://lp.madoa.co.jp/business/thanks/` を開き、`Lead` イベントが `content_name: Business Estimate Form` 付きで届くことを確認する。

**届かない場合はカスタムコンバージョンを作っても意味がない。** Task 6 Step 7 に戻る。

- [ ] **Step 2: カスタムコンバージョンを3件作る**

イベントマネージャ > カスタムコンバージョン > カスタムコンバージョンを作成

| 名前 | イベント | ルール |
|---|---|---|
| `見積もり依頼_法人LP` | Lead | URL に `lp.madoa.co.jp/business/thanks` を含む |
| `LINEクリック_法人LP` | LineClick | URL に `lp.madoa.co.jp/business` を含む |
| `電話クリック_法人LP` | PhoneClick | URL に `lp.madoa.co.jp/business` を含む |

`見積もり依頼_法人LP` は URL に `thanks` まで入れる。`/business` だけにするとLP本体の閲覧でも発火する。

- [ ] **Step 3: 3件が「アクティブ」になっていることを確認する**

作成直後は「未受信」と出る。Step 1 のテスト送信のあとにアクティブへ変わる。

**「未受信」のままなら広告の最適化目標に指定できない。** 実際に1件通してから広告を作る。

- [ ] **Step 4: tracking.md に記録する**

`docs/tracking.md` の末尾に追記する。

```markdown
## 法人LP（/business/）の計測（2026-08-09 設定）

### イベント

| イベント | 発火場所 | パラメータ |
|---|---|---|
| `generate_lead` (GA4) | `/business/thanks/` 到達時 | `location: business-form` |
| `Lead` (Meta) | `/business/thanks/` 到達時 | `content_name: Business Estimate Form` |

発火はサンクスページの1箇所だけ。フォームの `submit` では撃たない。
送信失敗やリダイレクト前の離脱を成果に数えないため。

`Layout.astro` にあった全ページ共通の `submit` リスナーは削除した。
残すと送信時とサンクスページ到達時で2回発火し、二重計上になる。

### カスタムコンバージョン

| 名前 | 条件 |
|---|---|
| `見積もり依頼_法人LP` | URL contains `lp.madoa.co.jp/business/thanks` かつ イベント `Lead` |
| `LINEクリック_法人LP` | URL contains `lp.madoa.co.jp/business` かつ イベント `LineClick` |
| `電話クリック_法人LP` | URL contains `lp.madoa.co.jp/business` かつ イベント `PhoneClick` |

既存の補助金LP用（`LINEクリック_補助金LP` / `電話クリック_補助金LP`）は
URL contains `lp.madoa.co.jp/subsidy` なので `/business/` にはマッチしない。
別に作る必要があった。

広告の最適化目標には `見積もり依頼_法人LP` を使う。

### フォームの送信先

`https://forms.37d.jp/submit`（Cloudflare Worker + D1 + Amazon SES）。
`site_id` は `madoa-lp`。通知先は D1 の `sites.to_email`。
菊池様のアドレスに切り替える場合は次の1行だけでよい（LPのビルドもデプロイも不要）。

```bash
cd ~/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"UPDATE sites SET to_email='<新しいアドレス>' WHERE site_id='madoa-lp';"
```

自動返信の文面も同じテーブルの `autoreply_subject` / `autoreply_body` にある。
「2営業日以内」の文言を変える場合もここの UPDATE だけで済む。
```

- [ ] **Step 5: コミット**

```bash
cd /Users/kenfuruta/madoa-lp
git add docs/tracking.md
git commit -m "$(cat <<'EOF'
記録: 法人LPの計測イベントとカスタムコンバージョンを tracking.md に追記

既存のカスタムコンバージョンは /subsidy にしかマッチせず、法人LPの成果が
0件に見える状態だった。通知先と自動返信文面の変更手順も残す。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RexD3TisPEqWvRSRSu6ydA
EOF
)"
```

---

## 完了の定義

- [ ] `/business/` に見積もり依頼フォームが表示され、送信でメールが届く（Task 6 Step 6）
- [ ] 訪問者に自動返信が届く（Task 6 Step 6）
- [ ] 送信後に `/business/thanks/` へ遷移し、GA4 と Meta Pixel にイベントが1回だけ飛ぶ（Task 6 Step 7）
- [ ] Meta広告に法人向けカスタムコンバージョン3件が作成され、アクティブになっている（Task 7 Step 3）
- [ ] 本番へデプロイ済み、キャッシュクリア済み（Task 6 Step 3-5）
- [ ] 既存クライアント（吉市・Omoie・37design）のフォームが壊れていない（Task 1 Step 10、Task 2 Step 11）
- [ ] 8/17（月）に広告を出せる状態

## 古田さんの対応が要るもの

| 内容 | いつまで | 影響 |
|---|---|---|
| **「2営業日以内」と書いてよいか菊池様に確認** | 8/17 まで | 全依頼者に自動送信され続ける約束。変更は D1 の1行 UPDATE のみ（Task 2 Step 7 のSQLを打ち直す） |
| **Xserver サーバーキャッシュの削除** | Task 6 Step 3 | サーバーパネルへのログインが要るため |
| **通知先を菊池様のアドレスにするか** | 8/17 まで | D1 の1行 UPDATE のみ |
| **広告のエリアを神戸市全体に広げるか** | 8/17 まで | 広告側の設定。LPには影響しない |
