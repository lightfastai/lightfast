import { signalIntakeAgentGraph } from "../_internal/agent-graphs/signal-intake";

const signalEntityLinkerNode = signalIntakeAgentGraph.nodes.signalEntityLinker;

export const SIGNAL_ENTITY_LINKS_SCHEMA_VERSION =
  signalEntityLinkerNode.schemaVersion;
export const SIGNAL_ENTITY_LINKER_MAX_OUTPUT_TOKENS = 768;
export const SIGNAL_ENTITY_LINKER_MODEL = "openai/gpt-5.4-nano";
export const SIGNAL_ENTITY_LINKER_FEATURE = signalEntityLinkerNode.feature;
export const SIGNAL_ENTITY_LINKER_PROMPT_ID = signalEntityLinkerNode.promptId;
export const SIGNAL_ENTITY_LINKER_WORKFLOW = signalEntityLinkerNode.workflow;
export const SIGNAL_ENTITY_LINKER_TELEMETRY_FUNCTION_ID =
  "app.inngest.index-signal-entities";
export const SIGNAL_ENTITY_LINKER_TIMEOUT_MS = 30_000;

export const SIGNAL_ENTITY_LINKING_FAILED_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_FAILED";
export const SIGNAL_ENTITY_LINKING_PROVIDER_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_PROVIDER_ERROR";
export const SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_INVALID_OUTPUT";
export const SIGNAL_ENTITY_LINKING_TIMEOUT_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_TIMEOUT";

export type SignalEntityLinkingFailureCode =
  | typeof SIGNAL_ENTITY_LINKING_FAILED_ERROR_CODE
  | typeof SIGNAL_ENTITY_LINKING_PROVIDER_ERROR_CODE
  | typeof SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE
  | typeof SIGNAL_ENTITY_LINKING_TIMEOUT_ERROR_CODE;
