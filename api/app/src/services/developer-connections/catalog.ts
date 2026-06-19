import type { Database, DeveloperConnection } from "@db/app";
import { listCurrentDeveloperConnections } from "@db/app";
import type {
  DeveloperConnectionCatalogStatus,
  DeveloperConnectionProvider,
} from "@repo/api-contract";
import type { ResolvedAuthContext as AuthContext } from "../../auth/identity";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
}

type ConnectAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: "coming_soon" | "permission_required" };

const DEVELOPER_CONNECTION_CATALOG = [
  {
    provider: "pscale",
    displayName: "PlanetScale",
    description: "Provision and inspect PlanetScale development databases.",
    builder: "Lightfast",
    category: "Database",
    catalogStatus: "available",
  },
  {
    provider: "upstash",
    displayName: "Upstash",
    description: "Provision and inspect Upstash Redis development resources.",
    builder: "Lightfast",
    category: "Infrastructure",
    catalogStatus: "available",
  },
  {
    provider: "sentry",
    displayName: "Sentry",
    description: "Inspect Sentry issues and manage release artifacts.",
    builder: "Lightfast",
    category: "Observability",
    catalogStatus: "available",
  },
  {
    provider: "clerk",
    displayName: "Clerk",
    description: "Inspect and manage a connected Clerk instance.",
    builder: "Lightfast",
    category: "Authentication",
    catalogStatus: "available",
  },
] as const satisfies ReadonlyArray<{
  provider: DeveloperConnectionProvider;
  displayName: string;
  description: string;
  builder: "Lightfast";
  category: string;
  catalogStatus: DeveloperConnectionCatalogStatus;
}>;

export interface DeveloperConnectionCatalogRow {
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: ConnectAvailability;
  connection: {
    connectedAt: Date;
    enabledForSandboxes: boolean;
    lastUsedAt: Date | null;
    lastUsedByUserId: string | null;
    lastVerifiedAt: Date | null;
    providerAccountName: string;
    status: "connected" | "needs_reconnect" | "revoked" | "replaced";
  } | null;
  description: string;
  displayName: string;
  provider: DeveloperConnectionProvider;
}

export function canManageDeveloperConnections(
  ctx: DeveloperConnectionServiceContext
) {
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

function availabilityFor(canManage: boolean): ConnectAvailability {
  if (!canManage) {
    return { status: "unavailable", reason: "permission_required" };
  }
  return { status: "available" };
}

function shapeConnection(connection: DeveloperConnection | undefined) {
  if (!connection) {
    return null;
  }
  return {
    connectedAt: connection.createdAt,
    enabledForSandboxes: connection.enabledForSandboxes,
    lastUsedAt: connection.lastUsedAt,
    lastUsedByUserId: connection.lastUsedByUserId,
    lastVerifiedAt: connection.lastVerifiedAt,
    providerAccountName: connection.providerAccountName,
    status: connection.status,
  };
}

export async function listDeveloperConnectionsForOrg(
  ctx: DeveloperConnectionServiceContext
): Promise<DeveloperConnectionCatalogRow[]> {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    return [];
  }

  const connections = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const byProvider = new Map<DeveloperConnectionProvider, DeveloperConnection>(
    connections.map((connection) => [connection.provider, connection])
  );
  const canManage = canManageDeveloperConnections(ctx);

  return DEVELOPER_CONNECTION_CATALOG.map((catalogItem) => ({
    ...catalogItem,
    canManage,
    connectAvailability: availabilityFor(canManage),
    connection: shapeConnection(byProvider.get(catalogItem.provider)),
  }));
}
