/**
 * Stream Consumer - Clean Redis stream consumer with consumer groups and pub/sub
 * Based on your optimized pattern with simple, readable code
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import { nanoid } from "nanoid";
import {
	getStreamKey,
	isUIMessageEntry,
	parseUIMessageEntry,
	type StreamConfig,
} from "../types";

// Delta stream message format (matches Agent delta streaming)
interface DeltaStreamMessage {
	type: "chunk" | "metadata" | "event" | "error";
	content?: string;
	metadata?: string; // JSON stringified
	timestamp: string;
}

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
	if (!rawObj.type || !rawObj.timestamp) return null;
	
	const validTypes = ["chunk", "metadata", "event", "error"];
	if (!validTypes.includes(rawObj.type)) return null;

	return {
		type: rawObj.type as DeltaStreamMessage["type"],
		content: rawObj.content,
		metadata: rawObj.metadata,
		timestamp: rawObj.timestamp,
	};
}

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
	 * Create an optimized delta stream following your clean pattern
	 * Simple, readable, and efficient
	 */
	createDeltaStream(sessionId: string): ReadableStream<Uint8Array> {
		const streamKey = `llm:stream:${sessionId}`;
		const groupName = `sse-group-${nanoid()}`;
		const redis = this.redis;

		return new ReadableStream({
			async start(controller) {
				// Check if stream exists
				const keyExists = await redis.exists(streamKey);
				if (!keyExists) {
					controller.error(new Error("Stream does not exist"));
					return;
				}

				// Create consumer group
				try {
					await redis.xgroup(streamKey, {
						type: "CREATE",
						group: groupName,
						id: "0",
					});
				} catch (_err) {
					// Group might already exist
				}

				// Read stream messages using consumer group
				const readStreamMessages = async () => {
					const chunks = await redis.xreadgroup(
						groupName,
						"consumer-1",
						streamKey,
						">"
					) as StreamData[];

					if (chunks && chunks.length > 0) {
						const streamData = chunks[0];
						if (streamData) {
							const [_streamKey, messages] = streamData;
							if (messages) {
								for (const [_messageId, fields] of messages) {
									const rawObj = arrToObj(fields);
									const validatedMessage = validateDeltaMessage(rawObj);

									if (validatedMessage) {
										controller.enqueue(json(validatedMessage as unknown as Record<string, unknown>));

										// Check for completion
										if (validatedMessage.type === "metadata" && 
											validatedMessage.metadata && 
											JSON.parse(validatedMessage.metadata).status === "completed") {
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
				const subscription = redis.subscribe(streamKey);
				subscription.on("message", async () => {
					await readStreamMessages();
				});

				subscription.on("error", (error) => {
					console.error(`Stream subscription error on ${streamKey}:`, error);
					controller.error(error);
				});

				// Handle client disconnect
				// Note: This would be handled by the request signal in your API route
			},

			cancel() {
				// Cleanup when client disconnects
			},
		});
	}

	/**
	 * Simple consume method for delta messages with callbacks
	 */
	async consumeDeltaStream(
		sessionId: string,
		signal: AbortSignal,
		onMessage: (message: DeltaStreamMessage) => Promise<void>,
		onError?: (error: Error) => Promise<void>,
		onComplete?: () => Promise<void>
	): Promise<void> {
		const streamKey = `llm:stream:${sessionId}`;
		const groupName = `consumer-group-${nanoid()}`;

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
			} catch (_err) {
				// Group might already exist
			}

			// Read stream messages
			const readStreamMessages = async () => {
				const chunks = await this.redis.xreadgroup(
					groupName,
					`consumer-${nanoid()}`,
					streamKey,
					">"
				) as StreamData[] | null;

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

									// Check for completion
									if (validatedMessage.type === "metadata" && 
										validatedMessage.metadata && 
										JSON.parse(validatedMessage.metadata).status === "completed") {
										if (onComplete) {
											await onComplete();
										}
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
				await new Promise(resolve => setTimeout(resolve, 1000));
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


	/**
	 * Read UIMessages from a stream (one-shot, no streaming)
	 */
	async readUIMessages(sessionId: string, fromId = "-", count = 100): Promise<UIMessage[]> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const messages: UIMessage[] = [];

		try {
			const response = (await this.redis.xrange(streamKey, fromId, "+", count)) as unknown as any;

			// Upstash returns an object with entry IDs as keys
			const entries = response && typeof response === "object" ? Object.entries(response) : [];

			for (const [_, fields] of entries) {
				const fieldsObj = fields as Record<string, string>;
				if (isUIMessageEntry(fieldsObj)) {
					const message = parseUIMessageEntry(fieldsObj);
					if (message) {
						messages.push(message);
					}
				}
			}
		} catch (error) {
			console.error("Error reading messages:", error);
		}

		return messages;
	}

}
