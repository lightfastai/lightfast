/**
 * Batch processing utilities for embeddings
 *
 * Processes large text arrays in batches to avoid rate limits.
 */

import type { EmbeddingProvider } from "./types";

/**
 * Process texts in batches through an embedding provider
 *
 * Splits a large array of texts into smaller batches and processes them
 * sequentially to avoid rate limits and memory issues.
 *
 * Features:
 * - Configurable batch size
 * - Optional delay between batches
 * - Progress tracking via callback
 *
 * @param texts - Array of texts to embed
 * @param provider - Embedding provider to use
 * @param options - Batch processing options
 * @returns Promise resolving to array of all embeddings
 *
 * @example
 * ```typescript
 * const provider = new CharHashEmbedding();
 * const texts = [...]; // 1000 texts
 *
 * const embeddings = await embedBatch(texts, provider, {
 *   batchSize: 100,
 *   delayMs: 1000,
 *   onProgress: (current, total) => {
 *     console.log(`Processing batch ${current}/${total}`);
 *   }
 * });
 * ```
 */
export async function embedBatch(
  texts: string[],
  provider: EmbeddingProvider,
  options: {
    /**
     * Number of texts to process per batch (default: 100)
     */
    batchSize?: number;

    /**
     * Delay in milliseconds between batches (default: 0)
     * Useful for rate limiting
     */
    delayMs?: number;

    /**
     * Optional callback for progress tracking
     * @param currentBatch - Current batch number (1-indexed)
     * @param totalBatches - Total number of batches
     */
    onProgress?: (currentBatch: number, totalBatches: number) => void;
  } = {},
): Promise<number[][]> {
  const batchSize = options.batchSize ?? 100;
  const delayMs = options.delayMs ?? 0;
  const onProgress = options.onProgress;

  const embeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / batchSize);

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    // Call progress callback
    if (onProgress) {
      onProgress(batchNumber, totalBatches);
    }

    // Process batch
    const response = await provider.embed(batch);
    embeddings.push(...response.embeddings);

    // Delay between batches (except for last batch)
    if (delayMs > 0 && i + batchSize < texts.length) {
      await delay(delayMs);
    }
  }

  return embeddings;
}

/**
 * Delay execution for a specified number of milliseconds
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
