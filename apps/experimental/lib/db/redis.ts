import { Redis } from "@upstash/redis";
import { env } from "@/env";

// Singleton Redis client instance
let redisInstance: Redis | null = null;

/**
 * Get Redis client instance (singleton pattern)
 */
export function getRedis(): Redis {
	if (!redisInstance) {
		redisInstance = new Redis({
			url: env.KV_REST_API_URL,
			token: env.KV_REST_API_TOKEN,
		});
	}
	return redisInstance;
}

/**
 * Constants for Redis key patterns and TTLs
 */
export const REDIS_KEYS = {
	// Thread keys
	threadMetadata: (threadId: string) => `thread:${threadId}:metadata`,
	threadMessages: (threadId: string) => `thread:${threadId}:messages`,
	threadStreams: (threadId: string) => `thread:${threadId}:streams`,

	// Stream keys
	stream: (streamId: string) => `stream:${streamId}`,
} as const;

export const REDIS_TTL = {
	STREAM: 86400, // 24 hours for streams
	// Threads and messages are persisted forever - no TTL
} as const;
