/**
 * Stream Consumer - Reads UIMessages from Redis and delivers to clients via SSE
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import {
	getEventStreamKey,
	getGroupName,
	getStreamKey,
	isSystemEventEntry,
	isUIMessageEntry,
	isUIMessagePartEntry,
	parseSystemEvent,
	parseUIMessageEntry,
	parseUIMessagePartEntry,
	type StreamConfig,
	type SystemEvent,
	type UIMessagePart,
} from "./types";

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
	 * Streams UIMessage parts and system events
	 */
	createSSEStream(sessionId: string, consumerId = "consumer-1"): ReadableStream<Uint8Array> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const eventKey = getEventStreamKey(sessionId);
		const encoder = new TextEncoder();
		const redis = this.redis;

		// Helper to format SSE messages
		const formatSSE = (type: string, data: any): Uint8Array => {
			return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
		};

		return new ReadableStream({
			async start(controller) {
				let lastMessageId = "0";
				let lastEventId = "0";
				let isActive = true;
				let consecutiveEmptyReads = 0;
				const maxEmptyReads = 10;

				// Poll for messages and events
				const pollStreams = async () => {
					while (isActive) {
						try {
							// Read from both message stream and event stream
							const [messageResponse, eventResponse] = await Promise.all([
								redis.xrange(streamKey, `(${lastMessageId}`, "+", 10) as unknown as any,
								redis.xrange(eventKey, `(${lastEventId}`, "+", 10) as unknown as any,
							]);

							// Process messages
							const messageEntries =
								messageResponse && typeof messageResponse === "object" ? Object.entries(messageResponse) : [];
							const eventEntries =
								eventResponse && typeof eventResponse === "object" ? Object.entries(eventResponse) : [];

							const hasData = messageEntries.length > 0 || eventEntries.length > 0;

							if (hasData) {
								consecutiveEmptyReads = 0;

								// Process message entries
								for (const [entryId, fields] of messageEntries) {
									if (!isActive) break;

									const fieldsObj = fields as Record<string, string>;
									// Check what type of entry this is
									if (isUIMessageEntry(fieldsObj)) {
										const message = parseUIMessageEntry(fieldsObj);
										if (message) {
											controller.enqueue(formatSSE("message", message));
										}
									} else if (isUIMessagePartEntry(fieldsObj)) {
										const part = parseUIMessagePartEntry(fieldsObj);
										if (part) {
											controller.enqueue(
												formatSSE("message-part", {
													messageId: fieldsObj.messageId,
													partIndex: fieldsObj.partIndex,
													part,
												}),
											);
										}
									}
									lastMessageId = entryId;
								}

								// Process event entries
								for (const [entryId, fields] of eventEntries) {
									if (!isActive) break;

									const event = parseSystemEvent(fields as Record<string, string>);
									if (event) {
										controller.enqueue(formatSSE("system-event", event));

										// Check if stream is completed
										if (event.type === "metadata" && event.status === "completed") {
											isActive = false;
											controller.close();
											return;
										}
									}
									lastEventId = entryId;
								}
							} else {
								consecutiveEmptyReads++;

								// Check if we've had too many empty reads
								if (consecutiveEmptyReads >= maxEmptyReads) {
									// Check if stream has completed status in events
									const lastEventResp = (await redis.xrevrange(eventKey, "+", "-", 5)) as unknown as any;
									const lastEvents =
										lastEventResp && typeof lastEventResp === "object" ? Object.entries(lastEventResp) : [];

									const hasCompleted = lastEvents.some(([_, fields]: [string, any]) => {
										const event = parseSystemEvent(fields as Record<string, string>);
										return event?.type === "metadata" && event.status === "completed";
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
							console.error("Error polling streams:", error);
							controller.error(error);
							isActive = false;
							return;
						}
					}
				};

				// Start polling
				pollStreams();
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
			onUIMessage?: (message: UIMessage) => Promise<void>;
			onUIMessagePart?: (part: UIMessagePart, messageId: string, partIndex: number) => Promise<void>;
			onSystemEvent?: (event: SystemEvent) => Promise<void>;
			onError?: (error: Error) => Promise<void>;
			onComplete?: () => Promise<void>;
			lastMessageId?: string;
			lastEventId?: string;
		},
	): Promise<void> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const eventKey = getEventStreamKey(sessionId);
		let lastMessageId = options.lastMessageId || "0";
		let lastEventId = options.lastEventId || "0";
		let consecutiveEmptyReads = 0;
		const maxEmptyReads = 10;

		try {
			while (!signal.aborted) {
				// Read from both streams
				const [messageResponse, eventResponse] = await Promise.all([
					this.redis.xrange(streamKey, `(${lastMessageId}`, "+", 10) as unknown as any,
					this.redis.xrange(eventKey, `(${lastEventId}`, "+", 10) as unknown as any,
				]);

				const messageEntries =
					messageResponse && typeof messageResponse === "object" ? Object.entries(messageResponse) : [];
				const eventEntries = eventResponse && typeof eventResponse === "object" ? Object.entries(eventResponse) : [];

				const hasData = messageEntries.length > 0 || eventEntries.length > 0;

				if (hasData) {
					consecutiveEmptyReads = 0;

					// Process message entries
					for (const [entryId, fields] of messageEntries) {
						if (signal.aborted) break;

						const fieldsObj = fields as Record<string, string>;
						if (isUIMessageEntry(fieldsObj)) {
							const message = parseUIMessageEntry(fieldsObj);
							if (message && options.onUIMessage) {
								await options.onUIMessage(message);
							}
						} else if (isUIMessagePartEntry(fieldsObj)) {
							const part = parseUIMessagePartEntry(fieldsObj);
							if (part && options.onUIMessagePart) {
								const messageId = fieldsObj.messageId || "";
								const partIndex = fieldsObj.partIndex || "0";
								await options.onUIMessagePart(part, messageId, parseInt(partIndex, 10));
							}
						}
						lastMessageId = entryId;
					}

					// Process event entries
					for (const [entryId, fields] of eventEntries) {
						if (signal.aborted) break;

						const event = parseSystemEvent(fields as Record<string, string>);
						if (event) {
							if (options.onSystemEvent) {
								await options.onSystemEvent(event);
							}

							// Check if stream is completed
							if (event.type === "metadata" && event.status === "completed") {
								if (options.onComplete) {
									await options.onComplete();
								}
								return;
							}
						}
						lastEventId = entryId;
					}
				} else {
					consecutiveEmptyReads++;

					// Check if we've had too many empty reads
					if (consecutiveEmptyReads >= maxEmptyReads) {
						// Check if stream has completed status
						const lastEventResp = (await this.redis.xrevrange(eventKey, "+", "-", 5)) as unknown as any;
						const lastEvents = lastEventResp && typeof lastEventResp === "object" ? Object.entries(lastEventResp) : [];

						const hasCompleted = lastEvents.some(([_, fields]: [string, any]) => {
							const event = parseSystemEvent(fields as Record<string, string>);
							return event?.type === "metadata" && event.status === "completed";
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

	/**
	 * Read UIMessageParts from a stream
	 */
	async readUIMessageParts(sessionId: string, messageId: string, fromId = "-", count = 100): Promise<UIMessagePart[]> {
		const streamKey = getStreamKey(sessionId, this.config.streamPrefix);
		const parts: UIMessagePart[] = [];

		try {
			const response = (await this.redis.xrange(streamKey, fromId, "+", count)) as unknown as any;
			const entries = response && typeof response === "object" ? Object.entries(response) : [];

			for (const [_, fields] of entries) {
				const fieldsObj = fields as Record<string, string>;
				if (isUIMessagePartEntry(fieldsObj) && fieldsObj.messageId === messageId) {
					const part = parseUIMessagePartEntry(fieldsObj);
					if (part) {
						parts.push(part);
					}
				}
			}
		} catch (error) {
			console.error("Error reading message parts:", error);
		}

		return parts;
	}

	/**
	 * Read system events from event stream
	 */
	async readSystemEvents(sessionId: string, fromId = "-", count = 100): Promise<SystemEvent[]> {
		const eventKey = getEventStreamKey(sessionId);
		const events: SystemEvent[] = [];

		try {
			const response = (await this.redis.xrange(eventKey, fromId, "+", count)) as unknown as any;
			const entries = response && typeof response === "object" ? Object.entries(response) : [];

			for (const [_, fields] of entries) {
				const event = parseSystemEvent(fields as Record<string, string>);
				if (event) {
					events.push(event);
				}
			}
		} catch (error) {
			console.error("Error reading events:", error);
		}

		return events;
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
