/**
 * Session Writer - Utility for managing session IDs in Redis
 */

import type { Redis } from "@upstash/redis";
import { getSessionKey } from "../keys";

export class SessionWriter {
	constructor(private redis: Redis) {}

	/**
	 * Register a session ID in Redis
	 */
	async registerSession(sessionId: string): Promise<void> {
		const sessionKey = getSessionKey(sessionId);
		await this.redis.set(sessionKey, sessionId); // Just store the ID itself
	}

	/**
	 * Delete a session
	 */
	async deleteSession(sessionId: string): Promise<void> {
		const sessionKey = getSessionKey(sessionId);
		await this.redis.del(sessionKey);
	}
}
