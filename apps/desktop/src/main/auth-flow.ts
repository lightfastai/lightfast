import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import * as Sentry from "@sentry/electron/main";
import { shell } from "electron";
import { z } from "zod";
import { setToken } from "./auth-store";

const SIGNIN_TIMEOUT_MS = 5 * 60_000;
const LOOPBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/callback";
const MAX_BODY_BYTES = 16 * 1024;

const callbackBodySchema = z.object({
  token: z.string().min(1),
  state: z.string().min(1),
});

function getApiOrigin(): string {
  return (
    process.env.LIGHTFAST_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://lightfast.ai"
      : "http://localhost:3024")
  );
}

const ALLOWED_ORIGIN = getApiOrigin();

console.log("[auth-flow] ALLOWED_ORIGIN =", ALLOWED_ORIGIN);

function applyCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      req.destroy();
      throw new Error("payload too large");
    }
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
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

let inflight: Promise<string | null> | null = null;

export function beginSignIn(): Promise<string | null> {
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      return await runSignIn();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function runSignIn(): Promise<string | null> {
  const state = randomBytes(32).toString("hex");

  let bound: { server: Server; port: number };
  try {
    bound = await startLoopbackServer();
  } catch (error) {
    console.error("[auth-flow] loopback bind failed", error);
    Sentry.captureException(error, { tags: { scope: "auth-flow.bind" } });
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
      resolve(token);
    };

    const timer = setTimeout(() => {
      Sentry.captureMessage("auth-flow: sign-in timeout", {
        level: "warning",
        tags: { scope: "auth-flow.timeout" },
      });
      settle(null);
    }, SIGNIN_TIMEOUT_MS);

    server.on("request", async (req, res) => {
      try {
        const origin = req.headers.origin ?? "";
        if (origin !== ALLOWED_ORIGIN) {
          Sentry.captureMessage("auth-flow: forbidden origin", {
            level: "warning",
            tags: { scope: "auth-flow.forbidden_origin" },
          });
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden origin");
          return;
        }
        const url = new URL(req.url ?? "/", `http://${LOOPBACK_HOST}:${port}`);
        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        if (req.method === "OPTIONS") {
          applyCors(res);
          res.writeHead(204);
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "text/plain", Allow: "POST" });
          res.end("Method Not Allowed");
          return;
        }

        applyCors(res);
        const body = await readJsonBody(req);
        const parsed = callbackBodySchema.safeParse(body);
        if (!parsed.success) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, reason: "bad_request" }));
          settle(null);
          return;
        }
        const { token, state: returned } = parsed.data;
        if (returned !== state) {
          Sentry.captureMessage("auth-flow: state mismatch", {
            level: "warning",
            tags: { scope: "auth-flow.state_mismatch" },
          });
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, reason: "state_mismatch" }));
          settle(null);
          return;
        }
        const persisted = setToken(token);
        if (!persisted) {
          Sentry.captureException(new Error("auth-flow: persist failed"), {
            tags: { scope: "auth-flow.persist_failed" },
          });
        }
        res.writeHead(persisted ? 204 : 500, {
          "Content-Type": "application/json",
        });
        res.end(
          persisted
            ? ""
            : JSON.stringify({ ok: false, reason: "persist_failed" })
        );
        settle(persisted ? token : null);
      } catch (error) {
        console.error("[auth-flow] loopback handler error", error);
        Sentry.captureException(error, {
          tags: { scope: "auth-flow.handler_error" },
        });
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        settle(null);
      }
    });

    server.on("error", (error) => {
      console.error("[auth-flow] loopback server error", error);
      Sentry.captureException(error, {
        tags: { scope: "auth-flow.server_error" },
      });
      settle(null);
    });

    const signInUrl = new URL("/desktop/auth", ALLOWED_ORIGIN);
    signInUrl.searchParams.set("state", state);
    signInUrl.searchParams.set("callback", callbackUrl);

    console.log(
      `[auth-flow] signin url=${signInUrl.toString()} callback=${callbackUrl}`
    );

    shell.openExternal(signInUrl.toString()).catch((error) => {
      console.error("[auth-flow] shell.openExternal failed", error);
      Sentry.captureException(error, {
        tags: { scope: "auth-flow.open_external" },
      });
      settle(null);
    });
  });
}
