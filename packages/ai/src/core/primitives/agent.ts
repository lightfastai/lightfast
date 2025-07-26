import { convertToModelMessages, streamText, type ToolSet, type UIMessage } from "ai";
import type { Memory } from "../memory";
import type { ToolFactory, ToolFactorySet } from "./tool";

// Utility function for generating UUIDs
function uuidv4() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// Extract core types from streamText
type StreamTextParameters<TOOLS extends ToolSet> = Parameters<typeof streamText<TOOLS>>[0];
type LanguageModel = StreamTextParameters<any>["model"];

// Agent-specific configuration with only the properties we need
export interface AgentConfig<TMessage extends UIMessage = UIMessage> {
	// Agent-specific required fields
	name: string;
	model: LanguageModel;
	// Optional common settings
	maxOutputTokens?: number;
	temperature?: number;
	topP?: number;
	maxRetries?: number;
	abortSignal?: AbortSignal;
	headers?: Record<string, string | undefined>;
	// Experimental features
	experimental_transform?: StreamTextParameters<any>["experimental_transform"];
	// Internal config
	_internal?: StreamTextParameters<any>["_internal"];
}

export interface StreamOptions<TMessage extends UIMessage = UIMessage, TRuntimeContext = unknown> {
	threadId: string;
	messages: TMessage[];
	memory: Memory<TMessage>;
	resourceId: string;
	runtimeContext: TRuntimeContext;
}

// Helper type to convert tool factories to actual tools
type ResolveToolFactories<T extends ToolFactorySet<any>> = {
	[K in keyof T]: T[K] extends ToolFactory<any> ? ReturnType<T[K]> : never;
};

export interface AgentOptions<
	TMessage extends UIMessage = UIMessage,
	TRuntimeContext = unknown,
	TToolFactories extends ToolFactorySet<TRuntimeContext> = ToolFactorySet<TRuntimeContext>,
> extends AgentConfig<TMessage> {
	// Required: system prompt for the agent
	system: string;
	// Required: collection of tool factories that will be automatically injected with runtime context
	tools: TToolFactories;
	// Optional: tool choice and stop conditions with proper typing
	toolChoice?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["toolChoice"];
	stopWhen?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["stopWhen"];
	// Strongly typed callbacks based on tools
	onChunk?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onChunk"];
	onFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onFinish"];
	onStepFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onStepFinish"];
}

export class Agent<
	TMessage extends UIMessage = UIMessage,
	TRuntimeContext = unknown,
	TToolFactories extends ToolFactorySet<TRuntimeContext> = ToolFactorySet<TRuntimeContext>,
> {
	public readonly config: AgentConfig<TMessage>;
	private generateId: () => string;
	private toolFactories: TToolFactories;
	private system: string;
	private toolChoice?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["toolChoice"];
	private stopWhen?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["stopWhen"];
	private onChunk?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onChunk"];
	private onFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onFinish"];
	private onStepFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onStepFinish"];

	constructor(options: AgentOptions<TMessage, TRuntimeContext, TToolFactories>) {
		const { system, tools, toolChoice, stopWhen, onChunk, onFinish, onStepFinish, ...config } = options;
		this.toolFactories = tools;
		this.system = system;
		this.generateId = uuidv4;

		// Store configuration
		this.config = {
			...config,
		};

		// Store tool-specific properties separately
		this.toolChoice = toolChoice;
		this.stopWhen = stopWhen;
		this.onChunk = onChunk;
		this.onFinish = onFinish;
		this.onStepFinish = onStepFinish;
	}

	async stream({ threadId, messages, memory, resourceId, runtimeContext }: StreamOptions<TMessage, TRuntimeContext>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		const streamId = this.generateId();

		// Automatically inject runtime context into tool factories
		const tools = Object.fromEntries(
			Object.entries(this.toolFactories).map(([name, factory]) => [name, factory(runtimeContext)]),
		) as ResolveToolFactories<TToolFactories>;

		// Stream the response with properly typed config
		const { name, ...baseConfig } = this.config;

		// Ensure model is set
		if (!baseConfig.model) {
			throw new Error("Model must be configured");
		}

		// Return the stream result with necessary metadata
		return {
			result: streamText<ResolveToolFactories<TToolFactories>>({
				...baseConfig,
				model: baseConfig.model,
				system: this.system,
				_internal: {
					...baseConfig._internal,
					generateId: this.generateId,
				},
				messages: convertToModelMessages(messages, { tools }),
				tools,
				toolChoice: this.toolChoice,
				stopWhen: this.stopWhen,
				onChunk: this.onChunk,
				onFinish: this.onFinish,
				onStepFinish: this.onStepFinish,
			}),
			streamId,
			threadId,
		};
	}
}
