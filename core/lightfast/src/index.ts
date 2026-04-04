// Client
export { createLightfast, Lightfast } from "./client";

// Zod Schemas (for runtime validation, used by MCP server)
export {
  ProxyExecuteRequestSchema,
  ProxySearchResponseSchema,
  SearchRequestSchema,
} from "@repo/app-validation/api";

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
  ProxyConnection,
  ProxyEndpoint,
  ProxyExecuteInput,
  ProxyExecuteRequest,
  ProxyExecuteResponse,
  ProxySearchResponse,
  SearchInput,
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./types";
