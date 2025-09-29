/**
 * Message Reader - Utility for reading UIMessages from Redis JSON storage
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { getMessageKey } from "../keys";

interface LightfastDBMessage {
	sessionId: string;
	resourceId: string;
	messages: UIMessage[];
	createdAt: string;
	updatedAt: string;
}

export class MessageReader {
	constructor(private redis: Redis) {}

	/**
	 * Get all messages for a session
	 */
	async getMessages(sessionId: string): Promise<UIMessage[]> {
		const key = getMessageKey(sessionId);

		// Use JSON.GET to retrieve the messages
		const data = await this.redis.json.get<LightfastDBMessage[]>(key, "$");

		if (!data || data.length === 0 || !data[0]) {
			return [];
		}

		return data[0].messages || [];
	}

	/**
	 * Check if a session has messages
	 */
	async hasMessages(sessionId: string): Promise<boolean> {
		const key = getMessageKey(sessionId);
		return Boolean(await this.redis.exists(key));
	}

	/**
	 * Get the resourceId for a session
	 */
	async getResourceId(sessionId: string): Promise<string | null> {
		const key = getMessageKey(sessionId);
		const data = await this.redis.json.get<string[]>(key, "$.resourceId");
		return data?.[0] ?? null;
	}

	/**
	 * Get full session data including metadata
	 */
	async getSessionData(sessionId: string): Promise<LightfastDBMessage | null> {
		const key = getMessageKey(sessionId);
		const data = await this.redis.json.get<LightfastDBMessage[]>(key, "$");

		if (!data || data.length === 0 || !data[0]) {
			return null;
		}

		return data[0];
	}

	/**
	 * Get a specific message by ID
	 */
	async getMessage(
		sessionId: string,
		messageId: string,
	): Promise<UIMessage | null> {
		const messages = await this.getMessages(sessionId);
		return messages.find((m) => m.id === messageId) || null;
	}
}
