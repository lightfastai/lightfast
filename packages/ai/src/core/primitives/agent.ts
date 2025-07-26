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

// Properties we need to handle specially or exclude
type ExcludedStreamTextProps =
	| "messages" // We get this from stream() method
	| "tools" // We use tool factories
	| "system" // We store separately
	| "prompt" // We use messages instead
	| "toolChoice" // Needs generic typing
	| "stopWhen" // Needs generic typing
	| "onChunk" // Needs generic typing
	| "onFinish" // Needs generic typing
	| "onStepFinish" // Needs generic typing
	| "onAbort" // Needs generic typing
	| "onError" // Needs generic typing
	| "_internal" // We don't use this
	| "prepareStep" // Needs generic typing
	| "experimental_transform"; // Needs generic typing

// Agent-specific configuration extending streamText parameters
export interface AgentConfig<TMessage extends UIMessage = UIMessage>
	extends Omit<StreamTextParameters<ToolSet>, ExcludedStreamTextProps> {
	// Agent-specific required fields
	name: string;
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

// Helper type to extract tool factories from an Agent
export type ExtractAgentToolFactories<TAgent> = TAgent extends Agent<infer TToolFactories> ? TToolFactories : never;

// Helper type to extract resolved tools from an Agent
export type ExtractAgentTools<TAgent> = TAgent extends Agent<infer TToolFactories>
	? ResolveToolFactories<TToolFactories>
	: never;

// Helper type to merge tool sets from multiple agents
export type MergeToolSets<TAgents extends readonly Agent<any>[]> = TAgents extends readonly [infer First, ...infer Rest]
	? First extends Agent<any>
		? Rest extends readonly Agent<any>[]
			? ExtractAgentTools<First> & MergeToolSets<Rest>
			: ExtractAgentTools<First>
		: never
	: {};

// Helper type to create UIMessage type from agents array
export type DerivedUIMessage<
	TAgents extends readonly Agent<any>[],
	TMetadata = {},
	TCustomDataTypes extends Record<string, unknown> = {},
> = UIMessage<TMetadata, TCustomDataTypes, MergeToolSets<TAgents>>;

export interface AgentOptions<TToolFactories extends ToolFactorySet<any> = ToolFactorySet<any>>
	extends AgentConfig<UIMessage> {
	// Required: system prompt for the agent
	system: string;
	// Required: collection of tool factories that will be automatically injected with runtime context
	tools: TToolFactories;
	// Optional: tool choice and stop conditions with strong typing based on the tools
	toolChoice?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["toolChoice"];
	stopWhen?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["stopWhen"];
	// Strongly typed callbacks based on the agent's specific tools
	onChunk?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onChunk"];
	onFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onFinish"];
	onStepFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onStepFinish"];
	onAbort?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onAbort"];
	onError?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onError"];
	prepareStep?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["prepareStep"];
	experimental_transform?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["experimental_transform"];
}

// Helper type to infer runtime context from tool factories
export type InferRuntimeContext<TToolFactories extends ToolFactorySet<any>> = TToolFactories extends ToolFactorySet<
	infer TContext
>
	? TContext
	: never;

export class Agent<TToolFactories extends ToolFactorySet<any> = ToolFactorySet<any>> {
	public readonly config: AgentConfig<UIMessage>;
	private generateId: () => string;
	private toolFactories: TToolFactories;
	private system: string;
	private toolChoice?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["toolChoice"];
	private stopWhen?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["stopWhen"];
	private onChunk?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onChunk"];
	private onFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onFinish"];
	private onStepFinish?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onStepFinish"];
	private onAbort?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onAbort"];
	private onError?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["onError"];
	private prepareStep?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["prepareStep"];
	private experimental_transform?: StreamTextParameters<ResolveToolFactories<TToolFactories>>["experimental_transform"];

	constructor(options: AgentOptions<TToolFactories>) {
		const {
			system,
			tools,
			toolChoice,
			stopWhen,
			onChunk,
			onFinish,
			onStepFinish,
			onAbort,
			onError,
			prepareStep,
			experimental_transform,
			...config
		} = options;

		this.toolFactories = tools;
		this.system = system;
		this.generateId = uuidv4;

		// Store base configuration (all streamText properties except excluded ones)
		this.config = config;

		// Store tool-specific properties separately
		this.toolChoice = toolChoice;
		this.stopWhen = stopWhen;
		this.onChunk = onChunk;
		this.onFinish = onFinish;
		this.onStepFinish = onStepFinish;
		this.onAbort = onAbort;
		this.onError = onError;
		this.prepareStep = prepareStep;
		this.experimental_transform = experimental_transform;
	}

	async stream<TMessage extends UIMessage = UIMessage>({
		threadId,
		messages,
		memory,
		resourceId,
		runtimeContext,
	}: StreamOptions<TMessage, InferRuntimeContext<TToolFactories>>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		const streamId = this.generateId();

		// Automatically inject runtime context into tool factories
		const tools = Object.fromEntries(
			Object.entries(this.toolFactories).map(([name, factory]) => [name, factory(runtimeContext)]),
		) as ResolveToolFactories<TToolFactories>;

		// Extract name from config as it's not a streamText property
		const { name, ...streamTextConfig } = this.config;

		// Ensure model is set
		if (!streamTextConfig.model) {
			throw new Error("Model must be configured");
		}

		// Return the stream result with necessary metadata
		return {
			result: streamText<ResolveToolFactories<TToolFactories>>({
				// Spread all streamText config properties
				...streamTextConfig,
				// Override with our specific handling
				system: this.system,
				messages: convertToModelMessages(messages, { tools }),
				tools,
				toolChoice: this.toolChoice,
				stopWhen: this.stopWhen,
				onChunk: this.onChunk,
				onFinish: this.onFinish,
				onStepFinish: this.onStepFinish,
				onAbort: this.onAbort,
				onError: this.onError,
				prepareStep: this.prepareStep,
				experimental_transform: this.experimental_transform,
			}),
			streamId,
			threadId,
		};
	}
}

/**
 * Factory function to create an agent with proper type inference
 */
export function createAgent<TTools extends ToolFactorySet<any>>(options: AgentOptions<TTools>): Agent<TTools> {
	return new Agent(options);
}
