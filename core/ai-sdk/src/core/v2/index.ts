/**
 * V2 Event-Driven Architecture exports
 * Server-side only - NO React components
 * React components are available via @lightfast/ai/v2/react
 */

// Export environment configurations
export {
	braintrustEnv,
	getBraintrustConfig,
	getOtelConfig,
	isOtelEnabled,
} from "./braintrust-env";
// Re-export all core functionality (server-side only)
export {
	// Agent
	Agent,
	type AgentOptions,
	type AgentToolDefinition,
	// Logger
	NoopLogger,
	noopLogger,
	PinoLoggerAdapter,
	createPinoLoggerFactory,
	LogLevel,
	LogEventName,
	type AgentLoopStartContext,
	type AgentLoopCompleteContext,
	type AgentLoopErrorContext,
	type AgentStepStartContext,
	type AgentStepCompleteContext,
	type AgentToolCallContext,
	type AgentToolResultContext,
	type AgentErrorContext,
	type StreamStartContext,
	type StreamChunkContext,
	type StreamCompleteContext,
	type StreamErrorContext,
	type MessageCreatedContext,
	type MessageUpdatedContext,
	type MessageErrorContext,
	type SessionCreatedContext,
	type SessionResumedContext,
	type SessionErrorContext,
	type WorkerEnqueuedContext,
	type WorkerStartedContext,
	type WorkerCompletedContext,
	type WorkerErrorContext,
	type LogEventContextMap,
	type ILogger,
	type LoggerFactory,
	// Server
	EventConsumer,
	EventWriter,
	type FetchRequestHandlerOptions,
	fetchRequestHandler,
	generateSessionId,
	MessageReader,
	MessageWriter,
	SessionWriter,
	StreamConsumer,
	// Event types
	EventName,
	type AgentLoopStartEvent,
	type AgentLoopCompleteEvent,
	type AgentStepStartEvent,
	type AgentStepCompleteEvent,
	type AgentToolCallEvent,
	type AgentToolResultEvent,
	type AgentErrorEvent,
	type AgentEvent,
	type AgentLoopStartParams,
	type AgentLoopCompleteParams,
	type AgentToolCallParams,
	type AgentToolResultParams,
	type AgentStepStartParams,
	type AgentStepCompleteParams,
	type AgentErrorParams,
	// Stream types
	type DeltaStreamMessage,
	DeltaStreamType,
	// Workers
	AgentDecisionSchema,
	type AgentDecision,
	ToolDefinitionSchema,
	type ToolDefinition,
	WorkerConfigSchema,
	type WorkerConfig,
	// Runtime handlers
	type StepHandlerDependencies,
	handleAgentStep,
	type ToolHandlerDependencies,
	handleToolCall,
} from "./core";
