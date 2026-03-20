// Re-export API types from console-validation for SDK consumers
// These are used at compile time only (devDependency)
export type {
  ContentItem,
  ContentsRequest,
  ContentsResponse,
  FindSimilarRequest,
  FindSimilarResponse,
  FindSimilarResult,
  FindSimilarSource,
  RelatedEvent,
  RelatedRequest,
  RelatedResponse,
  RerankMode,
  SearchContext,
  SearchFilters,
  SearchLatency,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "@repo/app-validation";

import type {
  ContentsRequest,
  FindSimilarRequest,
  RelatedRequest,
  SearchRequest,
} from "@repo/app-validation";

/**
 * SDK Input Type Pattern
 * =====================
 *
 * The canonical API schemas in @repo/app-validation use Zod .default() for fields with
 * server-side defaults. However, z.infer<> treats these fields as REQUIRED in the TypeScript
 * type, even though Zod applies defaults at runtime.
 *
 * To improve DX, we create SDK input types (SearchInput, FindSimilarInput, etc.) that make these
 * fields OPTIONAL. The SDK client then applies the defaults before making API calls.
 *
 * MAINTENANCE: When schemas change:
 * 1. If a field gets a new .default() → Add it to the Omit<> and Partial<Pick<>> in the SDK input type
 * 2. If a field loses its .default() → Remove it from the transformation (keep it required)
 * 3. If a new endpoint is added with defaults → Create a new input type following this pattern
 *
 * Pattern:
 *   type XInput = Omit<XRequest, "fieldsWithDefaults"> &
 *                 Partial<Pick<XRequest, "fieldsWithDefaults">>
 *
 * See: core/lightfast/src/client.ts for where defaults are applied
 */

/**
 * SDK input type for search requests.
 * Makes fields with defaults optional for better developer experience.
 */
export type SearchInput = Omit<SearchRequest, "limit" | "offset" | "mode"> &
  Partial<Pick<SearchRequest, "limit" | "offset" | "mode">>;

/**
 * SDK input type for contents requests.
 * Matches ContentsRequest (no defaults to make optional).
 */
export type ContentsInput = ContentsRequest;

/**
 * SDK input type for findSimilar requests.
 * Makes fields with defaults optional for better developer experience.
 */
export type FindSimilarInput = Omit<
  FindSimilarRequest,
  "limit" | "threshold" | "sameSourceOnly"
> &
  Partial<
    Pick<FindSimilarRequest, "limit" | "threshold" | "sameSourceOnly">
  > & {
    /** Anchor by arbitrary text for semantic similarity search */
    text?: string;
  };

/**
 * SDK input type for graph requests.
 * Makes depth optional (defaults to 1).
 */
export type GraphInput = Omit<RelatedRequest, "depth"> &
  Partial<Pick<RelatedRequest, "depth">>;

/**
 * SDK input type for related requests.
 * Matches RelatedRequest (no extra defaults to make optional).
 */
export type RelatedInput = RelatedRequest;

/**
 * Configuration for the Lightfast client
 */
export interface LightfastConfig {
  /**
   * Your Lightfast API key (starts with sk-lf-)
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

  /**
   * Workspace ID to scope API requests.
   * Required for all query operations.
   */
  workspaceId: string;
}

/**
 * Response from proxySearch — all available provider API endpoints for the workspace
 */
export interface ProxyEndpoint {
  description: string;
  endpointId: string;
  method: "GET" | "POST";
  path: string;
  pathParams?: string[];
  timeout?: number;
}

export interface ProxyConnection {
  baseUrl: string;
  endpoints: ProxyEndpoint[];
  installationId: string;
  provider: string;
  status: string;
}

export interface ProxySearchResponse {
  connections: ProxyConnection[];
}

/**
 * Input for proxyExecute — execute a provider API call through the Lightfast proxy
 */
export interface ProxyExecuteInput {
  body?: unknown;
  endpointId: string;
  installationId: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export interface ProxyExecuteResponse {
  data: unknown;
  headers: Record<string, string>;
  status: number;
}

/**
 * @deprecated Use `LightfastConfig` instead
 */
export type LightfastMemoryConfig = LightfastConfig;
