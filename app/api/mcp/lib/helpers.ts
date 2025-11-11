import { NextRequest, NextResponse } from "next/server";
import { IncomingMessage, ServerResponse } from "http";
import { Readable, PassThrough, Duplex } from "stream";
import { Socket } from "net";

export function createIncomingMessage(
  req: NextRequest,
  body?: unknown
): IncomingMessage {
  const headers: Record<string, string | string[]> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const bodyString = body ? JSON.stringify(body) : "";
  const bodyBuffer = Buffer.from(bodyString, "utf-8");

  let pushed = false;

  // Create a custom Readable stream that pushes data when requested
  const stream = new Readable({
    read() {
      if (!pushed) {
        this.push(bodyBuffer);
        this.push(null); // Signal end of stream
        pushed = true;
      }
    },
  });

  const incomingMessage = stream as any;

  // Set HTTP properties directly without overwriting stream methods
  incomingMessage.headers = headers;
  incomingMessage.method = req.method;
  incomingMessage.url = req.url;
  incomingMessage.httpVersion = "1.1";
  incomingMessage.httpVersionMajor = 1;
  incomingMessage.httpVersionMinor = 1;
  incomingMessage.aborted = false;
  incomingMessage.complete = false;
  incomingMessage.socket = {
    remoteAddress: "127.0.0.1",
    remotePort: 0,
    encrypted: false,
  };
  incomingMessage.connection = null;

  // Mark as complete when stream ends
  stream.on("end", () => {
    incomingMessage.complete = true;
  });

  return incomingMessage as IncomingMessage;
}

export function createServerResponse(): {
  response: ServerResponse;
  getResponse: () => Promise<NextResponse>;
} {
  let statusCode = 200;
  const headers: Record<string, string | string[]> = {};
  const chunks: Buffer[] = [];
  let headersSent = false;

  // Promise to wait for response.end() to be called
  let resolveResponse: (value: NextResponse) => void;
  const responsePromise = new Promise<NextResponse>((resolve) => {
    resolveResponse = resolve;
  });

  const response: any = {
    statusCode: 200,
    statusMessage: "OK",

    setHeader(name: string, value: string | string[]) {
      headers[name] = value;
      return response;
    },

    getHeader(name: string) {
      return headers[name];
    },

    getHeaders() {
      return { ...headers };
    },

    hasHeader(name: string) {
      return name in headers;
    },

    removeHeader(name: string) {
      delete headers[name];
    },

    write(
      chunk: Buffer | string,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void
    ): boolean {
      chunks.push(Buffer.from(chunk));

      const cb =
        typeof encodingOrCallback === "function"
          ? encodingOrCallback
          : callback;
      if (cb) {
        cb();
      }
      return true;
    },

    end(
      chunkOrCallback?: Buffer | string | (() => void),
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void
    ): any {
      let chunk: Buffer | string | undefined;
      let cb: (() => void) | undefined;

      if (typeof chunkOrCallback === "function") {
        cb = chunkOrCallback;
      } else {
        chunk = chunkOrCallback;
        if (typeof encodingOrCallback === "function") {
          cb = encodingOrCallback;
        } else {
          cb = callback;
        }
      }

      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      headersSent = true;

      // Build the response and resolve the promise
      const body =
        chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : undefined;
      const headerEntries: [string, string][] = [];
      Object.entries(headers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => headerEntries.push([key, v]));
        } else {
          headerEntries.push([key, value]);
        }
      });

      const nextResponse = new NextResponse(body, {
        status: statusCode,
        headers: new Headers(headerEntries),
      });

      // Resolve the promise with the response
      resolveResponse(nextResponse);

      if (cb) {
        cb();
      }

      return response;
    },

    writeHead(
      code: number,
      messageOrHeaders?: string | Record<string, string | string[]>,
      responseHeaders?: Record<string, string | string[]>
    ) {
      statusCode = code;
      response.statusCode = code;

      if (typeof messageOrHeaders === "string") {
        response.statusMessage = messageOrHeaders;
        if (responseHeaders) {
          Object.assign(headers, responseHeaders);
        }
      } else if (messageOrHeaders) {
        Object.assign(headers, messageOrHeaders);
      }

      headersSent = true;
      return response;
    },

    get headersSent() {
      return headersSent;
    },

    writableEnded: false,
    writableFinished: false,
    socket: null,
    connection: null,
  };

  // getResponse now returns the promise that will be resolved when end() is called
  const getResponse = () => responsePromise;

  return { response: response as unknown as ServerResponse, getResponse };
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
