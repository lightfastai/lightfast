import {
  NATIVE_AUTH_SCHEMA_VERSION,
  type NativeOAuthConfig,
  type NativeSession,
  type NativeSessionMetadata,
  type TokenSet,
} from "@repo/native-auth-contract";

import {
  createLightfastAppClient,
  type LightfastAppClientError,
} from "./app-client";
import { openBrowser as defaultOpenBrowser } from "./browser";
import { getAppUrl as defaultGetAppUrl } from "./config";
import {
  assertNativeOAuthState,
  buildLoopbackRedirectUri,
  buildNativeAuthStartUrl,
  buildCodeChallenge as defaultBuildCodeChallenge,
  createCodeVerifier as defaultCreateCodeVerifier,
  createStateNonce as defaultCreateStateNonce,
  startLoopbackServer as defaultStartLoopbackServer,
} from "./oauth";
import type { SessionStoreLike } from "./session";
import { SessionStore } from "./store";
import { exchangeAuthorizationCode as defaultExchangeAuthorizationCode } from "./token-client";

interface LightfastAuthClient {
  finalizeNativeAuth: (input: {
    accessToken: string;
    attemptId: string;
    state: string;
  }) => Promise<NativeSessionMetadata>;
  getOAuthConfig: () => Promise<NativeOAuthConfig>;
}

interface Loopback {
  close: () => Promise<void>;
  port: number;
  waitForCallback: () => Promise<{ code: string; state: string }>;
}

async function closeLoopbackQuietly(loopback: Loopback): Promise<void> {
  try {
    await loopback.close();
  } catch {
    // Preserve the primary login failure; cleanup failures are secondary here.
  }
}

export interface LoginFlowDeps {
  buildCodeChallenge?: (verifier: string) => string;
  createAppClient?: (input: { appUrl: string }) => LightfastAuthClient;
  createCodeVerifier?: () => string;
  createStateNonce?: () => string;
  exchangeAuthorizationCode?: (input: {
    code: string;
    codeVerifier: string;
    config: NativeOAuthConfig;
    redirectUri: string;
  }) => Promise<TokenSet>;
  getAppUrl?: () => string;
  openBrowser?: (url: string) => Promise<void> | void;
  startLoopbackServer?: (input: {
    expectedStateNonce: string;
    successHtmlTitle: string;
  }) => Promise<Loopback>;
  store?: SessionStoreLike;
}

export async function login(
  input: { deps?: LoginFlowDeps } = {}
): Promise<NativeSession> {
  const deps = input.deps ?? {};
  const appUrl = (deps.getAppUrl ?? defaultGetAppUrl)();
  const client =
    deps.createAppClient?.({ appUrl }) ?? createLightfastAppClient({ appUrl });
  const store = deps.store ?? new SessionStore();
  const config = await client.getOAuthConfig();
  const codeVerifier = (deps.createCodeVerifier ?? defaultCreateCodeVerifier)();
  const codeChallenge = (deps.buildCodeChallenge ?? defaultBuildCodeChallenge)(
    codeVerifier
  );
  const stateNonce = (deps.createStateNonce ?? defaultCreateStateNonce)();
  const loopback = await (
    deps.startLoopbackServer ?? defaultStartLoopbackServer
  )({
    expectedStateNonce: stateNonce,
    successHtmlTitle: "Lightfast CLI",
  });
  let closeAttempted = false;

  try {
    const redirectUri = buildLoopbackRedirectUri(loopback.port);
    const startUrl = buildNativeAuthStartUrl({
      appUrl,
      client: "cli",
      codeChallenge,
      redirectUri,
      stateNonce,
    });
    await (deps.openBrowser ?? defaultOpenBrowser)(startUrl);
    const callback = await loopback.waitForCallback();
    const state = assertNativeOAuthState({
      expectedNonce: stateNonce,
      state: callback.state,
    });
    const tokens = await (
      deps.exchangeAuthorizationCode ?? defaultExchangeAuthorizationCode
    )({
      code: callback.code,
      codeVerifier,
      config,
      redirectUri,
    });
    const metadata = await client.finalizeNativeAuth({
      accessToken: tokens.accessToken,
      attemptId: state.attemptId,
      state: callback.state,
    });
    const storedSession: NativeSession = {
      appUrl,
      client: "cli",
      oauth: {
        clientId: config.clientId,
        issuer: config.issuer,
      },
      organization: metadata.organization,
      schemaVersion: NATIVE_AUTH_SCHEMA_VERSION,
      tokens,
      user: metadata.user,
    };
    await store.set(storedSession);
    closeAttempted = true;
    await loopback.close();
    return storedSession;
  } catch (error) {
    if (!closeAttempted) {
      await closeLoopbackQuietly(loopback);
    }
    throw error;
  }
}

export type { LightfastAppClientError };
