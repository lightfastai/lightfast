import {
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_CATALOG,
  connectorRuntimeToolName,
  type ConnectableConnectorProvider,
  type ConnectorProvider,
  type DisplayConnectorTool,
} from "@repo/connector-contract";

import type { AuthContext } from "../../trpc";
import type { Database } from "@db/app";
import { getLinearConnectorConfig } from "./config";

interface ConnectorServiceContext {
  auth: AuthContext;
  db: Database;
}

type ConnectAvailability =
  | { status: "available" }
  | {
      status: "unavailable";
      reason: "coming_soon" | "missing_config" | "permission_required";
      missing?: string[];
    };

export interface ConnectorCatalogRow {
  availableForAutomations: boolean;
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: ConnectAvailability;
  connection: {
    connectedAt: Date;
    enabledForAutomations: boolean;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerActorName: string | null;
    providerWorkspaceName: string | null;
    status: "active" | "error" | "revoked";
    tools: DisplayConnectorTool[];
  } | null;
  description: string;
  displayName: string;
  provider: ConnectorProvider;
}

function canManageConnectors(ctx: ConnectorServiceContext): boolean {
  const identity = ctx.auth.identity;
  const access = ctx.auth.access;
  return (
    identity.type === "active" &&
    access?.kind === "clerk-session" &&
    access.userId === identity.userId &&
    access.orgId === identity.orgId &&
    access.has({ role: "org:admin" })
  );
}

function isConnectableProvider(
  provider: ConnectorProvider
): provider is ConnectableConnectorProvider {
  return CONNECTABLE_CONNECTOR_PROVIDERS.includes(
    provider as ConnectableConnectorProvider
  );
}

function canUseToolForAutomation(input: {
  connection: OrgConnectorConnection;
  provider: ConnectableConnectorProvider;
  toolName: string;
}) {
  if (
    input.connection.status !== "active" ||
    !input.connection.enabledForAutomations
  ) {
    return false;
  }

  try {
    connectorRuntimeToolName(input.provider, input.toolName);
    return true;
  } catch {
    return false;
  }
}

function displayTools(
  connection: OrgConnectorConnection | undefined
): DisplayConnectorTool[] {
  if (!connection || !isConnectableProvider(connection.provider)) {
    return [];
  }

  return connection.toolManifest.map((tool) => ({
    name: tool.name,
    ...(tool.description ? { description: tool.description } : {}),
    availableForAutomations: canUseToolForAutomation({
      connection,
      provider: connection.provider,
      toolName: tool.name,
    }),
  }));
}

function availabilityFor(input: {
  canManage: boolean;
  provider: ConnectorProvider;
}): ConnectAvailability {
  if (!isConnectableProvider(input.provider)) {
    return { status: "unavailable", reason: "coming_soon" };
  }
  if (!input.canManage) {
    return { status: "unavailable", reason: "permission_required" };
  }

  if (input.provider === "linear") {
    const config = getLinearConnectorConfig({ appOrigin: "https://app.invalid" });
    if (config.status === "missing_config") {
      return {
        status: "unavailable",
        reason: "missing_config",
        missing: config.missing,
      };
    }
  }

  return { status: "available" };
}

function shapeConnection(
  connection: OrgConnectorConnection | undefined
): ConnectorCatalogRow["connection"] {
  if (!connection) {
    return null;
  }

  const tools = displayTools(connection);
  return {
    connectedAt: connection.connectedAt,
    enabledForAutomations: connection.enabledForAutomations,
    lastToolRefreshAt: connection.lastToolRefreshAt,
    lastToolRefreshErrorAt: connection.lastToolRefreshErrorAt,
    lastToolRefreshErrorCode: connection.lastToolRefreshErrorCode,
    providerActorName: connection.providerActorName,
    providerWorkspaceName: connection.providerWorkspaceName,
    status: connection.status,
    tools,
  };
}

export async function listConnectorsForOrg(
  ctx: ConnectorServiceContext
): Promise<ConnectorCatalogRow[]> {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    return [];
  }

  const connections = await listCurrentOrgConnectorConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const byProvider = new Map<ConnectorProvider, OrgConnectorConnection>(
    connections.map((connection) => [connection.provider, connection])
  );
  const canManage = canManageConnectors(ctx);

  return CONNECTOR_CATALOG.map((catalogItem) => {
    const connection = byProvider.get(catalogItem.provider);
    const shapedConnection = shapeConnection(connection);
    return {
      ...catalogItem,
      availableForAutomations:
        shapedConnection?.tools.some((tool) => tool.availableForAutomations) ??
        false,
      canManage,
      connectAvailability: availabilityFor({
        canManage,
        provider: catalogItem.provider,
      }),
      connection: shapedConnection,
    };
  });
}
