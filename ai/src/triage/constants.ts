import { triageAgentGraph } from "../_internal/agent-graphs/triage";

const {
  triageActionRecommender,
  triageSimilarityRanker,
  triageSourceClassifier,
} = triageAgentGraph.nodes;

export const TRIAGE_MODEL = "openai/gpt-5.4-nano";
export const TRIAGE_TIMEOUT_MS = 30_000;

export const TRIAGE_SOURCE_CLASSIFICATION_SCHEMA_VERSION =
  triageSourceClassifier.schemaVersion;
export const TRIAGE_SOURCE_CLASSIFIER_MAX_OUTPUT_TOKENS = 800;
export const TRIAGE_SOURCE_CLASSIFIER_TELEMETRY_FUNCTION_ID =
  "app.triage.classify-source-item";

export const TRIAGE_SIMILARITY_SCHEMA_VERSION =
  triageSimilarityRanker.schemaVersion;
export const TRIAGE_SIMILARITY_MAX_OUTPUT_TOKENS = 1000;
export const TRIAGE_SIMILARITY_TELEMETRY_FUNCTION_ID =
  "app.triage.rank-similar-items";

export const TRIAGE_ACTION_RECOMMENDATION_SCHEMA_VERSION =
  triageActionRecommender.schemaVersion;
export const TRIAGE_ACTION_RECOMMENDATION_MAX_OUTPUT_TOKENS = 900;
export const TRIAGE_ACTION_RECOMMENDATION_TELEMETRY_FUNCTION_ID =
  "app.triage.recommend-action";

export const TRIAGE_FAILED_ERROR_CODE = "TRIAGE_FAILED";
export const TRIAGE_PROVIDER_ERROR_CODE = "TRIAGE_PROVIDER_ERROR";
export const TRIAGE_INVALID_OUTPUT_ERROR_CODE = "TRIAGE_INVALID_OUTPUT";
export const TRIAGE_TIMEOUT_ERROR_CODE = "TRIAGE_TIMEOUT";

export type TriageFailureCode =
  | typeof TRIAGE_FAILED_ERROR_CODE
  | typeof TRIAGE_PROVIDER_ERROR_CODE
  | typeof TRIAGE_INVALID_OUTPUT_ERROR_CODE
  | typeof TRIAGE_TIMEOUT_ERROR_CODE;
