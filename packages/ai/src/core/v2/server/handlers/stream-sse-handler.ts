/**
 * Stream SSE Handler - Handles Server-Sent Events streaming
 */

import type { Redis } from "@upstash/redis";
import { getDeltaStreamKey } from "../keys";
import { StreamConsumer } from "../stream/consumer";

export class StreamSSEHandler {
	private streamConsumer: StreamConsumer;

	constructor(private redis: Redis) {
		this.streamConsumer = new StreamConsumer(redis);
	}

	/**
	 * Handle SSE stream connection
	 */
	async handleStreamSSE(sessionId: string, signal?: AbortSignal): Promise<Response> {
		if (!sessionId) {
			return new Response("Session ID is required", { status: 400 });
		}

		try {
			// Check if stream exists before creating SSE stream
			const streamKey = getDeltaStreamKey(sessionId);
			const keyExists = await this.redis.exists(streamKey);

			if (!keyExists) {
				// Return 412 to indicate stream not ready (client will retry)
				return new Response("Stream not ready", { status: 412 });
			}

			// Create SSE stream with signal for cleanup
			const stream = this.streamConsumer.createDeltaStream(sessionId, signal);

			// Return SSE response
			return new Response(stream, {
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
					// CORS headers if needed
					"Access-Control-Allow-Origin": "*",
				},
			});
		} catch (error) {
			console.error("Stream error:", error);
			return new Response("Failed to create stream", { status: 500 });
		}
	}
}
