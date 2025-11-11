/**
 * MCPサーバー用ヘルパー関数
 *
 * このモジュールは、Next.jsのRequest/ResponseとNode.jsのIncomingMessage/ServerResponseの
 * 間の変換を行うヘルパー関数、およびCORS設定などのユーティリティ関数を提供します。
 *
 * 背景：
 * - @modelcontextprotocol/sdkはNode.jsのhttp.IncomingMessageとhttp.ServerResponseを期待
 * - Next.jsのApp RouterはNextRequest/NextResponseを使用
 * - そのため、相互変換が必要
 */

import { NextRequest, NextResponse } from "next/server";
import { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";

/**
 * Next.jsのNextRequestをNode.jsのIncomingMessageに変換する関数
 *
 * @param req - Next.jsのリクエストオブジェクト
 * @param body - リクエストボディ（オプション、JSON形式）
 * @returns Node.jsのIncomingMessageオブジェクト
 *
 * 変換の詳細：
 * 1. Readable Streamを作成し、bodyを流し込む
 * 2. IncomingMessageとして型キャスト
 * 3. 必要なプロパティをObject.assignで追加
 *
 * 注意点：
 * - 完全なIncomingMessageではなく、MCPサーバーが必要とする最小限のプロパティを実装
 * - headers, method, urlなどの基本的なHTTPメタデータを含む
 */
export function createIncomingMessage(
  req: NextRequest,
  body?: unknown
): IncomingMessage {
  // 1. Next.jsのヘッダーをNode.js形式に変換
  // Next.js Headers APIはIterableだが、Node.jsはRecord<string, string | string[]>を期待
  const headers: Record<string, string | string[]> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // 2. Readable Streamを作成
  // MCPサーバーはリクエストボディをストリームとして読み取る
  const incomingMessage = new Readable({
    /**
     * read() メソッド
     * ストリームからデータを読み取る際に呼ばれる
     *
     * 動作：
     * 1. bodyがあればJSON文字列化してpush
     * 2. null をpushしてストリーム終了を通知
     */
    read() {
      if (body) {
        // bodyをJSON文字列化してストリームにpush
        this.push(JSON.stringify(body));
      }
      // null をpushしてストリーム終了
      this.push(null);
    },
  }) as IncomingMessage;

  // 3. IncomingMessageに必要なプロパティを追加
  // Object.assignを使用して既存のReadableオブジェクトにプロパティを追加
  Object.assign(incomingMessage, {
    /**
     * headers: HTTPヘッダー
     * Content-Type, Mcp-Session-Idなどが含まれる
     */
    headers,

    /**
     * method: HTTPメソッド
     * "POST", "GET", "DELETE", "OPTIONS" など
     */
    method: req.method,

    /**
     * url: リクエストURL
     * パスとクエリ文字列を含む
     */
    url: req.url,

    /**
     * httpVersion: HTTPバージョン文字列
     * "1.1" を返す（HTTP/1.1を想定）
     */
    httpVersion: "1.1",

    /**
     * httpVersionMajor: HTTPメジャーバージョン
     */
    httpVersionMajor: 1,

    /**
     * httpVersionMinor: HTTPマイナーバージョン
     */
    httpVersionMinor: 1,

    /**
     * aborted: リクエストが中断されたかどうか
     * 通常はfalse
     */
    aborted: false,

    /**
     * complete: リクエストが完了したかどうか
     * bodyを事前に読み込んでいるのでfalseのまま
     */
    complete: false,

    /**
     * readable: 読み取り可能かどうか
     * Readable Streamなのでtrue
     */
    readable: true,
  });

  return incomingMessage;
}

/**
 * Node.jsのServerResponseをラップし、Next.jsのNextResponseに変換するヘルパーを返す関数
 *
 * @returns 以下を含むオブジェクト
 *   - response: ServerResponseのモック実装
 *   - getResponse: 最終的なNextResponseを取得する関数
 *
 * 動作の流れ：
 * 1. MCPサーバーがresponseオブジェクトに書き込む
 * 2. 書き込まれたデータをバッファに保存
 * 3. getResponse()を呼ぶとNextResponseに変換して返す
 *
 * ServerResponseモックの実装：
 * - setHeader, getHeader, removeHeader: ヘッダー操作
 * - write, end: ボディの書き込み
 * - writeHead: ステータスコードとヘッダーの設定
 */
export function createServerResponse(): {
  response: ServerResponse;
  getResponse: () => Promise<NextResponse>;
} {
  // レスポンス情報を保持する変数
  let statusCode = 200; // デフォルトは200 OK
  const headers: Record<string, string | string[]> = {}; // レスポンスヘッダー
  const chunks: Buffer[] = []; // ボディデータのチャンク
  let headersSent = false; // ヘッダー送信済みフラグ

  /**
   * ServerResponseのモック実装
   * Node.jsのServerResponseインターフェースを満たす最小限の実装
   */
  const response = {
    /**
     * setHeader: レスポンスヘッダーを設定
     *
     * @param name - ヘッダー名
     * @param value - ヘッダー値（文字列または文字列配列）
     *
     * 例: setHeader("Content-Type", "application/json")
     */
    setHeader(name: string, value: string | string[]) {
      headers[name] = value;
    },

    /**
     * getHeader: レスポンスヘッダーを取得
     *
     * @param name - ヘッダー名
     * @returns ヘッダー値（未設定の場合はundefined）
     */
    getHeader(name: string) {
      return headers[name];
    },

    /**
     * removeHeader: レスポンスヘッダーを削除
     *
     * @param name - ヘッダー名
     */
    removeHeader(name: string) {
      delete headers[name];
    },

    /**
     * status: ステータスコードを設定（fluent interface用）
     *
     * @param code - HTTPステータスコード（200, 404, 500など）
     * @returns responseオブジェクト自身（メソッドチェーン用）
     *
     * 使用例: response.status(404).end()
     */
    status(code: number) {
      statusCode = code;
      return response;
    },

    /**
     * write: レスポンスボディにデータを書き込む
     *
     * @param chunk - 書き込むデータ（BufferまたはString）
     * @returns 常にtrue（backpressureは考慮しない簡易実装）
     *
     * データはchunks配列にバッファとして追加される
     */
    write(chunk: Buffer | string) {
      chunks.push(Buffer.from(chunk));
      return true;
    },

    /**
     * end: レスポンスを終了する
     *
     * @param chunk - 最後に書き込むデータ（オプション）
     *
     * 動作：
     * 1. chunkがあれば最後に追加
     * 2. headersSentフラグをtrueに設定
     */
    end(chunk?: Buffer | string) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      headersSent = true;
    },

    /**
     * writeHead: ステータスコードとヘッダーを一度に設定
     *
     * @param code - HTTPステータスコード
     * @param responseHeaders - レスポンスヘッダー（オプション）
     *
     * HTTP/1.1ではステータスラインとヘッダーは最初に送信される
     * この関数を呼ぶとheadersSentがtrueになる
     */
    writeHead(
      code: number,
      responseHeaders?: Record<string, string | string[]>
    ) {
      statusCode = code;
      if (responseHeaders) {
        Object.assign(headers, responseHeaders);
      }
      headersSent = true;
    },

    /**
     * headersSent getter: ヘッダーが送信済みかどうか
     *
     * @returns ヘッダー送信済みならtrue
     *
     * ヘッダー送信後は新たなヘッダーを設定できない
     */
    get headersSent() {
      return headersSent;
    },
  } as unknown as ServerResponse;

  /**
   * getResponse: 蓄積されたレスポンスデータをNextResponseに変換
   *
   * @returns NextResponseオブジェクト
   *
   * 変換の流れ：
   * 1. chunksを結合してボディを作成
   * 2. headersをNext.js Headersオブジェクトに変換
   * 3. NextResponseを生成して返す
   */
  const getResponse = async (): Promise<NextResponse> => {
    // 1. ボディデータを結合
    // 複数のchunkがある場合はBuffer.concatで結合
    const body =
      chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : undefined;

    // 2. ヘッダーをNext.js Headers形式に変換
    // Record<string, string | string[]> から [key, value][] の配列へ
    const headerEntries: [string, string][] = [];
    Object.entries(headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // 配列の場合は各要素を個別に追加
        value.forEach((v) => headerEntries.push([key, v]));
      } else {
        // 文字列の場合はそのまま追加
        headerEntries.push([key, value]);
      }
    });

    // 3. NextResponseを生成
    return new NextResponse(body, {
      status: statusCode,
      headers: new Headers(headerEntries),
    });
  };

  return { response, getResponse };
}

/**
 * CORSヘッダーを設定する関数
 *
 * @param response - NextResponseオブジェクト
 * @returns CORSヘッダーが追加されたNextResponseオブジェクト
 *
 * 設定されるヘッダー：
 * - Access-Control-Allow-Origin: リクエストを許可するオリジン
 * - Access-Control-Allow-Methods: 許可するHTTPメソッド
 * - Access-Control-Allow-Headers: 許可するヘッダー
 * - Access-Control-Expose-Headers: クライアントに公開するヘッダー
 *
 * CORS（Cross-Origin Resource Sharing）とは：
 * 異なるオリジン（ドメイン、プロトコル、ポート）からのリクエストを
 * 許可するための仕組み。Web版ChatGPTからの接続に必要。
 *
 * セキュリティ考慮事項：
 * - 現在は "*" で全オリジンを許可（開発・テスト用）
 * - 本番環境では特定のオリジンに制限することを推奨
 *   例: "https://chatgpt.com"
 */
export function setCorsHeaders(response: NextResponse): NextResponse {
  /**
   * Access-Control-Allow-Origin
   * どのオリジンからのリクエストを許可するか
   *
   * "*" = すべてのオリジンを許可
   * 本番環境では具体的なドメインを指定することを推奨
   */
  response.headers.set("Access-Control-Allow-Origin", "*");

  /**
   * Access-Control-Allow-Methods
   * 許可するHTTPメソッドのリスト
   *
   * - GET: セッション状態確認
   * - POST: MCPリクエスト（initialize, tools/call など）
   * - DELETE: セッション削除
   * - OPTIONS: プリフライトリクエスト
   */
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS"
  );

  /**
   * Access-Control-Allow-Headers
   * クライアントが送信できるヘッダーのリスト
   *
   * - Content-Type: リクエストボディの形式（application/json）
   * - Mcp-Session-Id: MCPセッション識別子
   * - Authorization: 将来の認証機能用（Bearer トークンなど）
   */
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Authorization"
  );

  /**
   * Access-Control-Expose-Headers
   * クライアントがJavaScriptでアクセスできるヘッダーのリスト
   *
   * - Mcp-Session-Id: セッション識別子をクライアントに公開
   *   クライアントはこの値を取得して次回以降のリクエストで使用
   */
  response.headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id");

  return response;
}
