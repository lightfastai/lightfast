import type { Database } from "@db/app";
import {
  finalizeCurrentOrgConnectorConnection,
  getCurrentOrgConnectorConnection,
  markCurrentOrgConnectorConnectionError,
  markCurrentOrgConnectorConnectionRevoked,
  type OrgConnectorConnection,
  recordConnectorToolRefreshError,
  setConnectorAgentEnabled as setConnectorAgentEnabledInDb,
  setConnectorAutomationEnabled as setConnectorAutomationEnabledInDb,
  updateConnectorToolManifestAndAutomationState,
  updateObservedConnectorTokens,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import { decrypt, encrypt } from "@repo/app-encryption";
import {
  connectorRuntimeToolName,
  type FullConnectorToolManifest,
} from "@repo/connector-contract";
import {
  buildXOAuthAuthorizeUrl,
  createXPkcePair,
  exchangeXOAuthCode,
  getXViewerMetadata,
  listXBridgeMcpTools,
  refreshXOAuthToken,
  revokeXOAuthToken,
  XAppNodeError,
} from "@repo/x-app-node";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { findUserOrganizationMembership } from "../../auth/clerk-org-membership";
import { env } from "../../env";
import type { AuthContext } from "../../trpc";
import {
  type ConnectorOAuthAttemptRecord,
  consumeConnectorOAuthAttempt,
  issueConnectorOAuthAttempt,
  lookupConnectorOAuthAttempt,
} from "./attempts";
import { assertCurrentSessionCanFinalizeConnectorOAuth } from "./auth";
import {
  requireXConnectorConfig,
  resolveConnectorAppOrigin,
  X_OAUTH_CALLBACK_PATH,
} from "./config";
import { issueConnectorMcpToken } from "./mcp-auth";

interface ConnectorServiceContext {
  auth: AuthContext;
  db: Database;
}

export interface XRedirectResult {
  redirectUrl: string;
}

function activeIdentity(ctx: ConnectorServiceContext) {
  if (ctx.auth.identity.type !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "An active organization is required.",
    });
  }
  return ctx.auth.identity;
}

async function getOrgSlug(input: {
  clerkOrgId: string;
  userId: string;
}): Promise<string> {
  const membership = await findUserOrganizationMembership({
    organizationId: input.clerkOrgId,
    userId: input.userId,
  });
  const slug = membership?.organization.slug;
  if (!slug) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization access is required.",
    });
  }
  return slug;
}

function connectorPageUrl(input: {
  appOrigin: string;
  error?: string;
  orgSlug: string;
}) {
  const url = new URL(`/${input.orgSlug}/connectors`, input.appOrigin);
  url.searchParams.set("connector", "x");
  if (input.error) {
    url.searchParams.set("error", input.error);
  }
  return url.toString();
}

function missingAttemptRedirect(input: { appOrigin: string }): XRedirectResult {
  const url = new URL("/account/teams", input.appOrigin);
  url.searchParams.set("connector", "x");
  url.searchParams.set("error", "expired_state");
  return { redirectUrl: url.toString() };
}

function errorRedirect(input: {
  appOrigin: string;
  code: string;
  orgSlug: string;
}): XRedirectResult {
  return {
    redirectUrl: connectorPageUrl({
      appOrigin: input.appOrigin,
      error: input.code,
      orgSlug: input.orgSlug,
    }),
  };
}

function signInRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): XRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}

function parseXCallback(requestUrl: string) {
  const url = new URL(requestUrl);
  return {
    code: url.searchParams.get("code"),
    denied: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
  };
}

function mapXOAuthError(error: unknown) {
  if (
    error instanceof Error &&
    error.name === "ConnectorOAuthFinalizeAccessError"
  ) {
    return "permission_required";
  }
  if (error instanceof XAppNodeError) {
    if (error.code === "X_OAUTH_EXCHANGE_FAILED") {
      return "x_authorization_failed";
    }
    if (error.code === "X_MCP_FAILED") {
      return "x_tool_discovery_failed";
    }
  }
  return "x_transient_error";
}

function isUnauthenticatedFinalizeError(error: unknown) {
  return (
    error instanceof Error &&
    error.name === "ConnectorOAuthFinalizeAccessError" &&
    "code" in error &&
    error.code === "UNAUTHENTICATED"
  );
}

function expiresAtFromSeconds(seconds: number | undefined) {
  return seconds ? new Date(Date.now() + seconds * 1000) : null;
}

function safeErrorDetails(error: unknown) {
  return {
    code:
      error instanceof XAppNodeError
        ? error.code
        : error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    message: error instanceof Error ? error.message : undefined,
    name: error instanceof Error ? error.name : typeof error,
  };
}

function shouldRefreshAccessToken(connection: OrgConnectorConnection) {
  if (!connection.accessTokenExpiresAt) {
    return false;
  }
  return connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
}

async function decryptToken(ciphertext: string) {
  return await decrypt(ciphertext, env.ENCRYPTION_KEY);
}

async function encryptedToken(plaintext: string) {
  return await encrypt(plaintext, env.ENCRYPTION_KEY);
}

async function revokeDroppedXTokens(input: {
  clerkOrgId: string;
  config: ReturnType<typeof requireXConnectorConfig>;
  reason: "post_exchange_failure" | "refresh_cas_lost";
  tokens: Array<{ kind: "access" | "refresh"; token?: string }>;
}) {
  const seen = new Set<string>();
  for (const issuedToken of input.tokens) {
    if (!issuedToken.token || seen.has(issuedToken.token)) {
      continue;
    }
    seen.add(issuedToken.token);

    try {
      await revokeXOAuthToken({
        clientId: input.config.clientId,
        clientSecret: input.config.clientSecret,
        revokeUrl: input.config.endpoints.oauthRevokeUrl,
        token: issuedToken.token,
      });
    } catch (error) {
      log.warn("[connectors] x dropped token revoke failed", {
        clerkOrgId: input.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "x",
        reason: input.reason,
        tokenKind: issuedToken.kind,
      });
    }
  }
}

async function revokeXConnectionTokens(input: {
  clerkOrgId: string;
  config: ReturnType<typeof requireXConnectorConfig>;
  connection: OrgConnectorConnection;
  logMessage: string;
}) {
  const encryptedTokens: Array<{
    ciphertext: string | null;
    kind: "access" | "refresh";
  }> = [
    { ciphertext: input.connection.encryptedAccessToken, kind: "access" },
    { ciphertext: input.connection.encryptedRefreshToken, kind: "refresh" },
  ];
  const seen = new Set<string>();

  for (const encrypted of encryptedTokens) {
    if (!encrypted.ciphertext) {
      continue;
    }

    let token: string;
    try {
      token = await decryptToken(encrypted.ciphertext);
    } catch (error) {
      log.warn(input.logMessage, {
        clerkOrgId: input.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "x",
        tokenKind: encrypted.kind,
      });
      continue;
    }

    if (seen.has(token)) {
      continue;
    }
    seen.add(token);

    try {
      await revokeXOAuthToken({
        clientId: input.config.clientId,
        clientSecret: input.config.clientSecret,
        revokeUrl: input.config.endpoints.oauthRevokeUrl,
        token,
      });
    } catch (error) {
      log.warn(input.logMessage, {
        clerkOrgId: input.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "x",
        tokenKind: encrypted.kind,
      });
    }
  }
}

function hasDifferentObservedTokens(input: {
  current: OrgConnectorConnection;
  previous: OrgConnectorConnection;
}) {
  return (
    input.current.status === "active" &&
    (input.current.encryptedAccessToken !==
      input.previous.encryptedAccessToken ||
      input.current.encryptedRefreshToken !==
        input.previous.encryptedRefreshToken)
  );
}

async function getConcurrentRefreshWinner(input: {
  connection: OrgConnectorConnection;
  db: Database;
}) {
  const current = await getCurrentOrgConnectorConnection(input.db, {
    clerkOrgId: input.connection.clerkOrgId,
    provider: input.connection.provider,
  });

  if (
    !(
      current?.encryptedAccessToken &&
      hasDifferentObservedTokens({
        current,
        previous: input.connection,
      })
    )
  ) {
    return null;
  }

  return {
    accessToken: await decryptToken(current.encryptedAccessToken),
    connection: current,
  };
}

export async function getFreshXConnectorAccessToken(input: {
  config?: ReturnType<typeof requireXConnectorConfig>;
  connection: OrgConnectorConnection;
  db: Database;
}) {
  const config = input.config ?? requireXConnectorConfig();

  if (!input.connection.encryptedAccessToken) {
    throw new XAppNodeError(
      "X_TOKEN_REFRESH_FAILED",
      "X connector access token is missing."
    );
  }

  if (!shouldRefreshAccessToken(input.connection)) {
    return await decryptToken(input.connection.encryptedAccessToken);
  }

  if (!input.connection.encryptedRefreshToken) {
    throw new XAppNodeError(
      "X_TOKEN_REFRESH_FAILED",
      "X connector refresh token is missing."
    );
  }

  const refreshToken = await decryptToken(
    input.connection.encryptedRefreshToken
  );
  const refreshed = await refreshXOAuthToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
    refreshTokenExpiresIn: input.connection.refreshTokenExpiresAt
      ? Math.max(
          1,
          Math.floor(
            (input.connection.refreshTokenExpiresAt.getTime() - Date.now()) /
              1000
          )
        )
      : undefined,
    tokenUrl: config.endpoints.oauthTokenUrl,
  });

  const encryptedAccessToken = await encryptedToken(refreshed.accessToken);
  const encryptedRefreshToken = refreshed.refreshToken
    ? await encryptedToken(refreshed.refreshToken)
    : null;

  const updated = await updateObservedConnectorTokens(input.db, {
    accessTokenExpiresAt: expiresAtFromSeconds(refreshed.accessTokenExpiresIn),
    clerkOrgId: input.connection.clerkOrgId,
    encryptedAccessToken,
    encryptedRefreshToken,
    id: input.connection.id,
    observedEncryptedAccessToken: input.connection.encryptedAccessToken,
    observedEncryptedRefreshToken: input.connection.encryptedRefreshToken,
    refreshTokenExpiresAt: expiresAtFromSeconds(
      refreshed.refreshTokenExpiresIn
    ),
    updatedAt: new Date(),
  });

  if (!updated) {
    await revokeDroppedXTokens({
      clerkOrgId: input.connection.clerkOrgId,
      config,
      reason: "refresh_cas_lost",
      tokens: [
        { kind: "access", token: refreshed.accessToken },
        {
          kind: "refresh",
          token:
            refreshed.refreshToken && refreshed.refreshToken !== refreshToken
              ? refreshed.refreshToken
              : undefined,
        },
      ],
    });

    const winner = await getConcurrentRefreshWinner({
      connection: input.connection,
      db: input.db,
    });
    if (winner) {
      return winner.accessToken;
    }

    throw new XAppNodeError(
      "X_TOKEN_REFRESH_FAILED",
      "X OAuth token refresh failed."
    );
  }

  return refreshed.accessToken;
}

export async function startXConnectorOAuth(
  ctx: ConnectorServiceContext,
  input: { appOrigin?: string } = {}
) {
  const identity = activeIdentity(ctx);
  const config = requireXConnectorConfig({ appOrigin: input.appOrigin });
  const current = await getCurrentOrgConnectorConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: "x",
  });
  const mode = current ? "reconnect" : "connect";
  const orgSlug = await getOrgSlug({
    clerkOrgId: identity.orgId,
    userId: identity.userId,
  });
  const pkce = createXPkcePair();
  const attempt = await issueConnectorOAuthAttempt({
    clerkOrgId: identity.orgId,
    codeVerifier: pkce.codeVerifier,
    lightfastUserId: identity.userId,
    mode,
    orgSlug,
    provider: "x",
  });
  const authorizationUrl = buildXOAuthAuthorizeUrl({
    callbackUrl: new URL(X_OAUTH_CALLBACK_PATH, config.appOrigin).toString(),
    clientId: config.clientId,
    codeChallenge: pkce.codeChallenge,
    oauthAuthorizeUrl: config.endpoints.oauthAuthorizeUrl,
    state: attempt.state,
  });

  log.info("[connectors] x oauth started", {
    clerkOrgId: identity.orgId,
    mode,
    provider: "x",
  });

  return { authorizationUrl, mode };
}

async function finalizeXConnection(input: {
  appOrigin: string;
  attempt: ConnectorOAuthAttemptRecord;
  code: string;
}) {
  const config = requireXConnectorConfig({ appOrigin: input.appOrigin });
  const token = await exchangeXOAuthCode({
    callbackUrl: new URL(X_OAUTH_CALLBACK_PATH, input.appOrigin).toString(),
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code: input.code,
    codeVerifier: input.attempt.codeVerifier,
    tokenUrl: config.endpoints.oauthTokenUrl,
  });

  let persisted: OrgConnectorConnection;
  try {
    const metadata = await getXViewerMetadata({
      accessToken: token.accessToken,
      viewerUrl: config.endpoints.viewerUrl,
    });
    const previousCurrent = await getCurrentOrgConnectorConnection(appDb, {
      clerkOrgId: input.attempt.clerkOrgId,
      provider: "x",
    });
    if (previousCurrent) {
      await revokeXConnectionTokens({
        clerkOrgId: input.attempt.clerkOrgId,
        config,
        connection: previousCurrent,
        logMessage: "[connectors] x revoke failed during reconnect",
      });
    }

    persisted = await finalizeCurrentOrgConnectorConnection(appDb, {
      accessTokenExpiresAt: expiresAtFromSeconds(token.accessTokenExpiresIn),
      clerkOrgId: input.attempt.clerkOrgId,
      connectedByUserId: input.attempt.lightfastUserId,
      encryptedAccessToken: await encryptedToken(token.accessToken),
      encryptedRefreshToken: token.refreshToken
        ? await encryptedToken(token.refreshToken)
        : null,
      enabledForAutomations: false,
      mcpEndpoint: config.endpoints.mcpEndpoint,
      metadata: {
        mode: input.attempt.mode,
        name: metadata.name,
        username: metadata.username,
      },
      observedCurrentConnectionId: previousCurrent?.id ?? null,
      observedEncryptedAccessToken:
        previousCurrent?.encryptedAccessToken ?? null,
      observedEncryptedRefreshToken:
        previousCurrent?.encryptedRefreshToken ?? null,
      provider: "x",
      providerActorId: metadata.actorId,
      providerActorName: metadata.actorName,
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      refreshTokenExpiresAt: expiresAtFromSeconds(token.refreshTokenExpiresIn),
      scopes: token.scopes,
      toolManifest: previousCurrent?.toolManifest ?? [],
    });
  } catch (error) {
    await revokeDroppedXTokens({
      clerkOrgId: input.attempt.clerkOrgId,
      config,
      reason: "post_exchange_failure",
      tokens: [
        { kind: "access", token: token.accessToken },
        { kind: "refresh", token: token.refreshToken },
      ],
    });
    log.warn("[connectors] x post-exchange finalize failed", {
      clerkOrgId: input.attempt.clerkOrgId,
      failure: safeErrorDetails(error),
      provider: "x",
    });
    throw error;
  }

  try {
    await discoverXConnectorTools({
      allowedEndpoint: config.endpoints.mcpEndpoint,
      clerkOrgId: input.attempt.clerkOrgId,
      connection: persisted,
      db: appDb,
      endpoint: config.endpoints.mcpEndpoint,
    });
  } catch (error) {
    await recordXToolRefreshError({
      clerkOrgId: input.attempt.clerkOrgId,
      db: appDb,
      error,
    });
    throw error;
  }
}

export async function completeXConnectorOAuth(input: {
  appOrigin?: string;
  requestUrl: string;
}): Promise<XRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveConnectorAppOrigin();
  const parsed = parseXCallback(input.requestUrl);

  if (!(parsed.state && (parsed.code || parsed.denied))) {
    return missingAttemptRedirect({ appOrigin });
  }

  const pendingAttempt = await lookupConnectorOAuthAttempt({
    provider: "x",
    state: parsed.state,
  });
  if (!pendingAttempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  try {
    await assertCurrentSessionCanFinalizeConnectorOAuth({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedFinalizeError(error)) {
      return signInRedirect({ appOrigin, requestUrl: input.requestUrl });
    }
    return errorRedirect({
      appOrigin,
      code: mapXOAuthError(error),
      orgSlug: pendingAttempt.orgSlug,
    });
  }

  const attempt = await consumeConnectorOAuthAttempt({
    provider: "x",
    state: parsed.state,
  });
  if (!attempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  if (parsed.denied || !parsed.code) {
    return errorRedirect({
      appOrigin,
      code: "x_authorization_denied",
      orgSlug: attempt.orgSlug,
    });
  }

  try {
    await finalizeXConnection({
      appOrigin,
      attempt,
      code: parsed.code,
    });
    return {
      redirectUrl: connectorPageUrl({ appOrigin, orgSlug: attempt.orgSlug }),
    };
  } catch (error) {
    return errorRedirect({
      appOrigin,
      code: mapXOAuthError(error),
      orgSlug: attempt.orgSlug,
    });
  }
}

export async function refreshXConnectorTools(ctx: ConnectorServiceContext) {
  const identity = activeIdentity(ctx);
  const config = requireXConnectorConfig();
  const connection = await getCurrentOrgConnectorConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: "x",
  });
  if (!connection) {
    return { refreshed: false, status: "missing_connection" as const };
  }

  try {
    const toolManifest = await discoverXConnectorTools({
      allowedEndpoint: config.endpoints.mcpEndpoint,
      clerkOrgId: identity.orgId,
      connection,
      db: ctx.db,
      endpoint: connection.mcpEndpoint || config.endpoints.mcpEndpoint,
    });
    return { refreshed: true, status: "ok" as const, toolManifest };
  } catch (error) {
    await recordXToolRefreshError({
      clerkOrgId: identity.orgId,
      db: ctx.db,
      error,
    });
    if (isTerminalXAuthError(error)) {
      await markCurrentOrgConnectorConnectionError(ctx.db, {
        clerkOrgId: identity.orgId,
        provider: "x",
      });
      return { refreshed: false, status: "auth_error" as const };
    }
    return { refreshed: false, status: "refresh_error" as const };
  }
}

async function discoverXConnectorTools(input: {
  allowedEndpoint: string;
  clerkOrgId: string;
  connection: OrgConnectorConnection;
  db: Database;
  endpoint: string;
}): Promise<FullConnectorToolManifest> {
  const mcpToken = await issueConnectorMcpToken({
    clerkOrgId: input.clerkOrgId,
    connectionId: input.connection.id,
    provider: "x",
    purpose: "list",
  });
  const toolManifest = await listXBridgeMcpTools({
    allowedEndpoint: input.allowedEndpoint,
    endpoint: input.endpoint,
    mcpToken,
  });
  await updateConnectorToolManifestAndAutomationState(input.db, {
    clerkOrgId: input.clerkOrgId,
    enabledForAutomations: toolManifest.some(canUseToolForAutomation),
    lastToolRefreshAt: new Date(),
    provider: "x",
    toolManifest,
  });
  return toolManifest;
}

function canUseToolForAutomation(tool: { name: string }) {
  try {
    connectorRuntimeToolName("x", tool.name);
    return true;
  } catch {
    return false;
  }
}

async function recordXToolRefreshError(input: {
  clerkOrgId: string;
  db: Database;
  error: unknown;
}) {
  await recordConnectorToolRefreshError(input.db, {
    clerkOrgId: input.clerkOrgId,
    lastToolRefreshErrorAt: new Date(),
    lastToolRefreshErrorCode:
      input.error instanceof XAppNodeError ? input.error.code : "X_MCP_FAILED",
    provider: "x",
  });
  log.warn("[connectors] x tool refresh failed", {
    clerkOrgId: input.clerkOrgId,
    failure: safeErrorDetails(input.error),
    provider: "x",
  });
}

function isTerminalXAuthError(error: unknown) {
  return (
    error instanceof XAppNodeError && error.code === "X_TOKEN_REFRESH_FAILED"
  );
}

export async function setXConnectorAutomationEnabled(
  ctx: ConnectorServiceContext,
  input: { enabled: boolean }
) {
  const identity = activeIdentity(ctx);
  const updated = await setConnectorAutomationEnabledInDb(ctx.db, {
    clerkOrgId: identity.orgId,
    enabled: input.enabled,
    provider: "x",
  });
  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "X connector is not connected.",
    });
  }
  return { enabled: input.enabled };
}

export async function setXConnectorAgentEnabled(
  ctx: ConnectorServiceContext,
  input: { enabled: boolean }
) {
  const identity = activeIdentity(ctx);
  const updated = await setConnectorAgentEnabledInDb(ctx.db, {
    clerkOrgId: identity.orgId,
    enabled: input.enabled,
    provider: "x",
  });
  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "X connector is not connected.",
    });
  }
  return { enabled: input.enabled };
}

export async function disconnectXConnector(ctx: ConnectorServiceContext) {
  const identity = activeIdentity(ctx);
  const configResult = (() => {
    try {
      return requireXConnectorConfig();
    } catch {
      return null;
    }
  })();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const connection = await getCurrentOrgConnectorConnection(ctx.db, {
      clerkOrgId: identity.orgId,
      provider: "x",
    });
    if (!connection) {
      break;
    }

    if (
      configResult &&
      (connection.encryptedAccessToken || connection.encryptedRefreshToken)
    ) {
      await revokeXConnectionTokens({
        clerkOrgId: identity.orgId,
        config: configResult,
        connection,
        logMessage: "[connectors] x revoke failed during disconnect",
      });
    }

    const revoked = await markCurrentOrgConnectorConnectionRevoked(ctx.db, {
      clerkOrgId: identity.orgId,
      observedCurrentConnectionId: connection.id,
      observedEncryptedAccessToken: connection.encryptedAccessToken,
      observedEncryptedRefreshToken: connection.encryptedRefreshToken,
      provider: "x",
    });
    if (revoked) {
      break;
    }
  }

  return { disconnected: true };
}
