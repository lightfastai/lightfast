import type { Database } from "@db/app";
import {
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_CATALOG,
  type ConnectableConnectorProvider,
  type ConnectorProvider,
  connectorRuntimeToolName,
  type DisplayConnectorTool,
} from "@repo/connector-contract";
import { X_OAUTH_SCOPES } from "@repo/x-app-node";
import type { AuthContext } from "../../trpc";
import { getXConnectorConfig } from "./config";

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
  availableForAgents: boolean;
  availableForAutomations: boolean;
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: ConnectAvailability;
  connection: {
    connectedAt: Date;
    enabledForAgents: boolean;
    enabledForAutomations: boolean;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    missingScopes: string[];
    providerActorName: string | null;
    providerWorkspaceName: string | null;
    scopeStatus: "complete" | "missing_requested_scopes";
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

function canUseToolForAgent(input: {
  connection: OrgConnectorConnection;
  provider: ConnectableConnectorProvider;
  toolName: string;
}) {
  if (
    input.connection.status !== "active" ||
    !input.connection.enabledForAgents
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
  if (!(connection && isConnectableProvider(connection.provider))) {
    return [];
  }

  return connection.toolManifest.map((tool) => ({
    name: tool.name,
    ...(tool.description ? { description: tool.description } : {}),
    availableForAgents: canUseToolForAgent({
      connection,
      provider: connection.provider,
      toolName: tool.name,
    }),
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

  if (input.provider === "x") {
    const config = getXConnectorConfig({ appOrigin: "https://app.invalid" });
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
  const missingScopes = missingRequestedScopes(connection);
  return {
    connectedAt: connection.connectedAt,
    enabledForAgents: connection.enabledForAgents,
    enabledForAutomations: connection.enabledForAutomations,
    lastToolRefreshAt: connection.lastToolRefreshAt,
    lastToolRefreshErrorAt: connection.lastToolRefreshErrorAt,
    lastToolRefreshErrorCode: connection.lastToolRefreshErrorCode,
    missingScopes,
    providerActorName: connection.providerActorName,
    providerWorkspaceName: connection.providerWorkspaceName,
    scopeStatus:
      missingScopes.length > 0 ? "missing_requested_scopes" : "complete",
    status: connection.status,
    tools,
  };
}

function missingRequestedScopes(connection: OrgConnectorConnection): string[] {
  if (connection.provider !== "x") {
    return [];
  }

  return X_OAUTH_SCOPES.filter((scope) => !connection.scopes.includes(scope));
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
      availableForAgents:
        shapedConnection?.tools.some((tool) => tool.availableForAgents) ??
        false,
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
