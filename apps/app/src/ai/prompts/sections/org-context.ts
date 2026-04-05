import type { SectionProvider } from "@repo/prompt-engine";

export const answerOrgContextSection: SectionProvider = (ctx) => {
  if (!ctx.features.userContext) {
    return null;
  }
  if (!ctx.userContext?.org) {
    return null;
  }

  const org = ctx.userContext.org;
  const hasContent = org.integrations.length > 0 || org.repos.length > 0;

  if (!hasContent) {
    return null;
  }

  return {
    id: "org-context",
    priority: "high",
    estimateTokens: () => 200,
    render: () => {
      const parts: string[] = ["ORG CONTEXT:"];
      if (org.integrations.length > 0) {
        parts.push(`Connected sources: ${org.integrations.join(", ")}`);
      }
      if (org.repos.length > 0) {
        parts.push(`Repositories: ${org.repos.join(", ")}`);
      }
      return parts.join("\n");
    },
  };
};
