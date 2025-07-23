import { auth } from "@clerk/nextjs/server";
import { JsonToSseTransformStream } from "ai";
import type { NextRequest } from "next/server";
import { generateStreamId, getStreamContext } from "@/lib/resumable-stream-context";
// Use Redis for much faster stream ID storage
import { createStreamId } from "@/lib/stream-storage-redis";
import { isValidUUID } from "@/lib/uuid-utils";
import { mastra } from "@/mastra";
import { type ExperimentalAgentId, experimentalAgents } from "@/mastra/agents/experimental";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
	const startTime = Date.now();
	const timings: Record<string, number> = {};

	try {
		// Check authentication
		const authStart = Date.now();
		const { userId } = await auth();
		timings.auth = Date.now() - authStart;

		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parseStart = Date.now();
		const requestBody = await request.json();
		const { messages, threadId: bodyThreadId, userMessageId } = requestBody;
		const { agentId, threadId: paramsThreadId } = await params;
		timings.parsing = Date.now() - parseStart;

		// Validate agentId
		if (!experimentalAgents[agentId as ExperimentalAgentId]) {
			return Response.json(
				{
					error: `Invalid agent ID: ${agentId}. Valid agents: ${Object.keys(experimentalAgents).join(", ")}`,
				},
				{ status: 400 },
			);
		}

		// Use the threadId from request body if available, otherwise use URL param
		const threadId = bodyThreadId || paramsThreadId;

		// Validate threadId is a valid UUID
		if (!isValidUUID(threadId)) {
			return Response.json(
				{
					error: `Invalid thread ID format: ${threadId}. Thread ID must be a valid UUID.`,
				},
				{ status: 400 },
			);
		}

		// Validate userMessageId if provided
		if (userMessageId && !isValidUUID(userMessageId)) {
			return Response.json(
				{
					error: `Invalid user message ID format: ${userMessageId}. User message ID must be a valid UUID.`,
				},
				{ status: 400 },
			);
		}

		// Get the specific agent based on agentId
		// Map from experimental agent names to mastra registry keys
		const agentMap = {
			a010: "A010",
			a011: "A011",
		} as const;

		const agentStart = Date.now();
		const mastraAgentKey = agentMap[agentId as ExperimentalAgentId];
		const agent = mastra.getAgent(mastraAgentKey);

		if (!agent) {
			return Response.json(
				{
					error: `Agent ${agentId} (${mastraAgentKey}) not available`,
				},
				{ status: 500 },
			);
		}
		timings.agentInit = Date.now() - agentStart;

		// Include threadId, agentId, and userId in the agent call for proper memory/context handling
		const options = {
			threadId,
			resourceId: userId, // Use Clerk userId as resourceId
		};

		// Generate stream ID for this chat session
		const streamId = generateStreamId(agentId, threadId);

		// Only pass the last user message since the agent has memory of previous messages
		// This prevents duplicate message processing
		const lastUserMessage = messages[messages.length - 1];

		// Start streaming immediately - this is the critical path
		const streamStart = Date.now();
		const result = await agent.stream([lastUserMessage], options);
		timings.streamInit = Date.now() - streamStart;

		// Convert to UI message stream and then to SSE format
		const stream = result.toUIMessageStream().pipeThrough(new JsonToSseTransformStream());

		// Log total time to stream start
		timings.totalToStream = Date.now() - startTime;
		console.log(`[PERF] Stream timing for ${agentId}/${threadId}:`, timings);

		// Store the stream ID in the background
		// Cleanup is now handled by a cron job for better performance
		const backgroundStart = Date.now();

		createStreamId({
			streamId,
			agentId,
			threadId,
			userId,
		})
			.then(() => {
				const backgroundTime = Date.now() - backgroundStart;
				console.log(`[PERF] Stream ID stored for ${agentId}/${threadId} in ${backgroundTime}ms`);
			})
			.catch((err) => console.error("Failed to create stream ID:", err));

		// Get resumable stream context
		const streamContext = getStreamContext();

		// If resumable streams are available, use them
		if (streamContext) {
			return new Response(await streamContext.resumableStream(streamId, () => stream));
		} else {
			// Fallback to regular streaming if resumable streams aren't available
			return new Response(stream);
		}
	} catch (error) {
		console.error("Chat error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId, threadId } = await params;

		// Validate agentId
		if (!experimentalAgents[agentId as ExperimentalAgentId]) {
			return Response.json(
				{
					error: `Invalid agent ID: ${agentId}`,
				},
				{ status: 400 },
			);
		}

		// This could be used to retrieve thread history or metadata
		// For now, just return thread info
		return Response.json({
			agentId,
			threadId,
			userId,
			message: "Agent thread endpoint active",
		});
	} catch (error) {
		console.error("Thread info error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
