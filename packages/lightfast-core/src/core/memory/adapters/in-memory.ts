import type { UIMessage } from "ai";
import type { Memory } from "../";

/**
 * In-memory implementation of Memory interface (for testing)
 */
export class InMemoryMemory<
	TMessage extends UIMessage = UIMessage,
	TContext = {},
> implements Memory<TMessage, TContext>
{
	private sessions = new Map<string, { resourceId: string }>();
	private messages = new Map<string, TMessage[]>();
	private streams = new Map<string, string[]>();

	async appendMessage({
		sessionId,
		message,
		context,
	}: {
		sessionId: string;
		message: TMessage;
		context?: TContext;
	}): Promise<void> {
		const existing = this.messages.get(sessionId) || [];
		this.messages.set(sessionId, [...existing, message]);
	}

	async getMessages(sessionId: string): Promise<TMessage[]> {
		return this.messages.get(sessionId) || [];
	}

	async createSession({
		sessionId,
		resourceId,
		context,
	}: {
		sessionId: string;
		resourceId: string;
		context?: TContext;
	}): Promise<void> {
		if (!this.sessions.has(sessionId)) {
			this.sessions.set(sessionId, { resourceId });
		}
	}

	async getSession(sessionId: string): Promise<{ resourceId: string } | null> {
		const session = this.sessions.get(sessionId);
		return session ? { resourceId: session.resourceId } : null;
	}

	async createStream({
		sessionId,
		streamId,
		context,
	}: {
		sessionId: string;
		streamId: string;
		context?: TContext;
	}): Promise<void> {
		const existing = this.streams.get(sessionId) || [];
		this.streams.set(sessionId, [streamId, ...existing].slice(0, 100)); // Keep last 100
	}

	async getSessionStreams(sessionId: string): Promise<string[]> {
		return this.streams.get(sessionId) || [];
	}
}
