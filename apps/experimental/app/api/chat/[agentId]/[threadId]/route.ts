import { auth } from "@clerk/nextjs/server";
import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId } from "@lightfast/types";
import type { NextRequest } from "next/server";
import { isValidUUID } from "@/lib/uuid-utils";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { v4 as uuidv4 } from "uuid";
import { after } from "next/server";
import {
	createResumableStreamContext,
	type ResumableStreamContext,
} from "resumable-stream";
import { JsonToSseTransformStream } from "ai";

// Initialize Redis client
const redis = new Redis({
	url: env.KV_URL,
	token: env.KV_REST_API_READ_ONLY_TOKEN,
});

// Custom error class for chat SDK errors
class ChatSDKError extends Error {
	constructor(
		public code: string,
		message: string,
	) {
		super(message);
		this.name = "ChatSDKError";
	}
}

async function createStreamId({
	streamId,
	chatId,
}: {
	streamId: string;
	chatId: string;
}) {
	try {
		// Create a Redis key for the stream
		const streamKey = `stream:${streamId}`;
		
		// Store stream data in Redis with expiration (24 hours)
		await redis.setex(
			streamKey,
			86400, // 24 hours in seconds
			JSON.stringify({
				id: streamId,
				chatId,
				createdAt: new Date().toISOString(),
			})
		);
		
		// Also add to a list of streams for the chat
		await redis.lpush(`chat:${chatId}:streams`, streamId);
		
		// Keep only the latest 100 streams per chat
		await redis.ltrim(`chat:${chatId}:streams`, 0, 99);
	} catch (error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to create stream id",
		);
	}
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
	if (!globalStreamContext) {
		try {
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
		} catch (error: any) {
			if (error.message.includes("REDIS_URL")) {
				console.log(" > Resumable streams are disabled due to missing REDIS_URL");
			} else {
				console.error(error);
			}
		}
	}

	return globalStreamContext;
}

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

		// Generate a unique stream ID
		const streamId = uuidv4();
		
		// Create stream ID in Redis
		await createStreamId({ streamId, chatId: threadId });
		
		// Start streaming
		const result = await agent.stream([lastUserMessage], options);
		
		// Get the stream context for resumable streams
		const streamContext = getStreamContext();
		
		if (streamContext) {
			// Use resumable stream if available
			const stream = result.toUIMessageStream();
			return new Response(
				await streamContext.resumableStream(streamId, () =>
					stream.pipeThrough(new JsonToSseTransformStream()),
				),
			);
		} else {
			// Fall back to regular streaming
			return result.toUIMessageStreamResponse();
		}
	} catch (error) {
		console.error("Chat error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
