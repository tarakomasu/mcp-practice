import { NextRequest, NextResponse } from "next/server";
import { IncomingMessage, ServerResponse } from "http";
import { createRequest, createResponse } from "node-mocks-http";
import { EventEmitter } from "events";

export function createIncomingMessage(
  req: NextRequest,
  body?: unknown
): IncomingMessage {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const mockReq = createRequest({
    method: req.method as any,
    url: req.url,
    headers: headers,
  });

  // node-mocks-httpのストリームにデータを書き込む
  if (body) {
    mockReq.write(JSON.stringify(body));
  }
  // ストリームの終わりを通知
  mockReq.end();

  return mockReq;
}

export function createServerResponse(): {
  response: ServerResponse;
  getResponse: () => Promise<NextResponse>;
} {
  // `createResponse` は EventEmitter を使ってイベントを処理する
  const mockRes = createResponse({
    eventEmitter: EventEmitter,
  });

  const getResponsePromise = new Promise<NextResponse>((resolve, reject) => {
    // 'end' イベントはレスポンスの送信が完了したときに発生する
    mockRes.on("end", () => {
      try {
        // _getData() でレスポンスボディを取得
        const body = mockRes._getData();
        const status = mockRes.statusCode;
        // getHeaders() でヘッダーを取得
        const headers = new Headers(
          mockRes.getHeaders() as Record<string, string>
        );

        resolve(new NextResponse(body, { status, headers }));
      } catch (error) {
        reject(error);
      }
    });

    // エラーイベントもハンドルする
    mockRes.on("error", (err: any) => {
      reject(err);
    });
  });

  return {
    response: mockRes,
    getResponse: () => getResponsePromise,
  };
}

export function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Authorization"
  );
  response.headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id");
  return response;
}
