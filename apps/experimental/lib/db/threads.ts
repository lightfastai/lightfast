import { getRedis, REDIS_KEYS, REDIS_TTL } from "./redis";

export interface ThreadMetadata {
	threadId: string;
	userId: string;
	agentId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Create a new thread with metadata
 */
export async function createThread({
	threadId,
	userId,
	agentId,
	title,
}: {
	threadId: string;
	userId: string;
	agentId: string;
	title?: string;
}): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMetadata(threadId);

	// Check if thread already exists
	const existing = await redis.get(key);
	if (existing) {
		// Update only the updatedAt timestamp
		await updateThreadTimestamp(threadId);
		return;
	}

	const metadata: ThreadMetadata = {
		threadId,
		userId,
		agentId,
		title: title || `Chat with ${agentId}`,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	await redis.setex(key, REDIS_TTL.THREAD, JSON.stringify(metadata));
}

/**
 * Get thread metadata
 */
export async function getThread(threadId: string): Promise<ThreadMetadata | null> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMetadata(threadId);
	const data = await redis.get(key);

	if (!data) return null;

	// Handle both string and already-parsed data
	if (typeof data === "string") {
		return JSON.parse(data);
	}
	return data as ThreadMetadata;
}

/**
 * Update thread timestamp
 */
export async function updateThreadTimestamp(threadId: string): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMetadata(threadId);
	const existing = await getThread(threadId);

	if (existing) {
		existing.updatedAt = new Date().toISOString();
		await redis.setex(key, REDIS_TTL.THREAD, JSON.stringify(existing));
	}
}
