import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { shell } from "electron";
import { createAppUrl } from "./app-url";
import { setToken } from "./auth-store";

const SIGNIN_TIMEOUT_MS = 5 * 60_000;
const LOOPBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/callback";

function responsePage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Lightfast</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html, body { height: 100%; margin: 0; }
      body {
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        background: #0a0a0a; color: #e5e5e5;
      }
      .card { text-align: center; padding: 2rem; max-width: 28rem; }
      h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { color: #a3a3a3; margin: 0; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${message}</h1>
      <p>You can close this tab and return to Lightfast.</p>
    </div>
  </body>
</html>`;
}

async function startLoopbackServer(): Promise<{
  server: Server;
  port: number;
}> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, LOOPBACK_HOST);
  });
  const address = server.address();
  if (!address || typeof address !== "object") {
    server.close();
    throw new Error("loopback server failed to bind");
  }
  return { server, port: address.port };
}

export async function beginSignIn(): Promise<string | null> {
  const state = randomBytes(32).toString("hex");

  let bound: { server: Server; port: number };
  try {
    bound = await startLoopbackServer();
  } catch (error) {
    console.error("[auth-flow] loopback bind failed", error);
    return null;
  }
  const { server, port } = bound;
  const callbackUrl = `http://${LOOPBACK_HOST}:${port}${CALLBACK_PATH}`;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const settle = (token: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      server.close();
      if (token) {
        setToken(token);
      }
      resolve(token);
    };

    const timer = setTimeout(() => settle(null), SIGNIN_TIMEOUT_MS);

    server.on("request", (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://${LOOPBACK_HOST}:${port}`);
        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        const token = url.searchParams.get("token");
        const returned = url.searchParams.get("state");
        const ok = !!token && returned === state;
        res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html" });
        res.end(responsePage(ok ? "Signed in to Lightfast" : "Sign-in failed"));
        settle(ok ? token : null);
      } catch (error) {
        console.error("[auth-flow] loopback handler error", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        settle(null);
      }
    });

    server.on("error", (error) => {
      console.error("[auth-flow] loopback server error", error);
      settle(null);
    });

    const signInUrl = createAppUrl("/desktop/auth");
    signInUrl.searchParams.set("state", state);
    signInUrl.searchParams.set("callback", callbackUrl);

    console.log(
      `[auth-flow] signin url=${signInUrl.toString()} callback=${callbackUrl}`
    );

    shell.openExternal(signInUrl.toString()).catch((error) => {
      console.error("[auth-flow] shell.openExternal failed", error);
      settle(null);
    });
  });
}
