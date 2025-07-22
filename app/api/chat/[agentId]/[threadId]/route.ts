import { auth } from "@clerk/nextjs/server";
import { JsonToSseTransformStream } from "ai";
import type { NextRequest } from "next/server";
import { generateStreamId, getStreamContext } from "@/lib/resumable-stream-context";
import { cleanupOldStreamIds, createStreamId } from "@/lib/stream-storage";
import { isValidUUID } from "@/lib/uuid-utils";
import { mastra } from "@/mastra";
import { type ExperimentalAgentId, experimentalAgents } from "@/mastra/agents/experimental";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const requestBody = await request.json();
		const { messages, threadId: bodyThreadId, userMessageId } = requestBody;
		const { agentId, threadId: paramsThreadId } = await params;

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

		// Include threadId, agentId, and userId in the agent call for proper memory/context handling
		const options = {
			threadId,
			resourceId: userId, // Use Clerk userId as resourceId
		};

		// Generate stream ID for this chat session
		const streamId = generateStreamId(agentId, threadId);

		// Store the stream ID for later retrieval
		await createStreamId({
			streamId,
			agentId,
			threadId,
			userId,
		});

		// Clean up old stream IDs (keep only the most recent 5)
		await cleanupOldStreamIds({
			threadId,
			userId,
			keepCount: 5,
		});

		// Only pass the last user message since the agent has memory of previous messages
		// This prevents duplicate message processing
		const lastUserMessage = messages[messages.length - 1];
		const result = await agent.stream([lastUserMessage], options);

		// Convert to UI message stream and then to SSE format
		const stream = result.toUIMessageStream().pipeThrough(new JsonToSseTransformStream());

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
