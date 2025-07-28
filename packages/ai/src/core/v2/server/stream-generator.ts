/**
 * Stream Generator - Generates LLM output and writes to Redis streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { Redis } from "@upstash/redis";
import { streamText } from "ai";
import { customAlphabet } from "nanoid";
import { getSystemLimits } from "../env";
import { getGroupName, getStreamKey, MessageType, type StreamConfig, type StreamMessage, StreamStatus } from "./types";

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
	 * Generate LLM stream and write to Redis
	 * This follows the exact pattern from the Upstash blog
	 */
	async generate(sessionId: string, prompt: string, model: any): Promise<void> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const groupName = getGroupName(sessionId, this.config.groupPrefix);

		try {
			// Skip consumer group creation for now - Upstash doesn't support MKSTREAM option
			// Consumer groups can be added later if needed

			// Send initial metadata
			await this.writeMessage(streamKey, {
				type: MessageType.METADATA,
				status: StreamStatus.STARTED,
				sessionId,
				timestamp: new Date().toISOString(),
			});

			// Stream from LLM
			const { textStream } = await streamText({
				model,
				prompt,
				onError: (error) => {
					// Write error to stream
					this.writeMessage(streamKey, {
						type: MessageType.ERROR,
						error: error instanceof Error ? error.message : String(error),
						code: error instanceof Error ? error.name : undefined,
					}).catch(console.error);
					throw error;
				},
			});

			// Update status to streaming
			await this.writeMessage(streamKey, {
				type: MessageType.METADATA,
				status: StreamStatus.STREAMING,
				sessionId,
				timestamp: new Date().toISOString(),
			});

			// Process LLM stream chunks
			for await (const chunk of textStream) {
				if (chunk) {
					// Write chunk to Redis stream (exactly as shown in blog)
					await this.writeMessage(streamKey, {
						type: MessageType.CHUNK,
						content: chunk,
					});
				}
			}

			// Mark as completed
			await this.writeMessage(streamKey, {
				type: MessageType.METADATA,
				status: StreamStatus.COMPLETED,
				sessionId,
				timestamp: new Date().toISOString(),
			});

			// Set TTL on the stream
			await this.redis.expire(streamKey, this.config.ttl);
		} catch (error) {
			console.error(`Stream generation error for ${sessionId}:`, error);

			// Try to write error to stream if possible
			try {
				await this.writeMessage(streamKey, {
					type: MessageType.ERROR,
					error: error instanceof Error ? error.message : "Unknown error",
				});

				// Update status
				await this.writeMessage(streamKey, {
					type: MessageType.METADATA,
					status: StreamStatus.ERROR,
					sessionId,
					timestamp: new Date().toISOString(),
				});
			} catch (writeError) {
				console.error("Failed to write error to stream:", writeError);
			}

			throw error;
		}
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
			case MessageType.CHUNK:
				if ('content' in message) {
					fields.content = message.content;
				}
				break;
			case MessageType.METADATA:
				if ('status' in message && 'sessionId' in message && 'timestamp' in message) {
					fields.status = message.status;
					fields.sessionId = message.sessionId;
					fields.timestamp = message.timestamp;
				}
				break;
			case MessageType.EVENT:
				if ('event' in message) {
					fields.event = message.event;
					if ('data' in message && message.data) {
						fields.data = JSON.stringify(message.data);
					}
				}
				break;
			case MessageType.ERROR:
				if ('error' in message && message.error) {
					fields.error = message.error;
					if ('code' in message && message.code) {
						fields.code = message.code;
					}
				}
				break;
			case MessageType.STATUS:
			case MessageType.TOOL:
			case MessageType.THINKING:
			case MessageType.COMPLETE:
			case MessageType.COMPLETION:
				// For V2 event types, store content and metadata
				if ('content' in message) {
					fields.content = message.content;
				}
				if ('metadata' in message && message.metadata) {
					fields.metadata = JSON.stringify(message.metadata);
				}
				break;
			default:
				// For unknown types, store all available fields
				if ('content' in message) {
					fields.content = message.content;
				}
				if ('metadata' in message && message.metadata) {
					fields.metadata = JSON.stringify(message.metadata);
				}
				if ('status' in message && message.status) {
					fields.status = message.status;
				}
				if ('error' in message && message.error) {
					fields.error = message.error;
				}
				break;
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
