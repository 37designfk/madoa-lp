# 法人LP 見積もり依頼フォームと計測整備 設計

作成: 2026-08-09
目的: 2026-08-17（月）の法人向け広告の配信開始に間に合わせる
決定の出典: `docs/client-notes/2026-08-08.md`（個人向け広告の停止と法人シフトの決定）

## 背景

1ヶ月・1日500円で回した個人向け広告は、設定変更で効率は改善したが（CTR 1.53%→2.20%、CPC ¥50→¥37）
電話・LINEのタップは0件のままだった。菊池様と協議のうえ個人向けを停止し、法人向けへ移す判断をした。

法人は工事費の桁が違い、補助金額も大きい。神戸市北区に競合が少ない。
会議では導線について「お問い合わせではなく**見積もりに伺います**の形式にし、
法人名と電話番号を書いてもらう」と決めている。

## 現状の問題

### 1. LPに入力フォームが1つも存在しない

`SubsidyForm.astro` という名前のコンポーネントはあるが、**中身は電話とLINEのボタンだけ**でフォームではない。
法人LPには `Cta` / `MidCta` / `StickyContact` が置かれているが、すべて LINE と電話への導線。

法人の担当者が業務中に個人のLINEを友だち追加するハードルは高い。受け皿がない状態。

### 2. 法人LPのコンバージョンが計測されない

既存のカスタムコンバージョン（`LINEクリック_補助金LP` / `電話クリック_補助金LP`）は
URL contains `lp.madoa.co.jp/subsidy` で定義されている。**`/business/` はマッチしない。**

このまま出稿すると、成果が出ても広告レポート上は0件に見える。
8/22の打ち合わせで「個人と法人どちらが良かったか」を比較する予定があるため、先に直す必要がある。

## スコープ

**やる**: 見積もり依頼フォームの新設、サンクスページ、計測の整備。

**やらない**: LP本体（Hero・TrustBar・Problems・Subsidy・Reasons・FAQ）の変更。
7/25に菊池様のチェックを通った部分なので、今回は触らない。
ファーストビューの見直しと診断ウィジェットの移植も今回は範囲外（8/22以降に再検討）。

## 設計

### コンポーネント構成

```
src/components/business/BusinessForm.astro   新規。見積もり依頼フォーム
src/pages/business/thanks/index.astro        新規。送信完了ページ（noindex）
src/pages/business/index.astro               変更。BusinessForm を追加
```

`BusinessForm` は「フォームを表示し、forms.37d.jp に POST する」ことだけを担う。
計測イベントの送出はサンクスページ側に置く。送信の成否をURLで判定できる方が確実で、
フォーム側にイベント送出を持たせると二重計測やJSエラー時の取りこぼしが起きる。

### データフロー

```
訪問者 → BusinessForm（/business/）
       → POST https://forms.37d.jp/submit
       → Cloudflare Worker（forms-endpoint）
          ├→ D1 submissions に記録
          └→ Amazon SES で通知メール送信
             From: noreply@37d.jp（固定）
             Reply-To: 訪問者のメールアドレス
             To: ken.furuta@37design.co.jp
       → /business/thanks/ へリダイレクト
       → GA4 generate_lead + Meta Pixel Lead を送出
```

通知先は当面 `ken.furuta@37design.co.jp`。菊池様のアドレスが分かった時点で
D1 の `sites.to_email` を1行 UPDATE すれば切り替わる（LP側の変更は不要）。

### フォーム項目

| 項目 | name | 必須 | 備考 |
|---|---|---|---|
| 法人名・店舗名 | `company` | 必須 | 会議で明示された項目 |
| ご担当者名 | `name` | 必須 | Worker が必須扱い |
| 電話番号 | `phone` | 必須 | 会議で明示された項目 |
| メールアドレス | `email` | **必須** | Reply-To に入る。Worker が必須扱い |
| 物件の所在地 | `address` | 任意 | 神戸市内かの判別に使う |
| ご相談内容 | `message` | 任意 | 下記「Worker 側の必須判定」参照 |
| （ハニーポット） | `website` | — | 非表示。値が入っていたら弾く |

必須は4つ。法人相手なので、電話がつながらないときの連絡手段としてメールを押さえておく。
見積もりを送る宛先にもなる。所在地を任意で置くのは、神戸市外からの問い合わせを事前に見分けるため。

メールは `type="email"` にしてブラウザ側で形式を検証する。

`name` は必ず `name`、電話は必ず `phone` にする。Worker の `logSubmission` と通知メール本文は
この2つの名前で専用カラム・専用行に振り分けており（`src/index.ts:170-192`）、
`tel` のような別名で送ると「その他」欄に落ちて D1 の `phone` 列が空になる。

#### Worker 側の必須判定（要変更）

現在の `/submit` は `name` / `email` / `message` の3つが揃わないと 400 を返す（`src/index.ts:73`）。
設計では「ご相談内容は任意」としているため、**このままでは相談内容を空欄にした人が全員弾かれる。**

`message` を必須から外す（`name` と `email` のみ必須にする）。

どの項目を必須にするかはフォームごとの要件であって、共通基盤が一律に強制するものではない。
既存クライアント（吉市・Omoie・37design）のフォームは各自の HTML で `required` を付けているため、
サーバー側の判定を緩めても実際の入力体験は変わらない。

### 文言

見出しは「**無料でお見積もりに伺います**」。会議の決定に従い「お問い合わせ」とは書かない。
補足文で「現地を見てから、補助金がいくら使えるかを含めてお出しします」の趣旨を添える。

### 配置

`/business/` の `<Cta variant="line" />` の直前に `<BusinessForm />` を入れる。
LINE・電話は残し、フォームを加えて3択にする。潰さない理由は、
電話をかけたい層を取りこぼさないため。

### サンクスページ

`/business/thanks/`。`Layout` の `noindex` を true にする。

- 「お問い合わせありがとうございます。担当者より2営業日以内にご連絡します」
- 電話番号を再掲（急ぐ場合の導線）
- `/business/` へ戻るリンク

到達時に以下を送出する。`Layout` の計測ガード（本番ホスト判定・内部トラフィックの印）は
そのまま効くので、関係者アクセスでは発火しない。

```js
gtag('event', 'generate_lead', { location: 'business-form' });
fbq('track', 'Lead', { content_name: 'Business Estimate Form' });
```

### 計測（Meta広告側の設定）

カスタムコンバージョンを3件作成する。既存の補助金LP用は `/subsidy` にしかマッチしないため別に作る。

| 名前 | 条件 |
|---|---|
| `見積もり依頼_法人LP` | URL contains `lp.madoa.co.jp/business/thanks` |
| `LINEクリック_法人LP` | URL contains `lp.madoa.co.jp/business` かつ イベント `LineClick` |
| `電話クリック_法人LP` | URL contains `lp.madoa.co.jp/business` かつ イベント `PhoneClick` |

広告の最適化目標には `見積もり依頼_法人LP` を使う。

### エラー処理

- **必須項目の未入力**: HTML の `required` でブラウザに任せる。JSに依存しない
- **送信失敗（ネットワーク・Worker側エラー）**: フォーム上部にエラーメッセージを出し、
  電話番号を添えて「お電話でも承ります」と案内する。ユーザーを行き止まりにしない
- **スパム**: ハニーポット `website` に値が入っていたら Worker 側で破棄（既存の実装）
- **二重送信**: 送信ボタンを押した直後に disabled にする

### 自動返信メール（共通基盤の改修を伴う）

現在の `forms-endpoint` に自動返信機能はない。`/submit` は通知メールを `to_email` へ送るだけ。
訪問者のメールアドレスは Reply-To に入れているのみで、訪問者宛には何も送っていない。

`/send`（任意宛先へ送る汎用エンドポイント）は存在するが、**これをLPのフロントから叩く方式は採らない。**
公開ページから任意宛先に送れるエンドポイントを呼ばせると、スパムの踏み台になる。

#### 方針

`/submit` の処理内で、通知メールの送信後に訪問者宛の自動返信をもう1通送る。
文面は `sites` テーブルに持たせ、**NULL なら送らない**。これで既存クライアント（吉市など）には影響しない。

```sql
ALTER TABLE sites ADD COLUMN autoreply_subject TEXT;
ALTER TABLE sites ADD COLUMN autoreply_body TEXT;
```

`src/index.ts` の `/submit` に追加する処理:

```ts
// 自動返信（設定があり、訪問者のメールアドレスが取れているときだけ）
if (site.autoreply_subject && site.autoreply_body && email) {
  const reply = await sesSend({
    /* ...共通の認証情報... */
    to: [email],
    replyTo: site.to_email.split(",")[0].trim(),  // 返信は担当者へ届く
    subject: site.autoreply_subject,
    bodyText: site.autoreply_body.replace(/\{\{name\}\}/g, name),
  });
  // 自動返信の失敗で /submit 全体を失敗にしない。ログに残して 200 を返す
  if (!reply.ok) {
    await logSubmission(c.env, siteId, payload, ip, ua, null,
                        "autoreply-failed", reply.error);
  }
}
```

`logSubmission` の `status` は現在 `"sent" | "failed" | "spam"` の3値に固定されている
（`src/index.ts:202`）。`"autoreply-failed"` を足す。`submissions.status` は TEXT なので
DB スキーマの変更は要らない。

**この行を「通知メール送信の成功ログ」より後ろに置く。** 先に置くと、
自動返信だけ失敗したケースで `status: "sent"` の行に上書きされ、失敗が見えなくなる。

**自動返信の失敗をフォーム送信の失敗にしない。** 通知メールが担当者に届いていれば商談は成立する。
訪問者に「送信に失敗しました」と見せて二重送信させる方が損失が大きい。

`{{name}}` だけ差し込みに対応する。テンプレート機能を作り込まない（YAGNI）。

#### 文面（madoa-lp 用）

件名: `【まどあ】お見積もりのご依頼を承りました`

```
{{name}} 様

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
※このメールは送信専用です。ご返信いただいた場合は担当者に届きます。
```

住所は `src/components/Footer.astro` の記載（LPで公開中のもの）に合わせた。
署名の情報はLPと二重管理になるため、**変更が入ったらフッターとDBの両方を直す**。

#### 影響範囲

Worker の再デプロイは共通基盤全体にかかる（全クライアントのフォームが数秒止まる）。
デプロイ前に `npx wrangler deploy --dry-run` で通ることを確認し、
デプロイ後に既存クライアント1件で送信テストを行う。

### D1 への登録

```sql
INSERT INTO sites (site_id, domain, to_email, subject_prefix, allowed_origins)
VALUES ('madoa-lp', 'lp.madoa.co.jp', 'ken.furuta@37design.co.jp', '[まどあ]',
        'https://lp.madoa.co.jp');
```

D1 のデータベース名は **`forms_endpoint`**（ハイフンではなくアンダースコア）。
`wrangler.toml` の `database_id` は `429cfcde-d460-4078-bcba-48dc79ac8bd4`。

`sites` の実カラムは確認済み。`site_id` / `domain` / `to_email` / `subject_prefix` /
`allowed_origins` / `turnstile_site_key` / `turnstile_secret_key` / `enabled` /
`created_at` / `updated_at`。Turnstile は既存3クライアントとも未設定なので madoa も NULL でよい。

**D1 の権限エラー（code 7403）は 2026-08-09 に解消済み。** 古田さんが `wrangler login` で
再認証し、トークンのスコープに `d1 (write)` が入った。スクリプトから操作できる。

## テスト

`npm test`（`scripts/smoke-test.mjs`）は dist に対して gtag 定義・画像量・未参照画像を検査する。
新規ページを足すのでこれを通す。加えて以下を手で確認する。

1. **ビルドが通る** — `DEPLOY_TARGET=production npm run build`
2. **フォームが表示される** — モバイル幅で崩れないこと
3. **実送信** — テスト送信して `ken.furuta@37design.co.jp` にメールが届くこと
4. **サンクスページへの遷移** — 送信後に `/business/thanks/` に着くこと
5. **計測の発火** — サンクスページで `dataLayer` に `generate_lead` が入ること。
   `?internal=1` を踏んだブラウザでは発火しないこと（印方式の確認も兼ねる）
6. **noindex** — サンクスページに `noindex, nofollow` が入っていること

3 の実送信では、本番の計測に混ざらないよう `?internal=1` を踏んだブラウザで行う。

## デプロイ

```bash
DEPLOY_TARGET=production npm run build
npm test
rsync -avz --delete dist/ xserver:~/madoa.co.jp/public_html/lp.madoa.co.jp/
```

デプロイ後、**サーバーパネル > 高速化 > サーバーキャッシュ設定 > キャッシュ削除**を実行する。
2026-08-08 に、これをしないと配信が古いままになる事象を確認している（`docs/tracking.md` 参照）。

確認はクエリを付けない素のURLで行う。`?v=1` を付けるとキャッシュを回避してしまい誤認する。

## 完了の定義

- [ ] `/business/` に見積もり依頼フォームが表示され、送信でメールが届く
- [ ] 送信後に `/business/thanks/` へ遷移し、GA4 と Meta Pixel にイベントが飛ぶ
- [ ] Meta広告に法人向けカスタムコンバージョン3件が作成され、テスト送信で発火が確認できる
- [ ] 本番へデプロイ済み、キャッシュクリア済み
- [ ] 8/17（月）に広告を出せる状態

## 残る判断（古田さん）

- **「2営業日以内にご連絡します」と書いてよいか、菊池様に確認する。**
  自動返信とサンクスページの両方に出る約束で、以後すべての依頼者に自動送信され続ける。
  守れない場合は「3営業日以内」または期限を書かない文面に変える。
  確認が取れるまでは実装を止めず、変更しやすいよう文面を D1 の1行（`autoreply_body`）に
  閉じ込めておく。サンクスページ側は Astro の文字列1箇所
- 通知先を菊池様のアドレスに切り替えるか（切り替えるなら D1 の1行 UPDATE のみ）
- 広告のエリアを神戸市全体に広げるか（会議では「広げてよい」と話している。広告側の設定）
