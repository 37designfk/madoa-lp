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

## ステージング（madoa-lp.pages.dev）が本番と同じPixelを撃っていた（2026-08-08 発見）

GA4のタグ診断「構成用に追加のドメインが検出されました」から辿って判明した。

### 何が起きていたか

`https://madoa-lp.pages.dev/` が生存しており（HTTP 200）、本番と**同じ Meta Pixel ID `971517092154665`**
と**同じタグローダー `dashboard.37d.jp/api/tag/madoa-lp`** を読み込んでいた。

原因は `isProduction` の判定がビルド時の環境変数だけだったこと。

```js
// astro.config.mjs
const isProduction = process.env.DEPLOY_TARGET === 'production';
```

`DEPLOY_TARGET=production` でビルドした dist をそのまま Cloudflare Pages に上げていたため、
Layout.astro の `{isProduction && ...}` ガードが**ステージングでも true になって素通りしていた**。

GA4 は `hostName` でレポートを分離できるが、**Meta Pixel はホスト名で分離できない**。
そのため pages.dev 上でLINE・電話ボタンを押すと、本番のカスタムコンバージョン
（LineClick / PhoneClick）としてカウントされる。

**「7/6〜7/18 の Pixel タップ13件が関係者のテストだった可能性」の有力な裏付けになる。**
pages.dev の最終デプロイは約1ヶ月前（7月上旬）で、タップ13件の発生時期と重なる。

### 対応

1. **実行時のホスト名判定を追加**（`src/layouts/Layout.astro`・2026-08-08）
   ```js
   var _isProdHost = location.hostname === 'lp.madoa.co.jp';
   if (_isProdHost && !_botUA.test(navigator.userAgent)) { /* fbq init */ }
   ```
   ビルド時のフラグが破れても実行時に止まる二重防御。`npm run test:prod` 通過済み
2. **Cloudflare Pages プロジェクト `madoa-lp` の削除** — 2026-08-08 完了（古田が実行）
   ```bash
   npx wrangler pages project delete madoa-lp -y
   ```
   `madoa-lp.pages.dev` は DNS 解決不可（配信停止）、プロジェクト一覧からも消滅を確認済み。
   自動デプロイ経路は `5d48419` で削除済みだったため、手動デプロイの残骸だった。
   **これで汚染源そのものが消えた。** 以後 pages.dev 由来のPixelイベントは発生しない

### 残作業

- [ ] **上記1のコード修正を本番へデプロイする**（`DEPLOY_TARGET=production npm run build` → rsync）。
  未デプロイ。汚染源は消えているため緊急ではないが、入れておかないと
  「本番ビルドをどこかに置く」を再びやったときに同じ穴が開く

### 未対応の穴

`<noscript>` の Pixel img は静的タグのため実行時判定ができず、JS無効環境では
ステージングでも発火する。影響は小さいと判断して据え置いた。

## 補助金LP B案（/subsidy-b/）の計測イベント（2026-08-08 追加）

B案セッションからの引き継ぎ。実装は `src/components/subsidy-b/BDiagnosis.astro` 内。
Layout のクリック委譲は `a` タグしか見ないため、B案の診断ウィジェットは独自にイベントを送出している。
本番で3系統（GA4 / Meta Pixel の trackCustom / Google広告）すべて発火を確認済み。

| イベント | パラメータ | 意味 |
|---|---|---|
| `diagnosis_start` | `from`: hero / card | 診断を開始 |
| `diagnosis_q1` 〜 `q3` | `answer` | 各設問への回答 |
| `diagnosis_complete` | house / count / size | 診断を完了 |
| `diagnosis_copy` | — | 診断結果をコピー（**最も濃い意図**） |

`diagnosis_complete` は電話・LINEタップより発生数が多いはずなので、
**将来のコンバージョン最適化の候補**になる。現在の広告はタップが0件で最適化が回らないため、
中間指標として使える可能性がある。

### 注意: 既存カスタムコンバージョンがA案とB案を合算する

既存の `LINEクリック_補助金LP` / `電話クリック_補助金LP` は
URL contains `lp.madoa.co.jp/subsidy` で定義されているため、**`/subsidy-b/` もマッチして合算される**。

- 前後比較（A案期間 vs B案期間）で判定するなら合算のままでよい
- **A/Bを同時に走らせて比較するなら、`lp.madoa.co.jp/subsidy-b` 条件のカスタムコンバージョンを別途作る必要がある**（未作成）

## Meta広告キャンペーンを一時停止（2026-08-08 14:20・古田指示）

`まどあ_補助金_トラフィックテスト`（campaign 52541829304282）を PAUSED にした。
広告セット・広告は ACTIVE のままなので、**キャンペーンを ACTIVE に戻すだけで復帰する**。

停止前の実績（設定変更後7日 8/1〜8/7）は上記「広告設定変更の効果」節を参照。
効率は改善したがコンバージョンは0件のままだった。

## 関係者の端末を計測から外す「印」方式（2026-08-08 導入）

IPベースの内部トラフィック除外は、**古田のグローバルIPが動的なので当てにできない**。
回線が変わると外れる。菊池様・羽田野さんのIPを聞き出す手間もかかる。
そこで端末側に印を残す方式を主役にした。IP除外は保険として残す。

### 使い方

```
https://lp.madoa.co.jp/?internal=1   ← 一度開くとこのブラウザは以後ずっと計測対象外
https://lp.madoa.co.jp/?internal=0   ← 解除
```

初回だけクエリ付きで開けばよく、以後は普通に開くだけで効き続ける。
**ブックマークを `?internal=1` 付きで登録しておくと、キャッシュを消しても踏み直しが自動になる。**

### 仕組み（`src/layouts/Layout.astro`）

`localStorage.madoa_internal` に印を残し、タグローダーより**前**で判定する。

- GA4: `window['ga-disable-G-1RZELJ5W9F'] = true`（gtag.js の標準スイッチ。読み込み前に立てる必要がある）
- Meta Pixel: 初期化条件に `!window._madoaInternal` を追加

### IP除外との比較

| | IP除外 | 印方式 |
|---|---|---|
| 相手にしてもらうこと | IPを教えてもらう | URLを1回開いてもらう |
| グローバルIPが変わったら | **外れる** | 効き続ける |
| 外出先・スマホ回線 | **効かない** | 効く |
| 端末ごとの手間 | 不要 | 端末・ブラウザごとに1回 |
| キャッシュクリア後 | 影響なし | **解除される（踏み直し）** |
| Meta Pixel | **効かない**（GA4のみ） | 止まる |

**Meta Pixel を止められるのが決定的な差。** GA4は `hostName` やIPで後から分離できるが、
Pixelは分離できないので、菊池様がスマホでLINEボタンを試すと今も広告のCVに乗る。

### 実機検証（2026-08-08・本番で確認済み）

| 操作 | 印 | GA4停止 | Pixel初期化 |
|---|---|---|---|
| `?internal=1` で訪問 | `1` | true | **false（読み込まれない）** |
| クエリ無しで再訪 | `1` | true | **false** |
| `?internal=0` で解除 | `null` | false | true（通常どおり計測） |

7/25に「gtagスタブが無くてクリックイベント0件」を見落とした反省から、実機で確認した。

### 制約

- シークレットウィンドウでは効かない（localStorage が毎回消える）
- localStorage が使えない環境では素通りして計測される
- 印を踏んだ端末は**本当に何も記録されない**。菊池様の動作確認アクセスもデータに残らない

## Xserver のキャッシュでデプロイが反映されないことがある（2026-08-08 実測）

rsync 後、**トップページだけ2週間前のHTMLが配信され続けていた**。

| 対象 | 配信サイズ | 状態 |
|---|---|---|
| `https://lp.madoa.co.jp/` | 100,409 | **7/25のキャッシュ** |
| `https://lp.madoa.co.jp/?v=1` | 102,264 | 最新 |
| `https://lp.madoa.co.jp/index.html` | 102,264 | 最新 |
| `/subsidy/` 等の下層 | — | 最新 |

サーバー上の実ファイルは更新済み（mtime も新しい）。`touch` しても変わらない。
CDNは経由しておらず（DNSはXserverのIP直、Cloudflareヘッダなし）、**Xserver側のnginxが
クエリ無しのトップURLだけキャッシュしていた**。`last-modified` がキャッシュ時点のまま返る。

### 見分け方

```bash
curl -sI https://lp.madoa.co.jp/ | grep -i last-modified   # 古ければキャッシュ
curl -s https://lp.madoa.co.jp/ | wc -c                    # ?v=1 付きとサイズを比べる
```

### 対処（2026-08-08 実施済み・手順の正）

犯人は Xアクセラレータではなく **「サーバーキャッシュ設定」** だった。

**サーバーパネル > 高速化 > サーバーキャッシュ設定 > 対象ドメインの「キャッシュ削除」**

`madoa.co.jp` がONで「Webサイト上のすべてのファイルをキャッシュ」していた。
このボタンは**設定を変えずにキャッシュだけ消せる**ので副作用がない。
押した直後に全ページの `last-modified` がビルド時刻に更新されることを確認済み。

紛らわしい点として、**`madoa.co.jp` だけ Xアクセラレータが Ver.2**（他ドメインは Ver.1）。
ただしXアクセラレータ側の画面は Ver.2 / Ver.1 / OFF の3択のみで、
キャッシュクリア機能はない。ここを触る必要はない。

その他:

- 影響はクエリ無しのトップURLのみだった。広告の着地は `/subsidy/` なので実害は限定的
- **デプロイ後の確認は必ずクエリ無しURLで行う。** `?v=1` を付けて確認すると
  キャッシュを回避してしまい「反映された」と誤認する

## GA4 内部トラフィック除外（2026-08-08 設定完了）

「計測値に関係者アクセスとボットが混入していた」への対応。2段階とも完了している。

1. **内部トラフィックルール**（管理 > データストリーム > タグ設定を行う > 内部トラフィックの定義）
   - ルール名 `37design 制作側` / `traffic_type = internal`
   - 条件: IPアドレスが範囲内（CIDR表記）`121.82.241.87/32`
2. **データフィルタ `Internal Traffic` を「テスト」→「有効」に変更**（管理 > データフィルタ）
   - 有効化は**遡及しない**。8/8 以降のデータにのみ適用される。7月以前の数字にはノイズが残ったまま
   - GA4の警告どおり、有効化は元に戻せない操作

プロパティ 383782048 / ストリーム 5407296901 / G-1RZELJ5W9F。

### 残っている穴

- **除外できているのは古田のIP 121.82.241.87 のみ。** 菊池様・羽田野さんのアクセスは除外されていない。
  両名のグローバルIPをヒアリングして条件を追加する（同じルールに「条件を追加」で足せる）
- **古田のIPは固定ではない可能性がある。** 回線が再接続でIPを変えると除外が外れる。
  数字がまた不自然に良くなったら `curl -s https://ifconfig.me/ip` で現在のIPを確認し、ズレていれば追加する
- ボット（Prineville / Forest City / Lulea 等のデータセンター）は上記ルールの対象外。
  GA4標準の「既知のボット除外」は自動適用されるが、これらは既知リストに載らないため別途の判断が要る

## 未対応（2026-08-01 時点）

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

---

## 法人LP（/business/）の計測（2026-08-09 構築）

法人向け広告（8/17 配信開始予定）のために、見積もり依頼フォームと計測を新設した。
設計は `docs/superpowers/specs/2026-08-09-business-lp-form-design.md`、
手順は `docs/superpowers/plans/2026-08-09-business-lp-form.md` が正。

### イベント

| イベント | 発火場所 | パラメータ |
|---|---|---|
| `generate_lead`（GA4） | `/business/thanks/` 到達時 | `location: business-form` |
| `Lead`（Meta） | `/business/thanks/` 到達時 | `content_name: Business Estimate Form` |

**発火はサンクスページの1箇所だけ。** フォームの `submit` では撃たない。
送信失敗やリダイレクト前の離脱を成果に数えないため。

`Layout.astro` にあった全ページ共通の `submit` リスナーは削除した（コミット 2818848）。
残すと送信時とサンクスページ到達時で2回発火して二重計上になる。
`capture: true` で全フォームを拾う作りだったので、将来 LP に検索ボックスを置いても
成果として記録されてしまう問題もあった。

<important>
### GA4 は gtag.js の設定完了を待ってから撃つこと（2026-08-09 に実バグとして発覚）

サンクスページを作った当初、**GA4 の `generate_lead` が本番で1件も送信されていなかった。**
Meta の `Lead` だけが飛んでいたので気づきにくかった。

原因: 計測タグ `https://dashboard.37d.jp/api/tag/madoa-lp` は `defer` で読み込まれ、
そこから `gtag/js?id=G-1RZELJ5W9F` が非同期で入る。ページ内の `is:inline` スクリプトは
パース中に実行されるため、**gtag.js の `config` より先に走る。GA4 は config 前に
積まれたイベントを捨てる。** Meta Pixel は `fbq` が自前のキューで拾い直すので影響を受けない。

対処: 設定完了の印である `window.google_tag_manager['G-1RZELJ5W9F']` が生えるまで
待ってから撃つ（`src/pages/business/thanks/index.astro`）。10秒待って駄目なら一度は撃つ。

**ページ読み込み直後に GA4 イベントを撃つページを今後作るときは、必ず同じ待機を入れること。**
クリック計測（`click_line` / `click_phone`）は利用者の操作が起点で読み込みより十分あとなので、
この問題は起きない。

検証方法: 本番ページを開き、ネットワークで
`analytics.google.com/g/collect?...&en=generate_lead` が 204 を返すことを確認する。
`dataLayer` に積まれているだけでは送信されたことにならない。
</important>

### Meta のカスタムコンバージョン（2026-08-09 作成）

| 名前 | ID | 条件 |
|---|---|---|
| `見積もり依頼_法人LP` | 1870453323929091 | イベント `Lead` かつ URL contains `lp.madoa.co.jp/business/thanks` |
| `LINEクリック_法人LP` | 2534601300387543 | イベント `LineClick` かつ URL contains `lp.madoa.co.jp/business` |
| `電話クリック_法人LP` | 1039661632016385 | イベント `PhoneClick` かつ URL contains `lp.madoa.co.jp/business` |

**広告の最適化目標には `見積もり依頼_法人LP` を使う。**

既存の `LINEクリック_補助金LP` / `電話クリック_補助金LP` は URL contains `lp.madoa.co.jp/subsidy`
なので `/business/` にはマッチしない。別に作る必要があった。
`LINEクリック（全LP）` / `電話クリック（全LP）` は `lp.madoa.co.jp` 全体が対象で、
個人向けと法人向けを分離できない。8/22 に「個人と法人どちらが良かったか」を比較するので、
LP 別のものが要る。

作成は Graph API で行った。**`event_source_id`（Pixel ID）が必須**で、これが無いと
`(#100) The parameter event_source_id is required` で失敗する。

```bash
curl -s -X POST "https://graph.facebook.com/v21.0/act_2517872855340528/customconversions" \
  -d "access_token=$META_ACCESS_TOKEN" \
  -d "event_source_id=971517092154665" \
  --data-urlencode "name=見積もり依頼_法人LP" \
  --data-urlencode 'rule={"and":[{"event":{"eq":"Lead"}},{"or":[{"URL":{"i_contains":"lp.madoa.co.jp/business/thanks"}}]}]}' \
  -d "custom_event_type=LEAD"
```

### フォームの送信先

`https://forms.37d.jp/submit`（Cloudflare Worker + D1 + Amazon SES。リポジトリは `~/forms-endpoint`）。
`site_id` は `madoa-lp`。D1 のデータベース名は `forms_endpoint`。

**フィールド名の `name` と `phone` は変えないこと。** Worker はこの2つだけを
`submissions` の専用カラムへ振り分ける。`tel` のような別名で送ると `phone` 列が空になる。

通知先は D1 の `sites.to_email`。菊池様のアドレスに切り替えるときは次の1行だけでよい
（LP のビルドもデプロイも不要）。

```bash
cd ~/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"UPDATE sites SET to_email='<新しいアドレス>' WHERE site_id='madoa-lp';"
```

### 自動返信メール

訪問者宛の自動返信は `sites.autoreply_subject` / `sites.autoreply_body` に文面を持たせ、
**両方そろっているサイトだけ**送る。既存クライアント（吉市・Omoie・37design）は NULL なので送らない。
本文の `{{name}}` が送信者の氏名に置き換わる。

**「2営業日以内にご連絡いたします」は菊池様の確認待ちの文言。** 変更が要る場合は
`migrations/2026-08-09-autoreply.sql` の UPDATE を打ち直すだけでよい。
Worker の再デプロイも LP のビルドも要らない。

自動返信の送信に失敗しても `/submit` 全体は成功として返す。通知メールが担当者に届いていれば
商談は成立するので、訪問者に送信失敗を見せて二重送信させる方が損失が大きい。
失敗は `submissions.status = 'autoreply-failed'` に残る。

```bash
# 自動返信が失敗していないかの確認
cd ~/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"SELECT created_at, site_id, name, status, error FROM submissions WHERE status='autoreply-failed' ORDER BY id DESC LIMIT 20;"
```

<important>
### フォーム基盤のスパム対策（2026-08-09 時点の状態と残課題）

自動返信を足したことで、`/submit` は「送信者が指定したアドレスへ `noreply@37d.jp` から
メールを送る」経路を持った。踏み台にされると、被害は madoa 1社では終わらない。
`noreply@37d.jp` は吉市水産・Omoie・37design と共有する SES 送信元で、
バウンス率・苦情率が閾値を超えると **4社すべてのフォーム通知が止まる**。

**対処済み:** 自動返信は Origin 検証を通った正規のブラウザ送信のときだけ送る
（`forms-endpoint/src/index.ts` の `originVerified`）。Origin ヘッダを付けない直POSTでは
自動返信を送らない。通知メール（宛先は D1 の固定値）は従来どおり無条件に送る。

注意: `allowed_origins` が空のサイトは `originVerified` が常に false になるため、
**自動返信を設定しても永久に送られない。** エラーも出ないので気づきにくい。
自動返信を使うクライアントには必ず `allowed_origins` を設定すること。

**残課題（未実施）:** Cloudflare のレート制限ルールを `forms.37d.jp/submit` に1本入れる。
目安は同一IPから 5 リクエスト/分。まっとうな利用者が1分に5回送ることはない。
ダッシュボード操作のみでデプロイ不要、既存クライアントへの影響もない。
`wrangler` の OAuth トークンは `zone (read)` しか持たないので CLI からは作れない。

madoa-lp には Turnstile を入れていない（スパム対策はハニーポット1枚）。
問題が出るようなら `forms-endpoint/examples/astro-form.astro` に仕組みがあるので移植する。
</important>

### 法人LP 構築後の残タスク（2026-08-09 時点）

| 内容 | 誰が | いつまで | 状態 |
|---|---|---|---|
| `sites.to_email` に菊池様を追加する | 古田 | 8/17（広告配信開始）まで | **完了（2026-08-09）** |
| 通知が届くことを菊池様と一緒に確認する | 古田 | 同上 | 未 |
| 自動返信の「2営業日以内」を菊池様に確認する | 古田 | 同上 | 未 |
| Cloudflare のレート制限を入れる | 古田 | 同上 | 未 |

通知先は `glasssanki@gmail.com,ken.furuta@37design.co.jp` の2宛先にした。
移行期は古田さんの手元にも残す。切り替えるときは1行の UPDATE でよい。

```bash
cd ~/forms-endpoint && npx wrangler d1 execute forms_endpoint --remote --command \
"UPDATE sites SET to_email='glasssanki@gmail.com' WHERE site_id='madoa-lp';"
```

**設定した時点ではテスト送信をしていない。** 送ると菊池様に前触れなくテストメールが届くため。
実際の疎通確認は、菊池様に一声かけてから一緒に行うこと。

あわせて伝えておくべきこと:
- 自動返信の Reply-To は `to_email` の先頭（= 菊池様）になる。**依頼者が自動返信に返信すると
  菊池様に直接届く**
- 自動返信で「担当者より2営業日以内にご連絡いたします」と約束している。返答するのは菊池様側なので、
  この期限で問題ないかの確認が要る。変更は SQL 1行（`migrations/2026-08-09b-autoreply-wording.sql`
  を複製して本文を差し替える）
