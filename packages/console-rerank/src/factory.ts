/**
 * Rerank provider factory
 *
 * Creates rerank providers based on quality mode selection.
 */

import type { RerankProvider, RerankMode } from "./types";
import { PassthroughRerankProvider } from "./providers/passthrough";
import { CohereRerankProvider } from "./providers/cohere";
import { LLMRerankProvider } from "./providers/llm";

/**
 * Create a rerank provider based on mode
 *
 * Mode selection:
 * - fast: Passthrough (no reranking, vector scores only)
 * - balanced: Cohere rerank API (efficient, production-ready)
 * - thorough: LLM-based scoring (highest quality, semantic understanding)
 *
 * @param mode - Quality tier for reranking
 * @returns Appropriate rerank provider instance
 *
 * @example
 * ```typescript
 * // Fast mode - no reranking overhead
 * const fast = createRerankProvider("fast");
 *
 * // Balanced mode - Cohere rerank API
 * const balanced = createRerankProvider("balanced");
 *
 * // Thorough mode - LLM semantic scoring
 * const thorough = createRerankProvider("thorough");
 * ```
 */
export function createRerankProvider(mode: RerankMode): RerankProvider {
  switch (mode) {
    case "fast":
      return new PassthroughRerankProvider();
    case "balanced":
      return new CohereRerankProvider();
    case "thorough":
      return new LLMRerankProvider();
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unknown rerank mode: ${exhaustiveCheck as string}`);
    }
  }
}
