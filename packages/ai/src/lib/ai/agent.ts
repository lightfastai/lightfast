import type { RuntimeContext } from "@lightfast/ai/tools";
import { convertToModelMessages, streamText, type ToolSet, type UIMessage } from "ai";
import type { Memory } from "./memory";

// Utility function for generating UUIDs
function uuidv4() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// Extract streamText configuration type
type StreamTextConfig = Parameters<typeof streamText>[0];

// Agent-specific configuration that extends streamText config
export interface AgentConfig<TMessage extends UIMessage = UIMessage>
	extends Omit<StreamTextConfig, "messages" | "tools" | "model"> {
	// Agent-specific required fields
	name: string;
	resourceId: string;
	memory: Memory<TMessage>;

	// Optional streamText configuration (defaults provided in constructor)
	model?: StreamTextConfig["model"];
}

export interface StreamOptions<TMessage = any> {
	threadId: string;
	messages: TMessage[];
}

export interface AgentOptions<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
> extends AgentConfig<TMessage> {
	// Required: system prompt for the agent
	system: string;
	// Required: function that creates tools with runtime context
	tools: (context: TRuntimeContext) => TTools;
}

export class Agent<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext extends RuntimeContext = RuntimeContext,
> {
	public readonly config: AgentConfig<TMessage>;
	private memory: Memory<TMessage>;
	private generateId: () => string;
	private createTools: (context: TRuntimeContext) => TTools;
	private system: string;

	constructor(options: AgentOptions<TMessage, TTools, TRuntimeContext>) {
		const { system, tools, ...config } = options;
		this.memory = config.memory;
		this.createTools = tools;
		this.system = system;
		this.generateId = uuidv4;

		// Store configuration with system prompt
		this.config = {
			...config,
			system: this.system,
		};
	}

	async stream({ threadId, messages }: StreamOptions<TMessage>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		// Check if thread exists and validate ownership
		const existingThread = await this.memory.getThread(threadId);
		if (existingThread && existingThread.resourceId !== this.config.resourceId) {
			throw new Error("Forbidden: Thread belongs to another user");
		}

		const streamId = this.generateId();

		// Get the most recent user message
		const recentUserMessage = messages.filter((message) => message.role === "user").at(-1);

		if (!recentUserMessage) {
			throw new Error("No recent user message found");
		}

		// Create thread if it doesn't exist
		await this.memory.createThread({
			threadId,
			resourceId: this.config.resourceId,
			agentId: this.config.name, // Using name as agentId for database compatibility
		});

		// Handle messages based on whether thread is new or existing
		let allMessages: TMessage[];

		if (!existingThread) {
			// New thread - create with initial messages
			await this.memory.createMessages({ threadId, messages });
			allMessages = messages;
		} else {
			// Existing thread - append only the recent user message
			await this.memory.appendMessages({ threadId, messages: [recentUserMessage] });
			// Fetch all messages from memory for full context
			allMessages = await this.memory.getMessages(threadId);
		}

		// Store stream ID for resumption
		await this.memory.createStream({ threadId, streamId });

		// Create runtime context and tools for this specific request
		const runtimeContext = { threadId } as TRuntimeContext;
		const tools = this.createTools(runtimeContext);

		// Stream the response with properly typed config
		const { memory, name, resourceId, ...streamTextConfig } = this.config;

		// Ensure model is set
		if (!streamTextConfig.model) {
			throw new Error("Model must be configured");
		}

		// Return the stream result with necessary metadata
		return {
			result: streamText({
				...streamTextConfig,
				model: streamTextConfig.model,
				_internal: {
					...streamTextConfig._internal,
					generateId: this.generateId,
				},
				messages: convertToModelMessages(allMessages, { tools }),
				tools,
			}),
			streamId,
			threadId,
		};
	}

	async getStreamMetadata(threadId: string) {
		// Check authentication and ownership
		const thread = await this.memory.getThread(threadId);
		if (!thread || thread.resourceId !== this.config.resourceId) {
			throw new Error("Thread not found or unauthorized");
		}

		return {
			memory: this.memory,
			generateId: this.generateId,
		};
	}

	getMemory(): Memory<TMessage> {
		return this.memory;
	}
}
