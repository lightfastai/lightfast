import { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Memory } from "../";

interface SessionMessagesData<TMessage> {
	messages: TMessage[];
}

// Type-safe wrapper for Redis JSON operations
type RedisJsonData<T> = T & Record<string, unknown>;

interface SessionData {
	resourceId: string;
}

interface StreamData {
	id: string;
	sessionId: string;
	createdAt: string;
}

/**
 * Redis-based implementation of Memory interface
 */
export class RedisMemory<TMessage extends UIMessage = UIMessage, TContext = {}> implements Memory<TMessage, TContext> {
	private redis: Redis;

	// Redis key patterns
	private readonly KEYS = {
		sessionMetadata: (sessionId: string) => `session:${sessionId}:metadata`,
		sessionMessages: (sessionId: string) => `session:${sessionId}:messages`,
		sessionStreams: (sessionId: string) => `session:${sessionId}:streams`,
		stream: (streamId: string) => `stream:${streamId}`,
	} as const;

	// TTL constants
	private readonly TTL = {
		STREAM: 86400, // 24 hours for streams
		// Sessions and messages are persisted forever - no TTL
	} as const;

	constructor(config: { url: string; token: string }) {
		this.redis = new Redis(config);
	}

	async appendMessage({ sessionId, message, context }: { sessionId: string; message: TMessage; context?: TContext }): Promise<void> {
		const key = this.KEYS.sessionMessages(sessionId);

		// Check if the key exists first
		const exists = await this.redis.exists(key);

		if (!exists) {
			// Initialize with the first message if session doesn't exist
			const data: SessionMessagesData<TMessage> = { messages: [message] };
			// Type assertion is safe here - we know the structure matches
			await this.redis.json.set(key, "$", data as RedisJsonData<SessionMessagesData<TMessage>>);
		} else {
			// Append to existing messages array
			await this.redis.json.arrappend(key, "$.messages", message);
		}
	}

	async getMessages(sessionId: string): Promise<TMessage[]> {
		const key = this.KEYS.sessionMessages(sessionId);

		// Use JSON.GET for JSON-stored data
		const jsonData = (await this.redis.json.get(key, "$")) as SessionMessagesData<TMessage>[] | null;
		if (jsonData && jsonData.length > 0 && jsonData[0]) {
			return jsonData[0].messages || [];
		}

		return [];
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
		const key = this.KEYS.sessionMetadata(sessionId);

		// Check if session already exists
		const existing = await this.redis.get(key);
		if (existing) {
			return;
		}

		const data: SessionData = {
			resourceId,
		};

		// Sessions are persisted forever - no TTL
		await this.redis.set(key, JSON.stringify(data));
	}

	async getSession(sessionId: string): Promise<{ resourceId: string } | null> {
		const key = this.KEYS.sessionMetadata(sessionId);
		const data = await this.redis.get(key);

		if (!data) return null;

		// Handle both string and already-parsed data
		let sessionData: SessionData;
		if (typeof data === "string") {
			sessionData = JSON.parse(data);
		} else {
			sessionData = data as SessionData;
		}

		return { resourceId: sessionData.resourceId };
	}

	async createStream({ sessionId, streamId, context }: { sessionId: string; streamId: string; context?: TContext }): Promise<void> {
		// Store stream data
		const streamData: StreamData = {
			id: streamId,
			sessionId,
			createdAt: new Date().toISOString(),
		};

		await this.redis.setex(this.KEYS.stream(streamId), this.TTL.STREAM, JSON.stringify(streamData));

		// Add to session's stream list
		await this.redis.lpush(this.KEYS.sessionStreams(sessionId), streamId);

		// Keep only the latest 100 streams per session
		await this.redis.ltrim(this.KEYS.sessionStreams(sessionId), 0, 99);
	}

	async getSessionStreams(sessionId: string): Promise<string[]> {
		const streamIds = await this.redis.lrange(this.KEYS.sessionStreams(sessionId), 0, -1);
		return streamIds || [];
	}

}
