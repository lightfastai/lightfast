import type { SectionProvider } from "@repo/prompt-engine";

export const answerRepoIndexSection: SectionProvider = (ctx) => {
  if (!ctx.features.userContext) {
    return null;
  }

  const content = ctx.userContext?.org?.repoIndex;
  if (!content) {
    return null;
  }

  return {
    id: "repo-index-context",
    priority: "high",
    estimateTokens: () => Math.ceil(content.length / 4),
    render: () => `ORG CONTEXT (repo index):\n${content}`,
  };
};
