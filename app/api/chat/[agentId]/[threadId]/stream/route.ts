import { auth } from "@clerk/nextjs/server";
import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { differenceInSeconds } from "date-fns";
import type { NextRequest } from "next/server";
import { getStreamContext } from "@/lib/resumable-stream-context";
import { getStreamRecordsByThreadId } from "@/lib/stream-storage-redis";
import { mastra } from "@/mastra";
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
				try {
					// Get agent and attempt to retrieve the last assistant message
					const agentMap = {
						a010: "A010",
						a011: "A011",
					} as const;

					const mastraAgentKey = agentMap[agentId as ExperimentalAgentId];
					const agent = mastra.getAgent(mastraAgentKey);

					if (agent) {
						const memory = agent.getMemory();
						if (memory) {
							// Query for the last few messages to find the most recent assistant message
							const result = await memory.query({
								threadId,
								selectBy: {
									last: 10, // Get last 10 messages to find the most recent assistant message
								},
							});

							// Find the most recent assistant message
							const lastAssistantMessage = result.uiMessages
								.reverse() // Most recent first
								.find((msg: any) => msg.role === "assistant");

							if (lastAssistantMessage) {
								console.log(`[RESTORE] Found assistant message to restore for thread ${threadId}:`, lastAssistantMessage.id);

								// Convert the Mastra message to LightfastUIMessage format
								const convertedMessage: LightfastUIMessage = {
									id: lastAssistantMessage.id || crypto.randomUUID(),
									role: "assistant" as const,
									parts: lastAssistantMessage.parts || [
										{
											type: "text" as const,
											text: lastAssistantMessage.content || "",
										},
									],
								};

								// Create restoration stream with data-appendMessage
								const restoredStream = createUIMessageStream<LightfastUIMessage>({
									execute: ({ writer }) => {
										writer.write({
											type: 'data-appendMessage',
											data: JSON.stringify(convertedMessage),
											transient: true,
										});
									},
								});

								return new Response(
									restoredStream.pipeThrough(new JsonToSseTransformStream()),
									{ status: 200 },
								);
							} else {
								console.log(`[RESTORE] No assistant message found to restore for thread ${threadId}`);
							}
						}
					}
				} catch (error) {
					console.error("Error during message restoration:", error);
				}
			}
		}

		// Fallback to empty stream if restoration isn't applicable
		return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), { status: 200 });
	}

	// Stream is active and resumable
	return new Response(stream, { status: 200 });
}
