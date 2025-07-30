/**
 * V2 Agent Class
 * Encapsulates agent behavior with system prompt and tools
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import type { Redis } from "@upstash/redis";
import {
	type Tool as AiTool,
	convertToModelMessages,
	smoothStream,
	streamText,
	type ToolSet,
	type UIMessage,
	wrapLanguageModel,
} from "ai";
import { BraintrustMiddleware } from "braintrust";
import type { z } from "zod";
import type { ToolFactory, ToolFactorySet } from "../primitives/tool";
import { EventWriter } from "./server/events/event-writer";
import { getDeltaStreamKey } from "./server/keys";
import { StreamWriter } from "./server/stream/stream-writer";
import { StreamStatus } from "./server/stream/types";
import { MessageWriter } from "./server/writers/message-writer";
import { type AgentDecision, AgentDecisionSchema, type WorkerConfig } from "./workers/schemas";

// Simple message type for internal use
type SimpleMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	toolCallId?: string;
	toolCalls?: any[];
};

// Legacy v2 tool definition (for backward compatibility)
export interface AgentToolDefinition {
	name: string;
	description: string;
	execute: (args: Record<string, any>) => Promise<any>;
	schema?: z.ZodSchema<any>;
}

// Extract core types from streamText
type StreamTextParameters<TOOLS extends ToolSet> = Parameters<typeof streamText<TOOLS>>[0];

// Properties to exclude from streamText parameters
type ExcludedStreamTextProps =
	| "messages" // Handled by session
	| "tools" // Handled by agent
	| "system" // Part of systemPrompt
	| "prompt" // We use messages
	| "toolChoice" // Needs generic typing
	| "stopWhen" // Needs generic typing
	| "onChunk" // Needs generic typing
	| "onFinish" // Needs generic typing
	| "onStepFinish" // Needs generic typing
	| "onAbort" // Needs generic typing
	| "onError" // Needs generic typing
	| "_internal" // We don't use this
	| "prepareStep" // Needs generic typing
	| "experimental_transform"; // We handle this separately

// Agent-specific configuration extending streamText parameters
export interface AgentConfig extends Omit<StreamTextParameters<ToolSet>, ExcludedStreamTextProps> {
	// Agent-specific required fields
	name: string;
}

// Updated AgentOptions extending AgentConfig
export interface AgentOptions<TRuntimeContext = unknown> extends AgentConfig {
	systemPrompt: string;
	// Support both legacy tools and tool factories
	tools?: AgentToolDefinition[] | ToolFactorySet<TRuntimeContext>;
	// Function to create runtime context from session
	createRuntimeContext?: (params: { sessionId: string; userId?: string }) => TRuntimeContext;
	// Allow passing commonly used streamText options directly
	experimental_transform?: StreamTextParameters<ToolSet>["experimental_transform"];
}

export class Agent<TRuntimeContext = unknown> {
	public readonly config: AgentConfig;
	private systemPrompt: string;
	private experimental_transform?: StreamTextParameters<ToolSet>["experimental_transform"];
	private messageWriter: MessageWriter;
	private eventWriter: EventWriter;
	private streamWriter: StreamWriter;
	private tools: Map<string, AgentToolDefinition>;
	private toolFactories?: ToolFactorySet<TRuntimeContext>;
	private createRuntimeContext?: (params: { sessionId: string; userId?: string }) => TRuntimeContext;
	private workerConfig: Partial<WorkerConfig>;

	constructor(
		options: AgentOptions<TRuntimeContext>,
		private redis: Redis,
		workerConfig: Partial<WorkerConfig> = {},
	) {
		// Destructure agent-specific properties from streamText config
		const { systemPrompt, tools, createRuntimeContext, experimental_transform, ...streamTextConfig } = options;

		// Store agent-specific properties
		this.systemPrompt = systemPrompt;
		this.experimental_transform = experimental_transform;
		this.createRuntimeContext = createRuntimeContext;

		// Handle tools - check if it's tool factories or legacy tools
		if (tools) {
			if (Array.isArray(tools)) {
				// Legacy v2 tools
				this.tools = new Map(tools.map((tool) => [tool.name, tool]));
			} else {
				// Tool factories
				this.toolFactories = tools;
				this.tools = new Map(); // Empty map, will be populated at runtime
			}
		} else {
			this.tools = new Map();
		}

		// Store all streamText-compatible properties
		this.config = streamTextConfig;

		// Initialize writers
		this.messageWriter = new MessageWriter(redis);
		this.eventWriter = new EventWriter(redis);
		this.streamWriter = new StreamWriter(redis);

		// Apply worker config defaults
		this.workerConfig = {
			maxExecutionTime: 25000,
			retryAttempts: 3,
			retryDelay: 1000,
			...workerConfig,
		};
	}

	/**
	 * Execute a tool by name with runtime context support
	 */
	async executeTool(toolName: string, args: Record<string, any>, sessionId?: string): Promise<any> {
		// First check legacy tools
		const tool = this.tools.get(toolName);
		if (tool) {
			return tool.execute(args);
		}

		// Check tool factories with runtime context
		if (this.toolFactories && this.toolFactories[toolName] && this.createRuntimeContext) {
			const runtimeContext = this.createRuntimeContext({
				sessionId: sessionId || "",
				userId: undefined, // Would come from session in real implementation
			});
			const toolInstance = this.toolFactories[toolName](runtimeContext);
			// AI SDK tools may require options as second parameter
			return await (toolInstance as any).execute(args, {});
		}

		throw new Error(`Unknown tool: ${toolName}`);
	}

	/**
	 * Get available tool names from both legacy tools and tool factories
	 */
	getAvailableTools(): string[] {
		const legacyTools = Array.from(this.tools.keys());
		const factoryTools = this.toolFactories ? Object.keys(this.toolFactories) : [];
		return [...legacyTools, ...factoryTools];
	}

	/**
	 * Get all tools resolved for a specific session (for streamText)
	 */
	private getResolvedTools(sessionId: string): ToolSet {
		const resolvedTools: ToolSet = {};

		// Add legacy tools
		for (const [name, tool] of this.tools) {
			resolvedTools[name] = {
				description: tool.description,
				parameters: tool.schema || {},
				execute: async (args: any) => tool.execute(args),
			} as AiTool;
		}

		// Add tools from factories
		if (this.toolFactories && this.createRuntimeContext) {
			const runtimeContext = this.createRuntimeContext({
				sessionId,
				userId: undefined, // Would come from session
			});

			for (const [name, factory] of Object.entries(this.toolFactories)) {
				const toolInstance = factory(runtimeContext as TRuntimeContext);
				resolvedTools[name] = toolInstance;
			}
		}

		return resolvedTools;
	}

	/**
	 * Get tools for scheduling (without execute functions for QStash scheduling)
	 */
	private getToolsForScheduling(sessionId: string): ToolSet {
		const schedulingTools: ToolSet = {};

		// Add legacy tools without execute functions
		for (const [name, tool] of this.tools) {
			schedulingTools[name] = {
				description: tool.description,
				inputSchema: tool.schema || {},
				// No execute function - tools will be scheduled via QStash
			} as AiTool;
		}

		// Add tools from factories without execute functions
		if (this.toolFactories && this.createRuntimeContext) {
			const runtimeContext = this.createRuntimeContext({
				sessionId,
				userId: undefined, // Would come from session
			});

			for (const [name, factory] of Object.entries(this.toolFactories)) {
				const toolInstance = factory(runtimeContext as TRuntimeContext);
				schedulingTools[name] = {
					description: toolInstance.description,
					inputSchema: toolInstance.inputSchema,
					// No execute function - tools will be scheduled via QStash
				} as AiTool;
			}
		}

		return schedulingTools;
	}

	/**
	 * Get tool description
	 */
	getToolDescription(toolName: string, sessionId?: string): string {
		// Check legacy tools first
		const tool = this.tools.get(toolName);
		if (tool) {
			return tool.description;
		}

		// Check tool factories
		if (this.toolFactories && this.toolFactories[toolName] && this.createRuntimeContext) {
			const runtimeContext = this.createRuntimeContext({
				sessionId: sessionId || "",
				userId: undefined,
			});
			const toolInstance = this.toolFactories[toolName](runtimeContext);
			return toolInstance.description || "Tool for various operations";
		}

		return "Tool for various operations";
	}

	/**
	 * Get agent name
	 */
	getName(): string {
		return this.config.name;
	}

	/**
	 * Get system prompt
	 */
	getSystemPrompt(): string {
		return this.systemPrompt;
	}

	/**
	 * Get temperature
	 */
	getTemperature(): number | undefined {
		return this.config.temperature;
	}

	/**
	 * Public method for Runtime to make agent decisions using natural streamText flow
	 */
	async makeDecisionForRuntime(
		sessionId: string,
		resourceId: string,
		messages: UIMessage[],
		temperature: number,
		assistantMessageId: string,
	): Promise<{ decision: AgentDecision; chunkCount: number; fullContent: string }> {
		// Convert UIMessages to model messages
		const modelMessages = convertToModelMessages(messages);

		// Get tools for scheduling (without execute functions)
		const toolsForScheduling = this.getToolsForScheduling(sessionId);

		// Use streamText with tools directly - let it decide naturally
		const { fullStream } = streamText({
			...this.config, // Spread all streamText-compatible properties
			system: this.systemPrompt,
			messages: modelMessages,
			temperature: temperature ?? this.config.temperature,
			tools: toolsForScheduling,
			// Apply experimental transform if provided
			...(this.experimental_transform && { experimental_transform: this.experimental_transform }),
		});

		// Stream content AND collect tool calls
		let fullContent = "";
		let chunkCount = 0;
		let pendingToolCall: { id: string; name: string; args: Record<string, any> } | null = null;

		for await (const chunk of fullStream) {
			switch (chunk.type) {
				case "text-delta":
					if ("text" in chunk && typeof chunk.text === "string") {
						fullContent += chunk.text;
						chunkCount++;
						// Delta streaming - immediate UI feedback
						await this.streamWriter.writeChunk(assistantMessageId, chunk.text);
					}
					break;

				case "tool-call":
					// Store tool call for QStash scheduling - don't execute immediately
					console.log(chunk);
					pendingToolCall = {
						id: chunk.toolCallId,
						name: chunk.toolName,
						args: chunk.input,
					};
					break;

				case "reasoning-delta":
					if ("delta" in chunk && typeof chunk.delta === "string") {
						// Handle reasoning chunks (Claude thinking)
						fullContent += chunk.delta;
						chunkCount++;
						await this.streamWriter.writeChunk(assistantMessageId, chunk.delta);
					}
					break;
			}
		}

		// Write the assistant message WITHOUT completing stream
		// Stream stays open for the entire agent loop
		if (fullContent.trim() || pendingToolCall) {
			const assistantMessage: UIMessage = {
				id: assistantMessageId,
				role: "assistant",
				parts: [] as any[],
			};

			// Add text part if there's content
			if (fullContent.trim()) {
				assistantMessage.parts.push({ type: "text", text: fullContent });
			}

			// Don't save tool call part - it will be added when tool result comes back

			// Write message without completing stream
			await this.messageWriter.writeUIMessage(sessionId, resourceId, assistantMessage);
		}

		// Return decision based on what streamText naturally decided
		const decision: AgentDecision = pendingToolCall ? { toolCall: pendingToolCall } : {}; // No tool needed

		return { decision, chunkCount, fullContent };
	}

	private extractUsedTools(messages: SimpleMessage[]): string[] {
		const tools = new Set<string>();
		messages.forEach((m) => {
			// Extract tool names from tool calls if available
			if (m.toolCalls) {
				m.toolCalls.forEach((toolCall: any) => {
					if (toolCall.name) {
						tools.add(toolCall.name);
					}
				});
			}
		});
		return Array.from(tools);
	}
}
