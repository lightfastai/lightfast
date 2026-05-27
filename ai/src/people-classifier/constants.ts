import { signalIntakeAgentGraph } from "../_internal/agent-graphs/signal-intake";

const peopleClassifierNode = signalIntakeAgentGraph.nodes.peopleClassifier;

export const PEOPLE_CLASSIFICATION_SCHEMA_VERSION =
  peopleClassifierNode.schemaVersion;
export const PEOPLE_CLASSIFIER_MAX_OUTPUT_TOKENS = 768;
export const PEOPLE_CLASSIFIER_MODEL = "openai/gpt-5.4-nano";
export const PEOPLE_CLASSIFIER_FEATURE = peopleClassifierNode.feature;
export const PEOPLE_CLASSIFIER_PROMPT_ID = peopleClassifierNode.promptId;
export const PEOPLE_CLASSIFIER_WORKFLOW = peopleClassifierNode.workflow;
export const PEOPLE_CLASSIFIER_TELEMETRY_FUNCTION_ID =
  "app.inngest.classify-people";
export const PEOPLE_CLASSIFIER_TIMEOUT_MS = 30_000;

export const PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_FAILED";
export const PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_PROVIDER_ERROR";
export const PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_INVALID_OUTPUT";
export const PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_TIMEOUT";

export type PeopleClassificationFailureCode =
  | typeof PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE
  | typeof PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE
  | typeof PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE
  | typeof PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE;
