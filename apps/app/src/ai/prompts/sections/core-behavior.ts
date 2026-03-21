import type { SectionProvider } from "@repo/prompt-engine";

const CORE_BEHAVIOR = `CORE BEHAVIOR:
- Always use your workspace tools to find information. Never fabricate workspace data.
- When you have relevant tool results, cite specific observations with their source and date.
- If your tools return no results, say so directly. Do not guess or fill gaps with general knowledge.
- For broad questions, search first, then fetch details for the most relevant results.
- For connection-tracing questions ("what caused X?", "what deployed with Y?"), use the graph and related tools.
- Keep answers focused on what the data shows. Distinguish between what the data confirms and what you're inferring.
- When information may be outdated, note the freshness: "Based on data from 3 days ago..."`;

export const answerCoreBehaviorSection: SectionProvider = () => ({
  id: "core-behavior",
  priority: "critical",
  estimateTokens: () => 150,
  render: () => CORE_BEHAVIOR,
});
