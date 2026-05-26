import {
  NATIVE_AUTH_HEADERS,
  NATIVE_OAUTH_SCOPES,
  type NativeOAuthConfig,
  type TokenSet,
} from "@repo/native-auth-contract";
import { refreshAccessToken as defaultRefreshAccessToken } from "@repo/native-auth-node";

import { getSession, setSession, signOut } from "./store";
import type { DesktopNativeSession } from "./store";

const EXPIRY_SKEW_MS = 60_000;

export interface AuthRequestHeaders {
  Authorization?: string;
  "x-lightfast-native-client"?: "desktop";
  "x-lightfast-organization-id"?: string;
}

function configFromSession(session: DesktopNativeSession): NativeOAuthConfig {
  const issuer = session.oauth.issuer.replace(/\/$/, "");
  return {
    authorizationEndpoint: `${issuer}/oauth/authorize`,
    client: "desktop",
    clientId: session.oauth.clientId,
    issuer,
    scopes: [...NATIVE_OAUTH_SCOPES],
    supportsDynamicLoopbackPort: true,
    tokenEndpoint: `${issuer}/oauth/token`,
  };
}

function headersForSession(session: DesktopNativeSession): AuthRequestHeaders {
  return {
    Authorization: `Bearer ${session.tokens.accessToken}`,
    [NATIVE_AUTH_HEADERS.client]: "desktop",
    [NATIVE_AUTH_HEADERS.organizationId]: session.organization.id,
  };
}

export async function getValidAuthRequestHeaders(input: {
  getSession?: () => DesktopNativeSession | null;
  now?: () => number;
  refreshAccessToken?: (args: {
    config: NativeOAuthConfig;
    refreshToken: string;
  }) => Promise<TokenSet>;
  setSession?: (session: DesktopNativeSession) => boolean;
  signOut?: () => boolean;
} = {}): Promise<AuthRequestHeaders> {
  const session = (input.getSession ?? getSession)();
  if (!session) {
    return {};
  }

  const now = (input.now ?? Date.now)();
  if (session.tokens.expiresAt - now > EXPIRY_SKEW_MS) {
    return headersForSession(session);
  }

  try {
    const tokens = await (input.refreshAccessToken ?? defaultRefreshAccessToken)(
      {
        config: configFromSession(session),
        refreshToken: session.tokens.refreshToken,
      }
    );
    const next = { ...session, tokens };
    (input.setSession ?? setSession)(next);
    return headersForSession(next);
  } catch {
    (input.signOut ?? signOut)();
    return {};
  }
}
