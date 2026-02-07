import type { SectionProvider } from "@repo/prompt-engine";

export const answerWorkspaceContextSection: SectionProvider = (ctx) => {
  if (!ctx.features.userContext) return null;
  if (!ctx.userContext?.workspace) return null;

  const ws = ctx.userContext.workspace;

  return {
    id: "workspace-context",
    priority: "high",
    estimateTokens: () => 200,
    render: () => {
      const parts = [`WORKSPACE CONTEXT:\nProject: ${ws.name}`];
      if (ws.description) {
        parts.push(`Description: ${ws.description}`);
      }
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
