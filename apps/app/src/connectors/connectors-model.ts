import type {
  ConnectorSections as ConnectorSectionsResult,
  TeamConnectorCatalogRow as TeamConnectorCatalogRowResult,
  UserConnectorCatalogRow as UserConnectorCatalogRowResult,
} from "./connectors-cache";

export type ConnectorCatalogRow =
  | TeamConnectorCatalogRow
  | UserConnectorCatalogRow;
export type ConnectorSections = ConnectorSectionsResult;
export type TeamConnectorCatalogRow = TeamConnectorCatalogRowResult;
export type UserConnectorCatalogRow = UserConnectorCatalogRowResult;
export type ConnectorProvider = ConnectorCatalogRow["provider"];
export type TeamConnectorConnection = NonNullable<
  TeamConnectorCatalogRow["connection"]
>;
export type UserConnectorConnection = NonNullable<
  UserConnectorCatalogRow["connection"]
>;
export type ConnectorConnection = NonNullable<
  ConnectorCatalogRow["connection"]
>;
export type ConnectorTool =
  | TeamConnectorConnection["tools"][number]
  | UserConnectorConnection["tools"][number];
export type ConnectorStatusFilter =
  | "all"
  | "available"
  | "connected"
  | "needs_reconnect";

const CONNECTABLE_PROVIDERS = new Set<TeamConnectorCatalogRow["provider"]>([
  "linear",
  "x",
]);

export function displayProviderName(provider: string | undefined) {
  if (!provider) {
    return "Connector";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function isUserConnectorRow(
  row: ConnectorCatalogRow
): row is UserConnectorCatalogRow {
  return "ownerType" in row && row.ownerType === "user";
}

export function isTeamConnectorRow(
  row: ConnectorCatalogRow
): row is TeamConnectorCatalogRow {
  return !isUserConnectorRow(row);
}

export function isUserConnectorConnection(
  connection: ConnectorConnection
): connection is UserConnectorConnection {
  return "providerAccountName" in connection;
}

export function connectionStatus(connection: TeamConnectorConnection): {
  dotClass: string;
  label: string;
} {
  if (connection.status === "error") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (connection.lastToolRefreshErrorAt) {
    return { dotClass: "bg-amber-500", label: "Tools stale" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}

export function userConnectionStatus(connection: UserConnectorConnection): {
  dotClass: string;
  label: string;
} {
  if (connection.status === "error") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (connection.lastToolRefreshErrorAt) {
    return { dotClass: "bg-amber-500", label: "Tools stale" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}

export function isConnectableProvider(
  provider: ConnectorProvider
): provider is TeamConnectorCatalogRow["provider"] {
  return CONNECTABLE_PROVIDERS.has(
    provider as TeamConnectorCatalogRow["provider"]
  );
}

export function filterMatches(
  row: ConnectorCatalogRow,
  filter: ConnectorStatusFilter
) {
  switch (filter) {
    case "available":
      return !row.connection;
    case "connected":
      return !!row.connection;
    case "needs_reconnect":
      return row.connection?.status === "error";
    default:
      return true;
  }
}

export function filterConnectorCatalogRows<
  TConnector extends ConnectorCatalogRow,
>(
  rows: readonly TConnector[],
  {
    query,
    statusFilter,
  }: {
    query: string;
    statusFilter: ConnectorStatusFilter;
  }
): TConnector[] {
  const normalizedQuery = query.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [row.displayName, row.description, row.category, row.provider].some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(normalizedQuery)
      );
    return matchesQuery && filterMatches(row, statusFilter);
  });
}

export function isMutationDisabled(row: ConnectorCatalogRow, pending: boolean) {
  return (
    pending ||
    !isTeamConnectorRow(row) ||
    !row.canManage ||
    !isConnectableProvider(row.provider)
  );
}

export function isConnectDisabled(row: ConnectorCatalogRow, pending: boolean) {
  return (
    isMutationDisabled(row, pending) ||
    row.connectAvailability.status !== "available"
  );
}

export function missingConfigMessage(row: ConnectorCatalogRow) {
  if (row.provider === "x") {
    return "X OAuth credentials are not configured.";
  }
  return "Linear OAuth credentials are not configured.";
}

export function missingConfigFallback(row: ConnectorCatalogRow) {
  return row.provider === "x" ? "X OAuth" : "Linear OAuth";
}
