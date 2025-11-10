/**
 * Vector and embedding types
 */

/**
 * Embedding provider interface for swappable implementations
 */
export interface EmbeddingProvider {
  /** Dimension of embeddings this provider produces */
  readonly dimension: number;
  /** Embed one or more texts */
  embed(texts: string[]): Promise<EmbedResponse>;
}

/**
 * Embedding request
 */
export interface EmbedRequest {
  /** Texts to embed */
  texts: string[];
  /** Model to use (optional, provider-specific) */
  model?: string;
}

/**
 * Embedding response
 */
export interface EmbedResponse {
  /** Array of embeddings (one per input text) */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Usage statistics (optional) */
  usage?: {
    totalTokens: number;
  };
}
