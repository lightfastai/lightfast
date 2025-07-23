import { auth } from "@clerk/nextjs/server";
import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId } from "@lightfast/types";
import type { NextRequest } from "next/server";
import { isValidUUID } from "@/lib/uuid-utils";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: ExperimentalAgentId; threadId: string }> },
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
		const validAgentIds: ExperimentalAgentId[] = ["a010", "a011"];
		if (!validAgentIds.includes(agentId)) {
			return Response.json(
				{
					error: `Invalid agent ID: ${agentId}. Valid agents: ${validAgentIds.join(", ")}`,
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
		const agent = mastra.getAgent(agentId);

		if (!agent) {
			return Response.json(
				{
					error: `Agent ${agentId} not available`,
				},
				{ status: 500 },
			);
		}

		// Include threadId, agentId, and userId in the agent call for proper memory/context handling
		const options = {
			threadId,
			resourceId: userId, // Use Clerk userId as resourceId
		};

		// Only pass the last user message since the agent has memory of previous messages
		// This prevents duplicate message processing
		const lastUserMessage = messages[messages.length - 1];

		// Start streaming
		const result = await agent.stream([lastUserMessage], options);

		// Convert to UI message stream response
		// This automatically handles SSE format and returns a proper Response object
		return result.toUIMessageStreamResponse();
	} catch (error) {
		console.error("Chat error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ agentId: ExperimentalAgentId; threadId: string }> },
) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId, threadId } = await params;

		// Validate agentId
		const validAgentIds: ExperimentalAgentId[] = ["a010", "a011"];
		if (!validAgentIds.includes(agentId)) {
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
