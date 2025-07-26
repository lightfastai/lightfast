import { convertToModelMessages, streamText, type Tool, type ToolSet, type UIMessage } from "ai";
import type { ToolFactory, ToolFactorySet } from "./tool";
import type { Memory } from "../memory";

// Helper function to resolve tools from factories
function resolveToolFactories<TRuntimeContext = unknown>(
	toolsOrFactories: ToolSet | ToolFactorySet<TRuntimeContext> | ((context: TRuntimeContext) => ToolSet | ToolFactorySet<TRuntimeContext>),
	context: TRuntimeContext
): ToolSet {
	// First resolve if it's a function
	const resolved = typeof toolsOrFactories === 'function' ? toolsOrFactories(context) : toolsOrFactories;
	
	// Check if it's a ToolFactorySet by checking if the first property is a function
	const firstKey = Object.keys(resolved)[0];
	if (firstKey && typeof resolved[firstKey] === 'function') {
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

export interface StreamOptions<TMessage extends UIMessage = UIMessage, TSystemContext = {}> {
	threadId: string;
	messages: TMessage[];
	memory: Memory<TMessage>;
	resourceId: string;
	systemContext?: TSystemContext;
}




export interface AgentOptions<TTools extends ToolSet | ToolFactorySet<any> = ToolSet, TRuntimeContext = {}>
	extends AgentConfig {
	// Required: system prompt for the agent
	system: string;
	// Required: tools that will be passed to streamText (can be tool factories or direct tools)
	tools: TTools | ((context: TRuntimeContext) => TTools);
	// Required: function to create runtime context from request parameters
	createRuntimeContext: (params: { threadId: string; resourceId: string }) => TRuntimeContext;
	// Optional: tool choice and stop conditions with strong typing based on the resolved tools
	toolChoice?: StreamTextParameters<ToolSet>["toolChoice"];
	stopWhen?: StreamTextParameters<ToolSet>["stopWhen"];
	// Strongly typed callbacks based on the agent's specific tools
	onChunk?: StreamTextParameters<ToolSet>["onChunk"];
	onFinish?: StreamTextParameters<ToolSet>["onFinish"];
	onStepFinish?: StreamTextParameters<ToolSet>["onStepFinish"];
	onAbort?: StreamTextParameters<ToolSet>["onAbort"];
	onError?: StreamTextParameters<ToolSet>["onError"];
	prepareStep?: StreamTextParameters<ToolSet>["prepareStep"];
	experimental_transform?: StreamTextParameters<ToolSet>["experimental_transform"];
}


export class Agent<TTools extends ToolSet | ToolFactorySet<any> = ToolSet, TRuntimeContext = {}> {
	public readonly config: AgentConfig;
	private generateId: () => string;
	private tools: TTools | ((context: TRuntimeContext) => TTools);
	private createRuntimeContext: (params: { threadId: string; resourceId: string }) => TRuntimeContext;
	private system: string;
	private toolChoice?: StreamTextParameters<ToolSet>["toolChoice"];
	private stopWhen?: StreamTextParameters<ToolSet>["stopWhen"];
	private onChunk?: StreamTextParameters<ToolSet>["onChunk"];
	private onFinish?: StreamTextParameters<ToolSet>["onFinish"];
	private onStepFinish?: StreamTextParameters<ToolSet>["onStepFinish"];
	private onAbort?: StreamTextParameters<ToolSet>["onAbort"];
	private onError?: StreamTextParameters<ToolSet>["onError"];
	private prepareStep?: StreamTextParameters<ToolSet>["prepareStep"];
	private experimental_transform?: StreamTextParameters<ToolSet>["experimental_transform"];

	constructor(options: AgentOptions<TTools, TRuntimeContext>) {
		const {
			system,
			tools,
			createRuntimeContext,
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

	async stream<TMessage extends UIMessage = UIMessage, TSystemContext = {}>({
		threadId,
		messages,
		memory,
		resourceId,
		systemContext,
	}: StreamOptions<TMessage, TSystemContext>) {
		if (!messages || messages.length === 0) {
			throw new Error("At least one message is required");
		}

		const streamId = this.generateId();

		// Create runtime context
		const agentContext = this.createRuntimeContext({ threadId, resourceId });
		
		// Merge agent context with system context
		const mergedContext = systemContext 
			? { ...agentContext, ...systemContext }
			: agentContext;

		// Resolve tools using helper function
		const resolvedTools = resolveToolFactories(this.tools, mergedContext);

		// Extract name from config as it's not a streamText property
		const { name, ...streamTextConfig } = this.config;

		// Ensure model is set
		if (!streamTextConfig.model) {
			throw new Error("Model must be configured");
		}

		// Return the stream result with necessary metadata
		return {
			result: streamText<ToolSet>({
				// Spread all streamText config properties
				...streamTextConfig,
				// Override with our specific handling
				system: this.system,
				messages: convertToModelMessages(messages, { tools: resolvedTools }),
				tools: resolvedTools,
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
export function createAgent<TTools extends ToolSet | ToolFactorySet<any>, TRuntimeContext = {}>(
	options: AgentOptions<TTools, TRuntimeContext>
): Agent<TTools, TRuntimeContext> {
	return new Agent(options);
}
