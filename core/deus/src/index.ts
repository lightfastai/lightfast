// Deus v2.0 - Simple Mode
export { SimpleOrchestrator } from './lib/simple-orchestrator.js';
export { DeusAgent } from './lib/router.js';
export { MCPOrchestrator } from './lib/mcp-orchestrator.js';

// Legacy exports (for backward compatibility)
export { Orchestrator } from './lib/orchestrator.js';

// Types
export * from './types/index.js';
export type { ActiveAgent, AgentMessage, OrchestratorState } from './lib/simple-orchestrator.js';
export type { DeusResponse, DeusAction } from './lib/router.js';
