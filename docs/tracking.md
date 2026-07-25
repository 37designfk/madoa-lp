# 計測の正（MADOA LP）

Pixel / GA4 / Google広告 / Clarity の状態と、過去に踏んだ地雷をここに集約する。
広告の出稿内容は `docs/ads/` 側、ここは計測だけを扱う。

最終更新: 2026-07-26

## 導入済みタグ

| 種別 | ID | 導入経路 |
|---|---|---|
| Meta Pixel | `971517092154665` | Layout.astro に直接（ボットUA除外つき） |
| GA4 | `G-1RZELJ5W9F` | `https://dashboard.37d.jp/api/tag/madoa-lp` 経由 |
| Google広告 | `AW-10849937805` | 同上（拡張コンバージョン） |
| Clarity | `vxk1n9wg46` | 同上 |

全5ページ（`/` `/subsidy/` `/uchimado/` `/business/` `/line/`）で同一構成。

## 計測しているイベント

LPにフォームが無いため、コンバージョンは電話タップとLINEタップ。

| イベント | 発火条件 | 送信先 |
|---|---|---|
| `PageView` | ページ表示 | Meta Pixel |
| `LineClick` / `click_line` | `lin.ee` または `line.me` へのリンククリック | Pixel / GA4 / Google広告 |
| `PhoneClick` / `click_phone` | `tel:` リンクのクリック | Pixel / GA4 / Google広告 |
| `Lead` / `generate_lead` | フォーム送信 | 現状フォーム無しのため未発火 |

いずれも `location` パラメータでCTA位置（header / hero / mid-cta-1 / footer 等）を付けている。
判定は `src/layouts/Layout.astro` の document への click 委譲。`data-track-location` 属性が優先される。

## カスタムコンバージョン（2026-07-25 作成・配信アカウント側）

`custom_event_type` は将来のコンバージョン最適化を見据えて `OTHER` ではなく `LEAD`。

| ID | 名前 | ルール |
|---|---|---|
| 2583718828733982 | LINEクリック（全LP） | event=LineClick かつ URL contains `lp.madoa.co.jp` |
| 3489207164576726 | 電話クリック（全LP） | event=PhoneClick かつ URL contains `lp.madoa.co.jp` |
| 1055664533567822 | LINEクリック_補助金LP | event=LineClick かつ URL contains `lp.madoa.co.jp/subsidy` |
| 2051705178771182 | 電話クリック_補助金LP | event=PhoneClick かつ URL contains `lp.madoa.co.jp/subsidy` |

全LP版とLP別版を両方作ってあるのは、当初 Pixel の `aggregation=url` が全イベントを
`https://lp.madoa.co.jp/` に丸めて返しており、パス単位で記録されるか不明だったため。
その後の実機検証で `dl` パラメータにパス込みの完全URLが入っていることを確認したので、
**LP別のルールは機能する**。法人LP版も同じ形式で追加してよい。

- [ ] 作成から24〜72時間後にレポート列へ反映されたか確認（過去分が遡って集計されるかは未検証）
- [ ] 法人LP出稿前に、実機で電話・LINEを1回ずつ踏んでレポート列に数字が出るまで確認

## 過去に踏んだ地雷

### カスタムコンバージョンを別の広告アカウントに作っていた（2026-07-06 〜 07-25）

7/6に「カスタムコンバージョン2つ作成完了」とチェックを入れていたが、作成先が
配信中の広告アカウントではなかった。ルール自体は正常でアーカイブもされていないのに、
配信アカウントの `/customconversions` は空で、広告レポートに一切出てこなかった。
カスタムコンバージョンは広告アカウント間で移動も共有もできないため、作り直しが必要だった。

**計測経路そのものは生きていた証拠**: `landing_page_view` が201件レポートされていた。
これは Meta が広告クリックと Pixel の PageView 発火を突き合わせて初めて数えられる指標なので、
同じ経路に乗るCVが0なのは定義が無いからにすぎなかった。

教訓: 計測は「作った」では完了しない。**広告管理画面のレポート列に実際に数字が出るまで**確認する。
あわせてカスタムコンバージョンは**作成先の広告アカウントを必ず確認**する。

### GA4のクリックイベントが3月から0件だった（〜2026-07-25）

タグローダー（dashboard.37d.jp）は `gtag.js` の読み込みと GA4 / Google広告の config は
行うが、**`window.gtag` 関数自体をページスコープに定義しない**。
一方 Layout.astro は `if (window.gtag) gtag('event','click_line', ...)` と書いていたため、
この行が一度も実行されていなかった。エラーも警告も出ない silent failure。

修正は Layout.astro の計測スクリプト冒頭に gtag スタブを置くだけ。

```js
window.dataLayer = window.dataLayer || [];
if (typeof window.gtag !== 'function') {
  window.gtag = function(){ window.dataLayer.push(arguments); };
}
```

修正後の実機検証で、`en=click_line` / `en=click_phone` が送出され
`googleads.g.doubleclick.net/pagead/viewthroughconversion/10849937805/` が HTTP 200 を返すことを確認。
**Google広告側でも電話・LINEタップがコンバージョンとして使えるようになった**（拡張コンバージョンの設定に進める）。

教訓: `if (window.foo)` 形式のガードは、対象が存在しないと**エラーも警告も出さずに永久にスキップ**される。
計測コードでこの書き方をするなら、実機でネットワークタブまで見て送出を確認するまで完了としない。

## 未解決

### google.com へのPOSTが503（要切り分け）

古田さんのChromeでは以下が一貫して503を返す。

- `analytics.google.com/g/collect`（GA4本体・page_view含む）
- `www.google.com/ccm/collect`、`www.google.com/rmkt/collect`

`googleads.g.doubleclick.net` へのGETは200、Clarityと 37d.jp は204で正常。
GETは通ってPOSTだけ落ちる偏りから、ローカルの拡張機能かネットワークポリシーの可能性が高い。

- [ ] シークレットウィンドウか別プロファイルで再確認。実ユーザー環境でも503ならGA4はページビューすら取れていない

### 7/19以降のCTAタップ停止（要観察）

7/6〜7/18は124 LPVで13タップ（約10%）出ていたが、**7/19〜7/25の7日間は77 LPVでタップ0件**。

- 計測コードは6/28以降変更なし。PageViewは記録され続けているのでPixelは生きている
- 7/6の実写差し替えでモバイル表示が重くなった影響が遅れて出た可能性（7/25に再圧縮で解消済み）
- 単に問い合わせが止まっている可能性
- 8/1の打ち合わせでは「7/19以降タップ0件・7/25に速度を戻した」をセットで報告し、翌週の数字で切り分ける

## 再発防止

`npm test`（`scripts/smoke-test.mjs`）が dist/ に対して以下を検査する。
`.github/workflows/deploy.yml` から `npm run test:prod` として呼ばれ、落ちるとデプロイまで進まない。

1. `gtag()` を呼んでいるのに定義がないページを検出
2. ページごとの画像総量が予算超過（圧縮パイプラインの通し忘れ）
3. 拡張子と実体フォーマットの不一致
4. LPから未参照の画像が配信対象に含まれていないか

3種とも「壊したらFAILする」ことを負のテストで確認済み。
ただし CHECK1 は静的テキストマッチなので、「スタブは書いてあるが条件分岐で出力されない」型のバグは
すり抜ける。実ブラウザでの検証を足すのが次の一手。

## 確認コマンド

```bash
# 広告レポートにカスタムコンバージョンが出ているか
~/bin/meta-madoa ads insight list --level ad --date-preset last_30d
# 見るべきは offsite_conversion.custom.2583718828733982 / ...3489207164576726
```
