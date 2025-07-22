import { auth } from "@clerk/nextjs/server";
import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { differenceInSeconds } from "date-fns";
import type { NextRequest } from "next/server";
import { getStreamContext } from "@/lib/resumable-stream-context";
import { getMostRecentStreamId } from "@/lib/stream-storage";
import { type ExperimentalAgentId, experimentalAgents } from "@/mastra/agents/experimental";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
	try {
		const { agentId, threadId } = await params;
		const resumeRequestedAt = new Date();

		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Validate agentId
		if (!experimentalAgents[agentId as ExperimentalAgentId]) {
			return Response.json(
				{
					error: `Invalid agent ID: ${agentId}`,
				},
				{ status: 400 },
			);
		}

		// Get resumable stream context
		const streamContext = getStreamContext();
		if (!streamContext) {
			return new Response(null, { status: 204 }); // No Content
		}

		// Get the most recent stream ID for this thread
		const recentStream = await getMostRecentStreamId({ threadId, userId });

		if (!recentStream) {
			return Response.json({ error: "No stream found for this thread" }, { status: 404 });
		}

		// Create an empty data stream for resuming
		const emptyDataStream = createUIMessageStream({
			execute: () => {},
		});

		// Try to resume the stream using resumableStream method (like Vercel's implementation)
		const stream = await streamContext.resumableStream(recentStream.streamId, () =>
			emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
		);

		// If stream has already completed or not found
		if (!stream) {
			// Check if this is a recent completion (within 15 seconds)
			const streamAge = differenceInSeconds(resumeRequestedAt, recentStream.createdAt);

			if (streamAge > 15) {
				// Stream is too old, just return empty
				return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), {
					status: 200,
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				});
			}

			// For recent completions, we could restore the last message from memory
			// This would require fetching from the agent's memory system
			// For now, return empty stream
			return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), {
				status: 200,
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			});
		}

		// Stream is active and resumable
		return new Response(stream, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"X-Stream-Id": recentStream.streamId,
			},
		});
	} catch (error) {
		console.error("Stream resume error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
