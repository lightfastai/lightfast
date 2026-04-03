// Client

// Zod Schemas (for runtime validation, used by MCP server)
export { SearchRequestSchema } from "@repo/app-validation/api";
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
  LightfastConfig,
  // Deprecated alias
  LightfastMemoryConfig,
  ProxyConnection,
  ProxyEndpoint,
  ProxyExecuteInput,
  ProxyExecuteResponse,
  ProxySearchResponse,
  RerankMode,
  SearchContext,
  SearchFilters,
  // SDK input types (with optional fields for defaults)
  SearchInput,
  SearchLatency,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./types";
