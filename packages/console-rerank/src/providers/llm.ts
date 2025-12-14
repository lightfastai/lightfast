/**
 * LLM rerank provider
 *
 * Uses Claude Haiku 4.5 via Vercel AI Gateway for semantic relevance scoring.
 * Highest quality reranking with customizable score weighting.
 *
 * Refactored from apps/console/src/lib/neural/llm-filter.ts
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { log } from "@vendor/observability/log";
import type {
  RerankProvider,
  RerankCandidate,
  RerankResponse,
  RerankOptions,
} from "../types";

/**
 * LLM relevance score schema
 */
const relevanceScoreSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string().describe("The candidate ID"),
      relevance: z
        .number()
        .min(0)
        .max(1)
        .describe(
          "Relevance score from 0.0 (irrelevant) to 1.0 (highly relevant)",
        ),
    }),
  ),
});

/**
 * LLM rerank configuration
 */
export interface LLMRerankConfig {
  /**
   * Model to use via AI Gateway
   * @default "anthropic/claude-haiku-4.5"
   */
  model?: string;

  /**
   * Weight for LLM score in final calculation
   * @default 0.6
   */
  llmWeight?: number;

  /**
   * Weight for vector score in final calculation
   * @default 0.4
   */
  vectorWeight?: number;

  /**
   * Minimum relevance threshold to include result
   * @default 0.4
   */
  threshold?: number;

  /**
   * Skip LLM if candidate count is <= this value
   * @default 5
   */
  bypassThreshold?: number;
}

/**
 * Default LLM rerank options
 */
const DEFAULT_CONFIG: Required<LLMRerankConfig> = {
  model: "anthropic/claude-haiku-4.5",
  llmWeight: 0.6,
  vectorWeight: 0.4,
  threshold: 0.4,
  bypassThreshold: 5,
};

/**
 * LLM rerank provider
 *
 * Uses structured output from Claude Haiku for semantic relevance scoring.
 * Combines LLM relevance with vector similarity for final ranking.
 *
 * Features:
 * - Semantic understanding of query intent
 * - Configurable score weighting (LLM vs vector)
 * - Automatic bypass for small result sets
 * - Graceful fallback on errors
 */
export class LLMRerankProvider implements RerankProvider {
  readonly name = "llm";
  private readonly config: Required<LLMRerankConfig>;

  constructor(config?: LLMRerankConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse> {
    const threshold = options?.threshold ?? this.config.threshold;
    const topK = options?.topK ?? candidates.length;
    const requestId = options?.requestId ?? "unknown";

    if (candidates.length === 0) {
      return {
        results: [],
        latency: 0,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }

    // Bypass LLM for small result sets
    if (candidates.length <= this.config.bypassThreshold) {
      log.info("LLM rerank bypassed - small result set", {
        requestId,
        candidateCount: candidates.length,
        threshold: this.config.bypassThreshold,
      });

      const results = candidates
        .map((c) => ({
          id: c.id,
          score: c.score,
          relevance: c.score,
          originalScore: c.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency: 0,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }

    const startTime = Date.now();

    try {
      const { object } = await generateObject({
        model: gateway(this.config.model),
        schema: relevanceScoreSchema,
        prompt: this.buildPrompt(query, candidates),
        temperature: 0.1, // Low temperature for consistent scoring
      });

      const latency = Date.now() - startTime;

      log.info("LLM rerank complete", {
        requestId,
        latency,
        candidateCount: candidates.length,
        scoresReturned: object.scores.length,
      });

      // Build score map from LLM results
      const scoreMap = new Map(
        object.scores.map((s) => [s.id, s.relevance]),
      );

      // Combine LLM and vector scores
      const results = candidates
        .map((c) => {
          const llmRelevance = scoreMap.get(c.id) ?? 0.5; // Default if missing
          const finalScore =
            this.config.llmWeight * llmRelevance +
            this.config.vectorWeight * c.score;
          return {
            id: c.id,
            score: finalScore,
            relevance: llmRelevance,
            originalScore: c.score,
          };
        })
        .filter((r) => r.relevance >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency,
        provider: this.name,
        filtered: candidates.length - results.length,
        bypassed: false,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      log.error("LLM rerank failed, falling back to vector scores", {
        requestId,
        error,
        latency,
      });

      // Fallback: return candidates sorted by original score
      const results = candidates
        .map((c) => ({
          id: c.id,
          score: c.score,
          relevance: c.score,
          originalScore: c.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        results,
        latency,
        provider: this.name,
        filtered: 0,
        bypassed: true,
      };
    }
  }

  /**
   * Build the relevance scoring prompt for the LLM
   */
  private buildPrompt(query: string, candidates: RerankCandidate[]): string {
    const candidateList = candidates
      .map(
        (c, i) =>
          `${i + 1}. [${c.id}] "${c.title}": ${c.content.slice(0, 200)}...`,
      )
      .join("\n");

    return `You are evaluating search results for relevance to a user query.

User Query: "${query}"

Candidates to score:
${candidateList}

For each candidate, rate its relevance to the query on a scale from 0.0 to 1.0:
- 1.0: Directly answers or highly relevant to the query
- 0.7-0.9: Related and useful context
- 0.4-0.6: Tangentially related
- 0.1-0.3: Barely relevant
- 0.0: Completely irrelevant

Return a score for each candidate by its ID.`;
  }
}

/**
 * Create an LLM rerank provider
 */
export function createLLMRerankProvider(
  config?: LLMRerankConfig,
): LLMRerankProvider {
  return new LLMRerankProvider(config);
}
