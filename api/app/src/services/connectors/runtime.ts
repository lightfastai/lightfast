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
import { connectorRuntimeToolName } from "@repo/connector-contract";
import { callLinearMcpTool, LinearAppNodeError } from "@repo/linear-app-node";
import { log } from "@vendor/observability/log/next";

import { getFreshLinearConnectorAccessToken } from "./linear-flow";

export interface ConnectorRuntimeToolSource {
  call(input: unknown): Promise<unknown>;
  description?: string;
  provider: "linear";
  providerToolName: string;
  runtimeToolName: string;
}

interface RuntimeToolCallContext {
  automationPublicId?: string;
  clerkOrgId: string;
  providerToolName: string;
  runPublicId?: string;
  runtimeToolName: string;
}

export async function loadConnectorRuntimeTools(input: {
  clerkOrgId: string;
  automationPublicId?: string;
  runPublicId?: string;
}): Promise<ConnectorRuntimeToolSource[]> {
  const connections = await listCurrentOrgConnectorConnections(appDb, {
    clerkOrgId: input.clerkOrgId,
  });

  return connections.flatMap((connection) => {
    if (!isActiveAutomationLinearConnection(connection)) {
      return [];
    }

    return connection.toolManifest.flatMap((tool) => {
      const runtimeToolName = safeRuntimeToolName(tool.name);
      if (!runtimeToolName) {
        return [];
      }

      return [
        {
          call: (toolInput: unknown) =>
            callConnectorRuntimeTool(toolInput, {
              automationPublicId: input.automationPublicId,
              clerkOrgId: input.clerkOrgId,
              providerToolName: tool.name,
              runPublicId: input.runPublicId,
              runtimeToolName,
            }),
          description: tool.description,
          provider: "linear" as const,
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
): Promise<unknown> {
  const logContext = {
    automationPublicId: context.automationPublicId,
    clerkOrgId: context.clerkOrgId,
    provider: "linear" as const,
    providerToolName: context.providerToolName,
    runPublicId: context.runPublicId,
    runtimeToolName: context.runtimeToolName,
  };
  let providerRoutineCall: ProviderRoutineCall | null = null;

  try {
    const connection = await getCurrentOrgConnectorConnection(appDb, {
      clerkOrgId: context.clerkOrgId,
      provider: "linear",
    });
    if (
      !(
        connection &&
        isActiveAutomationLinearConnection(connection) &&
        hasValidCurrentTool(connection, context.providerToolName)
      )
    ) {
      throw new Error("Linear connector is not active for automations.");
    }

    const caller = calledByContext(context);
    providerRoutineCall = await safelyCreateProviderRoutineCall({
      calledById: caller.calledById,
      calledByKind: caller.calledByKind,
      calledByUserId: caller.calledByUserId,
      clerkOrgId: context.clerkOrgId,
      providerConnectionId: connection.id,
      inputRedacted: redactedPresence(input),
      provider: "linear",
      providerActorId: connection.providerActorId,
      providerToolName: context.providerToolName,
      providerWorkspaceId: connection.providerWorkspaceId,
      routineId: context.runtimeToolName,
      sourceClientId: null,
      sourceRef: caller.calledById,
      sourceSurface:
        caller.calledByKind === "automation" ? "automation" : "system",
    });

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
    const result = await callLinearMcpTool({
      accessToken,
      endpoint: connection.mcpEndpoint,
      input: normalizeMcpToolInput(input),
      name: context.providerToolName,
    });

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
    return result;
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

    if (isTerminalLinearTokenRefreshError(error)) {
      await markCurrentOrgConnectorConnectionError(appDb, {
        clerkOrgId: context.clerkOrgId,
        provider: "linear",
      });
    }

    log.warn("[connectors] runtime tool call failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      success: false,
    });
    throw error;
  }
}

function calledByContext(context: RuntimeToolCallContext) {
  if (context.runPublicId) {
    return {
      calledById: context.runPublicId,
      calledByKind: "automation" as const,
      calledByUserId: null,
    };
  }

  return {
    calledById: "connector-runtime",
    calledByKind: "system" as const,
    calledByUserId: null,
  };
}

async function safelyCreateProviderRoutineCall(input: {
  calledById: string;
  calledByKind: "automation" | "system" | "user";
  calledByUserId: string | null;
  clerkOrgId: string;
  providerConnectionId: number;
  inputRedacted: ProviderRoutineCallRedactedPayload;
  provider: "linear";
  providerActorId: string | null;
  providerToolName: string;
  providerWorkspaceId: string | null;
  routineId: string;
  sourceClientId: string | null;
  sourceRef: string | null;
  sourceSurface: "automation" | "hosted_mcp" | "native_cli" | "system";
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

function isActiveAutomationLinearConnection(
  connection: OrgConnectorConnection
) {
  return (
    connection.provider === "linear" &&
    connection.status === "active" &&
    connection.enabledForAutomations
  );
}

function hasValidCurrentTool(
  connection: OrgConnectorConnection,
  providerToolName: string
) {
  return connection.toolManifest.some(
    (tool) =>
      tool.name === providerToolName && safeRuntimeToolName(tool.name) !== null
  );
}

function safeRuntimeToolName(providerToolName: string) {
  try {
    return connectorRuntimeToolName("linear", providerToolName);
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

function isTerminalLinearTokenRefreshError(error: unknown) {
  return (
    error instanceof LinearAppNodeError &&
    error.code === "LINEAR_TOKEN_REFRESH_FAILED"
  );
}

function getErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
}

function isKnownLinearError(error: unknown) {
  return error instanceof LinearAppNodeError;
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

function safeProviderRoutineCallErrorMessage(error: unknown) {
  return isKnownLinearError(error) ? safeLinearErrorMessage(error) : undefined;
}

function safeErrorDetails(error: unknown) {
  return {
    code: getErrorCode(error),
    message: isKnownLinearError(error)
      ? safeLinearErrorMessage(error)
      : undefined,
    name: error instanceof Error ? error.name : typeof error,
  };
}
