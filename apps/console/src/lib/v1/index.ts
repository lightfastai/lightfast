export { searchLogic, type SearchLogicInput, type SearchLogicOutput } from "./search";
export { graphLogic, type GraphLogicInput, type GraphLogicOutput } from "./graph";
export { contentsLogic, type ContentsLogicInput, type ContentsLogicOutput } from "./contents";
export { findsimilarLogic, type FindSimilarLogicInput, type FindSimilarLogicOutput } from "./findsimilar";
export { relatedLogic, type RelatedLogicInput, type RelatedLogicOutput } from "./related";

/** Auth context available to all v1 logic functions */
export interface V1AuthContext {
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
}
