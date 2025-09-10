import { convertToModelMessages } from "ai";
import type {
	ModelMessage,
	Tool,
	ToolSet,
	UIMessage,
	UIMessageStreamWriter,
	LanguageModel,
	ToolChoice,
	StopCondition,
	PrepareStepFunction,
	StreamTextTransform,
	StreamTextOnChunkCallback,
	StreamTextOnErrorCallback,
	StreamTextOnFinishCallback,
	StreamTextOnStepFinishCallback,
	TelemetrySettings,
	StepResult,
 streamText } from "ai";
import type { Memory } from "../memory";
import {
	AgentConfigurationError,
	AgentStreamError,
	CacheOperationError,
	ContextCreationError,
	MessageConversionError,
	NoMessagesError,
	ToolExecutionError,
} from "../server/errors";
import type { SystemContext, RuntimeContext } from "../server/adapters/types";
import type { ProviderCache } from "./cache";
import type { ToolFactory, ToolFactorySet } from "./tool";

// Extract the base streamText parameters type
type StreamTextParams = Parameters<typeof streamText>[0];

// Vercel AI SDK configuration - derived from actual streamText parameters
// We omit the fields that Lightfast handles (messages, tools, system) and re-type with proper generics
export type VercelAIConfig<TOOLS extends ToolSet = ToolSet> = Omit<
	StreamTextParams,
	| "messages"
	| "tools"
	| "system"
	| "prompt"
	| "toolChoice"
	| "stopWhen"
	| "onChunk"
	| "onFinish"
	| "onStepFinish"
	| "prepareStep"
	| "experimental_transform"
> & {
	// Re-type the generic-dependent fields with our TOOLS type
	toolChoice?: ToolChoice<TOOLS>;
	stopWhen?: StopCondition<TOOLS> | StopCondition<TOOLS>[];
	onChunk?: StreamTextOnChunkCallback<TOOLS>;
	onFinish?: StreamTextOnFinishCallback<TOOLS>;
	onStepFinish?: StreamTextOnStepFinishCallback<TOOLS>;
	prepareStep?: PrepareStepFunction<TOOLS>;
	experimental_transform?:
		| StreamTextTransform<TOOLS>
		| StreamTextTransform<TOOLS>[];
};

// Lightfast-specific configuration
export interface LightfastConfig<
	TRuntimeContext = {},
	TTools extends
		ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
> {
	// Required Lightfast fields
	name: string;
	system: string;
	tools?: TTools | ((context: TRuntimeContext) => TTools);  // Optional - user might not have tools
	createRuntimeContext?: (params: {  // Optional - user might not need runtime context
		sessionId: string;
		resourceId: string;
	}) => TRuntimeContext;

	// Optional Lightfast features
	cache?: ProviderCache;
}

export interface StreamOptions<
	TMessage extends UIMessage = UIMessage,
	TRequestContext = {},
	TMemoryContext = {},
> {
	sessionId: string;
	messages: TMessage[];
	memory: Memory<TMessage, TMemoryContext>;
	resourceId: string;
	systemContext: SystemContext;
	requestContext: TRequestContext;
	dataStream?: UIMessageStreamWriter; // UIMessageStreamWriter for artifact support
}

// Combined options for creating an agent
export interface AgentOptions<
	TRuntimeContext = {},
	TTools extends
		ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
> extends LightfastConfig<TRuntimeContext, TTools>,
		VercelAIConfig<ToolSet> {
	// All fields are inherited from the two interfaces
	// Note: VercelAIConfig uses ToolSet since factories are resolved to tools at runtime
}

export class Agent<
	TRuntimeContext = {},
	TTools extends
		ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
> {
	// Clean separation: Vercel AI SDK config vs Lightfast config
	private readonly vercelConfig: VercelAIConfig<ToolSet>;
	private readonly lightfastConfig: LightfastConfig<TRuntimeContext, TTools>;

	constructor(options: AgentOptions<TRuntimeContext, TTools>) {
		// Destructure into Lightfast and Vercel configs
		const {
			// Lightfast-specific fields
			name,
			system,
			tools,
			createRuntimeContext,
			cache,
			// Everything else is Vercel AI SDK config
			...vercelConfig
		} = options;

		// Store Lightfast configuration
		this.lightfastConfig = {
			name,
			system,
			tools,
			createRuntimeContext,
			cache,
		};

		// Store Vercel AI SDK configuration
		this.vercelConfig = vercelConfig as VercelAIConfig<ToolSet>;
	}

	// Public getter for agent name
	get name(): string {
		return this.lightfastConfig.name;
	}

	// Public getter for the model (commonly needed)
	get model(): LanguageModel {
		return this.vercelConfig.model;
	}

	/**
	 * Builds parameters for streamText for the given messages and context
	 * Returns an object that can be directly passed to streamText
	 * Does not actually call streamText - that's handled by runtime.ts
	 */
	buildStreamParams<
		TMessage extends UIMessage = UIMessage,
		TRequestContext = {},
		TMemoryContext = {},
	>({
		sessionId,
		messages,
		memory,
		resourceId,
		systemContext,
		requestContext,
		dataStream,
	}: StreamOptions<TMessage, TRequestContext, TMemoryContext>): Parameters<
		typeof streamText
	>[0] {
		if (!messages || messages.length === 0) {
			throw new NoMessagesError();
		}

		// Create agent-specific runtime context if provided
		let agentContext: TRuntimeContext | {} = {};
		if (this.lightfastConfig.createRuntimeContext) {
			try {
				agentContext = this.lightfastConfig.createRuntimeContext({
					sessionId,
					resourceId,
				});
			} catch (error) {
				throw new ContextCreationError(
					"runtime",
					error instanceof Error ? error.message : String(error),
					error instanceof Error ? error : undefined,
				);
			}
		}

		// Merge all context levels: system -> request -> agent -> dataStream
		// The merged context is what tools actually receive
		const mergedContext: SystemContext & TRequestContext & TRuntimeContext & { dataStream?: UIMessageStreamWriter } = {
			...systemContext,
			...requestContext,
			...agentContext,
			...(dataStream && { dataStream }), // Add dataStream if provided
		} as SystemContext & TRequestContext & TRuntimeContext & { dataStream?: UIMessageStreamWriter };

		// Resolve tool factories into actual tools by injecting merged context
		const resolvedTools: ToolSet = {};
		if (this.lightfastConfig.tools) {
			const tools =
				typeof this.lightfastConfig.tools === "function"
					? this.lightfastConfig.tools(mergedContext as TRuntimeContext)
					: this.lightfastConfig.tools;

			// Validate tools is a valid object
			if (!tools || typeof tools !== "object") {
				throw new ToolExecutionError(
					"tools",
					"Tools resolution returned null, undefined, or non-object value",
				);
			}

			for (const [name, factory] of Object.entries(tools)) {
				try {
					resolvedTools[name] = factory(mergedContext as unknown as RuntimeContext<TRuntimeContext>);
				} catch (error) {
					throw new ToolExecutionError(
						name,
						`Failed to resolve tool factory '${name}': ${error instanceof Error ? error.message : String(error)}`,
						error instanceof Error ? error : undefined,
					);
				}
			}
		}

		// Ensure model is set
		if (!this.vercelConfig.model) {
			throw new AgentConfigurationError("model", "Model must be configured");
		}

		// Convert system config to messages with cache control
		let systemMessages: ModelMessage[] = [];
		let modelMessages: ModelMessage[];

		if (this.lightfastConfig.cache) {
			try {
				// Use provider cache implementation
				systemMessages = this.lightfastConfig.cache.applySystemCaching(
					this.lightfastConfig.system,
				);

				// Convert messages to model messages
				const baseModelMessages = convertToModelMessages(messages, {
					tools: resolvedTools,
				});

				// Apply message caching
				modelMessages = this.lightfastConfig.cache.applyMessageCaching(
					baseModelMessages,
					messages,
				);
			} catch (error) {
				throw new CacheOperationError(
					"system and message caching",
					error instanceof Error ? error.message : String(error),
					error instanceof Error ? error : undefined,
				);
			}
		} else {
			try {
				// No cache provider - use simple system message
				systemMessages.push({
					role: "system",
					content: this.lightfastConfig.system,
				});

				// Convert messages without caching
				modelMessages = convertToModelMessages(messages, {
					tools: resolvedTools,
				});
			} catch (error) {
				throw new MessageConversionError(
					"convert to model messages",
					error instanceof Error ? error.message : String(error),
					error instanceof Error ? error : undefined,
				);
			}
		}

		// Prepend system messages to the model messages
		// This way we maintain proper typing
		const allModelMessages = [...systemMessages, ...modelMessages];

		// Return the parameters for streamText
		// The actual streaming is handled by runtime.ts
		return {
			// Spread all Vercel AI SDK config
			...this.vercelConfig,
			// Override with our specific runtime values
			messages: allModelMessages,
			tools: resolvedTools,
		} as Parameters<typeof streamText>[0];
	}

	// Expose config for testing or inspection
	get config(): LightfastConfig<TRuntimeContext, TTools> & VercelAIConfig<ToolSet> {
		return {
			...this.lightfastConfig,
			...this.vercelConfig,
		};
	}
}

/**
 * Factory function to create an agent with proper type inference
 * All tools must be created using createTool() which returns ToolFactory functions
 */
export function createAgent<
	TRuntimeContext = {},
	TTools extends
		ToolFactorySet<RuntimeContext<TRuntimeContext>> = ToolFactorySet<RuntimeContext<TRuntimeContext>>,
>(
	options: AgentOptions<TRuntimeContext, TTools>,
): Agent<TRuntimeContext, TTools> {
	return new Agent(options);
}
