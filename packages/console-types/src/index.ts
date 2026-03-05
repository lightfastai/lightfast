// V1 public API (direct to leaf modules)
export {
  V1SearchRequestSchema,
  V1SearchResponseSchema,
} from "./api/v1/search";
export type {
  RerankMode,
  V1SearchFilters,
  V1SearchRequest,
  V1SearchResult,
  V1SearchContext,
  V1SearchLatency,
  V1SearchMeta,
  V1SearchResponse,
} from "./api/v1/search";

export {
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
} from "./api/v1/contents";
export type {
  V1ContentsRequest,
  V1ContentItem,
  V1ContentsResponse,
} from "./api/v1/contents";

export {
  V1FindSimilarRequestSchema,
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
  GraphResponseSchema,
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

// Domain types
export type {
  WorkspaceSettings,
} from "./workspace";

// Entity types
export type {
  ExtractedEntity,
  EntitySearchResult,
} from "./entity";
