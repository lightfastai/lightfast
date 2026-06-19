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
  updateConnectorToolManifest,
  updateObservedConnectorTokens,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import { listLinearMcpTools } from "@lightfast/connector-linear/mcp";
import {
  getLinearViewerMetadata,
  LinearAppNodeError,
} from "@lightfast/connector-linear/node";
import {
  buildLinearOAuthAuthorizeUrl,
  createLinearPkcePair,
  exchangeLinearOAuthCode,
  refreshLinearOAuthToken,
  revokeLinearOAuthToken,
} from "@lightfast/connector-linear/oauth";
import { decrypt, encrypt } from "@repo/app-encryption";
import { log } from "@vendor/observability/log/next";
import { findUserOrganizationMembership } from "../../auth/clerk-org-membership";
import { AuthzError, NotFoundError } from "../../domain/errors";
import { env } from "../../env";
import {
  type ConnectorOAuthAttemptRecord,
  consumeConnectorOAuthAttempt,
  issueConnectorOAuthAttempt,
  lookupConnectorOAuthAttempt,
} from "./attempts";
import { assertCurrentSessionCanFinalizeConnectorOAuth } from "./auth";
import {
  LINEAR_OAUTH_CALLBACK_PATH,
  requireLinearConnectorConfig,
  resolveConnectorAppOrigin,
} from "./config";

interface ConnectorServiceContext {
  actor: {
    userId: string;
  };
  db: Database;
  organization: {
    orgId: string;
  };
}

export interface LinearRedirectResult {
  redirectUrl: string;
}

function activeIdentity(ctx: ConnectorServiceContext) {
  return {
    orgId: ctx.organization.orgId,
    userId: ctx.actor.userId,
  };
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
    throw new AuthzError(
      "ORG_ACCESS_REQUIRED",
      "Organization access is required."
    );
  }
  return slug;
}

function connectorPageUrl(input: {
  appOrigin: string;
  error?: string;
  orgSlug: string;
}) {
  const url = new URL(`/${input.orgSlug}/connectors`, input.appOrigin);
  url.searchParams.set("connector", "linear");
  if (input.error) {
    url.searchParams.set("error", input.error);
  }
  return url.toString();
}

function missingAttemptRedirect(input: {
  appOrigin: string;
}): LinearRedirectResult {
  const url = new URL("/account/teams", input.appOrigin);
  url.searchParams.set("connector", "linear");
  url.searchParams.set("error", "expired_state");
  return { redirectUrl: url.toString() };
}

function errorRedirect(input: {
  appOrigin: string;
  code: string;
  orgSlug: string;
}): LinearRedirectResult {
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
}): LinearRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}

function parseLinearCallback(requestUrl: string) {
  const url = new URL(requestUrl);
  return {
    code: url.searchParams.get("code"),
    denied: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
  };
}

function mapLinearOAuthError(error: unknown) {
  if (
    error instanceof Error &&
    error.name === "ConnectorOAuthFinalizeAccessError"
  ) {
    return "permission_required";
  }
  if (error instanceof LinearAppNodeError) {
    return error.code === "LINEAR_OAUTH_EXCHANGE_FAILED"
      ? "linear_authorization_failed"
      : "linear_transient_error";
  }
  return "linear_transient_error";
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
      error instanceof LinearAppNodeError
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

async function revokeDroppedLinearTokens(input: {
  clerkOrgId: string;
  config: ReturnType<typeof requireLinearConnectorConfig>;
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
      await revokeLinearOAuthToken({
        clientId: input.config.clientId,
        clientSecret: input.config.clientSecret,
        revokeUrl: input.config.endpoints.oauthRevokeUrl,
        token: issuedToken.token,
      });
    } catch (error) {
      log.warn("[connectors] linear dropped token revoke failed", {
        clerkOrgId: input.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "linear",
        reason: input.reason,
        tokenKind: issuedToken.kind,
      });
    }
  }
}

async function revokeLinearConnectionTokens(input: {
  clerkOrgId: string;
  config: ReturnType<typeof requireLinearConnectorConfig>;
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

  for (const encryptedToken of encryptedTokens) {
    if (!encryptedToken.ciphertext) {
      continue;
    }

    let token: string;
    try {
      token = await decryptToken(encryptedToken.ciphertext);
    } catch (error) {
      log.warn(input.logMessage, {
        clerkOrgId: input.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "linear",
        tokenKind: encryptedToken.kind,
      });
      continue;
    }

    if (seen.has(token)) {
      continue;
    }
    seen.add(token);

    try {
      await revokeLinearOAuthToken({
        clientId: input.config.clientId,
        clientSecret: input.config.clientSecret,
        revokeUrl: input.config.endpoints.oauthRevokeUrl,
        token,
      });
    } catch (error) {
      log.warn(input.logMessage, {
        clerkOrgId: input.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "linear",
        tokenKind: encryptedToken.kind,
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

export async function getFreshLinearConnectorAccessToken(input: {
  config?: ReturnType<typeof requireLinearConnectorConfig>;
  connection: OrgConnectorConnection;
  db: Database;
}) {
  const config = input.config ?? requireLinearConnectorConfig();

  if (!input.connection.encryptedAccessToken) {
    throw new LinearAppNodeError(
      "LINEAR_TOKEN_REFRESH_FAILED",
      "Linear connector access token is missing."
    );
  }

  if (!shouldRefreshAccessToken(input.connection)) {
    return await decryptToken(input.connection.encryptedAccessToken);
  }

  if (!input.connection.encryptedRefreshToken) {
    throw new LinearAppNodeError(
      "LINEAR_TOKEN_REFRESH_FAILED",
      "Linear connector refresh token is missing."
    );
  }

  const refreshToken = await decryptToken(
    input.connection.encryptedRefreshToken
  );
  const refreshed = await refreshLinearOAuthToken({
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
    await revokeDroppedLinearTokens({
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

    throw new LinearAppNodeError(
      "LINEAR_TOKEN_REFRESH_FAILED",
      "Linear OAuth token refresh failed."
    );
  }

  return refreshed.accessToken;
}

export async function startLinearConnectorOAuth(
  ctx: ConnectorServiceContext,
  input: { appOrigin?: string } = {}
) {
  const identity = activeIdentity(ctx);
  const config = requireLinearConnectorConfig({ appOrigin: input.appOrigin });
  const current = await getCurrentOrgConnectorConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: "linear",
  });
  const mode = current ? "reconnect" : "connect";
  const orgSlug = await getOrgSlug({
    clerkOrgId: identity.orgId,
    userId: identity.userId,
  });
  const pkce = createLinearPkcePair();
  const attempt = await issueConnectorOAuthAttempt({
    clerkOrgId: identity.orgId,
    codeVerifier: pkce.codeVerifier,
    lightfastUserId: identity.userId,
    mode,
    orgSlug,
    provider: "linear",
  });
  const authorizationUrl = buildLinearOAuthAuthorizeUrl({
    callbackUrl: new URL(
      LINEAR_OAUTH_CALLBACK_PATH,
      config.appOrigin
    ).toString(),
    clientId: config.clientId,
    codeChallenge: pkce.codeChallenge,
    oauthAuthorizeUrl: config.endpoints.oauthAuthorizeUrl,
    state: attempt.state,
  });

  log.info("[connectors] linear oauth started", {
    clerkOrgId: identity.orgId,
    mode,
    provider: "linear",
  });

  return { authorizationUrl, mode };
}

async function finalizeLinearConnection(input: {
  appOrigin: string;
  attempt: ConnectorOAuthAttemptRecord;
  code: string;
}) {
  const config = requireLinearConnectorConfig({ appOrigin: input.appOrigin });
  const token = await exchangeLinearOAuthCode({
    callbackUrl: new URL(
      LINEAR_OAUTH_CALLBACK_PATH,
      input.appOrigin
    ).toString(),
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code: input.code,
    codeVerifier: input.attempt.codeVerifier,
    tokenUrl: config.endpoints.oauthTokenUrl,
  });

  try {
    const [metadata, toolManifest] = await Promise.all([
      getLinearViewerMetadata({
        accessToken: token.accessToken,
        viewerUrl: config.endpoints.viewerUrl,
      }),
      listLinearMcpTools({
        accessToken: token.accessToken,
        endpoint: config.endpoints.mcpEndpoint,
      }),
    ]);
    const previousCurrent = await getCurrentOrgConnectorConnection(appDb, {
      clerkOrgId: input.attempt.clerkOrgId,
      provider: "linear",
    });
    if (previousCurrent) {
      await revokeLinearConnectionTokens({
        clerkOrgId: input.attempt.clerkOrgId,
        config,
        connection: previousCurrent,
        logMessage: "[connectors] linear revoke failed during reconnect",
      });
    }

    await finalizeCurrentOrgConnectorConnection(appDb, {
      accessTokenExpiresAt: expiresAtFromSeconds(token.accessTokenExpiresIn),
      clerkOrgId: input.attempt.clerkOrgId,
      connectedByUserId: input.attempt.lightfastUserId,
      encryptedAccessToken: await encryptedToken(token.accessToken),
      encryptedRefreshToken: token.refreshToken
        ? await encryptedToken(token.refreshToken)
        : null,
      mcpEndpoint: config.endpoints.mcpEndpoint,
      metadata: { mode: input.attempt.mode },
      observedCurrentConnectionId: previousCurrent?.id ?? null,
      observedEncryptedAccessToken:
        previousCurrent?.encryptedAccessToken ?? null,
      observedEncryptedRefreshToken:
        previousCurrent?.encryptedRefreshToken ?? null,
      provider: "linear",
      providerActorId: metadata.actorId ?? null,
      providerActorName: metadata.actorName ?? null,
      providerWorkspaceId: metadata.workspaceId,
      providerWorkspaceName: metadata.workspaceName,
      refreshTokenExpiresAt: expiresAtFromSeconds(token.refreshTokenExpiresIn),
      scopes: token.scopes,
      toolManifest,
    });
  } catch (error) {
    await revokeDroppedLinearTokens({
      clerkOrgId: input.attempt.clerkOrgId,
      config,
      reason: "post_exchange_failure",
      tokens: [
        { kind: "access", token: token.accessToken },
        { kind: "refresh", token: token.refreshToken },
      ],
    });
    log.warn("[connectors] linear post-exchange finalize failed", {
      clerkOrgId: input.attempt.clerkOrgId,
      failure: safeErrorDetails(error),
      provider: "linear",
    });
    throw error;
  }
}

export async function completeLinearConnectorOAuth(input: {
  appOrigin?: string;
  requestUrl: string;
}): Promise<LinearRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveConnectorAppOrigin();
  const parsed = parseLinearCallback(input.requestUrl);

  if (!(parsed.state && (parsed.code || parsed.denied))) {
    return missingAttemptRedirect({ appOrigin });
  }

  const pendingAttempt = await lookupConnectorOAuthAttempt({
    provider: "linear",
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
      code: mapLinearOAuthError(error),
      orgSlug: pendingAttempt.orgSlug,
    });
  }

  const attempt = await consumeConnectorOAuthAttempt({
    provider: "linear",
    state: parsed.state,
  });
  if (!attempt) {
    return missingAttemptRedirect({ appOrigin });
  }

  if (parsed.denied || !parsed.code) {
    return errorRedirect({
      appOrigin,
      code: "linear_authorization_denied",
      orgSlug: attempt.orgSlug,
    });
  }

  try {
    await finalizeLinearConnection({
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
      code: mapLinearOAuthError(error),
      orgSlug: attempt.orgSlug,
    });
  }
}

export async function refreshLinearConnectorTools(
  ctx: ConnectorServiceContext
) {
  const identity = activeIdentity(ctx);
  const config = requireLinearConnectorConfig();
  const connection = await getCurrentOrgConnectorConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: "linear",
  });
  if (!connection) {
    throw new NotFoundError(
      "CONNECTOR_NOT_CONNECTED",
      "Linear connector is not connected."
    );
  }

  let accessToken: string;
  let mcpEndpoint = connection.mcpEndpoint || config.endpoints.mcpEndpoint;
  try {
    accessToken = await getFreshLinearConnectorAccessToken({
      config,
      connection,
      db: ctx.db,
    });
  } catch (error) {
    if (
      error instanceof LinearAppNodeError &&
      error.code === "LINEAR_TOKEN_REFRESH_FAILED"
    ) {
      const winner = await getConcurrentRefreshWinner({
        connection,
        db: ctx.db,
      });
      if (winner) {
        accessToken = winner.accessToken;
        mcpEndpoint =
          winner.connection.mcpEndpoint || config.endpoints.mcpEndpoint;
      } else {
        await markCurrentOrgConnectorConnectionError(ctx.db, {
          clerkOrgId: identity.orgId,
          provider: "linear",
        });
        log.warn("[connectors] linear auth refresh failed", {
          clerkOrgId: identity.orgId,
          failure: safeErrorDetails(error),
          provider: "linear",
        });
        return { refreshed: false, status: "auth_error" as const };
      }
    } else {
      await markCurrentOrgConnectorConnectionError(ctx.db, {
        clerkOrgId: identity.orgId,
        provider: "linear",
      });
      log.warn("[connectors] linear auth refresh failed", {
        clerkOrgId: identity.orgId,
        failure: safeErrorDetails(error),
        provider: "linear",
      });
      return { refreshed: false, status: "auth_error" as const };
    }
  }

  try {
    const toolManifest = await listLinearMcpTools({
      accessToken,
      endpoint: mcpEndpoint,
    });
    await updateConnectorToolManifest(ctx.db, {
      clerkOrgId: identity.orgId,
      lastToolRefreshAt: new Date(),
      provider: "linear",
      toolManifest,
    });
    return { refreshed: true, status: "ok" as const, toolManifest };
  } catch (error) {
    if (
      error instanceof LinearAppNodeError &&
      error.code !== "LINEAR_TOKEN_REFRESH_FAILED"
    ) {
      await recordConnectorToolRefreshError(ctx.db, {
        clerkOrgId: identity.orgId,
        lastToolRefreshErrorAt: new Date(),
        lastToolRefreshErrorCode: error.code,
        provider: "linear",
      });
      log.warn("[connectors] linear tool refresh failed", {
        clerkOrgId: identity.orgId,
        code: error.code,
        failure: safeErrorDetails(error),
        provider: "linear",
      });
      return { refreshed: false, status: "refresh_error" as const };
    }

    await markCurrentOrgConnectorConnectionError(ctx.db, {
      clerkOrgId: identity.orgId,
      provider: "linear",
    });
    log.warn("[connectors] linear auth refresh failed", {
      clerkOrgId: identity.orgId,
      failure: safeErrorDetails(error),
      provider: "linear",
    });
    return { refreshed: false, status: "auth_error" as const };
  }
}

export async function setLinearConnectorAutomationEnabled(
  ctx: ConnectorServiceContext,
  input: { enabled: boolean }
) {
  const identity = activeIdentity(ctx);
  const updated = await setConnectorAutomationEnabledInDb(ctx.db, {
    clerkOrgId: identity.orgId,
    enabled: input.enabled,
    provider: "linear",
  });
  if (!updated) {
    throw new NotFoundError(
      "CONNECTOR_NOT_CONNECTED",
      "Linear connector is not connected."
    );
  }
  return { enabled: input.enabled };
}

export async function setLinearConnectorAgentEnabled(
  ctx: ConnectorServiceContext,
  input: { enabled: boolean }
) {
  const identity = activeIdentity(ctx);
  const updated = await setConnectorAgentEnabledInDb(ctx.db, {
    clerkOrgId: identity.orgId,
    enabled: input.enabled,
    provider: "linear",
  });
  if (!updated) {
    throw new NotFoundError(
      "CONNECTOR_NOT_CONNECTED",
      "Linear connector is not connected."
    );
  }
  return { enabled: input.enabled };
}

export async function disconnectLinearConnector(ctx: ConnectorServiceContext) {
  const identity = activeIdentity(ctx);
  const configResult = (() => {
    try {
      return requireLinearConnectorConfig();
    } catch {
      return null;
    }
  })();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const connection = await getCurrentOrgConnectorConnection(ctx.db, {
      clerkOrgId: identity.orgId,
      provider: "linear",
    });
    if (!connection) {
      break;
    }

    if (
      configResult &&
      (connection.encryptedAccessToken || connection.encryptedRefreshToken)
    ) {
      await revokeLinearConnectionTokens({
        clerkOrgId: identity.orgId,
        config: configResult,
        connection,
        logMessage: "[connectors] linear revoke failed during disconnect",
      });
    }

    const revoked = await markCurrentOrgConnectorConnectionRevoked(ctx.db, {
      clerkOrgId: identity.orgId,
      observedCurrentConnectionId: connection.id,
      observedEncryptedAccessToken: connection.encryptedAccessToken,
      observedEncryptedRefreshToken: connection.encryptedRefreshToken,
      provider: "linear",
    });
    if (revoked) {
      break;
    }
  }

  return { disconnected: true };
}
