import {
  createUserConnectorToolCall,
  getCurrentUserConnectorConnection,
  listCurrentUserConnectorConnections,
  markCurrentUserConnectorConnectionError,
  markUserConnectorToolCallFailed,
  markUserConnectorToolCallProviderAttempted,
  markUserConnectorToolCallSucceeded,
  type Database,
  type UserConnectorToolCall,
  type UserConnectorToolCallRedactedPayload,
  type UserConnectorConnection,
  updateObservedUserConnectorTokens,
} from "@db/app";
import { decrypt, encrypt } from "@repo/app-encryption";
import {
  callGranolaMcpTool,
  GranolaAppNodeError,
  GranolaOAuthClientProvider,
  granolaClientMetadata,
} from "@repo/granola-app-node";
import {
  parseUserConnectorRoutineId,
  type UserConnectorCallInput,
  type UserConnectorCallSuccess,
  userConnectorCallInputSchema,
  type UserConnectorFindInput,
  type UserConnectorFindOutput,
  userConnectorFindInputSchema,
  userConnectorRoutineId,
  type UserConnectorRoutineSummary,
} from "@repo/user-connector-contract";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@vendor/mcp";
import { log } from "@vendor/observability/log/next";
import { env } from "../../env";

const GRANOLA_OAUTH_CALLBACK_PATH =
  "/api/connectors/granola/oauth/callback";
const LOCAL_GRANOLA_CALLBACK_URL =
  "https://app.lightfast.localhost/api/connectors/granola/oauth/callback";

export interface UserConnectorChatContext {
  actor: {
    orgId: string;
    userId: string;
  };
  db: Database;
  now: () => Date;
  source: {
    conversationId: string;
    surface: "interactive_chat";
  };
}

interface UserConnectorToolCallAuditLogContext {
  calledByUserId: string;
  clerkOrgId: string | null;
  provider: UserConnectorToolCall["provider"];
  providerToolName: string;
  routineId: string;
  sourceRef: string | null;
  sourceSurface: UserConnectorToolCall["sourceSurface"];
}

export async function findUserConnectorTools(
  context: UserConnectorChatContext,
  input: UserConnectorFindInput
): Promise<UserConnectorFindOutput> {
  const parsed = userConnectorFindInputSchema.parse(input);
  const connections = await listCurrentUserConnectorConnections(context.db, {
    clerkUserId: context.actor.userId,
  });
  const activeConnections = connections.filter(isActiveConnection);

  if (activeConnections.length === 0) {
    return { reason: "no_connected_user_connectors", routines: [] };
  }

  const query = parsed.query?.toLowerCase();
  const routines = activeConnections
    .flatMap((connection) => summarizeConnectionTools(connection, parsed))
    .filter((routine) => {
      if (parsed.provider && routine.provider !== parsed.provider) {
        return false;
      }
      if (parsed.routineId && routine.routineId !== parsed.routineId) {
        return false;
      }
      if (!query) {
        return true;
      }
      return searchableRoutineText(routine).some((value) =>
        value.toLowerCase().includes(query)
      );
    })
    .slice(0, parsed.limit ?? 10);

  if (routines.length === 0) {
    return { reason: "no_matching_tools", routines: [] };
  }

  return { routines };
}

export async function callUserConnectorTool(
  context: UserConnectorChatContext,
  input: UserConnectorCallInput
): Promise<UserConnectorCallSuccess> {
  const parsed = userConnectorCallInputSchema.parse(input);
  const { provider, providerToolName } = parseUserConnectorRoutineId(
    parsed.routineId
  );
  const connection = await getCurrentUserConnectorConnection(context.db, {
    clerkUserId: context.actor.userId,
    provider,
  });

  if (!connection || !isActiveConnection(connection)) {
    throw new Error(
      `${userConnectorProviderDisplayName(provider)} connector is not connected for this user.`
    );
  }

  if (!hasProviderTool(connection, providerToolName)) {
    throw new Error(`User connector routine ${parsed.routineId} was not found.`);
  }

  const auditLogContext = {
    calledByUserId: context.actor.userId,
    clerkOrgId: context.actor.orgId,
    provider,
    providerToolName,
    routineId: parsed.routineId,
    sourceRef: context.source.conversationId,
    sourceSurface: context.source.surface,
  } satisfies UserConnectorToolCallAuditLogContext;
  const toolCallAudit = await safelyCreateUserConnectorToolCall(context, {
    calledByUserId: auditLogContext.calledByUserId,
    clerkOrgId: auditLogContext.clerkOrgId,
    inputRedacted: redactedPresence(parsed.input),
    provider: auditLogContext.provider,
    providerConnectionId: connection.id,
    providerToolName: auditLogContext.providerToolName,
    routineId: auditLogContext.routineId,
    sourceRef: auditLogContext.sourceRef,
    sourceSurface: auditLogContext.sourceSurface,
    startedAt: context.now(),
  });

  try {
    const authState = await authProviderForConnection(connection);
    await safelyMarkUserConnectorToolCallProviderAttempted(
      context,
      toolCallAudit,
      auditLogContext
    );
    const result = await callGranolaMcpTool({
      authProvider: authState.authProvider,
      endpoint: connection.mcpEndpoint,
      input: parsed.input,
      name: providerToolName,
    });

    await persistRefreshedTokens(context, connection, authState);
    await safelyMarkUserConnectorToolCallSucceeded(
      context,
      toolCallAudit,
      auditLogContext,
      redactedPresence(result)
    );

    return {
      provider,
      providerToolName,
      result,
      routineId: parsed.routineId,
      status: "succeeded",
    };
  } catch (error) {
    if (isGranolaAuthRequired(error)) {
      await safelyMarkCurrentUserConnectorConnectionError(context, connection);
    }
    await safelyMarkUserConnectorToolCallFailed(
      context,
      toolCallAudit,
      auditLogContext,
      error
    );
    throw error;
  }
}

function summarizeConnectionTools(
  connection: UserConnectorConnection,
  input: ReturnType<typeof userConnectorFindInputSchema.parse>
): UserConnectorRoutineSummary[] {
  return connection.toolManifest.flatMap((tool) => {
    try {
      const routineId = userConnectorRoutineId(connection.provider, tool.name);
      return [
        {
          ...(tool.description !== undefined
            ? { description: tool.description }
            : {}),
          ...(input.includeSchema && tool.inputSchema !== undefined
            ? { inputSchema: tool.inputSchema }
            : {}),
          provider: connection.provider,
          providerToolName: tool.name,
          routineId,
          title: titleFromToolName(tool.name),
        },
      ];
    } catch {
      return [];
    }
  });
}

async function authProviderForConnection(connection: UserConnectorConnection) {
  const accessToken = connection.encryptedAccessToken
    ? await decrypt(connection.encryptedAccessToken, env.ENCRYPTION_KEY)
    : undefined;
  const refreshToken = connection.encryptedRefreshToken
    ? await decrypt(connection.encryptedRefreshToken, env.ENCRYPTION_KEY)
    : undefined;
  const redirectUrl = granolaRedirectUrl();
  const originalTokens = accessToken
    ? {
        access_token: accessToken,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        token_type: "Bearer",
      }
    : undefined;

  const authProvider = new GranolaOAuthClientProvider({
    clientInformation: oauthClientInformationFromMetadata(connection.metadata),
    clientMetadata: granolaClientMetadata({ redirectUrl }),
    codeVerifier: undefined,
    onAuthorizationUrl: () => undefined,
    redirectUrl,
    tokens: originalTokens,
  });

  return { authProvider, originalTokens };
}

async function safelyMarkCurrentUserConnectorConnectionError(
  context: UserConnectorChatContext,
  connection: UserConnectorConnection
) {
  await markCurrentUserConnectorConnectionError(context.db, {
    clerkUserId: context.actor.userId,
    observedCurrentConnectionId: connection.id,
    observedEncryptedAccessToken: connection.encryptedAccessToken ?? null,
    observedEncryptedRefreshToken: connection.encryptedRefreshToken ?? null,
    provider: connection.provider,
  }).catch(() => undefined);
}

async function safelyCreateUserConnectorToolCall(
  context: UserConnectorChatContext,
  input: Parameters<typeof createUserConnectorToolCall>[1]
) {
  try {
    return await createUserConnectorToolCall(context.db, input);
  } catch (error) {
    log.warn("[user-connectors] tool call audit create failed", {
      calledByUserId: input.calledByUserId,
      clerkOrgId: input.clerkOrgId ?? null,
      failure: safeAuditFailureDetails(error),
      provider: input.provider,
      providerToolName: input.providerToolName,
      routineId: input.routineId,
      sourceRef: input.sourceRef ?? null,
      sourceSurface: input.sourceSurface,
      success: false,
    });
    return null;
  }
}

async function safelyMarkUserConnectorToolCallProviderAttempted(
  context: UserConnectorChatContext,
  toolCall: UserConnectorToolCall | null,
  auditLogContext: UserConnectorToolCallAuditLogContext
) {
  if (!toolCall) {
    return;
  }

  try {
    await markUserConnectorToolCallProviderAttempted(context.db, {
      calledByUserId: context.actor.userId,
      publicId: toolCall.publicId,
    });
  } catch (error) {
    log.warn("[user-connectors] tool call audit attempted update failed", {
      ...auditLogContext,
      auditPublicId: toolCall.publicId,
      failure: safeAuditFailureDetails(error),
      success: false,
    });
  }
}

async function safelyMarkUserConnectorToolCallSucceeded(
  context: UserConnectorChatContext,
  toolCall: UserConnectorToolCall | null,
  auditLogContext: UserConnectorToolCallAuditLogContext,
  outputRedacted: UserConnectorToolCallRedactedPayload
) {
  if (!toolCall) {
    return;
  }

  try {
    await markUserConnectorToolCallSucceeded(context.db, {
      calledByUserId: context.actor.userId,
      finishedAt: context.now(),
      outputRedacted,
      publicId: toolCall.publicId,
    });
  } catch (error) {
    log.warn("[user-connectors] tool call audit succeeded update failed", {
      ...auditLogContext,
      auditPublicId: toolCall.publicId,
      failure: safeAuditFailureDetails(error),
      success: false,
    });
  }
}

async function safelyMarkUserConnectorToolCallFailed(
  context: UserConnectorChatContext,
  toolCall: UserConnectorToolCall | null,
  auditLogContext: UserConnectorToolCallAuditLogContext,
  error: unknown
) {
  if (!toolCall) {
    return;
  }

  const errorCode = userConnectorToolCallErrorCode(error);
  const errorMessage = safeUserConnectorToolCallErrorMessage(error);
  try {
    await markUserConnectorToolCallFailed(context.db, {
      calledByUserId: context.actor.userId,
      finishedAt: context.now(),
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
      publicId: toolCall.publicId,
    });
  } catch (auditError) {
    log.warn("[user-connectors] tool call audit failed update failed", {
      ...auditLogContext,
      auditPublicId: toolCall.publicId,
      failure: safeAuditFailureDetails(auditError),
      success: false,
    });
  }
}

async function persistRefreshedTokens(
  context: UserConnectorChatContext,
  connection: UserConnectorConnection,
  authState: {
    authProvider: GranolaOAuthClientProvider;
    originalTokens: OAuthTokens | undefined;
  }
) {
  const snapshotTokens = authState.authProvider.snapshot().tokens;
  if (!isOAuthTokens(snapshotTokens)) {
    return;
  }

  const now = context.now();
  const accessTokenExpiresAt = snapshotTokens.expires_in
    ? new Date(now.getTime() + snapshotTokens.expires_in * 1000)
    : connection.accessTokenExpiresAt;
  const refreshTokenExpiresAt = connection.refreshTokenExpiresAt;
  const shouldPersist =
    tokensChanged(snapshotTokens, authState.originalTokens) ||
    !sameDate(accessTokenExpiresAt, connection.accessTokenExpiresAt);

  if (!shouldPersist) {
    return;
  }

  const encryptedAccessToken =
    snapshotTokens.access_token === authState.originalTokens?.access_token &&
    connection.encryptedAccessToken
      ? connection.encryptedAccessToken
      : await encrypt(snapshotTokens.access_token, env.ENCRYPTION_KEY);
  const refreshToken =
    snapshotTokens.refresh_token ?? authState.originalTokens?.refresh_token;
  const encryptedRefreshToken =
    refreshToken === undefined
      ? null
      : refreshToken === authState.originalTokens?.refresh_token &&
          connection.encryptedRefreshToken
        ? connection.encryptedRefreshToken
        : await encrypt(refreshToken, env.ENCRYPTION_KEY);

  await updateObservedUserConnectorTokens(context.db, {
    accessTokenExpiresAt,
    clerkUserId: context.actor.userId,
    encryptedAccessToken,
    encryptedRefreshToken,
    id: connection.id,
    observedEncryptedAccessToken: connection.encryptedAccessToken ?? null,
    observedEncryptedRefreshToken: connection.encryptedRefreshToken ?? null,
    refreshTokenExpiresAt,
    updatedAt: now,
  }).catch(() => false);
}

function searchableRoutineText(routine: UserConnectorRoutineSummary) {
  return [
    routine.description,
    routine.provider,
    routine.providerToolName,
    routine.routineId,
    routine.title,
  ].filter((value): value is string => typeof value === "string");
}

function hasProviderTool(
  connection: UserConnectorConnection,
  providerToolName: string
) {
  return connection.toolManifest.some((tool) => tool.name === providerToolName);
}

function isActiveConnection(connection: UserConnectorConnection) {
  return connection.status === "active";
}

function isGranolaAuthRequired(error: unknown) {
  return (
    error instanceof GranolaAppNodeError &&
    error.code === "GRANOLA_MCP_AUTH_REQUIRED"
  );
}

function redactedPresence(
  value: unknown
): UserConnectorToolCallRedactedPayload {
  return value === undefined ? null : { present: true };
}

function userConnectorToolCallErrorCode(error: unknown) {
  return error instanceof GranolaAppNodeError ? error.code : undefined;
}

function safeUserConnectorToolCallErrorMessage(error: unknown) {
  if (!(error instanceof GranolaAppNodeError)) {
    return undefined;
  }

  switch (error.code) {
    case "GRANOLA_MCP_AUTH_REQUIRED":
      return "Granola authorization is required.";
    case "GRANOLA_MCP_FAILED":
      return "Granola MCP tool call failed.";
    case "GRANOLA_TOKEN_REFRESH_FAILED":
      return "Granola OAuth token refresh failed.";
    default:
      return undefined;
  }
}

function safeAuditFailureDetails(error: unknown) {
  const details: {
    code?: string;
    message?: string;
    name?: string;
    type: string;
  } = { type: typeof error };

  if (error && typeof error === "object") {
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string") {
      details.name = name;
    }
  }

  const code = userConnectorToolCallErrorCode(error);
  if (code !== undefined) {
    details.code = code;
  }

  const message = safeUserConnectorToolCallErrorMessage(error);
  if (message !== undefined) {
    details.message = message;
  }

  return details;
}

function oauthClientInformationFromMetadata(
  metadata: Record<string, unknown>
): OAuthClientInformationMixed | undefined {
  const clientInformation = metadata.oauthClientInformation;
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

function isOAuthTokens(tokens: unknown): tokens is OAuthTokens {
  return (
    !!tokens &&
    typeof tokens === "object" &&
    "access_token" in tokens &&
    "token_type" in tokens &&
    typeof tokens.access_token === "string" &&
    typeof tokens.token_type === "string"
  );
}

function tokensChanged(
  nextTokens: OAuthTokens,
  originalTokens: OAuthTokens | undefined
) {
  if (!originalTokens) {
    return true;
  }

  return (
    nextTokens.access_token !== originalTokens.access_token ||
    nextTokens.token_type !== originalTokens.token_type ||
    (nextTokens.refresh_token !== undefined &&
      nextTokens.refresh_token !== originalTokens.refresh_token)
  );
}

function sameDate(left: Date | null, right: Date | null) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function granolaRedirectUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return LOCAL_GRANOLA_CALLBACK_URL;
  }

  try {
    return new URL(GRANOLA_OAUTH_CALLBACK_PATH, new URL(appUrl).origin)
      .toString();
  } catch {
    return LOCAL_GRANOLA_CALLBACK_URL;
  }
}

function titleFromToolName(providerToolName: string) {
  return providerToolName
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function userConnectorProviderDisplayName(provider: "granola") {
  switch (provider) {
    case "granola":
      return "Granola";
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }
}
