import type { Database, UserConnectorConnection } from "@db/app";
import {
  finalizeCurrentUserConnectorConnection,
  getCurrentUserConnectorConnection,
  markCurrentUserConnectorConnectionRevoked,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import { encrypt } from "@repo/app-encryption";
import {
  DEFAULT_GRANOLA_MCP_ENDPOINT,
  GranolaAppNodeError,
  GranolaOAuthClientProvider,
  granolaClientMetadata,
  listGranolaMcpTools,
} from "@repo/granola-app-node";
import { auth } from "@vendor/clerk/server";
import type { OAuthClientInformationMixed, OAuthTokens } from "@vendor/mcp";
import { StreamableHTTPClientTransport } from "@vendor/mcp";
import { log } from "@vendor/observability/log/next";
import { AuthzError, InternalDomainError } from "../../domain/errors";
import { env } from "../../env";
import type { AuthContext } from "../../trpc";
import {
  consumeUserConnectorOAuthAttempt,
  issueUserConnectorOAuthAttempt,
  lookupUserConnectorOAuthAttempt,
  type UserConnectorOAuthAttemptRecord,
} from "./attempts";

export const GRANOLA_OAUTH_CALLBACK_PATH =
  "/api/connectors/granola/oauth/callback";

interface GranolaUserConnectorServiceContext {
  auth: AuthContext;
  db: Database;
  headers: Headers;
}

export interface GranolaRedirectResult {
  redirectUrl: string;
}

function signedInIdentity(ctx: GranolaUserConnectorServiceContext) {
  const identity = ctx.auth.identity;
  if (identity.type === "unauthenticated") {
    throw new AuthzError("AUTH_REQUIRED", "Authentication required.");
  }
  return identity;
}

function resolveUserConnectorAppOrigin() {
  const appUrl = process.env.VITE_LIGHTFAST_APP_URL;
  if (!appUrl) {
    throw new Error(
      "VITE_LIGHTFAST_APP_URL is required for user connector callback URL resolution."
    );
  }
  return new URL(appUrl).origin;
}

function granolaAccountSettingsUrl(input: {
  appOrigin: string;
  error?: string;
}) {
  const url = new URL("/account/settings", input.appOrigin);
  url.searchParams.set("connector", "granola");
  if (input.error) {
    url.searchParams.set("error", input.error);
  }
  return url.toString();
}

function signInRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): GranolaRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}

function safeReturnTo(input: { appOrigin: string; headers: Headers }) {
  const referer = input.headers.get("referer");
  if (!referer) {
    return "/account/settings?connector=granola";
  }

  try {
    const appOrigin = new URL(input.appOrigin).origin;
    const refererUrl = new URL(referer);
    if (refererUrl.origin !== appOrigin) {
      return "/account/settings?connector=granola";
    }
    return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`;
  } catch {
    return "/account/settings?connector=granola";
  }
}

function redirectUrlForReturnTo(input: {
  appOrigin: string;
  returnTo: string;
}) {
  try {
    const url = new URL(input.returnTo, input.appOrigin);
    if (url.origin !== input.appOrigin) {
      return granolaAccountSettingsUrl({ appOrigin: input.appOrigin });
    }
    if (!url.searchParams.has("connector")) {
      url.searchParams.set("connector", "granola");
    }
    return url.toString();
  } catch {
    return granolaAccountSettingsUrl({ appOrigin: input.appOrigin });
  }
}

function expiresAtFromSeconds(seconds: number | undefined) {
  return seconds ? new Date(Date.now() + seconds * 1000) : null;
}

function scopesFromTokenScope(scope: string | undefined) {
  return scope?.split(/\s+/).filter(Boolean) ?? [];
}

function granolaMcpEndpoint() {
  return env.GRANOLA_MCP_ENDPOINT ?? DEFAULT_GRANOLA_MCP_ENDPOINT;
}

async function encryptedToken(plaintext: string) {
  return await encrypt(plaintext, env.ENCRYPTION_KEY);
}

function safeErrorDetails(error: unknown) {
  return {
    code:
      error instanceof GranolaAppNodeError
        ? error.code
        : error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    message: error instanceof Error ? error.message : undefined,
    name: error instanceof Error ? error.name : typeof error,
  };
}

function mapGranolaOAuthError(error: unknown) {
  if (error instanceof GranolaAppNodeError) {
    return error.code === "GRANOLA_MCP_AUTH_REQUIRED"
      ? "granola_authorization_required"
      : "granola_transient_error";
  }
  return "granola_transient_error";
}

function isGranolaAuthRequired(error: unknown) {
  return (
    error instanceof GranolaAppNodeError &&
    error.code === "GRANOLA_MCP_AUTH_REQUIRED"
  );
}

function isTokenRecord(tokens: unknown): tokens is OAuthTokens {
  return (
    !!tokens &&
    typeof tokens === "object" &&
    "access_token" in tokens &&
    typeof tokens.access_token === "string"
  );
}

function safeOAuthClientInformation(clientInformation: unknown) {
  if (!clientInformation || typeof clientInformation !== "object") {
    return;
  }

  const record = clientInformation as Record<string, unknown>;
  if (typeof record.client_id !== "string" || record.client_id.length === 0) {
    return;
  }

  return {
    client_id: record.client_id,
    ...(typeof record.client_id_issued_at === "number"
      ? { client_id_issued_at: record.client_id_issued_at }
      : {}),
    ...(typeof record.client_secret_expires_at === "number"
      ? { client_secret_expires_at: record.client_secret_expires_at }
      : {}),
  };
}

function createGranolaOAuthProvider(input: {
  clientInformation?: unknown;
  codeVerifier?: string;
  onAuthorizationUrl?: (authorizationUrl: URL) => void | Promise<void>;
  redirectUrl: string;
}) {
  return new GranolaOAuthClientProvider({
    clientInformation: input.clientInformation as
      | OAuthClientInformationMixed
      | undefined,
    clientMetadata: granolaClientMetadata({ redirectUrl: input.redirectUrl }),
    codeVerifier: input.codeVerifier,
    onAuthorizationUrl: input.onAuthorizationUrl,
    redirectUrl: input.redirectUrl,
  });
}

export async function startGranolaUserConnectorOAuth(
  ctx: GranolaUserConnectorServiceContext
): Promise<{ authorizationUrl: string; mode: "connect" | "reconnect" }> {
  const identity = signedInIdentity(ctx);
  const appOrigin = resolveUserConnectorAppOrigin();
  const redirectUrl = new URL(
    GRANOLA_OAUTH_CALLBACK_PATH,
    appOrigin
  ).toString();
  const current = await getCurrentUserConnectorConnection(ctx.db, {
    clerkUserId: identity.userId,
    provider: "granola",
  });
  const mode = current ? "reconnect" : "connect";
  let authorizationUrl: URL | undefined;

  const provider = createGranolaOAuthProvider({
    redirectUrl,
    onAuthorizationUrl: (url) => {
      authorizationUrl = new URL(url.toString());
    },
  });

  try {
    const mcpEndpoint = granolaMcpEndpoint();
    await listGranolaMcpTools({
      authProvider: provider,
      endpoint: mcpEndpoint,
    });
  } catch (error) {
    if (!isGranolaAuthRequired(error)) {
      throw new InternalDomainError(
        "USER_CONNECTOR_AUTH_START_FAILED",
        "Granola authorization could not be started.",
        {},
        { cause: error }
      );
    }
  }

  if (!authorizationUrl) {
    throw new InternalDomainError(
      "USER_CONNECTOR_AUTH_URL_MISSING",
      "Granola authorization URL was not provided."
    );
  }

  const providerState = authorizationUrl.searchParams.get("state") ?? undefined;
  const snapshot = provider.snapshot();
  const attempt = await issueUserConnectorOAuthAttempt({
    clerkUserId: identity.userId,
    clientInformation: snapshot.clientInformation,
    codeVerifier: snapshot.codeVerifier,
    provider: "granola",
    redirectUrl,
    returnTo: safeReturnTo({ appOrigin, headers: ctx.headers }),
    state: providerState,
  });

  if (!providerState) {
    authorizationUrl.searchParams.set("state", attempt.state);
  }

  log.info("[user-connectors] granola oauth started", {
    clerkUserId: identity.userId,
    mode,
    provider: "granola",
  });

  return { authorizationUrl: authorizationUrl.toString(), mode };
}

async function finalizeGranolaConnection(input: {
  attempt: UserConnectorOAuthAttemptRecord;
  code: string;
}) {
  const mcpEndpoint = granolaMcpEndpoint();
  const provider = createGranolaOAuthProvider({
    clientInformation: input.attempt.clientInformation,
    codeVerifier: input.attempt.codeVerifier,
    redirectUrl: input.attempt.redirectUrl,
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcpEndpoint), {
    authProvider: provider,
  });

  await transport.finishAuth(input.code);

  const tokens = provider.tokens();
  if (!isTokenRecord(tokens)) {
    throw new GranolaAppNodeError(
      "GRANOLA_MCP_FAILED",
      "Granola OAuth did not return access tokens."
    );
  }

  const toolManifest = await listGranolaMcpTools({
    authProvider: provider,
    endpoint: mcpEndpoint,
  });
  const oauthClientInformation = safeOAuthClientInformation(
    provider.snapshot().clientInformation
  );
  const previousCurrent = await getCurrentUserConnectorConnection(appDb, {
    clerkUserId: input.attempt.clerkUserId,
    provider: "granola",
  });

  await finalizeCurrentUserConnectorConnection(appDb, {
    accessTokenExpiresAt: expiresAtFromSeconds(tokens.expires_in),
    clerkUserId: input.attempt.clerkUserId,
    encryptedAccessToken: await encryptedToken(tokens.access_token),
    encryptedRefreshToken: tokens.refresh_token
      ? await encryptedToken(tokens.refresh_token)
      : null,
    lastToolRefreshAt: new Date(),
    mcpEndpoint,
    metadata: {
      hasRefreshToken: !!tokens.refresh_token,
      mode: previousCurrent ? "reconnect" : "connect",
      ...(oauthClientInformation ? { oauthClientInformation } : {}),
      tokenType: tokens.token_type,
    },
    observedCurrentConnectionId: previousCurrent?.id ?? null,
    observedEncryptedAccessToken: previousCurrent?.encryptedAccessToken ?? null,
    observedEncryptedRefreshToken:
      previousCurrent?.encryptedRefreshToken ?? null,
    provider: "granola",
    providerAccountId: null,
    providerAccountName: "Granola",
    refreshTokenExpiresAt: null,
    scopes: scopesFromTokenScope(tokens.scope),
    toolManifest,
  });
}

export async function completeGranolaUserConnectorOAuth(input: {
  code: string;
  requestUrl: string;
  state: string;
}): Promise<GranolaRedirectResult> {
  const appOrigin = resolveUserConnectorAppOrigin();
  const pendingAttempt = await lookupUserConnectorOAuthAttempt({
    state: input.state,
  });
  if (!pendingAttempt) {
    return {
      redirectUrl: granolaAccountSettingsUrl({
        appOrigin,
        error: "expired_state",
      }),
    };
  }

  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId) {
    return signInRedirect({ appOrigin, requestUrl: input.requestUrl });
  }
  if (session.userId !== pendingAttempt.clerkUserId) {
    return {
      redirectUrl: granolaAccountSettingsUrl({
        appOrigin,
        error: "permission_required",
      }),
    };
  }

  const attempt = await consumeUserConnectorOAuthAttempt({
    state: input.state,
  });
  if (!attempt) {
    return {
      redirectUrl: granolaAccountSettingsUrl({
        appOrigin,
        error: "expired_state",
      }),
    };
  }

  try {
    await finalizeGranolaConnection({ attempt, code: input.code });
    return {
      redirectUrl: redirectUrlForReturnTo({
        appOrigin,
        returnTo: attempt.returnTo,
      }),
    };
  } catch (error) {
    log.warn("[user-connectors] granola oauth finalize failed", {
      clerkUserId: attempt.clerkUserId,
      failure: safeErrorDetails(error),
      provider: "granola",
    });
    return {
      redirectUrl: granolaAccountSettingsUrl({
        appOrigin,
        error: mapGranolaOAuthError(error),
      }),
    };
  }
}

export async function disconnectGranolaUserConnector(
  ctx: GranolaUserConnectorServiceContext
): Promise<{ disconnected: boolean }> {
  const identity = signedInIdentity(ctx);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const connection: UserConnectorConnection | undefined =
      await getCurrentUserConnectorConnection(ctx.db, {
        clerkUserId: identity.userId,
        provider: "granola",
      });
    if (!connection) {
      break;
    }

    const revoked = await markCurrentUserConnectorConnectionRevoked(ctx.db, {
      clerkUserId: identity.userId,
      observedCurrentConnectionId: connection.id,
      observedEncryptedAccessToken: connection.encryptedAccessToken,
      observedEncryptedRefreshToken: connection.encryptedRefreshToken,
      provider: "granola",
    });
    if (revoked) {
      break;
    }
  }

  return { disconnected: true };
}
