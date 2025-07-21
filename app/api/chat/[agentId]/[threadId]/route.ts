import { auth } from "@clerk/nextjs/server";
import { JsonToSseTransformStream } from "ai";
import type { NextRequest } from "next/server";
import { generateStreamId, getStreamContext } from "@/lib/resumable-stream-context";
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

		// Get resumable stream context
		const streamContext = getStreamContext();
		const streamId = generateStreamId(agentId, threadId);

		// Always use streaming with AI SDK v5
		const result = await agent.stream(messages, options);

		// If resumable streams are available, use them
		if (streamContext) {
			// Get the UI message stream response first
			const response = result.toUIMessageStreamResponse();

			// Extract the readable stream from the response body
			if (response.body) {
				// Transform the byte stream to text stream for resumable-stream
				const textStream = response.body.pipeThrough(new TextDecoderStream());

				// Create resumable stream
				const resumableStream = await streamContext.resumableStream(streamId, () => textStream);

				if (resumableStream) {
					// Convert back to byte stream for Response
					const byteStream = resumableStream.pipeThrough(new TextEncoderStream());

					return new Response(byteStream, {
						headers: {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-cache",
							Connection: "keep-alive",
							"X-Stream-Id": streamId, // Include stream ID in response header
						},
					});
				}
			}
		}

		// Fallback to regular streaming if resumable streams aren't available
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
