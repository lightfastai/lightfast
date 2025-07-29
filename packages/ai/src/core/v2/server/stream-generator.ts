/**
 * Stream Generator - Manages stream sessions and metadata
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import { getSystemLimits } from "../env";
import { getEventStreamKey, getStreamKey, type StreamConfig } from "./types";

// Generate 6-digit numeric session IDs (as shown in blog)
const generateSessionId = customAlphabet("0123456789", 6);

export class StreamGenerator {
	private redis: Redis;
	private config: Required<StreamConfig>;

	constructor(redis: Redis, config: StreamConfig = {}) {
		this.redis = redis;
		const limits = getSystemLimits();
		this.config = {
			streamPrefix: config.streamPrefix || "stream",
			groupPrefix: config.groupPrefix || "stream",
			ttl: config.ttl || limits.streamTTLSeconds,
			maxLength: config.maxLength || 1000,
		};
	}

	/**
	 * Generate a new session ID
	 */
	createSessionId(): string {
		return generateSessionId();
	}

	/**
	 * Initialize a stream with TTL
	 */
	async initializeStream(sessionId: string): Promise<void> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const eventKey = getEventStreamKey(sessionId);

		// Set TTL on both streams
		if (this.config.ttl > 0) {
			await Promise.all([this.redis.expire(streamKey, this.config.ttl), this.redis.expire(eventKey, this.config.ttl)]);
		}
	}

	/**
	 * Trim stream to max length
	 */
	async trimStream(sessionId: string): Promise<void> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);

		try {
			await this.redis.xtrim(streamKey, {
				strategy: "MAXLEN",
				threshold: this.config.maxLength,
				exactness: "~",
			});
		} catch (trimError) {
			// Ignore trim errors as they're not critical
			console.error("Stream trim error:", trimError);
		}
	}

	/**
	 * Publish notification for stream update
	 */
	async publishNotification(sessionId: string, type: string): Promise<void> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		await this.redis.publish(streamKey, JSON.stringify({ type, sessionId }));
	}

	/**
	 * Check if a stream exists
	 */
	async streamExists(sessionId: string): Promise<boolean> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const length = await this.redis.xlen(streamKey);
		return length > 0;
	}

	/**
	 * Get stream info
	 */
	async getStreamInfo(sessionId: string): Promise<{
		exists: boolean;
		length: number;
		firstId?: string;
		lastId?: string;
	}> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
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
}
