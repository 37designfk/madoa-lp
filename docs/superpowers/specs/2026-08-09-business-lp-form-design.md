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
| ご担当者名 | `name` | 必須 | |
| 電話番号 | `tel` | 必須 | 会議で明示された項目 |
| メールアドレス | `email` | **必須** | Reply-To に入る |
| 物件の所在地 | `address` | 任意 | 神戸市内かの判別に使う |
| ご相談内容 | `message` | 任意 | |
| （ハニーポット） | `website` | — | 非表示。値が入っていたら弾く |

必須は4つ。法人相手なので、電話がつながらないときの連絡手段としてメールを押さえておく。
見積もりを送る宛先にもなる。所在地を任意で置くのは、神戸市外からの問い合わせを事前に見分けるため。

メールは `type="email"` にしてブラウザ側で形式を検証する。

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

### D1 への登録

```sql
INSERT INTO sites (site_id, domain, to_email, subject_prefix, allowed_origins)
VALUES ('madoa-lp', 'lp.madoa.co.jp', 'ken.furuta@37design.co.jp', '[まどあ]',
        'https://lp.madoa.co.jp');
```

実際のカラム構成は投入前に `PRAGMA table_info(sites);` で確認する。

**既知の障害**: 現在 wrangler から D1 に権限エラー（code 7403、account `749d8afe...`）が出ている。
アカウントの不一致が原因と思われる。`CLOUDFLARE_ACCOUNT_ID` の指定か再認証で解決を試みる。
解決できない場合は古田さんに Cloudflare ダッシュボードでの手動 INSERT を依頼する。

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

- 通知先を菊池様のアドレスに切り替えるか（切り替えるなら D1 の1行 UPDATE のみ）
- 広告のエリアを神戸市全体に広げるか（会議では「広げてよい」と話している。広告側の設定）
