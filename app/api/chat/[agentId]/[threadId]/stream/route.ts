import { auth } from "@clerk/nextjs/server";
import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { differenceInSeconds } from "date-fns";
import type { NextRequest } from "next/server";
import { getStreamContext } from "@/lib/resumable-stream-context";
import { getStreamRecordsByThreadId } from "@/lib/stream-storage-redis";
import { type ExperimentalAgentId, experimentalAgents } from "@/mastra/agents/experimental";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
	const { agentId, threadId } = await params;

	// Get resumable stream context
	const streamContext = getStreamContext();
	const resumeRequestedAt = new Date();

	if (!streamContext) {
		return new Response(null, { status: 204 }); // No Content
	}

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

	// Get all stream IDs for this thread
	const streamRecords = await getStreamRecordsByThreadId({ threadId, userId });
	const streamIds = streamRecords.map((record) => record.streamId);

	if (!streamIds.length) {
		return Response.json({ error: "No stream found for this thread" }, { status: 404 });
	}

	// Get the most recent stream ID
	const recentStreamId = streamIds.at(-1);

	if (!recentStreamId) {
		return Response.json({ error: "No stream found for this thread" }, { status: 404 });
	}

	// Create an empty data stream for fallback scenarios
	const emptyDataStream = createUIMessageStream<LightfastUIMessage>({
		execute: () => {},
	});

	// Try to resume the stream using resumableStream method
	const stream = await streamContext.resumableStream(recentStreamId, () =>
		emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
	);

	/*
	 * For when the generation is streaming during SSR
	 * but the resumable stream has concluded at this point.
	 * This matches Vercel's message restoration logic exactly.
	 */
	if (!stream) {
		// Get the most recent stream record to check timing
		const mostRecentStreamRecord = streamRecords.at(-1);

		if (mostRecentStreamRecord) {
			const messageCreatedAt = new Date(mostRecentStreamRecord.createdAt);

			// Only attempt restoration if the message was created within 15 seconds (matches Vercel)
			if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) <= 15) {
				// TODO: Implement actual message restoration from agent memory
				// This would involve:
				// 1. Getting conversation history from Mastra agent memory
				// 2. Finding the most recent assistant message
				// 3. Using data-appendMessage to restore it

				// For now, create a placeholder restoration stream
				const restoredStream = createUIMessageStream<LightfastUIMessage>({
					execute: ({ writer: _writer }) => {
						// Placeholder for actual message restoration
						// In a complete implementation, you would:
						// const lastAssistantMessage = await getLastAssistantMessage(threadId, userId);
						// if (lastAssistantMessage) {
						//   _writer.write({
						//     type: 'data-appendMessage',
						//     data: JSON.stringify(lastAssistantMessage),
						//     transient: true,
						//   });
						// }
					},
				});

				return new Response(restoredStream.pipeThrough(new JsonToSseTransformStream()), { status: 200 });
			}
		}

		// Fallback to empty stream if restoration isn't applicable
		return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), { status: 200 });
	}

	// Stream is active and resumable
	return new Response(stream, { status: 200 });
}
