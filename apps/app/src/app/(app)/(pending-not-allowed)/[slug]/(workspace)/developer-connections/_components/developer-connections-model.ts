import type { AppRouterOutputs } from "@api/app";

export type DeveloperConnectionCatalogRow =
  AppRouterOutputs["org"]["workspace"]["developerConnections"]["list"][number];
export type DeveloperConnectionProvider =
  DeveloperConnectionCatalogRow["provider"];

export function displayDeveloperConnectionProvider(provider?: string) {
  switch (provider) {
    case "pscale":
      return "PlanetScale";
    case "upstash":
      return "Upstash";
    case "sentry":
      return "Sentry";
    case "clerk":
      return "Clerk";
    default:
      return "Developer connection";
  }
}

export function developerConnectionStatus(row: DeveloperConnectionCatalogRow): {
  dotClass: string;
  label: "Available" | "Connected" | "Disabled" | "Needs reconnect";
} {
  if (!row.connection) {
    return { dotClass: "bg-muted-foreground", label: "Available" };
  }
  if (row.connection.status === "needs_reconnect") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (!row.connection.enabledForSandboxes) {
    return { dotClass: "bg-muted-foreground", label: "Disabled" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}
