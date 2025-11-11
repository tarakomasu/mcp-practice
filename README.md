# 日本語文字数カウント MCP サーバー

Web版ChatGPTの「新しいコネクター」から接続できるMCPサーバーです。日本語テキストの文字数（グラフェム単位）を正確にカウントするツール `countJapaneseChars` を提供します。

## 機能

- **countJapaneseChars**: 日本語テキストの文字数（グラフェム単位）を正確にカウント
  - `Intl.Segmenter` を使用してグラフェムクラスターを正確にカウント
  - サロゲートペアや結合文字を適切に処理

## 技術スタック

- Next.js 16 (App Router)
- TypeScript
- @modelcontextprotocol/sdk
- Intl.Segmenter (グラフェムカウント用)

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

開発サーバーは `http://localhost:3000` で起動します。

MCPサーバーのエンドポイントは `http://localhost:3000/api/mcp` です。

## 使用方法

### Web版ChatGPTの「新しいコネクター」から接続

1. ChatGPTの設定で「新しいコネクター」を開く
2. エンドポイントURLを入力: `http://localhost:3000/api/mcp` (開発環境) または `https://your-domain.com/api/mcp` (本番環境)
3. 接続を確立

### APIエンドポイント

- **POST** `/api/mcp`: MCPリクエストを処理
- **GET** `/api/mcp`: SSEストリーム（現在はJSONレスポンスモードを使用）
- **DELETE** `/api/mcp`: セッション終了
- **OPTIONS** `/api/mcp`: CORSプリフライト

### ツールの使用例

`countJapaneseChars` ツールを呼び出すと、以下のようなレスポンスが返されます:

```json
{
  "content": [
    {
      "type": "text",
      "text": "文字数: 9"
    }
  ],
  "structuredContent": {
    "count": 9,
    "text": "こんにちは、世界！"
  }
}
```

## デプロイ

### Vercelへのデプロイ（推奨）

#### 1. Vercelアカウントの準備

[Vercel](https://vercel.com/)にサインアップまたはログインします。

#### 2. プロジェクトのデプロイ

```bash
# Vercel CLIをインストール（初回のみ）
npm install -g vercel

# プロジェクトディレクトリでデプロイ
vercel

# 本番環境へデプロイ
vercel --prod
```

または、GitHubと連携して自動デプロイ：

1. GitHubにプロジェクトをプッシュ
2. Vercelダッシュボードで「Import Project」をクリック
3. GitHubリポジトリを選択
4. デプロイ設定を確認（デフォルトで問題なし）
5. 「Deploy」をクリック

#### 3. デプロイ後の確認

デプロイ後、提供されたURLの `/api/mcp` エンドポイントがMCPサーバーとして機能します。

例: `https://your-project.vercel.app/api/mcp`

#### 4. Web版ChatGPTとの接続

1. ChatGPTの設定を開く
2. 「新しいコネクター」を選択
3. エンドポイントURLを入力: `https://your-project.vercel.app/api/mcp`
4. 接続を確立

### その他のデプロイ先

#### Netlify

```bash
# Netlify CLIをインストール
npm install -g netlify-cli

# デプロイ
netlify deploy --prod
```

#### Railway

1. [Railway](https://railway.app/)にサインアップ
2. 「New Project」→「Deploy from GitHub repo」
3. ビルドコマンド: `npm run build`
4. 開始コマンド: `npm start`

### 環境変数

現在、環境変数の設定は不要です。本番環境でセッション管理を改善する場合は、Redisなどの外部ストレージを使用することを推奨します。

#### Redis統合（オプション）

本番環境で複数インスタンスを使用する場合、Redisでセッション管理を行うことを推奨：

```bash
npm install ioredis
```

`app/api/mcp/route.ts` でRedisを使用するようにコードを修正してください。

## 実装の詳細

### コード構造（モジュール分割）

```
app/api/mcp/
├── route.ts                        # HTTPエンドポイントハンドラー
│                                   # POST, GET, DELETE, OPTIONSメソッド
│                                   # セッション管理
│
├── lib/
│   ├── helpers.ts                  # ヘルパー関数
│   │                               # - Next.js ⇔ Node.js 変換
│   │                               # - CORS設定
│   │
│   └── mcp-server.ts              # MCPサーバーセットアップ
│                                   # - サーバーインスタンス作成
│                                   # - ツール登録
│
└── tools/
    └── countJapaneseChars.ts      # 文字数カウントツール
                                    # - グラフェムカウント実装
                                    # - ツール設定とハンドラー
```

各ファイルには**超詳細なコメント**が付いており、以下を説明：
- なぜそのコードが必要か
- どのように動作するか
- 注意点や代替案
- 具体的な使用例

### 主要機能

- **グラフェムカウント**: `Intl.Segmenter` を使用して、人が1文字と捉える単位（グラフェム）を正確にカウント
  - フォールバック機能付き: `Intl.Segmenter`が利用できない環境でも動作
- **セッション管理**: メモリ内でセッションを管理（本番環境ではRedis等の使用を推奨）
- **CORS**: Web版ChatGPTからの接続を許可するため、適切なCORSヘッダーを設定
  - `Authorization`ヘッダーにも対応（将来の認証機能に備える）

### プロダクション品質の特徴

1. **ランタイム指定**: `runtime = "nodejs"` でNode.js APIを確実に使用
2. **堅牢な初期化**: `isInitializeRequest`を検出して無条件で新規セッションを作成
3. **エラーハンドリング**: すべてのエンドポイントで適切なエラーレスポンスを返却
4. **ヘルスチェック**: GET エンドポイントでセッション状態を確認可能
5. **クリーンなセッション削除**: DELETE で不要な処理を行わずシンプルに削除
6. **モジュール分割**: 責務ごとにファイルを分割、保守性と可読性を向上

## ライセンス

MIT
