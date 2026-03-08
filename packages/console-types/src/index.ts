// API types (explicit re-exports from leaf modules, bypassing intermediate barrels)

export type {
  Latency,
  Pagination,
} from "./api/common";
export {
  LatencySchema,
  PaginationSchema,
  RequestIdSchema,
} from "./api/common";
export type {
  ContentsRequest,
  ContentsResponse,
  DocumentContent,
} from "./api/contents";
export {
  ContentsRequestSchema,
  ContentsResponseSchema,
  DocumentContentSchema,
} from "./api/contents";
export type {
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "./api/search";
export {
  SearchRequestSchema,
  SearchResponseSchema,
  SearchResultSchema,
} from "./api/search";
export type {
  V1ContentItem,
  V1ContentsRequest,
  V1ContentsResponse,
} from "./api/v1/contents";
export {
  V1ContentItemSchema,
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
} from "./api/v1/contents";
export type {
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,
} from "./api/v1/findsimilar";
export {
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
  V1FindSimilarResultSchema,
  V1FindSimilarSourceSchema,
} from "./api/v1/findsimilar";
export type {
  GraphEdge,
  GraphNode,
  GraphResponse,
  RelatedEvent,
  RelatedResponse,
  V1GraphRequest,
  V1RelatedRequest,
} from "./api/v1/graph";
export {
  GraphEdgeSchema,
  GraphNodeSchema,
  GraphResponseSchema,
  RelatedEventSchema,
  RelatedResponseSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
} from "./api/v1/graph";
export type {
  RerankMode,
  V1SearchContext,
  V1SearchFilters,
  V1SearchLatency,
  V1SearchMeta,
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
  V1SourceReference,
} from "./api/v1/search";
// V1 public API (direct to leaf modules)
export {
  RerankModeSchema,
  V1SearchContextSchema,
  V1SearchFiltersSchema,
  V1SearchLatencySchema,
  V1SearchMetaSchema,
  V1SearchRequestSchema,
  V1SearchResponseSchema,
  V1SearchResultSchema,
  V1SourceReferenceSchema,
} from "./api/v1/search";

// Domain types (already leaf modules)
export type {
  ChunkMetadata,
  DocumentMetadata,
} from "./document";
export type { APIError } from "./error";

export { ErrorCode } from "./error";
export type {
  GitHubEvent,
  InternalEventType,
  LinearEvent,
  SentryEvent,
  VercelEvent,
} from "./integrations/event-types";
// Integration types (direct to leaf module)
export {
  ALL_GITHUB_EVENTS,
  ALL_INTERNAL_EVENT_TYPES,
  ALL_LINEAR_EVENTS,
  ALL_SENTRY_EVENTS,
  ALL_VERCEL_EVENTS,
  EVENT_CATEGORIES,
  EVENT_REGISTRY,
  GITHUB_EVENTS,
  GITHUB_TO_INTERNAL,
  getEventConfig,
  getEventWeight,
  INTERNAL_TO_GITHUB,
  isInternalEventType,
  LINEAR_EVENTS,
  LINEAR_TO_INTERNAL,
  SENTRY_EVENTS,
  SENTRY_TO_INTERNAL,
  toExternalGitHubEvent,
  toExternalGitHubEventType,
  toExternalLinearEventType,
  toExternalSentryEventType,
  toExternalVercelEventType,
  toInternalGitHubEvent,
  toInternalLinearEvent,
  toInternalSentryEvent,
  toInternalVercelEvent,
  VERCEL_EVENTS,
  VERCEL_TO_INTERNAL,
  WEBHOOK_EVENT_TYPES,
} from "./integrations/event-types";
export type {
  EntitySearchResult,
  ExtractedEntity,
  LLMEntityExtractionResponse,
  LLMExtractedEntity,
} from "./neural/entity";
// Neural memory types (direct to leaf modules)
export type {
  SourceActor,
  SourceEvent,
  SourceReference,
  TransformContext,
} from "./neural/source-event";
export type {
  RepositoryMetadata,
  RepositoryPermissions,
} from "./repository";
export type {
  EmbeddingProvider,
  EmbedRequest,
  EmbedResponse,
} from "./vector";
export type {
  WorkspaceEmbeddingConfig,
  WorkspaceSettings,
  WorkspaceSettingsV1,
} from "./workspace";
export {
  workspaceEmbeddingConfigSchema,
  workspaceSettingsSchema,
} from "./workspace";
