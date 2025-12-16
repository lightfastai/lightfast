// Client
export { Lightfast, createLightfast } from "./client";

// Deprecated aliases
export { LightfastMemory, createLightfastMemory } from "./client";

// Errors
export {
  LightfastError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
} from "./errors";

// Types
export type {
  LightfastConfig,
  // Deprecated alias
  LightfastMemoryConfig,
  // SDK input types (with optional fields for defaults)
  SearchInput,
  ContentsInput,
  FindSimilarInput,
  // V1 API types (re-exported from @repo/console-types)
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
  V1SearchFilters,
  V1SearchContext,
  V1SearchLatency,
  V1SearchMeta,
  RerankMode,
  V1ContentsRequest,
  V1ContentsResponse,
  V1ContentItem,
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
} from "./types";
