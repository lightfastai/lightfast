import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

const QueryGenerationSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string().min(10).max(200),
      queryType: z.enum(["temporal", "actor", "technical", "status", "multi-hop", "null"]),
      expectedEventIds: z.array(z.string()).min(1).max(5),
      complexity: z.enum(["simple", "medium", "complex"]),
      reasoning: z.string(),
    })
  ).min(5).max(10),
});

/**
 * Generate queries from corpus events using LLM
 */
export async function generateQueries(
  corpusEvents: Array<{ id: string; title: string; description: string }>,
  targetCount: number = 30
): Promise<Array<{
  query: string;
  queryType: string;
  expectedEventIds: string[];
  complexity: string;
  reasoning: string;
}>> {
  const GENERATION_PROMPT = `You are a software engineer using a neural memory system to search engineering events.

Given these engineering events:
${JSON.stringify(corpusEvents.slice(0, 15), null, 2)}

Generate ${Math.min(10, targetCount)} diverse, natural search queries that a developer might ask.

Requirements:
- Queries should be conversational and realistic ("What broke in checkout?" not "checkout service errors")
- Cover different query types: temporal (time-based), actor (person-based), technical (topic), status, multi-hop (requires multiple docs), null (should return nothing)
- For each query, specify which event IDs should be returned
- Vary complexity: simple (1 expected result), medium (2-3 results), complex (4+ results or requires reasoning)
- Include reasoning for why those events match

Output JSON matching the schema.`;

  const allQueries: Array<{
    query: string;
    queryType: string;
    expectedEventIds: string[];
    complexity: string;
    reasoning: string;
  }> = [];

  // Generate in batches to reach target count
  const batchSize = 10;
  const batchCount = Math.ceil(targetCount / batchSize);

  for (let i = 0; i < batchCount; i++) {
    const result = await generateObject({
      model: gateway("anthropic/claude-haiku-4.5"),
      schema: QueryGenerationSchema,
      prompt: GENERATION_PROMPT,
      temperature: 0.8, // Higher creativity for diverse queries
    });

    allQueries.push(...result.object.queries);

    if (allQueries.length >= targetCount) {
      break;
    }
  }

  return allQueries.slice(0, targetCount);
}
