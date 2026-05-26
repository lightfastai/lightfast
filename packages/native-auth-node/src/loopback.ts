import { createServer, type Server } from "node:http";

import { NATIVE_OAUTH_CALLBACK_PATH } from "@repo/native-auth-contract";

import { NativeAuthError } from "./errors";
import { assertNativeOAuthState } from "./oauth-state";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface LoopbackCallback {
  code: string;
  state: string;
}

export interface LoopbackServer {
  close: () => Promise<void>;
  port: number;
  waitForCallback: () => Promise<LoopbackCallback>;
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function html(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>Signed in to Lightfast.</body></html>`;
}

export async function startLoopbackServer(input: {
  expectedStateNonce: string;
  successHtmlTitle: string;
  timeoutMs?: number;
}): Promise<LoopbackServer> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let actualPort = 0;
  let closed = false;
  let settled = false;
  let resolveCallback!: (callback: LoopbackCallback) => void;
  let rejectCallback!: (error: Error) => void;

  const callbackPromise = new Promise<LoopbackCallback>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  callbackPromise.catch(() => undefined);

  const timer = setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    rejectCallback(
      new NativeAuthError(
        "OAUTH_TIMEOUT",
        "Timed out waiting for the browser authentication callback."
      )
    );
    void close();
  }, timeoutMs);
  timer.unref?.();

  const settleResolve = (callback: LoopbackCallback) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    resolveCallback(callback);
    void close();
  };

  const settleReject = (error: Error) => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(timer);
    rejectCallback(error);
    void close();
  };

  const server = createServer((req, res) => {
    const requestUrl = new URL(
      req.url ?? "/",
      `http://127.0.0.1:${actualPort}`
    );

    if (requestUrl.pathname !== NATIVE_OAUTH_CALLBACK_PATH) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }

    const state = requestUrl.searchParams.get("state");
    if (!state) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Missing state");
      settleReject(
        new NativeAuthError(
          "OAUTH_STATE_INVALID",
          "OAuth callback did not include state."
        )
      );
      return;
    }

    try {
      assertNativeOAuthState({
        expectedNonce: input.expectedStateNonce,
        state,
      });
    } catch (error) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Invalid state");
      settleReject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("OAuth error");
      settleReject(
        new NativeAuthError(
          "OAUTH_ERROR",
          `OAuth authorization failed: ${oauthError}`
        )
      );
      return;
    }

    const code = requestUrl.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Missing code");
      settleReject(
        new NativeAuthError(
          "OAUTH_MISSING_CODE",
          "OAuth callback did not include a code."
        )
      );
      return;
    }

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html(input.successHtmlTitle));
    settleResolve({ code, state });
  });

  async function close(): Promise<void> {
    if (closed) {
      return;
    }
    closed = true;
    clearTimeout(timer);
    await closeHttpServer(server);
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      clearTimeout(timer);
      reject(error);
    };
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      const address = server.address();
      if (!(address && typeof address === "object")) {
        reject(
          new NativeAuthError(
            "LOOPBACK_BIND_FAILED",
            "Loopback server did not expose a port."
          )
        );
        return;
      }
      actualPort = address.port;
      resolve();
    });
  });

  return {
    close,
    port: actualPort,
    waitForCallback: () => callbackPromise,
  };
}
