/**
 * @vendor/braintrust
 *
 * Vendor abstraction for Braintrust AI evaluation and tracing.
 * Re-exports core functionality with consistent configuration.
 */

// Re-export Braintrust SDK
export {
  Eval,
  initLogger,
  wrapOpenAI,
  wrapAISDKModel,
  type EvalCase,
  type EvalScorerArgs,
  type Experiment,
} from "braintrust";

// Export environment config
export { braintrustEnv } from "./env";

// Re-export with type safety
export type { Logger } from "braintrust";
