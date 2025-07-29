/**
 * Stream Reader - Utility for reading stream metadata from Redis
 */

import type { Redis } from "@upstash/redis";
import { getStreamKey } from "../types";

export class StreamReader {
	constructor(private redis: Redis) {}

	/**
	 * Get stream info
	 */
	async getStreamInfo(
		sessionId: string,
		streamPrefix = "stream",
	): Promise<{
		exists: boolean;
		length: number;
		firstId?: string;
		lastId?: string;
	}> {
		const streamKey = getStreamKey(sessionId, streamPrefix);
		const length = await this.redis.xlen(streamKey);

		if (length === 0) {
			return { exists: false, length: 0 };
		}

		// Get first and last entry IDs
		const [first, last] = await Promise.all([
			this.redis.xrange(streamKey, "-", "+", 1) as unknown as Promise<any>,
			this.redis.xrevrange(streamKey, "+", "-", 1) as unknown as Promise<any>,
		]);

		// Extract entry IDs from Upstash response format
		const firstId = first && typeof first === "object" ? Object.keys(first)[0] : undefined;
		const lastId = last && typeof last === "object" ? Object.keys(last)[0] : undefined;

		return {
			exists: true,
			length,
			firstId,
			lastId,
		};
	}

	/**
	 * Check if a stream exists
	 */
	async streamExists(sessionId: string, streamPrefix = "stream"): Promise<boolean> {
		const streamKey = getStreamKey(sessionId, streamPrefix);
		const length = await this.redis.xlen(streamKey);
		return length > 0;
	}
}
