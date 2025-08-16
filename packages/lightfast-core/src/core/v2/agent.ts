/**
 * V2 Agent Class
 * Encapsulates agent behavior with system prompt and tools
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import type { Redis } from "@upstash/redis";
import {
	
	convertToModelMessages,
	smoothStream,
	streamText,
	
	
	wrapLanguageModel
} from "ai";
import type {Tool as AiTool, ToolSet, UIMessage} from "ai";
import { BraintrustMiddleware } from "braintrust";
import type { z } from "zod";
import type { ToolFactory, ToolFactorySet } from "../primitives/tool";
import { EventWriter } from "./server/events/event-writer";
import { getDeltaStreamKey } from "./server/keys";
import { MessageReader } from "./server/readers/message-reader";
import { StreamWriter } from "./server/stream/stream-writer";
import { StreamStatus } from "./server/stream/types";
import { MessageWriter } from "./server/writers/message-writer";
import {
	
	AgentDecisionSchema
	
} from "./workers/schemas";
import type {AgentDecision, WorkerConfig} from "./workers/schemas";

// Legacy v2 tool definition (for backward compatibility)
export interface AgentToolDefinition {
	name: string;
	description: string;
	execute: (args: Record<string, any>) => Promise<any>;
	schema?: z.ZodSchema<any>;
}

// Extract core types from streamText
type StreamTextParameters<TOOLS extends ToolSet> = Parameters<
	typeof streamText<TOOLS>
>[0];

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
export interface AgentConfig
	extends Omit<StreamTextParameters<ToolSet>, ExcludedStreamTextProps> {
	// Agent-specific required fields
	name: string;
}

// Updated AgentOptions extending AgentConfig
export interface AgentOptions<TRuntimeContext = unknown> extends AgentConfig {
	systemPrompt: string;
	// Support both legacy tools and tool factories
	tools?: AgentToolDefinition[] | ToolFactorySet<TRuntimeContext>;
	// Function to create runtime context from session
	createRuntimeContext?: (params: {
		sessionId: string;
		userId?: string;
	}) => TRuntimeContext;
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
	private createRuntimeContext?: (params: {
		sessionId: string;
		userId?: string;
	}) => TRuntimeContext;
	private workerConfig: Partial<WorkerConfig>;

	private messageReader: MessageReader;

	constructor(
		options: AgentOptions<TRuntimeContext>,
		private redis: Redis,
		workerConfig: Partial<WorkerConfig> = {},
	) {
		// Destructure agent-specific properties from streamText config
		const {
			systemPrompt,
			tools,
			createRuntimeContext,
			experimental_transform,
			...streamTextConfig
		} = options;

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

		// Initialize readers and writers
		this.messageReader = new MessageReader(redis);
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
	async executeTool(
		toolName: string,
		args: Record<string, any>,
		sessionId?: string,
	): Promise<any> {
		// First check legacy tools
		const tool = this.tools.get(toolName);
		if (tool) {
			return tool.execute(args);
		}

		// Check tool factories with runtime context
		if (
			this.toolFactories?.[toolName] &&
			this.createRuntimeContext
		) {
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
		const factoryTools = this.toolFactories
			? Object.keys(this.toolFactories)
			: [];
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
				const toolInstance = factory(runtimeContext);
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
				const toolInstance = factory(runtimeContext);
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
		if (
			this.toolFactories?.[toolName] &&
			this.createRuntimeContext
		) {
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
	): Promise<{
		decision: AgentDecision;
		chunkCount: number;
		fullContent: string;
	}> {
		// Get tools for scheduling (without execute functions)
		const toolsForScheduling = this.getToolsForScheduling(sessionId);

		// DO NOT DELETE THIS COMMENT - CRITICAL FOR V2 TOOL RESULT HANDLING
		//
		// The Vercel AI SDK v5's streamText function has specific requirements for tool result parts:
		//
		// 1. Tool parts are identified by type starting with "tool-" (checked via isToolUIPart function)
		// 2. Tool name is extracted from type: type.split("-").slice(1).join("-")
		//    Example: "tool-webSearch" → toolName = "webSearch"
		// 3. Tool results MUST have these fields:
		//    - type: "tool-{toolName}" (e.g., "tool-webSearch")
		//    - toolCallId: string linking to the original tool call
		//    - state: "output-available" or "output-error" (REQUIRED - cannot be undefined)
		//    - input: the tool's input arguments
		//    - output: the tool's results (for success)
		//    - errorText: error message (for errors)
		//
		// REDIS STORAGE ISSUE:
		// When tool results are stored in Redis, only 'input' and 'output' fields are persisted.
		// The critical metadata fields (type, toolCallId, state) are lost during storage/retrieval.
		// This causes AI SDK to throw: "Unsupported tool part state: undefined"
		//
		// V2 ARCHITECTURE NOTE:
		// In v2, we do NOT store tool-call parts in the database. Tool calls are handled by
		// the distributed state machine (QStash). Only tool results are persisted.
		//
		// TEMPORARY FIX:
		// We check for tool result parts missing required fields and skip processing them
		// until the Redis storage issue is properly fixed.
		//
		const fixedMessages = messages;
		console.log(fixedMessages.forEach((x) => console.log(x)));

		// Convert UIMessages to model messages
		// Pass tools so the SDK knows how to handle tool results properly
		const modelMessages = convertToModelMessages(fixedMessages, {
			tools: toolsForScheduling,
		});

		console.log("-----");
		console.log(modelMessages.forEach((x) => console.log(x)));
		// Use streamText with tools directly - let it decide naturally
		// IMPORTANT: maxSteps=1 to prevent internal looping - we handle the loop via QStash
		const { fullStream } = streamText({
			...this.config, // Spread all streamText-compatible properties
			model: this.config.model, // Required field
			system: this.systemPrompt,
			messages: modelMessages,
			temperature: temperature ?? this.config.temperature,
			tools: toolsForScheduling,
			maxSteps: 1, // Critical: Only one LLM call per HTTP request
			// Apply experimental transform if provided
			...(this.experimental_transform && {
				experimental_transform: this.experimental_transform,
			}),
		} as Parameters<typeof streamText>[0]);

		// Stream content AND collect tool calls
		// Keep track of parts separately to preserve their order and types
		const parts: { type: "text" | "reasoning"; content: string }[] = [];
		let currentTextContent = "";
		let currentReasoningContent = "";
		let chunkCount = 0;
		let pendingToolCall: {
			id: string;
			name: string;
			args: Record<string, any>;
		} | null = null;

		for await (const chunk of fullStream) {
			switch (chunk.type) {
				case "text-delta":
					if ("text" in chunk && typeof chunk.text === "string") {
						// If we were accumulating reasoning, flush it first
						if (currentReasoningContent) {
							parts.push({
								type: "reasoning",
								content: currentReasoningContent,
							});
							currentReasoningContent = "";
						}
						currentTextContent += chunk.text;
						chunkCount++;
						// Delta streaming - immediate UI feedback
						await this.streamWriter.writeChunk(assistantMessageId, chunk.text);
					}
					break;

				case "reasoning-delta":
					if ("delta" in chunk && typeof chunk.delta === "string") {
						// If we were accumulating text, flush it first
						if (currentTextContent) {
							parts.push({ type: "text", content: currentTextContent });
							currentTextContent = "";
						}
						// Handle reasoning chunks (Claude thinking)
						currentReasoningContent += chunk.delta;
						chunkCount++;
						await this.streamWriter.writeChunk(assistantMessageId, chunk.delta);
					}
					break;

				case "tool-call":
					// Flush any pending content before tool call
					if (currentTextContent) {
						parts.push({ type: "text", content: currentTextContent });
						currentTextContent = "";
					}
					if (currentReasoningContent) {
						parts.push({ type: "reasoning", content: currentReasoningContent });
						currentReasoningContent = "";
					}
					// Store tool call for QStash scheduling - don't execute immediately
					pendingToolCall = {
						id: chunk.toolCallId,
						name: chunk.toolName,
						args: chunk.input,
					};
					// Write tool call to delta stream for UI
					await this.streamWriter.writeToolCall(assistantMessageId, {
						type: "tool-call",
						toolCallId: chunk.toolCallId,
						toolName: chunk.toolName,
						args: chunk.input,
					});
					// Also write tool call event for tracking
					await this.eventWriter.writeAgentToolCall(
						sessionId,
						this.config.name,
						chunk.toolName,
						chunk.toolCallId,
					);
					break;

				case "finish-step":
				case "finish":
					// Flush any remaining content
					if (currentTextContent) {
						parts.push({ type: "text", content: currentTextContent });
						currentTextContent = "";
					}
					if (currentReasoningContent) {
						parts.push({ type: "reasoning", content: currentReasoningContent });
						currentReasoningContent = "";
					}
					break;
			}
		}

		// Final flush in case there's any remaining content
		if (currentTextContent) {
			parts.push({ type: "text", content: currentTextContent });
		}
		if (currentReasoningContent) {
			parts.push({ type: "reasoning", content: currentReasoningContent });
		}

		// Write the assistant message WITHOUT completing stream
		// Check if the message already exists
		const existingMessages = await this.messageReader.getMessages(sessionId);
		const existingMessage = existingMessages.find(
			(m) => m.id === assistantMessageId,
		);

		if (
			existingMessage?.parts &&
			existingMessage.parts.length > 0
		) {
			// Message already exists - append new parts if any
			if (parts.length > 0) {
				// This is a subsequent response after tool execution
				// Append the new parts to the existing message
				const newParts = parts.map((part) => ({
					type: part.type,
					text: part.content,
				}));
				await this.messageWriter.appendMessageParts(
					sessionId,
					assistantMessageId,
					newParts,
				);
			}
		} else if (parts.length > 0 || pendingToolCall) {
			// First time writing this message
			const assistantMessage: UIMessage = {
				id: assistantMessageId,
				role: "assistant",
				parts: [] as any[],
			};

			// Add all parts in order
			for (const part of parts) {
				assistantMessage.parts.push({ type: part.type, text: part.content });
			}

			// DO NOT SAVE TOOL-CALL PARTS IN V2
			// In v2 architecture, tool calls are handled by the distributed state machine (QStash)
			// Only tool results need to be persisted in the database for conversation history
			// The tool-call part is redundant and can cause issues with message reconstruction
			//
			// if (pendingToolCall) {
			//     // Tool call part following AI SDK format
			//     const toolCallPart: any = {
			//         type: "tool-call",
			//         toolCallId: pendingToolCall.id,
			//         toolName: pendingToolCall.name,
			//         args: pendingToolCall.args,
			//     };
			//     assistantMessage.parts.push(toolCallPart);
			// }

			// Write the new message
			await this.messageWriter.writeUIMessage(
				sessionId,
				resourceId,
				assistantMessage,
			);
		}

		// Return decision based on what streamText naturally decided
		const decision: AgentDecision = pendingToolCall
			? { toolCall: pendingToolCall }
			: {}; // No tool needed

		// Calculate full content from all parts
		const fullContent = parts.map((p) => p.content).join("");

		return { decision, chunkCount, fullContent };
	}
}
