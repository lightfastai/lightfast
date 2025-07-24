import { auth } from "@clerk/nextjs/server";
import type { ExperimentalAgentId } from "@lightfast/types";
import type { NextRequest } from "next/server";
import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { Redis } from "@upstash/redis";
import { env as aiEnv } from "@lightfast/ai/env";
import { isValidUUID } from "@/lib/uuid-utils";
import { getStreamContext } from "../route";

// Initialize Redis client with REST API URL from AI env
const redis = new Redis({
	url: aiEnv.KV_REST_API_URL,
	token: aiEnv.KV_REST_API_TOKEN,
});

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ agentId: ExperimentalAgentId; threadId: string }> },
) {
	const { agentId, threadId } = await params;

	// Validate threadId
	if (!isValidUUID(threadId)) {
		return Response.json(
			{ error: `Invalid thread ID format: ${threadId}` },
			{ status: 400 },
		);
	}

	const streamContext = getStreamContext();
	if (!streamContext) {
		return new Response(null, { status: 204 });
	}

	// Check authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// Get the list of streamIds for this thread from Redis
		// The list is stored in reverse order (newest first)
		const streamIds = await redis.lrange(`chat:${threadId}:streams`, 0, 0);
		
		if (!streamIds || streamIds.length === 0) {
			console.log("No stream IDs found for thread:", threadId);
			return Response.json({ error: "No active streams found" }, { status: 404 });
		}

		// Get the most recent streamId
		const recentStreamId = streamIds[0];
		console.log("Attempting to resume stream:", recentStreamId);

		// Verify the stream exists in Redis
		const streamKey = `stream:${recentStreamId}`;
		const streamData = await redis.get(streamKey);
		
		if (!streamData) {
			console.log("Stream data not found in Redis:", recentStreamId);
			return Response.json({ error: "Stream not found" }, { status: 404 });
		}

		// Create an empty data stream for the resumable stream
		const emptyDataStream = createUIMessageStream({
			execute: () => {},
		});

		// Attempt to resume the stream
		const stream = await streamContext.resumableStream(recentStreamId, () =>
			emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
		);

		// TODO: Handle case when stream is null (generation completed)
		// For now, if stream is null, we'll return empty response
		// In the future, we should:
		// 1. Fetch the most recent assistant message from memory
		// 2. Check if it was created recently (within last 15 seconds)
		// 3. Return it as a restored stream if recent enough
		if (!stream) {
			console.log("Stream already completed or not resumable:", recentStreamId);
			return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), { 
				status: 200,
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					"Connection": "keep-alive",
				},
			});
		}

		return new Response(stream, { 
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error resuming stream:", error);
		return Response.json({ error: "Failed to resume stream" }, { status: 500 });
	}
}