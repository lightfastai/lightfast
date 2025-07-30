/**
 * Event Consumer - Clean Redis stream consumer for agent events
 * Based on the optimized pattern from StreamConsumer
 */

import type { Redis } from "@upstash/redis";
import { uuidv4 } from "../../utils/uuid";
import { EventName, type AgentEvent } from "./types";

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

// Validate and parse event message
function parseEventMessage(rawObj: Record<string, string>): AgentEvent | null {
	if (!rawObj.name || !rawObj.timestamp || !rawObj.sessionId || !rawObj.agentId) {
		return null;
	}

	const name = rawObj.name as EventName;
	const baseEvent = {
		name,
		timestamp: rawObj.timestamp,
		sessionId: rawObj.sessionId,
		agentId: rawObj.agentId,
	};

	// Parse based on event type with proper typing
	switch (name) {
		case EventName.AGENT_LOOP_START:
			if (!rawObj.input) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_LOOP_START,
				input: rawObj.input,
			};

		case EventName.AGENT_LOOP_COMPLETE:
			if (!rawObj.output || !rawObj.duration || !rawObj.toolCalls || !rawObj.steps) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_LOOP_COMPLETE,
				output: rawObj.output,
				duration: Number(rawObj.duration),
				toolCalls: Number(rawObj.toolCalls),
				steps: Number(rawObj.steps),
			};

		case EventName.AGENT_TOOL_CALL:
			if (!rawObj.toolName || !rawObj.toolCallId || !rawObj.args) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_TOOL_CALL,
				toolName: rawObj.toolName,
				toolCallId: rawObj.toolCallId,
				args: JSON.parse(rawObj.args),
			};

		case EventName.AGENT_TOOL_RESULT:
			if (!rawObj.toolName || !rawObj.toolCallId || !rawObj.result || !rawObj.duration) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_TOOL_RESULT,
				toolName: rawObj.toolName,
				toolCallId: rawObj.toolCallId,
				result: JSON.parse(rawObj.result),
				duration: Number(rawObj.duration),
			};

		case EventName.AGENT_STEP_START:
			if (!rawObj.stepIndex || !rawObj.input) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_STEP_START,
				stepIndex: Number(rawObj.stepIndex),
				input: rawObj.input,
			};

		case EventName.AGENT_STEP_COMPLETE:
			if (!rawObj.stepIndex || !rawObj.output || !rawObj.duration) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_STEP_COMPLETE,
				stepIndex: Number(rawObj.stepIndex),
				output: rawObj.output,
				duration: Number(rawObj.duration),
			};

		case EventName.AGENT_ERROR:
			if (!rawObj.error) return null;
			return {
				...baseEvent,
				name: EventName.AGENT_ERROR,
				error: rawObj.error,
				code: rawObj.code,
				stepIndex: rawObj.stepIndex ? Number(rawObj.stepIndex) : undefined,
				toolCallId: rawObj.toolCallId,
			};

		default:
			return null;
	}
}

export class EventConsumer {
	private redis: Redis;

	constructor(redis: Redis) {
		this.redis = redis;
	}

	/**
	 * Get the event stream key for a session
	 */
	private getEventStreamKey(sessionId: string): string {
		return `events:${sessionId}`;
	}

	/**
	 * Create an event stream for SSE following the clean pattern
	 */
	createEventStream(sessionId: string, signal?: AbortSignal): ReadableStream<Uint8Array> {
		const streamKey = this.getEventStreamKey(sessionId);
		const groupName = `sse-group-${uuidv4()}`;
		const redis = this.redis;

		return new ReadableStream({
			async start(controller) {
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
									const event = parseEventMessage(rawObj);

									if (event) {
										console.log("Sending event:", event);
										controller.enqueue(json(event as unknown as Record<string, unknown>));
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
					console.error(`Event stream subscription error on ${streamKey}:`, error);
					controller.error(error);
				});

				// Handle client disconnect
				signal?.addEventListener("abort", () => {
					console.log("Client disconnected, cleaning up event subscription");
					subscription?.unsubscribe();
					controller.close();
				});
			},

			cancel() {
				// Cleanup when client disconnects (fallback)
			},
		});
	}

	/**
	 * Simple consume method for events with callbacks
	 */
	async consumeEvents(
		sessionId: string,
		signal: AbortSignal,
		onEvent: (event: AgentEvent) => Promise<void>,
		onError?: (error: Error) => Promise<void>,
		filter?: (event: AgentEvent) => boolean,
	): Promise<void> {
		const streamKey = this.getEventStreamKey(sessionId);
		const groupName = `consumer-group-${uuidv4()}`;

		try {
			// Check if stream exists
			const keyExists = await this.redis.exists(streamKey);
			if (!keyExists) {
				throw new Error("Event stream does not exist");
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
								const event = parseEventMessage(rawObj);

								if (event && (!filter || filter(event))) {
									await onEvent(event);
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

	/**
	 * Get all events for a session (for debugging/analysis)
	 */
	async getAllEvents(sessionId: string, limit = 100): Promise<AgentEvent[]> {
		const streamKey = this.getEventStreamKey(sessionId);
		const events: AgentEvent[] = [];

		try {
			// Read all messages from the stream
			const messages = await this.redis.xrange(streamKey, "-", "+", limit) as unknown as StreamMessage[];

			for (const [_messageId, fields] of messages) {
				const rawObj = arrToObj(fields);
				const event = parseEventMessage(rawObj);
				if (event) {
					events.push(event);
				}
			}
		} catch (error) {
			console.error("Error reading events:", error);
		}

		return events;
	}
}