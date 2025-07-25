import type { UIMessage } from "ai";

/**
 * Memory interface for agent state persistence
 */
export interface Memory<TMessage extends UIMessage = UIMessage> {
	// Message operations
	appendMessages(params: { threadId: string; messages: TMessage[] }): Promise<void>;
	createMessages(params: { threadId: string; messages: TMessage[] }): Promise<void>;
	getMessages(threadId: string): Promise<TMessage[]>;

	// Thread operations
	createThread(params: { threadId: string; resourceId: string; agentId: string }): Promise<void>;
	getThread(threadId: string): Promise<{ resourceId: string } | null>;

	// Stream operations
	createStream(params: { threadId: string; streamId: string }): Promise<void>;
	getThreadStreams(threadId: string): Promise<string[]>;
}

/**
 * In-memory implementation of Memory interface (for testing)
 */
export class InMemoryMemory<TMessage extends UIMessage = UIMessage> implements Memory<TMessage> {
	private threads = new Map<string, { resourceId: string; agentId: string }>();
	private messages = new Map<string, TMessage[]>();
	private streams = new Map<string, string[]>();

	async appendMessages({ threadId, messages }: { threadId: string; messages: TMessage[] }): Promise<void> {
		const existing = this.messages.get(threadId) || [];
		this.messages.set(threadId, [...existing, ...messages]);
	}

	async createMessages({ threadId, messages }: { threadId: string; messages: TMessage[] }): Promise<void> {
		this.messages.set(threadId, messages);
	}

	async getMessages(threadId: string): Promise<TMessage[]> {
		return this.messages.get(threadId) || [];
	}

	async createThread({
		threadId,
		resourceId,
		agentId,
	}: {
		threadId: string;
		resourceId: string;
		agentId: string;
	}): Promise<void> {
		if (!this.threads.has(threadId)) {
			this.threads.set(threadId, { resourceId, agentId });
		}
	}

	async getThread(threadId: string): Promise<{ resourceId: string } | null> {
		const thread = this.threads.get(threadId);
		return thread ? { resourceId: thread.resourceId } : null;
	}

	async createStream({ threadId, streamId }: { threadId: string; streamId: string }): Promise<void> {
		const existing = this.streams.get(threadId) || [];
		this.streams.set(threadId, [streamId, ...existing].slice(0, 100)); // Keep last 100
	}

	async getThreadStreams(threadId: string): Promise<string[]> {
		return this.streams.get(threadId) || [];
	}
}
