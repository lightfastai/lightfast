import type { SectionProvider } from "@repo/prompt-engine";

interface ToolGuidance {
  name: string;
  whenToUse: string;
  howToUse: string;
  resultHandling: string;
  failureHandling: string;
}

const ANSWER_TOOL_GUIDANCE: Record<string, ToolGuidance> = {
  workspaceSearch: {
    name: "workspaceSearch",
    whenToUse:
      "Use as your primary discovery tool. Search when the user asks about past events, decisions, code changes, deployments, errors, or team activity. Start broad, then narrow.",
    howToUse:
      "Extract key technical terms from the user's question. Use mode='hybrid' for most queries. Filter by source type (github, vercel, linear, sentry) when the question is source-specific. Use limit=5 for focused queries, limit=10 for broad surveys.",
    resultHandling:
      "Cite results with source type, title, and relative date. Summarize patterns across results rather than listing each one. If multiple results tell a story, connect them narratively.",
    failureHandling:
      "If no results: acknowledge the gap, suggest the user check if the relevant source is connected, or try alternative search terms. Do not fabricate data.",
  },
  workspaceContents: {
    name: "workspaceContents",
    whenToUse:
      "Use after workspaceSearch to get full details for specific observations. Use when the user asks for specifics: full commit messages, PR descriptions, error stack traces, deployment logs.",
    howToUse:
      "Pass observation IDs from search results. Batch multiple IDs in a single call when you need details on several items.",
    resultHandling:
      "Present the most relevant details from the full content. Quote specific passages when they directly answer the user's question.",
    failureHandling:
      "If an ID is not found, note it and continue with available results.",
  },
  workspaceFindSimilar: {
    name: "workspaceFindSimilar",
    whenToUse:
      "Use when the user asks 'what else is like this?', 'any similar issues?', 'related changes?'. Also use proactively when a search result suggests a pattern worth exploring.",
    howToUse:
      "Pass the observation ID of the anchor item. Use threshold=0.7 for tight matches, threshold=0.5 for broader exploration. Default limit=5.",
    resultHandling:
      "Group similar items by theme. Highlight what makes them similar and what differs.",
    failureHandling:
      "If no similar items found, note the item appears unique in the workspace.",
  },
  workspaceGraph: {
    name: "workspaceGraph",
    whenToUse:
      "Use for causality and connection questions: 'what caused this?', 'what deployments included this fix?', 'what PRs are related to this issue?'. Traverses the relationship graph between events across sources.",
    howToUse:
      "Start from a specific observation ID. Use depth=1 for direct connections, depth=2 for transitive relationships. Limit results to avoid overwhelming output.",
    resultHandling:
      "Present connections as a narrative: 'Issue #42 was fixed by PR #87, which was deployed in deploy-abc on Feb 3.' Show the chain of events.",
    failureHandling:
      "If no graph connections exist, the item may not have cross-source links yet. Suggest using workspaceRelated or workspaceFindSimilar instead.",
  },
  workspaceRelated: {
    name: "workspaceRelated",
    whenToUse:
      "Use for direct relationships only (not transitive). Faster than workspaceGraph for simple 'what's related to X?' questions. Use when you need the immediate context around an event.",
    howToUse:
      "Pass the observation ID. Default limit=5 is usually sufficient.",
    resultHandling:
      "List related items with their relationship type and source. Group by source type if there are many.",
    failureHandling:
      "If no related items, note that no direct relationships were found. Suggest workspaceGraph for deeper traversal or workspaceFindSimilar for semantic matches.",
  },
};

export const answerToolGuidanceSection: SectionProvider = (ctx) => {
  if (!ctx.features.toolGuidance) return null;

  const activeGuidance = ctx.activeTools
    .map((toolName) => ANSWER_TOOL_GUIDANCE[toolName])
    .filter((g): g is ToolGuidance => g !== undefined);

  if (activeGuidance.length === 0) return null;

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
