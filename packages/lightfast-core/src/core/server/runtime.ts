import type { UIMessage, UIMessageStreamOptions, ToolSet } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Memory } from "../memory";
import type { Agent } from "../primitives/agent";
import type { ToolFactorySet } from "../primitives/tool";
import type {
	RequestContext,
	SystemContext,
} from "./adapters/types";
import {
	NoUserMessageError,
	SessionForbiddenError,
	SessionNotFoundError,
	toAgentApiError,
	toMemoryApiError
} from "./errors";
import type {ApiError} from "./errors";
import { Err, Ok  } from "./result";
import type {Result} from "./result";
import type { 
	LifecycleCallbacks,
	ErrorLifecycleEvent,
	StreamStartEvent,
	StreamCompleteEvent,
	AgentStartEvent,
	AgentCompleteEvent
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
> extends LifecycleCallbacks {
	agent: Agent<ToolSet | ToolFactorySet<unknown>, unknown>;
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
	session?: any;
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
	TMessage extends UIMessage = UIMessage,
	TRequestContext = {},
	TFetchContext = {},
>(
	options: StreamChatOptions<TMessage, TRequestContext, TFetchContext>,
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
	const agentName = 'config' in agent && agent.config?.name ? agent.config.name : 'unknown';
	onAgentStart?.({
		systemContext,
		requestContext: requestContext as RequestContext | undefined,
		agentName,
		messageCount: allMessages.length,
	});

	// Stream the response
	let streamResult: Awaited<ReturnType<typeof agent.stream>>;
	try {
		streamResult = await agent.stream({
			sessionId,
			messages: allMessages,
			memory,
			resourceId,
			systemContext,
			requestContext,
		});
	} catch (error) {
		// Convert agent errors to appropriate API errors
		return Err(toAgentApiError(error, "stream"));
	}

	const { result, streamId, sessionId: sid } = streamResult;

	// Call onStreamStart lifecycle callback
	onStreamStart?.({
		systemContext,
		requestContext: requestContext as RequestContext | undefined,
		streamId,
		agentName,
		messageCount: allMessages.length,
	});

	// Store stream ID for resumption (only if resume is enabled)
	const shouldEnableResume = enableResume || resumeOptions?.enabled;
	
	if (shouldEnableResume) {
		try {
			await memory.createStream({ sessionId, streamId, context });
		} catch (error) {
			const apiError = toMemoryApiError(error, "createStream");
			
			// Check guard: failOnStreamError FIRST (highest priority)
			if (resumeOptions?.failOnStreamError) {
				// Fail fast mode: log and return error immediately
				console.warn(
					`[Fail Fast] Stream creation failed, stopping operation for session ${sessionId}:`,
					{
						error: apiError.message,
						statusCode: apiError.statusCode,
						errorCode: apiError.errorCode,
						originalError: error,
					},
				);
				return Err(apiError);
			}
			
			// Check guard: silentStreamFailure
			if (resumeOptions?.silentStreamFailure) {
				// Silent mode: only log, don't call onError
				console.warn(
					`[Silent Mode] Failed to create stream ${streamId} for session ${sessionId}:`,
					{
						error: apiError.message,
						statusCode: apiError.statusCode,
						errorCode: apiError.errorCode,
						originalError: error,
					},
				);
			} else {
				// Normal mode: log and propagate via onError
				console.warn(
					`Failed to create stream ${streamId} for session ${sessionId}:`,
					{
						error: apiError.message,
						statusCode: apiError.statusCode,
						errorCode: apiError.errorCode,
						originalError: error,
					},
				);
				
				// Propagate stream creation failure to route for monitoring
				onError?.({ 
					systemContext,
					requestContext: requestContext as RequestContext | undefined,
					error: apiError,
				});
			}
			
			// Default: Continue streaming despite error
		}
	}

	// Create UI message stream response with proper options
	const streamOptions: UIMessageStreamOptions<TMessage> = {
		generateMessageId: generateId,
		sendReasoning: true, // Enable sending reasoning parts to the client
		onFinish: async (result) => {
			const agentEndTime = Date.now();
			const agentDuration = agentEndTime - agentStartTime;
			
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
			if (result.responseMessage && result.responseMessage.role === "assistant") {
				console.log(
					`\n[V1 onFinish] responseMessage:`,
					JSON.stringify(result.responseMessage, null, 2),
				);
				if (result.responseMessage.parts) {
					console.log(
						`[V1 onFinish] Parts count: ${result.responseMessage.parts.length}`,
					);
					result.responseMessage.parts.forEach((part: any, idx: number) => {
						console.log(
							`  Part ${idx}: type=${part.type}`,
							part.type === "tool-result" ? `state=${part.state}` : "",
						);
					});
				}

				try {
					await memory.appendMessage({
						sessionId: sid,
						message: result.responseMessage,
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
		},
	};

	// Return response with optional resume support
	if (shouldEnableResume) {
		return Ok(
			result.toUIMessageStreamResponse<TMessage>({
				...streamOptions,
				headers: {
					"Content-Encoding": "none", // Prevent proxy buffering for streaming
				},
				async consumeSseStream({ stream }) {
					// Send the SSE stream into a resumable stream sink
					const streamContext = createResumableStreamContext({
						waitUntil: (promise) => promise,
					});
					await streamContext.createNewResumableStream(streamId, () => stream);
				},
			}),
		);
	} else {
		return Ok(
			result.toUIMessageStreamResponse<TMessage>({
				...streamOptions,
				headers: {
					"Content-Encoding": "none", // Prevent proxy buffering for streaming
				},
			}),
		);
	}
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
): Promise<Result<ReadableStream | null, ApiError>> {
	try {
		// Check authentication and ownership
		const session = await memory.getSession(sessionId);
		if (!session || session.resourceId !== resourceId) {
			return Err(new SessionNotFoundError());
		}

		// Get session streams
		const streamIds = await memory.getSessionStreams(sessionId);

		if (!streamIds.length) {
			return Ok(null);
		}

		const recentStreamId = streamIds[0]; // Redis LPUSH puts newest first

		if (!recentStreamId) {
			return Ok(null);
		}

		// Resume the stream using resumable-stream context
		const streamContext = createResumableStreamContext({
			waitUntil: (promise) => promise,
		});

		const resumedStream =
			await streamContext.resumeExistingStream(recentStreamId);
		return Ok(resumedStream ?? null);
	} catch (error) {
		// Convert memory errors to appropriate API errors
		return Err(toMemoryApiError(error, "resumeStream"));
	}
}
