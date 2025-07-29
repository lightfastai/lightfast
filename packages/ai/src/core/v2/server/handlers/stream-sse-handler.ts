/**
 * Stream SSE Handler - Handles Server-Sent Events streaming
 */

import type { Redis } from "@upstash/redis";
import { getDeltaStreamKey } from "../keys";
import { StreamConsumer } from "../stream/consumer";

export interface StreamSSEDependencies {
	redis: Redis;
}

/**
 * Handle SSE stream connection
 */
export async function handleStreamSSE(
	sessionId: string,
	deps: StreamSSEDependencies,
	signal?: AbortSignal,
): Promise<Response> {
	const { redis } = deps;
	const streamConsumer = new StreamConsumer(redis);

	if (!sessionId) {
		return new Response("Session ID is required", { status: 400 });
	}

	try {
		// Check if stream exists before creating SSE stream
		const streamKey = getDeltaStreamKey(sessionId);
		const keyExists = await redis.exists(streamKey);

		if (!keyExists) {
			// Return 412 to indicate stream not ready (client will retry)
			return new Response("Stream not ready", { status: 412 });
		}

		// Create SSE stream with signal for cleanup
		const stream = streamConsumer.createDeltaStream(sessionId, signal);

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
