import type {
  NativeOAuthConfig,
  NativeSession,
  TokenSet,
} from "@repo/native-auth-contract";
import { NATIVE_AUTH_HEADERS } from "@repo/native-auth-contract";

import { CliAuthError } from "./errors";
import { refreshAccessToken } from "./token-client";

const EXPIRY_SKEW_MS = 60_000;

export interface SessionStoreLike {
  clear: () => Promise<void>;
  get: () => Promise<NativeSession | null>;
  set: (session: NativeSession) => Promise<void>;
}

export async function loadSession(
  store: SessionStoreLike
): Promise<NativeSession | null> {
  return store.get();
}

export async function clearSession(store: SessionStoreLike): Promise<void> {
  await store.clear();
}

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

function assertSessionMatches(input: {
  appUrl: string;
  config: NativeOAuthConfig;
  session: NativeSession;
}) {
  if (
    normalizeAppUrl(input.session.appUrl) !== normalizeAppUrl(input.appUrl) ||
    input.session.oauth.issuer !== input.config.issuer ||
    input.session.oauth.clientId !== input.config.clientId
  ) {
    throw new CliAuthError(
      "SESSION_MISMATCH",
      "Stored Lightfast CLI credentials belong to a different app or OAuth client."
    );
  }
}

export async function getValidAccessToken(input: {
  appUrl: string;
  config: NativeOAuthConfig;
  now?: () => number;
  refresh?: (args: {
    config: NativeOAuthConfig;
    refreshToken: string;
  }) => Promise<TokenSet>;
  store: SessionStoreLike;
}): Promise<string | null> {
  const session = await loadSession(input.store);
  if (!session) {
    return null;
  }

  assertSessionMatches({
    appUrl: input.appUrl,
    config: input.config,
    session,
  });

  const now = (input.now ?? Date.now)();
  if (session.tokens.expiresAt - now > EXPIRY_SKEW_MS) {
    return session.tokens.accessToken;
  }

  const refresh = input.refresh ?? refreshAccessToken;
  const tokens = await refresh({
    config: input.config,
    refreshToken: session.tokens.refreshToken,
  });
  await input.store.set({ ...session, tokens });
  return tokens.accessToken;
}

export function buildNativeAuthHeaders(
  session: NativeSession
): Record<string, string> {
  return {
    Authorization: `Bearer ${session.tokens.accessToken}`,
    [NATIVE_AUTH_HEADERS.client]: "cli",
    [NATIVE_AUTH_HEADERS.organizationId]: session.organization.id,
  };
}
