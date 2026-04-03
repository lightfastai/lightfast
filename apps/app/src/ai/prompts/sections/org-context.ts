import type { SectionProvider } from "@repo/prompt-engine";

export const answerWorkspaceContextSection: SectionProvider = (ctx) => {
  if (!ctx.features.userContext) {
    return null;
  }
  if (!ctx.userContext?.org) {
    return null;
  }

  const ws = ctx.userContext.org;
  const hasContent = ws.integrations.length > 0 || ws.repos.length > 0;

  if (!hasContent) {
    return null;
  }

  return {
    id: "workspace-context",
    priority: "high",
    estimateTokens: () => 200,
    render: () => {
      const parts: string[] = ["ORG CONTEXT:"];
      if (ws.integrations.length > 0) {
        parts.push(`Connected sources: ${ws.integrations.join(", ")}`);
      }
      if (ws.repos.length > 0) {
        parts.push(`Repositories: ${ws.repos.join(", ")}`);
      }
      return parts.join("\n");
    },
  };
};
