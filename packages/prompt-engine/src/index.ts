// Core types

// Builder
export { buildPrompt } from "./builder";
// Context
export { buildPromptContext } from "./context";
export type {
  CommunicationStyle,
  PromptContext,
  PromptFeatureFlags,
  PromptSection,
  SectionProvider,
  TemporalContext,
  UserContext,
} from "./types";
export {
  CommunicationStyleSchema,
  DEFAULT_FEATURE_FLAGS,
  PromptSectionPriority,
} from "./types";
