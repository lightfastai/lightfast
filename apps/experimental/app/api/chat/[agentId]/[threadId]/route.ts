import { auth } from "@clerk/nextjs/server";
import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId } from "@lightfast/types";
import type { NextRequest } from "next/server";
import { isValidUUID } from "@/lib/uuid-utils";
import { Redis } from "@upstash/redis";
import { env as aiEnv } from "@lightfast/ai/env";
import { v4 as uuidv4 } from "uuid";
import { after } from "next/server";
import { createResumableStreamContext, type ResumableStreamContext } from "resumable-stream";
import { JsonToSseTransformStream, createUIMessageStream } from "ai";

// Initialize Redis client with REST API URL from AI env
const redis = new Redis({
	url: aiEnv.KV_REST_API_URL,
	token: aiEnv.KV_REST_API_TOKEN,
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

async function createStreamId({ streamId, chatId }: { streamId: string; chatId: string }) {
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
			}),
		);

		// Also add to a list of streams for the chat
		await redis.lpush(`chat:${chatId}:streams`, streamId);

		// Keep only the latest 100 streams per chat
		await redis.ltrim(`chat:${chatId}:streams`, 0, 99);
	} catch (error) {
		throw new ChatSDKError("bad_request:database", "Failed to create stream id");
	}
}

let globalStreamContext: ResumableStreamContext | null = null;
let contextCreatedAt: number = 0;
const CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

export function getStreamContext() {
	const now = Date.now();
	
	// Recreate context if it's too old or doesn't exist
	if (!globalStreamContext || (now - contextCreatedAt) > CONTEXT_TTL) {
		try {
			if (globalStreamContext) {
				console.log("Recreating stream context due to age");
			}
			
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
			contextCreatedAt = now;
		} catch (error: any) {
			if (error.message.includes("REDIS_URL")) {
				console.log(" > Resumable streams are disabled due to missing REDIS_URL");
			} else {
				console.error("Error creating stream context:", error);
			}
			return null;
		}
	}

	return globalStreamContext;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ agentId: ExperimentalAgentId; threadId: string }> },
) {
	const { agentId, threadId } = await params;
	
	// Get chatId from query params (v5 pattern)
	const chatId = request.nextUrl.searchParams.get('chatId');
	
	// Use chatId if provided, otherwise use threadId for backward compatibility
	const streamThreadId = chatId || threadId;
	
	// Validate threadId
	if (!isValidUUID(streamThreadId)) {
		return Response.json(
			{ error: `Invalid thread ID format: ${streamThreadId}` },
			{ status: 400 },
		);
	}

	const streamContext = getStreamContext();
	const resumeRequestedAt = new Date();
	
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
		const streamIds = await redis.lrange(`chat:${streamThreadId}:streams`, 0, 0);
		
		if (!streamIds || streamIds.length === 0) {
			console.log("No stream IDs found for thread:", streamThreadId);
			return new Response(null, { status: 204 });
		}

		// Get the most recent streamId
		const recentStreamId = streamIds[0];
		console.log(`Attempting to resume stream: ${recentStreamId}`);

		// Create an empty data stream for fallback
		const emptyDataStream = createUIMessageStream({
			execute: () => {},
		});

		// Attempt to resume the stream
		const stream = await streamContext.resumableStream(recentStreamId, () =>
			emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
		);

		/*
		 * For when the generation is streaming during SSR
		 * but the resumable stream has concluded at this point.
		 */
		if (!stream) {
			// Get the agent to access memory and fetch recent messages
			const agent = mastra.getAgent(agentId);
			if (!agent) {
				return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), { 
					status: 200,
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Connection": "keep-alive",
					},
				});
			}

			const memory = await agent.getMemory();
			const messages = await memory.query({
				threadId: streamThreadId,
				selectBy: { last: 10 },
			});

			const mostRecentMessage = messages.uiMessages?.at(-1);
			
			if (!mostRecentMessage || mostRecentMessage.role !== 'assistant') {
				return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), { 
					status: 200,
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Connection": "keep-alive",
					},
				});
			}

			// Check if message was created within last 15 seconds
			const messageCreatedAt = new Date(mostRecentMessage.createdAt || Date.now());
			const secondsDiff = Math.abs((resumeRequestedAt.getTime() - messageCreatedAt.getTime()) / 1000);
			
			if (secondsDiff > 15) {
				return new Response(emptyDataStream.pipeThrough(new JsonToSseTransformStream()), { 
					status: 200,
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Connection": "keep-alive",
					},
				});
			}

			// Restore the recent assistant message
			const restoredStream = createUIMessageStream({
				execute: ({ writer }) => {
					writer.write({
						type: 'data-appendMessage',
						data: JSON.stringify(mostRecentMessage),
						transient: true,
					});
				},
			});

			return new Response(restoredStream.pipeThrough(new JsonToSseTransformStream()), {
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

		/**
		 * HACK: Manual Message Persistence Workaround
		 * 
		 * Mastra's default behavior only persists messages to the database AFTER 
		 * the entire stream completes. This creates several issues:
		 * 
		 * 1. Race Condition: If user refreshes immediately after sending a message,
		 *    the page shows 0 messages because nothing is in the database yet
		 * 
		 * 2. Lost Context: If the stream is interrupted (network issues, user refresh),
		 *    both the user message and partial AI response are lost
		 * 
		 * 3. UI/DB Mismatch: The UI shows messages that aren't actually persisted,
		 *    creating a false sense of data safety
		 * 
		 * Our Workaround:
		 * - Manually get the agent's memory
		 * - Convert the UI message to Mastra's internal v3 format
		 * - Save the user message to the database BEFORE streaming
		 * - Stream with an empty array since the message is already in memory
		 * 
		 * Limitations:
		 * - Only the user message is saved upfront
		 * - The AI response is still not persisted until completion
		 * - We have to maintain the message format conversion logic
		 * 
		 * Why the v3 format:
		 * Mastra internally uses a different message format than what the UI sends.
		 * The UI sends: { id, role, parts: [{type, text}] }
		 * Mastra expects: { id, resourceId, threadId, createdAt, role, 
		 *                   content: { format: 2, parts, content }, type: "v3", _index }
		 */
		const memory = await agent.getMemory();
		
		// First, check if thread exists, create if it doesn't
		const existingThread = await memory.getThreadById({ threadId });
		
		if (!existingThread) {
			// Create the thread since it doesn't exist
			await memory.createThread({
				threadId,
				resourceId: userId,
				title: `Chat with ${agentId}`,
				metadata: {
					agentId,
					createdAt: new Date().toISOString(),
				},
			});
		}
		
		// Convert UI message to Mastra's internal v3 format
		// This format was discovered by inspecting what Mastra saves to the database
		const mastraMessage = {
			id: lastUserMessage.id,
			resourceId: userId,
			threadId,
			createdAt: new Date().toISOString(),
			role: lastUserMessage.role,
			content: {
				format: 2,
				parts: lastUserMessage.parts,
				content: lastUserMessage.parts.find(p => p.type === "text")?.text || "",
			},
			type: "v3",
			_index: 0,
		};
		
		// Save the message to memory before streaming
		await memory.saveMessages({
			messages: [mastraMessage],
		});
		
		// Now stream with empty array since message is already in memory
		// The agent will retrieve all messages from memory using the threadId
		const result = await agent.stream([], options);

		// Get the stream context for resumable streams
		const streamContext = getStreamContext();

		if (streamContext) {
			// Use resumable stream if available
			const stream = result.toUIMessageStream();
			return new Response(
				await streamContext.resumableStream(streamId, () => stream.pipeThrough(new JsonToSseTransformStream())),
			);
		} else {
			// Fall back to regular streaming
			const stream = result.toUIMessageStream();
			return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
		}
	} catch (error) {
		console.error("Chat error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
