/**
 * Passthrough rerank provider
 *
 * No-op provider that returns candidates sorted by original vector score.
 * Used for "fast" mode when reranking overhead is not desired.
 */

import type {
  RerankProvider,
  RerankCandidate,
  RerankResponse,
  RerankOptions,
} from "../types";

/**
 * Passthrough rerank provider
 *
 * Simply returns candidates sorted by their original vector score.
 * Useful when:
 * - Speed is critical
 * - Vector search is already high quality
 * - Testing/debugging without rerank overhead
 */
export class PassthroughRerankProvider implements RerankProvider {
  readonly name = "passthrough";

  rerank(
    _query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions,
  ): Promise<RerankResponse> {
    const threshold = options?.threshold ?? 0;
    const topK = options?.topK ?? candidates.length;

    // Map to results format, preserving vector scores
    const results = candidates
      .map((c) => ({
        id: c.id,
        score: c.score,
        relevance: c.score, // Use vector score as relevance
        originalScore: c.score,
      }))
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return Promise.resolve({
      results,
      latency: 0,
      provider: this.name,
      filtered: candidates.length - results.length,
      bypassed: true,
    });
  }
}

/**
 * Create a passthrough rerank provider
 */
export function createPassthroughRerankProvider(): PassthroughRerankProvider {
  return new PassthroughRerankProvider();
}
