/**
 * Stream Status Handler - Handles stream status check requests
 */

import type { Redis } from "@upstash/redis";
import { getSessionKey } from "../keys";
import { StreamReader } from "../readers/stream-reader";

export class StreamStatusHandler {
	private streamReader: StreamReader;

	constructor(private redis: Redis) {
		this.streamReader = new StreamReader(redis);
	}

	/**
	 * Handle stream status check request
	 */
	async handleStreamStatus(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const sessionId = url.searchParams.get("sessionId");

		if (!sessionId) {
			return Response.json({ error: "Session ID is required" }, { status: 400 });
		}

		// Get session data
		const sessionKey = getSessionKey(sessionId);
		const sessionData = await this.redis.get(sessionKey);

		if (!sessionData) {
			return Response.json({ error: "Session not found" }, { status: 404 });
		}

		// Get stream info
		const streamInfo = await this.streamReader.getStreamInfo(sessionId);

		return Response.json({
			sessionId,
			session: typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData,
			stream: streamInfo,
		});
	}
}
