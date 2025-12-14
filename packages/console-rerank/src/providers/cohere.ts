/**
 * Cohere rerank provider
 *
 * Uses Cohere's rerank API for efficient semantic reranking.
 * Optimized for production use with configurable model and threshold.
 *
 * @see https://docs.cohere.com/docs/rerank-2
 */

import { CohereClient } from "cohere-ai";
import { log } from "@vendor/observability/log";
import type {
  RerankProvider,
  RerankCandidate,
  RerankResponse,
  RerankOptions,
} from "../types";

/**
 * Cohere rerank configuration
 */
export interface CohereRerankConfig {
  /**
   * Cohere API key
   * If not provided, uses COHERE_API_KEY from environment
   */
  apiKey?: string;

  /**
   * Rerank model to use
   * @default "rerank-v3.5"
   */
  model?: string;

  /**
   * Default relevance threshold
   * @default 0.4
   */
  threshold?: number;
}

/**
 * Cohere rerank provider
 *
 * Uses Cohere's production rerank API for high-quality semantic reranking.
 *
 * Features:
 * - Fast inference (~100-200ms for 100 candidates)
 * - Configurable relevance threshold
 * - Automatic score normalization
 */
export class CohereRerankProvider implements RerankProvider {
  readonly name = "cohere";
  private readonly client: CohereClient;
  private readonly model: string;
  private readonly defaultThreshold: number;

  constructor(config?: CohereRerankConfig) {
    const apiKey = config?.apiKey ?? process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error("Cohere API key is required");
    }

    this.client = new CohereClient({
      token: apiKey,
    });
    this.model = config?.model ?? "rerank-v3.5";
    this.defaultThreshold = config?.threshold ?? 0.4;
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse> {
    const threshold = options?.threshold ?? this.defaultThreshold;
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

    const startTime = Date.now();

    try {
      // Prepare documents for Cohere API
      const documents = candidates.map((c) => ({
        text: `${c.title}: ${c.content}`,
      }));

      const response = await this.client.rerank({
        model: this.model,
        query,
        documents,
        topN: candidates.length, // Get all scores, filter ourselves
        returnDocuments: false,
      });

      const latency = Date.now() - startTime;

      log.info("Cohere rerank complete", {
        requestId,
        latency,
        candidateCount: candidates.length,
        resultsReturned: response.results.length,
      });

      // Build score map from Cohere results
      const scoreMap = new Map(
        response.results.map((r) => [r.index, r.relevanceScore]),
      );

      // Map to results format with scores
      const results = candidates
        .map((c, index) => {
          const relevance = scoreMap.get(index) ?? 0;
          return {
            id: c.id,
            score: relevance, // Use Cohere relevance as final score
            relevance,
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

      log.error("Cohere rerank failed, falling back to vector scores", {
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
}

/**
 * Create a Cohere rerank provider
 */
export function createCohereRerankProvider(
  config?: CohereRerankConfig,
): CohereRerankProvider {
  return new CohereRerankProvider(config);
}
