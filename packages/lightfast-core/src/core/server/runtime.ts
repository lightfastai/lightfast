import type { UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Memory } from "../memory";
import type { Agent } from "../primitives/agent";
import type { ToolFactorySet } from "../primitives/tool";
import type { RequestContext, RuntimeContext, SystemContext } from "./adapters/types";
import { type ApiError, NoUserMessageError, ThreadForbiddenError, ThreadNotFoundError } from "./errors";
import { Err, Ok, type Result } from "./result";

export interface StreamChatOptions<TMessage extends UIMessage = UIMessage, TRequestContext = {}> {
	agent: Agent<any, any>;
	threadId: string;
	messages: TMessage[];
	memory: Memory<TMessage>;
	resourceId: string;
	systemContext: SystemContext;
	requestContext: TRequestContext;
	generateId?: () => string;
	enableResume?: boolean;
}

export interface ValidatedThread {
	exists: boolean;
	thread?: any;
}

export interface ProcessMessagesResult<TMessage extends UIMessage = UIMessage> {
	allMessages: TMessage[];
	recentUserMessage: TMessage;
}

/**
 * Validates thread ownership and authorization
 */
export async function validateThread<TMessage extends UIMessage = UIMessage>(
	memory: Memory<TMessage>,
	threadId: string,
	resourceId: string,
): Promise<Result<ValidatedThread, ThreadForbiddenError>> {
	const existingThread = await memory.getThread(threadId);

	if (!existingThread) {
		return Ok({ exists: false });
	}

	if (existingThread.resourceId !== resourceId) {
		return Err(new ThreadForbiddenError());
	}

	return Ok({ exists: true, thread: existingThread });
}

/**
 * Processes incoming messages and manages thread state
 */
export async function processMessages<TMessage extends UIMessage = UIMessage>(
	memory: Memory<TMessage>,
	threadId: string,
	messages: TMessage[],
	resourceId: string,
	agentId: string,
	threadExists: boolean,
): Promise<Result<ProcessMessagesResult<TMessage>, NoUserMessageError>> {
	// Get the most recent user message
	const recentUserMessage = messages.filter((message) => message.role === "user").at(-1);
	if (!recentUserMessage) {
		return Err(new NoUserMessageError());
	}

	// Create thread if it doesn't exist
	await memory.createThread({
		threadId,
		resourceId,
		agentId,
	});

	// Handle messages based on whether thread is new or existing
	let allMessages: TMessage[];

	if (!threadExists) {
		// New thread - create with initial messages
		await memory.createMessages({ threadId, messages });
		allMessages = messages;
	} else {
		// Existing thread - append only the recent user message
		await memory.appendMessages({ threadId, messages: [recentUserMessage] });
		// Fetch all messages from memory for full context
		allMessages = await memory.getMessages(threadId);
	}

	return Ok({ allMessages, recentUserMessage });
}

/**
 * Streams a chat response from an agent
 */
export async function streamChat<TMessage extends UIMessage = UIMessage, TRequestContext = {}>(
	options: StreamChatOptions<TMessage, TRequestContext>,
): Promise<Result<Response, ApiError>> {
	const { agent, threadId, messages, memory, resourceId, systemContext, requestContext, generateId, enableResume } =
		options;

	// Validate thread
	const threadValidation = await validateThread(memory, threadId, resourceId);
	if (!threadValidation.ok) {
		return threadValidation;
	}

	// Process messages
	const processResult = await processMessages(
		memory,
		threadId,
		messages,
		resourceId,
		agent.config.name,
		threadValidation.value.exists,
	);

	if (!processResult.ok) {
		return processResult;
	}

	const { allMessages } = processResult.value;

	// Stream the response
	const {
		result,
		streamId,
		threadId: tid,
	} = await agent.stream({
		threadId,
		messages: allMessages,
		memory,
		resourceId,
		systemContext,
		requestContext,
	});

	// Store stream ID for resumption
	await memory.createStream({ threadId, streamId });

	// Create UI message stream response with proper options
	const streamOptions: UIMessageStreamOptions<TMessage> = {
		generateMessageId: generateId,
		sendReasoning: true, // Enable sending reasoning parts to the client
		headers: {
			'Content-Encoding': 'none', // Prevent proxy buffering for streaming
		},
		onFinish: async ({ messages: finishedMessages, responseMessage }) => {
			// Save the assistant's response to memory
			if (responseMessage && responseMessage.role === "assistant") {
				console.log(`\n[V1 onFinish] responseMessage:`, JSON.stringify(responseMessage, null, 2));
				if (responseMessage.parts) {
					console.log(`[V1 onFinish] Parts count: ${responseMessage.parts.length}`);
					responseMessage.parts.forEach((part: any, idx: number) => {
						console.log(`  Part ${idx}: type=${part.type}`, part.type === "tool-result" ? `state=${part.state}` : "");
					});
				}
				await memory.appendMessages({
					threadId: tid,
					messages: [responseMessage],
				});
			}
		},
	};

	// Return response with optional resume support
	if (enableResume) {
		return Ok(
			result.toUIMessageStreamResponse<TMessage>({
				...streamOptions,
				async consumeSseStream({ stream }) {
					// Send the SSE stream into a resumable stream sink
					const streamContext = createResumableStreamContext({ waitUntil: (promise) => promise });
					await streamContext.createNewResumableStream(streamId, () => stream);
				},
			}),
		);
	} else {
		return Ok(result.toUIMessageStreamResponse<TMessage>(streamOptions));
	}
}

/**
 * Resumes an existing stream
 */
export async function resumeStream<TMessage extends UIMessage = UIMessage>(
	memory: Memory<TMessage>,
	threadId: string,
	resourceId: string,
): Promise<Result<ReadableStream | null, ThreadNotFoundError>> {
	// Check authentication and ownership
	const thread = await memory.getThread(threadId);
	if (!thread || thread.resourceId !== resourceId) {
		return Err(new ThreadNotFoundError());
	}

	// Get thread streams
	const streamIds = await memory.getThreadStreams(threadId);

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

	const resumedStream = await streamContext.resumeExistingStream(recentStreamId);
	return Ok(resumedStream ?? null);
}
