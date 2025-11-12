/**
 * Model-based embedding providers (Phase 2)
 *
 * OpenAI and Anthropic embedding integrations.
 *
 * @see docs/architecture/phase1/mastra-integration.md
 */

import type { EmbeddingProvider, EmbedResponse } from "../types";

/**
 * OpenAI embedding provider (Phase 2 - Not Implemented)
 *
 * This provider will use OpenAI's text-embedding-3-small model to generate
 * high-quality semantic embeddings. Implementation is deferred to Phase 2.
 *
 * TODO Phase 2:
 * - Install openai package
 * - Implement OpenAI API integration
 * - Add error handling and retry logic
 * - Add rate limiting support
 * - Add usage tracking
 *
 * @example
 * ```typescript
 * // Phase 2 usage:
 * const provider = new OpenAIEmbedding({ apiKey: "sk-..." });
 * const response = await provider.embed(["Hello, world!"]);
 * ```
 */
export class OpenAIEmbedding implements EmbeddingProvider {
  readonly dimension = 1536;

  /**
   * Generate embeddings using OpenAI API
   *
   * @throws Error - Always throws in Phase 1
   */
  async embed(_texts: string[]): Promise<EmbedResponse> {
    throw new Error(
      "OpenAI embeddings not implemented in Phase 1. Use CharHashEmbedding instead. OpenAI integration will be added in Phase 2.",
    );
  }
}

/**
 * Create a new OpenAI embedding provider (Phase 2 placeholder)
 *
 * @throws Error - Always throws in Phase 1
 *
 * @example
 * ```typescript
 * // Phase 2 usage:
 * const provider = createOpenAIEmbedding({ apiKey: "sk-..." });
 * ```
 */
export function createOpenAIEmbedding(): OpenAIEmbedding {
  throw new Error(
    "OpenAI embeddings not implemented in Phase 1. Use createCharHashEmbedding() instead.",
  );
}
