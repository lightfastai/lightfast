import type { UIMessage } from "ai";
import type { Memory } from "../";

/**
 * In-memory implementation of Memory interface (for testing)
 */
export class InMemoryMemory<TMessage extends UIMessage = UIMessage> implements Memory<TMessage> {
	private sessions = new Map<string, { resourceId: string; agentId: string }>();
	private messages = new Map<string, TMessage[]>();
	private streams = new Map<string, string[]>();

	async appendMessage({ sessionId, message }: { sessionId: string; message: TMessage }): Promise<void> {
		const existing = this.messages.get(sessionId) || [];
		this.messages.set(sessionId, [...existing, message]);
	}

	async createMessages({ sessionId, messages }: { sessionId: string; messages: TMessage[] }): Promise<void> {
		this.messages.set(sessionId, messages);
	}

	async getMessages(sessionId: string): Promise<TMessage[]> {
		return this.messages.get(sessionId) || [];
	}

	async createSession({
		sessionId,
		resourceId,
		agentId,
	}: {
		sessionId: string;
		resourceId: string;
		agentId: string;
	}): Promise<void> {
		if (!this.sessions.has(sessionId)) {
			this.sessions.set(sessionId, { resourceId, agentId });
		}
	}

	async getSession(sessionId: string): Promise<{ resourceId: string } | null> {
		const session = this.sessions.get(sessionId);
		return session ? { resourceId: session.resourceId } : null;
	}

	async createStream({ sessionId, streamId }: { sessionId: string; streamId: string }): Promise<void> {
		const existing = this.streams.get(sessionId) || [];
		this.streams.set(sessionId, [streamId, ...existing].slice(0, 100)); // Keep last 100
	}

	async getSessionStreams(sessionId: string): Promise<string[]> {
		return this.streams.get(sessionId) || [];
	}
}