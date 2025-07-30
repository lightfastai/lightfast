/**
 * Stream Writer - Handles writing error and complete events to delta streams
 */

import type { Redis } from "@upstash/redis";
import { getDeltaStreamKey } from "../keys";
import { DeltaStreamType } from "./types";

export class StreamWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write an initialization event to the delta stream
	 */
	async writeInit(sessionId: string): Promise<void> {
		const streamKey = getDeltaStreamKey(sessionId);

		const message: Record<string, string> = {
			type: DeltaStreamType.INIT,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.INIT });
	}

	/**
	 * Write an error event to the delta stream
	 */
	async writeError(sessionId: string, error: string): Promise<void> {
		const streamKey = getDeltaStreamKey(sessionId);

		const message: Record<string, string> = {
			type: DeltaStreamType.ERROR,
			error,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.ERROR });
	}

	/**
	 * Write a chunk event to the delta stream
	 */
	async writeChunk(sessionId: string, content: string): Promise<void> {
		const streamKey = getDeltaStreamKey(sessionId);

		const message: Record<string, string> = {
			type: DeltaStreamType.CHUNK,
			content,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.CHUNK });
	}

	/**
	 * Write a completion event to the delta stream
	 */
	async writeComplete(sessionId: string): Promise<void> {
		const streamKey = getDeltaStreamKey(sessionId);

		const message: Record<string, string> = {
			type: DeltaStreamType.COMPLETE,
			timestamp: new Date().toISOString(),
		};

		// Write to Redis stream
		await this.redis.xadd(streamKey, "*", message);

		// Publish for real-time notifications
		await this.redis.publish(streamKey, { type: DeltaStreamType.COMPLETE });
	}
}
