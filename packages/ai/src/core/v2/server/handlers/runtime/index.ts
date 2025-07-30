/**
 * Runtime Handlers - Export all runtime-related handlers
 * 
 * These handlers work with the AgentRuntime to process agent execution events
 */

export { handleAgentInit } from "./init-handler";
export type { InitHandlerDependencies } from "./init-handler";

export { handleAgentStep } from "./step-handler";
export type { StepHandlerDependencies } from "./step-handler";

export { handleToolCall } from "./tool-handler";
export type { ToolHandlerDependencies } from "./tool-handler";