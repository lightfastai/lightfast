import type {
  GatewayInstallation,
  WorkspaceIntegration,
} from "@db/console/schema";
import type { EventKey } from "@repo/console-providers";

export function buildContext(
  integration: WorkspaceIntegration,
  installation: GatewayInstallation,
  eventKey: EventKey,
  context?: string
): string {
  const provider = integration.provider;
  const contextLine = context ? `\nUser context: ${context}` : "";
  const afterColon = eventKey.split(":")[1] ?? "";
  const dotIdx = afterColon.indexOf(".");
  const action = dotIdx >= 0 ? afterColon.slice(dotIdx + 1) : undefined;

  switch (provider) {
    case "github": {
      return `Generate a realistic GitHub webhook payload.
Repo ID: ${integration.providerResourceId}
Account: ${installation.externalId ?? "acme"}
${action ? `Action: ${action}` : ""}${contextLine}`;
    }
    case "vercel": {
      const raw = installation.providerAccountInfo?.raw as
        | { team_id?: string }
        | undefined;
      return `Generate a realistic Vercel deployment webhook payload.
Project ID: ${integration.providerResourceId}
Team ID: ${raw?.team_id ?? "team_example"}
Event type: ${afterColon}${contextLine}`;
    }
    case "linear": {
      return `Generate a realistic Linear webhook payload.
Team ID: ${integration.providerResourceId}
Organization: ${installation.externalId}
${action ? `Action: ${action}` : ""}${contextLine}`;
    }
    case "sentry": {
      return `Generate a realistic Sentry webhook payload.
Project ID: ${integration.providerResourceId}
Installation: ${installation.externalId}
${action ? `Action: ${action}` : ""}${contextLine}`;
    }
    default:
      return `Generate a realistic webhook payload for ${String(provider)}.${contextLine}`;
  }
}
