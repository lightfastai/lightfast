import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import type { LightfastUIMessage } from "@lightfast/types";
import {
	convertToModelMessages,
	createUIMessageStream,
	JsonToSseTransformStream,
	smoothStream,
	streamText,
	type UIMessage,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { createMessages, createStream, createThread, getMessages, getThread, getThreadStreams } from "@/lib/db";
import { uuidv4 } from "@/lib/uuidv4";

// Create the resumable stream context
const streamContext = createResumableStreamContext({
	waitUntil: after,
});

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId, threadId } = await params;
		const { messages }: { messages: LightfastUIMessage[] } = await request.json();

		if (!messages) {
			return new Response("messages are required", { status: 400 });
		}

		// Check if thread exists and validate ownership
		const existingThread = await getThread(threadId);
		if (existingThread && existingThread.userId !== userId) {
			return Response.json({ error: "Forbidden" }, { status: 403 });
		}

		const streamId = uuidv4();

		// Create thread if it doesn't exist, or update timestamp if it does
		await createThread({ threadId, userId, agentId });

		// Save initial messages (including user message) immediately before streaming
		// This ensures the user message is persisted even if streaming fails
		await createMessages({ threadId, messages });
		console.log(`[POST] Created initial messages for threadId: ${threadId}, message count: ${messages.length}`);

		// Create this new stream so we can resume later
		await createStream({ threadId, streamId });

		// Build the data stream that will emit tokens
		const stream = createUIMessageStream<LightfastUIMessage>({
			execute: ({ writer: dataStream }) => {
				const result = streamText({
					model: gateway("anthropic/claude-4-sonnet"),
					messages: convertToModelMessages(messages),
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

				// Consume the stream to start processing
				result.consumeStream();

				// Merge the result into the data stream
				dataStream.merge(
					result.toUIMessageStream<LightfastUIMessage>({
						// Enable sending reasoning steps if using o1 model
						sendReasoning: true,
					}),
				);
			},
			generateId: uuidv4,
			onFinish: async ({ messages: newMessages }) => {
				console.log("Creating assistant response!");
				// onFinish receives UIMessage[] but we cast to LightfastUIMessage[]
				// Fetch existing messages and append new ones
				const existingMessages = await getMessages(threadId);
				const allMessages = [
					...(existingMessages.length > 0 ? existingMessages : messages),
					...(newMessages as LightfastUIMessage[]),
				];
				await createMessages({ threadId, messages: allMessages });
			},
			onError: (error) => {
				console.error("Stream error:", error);
				return "Oops, an error occurred!";
			},
		});

		// Use resumable stream if context is available
		return new Response(
			await streamContext.resumableStream(streamId, () => stream.pipeThrough(new JsonToSseTransformStream())),
			{
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			},
		);
	} catch (error) {
		console.error("Error in POST /api/chat/[agentId]/[threadId]:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

export async function GET(request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
	try {
		// Check authentication
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId, threadId } = await params;

		// Check if thread exists and validate ownership
		const thread = await getThread(threadId);
		if (!thread || thread.userId !== userId) {
			return Response.json({ error: "Not found" }, { status: 404 });
		}

		const streamIds = await getThreadStreams(threadId);

		if (!streamIds.length) {
			return new Response("No streams found", { status: 404 });
		}

		const recentStreamId = streamIds[0]; // Redis LPUSH puts newest first

		if (!recentStreamId) {
			return new Response("No recent stream found", { status: 404 });
		}

		const emptyDataStream = createUIMessageStream<LightfastUIMessage>({
			execute: () => {},
		});

		const stream = await streamContext.resumableStream(recentStreamId, () =>
			emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
		);

		// If no active stream, return empty response
		if (!stream) {
			return new Response(null, { status: 204 });
		}

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error in GET /api/chat/[agentId]/[threadId]:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
