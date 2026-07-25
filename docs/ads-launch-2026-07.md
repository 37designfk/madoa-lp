# Meta広告 テスト配信ブリーフ（2026-07 / まどあ）

作成: 2026-07-06 / 方針: 7/6打ち合わせで決定（1日500円テスト、トラフィック配信、羽田野さん既存バナー使用）
実行者: 古田（Ads Managerで作成・課金開始。権限は取得済み。キャッシュ切れ時のみ菊池さん側で画面操作）

## 配信の狙い
- 目的: トラフィック（最適化イベント=ランディングページビュー）
- まず補助金LPに集中して学習を回し、反応を見て割れ替えを追加する
- 予算: 1日500円（月1.5万円程度）。初週は補助金LP 1本に500円集中を推奨（250円×2本だと学習が分散して遅い）

## 出稿前の必須設定（計測）
LPはフォームが無く、CV=電話タップ/LINEタップ。Pixelには `PhoneClick` / `LineClick` のカスタムイベントで送信済み。
- [x] Meta Events Manager で カスタムコンバージョンを2つ作成（2026-07-06 完了・MADOA Pixel 971517092154665 / business_id 5325707114158096）
  - 「LINEクリック」= イベント `LineClick` / ルール URL含む lp.madoa.co.jp / ID 1572671920943531
  - 「電話クリック」= イベント `PhoneClick` / ルール URL含む lp.madoa.co.jp / ID 1041119118382553
  - 作成直後は「非アクティブ・イベント未受信」。実トラフィックで電話/LINEクリックが発生すると自動でアクティブ化・カウント開始
- [ ] 出稿直前に実機で Meta「テストイベント」/ GA4リアルタイム を1回確認（PageView・LineClick発火）
- 計測基盤の現状: Pixel `971517092154665` / GA4 `G-1RZELJ5W9F` / Google広告 `AW-10849937805`(拡張CV) / Clarity すべてLP全ページに導入済み。Meta CAPIは未実装（フォーム無しモデルのため今回は不要）

## クリエイティブ（羽田野さん 2026-05-30 版・1080×1080）
`ad-assets/2026-05-30/`
- banner-01-subsidy.png（LINEで30秒見積もり・補助金対象）→ 補助金LP
- banner-03-condensation.png（写真1枚で最短見積もり・結露対策）→ 補助金LP
- banner-02-emergency.png → 割れ替えLP（第2弾）
- banner-04-line.png（LINE汎用）→ 補助金/割れ替え共通の予備

## 広告文（Meta フィード）

### 補助金LP用
- 本文A: その窓の寒さ・結露、「先進的窓リノベ2026」の補助金で解決できます。神戸のMADOAなら内窓・カバー工法が最大100万円/戸の補助対象。面倒な申請もまるごと代行。まずはLINEで30秒ご相談を。
- 本文B: 冬の結露と寒さ、毎年あきらめていませんか？内窓で結露ゼロ・暖房費ダウン。国の補助金で今がお得。神戸市全域・見積無料・申請代行。写真1枚でLINE相談OK。
- 見出し: 窓リフォームに最大100万円の補助金
- 説明: 神戸市全域／見積無料／申請まるごと代行
- CTAボタン: 詳しくはこちら

### 割れ替えLP用（第2弾）
- 本文: 窓ガラスが割れた・ヒビが入った…神戸のMADOAへ。調査無料・適正価格・50年以上の実績で安心。まずはお電話かLINEで。
- 見出し: 窓ガラスの割れ替えなら神戸のMADOA
- 説明: 調査無料／適正価格／50年以上の実績
- CTAボタン: 詳しくはこちら

## ターゲティング（テスト初期は広めでMetaに学習させる）
- 地域: 神戸市を中心に半径その周辺（明石・芦屋・尼崎等の近郊まで）。住宅リフォームは商圏内で
- 年齢: 補助金=35〜65歳（持ち家リフォーム層）／割れ替え=25〜60歳
- 性別: 指定なし
- 詳細ターゲット: 初期は絞りすぎずAdvantage+オーディエンス（自動）に寄せる。反応を見て「住宅リフォーム/省エネ/持ち家」等で調整
- 配置: Advantage+プレースメント（自動）

## ランディングURL（UTM付き・LINEへ自動引き継ぎ実装済み）
- 補助金 banner-01: https://lp.madoa.co.jp/subsidy/?utm_source=meta&utm_medium=cpc&utm_campaign=subsidy_test&utm_content=banner01
- 補助金 banner-03: https://lp.madoa.co.jp/subsidy/?utm_source=meta&utm_medium=cpc&utm_campaign=subsidy_test&utm_content=banner03
- 割れ替え banner-02: https://lp.madoa.co.jp/?utm_source=meta&utm_medium=cpc&utm_campaign=warekae_test&utm_content=banner02

## キャンペーン構成（推奨）
- キャンペーン: 「まどあ_補助金_トラフィックテスト」
  - 目的: トラフィック / 最適化: ランディングページビュー
  - 予算: 500円/日（キャンペーン予算 CBO）
  - 広告セット1: ターゲティング上記、配置Advantage+
  - 広告2本（banner-01 / banner-03）を1広告セットに入れてMetaに配分させる
- 1週間回して、LP View単価・LINE/電話クリック数を確認 → 良ければ予算増 or コンバージョン最適化へ切替、割れ替えを第2弾で追加

## キャンペーン（2026-07-06 Marketing API で作成・全てPAUSED＝課金なし）
UIの画像アップロードが自動化不可だったため、Marketing API で構築（画像も adimages 登録で解決）。act=2517872855340528 / business_id=5325707114158096。
- キャンペーン: まどあ_補助金_トラフィックテスト（ID 52541829304282・OUTCOME_TRAFFIC・PAUSED）
- 広告セット: まどあ_補助金_神戸_LPV（ID 52541829341882・PAUSED）
  - 最適化 LANDING_PAGE_VIEWS / 課金 IMPRESSIONS / 入札 LOWEST_COST_WITHOUT_CAP / destination WEBSITE
  - 予算 ¥500/日 / age_min 18 / Advantage+オーディエンス ON
  - 地域: 神戸市北区を近似（Metaに区データ無し）→ custom_locations 2点: 鈴蘭台34.7466,135.1461/岡場・藤原台34.7965,135.1985 各6km。到達見込みMAU 約78-92万（2026-07-07更新）
- 広告1: まどあ_補助金_窓を変えれば（ID 52541829368482・PAUSED）creative 1356734643228763 / image_hash 3d6d3206ce225c459024df26692d3b6f
  - 2026-07-07 古田が作り直した新バナー（窓を変えれば、家が変わる／断熱3訴求／LINE CTA）に差し替え。元: ad-assets/2026-07-07/banner-window-home.png
  - 旧banner01（creative 905522072608063 / hash ded83d42…）は差し替えで不使用
- 広告2: まどあ_補助金_banner03（ID 52541829832082・PAUSED）creative 2244532082983795 / image_hash 5ee9b946bd24eba7dda6ea6038d4c1b3 ← 旧バナー。要判断（残す/削除）
- ページ Madoa(169743000128858)。IGはページ既定（madoa.pres明示リンクは任意で後付け可）
- 旧UIドラフト（下書きワークスペースの別キャンペーン）は不要 → Ads Managerの下書きから破棄でOK

## 公開までの残作業（古田）
1. 広告アカウントの認証済み電話番号を追加（通知 #3858013）＋アカウント情報の確認（アカウント概要）
2. 内容を最終確認し、キャンペーン/広告セット/広告を ON（PAUSED→ACTIVE）にして配信開始 ＝ ここで課金開始（Claudeは実行しない）
3. 配信直後: 実機でMetaテストイベント/GA4リアルタイムでPageView・LINEクリック発火を確認
4. 初週レビュー: LP View / クリック / LINEクリックCVの動きを見て調整（次回7/13で報告）
