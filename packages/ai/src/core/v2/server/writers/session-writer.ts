/**
 * Session Writer - Utility for writing session state to Redis
 */

import type { Redis } from "@upstash/redis";
import type { AgentSessionState } from "../../workers/schemas";
import { getSessionKey } from "../keys";

export class SessionWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write session state to Redis
	 */
	async writeSession(sessionId: string, session: AgentSessionState): Promise<void> {
		const sessionKey = getSessionKey(sessionId);
		await this.redis.set(sessionKey, JSON.stringify(session)); // No expiration
	}
}
