# 未参照アセットの退避先

LPから参照されなくなった画像の置き場。2026-07-26 に `public/images/` から移した。

## なぜ移したか

Astro は `public/` 配下を dist にそのままコピーするため、LPが一度も参照していない画像も
GitHub Pages と本番（lp.madoa.co.jp）の両方へ毎回アップロードされていた。
広告素材と合わせて 72MB が無駄に配信されていたため、public の外へ出した。

配信対象から外れただけで、リポジトリには残っている。必要になったら `public/images/` へ戻せばよい。

## 中身

- `images/business/photo-*.jpg` 事業所写真ライブラリ。`uchimado/photo-*.jpg` と内容が同一の重複
- `images/uchimado/photo-*.jpg` 同上（うち photo-1 / photo-5 のみ現役なので public に残置）
- `images/subsidy/` 差し替え前の写真、AI生成版のバックアップ、旧スタッフ写真
- `images/subsidy/_backup/` さらに古いバックアップ
- `images/*-thumb-*.png` `images/img-showcasetype2-*.png` 旧デザインのサムネイル群

## 判定方法

dist の全HTMLから `<img src>` と `<source srcset>` の画像パスを抽出し、
`public/images/` の実体と突き合わせて未参照のものを抽出した。
CSS からの参照が無いことも確認済み。
