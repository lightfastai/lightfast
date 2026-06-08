import type { AppRouterOutputs } from "@api/app";

export type ConnectorCatalogRow =
  AppRouterOutputs["org"]["workspace"]["connectors"]["list"][number];
export type ConnectorProvider = ConnectorCatalogRow["provider"];
export type ConnectorConnection = NonNullable<
  ConnectorCatalogRow["connection"]
>;
export type ConnectorTool = ConnectorConnection["tools"][number];
export type ConnectorStatusFilter =
  | "all"
  | "available"
  | "connected"
  | "needs_reconnect";

const CONNECTABLE_PROVIDERS = new Set<ConnectorProvider>(["linear", "x"]);

export function displayProviderName(provider: string | undefined) {
  if (!provider) {
    return "Connector";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function connectionStatus(connection: ConnectorConnection): {
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

export function isConnectableProvider(provider: ConnectorProvider) {
  return CONNECTABLE_PROVIDERS.has(provider);
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

export function filterConnectorCatalogRows(
  rows: readonly ConnectorCatalogRow[],
  {
    query,
    statusFilter,
  }: {
    query: string;
    statusFilter: ConnectorStatusFilter;
  }
) {
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
  return pending || !row.canManage || !isConnectableProvider(row.provider);
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
