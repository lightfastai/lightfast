import { type CoreMessage, convertToModelMessages, streamText, type Tool, type ToolSet, type UIMessage } from "ai";
import type { Memory } from "../memory";
import type { SystemContext } from "../server/adapters/types";
import type { ProviderCache } from "./cache";
import type { ToolFactory, ToolFactorySet } from "./tool";

// Helper function to resolve tools from factories
function resolveToolFactories<TRuntimeContext = unknown>(
	toolsOrFactories:
		| ToolSet
		| ToolFactorySet<TRuntimeContext>
		| ((context: TRuntimeContext) => ToolSet | ToolFactorySet<TRuntimeContext>),
	context: TRuntimeContext,
): ToolSet {
	// First resolve if it's a function
	const resolved = typeof toolsOrFactories === "function" ? toolsOrFactories(context) : toolsOrFactories;

	// Check if it's a ToolFactorySet by checking if the first property is a function
	const firstKey = Object.keys(resolved)[0];
	if (firstKey && typeof resolved[firstKey] === "function") {
		// It's a ToolFactorySet, resolve each factory
		const toolSet: ToolSet = {};
		for (const [key, factory] of Object.entries(resolved)) {
			toolSet[key] = (factory as ToolFactory<TRuntimeContext>)(context);
		}
		return toolSet;
	}

	// It's already a ToolSet
	return resolved as ToolSet;
}

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
export interface AgentConfig extends Omit<StreamTextParameters<ToolSet>, ExcludedStreamTextProps> {
	// Agent-specific required fields
	name: string;
}

export interface StreamOptions<TMessage extends UIMessage = UIMessage, TRequestContext = {}, TMemoryContext = {}> {
	sessionId: string;
	messages: TMessage[];
	memory: Memory<TMessage, TMemoryContext>;
	resourceId: string;
	systemContext: SystemContext;
	requestContext: TRequestContext;
}

export interface AgentOptions<TTools extends ToolSet | ToolFactorySet<any> = ToolSet, TRuntimeContext = {}>
	extends AgentConfig {
	// Required: system prompt for the agent
	system: string;
	// Required: tools that will be passed to streamText (can be tool factories or direct tools)
	tools: TTools | ((context: TRuntimeContext) => TTools);
	// Required: function to create runtime context from request parameters
	createRuntimeContext: (params: { sessionId: string; resourceId: string }) => TRuntimeContext;
	// Optional: provider-specific cache implementation
	cache?: ProviderCache;
	// Optional: tool choice and stop conditions with strong typing based on the resolved tools
	toolChoice?: StreamTextParameters<ResolvedTools<TTools>>["toolChoice"];
	stopWhen?: StreamTextParameters<ResolvedTools<TTools>>["stopWhen"];
	// Strongly typed callbacks based on the agent's specific tools
	onChunk?: StreamTextParameters<ResolvedTools<TTools>>["onChunk"];
	onFinish?: StreamTextParameters<ResolvedTools<TTools>>["onFinish"];
	onStepFinish?: StreamTextParameters<ResolvedTools<TTools>>["onStepFinish"];
	onAbort?: StreamTextParameters<ResolvedTools<TTools>>["onAbort"];
	onError?: StreamTextParameters<ResolvedTools<TTools>>["onError"];
	prepareStep?: StreamTextParameters<ResolvedTools<TTools>>["prepareStep"];
	experimental_transform?: StreamTextParameters<ResolvedTools<TTools>>["experimental_transform"];
}

export class Agent<TTools extends ToolSet | ToolFactorySet<any> = ToolSet, TRuntimeContext = {}> {
	public readonly config: AgentConfig;
	private generateId: () => string;
	private tools: TTools | ((context: TRuntimeContext) => TTools);
	private createRuntimeContext: (params: { sessionId: string; resourceId: string }) => TRuntimeContext;
	private system: string;
	private cache?: ProviderCache;
	private toolChoice?: StreamTextParameters<ResolvedTools<TTools>>["toolChoice"];
	private stopWhen?: StreamTextParameters<ResolvedTools<TTools>>["stopWhen"];
	private onChunk?: StreamTextParameters<ResolvedTools<TTools>>["onChunk"];
	private onFinish?: StreamTextParameters<ResolvedTools<TTools>>["onFinish"];
	private onStepFinish?: StreamTextParameters<ResolvedTools<TTools>>["onStepFinish"];
	private onAbort?: StreamTextParameters<ResolvedTools<TTools>>["onAbort"];
	private onError?: StreamTextParameters<ResolvedTools<TTools>>["onError"];
	private prepareStep?: StreamTextParameters<ResolvedTools<TTools>>["prepareStep"];
	private experimental_transform?: StreamTextParameters<ResolvedTools<TTools>>["experimental_transform"];

	constructor(options: AgentOptions<TTools, TRuntimeContext>) {
		const {
			system,
			tools,
			createRuntimeContext,
			cache,
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

		this.tools = tools;
		this.createRuntimeContext = createRuntimeContext;
		this.system = system;
		this.cache = cache;
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

	async stream<TMessage extends UIMessage = UIMessage, TRequestContext = {}, TMemoryContext = {}>({
		sessionId,
		messages,
		memory,
		resourceId,
		systemContext,
		requestContext,
	}: StreamOptions<TMessage, TRequestContext, TMemoryContext>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		const streamId = this.generateId();

		// Create agent-specific runtime context
		const agentContext = this.createRuntimeContext({ sessionId, resourceId });

		// Merge all three context levels: system -> request -> agent
		const mergedContext = {
			...systemContext,
			...requestContext,
			...agentContext,
		};

		// Resolve tools using helper function
		const resolvedTools = resolveToolFactories(this.tools, mergedContext);

		// Extract name from config as it's not a streamText property
		const { name, ...streamTextConfig } = this.config;

		// Ensure model is set
		if (!streamTextConfig.model) {
			throw new Error("Model must be configured");
		}

		// Convert system config to messages with cache control
		let systemMessages: CoreMessage[] = [];
		let modelMessages: CoreMessage[];

		if (this.cache) {
			// Use provider cache implementation
			systemMessages = this.cache.applySystemCaching(this.system);

			// console.log(messages.forEach((x) => console.log(x)));
			// Convert messages to model messages
			const baseModelMessages = convertToModelMessages(messages, { tools: resolvedTools });

			console.log(baseModelMessages.forEach((x) => console.log(x)));
			// Apply message caching
			modelMessages = this.cache.applyMessageCaching(baseModelMessages, messages);
		} else {
			// No cache provider - use simple system message
			systemMessages.push({
				role: "system",
				content: this.system,
			});

			// Convert messages without caching
			modelMessages = convertToModelMessages(messages, { tools: resolvedTools });
		}

		// Prepend system messages to the model messages
		// This way we maintain proper typing
		const allModelMessages = [...systemMessages, ...modelMessages];

		// Create properly typed parameters for streamText
		// We know resolvedTools is a ToolSet at runtime, so we can safely type the parameters
		const streamTextParams: Parameters<typeof streamText<ToolSet>>[0] = {
			// Spread all streamText config properties (includes headers, providerOptions, etc.)
			...streamTextConfig,
			// Override with our specific handling - no more system parameter
			messages: allModelMessages,
			tools: resolvedTools,
			// These callbacks need to be cast because they're typed with ResolvedTools<TTools>
			// but streamText expects them typed with ToolSet. This is safe because
			// resolvedTools is guaranteed to be a ToolSet at runtime.
			toolChoice: this.toolChoice as StreamTextParameters<ToolSet>["toolChoice"],
			stopWhen: this.stopWhen as StreamTextParameters<ToolSet>["stopWhen"],
			onChunk: this.onChunk as StreamTextParameters<ToolSet>["onChunk"],
			onFinish: this.onFinish as StreamTextParameters<ToolSet>["onFinish"],
			onStepFinish: this.onStepFinish as StreamTextParameters<ToolSet>["onStepFinish"],
			onAbort: this.onAbort as StreamTextParameters<ToolSet>["onAbort"],
			onError: this.onError as StreamTextParameters<ToolSet>["onError"],
			prepareStep: this.prepareStep as StreamTextParameters<ToolSet>["prepareStep"],
			experimental_transform: this.experimental_transform as StreamTextParameters<ToolSet>["experimental_transform"],
		};

		// Return the stream result with necessary metadata
		return {
			result: streamText(streamTextParams),
			streamId,
			sessionId,
		};
	}
}

// Type helper to resolve tool factories to tools
type ResolveFactory<T> = T extends ToolFactory<any> ? ReturnType<T> : T;

// Type helper to get the resolved tools type
export type ResolvedTools<T> = T extends ToolFactorySet<any>
	? { [K in keyof T]: ResolveFactory<T[K]> }
	: T extends ToolSet
		? T
		: never;

/**
 * Factory function to create an agent with proper type inference
 */
export function createAgent<TTools extends ToolSet | ToolFactorySet<any>, TRuntimeContext = {}>(
	options: AgentOptions<TTools, TRuntimeContext>,
): Agent<TTools, TRuntimeContext> {
	return new Agent(options);
}
