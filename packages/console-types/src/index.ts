// API types (explicit re-exports from leaf modules, bypassing intermediate barrels)
export {
  SearchRequestSchema,
  SearchResultSchema,
  SearchResponseSchema,
} from "./api/search";
export type {
  SearchRequest,
  SearchResult,
  SearchResponse,
} from "./api/search";

export {
  ContentsRequestSchema,
  DocumentContentSchema,
  ContentsResponseSchema,
} from "./api/contents";
export type {
  ContentsRequest,
  DocumentContent,
  ContentsResponse,
} from "./api/contents";

export {
  RequestIdSchema,
  LatencySchema,
  PaginationSchema,
} from "./api/common";
export type {
  Latency,
  Pagination,
} from "./api/common";

// V1 public API (direct to leaf modules)
export {
  RerankModeSchema,
  V1SearchFiltersSchema,
  V1SearchRequestSchema,
  V1SourceReferenceSchema,
  V1SearchResultSchema,
  V1SearchContextSchema,
  V1SearchLatencySchema,
  V1SearchMetaSchema,
  V1SearchResponseSchema,
} from "./api/v1/search";
export type {
  RerankMode,
  V1SearchFilters,
  V1SearchRequest,
  V1SourceReference,
  V1SearchResult,
  V1SearchContext,
  V1SearchLatency,
  V1SearchMeta,
  V1SearchResponse,
} from "./api/v1/search";

export {
  V1ContentsRequestSchema,
  V1ContentItemSchema,
  V1ContentsResponseSchema,
} from "./api/v1/contents";
export type {
  V1ContentsRequest,
  V1ContentItem,
  V1ContentsResponse,
} from "./api/v1/contents";

export {
  V1FindSimilarRequestSchema,
  V1FindSimilarResultSchema,
  V1FindSimilarSourceSchema,
  V1FindSimilarResponseSchema,
} from "./api/v1/findsimilar";
export type {
  V1FindSimilarRequest,
  V1FindSimilarResult,
  V1FindSimilarSource,
  V1FindSimilarResponse,
} from "./api/v1/findsimilar";

export {
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  GraphResponseSchema,
  RelatedEventSchema,
  RelatedResponseSchema,
} from "./api/v1/graph";
export type {
  V1GraphRequest,
  V1RelatedRequest,
  GraphNode,
  GraphEdge,
  GraphResponse,
  RelatedEvent,
  RelatedResponse,
} from "./api/v1/graph";

// Domain types (already leaf modules)
export type {
  DocumentMetadata,
  ChunkMetadata,
} from "./document";

export type {
  EmbeddingProvider,
  EmbedRequest,
  EmbedResponse,
} from "./vector";

export {
  ErrorCode,
} from "./error";
export type {
  APIError,
} from "./error";

export type {
  RepositoryPermissions,
  RepositoryMetadata,
} from "./repository";

export {
  workspaceEmbeddingConfigSchema,
  workspaceSettingsSchema,
} from "./workspace";
export type {
  WorkspaceEmbeddingConfig,
  WorkspaceSettingsV1,
  WorkspaceSettings,
} from "./workspace";

// Entity types
export type {
  ExtractedEntity,
  EntitySearchResult,
  LLMExtractedEntity,
  LLMEntityExtractionResponse,
} from "./entity";

// Gateway types (interfaces for relay, gateway, backfill services)
export type {
  OAuthTokens,
  GitHubAuthOptions,
  LinearAuthOptions,
  ProviderOptions,
  WebhookReceiptPayload,
  WebhookEnvelope,
  GatewayConnection,
  GatewayTokenResult,
  BaseAccountInfo,
  GitHubInstallationRaw,
  VercelOAuthRaw,
  LinearOAuthRaw,
  SentryOAuthRaw,
  GitHubAccountInfo,
  VercelAccountInfo,
  LinearAccountInfo,
  SentryAccountInfo,
  ProviderAccountInfo,
} from "./gateway";
