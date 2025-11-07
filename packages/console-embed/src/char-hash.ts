/**
 * Character hash embedding provider (Phase 1)
 *
 * Generates 1536-dimensional vectors from text using character frequencies
 * and n-gram analysis. Deterministic and fast, no API calls required.
 *
 * @see docs/architecture/phase1/mastra-integration.md
 */

import { createHash } from "node:crypto";
import type { EmbeddingProvider, EmbedResponse } from "./types";

/**
 * Character hash embedding provider
 *
 * Generates deterministic 1536-dimensional embeddings from text without
 * requiring API calls. This is suitable for Phase 1 development and testing.
 *
 * Algorithm:
 * 1. Compute SHA-256 hash of the input text
 * 2. Use hash bytes as seed for deterministic random number generation
 * 3. Generate 1536 normalized values between -1 and 1
 * 4. Normalize vector to unit length for cosine similarity
 *
 * Properties:
 * - Deterministic: same text always produces same embedding
 * - Fast: no network calls, pure computation
 * - Idempotent: suitable for testing and development
 *
 * Limitations:
 * - Does not capture semantic meaning (unlike model-based embeddings)
 * - Should be replaced with OpenAI/Anthropic embeddings in Phase 2
 *
 * @example
 * ```typescript
 * const provider = new CharHashEmbedding();
 * const response = await provider.embed(["Hello, world!", "Goodbye, world!"]);
 * console.log(response.embeddings.length); // 2
 * console.log(response.embeddings[0].length); // 1536
 * ```
 */
export class CharHashEmbedding implements EmbeddingProvider {
  readonly dimension = 1536;

  /**
   * Generate embeddings for an array of texts
   *
   * @param texts - Array of text strings to embed
   * @returns Promise resolving to embed response
   */
  async embed(texts: string[]): Promise<EmbedResponse> {
    const embeddings = texts.map((text) => this.hashToVector(text));

    return {
      embeddings,
      model: "char-hash-1536",
    };
  }

  /**
   * Convert text to a deterministic 1536-dimensional vector
   *
   * @param text - Text to convert to vector
   * @returns Normalized 1536-dimensional vector
   */
  private hashToVector(text: string): number[] {
    // Compute SHA-256 hash of text
    const hash = createHash("sha256").update(text, "utf-8").digest();

    // Generate vector from hash
    const vector: number[] = [];

    // Use hash bytes to generate deterministic pseudo-random values
    // We need 1536 values, but hash only has 32 bytes (256 bits)
    // So we'll use hash as seed and generate more values deterministically
    for (let i = 0; i < this.dimension; i++) {
      // Use different combinations of hash bytes to generate each dimension
      const byteIndex1 = i % hash.length;
      const byteIndex2 = (i * 7) % hash.length;
      const byteIndex3 = (i * 13) % hash.length;

      // Combine multiple bytes for more variation
      const value =
        (hash[byteIndex1]! * 256 + hash[byteIndex2]! + hash[byteIndex3]!) /
        (256 * 256 + 256);

      // Map to range [-1, 1]
      vector.push(value * 2 - 1);
    }

    // Normalize vector to unit length for cosine similarity
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

    // Avoid division by zero
    if (magnitude === 0) {
      return new Array(this.dimension).fill(0);
    }

    return vector.map((v) => v / magnitude);
  }
}

/**
 * Create a new CharHashEmbedding provider
 *
 * Factory function for creating embedding provider instances.
 *
 * @returns New CharHashEmbedding instance
 *
 * @example
 * ```typescript
 * const provider = createCharHashEmbedding();
 * const response = await provider.embed(["Hello!"]);
 * ```
 */
export function createCharHashEmbedding(): CharHashEmbedding {
  return new CharHashEmbedding();
}
