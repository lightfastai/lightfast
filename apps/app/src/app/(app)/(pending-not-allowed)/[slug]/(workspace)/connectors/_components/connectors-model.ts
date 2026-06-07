import type { AppRouterOutputs } from "@api/app";

export type ConnectorCatalogRow =
  | TeamConnectorCatalogRow
  | UserConnectorCatalogRow;
export type ConnectorSections =
  AppRouterOutputs["org"]["workspace"]["connectors"]["listSections"];
export type TeamConnectorCatalogRow =
  ConnectorSections["teamConnectors"][number];
export type UserConnectorCatalogRow =
  ConnectorSections["yourConnectors"][number];
export type ConnectorProvider = ConnectorCatalogRow["provider"];
export type TeamConnectorConnection = NonNullable<
  TeamConnectorCatalogRow["connection"]
>;
export type UserConnectorConnection = NonNullable<
  UserConnectorCatalogRow["connection"]
>;
export type ConnectorConnection =
  | TeamConnectorConnection
  | UserConnectorConnection;
export type ConnectorTool =
  | TeamConnectorConnection["tools"][number]
  | UserConnectorConnection["tools"][number];

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
