import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const CriticScoreSchema = z.object({
  queryNaturalness: z.number().min(1).max(5),
  relevanceCorrectness: z.number().min(1).max(5),
  answerFeasibility: z.number().min(1).max(5),
  overallScore: z.number().min(1).max(5),
  reasoning: z.string(),
  issues: z.array(z.string()).optional(),
});

export type CriticScore = z.infer<typeof CriticScoreSchema>;

/**
 * Score a generated query using LLM-as-critic
 */
export async function scoreQuery(
  query: string,
  expectedEventIds: string[],
  corpusEvents: Array<{ id: string; title: string; description: string }>
): Promise<CriticScore> {
  const relevantEvents = corpusEvents.filter(e => expectedEventIds.includes(e.id));

  const CRITIC_PROMPT = `Evaluate this search query and its expected results.

Query: "${query}"

Expected results:
${JSON.stringify(relevantEvents, null, 2)}

Score each dimension 1-5:
1. **Query Naturalness**: Is this how a real developer would ask? (1=robotic, 5=natural)
2. **Relevance Correctness**: Do the expected results actually match the query? (1=wrong, 5=perfect)
3. **Answer Feasibility**: Could a system realistically retrieve these results? (1=impossible, 5=straightforward)
4. **Overall Score**: Holistic quality (1=unusable, 5=excellent)

Provide reasoning and list any issues found.`;

  const result = await generateObject({
    model: gateway("anthropic/claude-sonnet-4-5"),
    schema: CriticScoreSchema,
    prompt: CRITIC_PROMPT,
    temperature: 0.2, // Lower temperature for consistent scoring
  });

  return result.object;
}

/**
 * Filter queries by critic scores
 */
export function filterByCriticScores(
  queries: Array<{ query: string; score: CriticScore }>,
  minScore: number = 3
): Array<{ query: string; score: CriticScore }> {
  return queries.filter(q => q.score.overallScore >= minScore);
}
