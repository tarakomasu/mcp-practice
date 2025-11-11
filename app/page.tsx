export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 font-sans dark:from-zinc-900 dark:to-black">
      <main className="flex w-full max-w-4xl flex-col gap-8 py-16 px-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            日本語文字数カウント MCP サーバー
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            Web版ChatGPTの「新しいコネクター」から接続できるMCPサーバー
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-800/50">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              🚀 エンドポイント
            </h2>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-4 font-mono text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  開発環境:
                </span>
                <br />
                <span className="text-zinc-900 dark:text-zinc-50">
                  http://localhost:3000/api/mcp
                </span>
              </div>
              <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-4 font-mono text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  本番環境:
                </span>
                <br />
                <span className="text-zinc-900 dark:text-zinc-50">
                  https://your-project.vercel.app/api/mcp
                </span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              ✨ 機能
            </h2>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                countJapaneseChars
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                日本語テキストの文字数（グラフェム単位）を正確にカウントします。
                サロゲートペアや結合文字、絵文字も適切に処理します。
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              📝 使用例
            </h2>
            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-100 dark:bg-zinc-900 p-4">
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                  入力:
                </div>
                <code className="text-zinc-900 dark:text-zinc-50">
                  &quot;こんにちは、世界！👋🇯🇵&quot;
                </code>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-800">
                <div className="text-sm text-green-700 dark:text-green-300 mb-2">
                  出力:
                </div>
                <code className="text-green-900 dark:text-green-100">
                  文字数: 11
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            className="flex h-12 items-center justify-center rounded-xl bg-zinc-900 px-6 text-zinc-50 font-medium transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            href="https://github.com/modelcontextprotocol"
            target="_blank"
            rel="noopener noreferrer"
          >
            📚 MCP Documentation
          </a>
          <a
            className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-700 px-6 font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            🚀 Deploy to Vercel
          </a>
        </div>

        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Powered by Next.js 16 + @modelcontextprotocol/sdk
        </div>
      </main>
    </div>
  );
}
