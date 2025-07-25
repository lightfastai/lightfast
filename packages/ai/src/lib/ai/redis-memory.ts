import { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Memory } from "./memory";

interface ThreadMessagesData<TMessage> {
	threadId: string;
	messages: TMessage[];
	createdAt: string;
	updatedAt: string;
}

interface ThreadMetadata {
	threadId: string;
	resourceId: string;
	agentId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

interface StreamData {
	id: string;
	threadId: string;
	createdAt: string;
}

/**
 * Redis-based implementation of Memory interface
 */
export class RedisMemory<TMessage extends UIMessage = UIMessage> implements Memory<TMessage> {
	private redis: Redis;

	// Redis key patterns
	private readonly KEYS = {
		threadMetadata: (threadId: string) => `thread:${threadId}:metadata`,
		threadMessages: (threadId: string) => `thread:${threadId}:messages`,
		threadStreams: (threadId: string) => `thread:${threadId}:streams`,
		stream: (streamId: string) => `stream:${streamId}`,
	} as const;

	// TTL constants
	private readonly TTL = {
		STREAM: 86400, // 24 hours for streams
		// Threads and messages are persisted forever - no TTL
	} as const;

	constructor(config: { url: string; token: string }) {
		this.redis = new Redis(config);
	}

	async appendMessages({ threadId, messages }: { threadId: string; messages: TMessage[] }): Promise<void> {
		const key = this.KEYS.threadMessages(threadId);

		// Check if the key exists first
		const exists = await this.redis.exists(key);

		if (!exists) {
			throw new Error(`Cannot append messages to non-existent thread ${threadId}. Use createMessages for new threads.`);
		}

		// Use JSON.ARRAPPEND to append each message to the messages array
		for (const message of messages) {
			await this.redis.json.arrappend(key, "$.messages", message);
		}

		// Update the timestamp
		await this.redis.json.set(key, "$.updatedAt", new Date().toISOString());
	}

	async createMessages({ threadId, messages }: { threadId: string; messages: TMessage[] }): Promise<void> {
		const key = this.KEYS.threadMessages(threadId);

		const now = new Date().toISOString();
		const data: ThreadMessagesData<TMessage> = {
			threadId,
			messages,
			createdAt: now,
			updatedAt: now,
		};

		// Use JSON.SET to store as a JSON document
		await this.redis.json.set(key, "$", data as unknown as Record<string, unknown>);
		// Messages are persisted forever - no TTL
	}

	async getMessages(threadId: string): Promise<TMessage[]> {
		const key = this.KEYS.threadMessages(threadId);

		// Use JSON.GET for JSON-stored data
		const jsonData = (await this.redis.json.get(key, "$")) as ThreadMessagesData<TMessage>[] | null;
		if (jsonData && jsonData.length > 0 && jsonData[0]) {
			return jsonData[0].messages || [];
		}

		return [];
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
		const key = this.KEYS.threadMetadata(threadId);

		// Check if thread already exists
		const existing = await this.redis.get(key);
		if (existing) {
			// Update only the updatedAt timestamp
			await this.updateThreadTimestamp(threadId);
			return;
		}

		const metadata: ThreadMetadata = {
			threadId,
			resourceId,
			agentId,
			title: `Chat with ${agentId}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		// Threads are persisted forever - no TTL
		await this.redis.set(key, JSON.stringify(metadata));
	}

	async getThread(threadId: string): Promise<{ resourceId: string } | null> {
		const key = this.KEYS.threadMetadata(threadId);
		const data = await this.redis.get(key);

		if (!data) return null;

		// Handle both string and already-parsed data
		let metadata: ThreadMetadata;
		if (typeof data === "string") {
			metadata = JSON.parse(data);
		} else {
			metadata = data as ThreadMetadata;
		}

		return { resourceId: metadata.resourceId };
	}

	async createStream({ threadId, streamId }: { threadId: string; streamId: string }): Promise<void> {
		// Store stream data
		const streamData: StreamData = {
			id: streamId,
			threadId,
			createdAt: new Date().toISOString(),
		};

		await this.redis.setex(this.KEYS.stream(streamId), this.TTL.STREAM, JSON.stringify(streamData));

		// Add to thread's stream list
		await this.redis.lpush(this.KEYS.threadStreams(threadId), streamId);

		// Keep only the latest 100 streams per thread
		await this.redis.ltrim(this.KEYS.threadStreams(threadId), 0, 99);
	}

	async getThreadStreams(threadId: string): Promise<string[]> {
		const streamIds = await this.redis.lrange(this.KEYS.threadStreams(threadId), 0, -1);
		return streamIds || [];
	}

	private async updateThreadTimestamp(threadId: string): Promise<void> {
		const key = this.KEYS.threadMetadata(threadId);
		const data = await this.redis.get(key);

		if (data) {
			let metadata: ThreadMetadata;
			if (typeof data === "string") {
				metadata = JSON.parse(data);
			} else {
				metadata = data as ThreadMetadata;
			}

			metadata.updatedAt = new Date().toISOString();
			await this.redis.set(key, JSON.stringify(metadata));
		}
	}
}
