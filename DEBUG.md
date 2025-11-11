# MCP サーバー接続デバッグガイド

## 問題: 400 Client Error

### 1. まず直接テストする

```bash
# 初期化リクエストをテスト
curl -X POST https://mcp-practice.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' -v
```

### 2. Vercelのログを確認

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. プロジェクト `mcp-practice` を選択
3. 「Logs」タブを開く
4. リアルタイムログを確認

エラーメッセージから原因を特定できます。

### 3. よくある原因と対処法

#### 原因A: ランタイム設定が反映されていない

**症状**: `IncomingMessage is not defined` などのエラー

**対処**:
```bash
# 再デプロイ
vercel --prod --force
```

#### 原因B: 依存関係の問題

**症状**: `Cannot find module` エラー

**対処**:
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
vercel --prod
```

#### 原因C: リクエスト形式の問題

**症状**: JSON解析エラー

ChatGPTが送信するリクエスト形式が期待と異なる可能性があります。

**対処**: サーバー側でリクエストをログ出力して確認

#### 原因D: CORS設定の問題

**症状**: プリフライトリクエストが失敗

**確認**:
```bash
# OPTIONSリクエストをテスト
curl -X OPTIONS https://mcp-practice.vercel.app/api/mcp \
  -H "Origin: https://chatgpt.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,mcp-session-id" -v
```

### 4. デバッグ用の一時的な変更

エラー詳細を確認するため、route.tsに以下を追加：

```typescript
// POSTハンドラーの最初に追加
console.log('Request headers:', Object.fromEntries(req.headers.entries()));
console.log('Request body:', await req.text());
```

### 5. チェックリスト

- [ ] `npm run build` がローカルで成功する
- [ ] Vercelに正しくデプロイされている
- [ ] 環境変数が設定されている（必要な場合）
- [ ] URLが正しい（末尾にスラッシュがない）
- [ ] Content-Typeヘッダーが `application/json`
- [ ] リクエストボディが有効なJSON

### 6. ChatGPT側の設定再確認

**重要**: ChatGPTのMCP設定で以下を確認：

1. URL: `https://mcp-practice.vercel.app/api/mcp`（末尾に`/`なし）
2. 認証: **なし**
3. プロトコル: HTTP/HTTPS（デフォルト）

### 7. 次のステップ

1. 上記のcurlコマンドでテスト
2. Vercelログを確認
3. エラーメッセージを共有

これらの情報があれば、具体的な原因を特定できます。

