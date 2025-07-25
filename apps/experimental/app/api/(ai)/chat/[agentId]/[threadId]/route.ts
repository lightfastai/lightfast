import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import type { LightfastUIMessage } from "@lightfast/types";
import { convertToModelMessages, smoothStream, streamText } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import {
	appendMessages,
	createMessages,
	createStream,
	createThread,
	getMessages,
	getThread,
	getThreadStreams,
} from "@/lib/db";
import { uuidv4 } from "@/lib/uuidv4";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId, threadId } = await params;
		const { messages }: { messages: LightfastUIMessage[] } = await request.json();

		if (!messages || messages.length === 0) {
			return new Response("At least one message is required", { status: 400 });
		}

		// Check if thread exists and validate ownership
		const existingThread = await getThread(threadId);
		if (existingThread && existingThread.userId !== userId) {
			return Response.json({ error: "Forbidden" }, { status: 403 });
		}

		const streamId = uuidv4();

		// Get the most recent user message
		const recentUserMessage = messages.filter((message) => message.role === "user").at(-1);

		if (!recentUserMessage) {
			throw new Error("No recent user message found");
		}

		// Create thread if it doesn't exist
		await createThread({ threadId, userId, agentId });

		// Handle messages based on whether thread is new or existing
		let allMessages: LightfastUIMessage[];

		if (!existingThread) {
			// New thread - create with initial messages
			await createMessages({ threadId, messages });
			allMessages = messages;
		} else {
			// Existing thread - append only the recent user message
			await appendMessages({ threadId, messages: [recentUserMessage] });
			// Fetch all messages from database for full context
			allMessages = await getMessages(threadId);
		}

		// Store stream ID for resumption
		await createStream({ threadId, streamId });

		// Stream the response
		const result = streamText({
			model: gateway("anthropic/claude-4-sonnet"),
			messages: convertToModelMessages(allMessages),
			providerOptions: {
				anthropic: {
					thinking: { type: "enabled", budgetTokens: 12000 },
				} satisfies AnthropicProviderOptions,
			},
			experimental_transform: smoothStream({
				delayInMs: 25,
				chunking: "word",
			}),
			// TODO: Add tools based on agentId
			// tools: getToolsForAgent(agentId),
		});

		return result.toUIMessageStreamResponse({
			originalMessages: messages,
			onFinish: async ({ messages: finishedMessages }) => {
				// Only save the new assistant message (last message should be the assistant's response)
				const lastMessage = finishedMessages[finishedMessages.length - 1];
				if (lastMessage && lastMessage.role === "assistant") {
					await appendMessages({
						threadId,
						messages: [lastMessage as LightfastUIMessage],
					});
				}
			},
			async consumeSseStream({ stream }) {
				// Send the SSE stream into a resumable stream sink
				const streamContext = createResumableStreamContext({ waitUntil: after });
				await streamContext.createNewResumableStream(streamId, () => stream);
			},
		});
	} catch (error) {
		console.error("Error in POST /api/chat/[agentId]/[threadId]:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

export async function GET(_request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
	const { threadId } = await params;

	if (!threadId) {
		return new Response("threadId is required", { status: 400 });
	}

	// Check authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Check if thread exists and validate ownership
	const thread = await getThread(threadId);
	if (!thread || thread.userId !== userId) {
		return Response.json({ error: "Not found" }, { status: 404 });
	}

	const streamIds = await getThreadStreams(threadId);

	if (!streamIds.length) {
		return new Response(null, { status: 204 });
	}

	const recentStreamId = streamIds[0]; // Redis LPUSH puts newest first

	if (!recentStreamId) {
		return new Response(null, { status: 204 });
	}

	const streamContext = createResumableStreamContext({
		waitUntil: after,
	});

	const resumedStream = await streamContext.resumeExistingStream(recentStreamId);

	if (!resumedStream) {
		return new Response(null, { status: 204 });
	}

	return new Response(resumedStream);
}
