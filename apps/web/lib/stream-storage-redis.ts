import type { ExperimentalAgentId } from "@lightfast/types";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

// Initialize Redis client
const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

export interface StreamRecord {
	streamId: string;
	agentId: ExperimentalAgentId;
	threadId: string;
	userId: string;
	createdAt: Date;
}

// TTL for stream records (7 days)
const STREAM_RECORD_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Store a stream ID for a specific thread using Redis
 * Much faster than Vercel Blob storage
 */
export async function createStreamId({
	streamId,
	agentId,
	threadId,
	userId,
}: {
	streamId: string;
	agentId: ExperimentalAgentId;
	threadId: string;
	userId: string;
}) {
	const streamRecord: StreamRecord = {
		streamId,
		agentId,
		threadId,
		userId,
		createdAt: new Date(),
	};

	// Store in Redis with a specific key pattern
	const key = `stream:${userId}:${threadId}:${streamId}`;

	// Store the record with TTL
	await redis.setex(key, STREAM_RECORD_TTL, JSON.stringify(streamRecord));

	// Also maintain a sorted set for this thread to track stream order
	const threadKey = `streams:${userId}:${threadId}`;
	await redis.zadd(threadKey, {
		score: Date.now(),
		member: streamId,
	});

	// Set TTL on the sorted set
	await redis.expire(threadKey, STREAM_RECORD_TTL);

	return streamRecord;
}

/**
 * Get all stream IDs for a specific thread
 * Returns just the stream IDs, sorted by creation time
 */
export async function getStreamIdsByThreadId({
	threadId,
	userId,
}: {
	threadId: string;
	userId: string;
}): Promise<string[]> {
	try {
		const threadKey = `streams:${userId}:${threadId}`;
		// Get all stream IDs, sorted by score (timestamp) in descending order
		const streamIds = await redis.zrange(threadKey, 0, -1, { rev: true });
		return streamIds as string[];
	} catch (error) {
		console.error("Failed to get stream IDs:", error);
		return [];
	}
}

/**
 * Get stream records for a specific thread
 */
export async function getStreamRecordsByThreadId({
	threadId,
	userId,
}: {
	threadId: string;
	userId: string;
}): Promise<StreamRecord[]> {
	try {
		const streamIds = await getStreamIdsByThreadId({ threadId, userId });

		if (streamIds.length === 0) return [];

		// Build keys for all stream records
		const keys = streamIds.map((id) => `stream:${userId}:${threadId}:${id}`);

		// Fetch all records in one batch
		const records = await redis.mget(...keys);

		// Parse and filter out null values
		return records
			.filter((record): record is string => record !== null)
			.map((record) => JSON.parse(record) as StreamRecord);
	} catch (error) {
		console.error("Failed to get stream records:", error);
		return [];
	}
}

/**
 * Get the most recent stream ID for a thread
 */
export async function getMostRecentStreamId({
	threadId,
	userId,
}: {
	threadId: string;
	userId: string;
}): Promise<StreamRecord | null> {
	try {
		const threadKey = `streams:${userId}:${threadId}`;
		// Get the most recent stream ID (highest score)
		const [streamId] = await redis.zrange(threadKey, -1, -1);

		if (!streamId) return null;

		// Fetch the full record
		const key = `stream:${userId}:${threadId}:${streamId}`;
		const record = await redis.get(key);

		return record ? (JSON.parse(record as string) as StreamRecord) : null;
	} catch (error) {
		console.error("Failed to get most recent stream ID:", error);
		return null;
	}
}

/**
 * Clean up old stream IDs - much faster with Redis
 * Keeps only the most recent N stream IDs
 */
export async function cleanupOldStreamIds({
	threadId,
	userId,
	keepCount = 5,
}: {
	threadId: string;
	userId: string;
	keepCount?: number;
}): Promise<void> {
	try {
		const threadKey = `streams:${userId}:${threadId}`;

		// Get total count
		const totalCount = await redis.zcard(threadKey);

		if (totalCount <= keepCount) return;

		// Get IDs to remove (oldest ones)
		const removeCount = totalCount - keepCount;
		const idsToRemove = (await redis.zrange(threadKey, 0, removeCount - 1)) as string[];

		if (idsToRemove.length === 0) return;

		// Remove from sorted set
		await redis.zrem(threadKey, ...idsToRemove);

		// Delete the individual records
		const keysToDelete = idsToRemove.map((id) => `stream:${userId}:${threadId}:${id}`);
		if (keysToDelete.length > 0) {
			await redis.del(...keysToDelete);
		}
	} catch (error) {
		console.error("Failed to cleanup old stream IDs:", error);
	}
}

/**
 * Delete all stream IDs for a thread
 */
export async function deleteAllStreamIds({ threadId, userId }: { threadId: string; userId: string }): Promise<void> {
	try {
		const streamIds = await getStreamIdsByThreadId({ threadId, userId });

		if (streamIds.length === 0) return;

		// Delete the sorted set
		const threadKey = `streams:${userId}:${threadId}`;
		await redis.del(threadKey);

		// Delete all individual records
		const keysToDelete = streamIds.map((id) => `stream:${userId}:${threadId}:${id}`);
		await redis.del(...keysToDelete);
	} catch (error) {
		console.error("Failed to delete all stream IDs:", error);
	}
}
