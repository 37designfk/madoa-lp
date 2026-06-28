# MADOA LP — UTM・導線別リンク集

流入元ごとのUTM付きLPリンクを一覧化。LP上でLINEボタンをクリックするとUTMが自動でLINEリンクに引き継がれる（Layout.astroのクリックイベント処理）。GA4では `click_line` イベントの `location` パラメータと合わせて参照。

## 計測の仕組み

```
訪問者 → UTM付きLPリンクでLP到達 → LINEボタンクリック
  → GA4に click_line + utm_source/utm_medium を送信
  → LINEの友だち追加URLにUTMを付加（sessionStorage経由で引き継ぎ）
```

LP URL: `https://lp.madoa.co.jp/`

---

## 導線別UTMリンク

### 1. チラシ・名刺・印刷物

QRコードに使用。印刷物の種類ごとに `utm_content` を変える。

| 媒体 | URL |
|---|---|
| チラシA（標準） | `https://lp.madoa.co.jp/?utm_source=flyer&utm_medium=print&utm_campaign=madoa&utm_content=flyer_a` |
| チラシB（補助金版） | `https://lp.madoa.co.jp/?utm_source=flyer&utm_medium=print&utm_campaign=madoa&utm_content=flyer_subsidy` |
| 名刺 | `https://lp.madoa.co.jp/?utm_source=business_card&utm_medium=print&utm_campaign=madoa` |

### 2. 本社サイト（madoa.co.jp）

本社サイトのLINEバナーやボタンに設定。

| 掲載箇所 | URL |
|---|---|
| トップページ | `https://lp.madoa.co.jp/?utm_source=website&utm_medium=referral&utm_campaign=madoa&utm_content=top` |
| お問い合わせページ | `https://lp.madoa.co.jp/?utm_source=website&utm_medium=referral&utm_campaign=madoa&utm_content=contact` |

### 3. Meta広告

Meta広告マネージャーの「ウェブサイトURL」欄に設定。

| 広告 | URL |
|---|---|
| テスト配信（LP誘導） | `https://lp.madoa.co.jp/?utm_source=meta&utm_medium=cpc&utm_campaign=madoa&utm_content=test` |
| リターゲティング | `https://lp.madoa.co.jp/?utm_source=meta&utm_medium=cpc&utm_campaign=madoa_rtg&utm_content=rtg` |

### 4. Google広告（将来用）

| 広告 | URL |
|---|---|
| 検索広告 | `https://lp.madoa.co.jp/?utm_source=google&utm_medium=cpc&utm_campaign=madoa` |

### 5. LINE公式アカウント（メッセージ内リンク）

LINE公式アカウントからメッセージで送る際のリンク。

```
https://lp.madoa.co.jp/?utm_source=line&utm_medium=social&utm_campaign=madoa
```

### 6. その他（口コミ・紹介）

```
https://lp.madoa.co.jp/?utm_source=referral&utm_medium=word_of_mouth&utm_campaign=madoa
```

---

## 補助金LPのUTMリンク

補助金ページ: `https://lp.madoa.co.jp/subsidy/`

| 媒体 | URL |
|---|---|
| チラシ（補助金専用） | `https://lp.madoa.co.jp/subsidy/?utm_source=flyer&utm_medium=print&utm_campaign=madoa_subsidy` |
| Meta広告 | `https://lp.madoa.co.jp/subsidy/?utm_source=meta&utm_medium=cpc&utm_campaign=madoa_subsidy` |

---

## GA4での確認方法

GA4 > レポート > 集客 > トラフィック獲得
- ディメンション: `セッションのデフォルト チャネル グループ` または `セッションの参照元 / メディア`
- `click_line` イベントでLINEクリックを絞り込んで媒体ごとの効果を比較

---

## QRコード生成

[QR Code Generator (Google Chart API)](https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=URL) でURLをURLエンコードして生成。

チラシA用QR例:
```
https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=https%3A%2F%2Flp.madoa.co.jp%2F%3Futm_source%3Dflyer%26utm_medium%3Dprint%26utm_campaign%3Dmadoa%26utm_content%3Dflyer_a
```

---

## 更新履歴

- 2026-06-28: 初版作成（タスク V-243）
