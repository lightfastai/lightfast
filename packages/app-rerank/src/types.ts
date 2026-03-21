/**
 * Type definitions for rerank providers
 *
 * Follows the EmbeddingProvider pattern from @vendor/embed.
 */

/**
 * Input candidate for reranking
 *
 * Mirrors FilterCandidate from llm-filter.ts with additional fields.
 */
export interface RerankCandidate {
  /**
   * Text content to use for relevance scoring
   */
  content: string;
  /**
   * Unique identifier for the candidate
   */
  id: string;

  /**
   * Original vector similarity score (0-1)
   */
  score: number;

  /**
   * Title of the document/observation
   */
  title: string;
}

/**
 * Reranked result with scores
 */
export interface RerankResult {
  /**
   * Candidate identifier
   */
  id: string;

  /**
   * Original vector score preserved
   */
  originalScore: number;

  /**
   * Provider-specific relevance score (0-1)
   */
  relevance: number;

  /**
   * Final reranked score (0-1)
   */
  score: number;
}

/**
 * Response from rerank operation
 */
export interface RerankResponse {
  /**
   * Whether reranking was bypassed (e.g., small result set)
   */
  bypassed: boolean;

  /**
   * True if minimum results guarantee was used (threshold bypassed)
   */
  fallback?: boolean;

  /**
   * Number of candidates filtered out
   */
  filtered: number;

  /**
   * Time taken for reranking in milliseconds
   */
  latency: number;

  /**
   * Provider name that performed the reranking
   */
  provider: string;
  /**
   * Reranked results sorted by score descending
   */
  results: RerankResult[];
}

/**
 * Options for rerank operation
 */
export interface RerankOptions {
  /**
   * Minimum number of results to return. If threshold filtering
   * would return fewer than this, top results by score are returned
   * regardless of threshold.
   * @default 0 (no minimum guarantee)
   */
  minResults?: number;

  /**
   * Request ID for logging/tracing
   */
  requestId?: string;

  /**
   * Minimum relevance threshold to include result
   * @default 0.4
   */
  threshold?: number;
  /**
   * Maximum number of results to return
   */
  topK?: number;
}

/**
 * Interface for rerank providers
 *
 * All rerank providers must implement this interface to ensure
 * consistent behavior across different reranking strategies.
 */
export interface RerankProvider {
  /**
   * Name of the provider (e.g., "cohere", "llm", "passthrough")
   */
  readonly name: string;

  /**
   * Rerank candidates based on query relevance
   *
   * @param query - The user's search query
   * @param candidates - Array of candidates to rerank
   * @param options - Optional configuration
   * @returns Promise resolving to rerank response
   */
  rerank(
    query: string,
    candidates: RerankCandidate[],
    options?: RerankOptions
  ): Promise<RerankResponse>;
}

/**
 * Rerank mode for quality tier selection
 *
 * - fast: No reranking, use vector scores only (passthrough)
 * - balanced: Cohere rerank API for efficient reranking
 * - thorough: LLM-based semantic scoring for highest quality
 */
export type RerankMode = "fast" | "balanced" | "thorough";
