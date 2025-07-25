import type { RuntimeContext } from "@lightfast/ai/tools";
import type { ToolSet, UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Agent, DatabaseOperations } from "./agent";

export interface HandlerContext {
	threadId: string;
	resourceId: string;
}

export interface CreateHandlerOptions<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
> {
	createAgent: (context: HandlerContext) => Agent<TMessage, TTools, TRuntimeContext>;
	auth: (request: Request) => Promise<{ resourceId: string } | null>;
	generateId?: () => string;
	enableResume?: boolean; // Optional flag to enable resumable streams
}

/**
 * Creates Next.js API route handlers for an agent
 *
 * @param options.enableResume - When true, creates both GET and POST handlers with resumable stream support.
 *                              When false, only creates POST handler for simple streaming.
 *
 * @example
 * // With resume support (creates GET and POST)
 * export const { GET, POST } = agentHandler({
 *   createAgent: ({ resourceId }) => new Agent({ name: "my-agent", resourceId, ... }),
 *   auth: async () => ({ resourceId: "123" }),
 *   enableResume: true
 * });
 *
 * @example
 * // Without resume support (creates POST only)
 * export const { POST } = agentHandler({
 *   createAgent: ({ resourceId }) => new Agent({ name: "my-agent", resourceId, ... }),
 *   auth: async () => ({ resourceId: "123" }),
 *   enableResume: false
 * });
 */
export function createAgentHandler<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
>(options: CreateHandlerOptions<TMessage, TTools, TRuntimeContext>) {
	const { createAgent, auth, generateId } = options;

	async function POST(request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
		try {
			// Check authentication
			const authResult = await auth(request);
			if (!authResult) {
				return Response.json({ error: "Unauthorized" }, { status: 401 });
			}

			const { threadId } = await params;
			const { messages }: { messages: TMessage[] } = await request.json();

			// Create agent instance with context
			const agent = createAgent({ threadId, resourceId: authResult.resourceId });

			// Stream the response
			const { result, streamId, threadId: tid, uiStreamOptions } = await agent.stream({ threadId, messages });

			// Create UI message stream response with proper options
			const streamOptions: UIMessageStreamOptions<TMessage> = {
				...uiStreamOptions,
				generateMessageId: generateId,
				onFinish: async ({ messages: finishedMessages, responseMessage, isContinuation }) => {
					// Save the assistant's response to database
					if (responseMessage && responseMessage.role === "assistant") {
						const db = agent.getDb();
						await db.appendMessages({
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
			if (options.enableResume) {
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
	}

	// Only create GET handler if resume is enabled
	const GET = options.enableResume
		? async function GET(_request: Request, { params }: { params: Promise<{ agentId: string; threadId: string }> }) {
				const { threadId } = await params;

				if (!threadId) {
					return new Response("threadId is required", { status: 400 });
				}

				// Check authentication
				const authResult = await auth(_request);
				if (!authResult) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				try {
					// Create agent instance with context
					const agent = createAgent({ threadId, resourceId: authResult.resourceId });

					// Get stream metadata from agent
					await agent.getStreamMetadata(threadId);

					// Get thread streams
					const db = agent.getDb();
					const streamIds = await db.getThreadStreams(threadId);

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
		: undefined;

	// Return handlers based on what's enabled
	if (options.enableResume) {
		return { GET, POST };
	} else {
		// TypeScript requires explicit typing when GET might be undefined
		return { POST } as { GET?: typeof GET; POST: typeof POST };
	}
}

/**
 * Higher-order function that adds resumable stream support
 * @deprecated Use enableResume option in createAgentHandler instead
 */
export function resumeHandler<T extends { GET?: Function; POST: Function }>(handlers: T): T {
	// The handlers already include resumable stream support via createResumableStreamContext
	return handlers;
}

/**
 * Convenience function to create handlers with resumable support
 */
export function agentHandler<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
>(options: CreateHandlerOptions<TMessage, TTools, TRuntimeContext>) {
	return resumeHandler(createAgentHandler(options));
}
