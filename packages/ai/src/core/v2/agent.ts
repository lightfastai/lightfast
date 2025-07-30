/**
 * V2 Agent Class
 * Encapsulates agent behavior with system prompt and tools
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import type { Redis } from "@upstash/redis";
import { type Tool as AiTool, smoothStream, streamText, type ToolSet, type UIMessage, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import type { z } from "zod";
import type { ToolFactory, ToolFactorySet } from "../primitives/tool";
import { EventWriter } from "./server/events/event-writer";
import type { AgentLoopInitEvent, Message } from "./server/events/types";
import { getDeltaStreamKey } from "./server/keys";
import { StreamWriter } from "./server/stream/stream-writer";
import { StreamStatus } from "./server/stream/types";
import { MessageWriter } from "./server/writers/message-writer";
import { type AgentDecision, AgentDecisionSchema, type WorkerConfig } from "./workers/schemas";

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
	 * Public method for Runtime to make agent decisions
	 */
	async makeDecisionForRuntime(
		sessionId: string,
		messages: Message[],
		temperature: number,
	): Promise<{ decision: AgentDecision; chunkCount: number; fullContent: string }> {
		// Build the system prompt
		const systemPrompt = this.buildSystemPrompt(sessionId);

		// Prepare messages for the model
		const preparedMessages = this.prepareMessages(messages);

		let finalDecision: AgentDecision | null = null;
		let responseMessages: UIMessage[] = [];
		let chunkCount = 0;

		// Create a prompt that will naturally generate structured output
		const structuredPrompt = `${systemPrompt}

Please analyze the conversation and decide if you need to use a tool. Respond with your decision in the following JSON format:
{
  "toolCall": { "id": "unique_id", "name": "tool_name", "args": {...} } // include this field only if you need to use a tool
}

If no tool is needed, return an empty JSON object: {}

Think through this step by step first, then provide your JSON decision.`;

		// Stream the decision-making process
		const { textStream } = streamText({
			...this.config, // Spread all streamText-compatible properties
			system: structuredPrompt,
			messages: preparedMessages,
			// Override with session-specific values if needed
			temperature: temperature ?? this.config.temperature,
			// Apply experimental transform if provided
			...(this.experimental_transform && { experimental_transform: this.experimental_transform }),
			onFinish: async (result) => {
				// Parse the structured decision from the full text
				try {
					const fullText = result.text;
					const jsonMatch = fullText.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						const parsed = JSON.parse(jsonMatch[0]);
						finalDecision = AgentDecisionSchema.parse(parsed);
					}
				} catch (error) {
					console.error(`[Agent ${this.config.name}] Failed to parse decision from text:`, error);
				}

				// For now, we'll construct a simple message from the text
				// In the future, we might want to use result.responseMessages if available
				if (result.text) {
					responseMessages = [
						{
							id: this.generateMessageId(),
							role: "assistant",
							parts: [{ type: "text", text: result.text }],
						},
					];
				}

				// Log the decision
				console.log(`[Agent ${this.config.name}] Decision for session ${sessionId}:`, {
					toolCall: finalDecision?.toolCall,
				});
			},
		});

		// Stream chunks in real-time for immediate UI feedback
		let fullContent = "";
		for await (const chunk of textStream) {
			if (chunk) {
				fullContent += chunk;
				chunkCount++;
				// Delta streaming - immediate UI feedback
				await this.streamWriter.writeChunk(sessionId, chunk);
			}
		}

		// Write the complete thinking message with reasoning parts
		if (responseMessages.length > 0) {
			const thinkingMessage = responseMessages[0];
			if (thinkingMessage) {
				// Transform text parts to reasoning parts for thinking
				const reasoningMessage: UIMessage = {
					...thinkingMessage,
					parts: thinkingMessage.parts.map((part) => (part.type === "text" ? { ...part, type: "reasoning" } : part)),
				};
				await this.messageWriter.writeUIMessage(sessionId, reasoningMessage);
			}
		}

		if (!finalDecision) {
			throw new Error("Failed to get structured decision from streamText");
		}

		return { decision: finalDecision, chunkCount, fullContent };
	}

	/**
	 * Build the system prompt for the agent
	 */
	private buildSystemPrompt(sessionId: string): string {
		const toolNames = this.getAvailableTools();
		const toolsSection = toolNames.length
			? `
Available Tools:
${toolNames.map((tool) => `- ${tool}: ${this.getToolDescription(tool, sessionId)}`).join("\n")}

When you need to use a tool, set action to "tool_call" and provide the tool name and arguments.
`
			: "";

		return `${this.systemPrompt}

Your task is to help the user by analyzing their request and determining if you need to use a tool.

You must decide between:
1. "tool_call" - Use a tool to gather information or perform an action
2. "complete" - No tool is needed, the task is complete

${toolsSection}

Think through your reasoning step by step, then make your decision. Only use tools when necessary to fulfill the user's request.`;
	}

	/**
	 * Prepare messages for the model
	 */
	private prepareMessages(messages: Message[]): Array<{ role: "user" | "assistant"; content: string }> {
		return messages
			.filter((m) => m.role !== "system")
			.map((m) => {
				if (m.role === "tool") {
					// Format tool results as assistant messages
					return {
						role: "assistant" as const,
						content: `Tool result: ${m.content}`,
					};
				}
				return {
					role: m.role as "user" | "assistant",
					content: m.content,
				};
			});
	}

	private generateMessageId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	}

	private extractUsedTools(messages: Message[]): string[] {
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
