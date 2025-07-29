/**
 * Session Reader - Handles reading session data from Redis
 */

import type { Redis } from "@upstash/redis";
import { getSessionKey } from "../keys";

export class SessionReader {
	constructor(private redis: Redis) {}

	/**
	 * Check if a session exists
	 */
	async sessionExists(sessionId: string): Promise<boolean> {
		const sessionKey = getSessionKey(sessionId);
		const exists = await this.redis.exists(sessionKey);
		return exists === 1;
	}

	/**
	 * Get session data
	 */
	async getSession(sessionId: string): Promise<any | null> {
		const sessionKey = getSessionKey(sessionId);
		return await this.redis.get(sessionKey);
	}
}
