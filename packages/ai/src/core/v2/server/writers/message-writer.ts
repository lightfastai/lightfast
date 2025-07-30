/**
 * Message Writer - Utility for writing UIMessages to Redis JSON storage
 * Used by workers to write agent responses and tool results
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

export class MessageWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write multiple UIMessages at once
	 */
	async writeUIMessages(sessionId: string, resourceId: string, messages: UIMessage[]): Promise<void> {
		if (messages.length === 0) return;

		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();

		// Get existing data or create new
		const existing = (await this.redis.json.get(key, "$")) as LightfastDBMessage[] | null;

		if (!existing || existing.length === 0) {
			// Create new storage
			const storage: LightfastDBMessage = {
				sessionId,
				resourceId,
				messages,
				createdAt: now,
				updatedAt: now,
			};
			await this.redis.json.set(key, "$", storage as unknown as Record<string, unknown>);
		} else {
			// Use pipeline for atomic operation
			const pipeline = this.redis.pipeline();
			pipeline.json.arrappend(key, "$.messages", ...(messages as unknown as Record<string, unknown>[]));
			pipeline.json.set(key, "$.updatedAt", now);
			await pipeline.exec();
		}
	}

	/**
	 * Write a single UIMessage (convenience method)
	 */
	async writeUIMessage(sessionId: string, resourceId: string, message: UIMessage): Promise<void> {
		await this.writeUIMessages(sessionId, resourceId, [message]);
	}
}
