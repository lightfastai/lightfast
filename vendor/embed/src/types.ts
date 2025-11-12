/**
 * Type definitions for embedding providers
 */

/**
 * Request to generate embeddings
 */
export interface EmbedRequest {
  /**
   * Array of texts to embed
   */
  texts: string[];

  /**
   * Model to use for embedding
   * - "char-hash-1536": Deterministic character-based embeddings (Phase 1)
   * - "openai-text-embedding-3-small": OpenAI embeddings (Phase 2)
   */
  model?: "char-hash-1536" | "openai-text-embedding-3-small";
}

/**
 * Response containing generated embeddings
 */
export interface EmbedResponse {
  /**
   * Array of embeddings (one per input text)
   * Each embedding is a number array matching the provider's dimension
   */
  embeddings: number[][];

  /**
   * Model used to generate embeddings
   */
  model: string;

  /**
   * Optional usage statistics
   */
  usage?: {
    /**
     * Total tokens processed
     */
    totalTokens: number;
  };
}

/**
 * Interface for embedding providers
 *
 * All embedding providers must implement this interface to ensure
 * consistent behavior across different embedding models.
 */
export interface EmbeddingProvider {
  /**
   * Dimension of the embedding vectors produced by this provider
   */
  readonly dimension: number;

  /**
   * Generate embeddings for an array of texts
   *
   * @param texts - Array of text strings to embed
   * @returns Promise resolving to embed response
   */
  embed(texts: string[]): Promise<EmbedResponse>;
}
