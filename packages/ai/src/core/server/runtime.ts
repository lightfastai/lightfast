import type { UIMessage, UIMessageStreamOptions } from "ai";
import { createResumableStreamContext } from "resumable-stream";
import type { Memory } from "../memory";
import type { Agent } from "../primitives/agent";
import type { ToolFactorySet } from "../primitives/tool";
import type { RuntimeContext } from "./adapters/types";
import {
	AgentNotFoundError,
	type ApiError,
	NoUserMessageError,
	ThreadForbiddenError,
	ThreadNotFoundError,
} from "./errors";
import { Err, Ok, type Result } from "./result";

export interface StreamChatOptions<TMessage extends UIMessage = UIMessage, TUserContext = {}> {
	agent: Agent<TMessage, TUserContext, ToolFactorySet<TUserContext>>;
	threadId: string;
	messages: TMessage[];
	memory: Memory<TMessage>;
	resourceId: string;
	createRuntimeContext: (params: { threadId: string; resourceId: string }) => TUserContext;
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
export async function streamChat<TMessage extends UIMessage = UIMessage, TUserContext = {}>(
	options: StreamChatOptions<TMessage, TUserContext>,
): Promise<Result<Response, ApiError>> {
	const { agent, threadId, messages, memory, resourceId, createRuntimeContext, generateId, enableResume } = options;

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

	// Create runtime context for this request
	const userContext = createRuntimeContext({
		threadId,
		resourceId,
	});

	// Merge system and user contexts
	const runtimeContext: RuntimeContext<TUserContext> = {
		threadId,
		resourceId,
		...userContext,
	};

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
		runtimeContext,
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

/**
 * Finds an agent by name from a list of agents
 */
export function findAgent<TAgents extends readonly Agent<UIMessage, unknown, ToolFactorySet<unknown>>[]>(
	agents: TAgents,
	agentId: string,
): Result<TAgents[number], AgentNotFoundError> {
	const agent = agents.find((a) => a.config.name === agentId);

	if (!agent) {
		return Err(new AgentNotFoundError(agentId));
	}

	return Ok(agent);
}
