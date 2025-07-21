import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
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
		const { messages, threadId: bodyThreadId } = requestBody;
		const { agentId, threadId: paramsThreadId } = await params;

		console.log(`[API] URL param agentId: ${agentId}`);
		console.log(`[API] URL param threadId: ${paramsThreadId}`);
		console.log(`[API] Request body threadId: ${bodyThreadId}`);
		console.log(`[API] Authenticated userId: ${userId}`);

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
		console.log(`[API] Final threadId: ${threadId}`);

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

		console.log(`[API] Using agent: ${agentId} (${mastraAgentKey})`);
		console.log(`[API] Agent tools:`, Object.keys(agent.tools || {}));

		// Include threadId, agentId, and userId in the agent call for proper memory/context handling
		const options = {
			threadId,
			resourceId: userId, // Use Clerk userId as resourceId
		};

		console.log(`[API] Agent options:`, options);

		// Always use streaming with AI SDK v5
		const result = await agent.stream(messages, options);

		// Use the new v5 method toUIMessageStreamResponse
		return result.toUIMessageStreamResponse();
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
