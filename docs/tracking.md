# 計測の正（MADOA LP）

Pixel / GA4 / Google広告 / Clarity の状態と、過去に踏んだ地雷をここに集約する。
広告の出稿内容は `docs/ads/` 側、ここは計測だけを扱う。

最終更新: 2026-08-01

## 導入済みタグ

| 種別 | ID | 導入経路 |
|---|---|---|
| Meta Pixel | `971517092154665` | Layout.astro に直接（ボットUA除外つき） |
| GA4 | `G-1RZELJ5W9F` | `https://dashboard.37d.jp/api/tag/madoa-lp` 経由 |
| Google広告 | `AW-10849937805` | 同上（拡張コンバージョン） |
| Clarity | `vxk1n9wg46` | 同上 |

全5ページ（`/` `/subsidy/` `/uchimado/` `/business/` `/line/`）で同一構成。

### GA4プロパティの構成（要整理）

LP（`lp.madoa.co.jp`）のデータは **プロパティ 383782048「https://madoa.co.jp - GA4」** に入っている。
LP専用のプロパティは無く、本体サイトと同居している。

さらに **プロパティ 267083302「MADOA」も `madoa.co.jp` を受けており、本体サイトが2プロパティで二重計測**されている。
LPの数字を見るときは 383782048 を hostName で絞る必要がある。整理の余地あり。

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

### 検証結果（2026-07-26 確認）

- [x] **4件すべて発火を確認**。`first_fired_time` = `last_fired_time` = 2026-07-25T14:25:05+0000（JST 23:25）
      前夜の実機テストをそのまま捕捉している
- [x] **パス条件版（_補助金LP）も発火**。LP別の切り分けが機能することが確定したので、法人LP版を同形式で追加してよい
- [x] **過去分は遡って集計されない**。`first_fired_time` が作成後の 7/25 23:25 であり、
      7/6〜7/18 に Pixel が受けていた LineClick 6 / PhoneClick 7 は custom conversion としては拾えない。
      Pixel の生イベントとしては残っているので、必要なら Events Manager 側で確認する
- 広告レポートの `offsite_conversion.custom.*` 列はまだ0件。これは検証クリックが広告経由でなく
  アトリビューションが成立しないため。実際の広告クリック→タップが発生すれば出る（異常ではない）

- [ ] 法人LP出稿前に、法人LP版のカスタムコンバージョン2件を追加する

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

**修正の効果を GA4 実データで確認（2026-07-26）**: プロパティ 383782048 に
`lp.madoa.co.jp` からの `click_line` 1件 / `click_phone` 1件が記録された。前夜の実機テスト分。
3月からゼロだったクリックイベントが、修正後に実際にGA4へ届くようになったことが裏付けられた。

教訓: `if (window.foo)` 形式のガードは、対象が存在しないと**エラーも警告も出さずに永久にスキップ**される。
計測コードでこの書き方をするなら、実機でネットワークタブまで見て送出を確認するまで完了としない。

### 計測値に関係者アクセスとボットが混入していた（〜2026-08-01）

GA4に**内部トラフィック除外を設定していなかった**ため、制作側・クライアント側の確認アクセスが
そのまま「質の高いユーザー」として計上されていた。

見分けがついた根拠:

- 新規 vs リピート: **リピート14セッション・平均697秒** / 新規7セッション・277秒
- 地域×デバイス: **港区 desktop 2セッション・1178秒**、渋谷 desktop 2、Kobe desktop 5・756秒、Lille(仏) 1
- 時間帯: **10時台に8セッション集中**（他の時間帯は1〜4）＝打ち合わせ中の画面共有

神戸の窓ガラス屋のLPを港区から20分見る一般ユーザーはいない。

広告側にもボットが混ざっていた。市区別に並べると滞在0秒のセッションが各地に散っている。

| 市区 | 経路 | セッション | 平均滞在 |
|---|---|---|---|
| Kobe | cpc | 206 | 9秒 |
| Osaka | cpc | 26 | 2.6秒 |
| **Prineville** | cpc | 9 | **0秒** |
| **Forest City** | cpc | 4 | 7.6秒 |
| **Lulea** | cpc | 3 | 34.9秒 |
| Nagoya / Akashi / Amagasaki / Takarazuka | cpc | 各3〜6 | **全て0秒** |

Prineville(オレゴン)・Forest City(ノースカロライナ)・Lulea(スウェーデン) はいずれも
**Meta のデータセンター所在地**。プリフェッチかクローラー。

教訓: **平均滞在が異様に長いセグメントは、まず自分たちを疑う。**
数字が良く見えたら喜ぶ前に newVsReturning と city と hour で割る。
LPを公開したら計測より先に内部トラフィック除外を入れる。

対応: GA4の内部トラフィック除外を設定する（管理 → データストリーム → タグ設定を構成 → 内部トラフィックの定義）。
Pixel側はIP除外ができないので別手段が要る。

## 未解決

### （解決済み）google.com へのPOSTが503

古田さんのChromeで `analytics.google.com/g/collect` 等が503を返していた件。
**古田さんのブラウザ固有の問題だった。** GA4 の実データを確認したところ、
2026-07-24〜26 で `lp.madoa.co.jp` から page_view 38件が正常に記録されている。
実ユーザーからの計測には影響していない。ローカルの拡張機能かネットワーク側の要因。

### CTAタップ停止の調査結果（2026-08-01 決着）

7/19以降タップ0件の件を GA4 Data API で流入元別に分解した。**速度説は主因ではなかった。**

診断は2回変わっている。記録として全部残す。

1. 第1仮説「Metaの配信が若年層に流れた」— 年齢別CTRの劣化（35-44が3.79%→1.10%）は事実だが**主因ではない**
2. 第2仮説「オーガニックがCV源で、それが枯れた」— オーガニックの正体が関係者だったので**成立しない**
3. **結論: 広告経由のモバイルが最初からLPを読んでいない。加えて計測値に関係者アクセスとボットが混入していた**

#### 流入経路別（7月・hostName=lp.madoa.co.jp）

| 流入元 | セッション | 平均滞在 | 直帰率 |
|---|---|---|---|
| Meta広告(cpc) | 337 | 14秒 | 90% |
| 自然検索(organic) | 13 | 693秒 | 20% |
| 直接(none) | 9 | 300秒 | 30% |

#### デバイス別（広告経由）

| デバイス | セッション | 平均滞在 | 直帰率 |
|---|---|---|---|
| モバイル | 300 | 4.2秒 | 90% |
| デスクトップ | 14 | 124秒 | 60% |

同じ広告・同じLPでデスクトップは2分読んでいる。**モバイル固有の問題**。広告流入の95%がモバイルなので、これが全体を決めている。

#### 画像圧縮の効果（広告経由モバイル）

| 期間 | セッション | 平均滞在 |
|---|---|---|
| 7/6〜7/18（圧縮前） | 155 | 1.9秒 |
| 7/19〜7/25（圧縮前） | 84 | 3.9秒 |
| 7/26〜7/31（圧縮後） | 61 | **10.6秒** |

7/25の再圧縮は5倍の改善を出している。方向は正しい。ただし直帰率90%は不変で、10秒は「読まれている」水準ではない。
次に疑うのはファーストビューの中身。補助金LPのFV写真差し替えは、この調査で優先度が上がった。

#### 遡って確認できないこと

7/6〜7/18 の Pixel タップ13件（LINE6・電話7）が誰のものだったかは**もう分解できない**。
GA4のクリック計測が7/25まで壊れていたため。発生日（7/6・7/7・7/9・7/13・7/15・7/18）が
計測を触っていた時期と重なるので、関係者のテストだった可能性が相当ある。
**広告開始以来、実ユーザーのタップを1件も確認できていない可能性を否定できない。**

7/13議事録の「広告開始後初の実電話1件」は菊池様が受電した実件数であり、LPのtel:タップ経由かは別問題。

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

## 未対応（2026-08-01 時点）

- **GA4の内部トラフィック除外が未設定**。上記「計測値に関係者アクセスとボットが混入していた」の対応
- **`~/bin/meta-madoa` が動かない**。1Password「MADOA Meta Ads」に `access_token` フィールドが無く、
  `credential` も空。`.env.meta-ads` の参照先とアイテムの中身がズレている。
  当面は環境変数 `META_ACCESS_TOKEN` + Graph API 直叩きで代替する
- **GA4 MCP（analytics-mcp）は再認証してもセッション内では復活しない**。MCPプロセスが起動時のADCを
  キャッシュするため。Claude Code の再起動が要る

## 確認コマンド

```bash
# 広告レポートにカスタムコンバージョンが出ているか（meta-madoa 復旧後）
~/bin/meta-madoa ads insight list --level ad --date-preset last_30d
# 見るべきは offsite_conversion.custom.2583718828733982 / ...3489207164576726

# meta-madoa が壊れている間の代替（環境変数 META_ACCESS_TOKEN を使う）
curl -s -G "https://graph.facebook.com/v21.0/act_2517872855340528/insights" \
  --data-urlencode 'time_range={"since":"2026-07-19","until":"2026-07-31"}' \
  --data-urlencode "breakdowns=age" \
  --data-urlencode "fields=spend,impressions,clicks,ctr,actions" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# Pixel の生イベントを日別に見る（aggregation=url はパスを丸めるので使えない）
curl -s -G "https://graph.facebook.com/v21.0/971517092154665/stats" \
  -d "aggregation=event" -d "start_time=2026-07-01" -d "limit=2000" \
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# GA4 Data API 直叩き（MCPが使えないとき）
# 事前に: gcloud auth application-default login \
#   --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform
curl -s -X POST "https://analyticsdata.googleapis.com/v1beta/properties/383782048:runReport" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: design-web-site-488222" \
  -d '{"dateRanges":[{"startDate":"2026-07-01","endDate":"2026-07-31"}],
       "dimensions":[{"name":"sessionSource"},{"name":"sessionMedium"}],
       "metrics":[{"name":"sessions"},{"name":"engagedSessions"},{"name":"averageSessionDuration"}],
       "dimensionFilter":{"filter":{"fieldName":"hostName","stringFilter":{"value":"lp.madoa.co.jp"}}}}'
```
