import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { Agent, type DatabaseOperations } from "@lightfast/ai/agent";
import { A011_SYSTEM_PROMPT, type A011Tools, createA011Tools } from "@lightfast/ai/agents/a011";
import type { LightfastUIMessage } from "@lightfast/types";
import { smoothStream, stepCountIs, type UIMessageStreamOptions } from "ai";
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

		// Create properly typed database operations object
		const dbOperations: DatabaseOperations<LightfastUIMessage> = {
			appendMessages,
			createMessages,
			createStream,
			createThread,
			getMessages,
			getThread,
			getThreadStreams,
		};

		// Create agent instance with a011 configuration
		const agent = new Agent<LightfastUIMessage, A011Tools>({
			agentId,
			userId,
			db: dbOperations,
			system: A011_SYSTEM_PROMPT,
			tools: createA011Tools,
			model: gateway("anthropic/claude-4-sonnet"),
			experimental_transform: smoothStream({
				delayInMs: 25,
				chunking: "word",
			}),
			stopWhen: stepCountIs(30),
			_internal: {
				generateId: uuidv4,
			},
			// UI stream options for reasoning and sources
			uiStreamOptions: {
				sendReasoning: true,
				sendSources: false,
			},
		});

		// Stream the response
		const { result, streamId, threadId: tid, uiStreamOptions } = await agent.stream({ threadId, messages });

		// Create UI message stream response with proper options
		const streamOptions: UIMessageStreamOptions<LightfastUIMessage> = {
			...uiStreamOptions,
			generateMessageId: uuidv4,
			onFinish: async ({ messages: finishedMessages, responseMessage, isContinuation }) => {
				// Save the assistant's response to database
				if (responseMessage && responseMessage.role === "assistant") {
					await dbOperations.appendMessages({
						threadId: tid,
						messages: [responseMessage],
					});
				}

				// Call user's onFinish if provided
				if (uiStreamOptions?.onFinish) {
					await uiStreamOptions.onFinish({
						messages: finishedMessages,
						responseMessage,
						isContinuation,
						isAborted: false,
					});
				}
			},
		};

		return result.toUIMessageStreamResponse<LightfastUIMessage>({
			...streamOptions,
			async consumeSseStream({ stream }) {
				// Send the SSE stream into a resumable stream sink
				const streamContext = createResumableStreamContext({ waitUntil: (promise) => promise });
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
	const { agentId, threadId } = await params;

	if (!threadId) {
		return new Response("threadId is required", { status: 400 });
	}

	// Check authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Create properly typed database operations object
	const dbOperations: DatabaseOperations<LightfastUIMessage> = {
		appendMessages,
		createMessages,
		createStream,
		createThread,
		getMessages,
		getThread,
		getThreadStreams,
	};

	// Create agent instance with a011 configuration
	const agent = new Agent<LightfastUIMessage, A011Tools>({
		agentId,
		userId,
		db: dbOperations,
		system: A011_SYSTEM_PROMPT,
		tools: createA011Tools,
		model: gateway("anthropic/claude-4-sonnet"),
		experimental_transform: smoothStream({
			delayInMs: 25,
			chunking: "word",
		}),
		stopWhen: stepCountIs(30),
		_internal: {
			generateId: uuidv4,
		},
	});

	try {
		// Get stream metadata from agent
		await agent.getStreamMetadata(threadId);

		// Get thread streams
		const streamIds = await dbOperations.getThreadStreams(threadId);

		if (!streamIds.length) {
			return new Response(null, { status: 204 });
		}

		const recentStreamId = streamIds[0]; // Redis LPUSH puts newest first

		if (!recentStreamId) {
			return new Response(null, { status: 204 });
		}

		// Resume the stream using resumable-stream context
		const streamContext = createResumableStreamContext({
			waitUntil: (promise) => promise,
		});

		const resumedStream = await streamContext.resumeExistingStream(recentStreamId);

		return new Response(resumedStream);
	} catch (error) {
		if (error instanceof Error && error.message.includes("not found")) {
			return Response.json({ error: "Not found" }, { status: 404 });
		}
		throw error;
	}
}
