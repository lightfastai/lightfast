/**
 * SSE endpoint for consuming Redis streams
 * GET /api/v2/stream/[sessionId]
 */

import { StreamConsumer } from "@lightfast/ai/v2/server";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";
import { env } from "@/env";

// Initialize Redis
const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

// Initialize stream consumer
const consumer = new StreamConsumer(redis);

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const { sessionId } = await params;

	if (!sessionId) {
		return new Response("Session ID is required", { status: 400 });
	}

	try {
		// Create SSE stream
		const stream = consumer.createSSEStream(sessionId);

		// Return SSE response
		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				"Connection": "keep-alive",
				// CORS headers if needed
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("Stream error:", error);
		return new Response("Failed to create stream", { status: 500 });
	}
}