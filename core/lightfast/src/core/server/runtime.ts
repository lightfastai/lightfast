import type { UIMessage, UIMessageStreamOptions, ToolSet, UIMessageStreamWriter, UIMessagePart, UIDataTypes, UITools } from "ai";
import { streamText, createUIMessageStream, JsonToSseTransformStream } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import { v4 as uuidv4 } from "uuid";
import type { Memory } from "../memory";
import type { Agent } from "../primitives/agent";
import type { ToolFactorySet } from "../primitives/tool";
import type { RequestContext, SystemContext, RuntimeContext } from "./adapters/types";
import {
	NoUserMessageError,
	SessionForbiddenError,
	SessionNotFoundError,
	toAgentApiError,
	toMemoryApiError,
} from "./errors";
import type { ApiError } from "./errors";
import { Err, Ok } from "./result";
import type { Result } from "./result";
import type {
	LifecycleCallbacks,
	ErrorLifecycleEvent,
	StreamStartEvent,
	StreamCompleteEvent,
	AgentStartEvent,
	AgentCompleteEvent,
} from "./lifecycle";

export interface ResumeOptions {
	/** Enable resume capability for streaming */
	enabled: boolean;
	/**
	 * Guard: Continue streaming even if stream creation fails
	 * @default false - Stream creation failure will propagate via onError
	 * @description When true, stream creation failures are logged but don't interrupt the stream
	 */
	silentStreamFailure?: boolean;
	/**
	 * Guard: Fail fast on stream creation errors
	 * @default false - Continue streaming on error
	 * @description When true, stream creation failure will stop the entire streaming operation
	 */
	failOnStreamError?: boolean;
}

export interface StreamChatOptions<
	TMessage extends UIMessage = UIMessage,
	TRequestContext = {},
	TFetchContext = {},
	TRuntimeContext = {},
	TTools extends ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
> extends LifecycleCallbacks {
	agent: Agent<TRuntimeContext, TTools>;
	sessionId: string;
	message: TMessage;
	memory: Memory<TMessage, TFetchContext>;
	resourceId: string;
	systemContext: SystemContext;
	requestContext: TRequestContext;
	context?: TFetchContext;
	generateId?: () => string;
	enableResume?: boolean;
	resumeOptions?: ResumeOptions;
}

export interface ValidatedSession {
	exists: boolean;
	session?: { resourceId: string };
}

export interface ProcessMessagesResult<TMessage extends UIMessage = UIMessage> {
	allMessages: TMessage[];
	recentUserMessage: TMessage;
}

/**
 * Validates session ownership and authorization
 */
export async function validateSession<
	TMessage extends UIMessage = UIMessage,
	TFetchContext = {},
>(
	memory: Memory<TMessage, TFetchContext>,
	sessionId: string,
	resourceId: string,
): Promise<Result<ValidatedSession, ApiError>> {
	try {
		const existingSession = await memory.getSession(sessionId);

		if (!existingSession) {
			return Ok({ exists: false });
		}

		if (existingSession.resourceId !== resourceId) {
			return Err(new SessionForbiddenError());
		}

		return Ok({ exists: true, session: existingSession });
	} catch (error) {
		// Convert memory errors to appropriate API errors
		return Err(toMemoryApiError(error, "getSession"));
	}
}

/**
 * Processes incoming message and manages session state
 */
export async function processMessage<
	TMessage extends UIMessage = UIMessage,
	TFetchContext = {},
>(
	memory: Memory<TMessage, TFetchContext>,
	sessionId: string,
	message: TMessage,
	resourceId: string,
	sessionExists: boolean,
	context?: TFetchContext,
): Promise<Result<ProcessMessagesResult<TMessage>, ApiError>> {
	// Validate it's a user message
	if (message.role !== "user") {
		return Err(new NoUserMessageError());
	}

	try {
		// Create session if it doesn't exist
		if (!sessionExists) {
			await memory.createSession({
				sessionId,
				resourceId,
				context,
			});
		}

		// Always append the message (works for both new and existing sessions)
		await memory.appendMessage({ sessionId, message, context });

		// Fetch all messages from memory for full context
		const allMessages = await memory.getMessages(sessionId);

		return Ok({ allMessages, recentUserMessage: message });
	} catch (error) {
		// Convert memory errors to appropriate API errors
		// The specific operation will be inferred from the error message
		return Err(toMemoryApiError(error, "processMessage"));
	}
}

/**
 * Streams a chat response from an agent
 */
export async function streamChat<
	TMessage extends UIMessage<unknown, UIDataTypes, UITools> = UIMessage<unknown, UIDataTypes, UITools>,
	TRequestContext = {},
	TFetchContext = {},
	TRuntimeContext = {},
	TTools extends ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
>(
	options: StreamChatOptions<TMessage, TRequestContext, TFetchContext, TRuntimeContext, TTools>,
): Promise<Result<Response, ApiError>> {
	const {
		agent,
		sessionId,
		message,
		memory,
		resourceId,
		systemContext,
		requestContext,
		context,
		generateId,
		enableResume,
		resumeOptions,
		onError,
		onStreamStart,
		onStreamComplete,
		onAgentStart,
		onAgentComplete,
	} = options;

	// Validate session
	const sessionValidation = await validateSession(
		memory,
		sessionId,
		resourceId,
	);
	if (!sessionValidation.ok) {
		return sessionValidation;
	}

	// Process the single message
	const processResult = await processMessage(
		memory,
		sessionId,
		message,
		resourceId,
		sessionValidation.value.exists,
		context,
	);

	if (!processResult.ok) {
		return processResult;
	}

	const { allMessages } = processResult.value;

	// Call onAgentStart lifecycle callback
	const agentStartTime = Date.now();
	const agentName =
		"config" in agent && agent.config?.name ? agent.config.name : "unknown";
	onAgentStart?.({
		systemContext,
		requestContext: requestContext as RequestContext | undefined,
		agentName,
		messageCount: allMessages.length,
	});

	// Use the same sessionId
	const sid = sessionId;
	const streamId = generateId ? generateId() : uuidv4();
	const shouldEnableResume = enableResume || resumeOptions?.enabled;

	// Call onStreamStart lifecycle callback
	onStreamStart?.({
		systemContext,
		requestContext: requestContext as RequestContext | undefined,
		streamId,
		agentName,
		messageCount: allMessages.length,
	});

	// Build stream parameters with dataStream injection
	let streamParams;
	try {
		streamParams = agent.buildStreamParams({
			sessionId,
			messages: allMessages,
			memory,
			resourceId,
			systemContext,
			requestContext,
		});
	} catch (error) {
		return Err(toAgentApiError(error, "buildStreamParams"));
	}

	// Start streaming
	let result;
	try {
		result = streamText(streamParams);
	} catch (error) {
		return Err(toAgentApiError(error, "streamText"));
	}

	// Use AI SDK v5 pattern with resumable streams
	const response = result.toUIMessageStreamResponse({
		generateMessageId: generateId,
		sendReasoning: true,
		originalMessages: allMessages,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			"Content-Encoding": "none", // Prevent proxy buffering for streaming
		},
		onFinish: async (finishResult) => {
			const agentEndTime = Date.now();

			// Call onAgentComplete lifecycle callback
			onAgentComplete?.({
				systemContext,
				requestContext: requestContext as RequestContext | undefined,
				agentName,
			});

			// Call onStreamComplete lifecycle callback
			onStreamComplete?.({
				systemContext,
				requestContext: requestContext as RequestContext | undefined,
				streamId,
				agentName,
			});

			// Save the assistant's response to memory
			if (
				finishResult.responseMessage &&
				finishResult.responseMessage.role === "assistant"
			) {
				console.log(
					`\n[V1 onFinish] responseMessage:`,
					JSON.stringify(finishResult.responseMessage, null, 2),
				);
				if (finishResult.responseMessage.parts) {
					console.log(
						`[V1 onFinish] Parts count: ${finishResult.responseMessage.parts.length}`,
					);
					finishResult.responseMessage.parts.forEach(
						(part: UIMessagePart<UIDataTypes, UITools>, idx: number) => {
							console.log(
								`  Part ${idx}: type=${part.type}`,
								part.type === "tool-result" ? `state=${(part as any).state}` : "",
							);
						},
					);
				}

				try {
					// In AI SDK streaming context, we work with concrete UIMessage types
					// Cast memory interface to accept the concrete type returned by AI SDK
					await (memory as Memory<UIMessage<unknown, UIDataTypes, UITools>, TFetchContext>).appendMessage({
						sessionId: sid,
						message: finishResult.responseMessage,
						context,
					});
				} catch (error) {
					// Convert to proper API error for consistent error handling
					const apiError = toMemoryApiError(error, "appendMessage");
					console.error(
						`Failed to save assistant message to memory for session ${sid}:`,
						{
							error: apiError.message,
							statusCode: apiError.statusCode,
							errorCode: apiError.errorCode,
							originalError: error,
						},
					);

					// Call onError callback to propagate memory failure to route
					onError?.({
						systemContext,
						requestContext: requestContext as RequestContext | undefined,
						error: apiError,
					});

					// Note: We don't throw here as the response has already been streamed to the client
					// but we propagate the error via callback for route handling
				}
			}

			// Clear active stream ID when streaming completes
			if (shouldEnableResume && memory.clearActiveStream) {
				try {
					await memory.clearActiveStream(sessionId);
					console.log(`[Stream Complete] Cleared active stream ID for session ${sessionId}`);
				} catch (error) {
					console.warn(`[Stream Complete] Failed to clear active stream ID for session ${sessionId}:`, error);
					// Don't throw - this is cleanup, not critical
				}
			}
		},
		// Create resumable stream if resume is enabled
		...(shouldEnableResume && {
			async consumeSseStream({ stream }) {
				try {
					const streamContext = createResumableStreamContext({
						waitUntil: (promise) => promise,
					});
					
					// Create the resumable stream with our streamId
					await streamContext.createNewResumableStream(streamId, () => stream);
					
					// Store the active stream ID in memory
					await memory.createStream({ sessionId, streamId, context });
					
					console.log(`[Stream Created] Created resumable stream ${streamId} for session ${sessionId}`);
				} catch (error) {
					const apiError = toMemoryApiError(error, "createStream");
					
					// Handle stream creation failure based on options
					if (resumeOptions?.failOnStreamError) {
						console.error(`[Fail Fast] Stream creation failed for session ${sessionId}:`, error);
						throw error;
					} else if (resumeOptions?.silentStreamFailure) {
						console.warn(`[Silent Mode] Failed to create stream ${streamId} for session ${sessionId}:`, error);
					} else {
						console.warn(`Failed to create stream ${streamId} for session ${sessionId}:`, error);
						onError?.({
							systemContext,
							requestContext: requestContext as RequestContext | undefined,
							error: apiError,
						});
					}
				}
			}
		}),
	});

	// Return the AI SDK response directly (already includes proper headers and streaming)
	return Ok(response);
}

/**
 * Resumes an existing stream
 */
export async function resumeStream<
	TMessage extends UIMessage = UIMessage,
	TFetchContext = {},
>(
	memory: Memory<TMessage, TFetchContext>,
	sessionId: string,
	resourceId: string,
): Promise<Result<Response | null, ApiError>> {
	try {
		// Check authentication and ownership
		const session = await memory.getSession(sessionId);
		console.log("[Resume Stream] Found session", session);
		if (!session || session.resourceId !== resourceId) {
			return Err(new SessionNotFoundError());
		}

		// Get active stream ID (new pattern) or fallback to session streams (old pattern)
		let recentStreamId: string | null = null;
		
		if (memory.getActiveStream) {
			// New pattern: get single active stream ID
			recentStreamId = await memory.getActiveStream(sessionId);
			console.log("[Resume Stream] Active stream ID:", recentStreamId);
		} else {
			// Fallback to old pattern: get stream list and take first
			const streamIds = await memory.getSessionStreams(sessionId);
			console.log("[Resume Stream] Stream IDs (legacy):", streamIds);
			recentStreamId = streamIds.length > 0 ? (streamIds[0] ?? null) : null;
		}

		if (!recentStreamId) {
			return Ok(null);
		}

		// Resume the stream using resumable-stream context
		const streamContext = createResumableStreamContext({
			waitUntil: (promise) => promise,
		});

		const resumedStream =
			await streamContext.resumeExistingStream(recentStreamId);
		
		if (!resumedStream) {
			return Ok(null);
		}

		// Return the stream as a proper Response with headers
		return Ok(new Response(resumedStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
				"Content-Encoding": "none",
			},
		}));
	} catch (error) {
		console.error("[Resume Stream]", error);
		// Convert memory errors to appropriate API errors
		return Err(toMemoryApiError(error, "resumeStream"));
	}
}
