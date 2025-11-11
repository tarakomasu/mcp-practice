# MCPサーバーのテスト方法

## ローカル環境でのテスト

### 1. 開発サーバーを起動

```bash
npm run dev
```

### 2. エンドポイントのテスト

#### 初期化リクエスト（Initialize）

```bash
curl -X POST http://localhost:3000/api/mcp \
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
  }'
```

レスポンスから`mcp-session-id`ヘッダーを取得します。

#### ツール一覧の取得

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

#### countJapaneseCharsツールの実行

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "countJapaneseChars",
      "arguments": {
        "text": "こんにちは、世界！👋🇯🇵"
      }
    }
  }'
```

期待されるレスポンス：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "文字数: 11"
      }
    ],
    "structuredContent": {
      "count": 11,
      "text": "こんにちは、世界！👋🇯🇵"
    }
  }
}
```

## テストケース

### グラフェムカウントのテストケース

1. **基本的な日本語**
   - 入力: `こんにちは`
   - 期待値: 5文字

2. **絵文字を含む**
   - 入力: `こんにちは👋`
   - 期待値: 6文字

3. **サロゲートペア**
   - 入力: `𠮷野家`
   - 期待値: 3文字

4. **結合文字**
   - 入力: `が` (U+304C か U+304B + U+3099)
   - 期待値: 1文字

5. **フラグ絵文字**
   - 入力: `🇯🇵`
   - 期待値: 1文字

6. **複雑な絵文字**
   - 入力: `👨‍👩‍👧‍👦`（家族の絵文字）
   - 期待値: 1文字

## Web版ChatGPTでのテスト

1. ChatGPTの設定で「新しいコネクター」を開く
2. エンドポイントURL: `http://localhost:3000/api/mcp`
3. 接続を確立
4. 以下のようなプロンプトでテスト：

```
countJapaneseCharsツールを使って、「こんにちは、世界！👋🇯🇵」の文字数を数えてください。
```

## 本番環境でのテスト

1. Vercelにデプロイ後、URLを確認
2. 上記のcurlコマンドのURLを本番環境のURLに変更して実行
3. Web版ChatGPTで本番環境のURLを設定してテスト

## トラブルシューティング

### CORS エラー

- CORSヘッダーが正しく設定されているか確認
- ブラウザの開発者ツールでネットワークタブを確認

### セッションエラー

- `mcp-session-id`ヘッダーが正しく設定されているか確認
- 初期化リクエストが成功しているか確認

### ツールが見つからない

- `tools/list`メソッドでツールが正しく登録されているか確認
- サーバーのログを確認

