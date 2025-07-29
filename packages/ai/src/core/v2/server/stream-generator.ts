/**
 * Stream Generator - Generates LLM output and writes to Redis streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import { getSystemLimits } from "../env";
import {
	AIMessageType,
	EventMessageType,
	getStreamKey,
	type StreamConfig,
	type StreamMessage,
	StreamStatus,
} from "./types";

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
	 * Write a message to Redis stream and publish notification
	 */
	private async writeMessage(streamKey: string, message: StreamMessage): Promise<void> {
		// Convert message to flat fields for Redis
		const fields: Record<string, string> = {
			type: message.type,
		};

		// Add type-specific fields
		switch (message.type) {
			case AIMessageType.CHUNK:
				if ("content" in message) {
					fields.content = message.content;
				}
				break;
			case EventMessageType.METADATA:
				if ("status" in message && "sessionId" in message && "timestamp" in message) {
					fields.status = message.status;
					fields.sessionId = message.sessionId;
					fields.timestamp = message.timestamp;
				}
				break;
			case EventMessageType.EVENT:
				if ("event" in message) {
					fields.event = message.event;
					if ("data" in message && message.data) {
						fields.data = JSON.stringify(message.data);
					}
				}
				break;
			case EventMessageType.ERROR:
				if ("error" in message && message.error) {
					fields.error = message.error;
					if ("code" in message && message.code) {
						fields.code = message.code;
					}
				}
				break;
			case EventMessageType.STATUS:
			case AIMessageType.TOOL:
			case AIMessageType.THINKING:
			case AIMessageType.COMPLETE:
			case AIMessageType.COMPLETION:
				// For V2 event types, store content and metadata
				if ("content" in message) {
					fields.content = message.content;
				}
				if ("metadata" in message && message.metadata) {
					fields.metadata = JSON.stringify(message.metadata);
				}
				break;
			default: {
				// This should never happen with our strict types
				const _exhaustiveCheck: never = message;
				throw new Error(`Unknown message type: ${JSON.stringify(message)}`);
			}
		}

		// Write to stream with automatic ID (*) - Upstash format
		// Upstash expects an object, not spread field pairs
		await this.redis.xadd(streamKey, "*", fields);

		// Publish notification (as shown in blog)
		await this.redis.publish(streamKey, JSON.stringify({ type: message.type }));

		// Trim stream to max length
		// Upstash has xtrim method directly
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
