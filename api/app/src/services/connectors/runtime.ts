import {
  createProviderRoutineCall,
  getCurrentOrgConnectorConnection,
  listCurrentOrgConnectorConnections,
  markCurrentOrgConnectorConnectionError,
  markProviderRoutineCallFailed,
  markProviderRoutineCallProviderAttempted,
  markProviderRoutineCallSucceeded,
  type OrgConnectorConnection,
  type ProviderRoutineCall,
  type ProviderRoutineCallRedactedPayload,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import {
  type ConnectableConnectorProvider,
  connectorRuntimeToolName,
} from "@repo/connector-contract";
import { callLinearMcpTool, LinearAppNodeError } from "@repo/linear-app-node";
import { callXBridgeMcpTool, XAppNodeError } from "@repo/x-app-node";
import { log } from "@vendor/observability/log/next";

import { requireXConnectorConfig } from "./config";
import { getFreshLinearConnectorAccessToken } from "./linear-flow";
import { issueConnectorMcpToken } from "./mcp-auth";

export interface ConnectorRuntimeToolSource {
  call(input: unknown): Promise<unknown>;
  callWithMetadata(input: unknown): Promise<ConnectorRuntimeToolCallResult>;
  description?: string;
  inputSchema?: unknown;
  provider: ConnectableConnectorProvider;
  providerToolName: string;
  runtimeToolName: string;
}

export interface ConnectorRuntimeToolCallResult {
  provider: ConnectableConnectorProvider;
  providerRoutineCallId: string | null;
  providerToolName: string;
  result: unknown;
  routineId: string;
  runtimeToolName: string;
}

export class ConnectorRuntimeToolCallError extends Error {
  readonly code: string | undefined;
  readonly provider: ConnectableConnectorProvider;
  readonly providerRoutineCallId: string | null;
  readonly providerToolName: string;
  readonly routineId: string;
  readonly runtimeToolName: string;

  constructor(input: {
    cause: unknown;
    code: string | undefined;
    message: string;
    provider: ConnectableConnectorProvider;
    providerRoutineCallId: string | null;
    providerToolName: string;
    routineId: string;
    runtimeToolName: string;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ConnectorRuntimeToolCallError";
    this.code = input.code;
    this.provider = input.provider;
    this.providerRoutineCallId = input.providerRoutineCallId;
    this.providerToolName = input.providerToolName;
    this.routineId = input.routineId;
    this.runtimeToolName = input.runtimeToolName;
  }
}

export type ConnectorRuntimeEnabledFor = "agents" | "automations";

export type ConnectorRuntimeSourceSurface =
  | "automation"
  | "chat"
  | "hosted_mcp"
  | "native_cli"
  | "system";

export interface LoadConnectorRuntimeToolsInput {
  automationPublicId?: string;
  calledByUserId?: string | null;
  clerkOrgId: string;
  enabledFor?: ConnectorRuntimeEnabledFor;
  runPublicId?: string;
  sourceClientId?: string | null;
  sourceRef?: string | null;
  sourceSurface?: ConnectorRuntimeSourceSurface;
}

interface RuntimeToolCallContext {
  automationPublicId?: string;
  calledByUserId?: string | null;
  clerkOrgId: string;
  enabledFor: ConnectorRuntimeEnabledFor;
  provider: ConnectableConnectorProvider;
  providerToolName: string;
  runPublicId?: string;
  runtimeToolName: string;
  sourceClientId?: string | null;
  sourceRef?: string | null;
  sourceSurface: ConnectorRuntimeSourceSurface;
}

export async function loadConnectorRuntimeTools(
  input: LoadConnectorRuntimeToolsInput
): Promise<ConnectorRuntimeToolSource[]> {
  const connections = await listCurrentOrgConnectorConnections(appDb, {
    clerkOrgId: input.clerkOrgId,
  });
  const enabledFor = input.enabledFor ?? "automations";
  const sourceSurface =
    input.sourceSurface ?? (input.runPublicId ? "automation" : "system");

  return connections.flatMap((connection) => {
    if (!isActiveEnabledConnection(connection, enabledFor)) {
      return [];
    }

    return connection.toolManifest.flatMap((tool) => {
      const runtimeToolName = safeRuntimeToolName(
        connection.provider,
        tool.name
      );
      if (!runtimeToolName) {
        return [];
      }

      const callWithMetadata = (toolInput: unknown) =>
        callConnectorRuntimeTool(toolInput, {
          automationPublicId: input.automationPublicId,
          calledByUserId: input.calledByUserId,
          clerkOrgId: input.clerkOrgId,
          enabledFor,
          provider: connection.provider,
          providerToolName: tool.name,
          runPublicId: input.runPublicId,
          runtimeToolName,
          sourceClientId: input.sourceClientId,
          sourceRef: input.sourceRef,
          sourceSurface,
        });

      return [
        {
          call: async (toolInput: unknown) =>
            (await callWithMetadata(toolInput)).result,
          callWithMetadata,
          description: tool.description,
          inputSchema: tool.inputSchema,
          provider: connection.provider,
          providerToolName: tool.name,
          runtimeToolName,
        },
      ];
    });
  });
}

async function callConnectorRuntimeTool(
  input: unknown,
  context: RuntimeToolCallContext
): Promise<ConnectorRuntimeToolCallResult> {
  const logContext = {
    automationPublicId: context.automationPublicId,
    clerkOrgId: context.clerkOrgId,
    provider: context.provider,
    providerToolName: context.providerToolName,
    runPublicId: context.runPublicId,
    runtimeToolName: context.runtimeToolName,
  };
  let providerRoutineCall: ProviderRoutineCall | null = null;

  try {
    const connection = await getCurrentOrgConnectorConnection(appDb, {
      clerkOrgId: context.clerkOrgId,
      provider: context.provider,
    });
    if (
      !(
        connection &&
        isActiveEnabledConnection(connection, context.enabledFor) &&
        hasValidCurrentTool(connection, context.providerToolName)
      )
    ) {
      throw new Error(
        `${connectorDisplayName(context.provider)} connector is not active for ${context.enabledFor}.`
      );
    }

    const caller = calledByContext(context);
    providerRoutineCall = await safelyCreateProviderRoutineCall({
      calledById: caller.calledById,
      calledByKind: caller.calledByKind,
      calledByUserId: caller.calledByUserId,
      clerkOrgId: context.clerkOrgId,
      providerConnectionId: connection.id,
      inputRedacted: redactedPresence(input),
      provider: context.provider,
      providerActorId: connection.providerActorId,
      providerToolName: context.providerToolName,
      providerWorkspaceId: connection.providerWorkspaceId,
      routineId: context.runtimeToolName,
      sourceClientId: context.sourceClientId ?? null,
      sourceRef: context.sourceRef ?? caller.calledById,
      sourceSurface: context.sourceSurface,
    });

    if (!providerRoutineCall && context.sourceSurface !== "system") {
      throw new ConnectorRuntimeToolCallError({
        cause: new Error("Provider routine call ledger row was not created."),
        code: "PROVIDER_ROUTINE_LEDGER_FAILED",
        message: "Provider routine call could not be recorded.",
        provider: context.provider,
        providerRoutineCallId: null,
        providerToolName: context.providerToolName,
        routineId: context.runtimeToolName,
        runtimeToolName: context.runtimeToolName,
      });
    }

    const result = await callProviderRuntimeTool(
      input,
      connection,
      context,
      providerRoutineCall,
      logContext
    );

    if (providerRoutineCall) {
      await safelyMarkProviderRoutineCallSucceeded(
        {
          clerkOrgId: context.clerkOrgId,
          outputRedacted: redactedPresence(result),
          publicId: providerRoutineCall.publicId,
        },
        logContext
      );
    }

    log.info("[connectors] runtime tool call completed", {
      ...logContext,
      success: true,
    });
    return {
      provider: context.provider,
      providerRoutineCallId: providerRoutineCall?.publicId ?? null,
      providerToolName: context.providerToolName,
      result,
      routineId: context.runtimeToolName,
      runtimeToolName: context.runtimeToolName,
    };
  } catch (error) {
    if (providerRoutineCall) {
      await safelyMarkProviderRoutineCallFailed(
        {
          clerkOrgId: context.clerkOrgId,
          errorCode: getErrorCode(error),
          errorMessage: safeProviderRoutineCallErrorMessage(error),
          publicId: providerRoutineCall.publicId,
        },
        logContext
      );
    }

    if (isTerminalConnectorAuthError(context.provider, error)) {
      await safelyMarkCurrentOrgConnectorConnectionError(
        {
          clerkOrgId: context.clerkOrgId,
          provider: context.provider,
        },
        logContext
      );
    }

    log.warn("[connectors] runtime tool call failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      success: false,
    });
    if (error instanceof ConnectorRuntimeToolCallError) {
      throw error;
    }

    throw new ConnectorRuntimeToolCallError({
      cause: error,
      code: getErrorCode(error),
      message: runtimeToolCallErrorMessage(error),
      provider: context.provider,
      providerRoutineCallId: providerRoutineCall?.publicId ?? null,
      providerToolName: context.providerToolName,
      routineId: context.runtimeToolName,
      runtimeToolName: context.runtimeToolName,
    });
  }
}

function calledByContext(context: RuntimeToolCallContext) {
  if (context.sourceSurface === "automation" && context.runPublicId) {
    return {
      calledById: context.runPublicId,
      calledByKind: "automation" as const,
      calledByUserId: context.calledByUserId ?? null,
    };
  }

  if (context.calledByUserId) {
    return {
      calledById: context.sourceRef ?? context.calledByUserId,
      calledByKind: "user" as const,
      calledByUserId: context.calledByUserId,
    };
  }

  return {
    calledById: context.sourceRef ?? "connector-runtime",
    calledByKind: "system" as const,
    calledByUserId: null,
  };
}

async function safelyMarkCurrentOrgConnectorConnectionError(
  input: {
    clerkOrgId: string;
    provider: ConnectableConnectorProvider;
  },
  logContext: Record<string, unknown>
) {
  try {
    await markCurrentOrgConnectorConnectionError(appDb, input);
  } catch (error) {
    log.warn("[connectors] connector connection error mark failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      success: false,
    });
  }
}

async function safelyCreateProviderRoutineCall(input: {
  calledById: string;
  calledByKind: "automation" | "system" | "user";
  calledByUserId: string | null;
  clerkOrgId: string;
  providerConnectionId: number;
  inputRedacted: ProviderRoutineCallRedactedPayload;
  provider: ConnectableConnectorProvider;
  providerActorId: string | null;
  providerToolName: string;
  providerWorkspaceId: string | null;
  routineId: string;
  sourceClientId: string | null;
  sourceRef: string | null;
  sourceSurface: ConnectorRuntimeSourceSurface;
}) {
  try {
    return await createProviderRoutineCall(appDb, input);
  } catch (error) {
    log.warn("[connectors] provider routine call ledger create failed", {
      clerkOrgId: input.clerkOrgId,
      failure: safeErrorDetails(error),
      provider: input.provider,
      providerToolName: input.providerToolName,
      routineId: input.routineId,
      success: false,
    });
    return null;
  }
}

async function safelyMarkProviderRoutineCallProviderAttempted(
  input: {
    clerkOrgId: string;
    publicId: string;
  },
  logContext: Record<string, unknown>
) {
  try {
    await markProviderRoutineCallProviderAttempted(appDb, input);
  } catch (error) {
    log.warn("[connectors] provider routine call attempted update failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      providerRoutineCallPublicId: input.publicId,
      success: false,
    });
  }
}

async function safelyMarkProviderRoutineCallSucceeded(
  input: {
    clerkOrgId: string;
    outputRedacted: ProviderRoutineCallRedactedPayload;
    publicId: string;
  },
  logContext: Record<string, unknown>
) {
  try {
    await markProviderRoutineCallSucceeded(appDb, input);
  } catch (error) {
    log.warn("[connectors] provider routine call ledger update failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      providerRoutineCallPublicId: input.publicId,
      success: false,
    });
  }
}

async function safelyMarkProviderRoutineCallFailed(
  input: {
    clerkOrgId: string;
    errorCode?: string;
    errorMessage?: string;
    publicId: string;
  },
  logContext: Record<string, unknown>
) {
  try {
    await markProviderRoutineCallFailed(appDb, input);
  } catch (error) {
    log.warn("[connectors] provider routine call ledger update failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      providerRoutineCallPublicId: input.publicId,
      success: false,
    });
  }
}

async function callLinearRuntimeTool(
  input: unknown,
  connection: OrgConnectorConnection,
  context: RuntimeToolCallContext,
  providerRoutineCall: ProviderRoutineCall | null,
  logContext: Record<string, unknown>
) {
  const accessToken = await getFreshLinearConnectorAccessToken({
    connection,
    db: appDb,
  });
  if (providerRoutineCall) {
    await safelyMarkProviderRoutineCallProviderAttempted(
      {
        clerkOrgId: context.clerkOrgId,
        publicId: providerRoutineCall.publicId,
      },
      logContext
    );
  }
  return await callLinearMcpTool({
    accessToken,
    endpoint: connection.mcpEndpoint,
    input: normalizeMcpToolInput(input),
    name: context.providerToolName,
  });
}

async function callXRuntimeTool(
  input: unknown,
  connection: OrgConnectorConnection,
  context: RuntimeToolCallContext,
  providerRoutineCall: ProviderRoutineCall | null,
  logContext: Record<string, unknown>
) {
  const mcpToken = await issueConnectorMcpToken({
    clerkOrgId: context.clerkOrgId,
    connectionId: connection.id,
    provider: context.provider,
    purpose: "call",
    toolName: context.providerToolName,
  });
  if (providerRoutineCall) {
    await safelyMarkProviderRoutineCallProviderAttempted(
      {
        clerkOrgId: context.clerkOrgId,
        publicId: providerRoutineCall.publicId,
      },
      logContext
    );
  }
  const config = requireXConnectorConfig();
  return await callXBridgeMcpTool({
    allowedEndpoint: config.endpoints.mcpEndpoint,
    endpoint: connection.mcpEndpoint,
    input: normalizeMcpToolInput(input),
    mcpToken,
    name: context.providerToolName,
  });
}

function callProviderRuntimeTool(
  input: unknown,
  connection: OrgConnectorConnection,
  context: RuntimeToolCallContext,
  providerRoutineCall: ProviderRoutineCall | null,
  logContext: Record<string, unknown>
) {
  // Keep dispatch explicit so new providers fail loudly at compile-time.
  switch (context.provider) {
    case "linear":
      return callLinearRuntimeTool(
        input,
        connection,
        context,
        providerRoutineCall,
        logContext
      );
    case "x":
      return callXRuntimeTool(
        input,
        connection,
        context,
        providerRoutineCall,
        logContext
      );
    default:
      return assertNever(context.provider);
  }
}

function isActiveEnabledConnection(
  connection: OrgConnectorConnection,
  enabledFor: ConnectorRuntimeEnabledFor
) {
  if (connection.status !== "active") {
    return false;
  }
  return enabledFor === "agents"
    ? connection.enabledForAgents
    : connection.enabledForAutomations;
}

function hasValidCurrentTool(
  connection: OrgConnectorConnection,
  providerToolName: string
) {
  return connection.toolManifest.some(
    (tool) =>
      tool.name === providerToolName &&
      safeRuntimeToolName(connection.provider, tool.name) !== null
  );
}

function safeRuntimeToolName(
  provider: ConnectableConnectorProvider,
  providerToolName: string
) {
  try {
    return connectorRuntimeToolName(provider, providerToolName);
  } catch {
    return null;
  }
}

function normalizeMcpToolInput(input: unknown) {
  if (
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    !(input instanceof Date)
  ) {
    return input as Record<string, unknown>;
  }
  if (input === undefined) {
    return;
  }
  return { input };
}

function redactedPresence(value: unknown): ProviderRoutineCallRedactedPayload {
  if (value === undefined) {
    return null;
  }
  return { present: true };
}

function isTerminalConnectorAuthError(
  provider: ConnectableConnectorProvider,
  error: unknown
) {
  switch (provider) {
    case "linear":
      return (
        error instanceof LinearAppNodeError &&
        error.code === "LINEAR_TOKEN_REFRESH_FAILED"
      );
    case "x":
      return (
        error instanceof XAppNodeError &&
        error.code === "X_TOKEN_REFRESH_FAILED"
      );
    default:
      return assertNever(provider);
  }
}

function getErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
}

function isKnownLinearError(error: unknown) {
  return error instanceof LinearAppNodeError;
}

function isKnownXError(error: unknown) {
  return error instanceof XAppNodeError;
}

function safeLinearErrorMessage(error: unknown) {
  switch (getErrorCode(error)) {
    case "LINEAR_TOKEN_REFRESH_FAILED":
      return "Linear OAuth token refresh failed.";
    case "LINEAR_MCP_FAILED":
      return "Linear MCP tool call failed.";
    default:
      return;
  }
}

function safeXErrorMessage(error: unknown) {
  switch (getErrorCode(error)) {
    case "X_TOKEN_REFRESH_FAILED":
      return "X OAuth token refresh failed.";
    case "X_MCP_FAILED":
      return "X MCP tool call failed.";
    default:
      return;
  }
}

function safeProviderRoutineCallErrorMessage(error: unknown) {
  if (isKnownLinearError(error)) {
    return safeLinearErrorMessage(error);
  }
  if (isKnownXError(error)) {
    return safeXErrorMessage(error);
  }
  return;
}

function runtimeToolCallErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Connector runtime tool failed.";
}

function safeErrorDetails(error: unknown) {
  return {
    code: getErrorCode(error),
    message: isKnownLinearError(error)
      ? safeLinearErrorMessage(error)
      : isKnownXError(error)
        ? safeXErrorMessage(error)
        : undefined,
    name: error instanceof Error ? error.name : typeof error,
  };
}

function connectorDisplayName(provider: ConnectableConnectorProvider) {
  switch (provider) {
    case "linear":
      return "Linear";
    case "x":
      return "X";
    default:
      return assertNever(provider);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled connector provider: ${String(value)}`);
}
