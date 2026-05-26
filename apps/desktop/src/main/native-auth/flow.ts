import {
  NATIVE_AUTH_SCHEMA_VERSION,
  type NativeSession,
} from "@repo/native-auth-contract";
import {
  assertNativeOAuthState,
  buildCodeChallenge,
  buildLoopbackRedirectUri,
  createCodeVerifier,
  createStateNonce,
  exchangeAuthorizationCode,
  startLoopbackServer,
} from "@repo/native-auth-node";
import { shell } from "electron";
import { logger } from "../logger";
import { getRuntimeConfig } from "../runtime-config";
import { createDesktopNativeAuthClient } from "./app-client";
import { getSession, setSession } from "./store";

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

function buildNativeAuthStartUrl(input: {
  appUrl: string;
  codeChallenge: string;
  redirectUri: string;
  stateNonce: string;
}): string {
  const url = new URL("/oauth/desktop/start", input.appUrl);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.stateNonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function isExpiredToken(expiresAt: number): boolean {
  return expiresAt <= Date.now();
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

export function maybeAutoBeginSignIn(): void {
  if (!isAgentMode()) {
    return;
  }
  if (getSession()) {
    emitAgentEvent({ event: "auth_already_signed_in" });
    return;
  }
  void beginSignIn();
}

async function runSignIn(): Promise<string | null> {
  const appUrl = getRuntimeConfig().appOrigin;
  const client = createDesktopNativeAuthClient();
  const config = await client.getOAuthConfig();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = buildCodeChallenge(codeVerifier);
  const stateNonce = createStateNonce();
  const loopback = await startLoopbackServer({
    expectedStateNonce: stateNonce,
    successHtmlTitle: "Lightfast Desktop",
    timeoutMs: getSigninTimeoutMs(),
  });

  try {
    const redirectUri = buildLoopbackRedirectUri(loopback.port);
    const signinUrl = buildNativeAuthStartUrl({
      appUrl,
      codeChallenge,
      redirectUri,
      stateNonce,
    });
    setPendingSigninUrl(signinUrl);
    emitAgentEvent({ event: "auth_signin_url", url: signinUrl });
    if (!isAgentMode()) {
      await shell.openExternal(signinUrl);
    }
    const callback = await loopback.waitForCallback();
    const envelope = assertNativeOAuthState({
      expectedNonce: stateNonce,
      state: callback.state,
    });
    const tokens = await exchangeAuthorizationCode({
      code: callback.code,
      codeVerifier,
      config,
      redirectUri,
    });
    if (isExpiredToken(tokens.expiresAt)) {
      throw new Error("Native auth token expired");
    }
    const metadata = await client.finalize({
      accessToken: tokens.accessToken,
      attemptId: envelope.attemptId,
      state: callback.state,
    });
    const session: NativeSession = {
      appUrl,
      client: "desktop",
      oauth: { clientId: config.clientId, issuer: config.issuer },
      organization: metadata.organization,
      schemaVersion: NATIVE_AUTH_SCHEMA_VERSION,
      tokens,
      user: metadata.user,
    };
    if (!setSession(session)) {
      emitAgentEvent({ event: "auth_signin_failed", reason: "persist_failed" });
      return null;
    }
    emitAgentEvent({ event: "auth_signed_in" });
    return tokens.accessToken;
  } catch (error) {
    logger.error("[native-auth] sign-in failed", error);
    emitAgentEvent({ event: "auth_signin_failed", reason: "handler_error" });
    return null;
  } finally {
    try {
      await loopback.close();
    } catch (error) {
      logger.warn("[native-auth] loopback close failed", error);
    }
  }
}
