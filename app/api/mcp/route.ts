/**
 * MCP HTTPエンドポイントハンドラー
 *
 * このファイルは、Next.js App RouterのAPI Routeとして機能し、
 * Model Context Protocol (MCP) サーバーへのHTTPエンドポイントを提供します。
 *
 * エンドポイント: /api/mcp
 *
 * サポートするHTTPメソッド:
 * - POST: MCPリクエスト（initialize, tools/list, tools/call など）
 * - GET: セッションのヘルスチェック
 * - DELETE: セッションの削除
 * - OPTIONS: CORSプリフライトリクエスト
 *
 * アーキテクチャ:
 * 1. クライアント（ChatGPTなど）がHTTPリクエストを送信
 * 2. Next.jsがこのファイルのハンドラーを実行
 * 3. ハンドラーがMCPサーバーとTransportを管理
 * 4. MCPサーバーがツールを実行
 * 5. 結果をHTTPレスポンスとして返す
 *
 * セッション管理:
 * - 各クライアント接続にセッションIDを割り当て
 * - セッションIDでTransportとサーバーインスタンスを管理
 * - メモリ内にセッションを保持（本番環境ではRedis推奨）
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  createIncomingMessage,
  createServerResponse,
  setCorsHeaders,
} from "./lib/helpers";
import { createMcpServer } from "./lib/mcp-server";

/**
 * Next.js/Vercelランタイム設定
 *
 * runtime = "nodejs":
 * - Node.js APIを使用可能にする（http, stream, cryptoなど）
 * - Edge Runtimeでは使えないNode.js組み込みモジュールが必要なため必須
 * - Vercelのサーバーレス関数として実行される
 *
 * 注意: この設定がないとEdge Runtimeで実行され、IncomingMessageなどが使えません
 */
export const runtime = "nodejs";

/**
 * Next.js動的レンダリング設定
 *
 * dynamic = "force-dynamic":
 * - このルートを常に動的にレンダリング（静的生成しない）
 * - リクエストごとに異なるレスポンスを返すため必要
 * - キャッシュを無効化
 *
 * MCPサーバーは：
 * - セッション状態を持つ
 * - リクエストごとに異なる処理を行う
 * - 静的生成には適さない
 */
export const dynamic = "force-dynamic";

/**
 * セッション管理用のMap
 *
 * key: セッションID（UUID）
 * value: StreamableHTTPServerTransportインスタンス
 *
 * データ構造の選択理由:
 * - Mapは高速なO(1)ルックアップ
 * - セッションIDをキーとした効率的な管理
 *
 * セッションライフサイクル:
 * 1. initialize時に新規セッション作成、Mapに追加
 * 2. 以降のリクエストでセッションIDからTransportを取得
 * 3. DELETE時またはタイムアウトでMapから削除
 *
 * スケーリング考慮事項:
 * - 現状はメモリ内管理（単一インスタンスのみ）
 * - 本番環境では複数インスタンス対応のため、Redis等の外部ストアを推奨
 * - セッションタイムアウトの実装も推奨
 *
 * 例: Redis実装の場合
 * const transports = new RedisSessionStore({
 *   ttl: 3600, // 1時間で自動削除
 *   keyPrefix: "mcp:session:",
 * });
 */
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * OPTIONSリクエストハンドラー
 *
 * 目的: CORSプリフライトリクエストへの応答
 *
 * CORSプリフライトとは:
 * - ブラウザが本リクエストの前に送る確認リクエスト
 * - POST、PUT、DELETEなどで自動的に送信される
 * - カスタムヘッダー（Mcp-Session-Id）を使う場合も送信される
 *
 * プリフライトの流れ:
 * 1. ブラウザが OPTIONS /api/mcp を送信
 * 2. サーバーが許可するメソッド・ヘッダーを返す
 * 3. ブラウザが本リクエストを送信
 *
 * レスポンス:
 * - ステータス: 204 No Content（ボディなし）
 * - CORSヘッダー: Access-Control-Allow-* 系
 *
 * @returns 204 No Contentレスポンス（CORSヘッダー付き）
 */
export async function OPTIONS() {
  // 空のレスポンスを作成（204 No Content）
  const response = new NextResponse(null, { status: 204 });

  // CORSヘッダーを追加して返す
  return setCorsHeaders(response);
}

/**
 * POSTリクエストハンドラー
 *
 * 目的: MCPプロトコルの主要なリクエストを処理
 *
 * 処理するリクエストの例:
 * - initialize: セッション初期化
 * - tools/list: 利用可能なツール一覧の取得
 * - tools/call: ツールの実行
 * - resources/list: リソース一覧の取得
 * - その他のMCP JSON-RPCリクエスト
 *
 * リクエスト形式 (JSON-RPC 2.0):
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "method": "tools/call",
 *   "params": {
 *     "name": "countJapaneseChars",
 *     "arguments": { "text": "こんにちは" }
 *   }
 * }
 *
 * セッション管理:
 * - initializeリクエスト: 新規セッションを作成
 * - その他のリクエスト: 既存セッションを使用
 *
 * @param req - Next.jsのリクエストオブジェクト
 * @returns MCPレスポンスまたはエラーレスポンス
 */
export async function POST(req: NextRequest) {
  try {
    /**
     * ステップ1: リクエストヘッダーとボディの取得
     *
     * mcp-session-id ヘッダー:
     * - クライアントが保持するセッション識別子
     * - initialize時は存在しない
     * - 2回目以降のリクエストで送信される
     */
    const sessionId = req.headers.get("mcp-session-id");

    /**
     * リクエストボディ (JSON-RPC):
     * - jsonrpc: プロトコルバージョン（"2.0"固定）
     * - id: リクエストID（レスポンスで同じIDを返す）
     * - method: 実行するメソッド名
     * - params: メソッドのパラメータ
     */
    const body = await req.json();

    // デバッグログ: リクエスト内容を記録
    console.log("📨 Received MCP request:", {
      sessionId: sessionId || "(none)",
      method: body.method,
      hasParams: !!body.params,
    });
    console.log("📋 Full request body:", JSON.stringify(body, null, 2));

    /**
     * ステップ2: リクエストタイプの判定とルーティング
     */
    let transport: StreamableHTTPServerTransport | undefined;

    /**
     * ケース1: 初期化リクエスト（initialize）
     *
     * 判定条件:
     * - isInitializeRequest(body) が true
     * - sessionIdの有無は問わない（柔軟な実装）
     *
     * 動作:
     * 1. 既存セッションがあれば削除（再初期化）
     * 2. 新しいTransportインスタンスを作成
     * 3. MCPサーバーインスタンスを作成して接続
     * 4. セッションをMapに登録
     * 5. リクエストを処理
     */
    if (isInitializeRequest(body)) {
      console.log("🆕 Initializing new session...");

      // 既存セッションのクリーンアップ
      if (sessionId && transports.has(sessionId)) {
        transports.delete(sessionId);
        console.log(`🗑️  Deleted existing session: ${sessionId}`);
      }

      /**
       * StreamableHTTPServerTransportの作成
       *
       * StreamableHTTPServerTransportとは:
       * - MCPサーバーとHTTP通信をブリッジするアダプター
       * - JSON-RPCメッセージをHTTPリクエスト/レスポンスに変換
       * - セッション管理機能を提供
       *
       * 設定オプション:
       */
      transport = new StreamableHTTPServerTransport({
        /**
         * sessionIdGenerator: セッションID生成関数
         *
         * UUID v4を使用:
         * - 衝突確率が極めて低い
         * - 予測不可能（セキュリティ）
         * - 標準形式（互換性）
         *
         * 例: "550e8400-e29b-41d4-a716-446655440000"
         */
        sessionIdGenerator: () => randomUUID(),

        /**
         * enableJsonResponse: JSONレスポンスモードを有効化
         *
         * true: JSON形式のレスポンスを返す（推奨）
         * false: Server-Sent Events (SSE) ストリームを使用
         *
         * JSONモードの利点:
         * - シンプルな実装
         * - デバッグしやすい
         * - ファイアウォール/プロキシで問題が起きにくい
         *
         * SSEモードの利点:
         * - ストリーミング対応
         * - リアルタイム更新
         * - 長時間実行タスクに適する
         */
        enableJsonResponse: true,

        /**
         * onsessioninitialized: セッション初期化時のコールバック
         *
         * @param sid - 生成されたセッションID
         *
         * 処理:
         * 1. セッションIDをログ出力
         * 2. TransportインスタンスをMapに登録
         *
         * このコールバックは:
         * - Transport内部で自動的に呼ばれる
         * - セッションIDが確定した直後に実行
         */
        onsessioninitialized: (sid) => {
          console.log(`✅ Session initialized with ID: ${sid}`);
          if (transport) {
            transports.set(sid, transport);
            console.log(
              `💾 Session stored in memory (total: ${transports.size})`
            );
          }
        },

        /**
         * onsessionclosed: セッション終了時のコールバック
         *
         * @param sid - 終了するセッションID
         *
         * 処理:
         * 1. セッション終了をログ出力
         * 2. Mapからセッションを削除
         *
         * このコールバックは:
         * - クライアントが明示的に終了を通知した時
         * - エラーでセッションが切断された時
         * に呼ばれる
         */
        onsessionclosed: (sid) => {
          console.log(`👋 Session closed: ${sid}`);
          transports.delete(sid);
          console.log(
            `🗑️  Session removed from memory (remaining: ${transports.size})`
          );
        },
      });

      /**
       * Transport.oncloseハンドラー
       *
       * onsessionclosedとの違い:
       * - onsessionclosed: MCP層のイベント
       * - onclose: Transport層のイベント
       *
       * 念のため両方で削除処理を行うことで、確実なクリーンアップを保証
       */
      transport.onclose = () => {
        const sid = transport?.sessionId;
        if (sid) {
          console.log(`🔌 Transport closed for session ${sid}`);
          transports.delete(sid);
        }
      };

      /**
       * MCPサーバーインスタンスの作成と接続
       *
       * createMcpServer():
       * - 新しいMcpServerインスタンスを作成
       * - ツールを登録
       *
       * server.connect(transport):
       * - サーバーとTransportを接続
       * - これ以降、Transportが受信したリクエストをサーバーが処理
       */
      const server = createMcpServer();
      await server.connect(transport);
      console.log("🔗 MCP server connected to transport");

      /**
       * リクエストの処理
       *
       * transport.handleRequest():
       * 1. Node.js形式のリクエストを受け取る
       * 2. JSON-RPCメッセージとしてパース
       * 3. MCPサーバーにディスパッチ
       * 4. レスポンスをNode.js形式で書き込む
       */
      console.log("⚙️  Creating request/response objects...");
      const incomingMessage = createIncomingMessage(req, body);
      const { response, getResponse } = createServerResponse();

      console.log("🔍 IncomingMessage properties:", {
        readable: incomingMessage.readable,
        method: incomingMessage.method,
        hasAsyncIterator:
          typeof (incomingMessage as any)[Symbol.asyncIterator] === "function",
        hasOn: typeof incomingMessage.on === "function",
        hasOnce: typeof incomingMessage.once === "function",
        hasEmit: typeof (incomingMessage as any).emit === "function",
      });

      // Test: Can we read the stream?
      console.log("🧪 Testing stream read...");
      try {
        const chunks: string[] = [];
        for await (const chunk of incomingMessage) {
          chunks.push(chunk.toString());
        }
        const readData = chunks.join("");
        console.log("✅ Stream read successful, data length:", readData.length);
        console.log("📝 Stream data preview:", readData.substring(0, 100));
      } catch (streamError) {
        console.error("❌ Stream read test failed:", streamError);
      }

      // Stream has been consumed, recreate it for SDK
      const incomingMessage2 = createIncomingMessage(req, body);
      console.log("🔄 Recreated stream for SDK");

      console.log("📤 Calling transport.handleRequest...");
      try {
        await transport.handleRequest(incomingMessage2, response);
        console.log("✅ transport.handleRequest completed");
      } catch (error) {
        console.error("❌ Error in transport.handleRequest:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });
        throw error;
      }

      console.log("🔄 Converting to Next.js response...");
      const nextResponse = await getResponse();
      console.log(`📋 Response status: ${nextResponse.status}`);

      // レスポンスボディをログ出力
      const responseBody = await nextResponse.text();
      console.log(`📄 Response body: ${responseBody}`);

      // 新しいレスポンスを作成（bodyは一度しか読めないため）
      const finalResponse = new NextResponse(responseBody, {
        status: nextResponse.status,
        headers: nextResponse.headers,
      });

      // CORSヘッダーを追加して返す
      console.log("🚀 Sending response with CORS headers");
      return setCorsHeaders(finalResponse);
    }

    /**
     * ケース2: 既存セッションでのリクエスト
     *
     * 条件:
     * - initialize以外のメソッド
     * - セッションIDが提供されている
     * - セッションがMapに存在する
     *
     * 処理の流れ:
     * 1. セッションIDでTransportを検索
     * 2. Transportが見つかればリクエストを処理
     * 3. 見つからなければエラーレスポンス
     */
    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId);
      console.log(`♻️  Using existing session: ${sessionId}`);
    } else {
      /**
       * エラーケース: セッションが無効
       *
       * 原因:
       * - セッションIDが送信されていない
       * - 送信されたセッションIDが存在しない
       * - セッションがタイムアウトした
       *
       * クライアントの対処:
       * 1. initializeリクエストを再送
       * 2. 新しいセッションIDを取得
       * 3. リクエストをリトライ
       */
      console.error("❌ Invalid session:", {
        providedId: sessionId || "(none)",
        availableSessions: Array.from(transports.keys()),
      });

      const errorResponse = NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000, // サーバーエラー（JSON-RPC標準）
            message:
              "Bad Request: No valid session ID provided or session not found",
            data: {
              hint: "Please send an initialize request first",
            },
          },
          id: body.id || null,
        },
        { status: 400 }
      );
      return setCorsHeaders(errorResponse);
    }

    /**
     * Transportの存在確認
     *
     * TypeScriptの型安全性のため、再度確認
     * 通常このブロックには到達しない
     */
    if (!transport) {
      console.error("❌ Transport not found (unexpected)");

      const errorResponse = NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: Transport not found",
          },
          id: body.id || null,
        },
        { status: 400 }
      );
      return setCorsHeaders(errorResponse);
    }

    /**
     * ステップ3: リクエストの処理
     *
     * 既存セッションでのリクエスト処理:
     * 1. Node.js形式にリクエストを変換
     * 2. Transportでリクエストを処理
     * 3. MCPサーバーがツールを実行
     * 4. レスポンスを変換して返す
     */
    console.log(`⚙️  Processing ${body.method} request...`);

    const incomingMessage = createIncomingMessage(req, body);
    const { response, getResponse } = createServerResponse();

    await transport.handleRequest(incomingMessage, response);

    const nextResponse = await getResponse();
    const responseBody = await nextResponse.text();
    console.log(`✅ Request processed successfully`);
    console.log(`📋 Response status: ${nextResponse.status}`);
    console.log(`📄 Response body: ${responseBody}`);

    const finalResponse = new NextResponse(responseBody, {
      status: nextResponse.status,
      headers: nextResponse.headers,
    });

    return setCorsHeaders(finalResponse);
  } catch (error) {
    /**
     * エラーハンドリング
     *
     * キャッチされるエラーの例:
     * - JSON解析エラー（不正なリクエストボディ）
     * - Transportエラー（通信失敗）
     * - ツール実行エラー（ツール内部の例外）
     * - その他の予期しないエラー
     *
     * エラーレスポンス:
     * - JSON-RPC形式のエラーオブジェクト
     * - ステータス: 500 Internal Server Error
     * - エラー詳細はログに出力（本番環境では外部に送らない）
     */
    console.error("💥 Error handling MCP request:", error);

    const errorResponse = NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603, // Internal error（JSON-RPC標準）
          message: "Internal server error",
          // 開発環境でのみエラー詳細を含める
          ...(process.env.NODE_ENV === "development" && {
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          }),
        },
        id: null,
      },
      { status: 500 }
    );
    return setCorsHeaders(errorResponse);
  }
}

/**
 * GETリクエストハンドラー
 *
 * 目的: セッションのヘルスチェック
 *
 * 用途:
 * - セッションが有効かどうかの確認
 * - 接続テスト
 * - モニタリング/デバッグ
 *
 * 注意:
 * - enableJsonResponse: true のため、SSEストリームは不要
 * - SSEが必要な場合は別途実装
 *
 * @param req - Next.jsのリクエストオブジェクト
 * @returns セッション状態のJSONレスポンス
 */
export async function GET(req: NextRequest) {
  try {
    /**
     * セッションIDの取得
     *
     * オプショナル: セッションIDがなくても200を返す設計も可能
     */
    const sessionId = req.headers.get("mcp-session-id");

    /**
     * ケース1: セッションIDがあり、有効
     *
     * レスポンス:
     * - status: "ok"
     * - sessionId: セッションID
     * - message: 状態メッセージ
     */
    if (sessionId && transports.has(sessionId)) {
      console.log(`✅ Health check passed for session: ${sessionId}`);

      const response = NextResponse.json(
        {
          status: "ok",
          sessionId,
          message: "Session is active",
        },
        { status: 200 }
      );
      return setCorsHeaders(response);
    }

    /**
     * ケース2: セッションIDはあるが、無効
     */
    if (sessionId) {
      console.log(`⚠️ Health check: Session not found for ID: ${sessionId}`);
      const response = NextResponse.json(
        {
          status: "error",
          message: "Session not found",
        },
        { status: 404 }
      );
      return setCorsHeaders(response);
    }

    /**
     * ケース3: セッションIDがない（通常のヘルスチェック）
     *
     * レスポンス:
     * - status: "ok"
     * - message: サーバーは稼働しているがセッションはない旨を通知
     * - ステータス: 200
     */
    console.log("✅ Health check passed (no session ID provided)");
    const response = NextResponse.json(
      {
        status: "ok",
        message: "Server is running. No session provided.",
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error) {
    /**
     * エラーハンドリング
     *
     * GETリクエストは単純なため、エラーが発生することは稀
     */
    console.error("💥 Error handling GET request:", error);

    const errorResponse = NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
    return setCorsHeaders(errorResponse);
  }
}

/**
 * DELETEリクエストハンドラー
 *
 * 目的: セッションの明示的な削除
 *
 * 用途:
 * - クライアントが接続を終了する時
 * - セッションをクリーンアップしたい時
 * - テスト/デバッグ
 *
 * 処理:
 * 1. セッションIDを確認
 * 2. Mapから削除
 * 3. 成功レスポンスを返す
 *
 * 注意:
 * - transport.handleRequestは不要（単純な削除のみ）
 * - onsessionclosedコールバックは自動的には呼ばれない
 *
 * @param req - Next.jsのリクエストオブジェクト
 * @returns 削除結果のJSONレスポンス
 */
export async function DELETE(req: NextRequest) {
  try {
    /**
     * ステップ1: セッションIDの取得と検証
     */
    const sessionId = req.headers.get("mcp-session-id");

    /**
     * エラーケース1: セッションIDがない
     *
     * DELETEリクエストには必ずセッションIDが必要
     */
    if (!sessionId) {
      console.log("❌ DELETE failed: No session ID provided");

      const errorResponse = NextResponse.json(
        {
          status: "error",
          message: "No session ID provided",
        },
        { status: 400 }
      );
      return setCorsHeaders(errorResponse);
    }

    /**
     * エラーケース2: セッションが存在しない
     *
     * 原因:
     * - 既に削除されている
     * - 無効なセッションID
     * - タイムアウトで削除された
     */
    if (!transports.has(sessionId)) {
      console.log(`❌ DELETE failed: Session not found: ${sessionId}`);

      const errorResponse = NextResponse.json(
        {
          status: "error",
          message: "Session not found",
        },
        { status: 404 }
      );
      return setCorsHeaders(errorResponse);
    }

    /**
     * ステップ2: セッションの削除
     *
     * Map.delete():
     * - セッションをMapから削除
     * - 戻り値: true（削除成功）、false（キーが存在しない）
     *
     * 注意:
     * - Transport.close()は呼ばない（不要な処理を避ける）
     * - onsessionclosedコールバックも呼ばれない
     * - シンプルな削除のみを行う
     */
    transports.delete(sessionId);
    console.log(
      `🗑️  Session deleted: ${sessionId} (remaining: ${transports.size})`
    );

    /**
     * ステップ3: 成功レスポンスを返す
     *
     * レスポンス:
     * - status: "ok"
     * - message: 成功メッセージ
     * - sessionId: 削除されたセッションID（確認用）
     */
    const successResponse = NextResponse.json(
      {
        status: "ok",
        message: "Session deleted successfully",
        sessionId,
      },
      { status: 200 }
    );
    return setCorsHeaders(successResponse);
  } catch (error) {
    /**
     * エラーハンドリング
     *
     * DELETEリクエストは単純なため、エラーが発生することは稀
     */
    console.error("💥 Error handling DELETE request:", error);

    const errorResponse = NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
    return setCorsHeaders(errorResponse);
  }
}
