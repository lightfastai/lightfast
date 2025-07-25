import { convertToModelMessages, streamText, type ToolSet, type UIMessage } from "ai";
import type { Memory } from "../memory";

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

	// Optional streamText configuration (defaults provided in constructor)
	model?: StreamTextConfig["model"];
}

export interface StreamOptions<TMessage extends UIMessage = UIMessage> {
	threadId: string;
	messages: TMessage[];
	memory: Memory<TMessage>;
	resourceId: string;
}

export interface AgentOptions<
	TMessage extends UIMessage = UIMessage,
	TTools extends ToolSet = ToolSet,
	TRuntimeContext = any,
> extends AgentConfig<TMessage> {
	// Required: system prompt for the agent
	system: string;
	// Required: function that creates tools with runtime context
	tools: (context: TRuntimeContext) => TTools;
}

export class Agent<TMessage extends UIMessage = UIMessage, TTools extends ToolSet = ToolSet, TRuntimeContext = any> {
	public readonly config: AgentConfig<TMessage>;
	private generateId: () => string;
	private createTools: (context: TRuntimeContext) => TTools;
	private system: string;

	constructor(options: AgentOptions<TMessage, TTools, TRuntimeContext>) {
		const { system, tools, ...config } = options;
		this.createTools = tools;
		this.system = system;
		this.generateId = uuidv4;

		// Store configuration with system prompt
		this.config = {
			...config,
			system: this.system,
		};
	}

	async stream({ threadId, messages, memory, resourceId }: StreamOptions<TMessage>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		const streamId = this.generateId();

		// Create runtime context and tools for this specific request
		const runtimeContext = { threadId } as TRuntimeContext;
		const tools = this.createTools(runtimeContext);

		// Stream the response with properly typed config
		const { name, ...streamTextConfig } = this.config;

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
				messages: convertToModelMessages(messages, { tools }),
				tools,
			}),
			streamId,
			threadId,
		};
	}
}
