/**
 * Stream Consumer - Reads from Redis and delivers to clients via SSE
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { Redis } from "@upstash/redis";
import { getGroupName, getStreamKey, type StreamConfig, type StreamMessage, validateMessage } from "./types";

export class StreamConsumer {
	private redis: Redis;
	private config: Required<StreamConfig>;

	constructor(redis: Redis, config: StreamConfig = {}) {
		this.redis = redis;
		this.config = {
			streamPrefix: config.streamPrefix || "stream",
			groupPrefix: config.groupPrefix || "stream",
			ttl: config.ttl || 3600,
			maxLength: config.maxLength || 1000,
		};
	}

	/**
	 * Create an SSE stream for a client
	 * Simplified version that uses polling instead of XREADGROUP for compatibility
	 */
	createSSEStream(sessionId: string, consumerId = "consumer-1"): ReadableStream<Uint8Array> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const encoder = new TextEncoder();
		const redis = this.redis; // Capture redis reference for closure

		// Helper to format SSE messages
		const formatSSE = (data: unknown): Uint8Array => {
			return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
		};

		return new ReadableStream({
			async start(controller) {
				let lastSeenId = "0";
				let isActive = true;
				let consecutiveEmptyReads = 0;
				const maxEmptyReads = 10; // Stop after 10 empty reads

				// Poll for messages
				const pollMessages = async () => {
					while (isActive) {
						try {
							// Read messages after lastSeenId
							const response = (await redis.xrange(
								streamKey,
								`(${lastSeenId}`, // Exclusive start
								"+",
								10,
							)) as unknown as any;

							// Upstash returns an object with entry IDs as keys
							const entries = response && typeof response === "object" ? Object.entries(response) : [];

							if (entries.length > 0) {
								consecutiveEmptyReads = 0;

								for (const [entryId, fields] of entries) {
									// Pass the fields directly to validateMessage
									const message = validateMessage(fields);
									if (message && isActive) {
										try {
											controller.enqueue(formatSSE(message));
										} catch (e) {
											// Controller might be closed already
											console.error("Failed to enqueue message:", e);
											isActive = false;
											return;
										}

										// Check if stream is completed
										if (message.type === "metadata" && message.status === "completed") {
											isActive = false;
											controller.close();
											return;
										}
									}
									lastSeenId = entryId;
								}
							} else {
								consecutiveEmptyReads++;

								// Stop if we've had too many empty reads (stream might be done)
								if (consecutiveEmptyReads >= maxEmptyReads) {
									// Check if stream has completed status
									const lastResponse = (await redis.xrevrange(streamKey, "+", "-", 5)) as unknown as any;

									const lastEntries =
										lastResponse && typeof lastResponse === "object" ? Object.entries(lastResponse) : [];
									const hasCompleted = lastEntries.some(([_, fields]: [string, any]) => {
										const msg = validateMessage(fields);
										return msg?.type === "metadata" && msg.status === "completed";
									});

									if (hasCompleted) {
										isActive = false;
										controller.close();
										return;
									}
								}
							}

							// Wait before next poll
							await new Promise((resolve) => setTimeout(resolve, 100));
						} catch (error) {
							console.error("Error polling messages:", error);
							controller.error(error);
							isActive = false;
							return;
						}
					}
				};

				// Start polling
				pollMessages();
			},

			cancel() {
				// Cleanup when client disconnects
			},
		});
	}

	/**
	 * Consume messages from a stream with callbacks
	 */
	async consume(
		sessionId: string,
		signal: AbortSignal,
		options: {
			onMessage: (message: StreamMessage) => Promise<void>;
			onError?: (error: Error) => Promise<void>;
			onComplete?: () => Promise<void>;
			lastEventId?: string;
		}
	): Promise<void> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		let lastSeenId = options.lastEventId || "0";
		let consecutiveEmptyReads = 0;
		const maxEmptyReads = 10;

		try {
			while (!signal.aborted) {
				// Read messages after lastSeenId
				const response = (await this.redis.xrange(
					streamKey,
					`(${lastSeenId}`, // Exclusive start
					"+",
					10,
				)) as unknown as any;

				// Upstash returns an object with entry IDs as keys
				const entries = response && typeof response === "object" ? Object.entries(response) : [];

				if (entries.length > 0) {
					consecutiveEmptyReads = 0;

					for (const [entryId, fields] of entries) {
						if (signal.aborted) break;
						
						const message = validateMessage(fields);
						if (message) {
							await options.onMessage(message);

							// Check if stream is completed
							if (message.type === "metadata" && message.status === "completed") {
								if (options.onComplete) {
									await options.onComplete();
								}
								return;
							}
						}
						lastSeenId = entryId;
					}
				} else {
					consecutiveEmptyReads++;

					// Check if we've had too many empty reads
					if (consecutiveEmptyReads >= maxEmptyReads) {
						// Check if stream has completed status
						const lastResponse = (await this.redis.xrevrange(streamKey, "+", "-", 5)) as unknown as any;
						const lastEntries = lastResponse && typeof lastResponse === "object" ? Object.entries(lastResponse) : [];
						
						const hasCompleted = lastEntries.some(([_, fields]: [string, any]) => {
							const msg = validateMessage(fields);
							return msg?.type === "metadata" && msg.status === "completed";
						});

						if (hasCompleted) {
							if (options.onComplete) {
								await options.onComplete();
							}
							return;
						}
					}
				}

				// Wait before next poll
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		} catch (error) {
			if (options.onError) {
				await options.onError(error as Error);
			}
			throw error;
		}
	}

	/**
	 * Read messages from a stream (one-shot, no streaming)
	 */
	async readMessages(sessionId: string, fromId = "-", count = 100): Promise<StreamMessage[]> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const messages: StreamMessage[] = [];

		try {
			const response = (await this.redis.xrange(streamKey, fromId, "+", count)) as unknown as any;

			// Upstash returns an object with entry IDs as keys
			const entries = response && typeof response === "object" ? Object.entries(response) : [];

			for (const [_, fields] of entries) {
				const message = validateMessage(fields);
				if (message) {
					messages.push(message);
				}
			}
		} catch (error) {
			console.error("Error reading messages:", error);
		}

		return messages;
	}

	/**
	 * Get stream length
	 */
	async getStreamLength(sessionId: string): Promise<number> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		try {
			return await this.redis.xlen(streamKey);
		} catch (error) {
			console.error("Error getting stream length:", error);
			return 0;
		}
	}
}
