import type { AppRouterOutputs } from "@api/app";

export type ConnectorCatalogRow =
  AppRouterOutputs["org"]["workspace"]["connectors"]["list"][number];
export type ConnectorProvider = ConnectorCatalogRow["provider"];
export type ConnectorConnection = NonNullable<ConnectorCatalogRow["connection"]>;
export type ConnectorTool = ConnectorConnection["tools"][number];

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
