import type { UIMessage } from "ai";
import type { LightfastUIMessage, LightfastUIMessageMetadata } from "@lightfast/types";
import { getRedis, REDIS_KEYS, REDIS_TTL } from "./redis";

interface ThreadMessagesData {
	threadId: string;
	messages: UIMessage[];
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
	messages: UIMessage[];
}): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);
	
	const data: ThreadMessagesData = {
		threadId,
		messages,
		updatedAt: new Date().toISOString(),
	};
	
	await redis.setex(key, REDIS_TTL.MESSAGES, JSON.stringify(data));
}

/**
 * Get messages from Redis
 */
export async function getMessages(threadId: string): Promise<UIMessage[]> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);
	const data = await redis.get(key);
	
	if (!data) return [];
	
	// Handle both string and already-parsed data
	if (typeof data === "object" && data !== null) {
		return (data as ThreadMessagesData).messages || [];
	}
	
	if (typeof data === "string") {
		const parsed = JSON.parse(data) as ThreadMessagesData;
		return parsed.messages || [];
	}
	
	return [];
}

/**
 * Append messages to existing thread
 */
export async function appendMessages({
	threadId,
	messages,
}: {
	threadId: string;
	messages: UIMessage[];
}): Promise<void> {
	const existingMessages = await getMessages(threadId);
	const allMessages = [...existingMessages, ...messages];
	await createMessages({ threadId, messages: allMessages });
}

/**
 * Convert UIMessage to LightfastUIMessage format
 */
export function convertToLightfastMessages(messages: UIMessage[]): LightfastUIMessage[] {
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
export async function getLastMessage(threadId: string): Promise<UIMessage | null> {
	const messages = await getMessages(threadId);
	return messages.length > 0 ? messages[messages.length - 1] ?? null : null;
}

/**
 * Clear messages for a thread
 */
export async function clearMessages(threadId: string): Promise<void> {
	const redis = getRedis();
	const key = REDIS_KEYS.threadMessages(threadId);
	await redis.del(key);
}