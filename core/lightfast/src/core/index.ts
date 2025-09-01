// Main entrypoint for the Lightfast client SDK

// Export the client API
export { 
	Lightfast, 
	createLightfast,
	type LightfastConfig,
	type Agent 
} from "./client";

// Re-export agent creation utilities for convenience
export { 
	createAgent,
	type AgentOptions,
	type LightfastConfig as LightfastAgentConfig,
	type VercelAIConfig 
} from "./primitives/agent";

// Re-export tool creation utilities
export { 
	createTool,
	type ToolFactory,
	type ToolFactorySet,
	type InferToolContext,
	type InferTool
} from "./primitives/tool";

// Re-export context types
export type { 
	SystemContext,
	RequestContext,
	RuntimeContext 
} from "./server/adapters/types";