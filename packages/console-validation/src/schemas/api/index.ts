// Internal API schemas (used by tRPC routers)
export {
  SearchRequestSchema,
  SearchResponseSchema,
} from "./search";
export type {
  SearchResponse,
} from "./search";

export {
  ContentsRequestSchema,
  ContentsResponseSchema,
} from "./contents";
export type {
  ContentsResponse,
} from "./contents";

// V1 public API schemas (used by SDK, OpenAPI)
export {
  V1SearchRequestSchema,
  V1SearchResponseSchema,
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
  GraphResponseSchema,
  RelatedResponseSchema,
} from "./v1";
