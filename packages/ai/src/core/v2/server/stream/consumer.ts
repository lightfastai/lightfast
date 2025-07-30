/**
 * Stream Consumer - Clean Redis stream consumer with consumer groups and pub/sub
 * Based on your optimized pattern with simple, readable code
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { uuidv4 } from "../../utils/uuid";
import { getDeltaStreamKey } from "../keys";
import { type DeltaStreamMessage, DeltaStreamType } from "./types";

// Redis stream types
type StreamField = string;
type StreamMessage = [string, StreamField[]];
type StreamData = [string, StreamMessage[]];

// Helper to convert array to object for Redis responses
const arrToObj = (arr: StreamField[]): Record<string, string> => {
	const obj: Record<string, string> = {};
	for (let i = 0; i < arr.length; i += 2) {
		const key = arr[i];
		const value = arr[i + 1];
		if (key && value) {
			obj[key] = value;
		}
	}
	return obj;
};

// Helper to format JSON responses
const json = (data: Record<string, unknown>): Uint8Array => {
	return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};

// Validate delta stream message
function validateDeltaMessage(rawObj: Record<string, string>): DeltaStreamMessage | null {
	if (!rawObj.type) return null;

	// Check if it's a valid type
	if (!Object.values(DeltaStreamType).includes(rawObj.type as DeltaStreamType)) {
		return null;
	}

	const message: DeltaStreamMessage = {
		type: rawObj.type as DeltaStreamType,
		timestamp: rawObj.timestamp || new Date().toISOString(),
	};

	// Add type-specific fields
	switch (message.type) {
		case DeltaStreamType.INIT:
			// Init doesn't require additional fields
			break;
		case DeltaStreamType.CHUNK:
			if (!rawObj.content) return null;
			message.content = rawObj.content;
			break;
		case DeltaStreamType.ERROR:
			if (!rawObj.error) return null;
			message.error = rawObj.error;
			break;
		case DeltaStreamType.COMPLETE:
			// Complete doesn't require additional fields
			break;
	}

	return message;
}

export class StreamConsumer {
	private redis: Redis;

	constructor(redis: Redis) {
		this.redis = redis;
	}

	/**
	 * Create an optimized delta stream following your clean pattern
	 * Simple, readable, and efficient
	 */
	createDeltaStream(streamId: string, signal?: AbortSignal): ReadableStream<Uint8Array> {
		const streamKey = getDeltaStreamKey(streamId);
		const groupName = `sse-group-${uuidv4()}`;
		const redis = this.redis;

		return new ReadableStream({
			async start(controller) {
				// Note: Stream existence is now checked at the fetch handler level
				// This assumes the stream exists when we reach this point

				// Create consumer group
				try {
					await redis.xgroup(streamKey, {
						type: "CREATE",
						group: groupName,
						id: "0",
					});
					console.log(`[StreamConsumer] Created consumer group: ${groupName} for stream: ${streamKey}`);
				} catch (err) {
					console.log(`[StreamConsumer] Consumer group creation failed (likely exists): ${groupName}`, {
						stream: streamKey,
						error: err instanceof Error ? err.message : String(err)
					});
				}

				let subscription: ReturnType<typeof redis.subscribe> | null = null;

				// Read stream messages using consumer group
				const readStreamMessages = async () => {
					const chunks = (await redis.xreadgroup(groupName, "consumer-1", streamKey, ">")) as StreamData[];

					if (chunks && chunks.length > 0) {
						const streamData = chunks[0];
						if (streamData) {
							const [_streamKey, messages] = streamData;
							if (messages) {
								for (const [_messageId, fields] of messages) {
									const rawObj = arrToObj(fields);
									const validatedMessage = validateDeltaMessage(rawObj);

									if (validatedMessage) {
										console.log("Sending stream message:", validatedMessage);
										controller.enqueue(json(validatedMessage as unknown as Record<string, unknown>));

										// Check for completion
										if (validatedMessage.type === DeltaStreamType.COMPLETE) {
											console.log("Stream completed, closing connection");
											controller.close();
											return;
										}
									}
								}
							}
						}
					}
				};

				// Initial read
				await readStreamMessages();

				// Subscribe to stream notifications
				subscription = redis.subscribe(streamKey);
				subscription.on("message", async () => {
					if (!signal?.aborted) {
						await readStreamMessages();
					}
				});

				subscription.on("error", (error) => {
					console.error(`Stream subscription error on ${streamKey}:`, error);
					controller.error(error);
				});

				// Handle client disconnect
				signal?.addEventListener("abort", () => {
					console.log("Client disconnected, cleaning up subscription");
					subscription?.unsubscribe();
					controller.close();
				});
			},

			cancel() {
				// Cleanup when client disconnects (fallback)
				// Note: subscription is not accessible here due to scope
			},
		});
	}

	/**
	 * Simple consume method for delta messages with callbacks
	 */
	async consumeDeltaStream(
		streamId: string,
		signal: AbortSignal,
		onMessage: (message: DeltaStreamMessage) => Promise<void>,
		onError?: (error: Error) => Promise<void>,
		onComplete?: () => Promise<void>,
	): Promise<void> {
		const streamKey = getDeltaStreamKey(streamId);
		const groupName = `consumer-group-${uuidv4()}`;

		try {
			// Check if stream exists
			const keyExists = await this.redis.exists(streamKey);
			if (!keyExists) {
				throw new Error("Stream does not exist");
			}

			// Create consumer group
			try {
				await this.redis.xgroup(streamKey, {
					type: "CREATE",
					group: groupName,
					id: "0",
				});
				console.log(`[StreamConsumer] Created consumer group: ${groupName} for stream: ${streamKey}`);
			} catch (err) {
				console.log(`[StreamConsumer] Consumer group creation failed (likely exists): ${groupName}`, {
					stream: streamKey,
					error: err instanceof Error ? err.message : String(err)
				});
			}

			// Read stream messages
			const readStreamMessages = async () => {
				const chunks = (await this.redis.xreadgroup(groupName, `consumer-${uuidv4()}`, streamKey, ">")) as
					| StreamData[]
					| null;

				if (chunks && chunks.length > 0) {
					const streamData = chunks[0];
					if (streamData) {
						const [_streamKey, messages] = streamData;
						if (messages) {
							for (const [_messageId, fields] of messages) {
								if (signal.aborted) break;

								const rawObj = arrToObj(fields);
								const validatedMessage = validateDeltaMessage(rawObj);

								if (validatedMessage) {
									await onMessage(validatedMessage);
								}
							}
						}
					}
				}
			};

			// Initial read
			await readStreamMessages();

			// Subscribe to stream notifications
			const subscription = this.redis.subscribe(streamKey);
			subscription.on("message", async () => {
				if (!signal.aborted) {
					await readStreamMessages();
				}
			});

			subscription.on("error", async (error) => {
				if (onError) {
					await onError(error);
				}
			});

			// Keep subscription alive until aborted
			while (!signal.aborted) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			// Cleanup
			subscription.unsubscribe();
		} catch (error) {
			if (onError) {
				await onError(error as Error);
			}
			throw error;
		}
	}
}
