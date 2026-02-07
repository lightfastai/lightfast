import type { SectionProvider } from "@repo/prompt-engine";

export const answerTemporalContextSection: SectionProvider = (ctx) => {
  if (!ctx.features.temporalContext) return null;
  if (!ctx.temporalContext) return null;

  const tc = ctx.temporalContext;

  return {
    id: "temporal-context",
    priority: "medium",
    estimateTokens: () => 80,
    render: () => {
      const parts = ["TEMPORAL CONTEXT:"];
      parts.push(`Current time: ${tc.currentTimestamp}`);
      parts.push(
        `When referencing events, use relative time: "3 days ago", "last Tuesday", "2 weeks ago".`,
      );
      parts.push(
        `When citing sources, include freshness: "Based on PR #123 merged 3 days ago..."`,
      );
      parts.push(
        `If workspace data may be stale (last sync > 1 hour), note it.`,
      );
      return parts.join("\n");
    },
  };
};
