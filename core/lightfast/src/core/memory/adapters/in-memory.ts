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
	private streams = new Map<string, string[]>(); // Legacy stream lists
	private activeStreams = new Map<string, string>(); // Active stream IDs

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
		// Set as active stream (new pattern)
		this.activeStreams.set(sessionId, streamId);
		
		// Legacy: Also maintain stream list for backward compatibility
		const existing = this.streams.get(sessionId) ?? [];
		this.streams.set(sessionId, [streamId, ...existing].slice(0, 100));
		return Promise.resolve();
	}

	getSessionStreams(sessionId: string): Promise<string[]> {
		// Legacy method - prefer getActiveStream() for new code
		const activeStreamId = this.activeStreams.get(sessionId);
		return Promise.resolve(activeStreamId ? [activeStreamId] : []);
	}

	getActiveStream(sessionId: string): Promise<string | null> {
		const streamId = this.activeStreams.get(sessionId);
		return Promise.resolve(streamId || null);
	}

	clearActiveStream(sessionId: string): Promise<void> {
		this.activeStreams.delete(sessionId);
		return Promise.resolve();
	}
}
