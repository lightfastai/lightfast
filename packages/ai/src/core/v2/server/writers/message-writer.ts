/**
 * Message Writer - Utility for writing UIMessages to Redis JSON storage
 * Used by workers to write agent responses and tool results
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

export class MessageWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write multiple UIMessages at once
	 */
	async writeUIMessages(sessionId: string, messages: UIMessage[]): Promise<void> {
		if (messages.length === 0) return;
		
		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();

		// Get existing data or create new
		const existing = await this.redis.json.get(key, "$") as LightfastDBMessage[] | null;
		
		if (!existing || existing.length === 0) {
			// Create new storage
			const storage: LightfastDBMessage = {
				sessionId,
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
	async writeUIMessage(sessionId: string, message: UIMessage): Promise<void> {
		await this.writeUIMessages(sessionId, [message]);
	}

	/**
	 * Delete a specific message by ID
	 */
	async deleteMessage(sessionId: string, messageId: string): Promise<boolean> {
		const key = getMessageKey(sessionId);
		
		// Get current messages
		const data = await this.redis.json.get(key, "$.messages") as UIMessage[][] | null;
		if (!data || data.length === 0) return false;
		
		const messages = data[0];
		if (!messages) return false;
		
		const filteredMessages = messages.filter(m => m.id !== messageId);
		
		if (filteredMessages.length === messages.length) {
			return false; // Message not found
		}
		
		// Update messages array and timestamp atomically
		const pipeline = this.redis.pipeline();
		pipeline.json.set(key, "$.messages", filteredMessages as unknown as Record<string, unknown>[]);
		pipeline.json.set(key, "$.updatedAt", new Date().toISOString());
		await pipeline.exec();
		return true;
	}

	/**
	 * Delete messages from index i to n-1 (keeping messages 0 to i-1)
	 */
	async deleteMessagesFromIndex(sessionId: string, fromIndex: number): Promise<number> {
		const key = getMessageKey(sessionId);
		
		// Get current messages
		const data = await this.redis.json.get(key, "$.messages") as UIMessage[][] | null;
		if (!data || data.length === 0) return 0;
		
		const messages = data[0];
		if (!messages) return 0;
		
		const originalLength = messages.length;
		
		if (fromIndex >= originalLength) return 0;
		
		// Keep only messages before fromIndex
		const keptMessages = messages.slice(0, fromIndex);
		
		// Update messages array and timestamp atomically
		const pipeline = this.redis.pipeline();
		pipeline.json.set(key, "$.messages", keptMessages as unknown as Record<string, unknown>[]);
		pipeline.json.set(key, "$.updatedAt", new Date().toISOString());
		await pipeline.exec();
		
		return originalLength - keptMessages.length;
	}

	/**
	 * Replace all messages (useful for re-runs)
	 */
	async replaceMessages(sessionId: string, messages: UIMessage[]): Promise<void> {
		const key = getMessageKey(sessionId);
		const now = new Date().toISOString();
		
		// Get existing createdAt or use now
		const existing = await this.redis.json.get(key, "$.createdAt") as string[] | null;
		const createdAt = existing?.[0] || now;
		
		const storage: LightfastDBMessage = {
			sessionId,
			messages,
			createdAt,
			updatedAt: now,
		};
		
		await this.redis.json.set(key, "$", storage as unknown as Record<string, unknown>);
	}
}
