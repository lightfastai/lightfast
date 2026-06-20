import type { Database } from "@db/app";
import {
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import { connectorRuntimeToolName } from "@lightfast/connector-core";
import { X_OAUTH_SCOPES } from "@lightfast/connector-x/contract";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  type ConnectableConnectorProvider,
  type ConnectorProvider,
} from "@repo/api-contract";
import { getXConnectorConfig } from "./config";

interface ConnectorCatalogServiceContext {
  db: Database;
  organization: {
    orgId: string;
  };
  viewer: {
    canManage: boolean;
  };
}

type ConnectAvailability =
  | { status: "available" }
  | {
      status: "unavailable";
      reason: "coming_soon" | "missing_config" | "permission_required";
      missing?: string[];
    };

interface DisplayConnectorTool {
  availableForAgents: boolean;
  availableForAutomations: boolean;
  description?: string;
  name: string;
}

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

const CONNECTOR_CATALOG = [
  {
    provider: "linear",
    displayName: "Linear",
    description:
      "Find, create, and manage issues, projects, and comments in Linear.",
    builder: "Lightfast",
    category: "Project management",
    catalogStatus: "available",
  },
  {
    provider: "x",
    displayName: "X",
    description:
      "Search posts, manage engagement, send messages, and publish through X from Lightfast agents and automations.",
    builder: "Lightfast",
    category: "Social",
    catalogStatus: "available",
  },
] as const satisfies readonly Pick<
  ConnectorCatalogRow,
  | "builder"
  | "catalogStatus"
  | "category"
  | "description"
  | "displayName"
  | "provider"
>[];

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
  ctx: ConnectorCatalogServiceContext
): Promise<ConnectorCatalogRow[]> {
  const connections = await listCurrentOrgConnectorConnections(ctx.db, {
    clerkOrgId: ctx.organization.orgId,
  });
  const byProvider = new Map<ConnectorProvider, OrgConnectorConnection>(
    connections.map((connection) => [connection.provider, connection])
  );
  const canManage = ctx.viewer.canManage;

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
