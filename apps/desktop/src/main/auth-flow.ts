import { createHash, randomBytes } from "node:crypto";
import * as Sentry from "@sentry/electron/main";
import { shell } from "electron";
import { z } from "zod";
import { getToken, setToken } from "./auth-store";
import { getProtocolScheme, onProtocolUrl } from "./protocol";

const DEFAULT_SIGNIN_TIMEOUT_MS = 5 * 60_000;

function getSigninTimeoutMs(): number {
  const raw = process.env.LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_SIGNIN_TIMEOUT_MS;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SIGNIN_TIMEOUT_MS;
}

function isAgentMode(): boolean {
  return process.env.LIGHTFAST_DESKTOP_AGENT_MODE === "1";
}

type AuthEvent =
  | { event: "auth_already_signed_in" }
  | { event: "auth_signin_url"; url: string }
  | { event: "auth_signed_in" }
  | { event: "auth_signin_failed"; reason: string };

function emitAgentEvent(payload: AuthEvent): void {
  if (!isAgentMode()) {
    return;
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getApiOrigin(): string {
  return (
    process.env.LIGHTFAST_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://lightfast.ai"
      : "http://localhost:3024")
  );
}

const callbackSchema = z.object({
  code: z.string().min(32).max(128),
  state: z.string().min(16).max(256),
});

const exchangeResponseSchema = z.object({ token: z.string().min(1) });

let inflight: Promise<string | null> | null = null;
let pendingSigninUrl: string | null = null;
const urlListeners = new Set<(url: string | null) => void>();

export function getPendingSigninUrl(): string | null {
  return pendingSigninUrl;
}

export function onPendingSigninUrl(
  listener: (url: string | null) => void
): () => void {
  urlListeners.add(listener);
  return () => urlListeners.delete(listener);
}

function setPendingSigninUrl(url: string | null): void {
  pendingSigninUrl = url;
  for (const listener of urlListeners) {
    listener(url);
  }
}

export function beginSignIn(): Promise<string | null> {
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      return await runSignIn();
    } finally {
      inflight = null;
      setPendingSigninUrl(null);
    }
  })();
  return inflight;
}

// Auto-trigger sign-in for agent mode on app-ready. Idempotent — when a
// token is already persisted, emits auth_already_signed_in instead of
// re-running the flow. No-op outside AGENT_MODE.
export function maybeAutoBeginSignIn(): void {
  if (!isAgentMode()) {
    return;
  }
  if (getToken()) {
    emitAgentEvent({ event: "auth_already_signed_in" });
    return;
  }
  void beginSignIn();
}

function matchesAuthCallback(rawUrl: string, scheme: string): boolean {
  if (!rawUrl.startsWith(`${scheme}://`)) {
    return false;
  }
  // Node's URL parser handles custom schemes inconsistently across platforms
  // (host="auth"+pathname="/callback" vs. host=""+pathname="//auth/callback").
  // Normalize by concatenating and stripping leading slashes.
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const path = `${url.host}${url.pathname}`.replace(/^\/+/, "");
  return path === "auth/callback";
}

async function runSignIn(): Promise<string | null> {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const scheme = getProtocolScheme();
  const redirectUri = `${scheme}://auth/callback`;

  const apiOrigin = getApiOrigin();
  const signinUrl = new URL("/desktop/auth", apiOrigin);
  signinUrl.searchParams.set("state", state);
  signinUrl.searchParams.set("code_challenge", codeChallenge);
  signinUrl.searchParams.set("code_challenge_method", "S256");
  signinUrl.searchParams.set("redirect_uri", redirectUri);

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const settle = (token: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(token);
    };

    const timer = setTimeout(() => {
      Sentry.captureMessage("auth-flow: sign-in timeout", {
        level: "warning",
        tags: { scope: "auth-flow.timeout" },
      });
      emitAgentEvent({ event: "auth_signin_failed", reason: "timeout" });
      settle(null);
    }, getSigninTimeoutMs());

    const unsubscribe = onProtocolUrl(async (rawUrl) => {
      try {
        if (!matchesAuthCallback(rawUrl, scheme)) {
          return;
        }
        const url = new URL(rawUrl);
        const parsed = callbackSchema.safeParse({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });
        if (!parsed.success) {
          return;
        }
        if (parsed.data.state !== state) {
          Sentry.captureMessage("auth-flow: state mismatch", {
            level: "warning",
            tags: { scope: "auth-flow.state_mismatch" },
          });
          return;
        }
        const token = await exchangeCode(
          apiOrigin,
          parsed.data.code,
          codeVerifier
        );
        if (!token) {
          emitAgentEvent({
            event: "auth_signin_failed",
            reason: "exchange_failed",
          });
          settle(null);
          return;
        }
        const persisted = setToken(token);
        if (!persisted) {
          Sentry.captureException(new Error("auth-flow: persist failed"), {
            tags: { scope: "auth-flow.persist_failed" },
          });
          emitAgentEvent({
            event: "auth_signin_failed",
            reason: "persist_failed",
          });
          settle(null);
          return;
        }
        emitAgentEvent({ event: "auth_signed_in" });
        settle(token);
      } catch (error) {
        console.error("[auth-flow] callback handler error", error);
        Sentry.captureException(error, {
          tags: { scope: "auth-flow.handler_error" },
        });
        emitAgentEvent({
          event: "auth_signin_failed",
          reason: "handler_error",
        });
        settle(null);
      }
    });

    setPendingSigninUrl(signinUrl.toString());

    if (isAgentMode()) {
      // Agent harnesses (e.g. Claude Code via agent-browser) parse a single
      // structured line off stdout instead of the system-default browser. Pair
      // with AGENT_BROWSER_HEADED=true on the agent side — headless Chromium
      // silently drops custom-scheme navigations (validated 2026-04-25 spike).
      emitAgentEvent({ event: "auth_signin_url", url: signinUrl.toString() });
      return;
    }

    shell.openExternal(signinUrl.toString()).catch((error) => {
      console.error("[auth-flow] shell.openExternal failed", error);
      Sentry.captureException(error, {
        tags: { scope: "auth-flow.open_external" },
      });
      settle(null);
    });
  });
}

async function exchangeCode(
  apiOrigin: string,
  code: string,
  codeVerifier: string
): Promise<string | null> {
  try {
    const response = await fetch(`${apiOrigin}/api/desktop/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
    });
    if (!response.ok) {
      Sentry.captureMessage("auth-flow: exchange non-ok", {
        level: "warning",
        tags: {
          scope: "auth-flow.exchange_non_ok",
          status: String(response.status),
        },
      });
      return null;
    }
    const json = exchangeResponseSchema.safeParse(await response.json());
    return json.success ? json.data.token : null;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { scope: "auth-flow.exchange_network" },
    });
    return null;
  }
}
