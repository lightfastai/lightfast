import type { UIMessage } from "ai";

/**
 * Memory interface for agent state persistence
 */
export interface Memory<TMessage extends UIMessage = UIMessage> {
	// Message operations
	appendMessage(params: { sessionId: string; message: TMessage }): Promise<void>;
	getMessages(sessionId: string): Promise<TMessage[]>;

	// Session operations
	createSession(params: { sessionId: string; resourceId: string; agentId: string }): Promise<void>;
	getSession(sessionId: string): Promise<{ resourceId: string } | null>;

	// Stream operations
	createStream(params: { sessionId: string; streamId: string }): Promise<void>;
	getSessionStreams(sessionId: string): Promise<string[]>;
}

// Re-export adapters
export { InMemoryMemory } from "./adapters/in-memory";
export { RedisMemory } from "./adapters/redis";
