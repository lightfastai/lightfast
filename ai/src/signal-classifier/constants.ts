import { signalIntakeAgentGraph } from "../_internal/agent-graphs/signal-intake";

const signalClassifierNode = signalIntakeAgentGraph.nodes.signalClassifier;

export const SIGNAL_CLASSIFICATION_SCHEMA_VERSION =
  signalClassifierNode.schemaVersion;
export const SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS = 512;
export const SIGNAL_CLASSIFIER_MODEL = "openai/gpt-5.4-nano";
export const SIGNAL_CLASSIFIER_FEATURE = signalClassifierNode.feature;
export const SIGNAL_CLASSIFIER_PROMPT_ID = signalClassifierNode.promptId;
export const SIGNAL_CLASSIFIER_WORKFLOW = signalClassifierNode.workflow;
export const SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID =
  "app.inngest.classify-signal";
export const SIGNAL_CLASSIFIER_TIMEOUT_MS = 30_000;

export const SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE = "CLASSIFICATION_FAILED";
export const SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE =
  "CLASSIFICATION_PROVIDER_ERROR";
export const SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE =
  "CLASSIFICATION_INVALID_OUTPUT";
export const SIGNAL_CLASSIFICATION_TIMEOUT_ERROR_CODE =
  "CLASSIFICATION_TIMEOUT";

export type SignalClassificationFailureCode =
  | typeof SIGNAL_CLASSIFICATION_FAILED_ERROR_CODE
  | typeof SIGNAL_CLASSIFICATION_PROVIDER_ERROR_CODE
  | typeof SIGNAL_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE
  | typeof SIGNAL_CLASSIFICATION_TIMEOUT_ERROR_CODE;
