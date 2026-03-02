/**
 * V2 Server exports for easy imports
 * @module @lightfast/ai/v2/server
 */

export {
	type FetchRequestHandlerOptions,
	fetchRequestHandler,
} from "../core/v2/server/adapters/fetch";
export { EventConsumer } from "../core/v2/server/events/consumer";
export { EventWriter } from "../core/v2/server/events/event-writer";
// Event types
export {
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
} from "../core/v2/server/events/types";
// Runtime handlers
export {
	type StepHandlerDependencies,
	handleAgentStep,
	type ToolHandlerDependencies,
	handleToolCall,
} from "../core/v2/server/handlers/runtime";
export { MessageReader } from "../core/v2/server/readers/message-reader";
export { StreamConsumer } from "../core/v2/server/stream/consumer";
export { generateSessionId } from "../core/v2/server/utils";
export { MessageWriter } from "../core/v2/server/writers/message-writer";
export { SessionWriter } from "../core/v2/server/writers/session-writer";
