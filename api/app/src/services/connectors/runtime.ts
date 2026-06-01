import {
  getCurrentOrgConnectorConnection,
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import { connectorRuntimeToolName } from "@repo/connector-contract";
import { callLinearMcpTool } from "@repo/linear-app-node";
import { log } from "@vendor/observability/log/next";

import { getFreshLinearConnectorAccessToken } from "./linear-flow";

export interface ConnectorRuntimeToolSource {
  provider: "linear";
  runtimeToolName: string;
  providerToolName: string;
  description?: string;
  call(input: unknown): Promise<unknown>;
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

  try {
    const connection = await getCurrentOrgConnectorConnection(appDb, {
      clerkOrgId: context.clerkOrgId,
      provider: "linear",
    });
    if (
      !connection ||
      !isActiveAutomationLinearConnection(connection) ||
      !hasValidCurrentTool(connection, context.providerToolName)
    ) {
      throw new Error("Linear connector is not active for automations.");
    }

    const accessToken = await getFreshLinearConnectorAccessToken({
      connection,
      db: appDb,
    });
    const result = await callLinearMcpTool({
      accessToken,
      endpoint: connection.mcpEndpoint,
      input: normalizeMcpToolInput(input),
      name: context.providerToolName,
    });

    log.info("[connectors] runtime tool call completed", {
      ...logContext,
      success: true,
    });
    return result;
  } catch (error) {
    log.warn("[connectors] runtime tool call failed", {
      ...logContext,
      failure: safeErrorDetails(error),
      success: false,
    });
    throw error;
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

function safeErrorDetails(error: unknown) {
  return {
    code:
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined,
    message: error instanceof Error ? error.message : undefined,
    name: error instanceof Error ? error.name : typeof error,
  };
}
