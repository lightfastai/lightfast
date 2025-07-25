import type { RuntimeContext } from "@lightfast/ai/tools";
import type { ToolSet, UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Agent } from "./agent";

export interface HandlerContext {
	threadId: string;
	resourceId: string;
}

export interface AgentHandlerContext {
	resourceId: string;
}

export interface AgentHandlerOptions<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
> {
	createAgent: (context: HandlerContext) => Agent<TMessage, TTools, TRuntimeContext>;
	generateId?: () => string;
	enableResume?: boolean;
}

export interface AgentHandlerParams {
	req: Request;
	params: { agentId: string; threadId: string };
	createContext: () => AgentHandlerContext;
}

/**
 * Creates an agent handler function that can be called from route handlers
 *
 * @example
 * ```typescript
 * const agentHandler = createAgentHandler({
 *   createAgent: ({ resourceId, threadId }) => new Agent({ ... }),
 *   generateId: uuidv4,
 *   enableResume: true
 * });
 *
 * const handler = async (req, { params }) => {
 *   const { userId } = await auth();
 *   if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   return agentHandler({
 *     req,
 *     params: await params,
 *     createContext: () => ({ resourceId: userId })
 *   });
 * };
 *
 * export { handler as GET, handler as POST };
 * ```
 */
export function createAgentHandler<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
>(options: AgentHandlerOptions<TMessage, TTools, TRuntimeContext>) {
	const { createAgent, generateId, enableResume } = options;

	return async ({ req, params, createContext }: AgentHandlerParams): Promise<Response> => {
		const { threadId } = params;
		const context = createContext();

		if (req.method === "POST") {
			try {
				const { messages }: { messages: TMessage[] } = await req.json();

				// Create agent instance with context
				const agent = createAgent({ threadId, resourceId: context.resourceId });

				// Stream the response
				const { result, streamId, threadId: tid, uiStreamOptions } = await agent.stream({ threadId, messages });

				// Create UI message stream response with proper options
				const streamOptions: UIMessageStreamOptions<TMessage> = {
					...uiStreamOptions,
					generateMessageId: generateId,
					onFinish: async ({ messages: finishedMessages, responseMessage, isContinuation }) => {
						// Save the assistant's response to memory
						if (responseMessage && responseMessage.role === "assistant") {
							const memory = agent.getMemory();
							await memory.appendMessages({
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
				console.error("Error in POST handler:", error);
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
				// Create agent instance with context
				const agent = createAgent({ threadId, resourceId: context.resourceId });

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
				if (error instanceof Error && error.message.includes("not found")) {
					return Response.json({ error: "Not found" }, { status: 404 });
				}
				throw error;
			}
		}

		// Method not allowed
		return new Response("Method not allowed", { status: 405 });
	};
}
