/**
 * MCPサーバーセットアップモジュール
 *
 * このモジュールは、Model Context Protocol (MCP) サーバーのインスタンスを
 * 作成し、利用可能なツールを登録する責務を持ちます。
 *
 * Model Context Protocol (MCP) とは：
 * - AIアシスタント（ChatGPTなど）がツールやリソースにアクセスするための標準プロトコル
 * - JSON-RPCベースの通信プロトコル
 * - サーバー/クライアントモデルで動作
 *
 * アーキテクチャ：
 * - McpServer: ツールやリソースを管理するサーバーインスタンス
 * - Tool: AIが呼び出せる関数（例: 文字数カウント、データ検索など）
 * - Transport: 通信層（HTTP、SSE、stdioなど）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  countJapaneseCharsToolConfig,
  countJapaneseCharsHandler,
} from "../tools/countJapaneseChars";

/**
 * MCPサーバーのインスタンスを作成し、ツールを登録する関数
 *
 * @returns 設定済みのMcpServerインスタンス
 *
 * この関数は：
 * 1. サーバーの基本情報を設定
 * 2. サーバーの機能（capabilities）を宣言
 * 3. 利用可能なツールを登録
 *
 * 注意：
 * - この関数は各セッションごとに呼び出される
 * - セッション間でサーバーインスタンスは共有されない
 * - ステートレスな設計により、スケーラビリティを確保
 */
export function createMcpServer(): McpServer {
  /**
   * McpServerインスタンスの作成
   *
   * 第1引数: サーバーの識別情報
   * - name: サーバーの一意な名前（クライアントに表示される）
   * - version: サーバーのバージョン（セマンティックバージョニング推奨）
   *
   * 第2引数: サーバーの設定
   * - capabilities: サーバーが提供する機能のリスト
   */
  const server = new McpServer(
    {
      /**
       * name: サーバーの識別名
       *
       * 命名規則：
       * - kebab-case推奨
       * - 説明的で一意な名前
       * - 組織名やプロジェクト名を含めることを推奨
       *
       * 例: "acme-corp-data-analyzer", "github-issue-tracker"
       */
      name: "japanese-char-counter",

      /**
       * version: サーバーのバージョン
       *
       * セマンティックバージョニング（SemVer）形式:
       * - MAJOR.MINOR.PATCH
       * - MAJOR: 互換性のない変更
       * - MINOR: 後方互換性のある機能追加
       * - PATCH: 後方互換性のあるバグ修正
       *
       * クライアントはこのバージョンで互換性を判断
       */
      version: "1.0.0",
    },
    {
      /**
       * capabilities: サーバーが提供する機能
       *
       * MCPプロトコルでは以下の機能をサポート可能：
       * - tools: AIが呼び出せる関数
       * - resources: AIが読み取れるデータソース
       * - prompts: 事前定義されたプロンプトテンプレート
       *
       * 空オブジェクト {} = 基本機能のみを有効化
       * registerToolを呼ぶと自動的にtools capabilityが有効になる
       */
      capabilities: {
        /**
         * tools: ツール機能を有効化
         *
         * 空オブジェクトでも、registerToolを呼ぶことで
         * サーバーは自動的にtools capabilityを持つ
         */
        tools: {},

        // 将来的に追加可能な機能：
        // resources: {}, // ファイルやデータソースへのアクセス
        // prompts: {},   // プロンプトテンプレート
      },
    }
  );

  /**
   * countJapaneseCharsツールの登録
   *
   * registerTool()は以下の引数を取る：
   * 1. ツール名（文字列）
   * 2. ツール設定（メタデータ、スキーマなど）
   * 3. ハンドラー関数（実際の処理）
   *
   * ツール登録の流れ：
   * 1. クライアントが tools/list を呼ぶと登録済みツール一覧を返す
   * 2. クライアントが tools/call でツールを呼ぶ
   * 3. サーバーがスキーマで引数を検証
   * 4. ハンドラー関数を実行
   * 5. 結果をクライアントに返す
   */
  server.registerTool(
    /**
     * 第1引数: ツール名
     * クライアントがこの名前でツールを呼び出す
     */
    countJapaneseCharsToolConfig.name,

    /**
     * 第2引数: ツール設定
     *
     * 含まれる情報：
     * - title: ツールの表示名
     * - description: ツールの説明（AIがツール選択時に参照）
     * - inputSchema: 引数のZodスキーマ
     * - annotations: ツールの特性（readOnlyなど）
     */
    {
      title: countJapaneseCharsToolConfig.title,
      description: countJapaneseCharsToolConfig.description,
      inputSchema: countJapaneseCharsToolConfig.inputSchema,
      annotations: countJapaneseCharsToolConfig.annotations,
    },

    /**
     * 第3引数: ハンドラー関数
     *
     * 引数：
     * - 検証済みの入力パラメータ（Zodスキーマに従う）
     *
     * 戻り値：
     * - content: クライアントに返すコンテンツの配列
     *   - type: "text" または "image" など
     *   - text/data: 実際のコンテンツ
     *
     * asyncを使用することで：
     * - 外部API呼び出し
     * - データベースクエリ
     * - ファイルI/O
     * などの非同期処理が可能
     */
    countJapaneseCharsHandler
  );

  /**
   * 複数のツールを登録する場合の例：
   *
   * server.registerTool(
   *   "anotherTool",
   *   {
   *     title: "別のツール",
   *     description: "他の機能を提供",
   *     inputSchema: {
   *       param1: z.string(),
   *     },
   *   },
   *   async ({ param1 }) => {
   *     // 処理
   *     return { content: [...] };
   *   }
   * );
   */

  /**
   * 設定済みのサーバーインスタンスを返す
   *
   * このサーバーは：
   * - Transportに接続される（StreamableHTTPServerTransport）
   * - クライアントからのJSON-RPCリクエストを処理
   * - 登録されたツールを実行
   */
  return server;
}
