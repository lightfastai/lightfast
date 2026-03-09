// Main entrypoint for the Lightfast client SDK

// Export the client API
export {
  type Agent,
  createLightfast,
  Lightfast,
  type LightfastConfig,
} from "./client";

// Re-export agent creation utilities for convenience
export {
  type AgentOptions,
  createAgent,
  type LightfastConfig as LightfastAgentConfig,
  type VercelAIConfig,
} from "./primitives/agent";

// Re-export tool creation utilities
export {
  createTool,
  type InferTool,
  type InferToolContext,
  type ToolFactory,
  type ToolFactorySet,
} from "./primitives/tool";

// Re-export context types
export type {
  RequestContext,
  RuntimeContext,
  SystemContext,
} from "./server/adapters/types";
