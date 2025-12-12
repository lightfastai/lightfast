/**
 * LLM-based relevance filtering for neural memory search
 *
 * Uses GPT-5.1 Instant via Vercel AI Gateway for ultra-fast semantic relevance scoring.
 * Filters out low-relevance results and combines LLM + vector scores.
 */
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { log } from "@vendor/observability/log";

/** Relevance score schema for LLM output */
const relevanceScoreSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string().describe("The observation ID"),
      relevance: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "Relevance score from 0.0 (irrelevant) to 1.0 (highly relevant)"
        ),
    })
  ),
});

/** Input candidate for LLM filtering */
export interface FilterCandidate {
  id: string;
  title: string;
  snippet: string;
  score: number; // Vector similarity score
}

/** Output with combined scores */
export interface ScoredResult extends FilterCandidate {
  relevanceScore: number; // LLM relevance (0-1)
  finalScore: number; // Combined score
}

/** LLM filter result */
export interface LLMFilterResult {
  results: ScoredResult[];
  latency: number;
  filtered: number;
  bypassed: boolean;
}

/** Default options for LLM filtering */
const DEFAULT_OPTIONS = {
  minConfidence: 0.4, // Minimum LLM relevance to keep
  llmWeight: 0.6, // Weight for LLM score in final
  vectorWeight: 0.4, // Weight for vector score in final
  bypassThreshold: 5, // Skip LLM if <= this many results
};

/**
 * Filter search results using GPT-5.1 Instant for relevance scoring
 *
 * @param query - The user's search query
 * @param candidates - Vector search results to filter
 * @param requestId - Request ID for logging
 * @param options - Filter configuration
 */
export async function llmRelevanceFilter(
  query: string,
  candidates: FilterCandidate[],
  requestId: string,
  options: Partial<typeof DEFAULT_OPTIONS> = {}
): Promise<LLMFilterResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Bypass LLM for small result sets
  if (candidates.length <= opts.bypassThreshold) {
    log.info("LLM filter bypassed - small result set", {
      requestId,
      candidateCount: candidates.length,
      threshold: opts.bypassThreshold,
    });

    return {
      results: candidates.map((c) => ({
        ...c,
        relevanceScore: c.score, // Use vector score as fallback
        finalScore: c.score,
      })),
      latency: 0,
      filtered: 0,
      bypassed: true,
    };
  }

  const llmStart = Date.now();

  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-5.1-instant"), // Ultra-fast, adaptive reasoning
      schema: relevanceScoreSchema,
      prompt: buildRelevancePrompt(query, candidates),
      temperature: 0.1, // Low temperature for consistent scoring
    });

    const llmLatency = Date.now() - llmStart;

    log.info("LLM relevance scoring complete", {
      requestId,
      llmLatency,
      candidateCount: candidates.length,
      scoresReturned: object.scores.length,
    });

    // Build score map
    const scoreMap = new Map(object.scores.map((s) => [s.id, s.relevance]));

    // Combine scores and filter
    const originalCount = candidates.length;
    const results = candidates
      .map((c) => {
        const relevanceScore = scoreMap.get(c.id) ?? 0.5;
        const finalScore =
          opts.llmWeight * relevanceScore + opts.vectorWeight * c.score;
        return { ...c, relevanceScore, finalScore };
      })
      .filter((c) => c.relevanceScore >= opts.minConfidence)
      .sort((a, b) => b.finalScore - a.finalScore);

    const filtered = originalCount - results.length;

    log.info("LLM filter complete", {
      requestId,
      originalCount,
      filteredOut: filtered,
      remainingCount: results.length,
    });

    return {
      results,
      latency: llmLatency,
      filtered,
      bypassed: false,
    };
  } catch (error) {
    const llmLatency = Date.now() - llmStart;

    log.error("LLM relevance filter failed, falling back to vector scores", {
      requestId,
      error,
      llmLatency,
    });

    // Fallback: return original results sorted by vector score
    return {
      results: candidates
        .map((c) => ({ ...c, relevanceScore: c.score, finalScore: c.score }))
        .sort((a, b) => b.finalScore - a.finalScore),
      latency: llmLatency,
      filtered: 0,
      bypassed: true, // Mark as bypassed due to error
    };
  }
}

/**
 * Build the relevance scoring prompt for the LLM
 */
function buildRelevancePrompt(
  query: string,
  candidates: FilterCandidate[]
): string {
  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.id}] "${c.title}": ${c.snippet.slice(0, 200)}...`
    )
    .join("\n");

  return `You are evaluating search results for relevance to a user query.

User Query: "${query}"

Observations to score:
${candidateList}

For each observation, rate its relevance to the query on a scale from 0.0 to 1.0:
- 1.0: Directly answers or highly relevant to the query
- 0.7-0.9: Related and useful context
- 0.4-0.6: Tangentially related
- 0.1-0.3: Barely relevant
- 0.0: Completely irrelevant

Return a score for each observation by its ID.`;
}
