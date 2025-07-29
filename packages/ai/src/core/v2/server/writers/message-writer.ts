/**
 * Message Writer - Utility for writing UIMessages to Redis streams
 * Used by workers to write agent responses and tool results
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { getMessageKey } from "../keys";
import type { RedisUIMessageEntry } from "../types";

export class MessageWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write a UIMessage to stream
	 */
	async writeUIMessage(sessionId: string, message: UIMessage): Promise<string> {
		const streamKey = getMessageKey(sessionId);

		const entry: RedisUIMessageEntry = {
			messageId: message.id,
			role: message.role,
			parts: JSON.stringify(message.parts),
			timestamp: new Date().toISOString(),
		};

		if (message.metadata) {
			entry.metadata = JSON.stringify(message.metadata);
		}

		// Convert to flat fields for Redis
		const fields: Record<string, string> = {};
		Object.entries(entry).forEach(([key, value]) => {
			fields[key] = typeof value === "string" ? value : String(value);
		});

		// Write to Redis stream
		const id = await this.redis.xadd(streamKey, "*", fields);
		return id as string;
	}
}
