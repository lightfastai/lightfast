// Re-export API types from app-validation for SDK consumers.
// Search types come from the root export, proxy types from the /api subpath.
export type {
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "@repo/app-validation";

export type {
  ProxyConnection,
  ProxyEndpoint,
  ProxyExecuteRequest,
  ProxyExecuteResponse,
  ProxySearchResponse,
} from "@repo/app-validation/api";

import type { SearchRequest } from "@repo/app-validation";
import type { ProxyExecuteRequest } from "@repo/app-validation/api";

/**
 * SDK input type for search requests.
 * Makes fields with server-side defaults optional for better DX.
 *
 * The canonical SearchRequest (from Zod .default()) makes limit/offset/mode required.
 * SearchInput makes everything except `query` optional — the SDK applies defaults.
 */
export type SearchInput = Pick<SearchRequest, "query"> &
  Partial<Omit<SearchRequest, "query">>;

/**
 * SDK input alias for proxy execute requests.
 * Maps to ProxyExecuteRequest from @repo/app-validation/api.
 */
export type ProxyExecuteInput = ProxyExecuteRequest;

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
}
