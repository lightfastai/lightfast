import type { UIMessage } from "ai";
import type { Memory } from "../";

/**
 * In-memory implementation of Memory interface (for testing)
 */
export class InMemoryMemory<
	TMessage extends UIMessage = UIMessage,
	TContext = Record<string, unknown>,
> implements Memory<TMessage, TContext>
{
	private sessions = new Map<string, { resourceId: string }>();
	private messages = new Map<string, TMessage[]>();
	private streams = new Map<string, string[]>();

	appendMessage({
		sessionId,
		message,
		context: _context,
	}: {
		sessionId: string;
		message: TMessage;
		context?: TContext;
	}): Promise<void> {
		const existing = this.messages.get(sessionId) ?? [];
		this.messages.set(sessionId, [...existing, message]);
		return Promise.resolve();
	}

	getMessages(sessionId: string): Promise<TMessage[]> {
		return Promise.resolve(this.messages.get(sessionId) ?? []);
	}

	createSession({
		sessionId,
		resourceId,
		context: _context,
	}: {
		sessionId: string;
		resourceId: string;
		context?: TContext;
	}): Promise<void> {
		if (!this.sessions.has(sessionId)) {
			this.sessions.set(sessionId, { resourceId });
		}
		return Promise.resolve();
	}

	getSession(sessionId: string): Promise<{ resourceId: string } | null> {
		const session = this.sessions.get(sessionId);
		return Promise.resolve(session ? { resourceId: session.resourceId } : null);
	}

	createStream({
		sessionId,
		streamId,
		context: _context,
	}: {
		sessionId: string;
		streamId: string;
		context?: TContext;
	}): Promise<void> {
		const existing = this.streams.get(sessionId) ?? [];
		this.streams.set(sessionId, [streamId, ...existing].slice(0, 100)); // Keep last 100
		return Promise.resolve();
	}

	getSessionStreams(sessionId: string): Promise<string[]> {
		return Promise.resolve(this.streams.get(sessionId) ?? []);
	}
}
