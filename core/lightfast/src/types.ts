// Re-export API types from console-types for SDK consumers
// These are used at compile time only (devDependency)
export type {
  // Search types
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
  V1SearchFilters,
  V1SearchContext,
  V1SearchLatency,
  V1SearchMeta,
  RerankMode,
  // Contents types
  V1ContentsRequest,
  V1ContentsResponse,
  V1ContentItem,
  // FindSimilar types
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
} from "@repo/console-types";

/**
 * Configuration for the LightfastMemory client
 */
export interface LightfastMemoryConfig {
  /**
   * Your Lightfast API key (starts with sk_live_ or sk_test_)
   */
  apiKey: string;

  /**
   * Base URL for the Lightfast API
   * @default "https://console.lightfast.ai"
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * Simplified search request for SDK consumers
 * (Omits internal fields, provides better defaults)
 */
export interface SearchRequest {
  /** The search query */
  query: string;
  /** Number of results to return (1-100) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Search mode: "fast", "balanced", or "thorough" */
  mode?: "fast" | "balanced" | "thorough";
  /** Optional filters */
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: { start?: string; end?: string };
  };
  /** Include context clusters and actors */
  includeContext?: boolean;
  /** Include text highlights */
  includeHighlights?: boolean;
}

/**
 * Simplified contents request for SDK consumers
 */
export interface ContentsRequest {
  /** Content IDs to fetch (doc_* or obs_* format) */
  ids: string[];
}

/**
 * Simplified findSimilar request for SDK consumers
 */
export interface FindSimilarRequest {
  /** Content ID to find similar items for */
  id?: string;
  /** URL to find similar items for */
  url?: string;
  /** Number of results to return (1-50) */
  limit?: number;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Only return items from the same source */
  sameSourceOnly?: boolean;
  /** IDs to exclude from results */
  excludeIds?: string[];
  /** Optional filters */
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: { start?: string; end?: string };
  };
}
