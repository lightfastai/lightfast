import type { Database, UserConnectorConnection } from "@db/app";
import { listCurrentUserConnectorConnections } from "@db/app";
import { USER_CONNECTOR_CATALOG } from "@lightfast/connector-core";
import type { ResolvedAuthContext as AuthContext } from "../../auth/identity";

export interface UserConnectorServiceContext {
  auth: AuthContext;
  db: Database;
}

export interface UserConnectorCatalogRow {
  builder: "Granola";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: { status: "available" };
  connection: {
    availableForInteractiveChats: boolean;
    connectedAt: Date;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerAccountName: string | null;
    status: "active" | "error" | "revoked";
    tools: Array<{
      availableForInteractiveChats: boolean;
      description?: string;
      name: string;
    }>;
  } | null;
  description: string;
  displayName: string;
  ownerType: "user";
  provider: "granola";
}

export async function listUserConnectorsForViewer(
  ctx: UserConnectorServiceContext
): Promise<UserConnectorCatalogRow[]> {
  const identity = ctx.auth.identity;
  if (identity.type === "unauthenticated") {
    return [];
  }

  const connections = await listCurrentUserConnectorConnections(ctx.db, {
    clerkUserId: identity.userId,
  });
  const byProvider = new Map(connections.map((row) => [row.provider, row]));

  return USER_CONNECTOR_CATALOG.map((catalogItem) => ({
    ...catalogItem,
    canManage: true,
    connectAvailability: { status: "available" as const },
    connection: shapeConnection(byProvider.get(catalogItem.provider)),
    ownerType: "user" as const,
  }));
}

function shapeConnection(
  connection: UserConnectorConnection | undefined
): UserConnectorCatalogRow["connection"] {
  if (!connection) {
    return null;
  }

  const availableForInteractiveChats = connection.status === "active";
  return {
    availableForInteractiveChats,
    connectedAt: connection.connectedAt,
    lastToolRefreshAt: connection.lastToolRefreshAt,
    lastToolRefreshErrorAt: connection.lastToolRefreshErrorAt,
    lastToolRefreshErrorCode: connection.lastToolRefreshErrorCode,
    providerAccountName: connection.providerAccountName,
    status: connection.status,
    tools: connection.toolManifest.map((tool) => ({
      ...(tool.description ? { description: tool.description } : {}),
      availableForInteractiveChats,
      name: tool.name,
    })),
  };
}
