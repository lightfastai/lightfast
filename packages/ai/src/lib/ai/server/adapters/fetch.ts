import type { RuntimeContext } from "@lightfast/ai/tools";
import type { ToolSet, UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Agent } from "../../agent";
import type { HandlerContext } from "./types";

export interface FetchRequestHandlerOptions<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
> {
	agent: Agent<TMessage, TTools, TRuntimeContext>;
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
 * const agent = new Agent({
 *   name: "a011",
 *   resourceId,
 *   memory,
 *   system: A011_SYSTEM_PROMPT,
 *   tools: createA011Tools,
 *   // ... other config
 * });
 *
 * const handler = async (req, { params }) => {
 *   const { userId } = await auth();
 *   if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   return fetchRequestHandler({
 *     agent,
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
	TRuntimeContext extends RuntimeContext = RuntimeContext,
>(options: FetchRequestHandlerOptions<TMessage, TTools, TRuntimeContext>): Promise<Response> {
	const { agent, req, params, createContext, generateId, enableResume, onError } = options;
	const { threadId } = params;
	const context = createContext();

	// Verify agent resourceId matches context resourceId
	if (agent.config.resourceId !== context.resourceId) {
		const error = new Error("Agent resourceId does not match context resourceId");
		onError?.({ error, path: `${params.agentId}/${params.threadId}` });
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	if (req.method === "POST") {
		try {
			const { messages }: { messages: TMessage[] } = await req.json();

			// Stream the response
			const { result, streamId, threadId: tid } = await agent.stream({ threadId, messages });

			// Create UI message stream response with proper options
			const streamOptions: UIMessageStreamOptions<TMessage> = {
				generateMessageId: generateId,
				onFinish: async ({ messages: finishedMessages, responseMessage }) => {
					// Save the assistant's response to memory
					if (responseMessage && responseMessage.role === "assistant") {
						const memory = agent.getMemory();
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
			// Get stream metadata from agent
			await agent.getStreamMetadata(threadId);

			// Get thread streams
			const memory = agent.getMemory();
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