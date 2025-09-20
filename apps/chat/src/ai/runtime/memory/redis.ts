import { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Memory } from "lightfast/memory";
import type { ChatFetchContext } from "~/ai/lightfast-app-chat-ui-messages";

interface SessionMessagesData<TMessage> {
	messages: TMessage[];
}

// Type-safe wrapper for Redis JSON operations
type RedisJsonData<T> = T & Record<string, unknown>;

interface SessionData {
	resourceId: string;
	createdAt: string;
	isAnonymous: boolean;
	lastAccessedAt: string;
}

interface StreamData {
	id: string;
	sessionId: string;
	createdAt: string;
}

/**
 * Redis-based implementation of Memory interface for anonymous chat sessions
 * with automatic expiration and session management
 */
export class AnonymousRedisMemory<TMessage extends UIMessage = UIMessage>
	implements Memory<TMessage, ChatFetchContext>
{
	private redis: Redis;

	// Redis key patterns
	private readonly KEYS = {
		sessionMetadata: (sessionId: string) =>
			`anon:session:${sessionId}:metadata`,
		sessionMessages: (sessionId: string) =>
			`anon:session:${sessionId}:messages`,
		sessionStreams: (sessionId: string) => `anon:session:${sessionId}:streams`,
		stream: (streamId: string) => `anon:stream:${streamId}`,
	} as const;

	// TTL constants (in seconds)
	private readonly TTL = {
		ANONYMOUS_SESSION: 86400, // 24 hours for anonymous sessions
		ANONYMOUS_MESSAGES: 86400, // 24 hours for anonymous messages
		STREAM: 3600, // 1 hour for streams (they're temporary)
	} as const;

	constructor(config: { url: string; token: string }) {
		this.redis = new Redis(config);
	}

	async appendMessage({
		sessionId,
		message,
		context: _context,
	}: {
		sessionId: string;
		message: TMessage;
		context: ChatFetchContext;
	}): Promise<void> {
		const key = this.KEYS.sessionMessages(sessionId);

		// Check if the key exists first
		const exists = await this.redis.exists(key);

		if (!exists) {
			// Initialize with the first message if session doesn't exist
			const data: SessionMessagesData<TMessage> = { messages: [message] };
			// Type assertion is safe here - we know the structure matches
			await this.redis.json.set(
				key,
				"$",
				data as RedisJsonData<SessionMessagesData<TMessage>>,
			);
			// Set TTL for anonymous messages
			await this.redis.expire(key, this.TTL.ANONYMOUS_MESSAGES);
		} else {
			// Append to existing messages array
			await this.redis.json.arrappend(key, "$.messages", message);
			// Refresh TTL on activity
			await this.redis.expire(key, this.TTL.ANONYMOUS_MESSAGES);
		}

		// Update last accessed time
		await this.updateLastAccessed(sessionId);
	}

	async getMessages(sessionId: string): Promise<TMessage[]> {
		const key = this.KEYS.sessionMessages(sessionId);

		// Use JSON.GET for JSON-stored data
		const jsonData = await this.redis.json.get(key, "$");
		
		// Update last accessed time if session exists
		if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
			await this.updateLastAccessed(sessionId);
			const firstItem = jsonData[0] as SessionMessagesData<TMessage> | undefined;
			if (firstItem?.messages) {
				return firstItem.messages;
			}
		}

		return [];
	}

	async createSession({
		sessionId,
		resourceId,
		context: _context,
	}: {
		sessionId: string;
		resourceId: string;
		context: ChatFetchContext;
	}): Promise<void> {
		const key = this.KEYS.sessionMetadata(sessionId);

		// Check if session already exists
		const existing = await this.redis.get(key);
		if (existing) {
			return;
		}

		const now = new Date().toISOString();
		const data: SessionData = {
			resourceId,
			createdAt: now,
			isAnonymous: true,
			lastAccessedAt: now,
		};

		// Set session with TTL for anonymous users
		await this.redis.setex(
			key,
			this.TTL.ANONYMOUS_SESSION,
			JSON.stringify(data),
		);
	}

	async getSession(sessionId: string): Promise<{ resourceId: string } | null> {
		const key = this.KEYS.sessionMetadata(sessionId);
		const data = await this.redis.get(key);

		if (!data) return null;

		// Data from Redis can be string or already parsed
		const sessionData = typeof data === "string"
			? JSON.parse(data) as SessionData
			: data as SessionData;

		// Update last accessed time
		await this.updateLastAccessed(sessionId);

		return { resourceId: sessionData.resourceId };
	}

	async createStream({
		sessionId,
		streamId,
		context: _context,
	}: {
		sessionId: string;
		streamId: string;
		context: ChatFetchContext;
	}): Promise<void> {
		// Store stream data with short TTL
		const streamData: StreamData = {
			id: streamId,
			sessionId,
			createdAt: new Date().toISOString(),
		};

		await this.redis.setex(
			this.KEYS.stream(streamId),
			this.TTL.STREAM,
			JSON.stringify(streamData),
		);

		// Add to session's stream list
		await this.redis.lpush(this.KEYS.sessionStreams(sessionId), streamId);

		// Keep only the latest 10 streams per anonymous session (less than authenticated)
		await this.redis.ltrim(this.KEYS.sessionStreams(sessionId), 0, 9);

		// Set TTL on streams list
		await this.redis.expire(
			this.KEYS.sessionStreams(sessionId),
			this.TTL.ANONYMOUS_SESSION,
		);
	}

	async getSessionStreams(sessionId: string): Promise<string[]> {
		const streamIds = await this.redis.lrange(
			this.KEYS.sessionStreams(sessionId),
			0,
			-1,
		);
		return streamIds;
	}

	/**
	 * Update the last accessed timestamp for a session
	 */
	private async updateLastAccessed(sessionId: string): Promise<void> {
		const key = this.KEYS.sessionMetadata(sessionId);
		const data = await this.redis.get(key);

		if (!data) return;

		// Data from Redis can be string or already parsed
		const sessionData = typeof data === "string"
			? JSON.parse(data) as SessionData  
			: data as SessionData;

		sessionData.lastAccessedAt = new Date().toISOString();

		// Refresh TTL and update data
		await this.redis.setex(
			key,
			this.TTL.ANONYMOUS_SESSION,
			JSON.stringify(sessionData),
		);
	}
}

