import type { WorkspaceIntegration } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import type { EventKey } from "@repo/console-providers";

export function buildContext(
  integration: WorkspaceIntegration,
  installation: GwInstallation,
  eventKey: EventKey,
  context?: string,
): string {
  const provider = integration.provider;
  const cfg = integration.sourceConfig;
  const contextLine = context ? `\nUser context: ${context}` : "";
  const afterColon = eventKey.split(":")[1] ?? "";
  const dotIdx = afterColon.indexOf(".");
  const action = dotIdx >= 0 ? afterColon.slice(dotIdx + 1) : undefined;

  switch (provider) {
    case "github": {
      const c = cfg.sourceType === "github" ? cfg : null;
      return `Generate a realistic GitHub webhook payload.
Repo: ${c?.repoFullName ?? "acme/example"}, default branch: ${c?.defaultBranch ?? "main"}
Account: ${installation.accountLogin ?? "acme"}
${action ? `Action: ${action}` : ""}${contextLine}`;
    }
    case "vercel": {
      const c = cfg.sourceType === "vercel" ? cfg : null;
      return `Generate a realistic Vercel deployment webhook payload.
Project: ${c?.projectName ?? "my-app"} (${c?.projectId ?? "prj_example"})
Team: ${c?.teamId ?? "team_example"}
Event type: ${afterColon}${contextLine}`;
    }
    case "linear": {
      const c = cfg.sourceType === "linear" ? cfg : null;
      return `Generate a realistic Linear webhook payload.
Team: ${c?.teamName ?? "Engineering"} (${c?.teamKey ?? "ENG"})
Organization: ${installation.externalId}
${action ? `Action: ${action}` : ""}${contextLine}`;
    }
    case "sentry": {
      const c = cfg.sourceType === "sentry" ? cfg : null;
      return `Generate a realistic Sentry webhook payload.
Project: ${c?.projectSlug ?? "my-project"} (${c?.projectId ?? "123456"})
Installation: ${installation.externalId}
${action ? `Action: ${action}` : ""}${contextLine}`;
    }
    default:
      return `Generate a realistic webhook payload for ${String(provider)}.${contextLine}`;
  }
}
