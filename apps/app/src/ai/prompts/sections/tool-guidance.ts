import type { SectionProvider } from "@repo/prompt-engine";

interface ToolGuidance {
  failureHandling: string;
  howToUse: string;
  name: string;
  resultHandling: string;
  whenToUse: string;
}

const ANSWER_TOOL_GUIDANCE: Record<string, ToolGuidance> = {
  orgSearch: {
    name: "orgSearch",
    whenToUse:
      "Use as your primary discovery tool. Search when the user asks about past events, decisions, code changes, deployments, errors, or team activity. Start broad, then narrow.",
    howToUse:
      "Extract key technical terms from the user's question. Use mode='balanced' for most queries. Filter by source type (github, vercel, linear, sentry) when the question is source-specific. Use limit=5 for focused queries, limit=10 for broad surveys.",
    resultHandling:
      "Cite results with source type, title, and relative date. Summarize patterns across results rather than listing each one. If multiple results tell a story, connect them narratively.",
    failureHandling:
      "If no results: acknowledge the gap, suggest the user check if the relevant source is connected, or try alternative search terms. Do not fabricate data.",
  },
};

export const answerToolGuidanceSection: SectionProvider = (ctx) => {
  if (!ctx.features.toolGuidance) {
    return null;
  }

  const activeGuidance = ctx.activeTools
    .map((toolName) => ANSWER_TOOL_GUIDANCE[toolName])
    .filter((g): g is ToolGuidance => g !== undefined);

  if (activeGuidance.length === 0) {
    return null;
  }

  return {
    id: "tool-guidance",
    priority: "high",
    estimateTokens: () => activeGuidance.length * 80,
    render: () => {
      const lines = ["TOOL GUIDANCE:"];
      for (const tool of activeGuidance) {
        lines.push(`- **${tool.name}**: ${tool.whenToUse}`);
        lines.push(`  Usage: ${tool.howToUse}`);
        lines.push(`  Results: ${tool.resultHandling}`);
        lines.push(`  No results: ${tool.failureHandling}`);
      }
      return lines.join("\n");
    },
  };
};
