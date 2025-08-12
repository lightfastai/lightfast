import type { UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Memory } from "../memory";
import type { Agent } from "../primitives/agent";
import type { ToolFactorySet } from "../primitives/tool";
import type {
	RequestContext,
	RuntimeContext,
	SystemContext,
} from "./adapters/types";
import {
	type ApiError,
	NoUserMessageError,
	SessionForbiddenError,
	SessionNotFoundError,
	toMemoryApiError,
} from "./errors";
import { Err, Ok, type Result } from "./result";

export interface StreamChatOptions<
	TMessage extends UIMessage = UIMessage,
	TRequestContext = {},
> {
	agent: Agent<any, any>;
	sessionId: string;
	message: TMessage;
	memory: Memory<TMessage>;
	resourceId: string;
	systemContext: SystemContext;
	requestContext: TRequestContext;
	generateId?: () => string;
	enableResume?: boolean;
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
export async function validateSession<TMessage extends UIMessage = UIMessage>(
	memory: Memory<TMessage>,
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
export async function processMessage<TMessage extends UIMessage = UIMessage>(
	memory: Memory<TMessage>,
	sessionId: string,
	message: TMessage,
	resourceId: string,
	sessionExists: boolean,
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
			});
		}

		// Always append the message (works for both new and existing sessions)
		await memory.appendMessage({ sessionId, message });

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
>(
	options: StreamChatOptions<TMessage, TRequestContext>,
): Promise<Result<Response, ApiError>> {
	const {
		agent,
		sessionId,
		message,
		memory,
		resourceId,
		systemContext,
		requestContext,
		generateId,
		enableResume,
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
	);

	if (!processResult.ok) {
		return processResult;
	}

	const { allMessages } = processResult.value;

	// Stream the response
	const {
		result,
		streamId,
		sessionId: sid,
	} = await agent.stream({
		sessionId,
		messages: allMessages,
		memory,
		resourceId,
		systemContext,
		requestContext,
	});

	// Store stream ID for resumption
	try {
		await memory.createStream({ sessionId, streamId });
	} catch (error) {
		// Stream creation errors are not critical, log but continue
		console.warn(
			`Failed to create stream ${streamId} for session ${sessionId}:`,
			error,
		);
		// Note: We don't return an error here as the stream itself is working
	}

	// Create UI message stream response with proper options
	const streamOptions: UIMessageStreamOptions<TMessage> = {
		generateMessageId: generateId,
		sendReasoning: true, // Enable sending reasoning parts to the client
		onFinish: async ({ messages: finishedMessages, responseMessage }) => {
			// Save the assistant's response to memory
			if (responseMessage && responseMessage.role === "assistant") {
				console.log(
					`\n[V1 onFinish] responseMessage:`,
					JSON.stringify(responseMessage, null, 2),
				);
				if (responseMessage.parts) {
					console.log(
						`[V1 onFinish] Parts count: ${responseMessage.parts.length}`,
					);
					responseMessage.parts.forEach((part: any, idx: number) => {
						console.log(
							`  Part ${idx}: type=${part.type}`,
							part.type === "tool-result" ? `state=${part.state}` : "",
						);
					});
				}

				try {
					await memory.appendMessage({
						sessionId: sid,
						message: responseMessage,
					});
				} catch (error) {
					// Log the error but don't break the stream
					console.error(
						`Failed to save assistant message to memory for session ${sid}:`,
						error,
					);
					// Note: We don't throw here as the response has already been streamed to the client
				}
			}
		},
	};

	// Return response with optional resume support
	if (enableResume) {
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
export async function resumeStream<TMessage extends UIMessage = UIMessage>(
	memory: Memory<TMessage>,
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
