/**
 * Message Reader - Utility for reading UIMessages from Redis JSON storage
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { getMessageKey } from "../keys";

interface LightfastDBMessage {
	sessionId: string;
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
		const data = (await this.redis.json.get(key, "$")) as LightfastDBMessage[] | null;

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
}
