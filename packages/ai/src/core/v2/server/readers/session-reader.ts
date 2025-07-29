/**
 * Session Reader - Utility for reading session state from Redis
 */

import type { Redis } from "@upstash/redis";
import type { AgentSessionState } from "../../workers/schemas";
import { getSessionKey } from "../keys";

export class SessionReader {
	constructor(private redis: Redis) {}

	/**
	 * Get session from Redis
	 */
	async getSession(sessionId: string): Promise<AgentSessionState | null> {
		const sessionKey = getSessionKey(sessionId);
		const data = await this.redis.get(sessionKey);

		if (!data) return null;

		return typeof data === "string" ? JSON.parse(data) : (data as AgentSessionState);
	}
}
