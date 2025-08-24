import type { UIMessage } from "ai";

/**
 * Memory interface for agent state persistence
 * @template TMessage - The message type, extends UIMessage
 * @template TContext - Optional context type for passing metadata through memory operations
 */
export interface Memory<TMessage extends UIMessage = UIMessage, TContext = {}> {
	// Message operations
	appendMessage(params: {
		sessionId: string;
		message: TMessage;
		context?: TContext;
	}): Promise<void>;
	getMessages(sessionId: string): Promise<TMessage[]>;

	// Session operations
	createSession(params: {
		sessionId: string;
		resourceId: string;
		context?: TContext;
	}): Promise<void>;
	getSession(sessionId: string): Promise<{ resourceId: string } | null>;

	// Stream operations
	createStream(params: {
		sessionId: string;
		streamId: string;
		context?: TContext;
	}): Promise<void>;
	getSessionStreams(sessionId: string): Promise<string[]>;
}

// Re-export adapters
export { InMemoryMemory } from "./adapters/in-memory";
export { RedisMemory } from "./adapters/redis";
