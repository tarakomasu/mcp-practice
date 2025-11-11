# クイックスタートガイド

## 最速でデプロイする（5分）

### 1. リポジトリのクローン

```bash
git clone <your-repo-url>
cd mcp-practice
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. ローカルでテスト

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いて、MCPサーバーの情報ページを確認。

### 4. Vercelにデプロイ

#### 方法A: Vercel CLIを使用

```bash
npm install -g vercel
vercel
vercel --prod
```

#### 方法B: GitHubと連携

1. GitHubにプッシュ
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. [Vercel](https://vercel.com)にアクセス
3. 「Import Project」をクリック
4. GitHubリポジトリを選択
5. 「Deploy」をクリック

### 5. Web版ChatGPTと接続

1. ChatGPTの設定を開く
2. 「新しいコネクター」を選択
3. エンドポイントURLを入力:
   ```
   https://your-project.vercel.app/api/mcp
   ```
4. 接続を確立

### 6. 使ってみる

ChatGPTで以下のように話しかけてみてください：

```
countJapaneseCharsツールを使って、「こんにちは、世界！👋🇯🇵」の文字数を数えてください。
```

## トラブルシューティング

### ビルドが失敗する

```bash
# キャッシュをクリア
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### デプロイ後に404エラー

- `vercel.json`が正しく配置されているか確認
- Vercelのログを確認

### ChatGPTから接続できない

- CORSヘッダーが設定されているか確認
- エンドポイントURLが正しいか確認（末尾に `/` がないこと）
- ブラウザの開発者ツールでネットワークエラーを確認

## 次のステップ

- `test-mcp.md` でcurlを使った詳細なテスト方法を確認
- `README.md` で実装の詳細を確認
- カスタムツールを追加する場合は `app/api/mcp/route.ts` を編集

## サポート

- [MCP SDK ドキュメント](https://github.com/modelcontextprotocol/sdk)
- [Next.js ドキュメント](https://nextjs.org/docs)
- [Vercel ドキュメント](https://vercel.com/docs)

