// Internal API schemas (used by tRPC routers)

export type { ContentsResponse } from "./contents";
export {
  ContentsRequestSchema,
  ContentsResponseSchema,
} from "./contents";
export type { SearchResponse } from "./search";
export {
  SearchRequestSchema,
  SearchResponseSchema,
} from "./search";

// V1 public API schemas (used by SDK, OpenAPI)
export {
  GraphResponseSchema,
  RelatedResponseSchema,
  V1ContentsRequestSchema,
  V1ContentsResponseSchema,
  V1FindSimilarRequestSchema,
  V1FindSimilarResponseSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
  V1SearchRequestSchema,
  V1SearchResponseSchema,
} from "./v1";
