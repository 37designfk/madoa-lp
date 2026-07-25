# デモ台本: Antigravity CLI（旧Gemini CLI）+ マネーフォワードMCP

日時: 2026-06-29 (月) 10:00
Google Meet: https://meet.google.com/oun-kbha-kqp
参加者: 古田 健 / 菊池 真孝（株式会社三喜）/ 羽田野 慶子
菊池さん環境: Windows

---

## 事前チェックリスト

### 古田側（デモ前日までに）
- [ ] 台本を通読・デモシナリオを頭に入れる
- [ ] 菊池さんがマネーフォワードクラウド会計を使っているか確認
- [ ] 菊池さんにNode.js・Claude Codeのインストール状況を確認しておく
- [ ] フォールバック: 菊池さん環境でセットアップに詰まったら古田の画面共有でデモを見てもらう形に切り替える

### 菊池さん側（当日用意）
- [ ] PowerShell（またはWindows Terminal）を開ける状態
- [ ] マネーフォワードIDとパスワード（OAuth認証で使う）
- [ ] Googleアカウント（Antigravity CLIの認証で使う）
- [ ] Node.js インストール済みか確認 → `node --version` が通るか

**Node.js 未インストールの場合:** https://nodejs.org/ja/ からLTS版をダウンロード・インストール

---

## 目次

1. [今日のゴール](#1-今日のゴール)
2. [Gemini CLI の現状と後継ツール](#2-gemini-cli-の現状と後継ツール)
3. [Antigravity CLI インストール・デモ](#3-antigravity-cli-インストールデモ)
4. [マネーフォワード公式MCP × Claude Code デモ](#4-マネーフォワード公式mcp--claude-code-デモ)
5. [活用アイデア・次のアクション](#5-活用アイデア次のアクション)

---

## 1. 今日のゴール

**話すこと（10秒）**
> 「今日は2つをお見せします。1つ目はGoogleのAI CLIツールの最新版。2つ目はマネーフォワードの公式AIエージェント連携です。実際に菊池さんのPCで動かしながら進めます。」

---

## 2. Gemini CLI の現状と後継ツール

### 経緯（30秒で説明）

| ツール | 状況 |
|---|---|
| Gemini CLI | 2026年6月18日に個人向け終了済み |
| Antigravity CLI | 後継ツール。5月19日から提供開始済み |

**話すこと:**
> 「以前ご紹介した『Gemini CLI』ですが、Googleが6月18日に個人向けを終了しました。後継が『Antigravity CLI』（コマンド名: `agy`）です。機能は強化されており、Windowsでも使えます。」

---

## 3. Antigravity CLI インストール・デモ

### 3-1. インストール（Windows PowerShell）

PowerShellを管理者として開き、以下を実行:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

インストール確認:
```powershell
agy --version
```

所要時間: 1〜2分程度

**PATH が通らない場合:** ターミナルを再起動する。それでも動かない場合は `$env:LOCALAPPDATA\agy\bin` にあるか確認。

### 3-2. 初回認証

```powershell
agy
```

- 自動でブラウザが開く → 菊池さんのGoogleアカウントでサインイン
- **注意: Google AI Pro（月額2,900円）またはUltraプランが必要**
- 認証後は資格情報が保存されるため次回以降は不要
- プランがない場合は古田の画面共有でデモを見てもらう形に切り替える

### 3-3. デモコマンド例（実演）

```powershell
# 基本的な質問（日本語OK）
agy "マーケティングで問い合わせを増やすアイデアを5つ教えて"
```

**話すこと:**
> 「これがAntigravity CLIです。PowerShellから日本語で話しかけるだけです。GoogleのGeminiモデルが動いています。AI Proプランがあれば追加費用なしで使えます。」

---

## 4. マネーフォワード公式MCP × Claude Code デモ

### 背景（1分）

**話すこと:**
> 「次はマネーフォワードです。2026年3月26日に公式のMCPサーバーをリリースしました。Claude Codeと繋ぐと、仕訳の確認・試算表の閲覧が日本語で操作できるようになります。」

### 前提: Claude Code のインストール確認

```powershell
claude --version
```

未インストールの場合（Node.jsが入っていれば）:
```powershell
npm install -g @anthropic-ai/claude-code
```

### 4-1. 接続設定（菊池さんのPCで実演）

PowerShellでデモ用フォルダを作成:
```powershell
mkdir $env:USERPROFILE\Desktop\mf-mcp-demo
cd $env:USERPROFILE\Desktop\mf-mcp-demo
```

`.mcp.json` をメモ帳で作成（古田が内容を貼り付けてあげる）:
```powershell
notepad .mcp.json
```

以下の内容を貼り付けて保存:
```json
{
  "mcpServers": {
    "mfc_ca": {
      "type": "http",
      "url": "https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3"
    }
  }
}
```

### 4-2. 起動とOAuth認証（実演）

```powershell
claude
```

1. Claude Code起動時に「MCPサーバーを許可しますか?」→ Yes
2. `/mcp` で接続状態を確認
3. `mfc_ca - needs authentication` が出る
4. 「Authenticate」をクリック → ブラウザでマネーフォワードIDでログイン（菊池さんのアカウント）
5. 許可後、`/mcp` で `connected` になっていれば完了

### 4-3. デモシナリオ（実演・3〜5分）

以下を順番に入力:

```
今月の仕訳を一覧で見せて
```

```
試算表（損益計算書）を見せて
```

**話すこと:**
> 「マネーフォワードの画面を開かなくても、AIに話しかけるだけで帳簿を確認できます。月次締めや経理確認の時間が短縮できます。」

### 4-4. 書き込みデモ（任意・時間があれば）

```
水道工事の外注費 55,000円（税込）を2026年6月25日の仕訳として登録して
```

**注意:** 実際のデータに登録されるため、事前に菊池さんへ確認してから実施する。

---

## 5. 活用アイデア・次のアクション

### MADOAでの活用シナリオ（提案）

- 月末に「今月の売上・経費を要約して」と聞くだけで月次レポート
- 工事ごとの経費仕訳をAIに話しかけて登録（手入力不要）
- 試算表を見ながらAIに「利益率を上げるには」と相談

### 次のアクション

- [ ] 菊池さん: マネーフォワードクラウド会計のプラン確認（全プラン対象）
- [ ] 古田: Claude Code インストール済みか事前に菊池さんに確認
- [ ] 古田: Google AI Proプランを持っているか菊池さんに確認

---

## 参考リンク

- Antigravity CLI 公式: https://antigravity.google/
- マネーフォワードMCP公式ドキュメント: https://developers.biz.moneyforward.com/mcp/
- マネーフォワードプレスリリース: https://corp.moneyforward.com/news/release/service/20260326-mf-press-1/
