// Client

// Zod Schemas (for runtime validation, used by MCP server)
export {
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
  V1SearchRequestSchema,
} from "@repo/console-validation/api";
export {
  createLightfast,
  createLightfastMemory,
  Lightfast,
  LightfastMemory,
} from "./client";
// Constants
export {
  API_KEY_SECRET_LENGTH,
  isValidApiKeyFormat,
  LIGHTFAST_API_KEY_PREFIX,
} from "./constants";
// Errors
export {
  AuthenticationError,
  LightfastError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "./errors";
// Types
export type {
  ContentsInput,
  FindSimilarInput,
  GraphEdge,
  GraphInput,
  GraphNode,
  GraphResponse,
  LightfastConfig,
  // Deprecated alias
  LightfastMemoryConfig,
  RelatedEvent,
  RelatedInput,
  RelatedResponse,
  RerankMode,
  // SDK input types (with optional fields for defaults)
  SearchInput,
  V1ContentItem,
  V1ContentsRequest,
  V1ContentsResponse,
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
  // Graph types
  V1GraphRequest,
  // Related types
  V1RelatedRequest,
  V1SearchContext,
  V1SearchFilters,
  V1SearchLatency,
  V1SearchMeta,
  // V1 API types (re-exported from @repo/console-types)
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
} from "./types";
