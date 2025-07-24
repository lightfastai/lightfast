import { getRedis, REDIS_KEYS, REDIS_TTL } from "./redis";

interface StreamData {
	id: string;
	threadId: string;
	createdAt: string;
}

/**
 * Create a new stream and add it to the thread
 */
export async function createStream({ streamId, threadId }: { streamId: string; threadId: string }): Promise<void> {
	const redis = getRedis();

	// Store stream data
	const streamData: StreamData = {
		id: streamId,
		threadId,
		createdAt: new Date().toISOString(),
	};

	await redis.setex(REDIS_KEYS.stream(streamId), REDIS_TTL.STREAM, JSON.stringify(streamData));

	// Add to thread's stream list
	await redis.lpush(REDIS_KEYS.threadStreams(threadId), streamId);

	// Keep only the latest 100 streams per thread
	await redis.ltrim(REDIS_KEYS.threadStreams(threadId), 0, 99);
}

/**
 * Get all stream IDs for a thread
 */
export async function getThreadStreams(threadId: string): Promise<string[]> {
	const redis = getRedis();
	const streamIds = await redis.lrange(REDIS_KEYS.threadStreams(threadId), 0, -1);
	return streamIds || [];
}

/**
 * Get the most recent stream ID for a thread
 */
export async function getLatestStream(threadId: string): Promise<string | null> {
	const redis = getRedis();
	const streamIds = await redis.lrange(REDIS_KEYS.threadStreams(threadId), 0, 0);
	return streamIds && streamIds.length > 0 ? (streamIds[0] ?? null) : null;
}

/**
 * Get stream data
 */
export async function getStream(streamId: string): Promise<StreamData | null> {
	const redis = getRedis();
	const data = await redis.get(REDIS_KEYS.stream(streamId));

	if (!data) return null;

	// Handle both string and already-parsed data
	if (typeof data === "string") {
		return JSON.parse(data);
	}
	return data as StreamData;
}

/**
 * Delete a stream
 */
export async function deleteStream(streamId: string): Promise<void> {
	const redis = getRedis();
	await redis.del(REDIS_KEYS.stream(streamId));
}
