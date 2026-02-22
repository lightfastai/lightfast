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
  // Graph types
  V1GraphRequest,
  GraphResponse,
  GraphNode,
  GraphEdge,
  // Related types
  V1RelatedRequest,
  RelatedResponse,
  RelatedEvent,
} from "@repo/console-types";

import type {
  V1SearchRequest,
  V1ContentsRequest,
  V1FindSimilarRequest,
  V1GraphRequest,
  V1RelatedRequest,
} from "@repo/console-types";

/**
 * SDK Input Type Pattern
 * =====================
 *
 * The V1 API schemas in @repo/console-types use Zod .default() for fields with server-side defaults.
 * However, z.infer<> treats these fields as REQUIRED in the TypeScript type, even though Zod
 * applies defaults at runtime.
 *
 * To improve DX, we create SDK input types (SearchInput, FindSimilarInput, etc.) that make these
 * fields OPTIONAL. The SDK client then applies the defaults before making API calls.
 *
 * MAINTENANCE: When V1 schemas change:
 * 1. If a field gets a new .default() → Add it to the Omit<> and Partial<Pick<>> in the SDK input type
 * 2. If a field loses its .default() → Remove it from the transformation (keep it required)
 * 3. If a new endpoint is added with defaults → Create a new input type following this pattern
 *
 * Pattern:
 *   type XInput = Omit<V1XRequest, "fieldsWithDefaults"> &
 *                 Partial<Pick<V1XRequest, "fieldsWithDefaults">>
 *
 * See: core/lightfast/src/client.ts for where defaults are applied
 */

/**
 * SDK input type for search requests.
 * Makes fields with defaults optional for better developer experience.
 * The API applies defaults server-side via Zod validation.
 */
export type SearchInput = Omit<
  V1SearchRequest,
  "limit" | "offset" | "mode" | "includeContext" | "includeHighlights"
> &
  Partial<
    Pick<
      V1SearchRequest,
      "limit" | "offset" | "mode" | "includeContext" | "includeHighlights"
    >
  >;

/**
 * SDK input type for contents requests.
 * Matches V1ContentsRequest (no defaults to make optional).
 */
export type ContentsInput = V1ContentsRequest;

/**
 * SDK input type for findSimilar requests.
 * Makes fields with defaults optional for better developer experience.
 */
export type FindSimilarInput = Omit<
  V1FindSimilarRequest,
  "limit" | "threshold" | "sameSourceOnly"
> &
  Partial<
    Pick<V1FindSimilarRequest, "limit" | "threshold" | "sameSourceOnly">
  >;

/**
 * SDK input type for graph requests.
 * Makes depth optional (defaults to 2).
 */
export type GraphInput = Omit<V1GraphRequest, "depth"> &
  Partial<Pick<V1GraphRequest, "depth">>;

/**
 * SDK input type for related requests.
 * Matches V1RelatedRequest (no defaults to make optional).
 */
export type RelatedInput = V1RelatedRequest;

/**
 * Configuration for the Lightfast client
 */
export interface LightfastConfig {
  /**
   * Your Lightfast API key (starts with sk_)
   */
  apiKey: string;

  /**
   * Base URL for the Lightfast API
   * @default "https://lightfast.ai"
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}

/**
 * @deprecated Use `LightfastConfig` instead
 */
export type LightfastMemoryConfig = LightfastConfig;
