import type { SectionProvider } from "@repo/prompt-engine";

const ANSWER_CITATION = `CITATION FORMAT:
- When citing workspace observations, include the source type, title, and date.
- Use observation IDs when referencing specific items so users can look them up.
- Format: "Based on [source: title] from [relative date]..."
- For multiple related observations, summarize the pattern rather than listing each one.
- When quoting content, use blockquotes and attribute the source.`;

export const answerCitationSection: SectionProvider = () => ({
  id: "citation",
  priority: "medium",
  estimateTokens: () => 100,
  render: () => ANSWER_CITATION,
});
