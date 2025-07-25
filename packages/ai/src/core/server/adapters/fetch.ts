import type { ToolSet, UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Agent } from "../../primitives/agent";
import type { Memory } from "../../memory";
import type { HandlerContext } from "./types";

export interface FetchRequestHandlerOptions<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext = any,
> {
	agents: Agent<TMessage, TTools, TRuntimeContext>[];
	memory: Memory<TMessage>;
	req: Request;
	params: { agentId: string; threadId: string };
	createContext: () => { resourceId: string };
	generateId?: () => string;
	enableResume?: boolean;
	onError?: (error: { error: Error; path?: string }) => void;
}

/**
 * Handles agent requests following the tRPC pattern
 *
 * @example
 * ```typescript
 * const agents = [
 *   new Agent({
 *     name: "a011",
 *     system: A011_SYSTEM_PROMPT,
 *     tools: createA011Tools,
 *     // ... other config
 *   }),
 *   // ... more agents
 * ];
 *
 * const memory = new RedisMemory({
 *   url: env.KV_REST_API_URL,
 *   token: env.KV_REST_API_TOKEN,
 * });
 *
 * const handler = async (req, { params }) => {
 *   const { userId } = await auth();
 *   if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   return fetchRequestHandler({
 *     agents,
 *     memory,
 *     req,
 *     params: await params,
 *     createContext: () => ({ resourceId: userId }),
 *     onError({ error, path }) {
 *       console.error(`Agent error on '${path}':`, error);
 *     }
 *   });
 * };
 *
 * export { handler as GET, handler as POST };
 * ```
 */
export async function fetchRequestHandler<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext = any,
>(options: FetchRequestHandlerOptions<TMessage, TTools, TRuntimeContext>): Promise<Response> {
	const { agents, memory, req, params, createContext, generateId, enableResume, onError } = options;
	const { threadId } = params;
	const context = createContext();

	// Find the agent by name
	const agent = agents.find(a => a.config.name === params.agentId);
	if (!agent) {
		const error = new Error(`Agent '${params.agentId}' not found`);
		onError?.({ error, path: `${params.agentId}/${params.threadId}` });
		return Response.json({ error: `Agent '${params.agentId}' not found` }, { status: 404 });
	}

	// Check if thread exists and validate ownership
	const existingThread = await memory.getThread(threadId);
	if (existingThread && existingThread.resourceId !== context.resourceId) {
		const error = new Error("Forbidden: Thread belongs to another user");
		onError?.({ error, path: `${params.agentId}/${params.threadId}` });
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	if (req.method === "POST") {
		try {
			const { messages }: { messages: TMessage[] } = await req.json();

			// Get the most recent user message
			const recentUserMessage = messages.filter((message) => message.role === "user").at(-1);
			if (!recentUserMessage) {
				throw new Error("No recent user message found");
			}

			// Create thread if it doesn't exist
			await memory.createThread({
				threadId,
				resourceId: context.resourceId,
				agentId: agent.config.name,
			});

			// Handle messages based on whether thread is new or existing
			let allMessages: TMessage[];

			if (!existingThread) {
				// New thread - create with initial messages
				await memory.createMessages({ threadId, messages });
				allMessages = messages;
			} else {
				// Existing thread - append only the recent user message
				await memory.appendMessages({ threadId, messages: [recentUserMessage] });
				// Fetch all messages from memory for full context
				allMessages = await memory.getMessages(threadId);
			}

			// Stream the response
			const { result, streamId, threadId: tid } = await agent.stream({ 
				threadId, 
				messages: allMessages,
				memory,
				resourceId: context.resourceId
			});

			// Store stream ID for resumption
			await memory.createStream({ threadId, streamId });

			// Create UI message stream response with proper options
			const streamOptions: UIMessageStreamOptions<TMessage> = {
				generateMessageId: generateId,
				onFinish: async ({ messages: finishedMessages, responseMessage }) => {
					// Save the assistant's response to memory
					if (responseMessage && responseMessage.role === "assistant") {
						await memory.appendMessages({
							threadId: tid,
							messages: [responseMessage],
						});
					}
				},
			};

			// Return response with optional resume support
			if (enableResume) {
				return result.toUIMessageStreamResponse<TMessage>({
					...streamOptions,
					async consumeSseStream({ stream }) {
						// Send the SSE stream into a resumable stream sink
						const streamContext = createResumableStreamContext({ waitUntil: (promise) => promise });
						await streamContext.createNewResumableStream(streamId, () => stream);
					},
				});
			} else {
				return result.toUIMessageStreamResponse<TMessage>(streamOptions);
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			onError?.({ error: err, path: `${params.agentId}/${params.threadId}` });
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	} else if (req.method === "GET" && enableResume) {
		if (!threadId) {
			return new Response("threadId is required", { status: 400 });
		}

		try {
			// Check authentication and ownership
			const thread = await memory.getThread(threadId);
			if (!thread || thread.resourceId !== context.resourceId) {
				return Response.json({ error: "Thread not found or unauthorized" }, { status: 404 });
			}

			// Get thread streams
			const streamIds = await memory.getThreadStreams(threadId);

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
			const err = error instanceof Error ? error : new Error(String(error));
			if (err.message.includes("not found")) {
				return Response.json({ error: "Not found" }, { status: 404 });
			}
			onError?.({ error: err, path: `${params.agentId}/${params.threadId}` });
			throw err;
		}
	}

	// Method not allowed
	return new Response("Method not allowed", { status: 405 });
}