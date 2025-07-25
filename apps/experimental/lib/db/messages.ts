/**
 * IMPORTANT: In AI SDK v5:
 * - CoreMessage is renamed to ModelMessage
 * - ModelMessage only has 'role' and 'content' (no ID)
 * - UIMessage has 'id', 'role', and 'parts' (no content)
 * - We store LightfastUIMessage[] which extends UIMessage with our custom types
 */

import type { LightfastUIMessage, LightfastUIMessageMetadata } from "@lightfast/types";
import { getRedis, REDIS_KEYS } from "./redis";

interface ThreadMessagesData {
	threadId: string;
	messages: LightfastUIMessage[]; // Store LightfastUIMessage directly
	createdAt: string;
	updatedAt: string;
}

/**
 * Create/replace all messages for a thread
 */
export async function createMessages({
	threadId,
	messages,
}: {
	threadId: string;
	messages: LightfastUIMessage[];
}): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);

	const now = new Date().toISOString();
	const data: ThreadMessagesData = {
		threadId,
		messages,
		createdAt: now,
		updatedAt: now,
	};

	// Use JSON.SET to store as a JSON document
	// This enables JSON operations like JSON.ARRAPPEND
	await redis.json.set(key, "$", data as unknown as Record<string, unknown>);
	// Messages are persisted forever - no TTL
}

/**
 * Get messages from Redis
 */
export async function getMessages(threadId: string): Promise<LightfastUIMessage[]> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);

	// Use JSON.GET for JSON-stored data
	const jsonData = (await redis.json.get(key, "$")) as ThreadMessagesData[] | null;
	if (jsonData && jsonData.length > 0 && jsonData[0]) {
		return jsonData[0].messages || [];
	}

	return [];
}

/**
 * Append messages to existing thread using Redis JSON.ARRAPPEND
 * Much more efficient than fetching all messages when we only need to append
 */
export async function appendMessages({
	threadId,
	messages,
}: {
	threadId: string;
	messages: LightfastUIMessage[];
}): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);

	// Check if the key exists first
	const exists = await redis.exists(key);

	if (!exists) {
		// This should never happen in our flow - appendMessages should only be called
		// for existing threads. If this happens, it indicates a bug in the calling code.
		throw new Error(`Cannot append messages to non-existent thread ${threadId}. Use createMessages for new threads.`);
	}

	// Use JSON.ARRAPPEND to append each message to the messages array
	for (const message of messages) {
		await redis.json.arrappend(key, "$.messages", message);
	}

	// Update the timestamp
	await redis.json.set(key, "$.updatedAt", new Date().toISOString());
}

/**
 * Convert UIMessage to LightfastUIMessage format
 * Note: This is now mostly a pass-through since we store LightfastUIMessage directly
 */
export function convertToLightfastMessages(messages: LightfastUIMessage[]): LightfastUIMessage[] {
	return messages.map((msg) => {
		// Handle the parts conversion - UIMessage has parts, not content
		let parts: LightfastUIMessage["parts"] = [];

		if ("parts" in msg && msg.parts) {
			parts = msg.parts;
		}

		return {
			id: msg.id,
			role: msg.role as "user" | "assistant",
			parts,
			metadata: msg.metadata as LightfastUIMessageMetadata | undefined,
		};
	});
}

/**
 * Get the last message from a thread
 */
export async function getLastMessage(threadId: string): Promise<LightfastUIMessage | null> {
	const messages = await getMessages(threadId);
	return messages.length > 0 ? (messages[messages.length - 1] ?? null) : null;
}

/**
 * Clear messages for a thread
 */
export async function clearMessages(threadId: string): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);
	await redis.del(key);
}
