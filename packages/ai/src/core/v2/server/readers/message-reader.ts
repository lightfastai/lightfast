/**
 * Message Reader - Utility for reading UIMessages from Redis streams
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { getMessageKey } from "../keys";

export class MessageReader {
	constructor(private redis: Redis) {}

	/**
	 * Get all messages from stream
	 */
	async getMessages(sessionId: string): Promise<UIMessage[]> {
		const streamKey = getMessageKey(sessionId);
		const entries = await this.redis.xrange(streamKey, "-", "+");

		if (!entries || (entries as any).length === 0) {
			return [];
		}

		const messages: UIMessage[] = [];
		const streamEntries = entries as any;
		for (const entry of Object.values(streamEntries)) {
			const fields = entry as Record<string, string>;
			if (fields.messageId && fields.role && fields.parts) {
				messages.push({
					id: fields.messageId,
					role: fields.role as UIMessage["role"],
					parts: JSON.parse(fields.parts),
					...(fields.metadata && { metadata: JSON.parse(fields.metadata) }),
				});
			}
		}

		return messages;
	}
}
