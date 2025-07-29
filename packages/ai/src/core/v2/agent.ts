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
import type { EventEmitter, SessionEventEmitter } from "./events/emitter";
import type { AgentLoopInitEvent, Message } from "./events/schemas";
import { getDeltaStreamKey } from "./server/keys";
import { StreamWriter } from "./server/stream/stream-writer";
import { StreamStatus } from "./server/stream/types";
import { EventWriter } from "./server/writers/event-writer";
import { MessageWriter } from "./server/writers/message-writer";
import {
	type AgentDecision,
	AgentDecisionSchema,
	type AgentSessionState,
	AgentSessionStateSchema,
	type WorkerConfig,
} from "./workers/schemas";

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
	maxIterations?: number; // Agent-specific, not from streamText
	// Allow passing commonly used streamText options directly
	experimental_transform?: StreamTextParameters<ToolSet>["experimental_transform"];
}

export class Agent<TRuntimeContext = unknown> {
	public readonly config: AgentConfig;
	private systemPrompt: string;
	private maxIterations: number;
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
		private eventEmitter: EventEmitter,
		workerConfig: Partial<WorkerConfig> = {},
	) {
		// Destructure agent-specific properties from streamText config
		const {
			systemPrompt,
			tools,
			createRuntimeContext,
			maxIterations = 10,
			experimental_transform,
			...streamTextConfig
		} = options;

		// Store agent-specific properties
		this.systemPrompt = systemPrompt;
		this.maxIterations = maxIterations;
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
	 * Process an agent loop init event
	 */
	async processEvent(event: AgentLoopInitEvent): Promise<void> {
		const startTime = Date.now();
		const sessionEmitter = this.eventEmitter.forSession(event.sessionId);

		try {
			// Create session state from event data
			const session: AgentSessionState = {
				sessionId: event.sessionId,
				messages: event.data.messages,
				status: "processing",
				iteration: 0,
				maxIterations: event.data.maxIterations,
				temperature: event.data.temperature,
				tools: event.data.tools,
				systemPrompt: event.data.systemPrompt,
				metadata: event.data.metadata,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			// Write status event
			await this.eventWriter.writeEvent(event.sessionId, "event", {
				event: "agent.loop.start",
				iteration: session.iteration + 1,
			});

			// Process the agent loop
			await this.runAgentLoop(session, sessionEmitter);
		} catch (error) {
			console.error(`[Agent ${this.config.name}] Error processing event ${event.id}:`, error);

			// Write error event
			await this.eventWriter.writeErrorEvent(
				event.sessionId,
				error instanceof Error ? error.message : "Unknown error",
				"AGENT_LOOP_ERROR",
				{
					event: "agent.loop.error",
					duration: Date.now() - startTime,
				},
			);

			// Write error to delta stream
			await this.streamWriter.writeError(event.sessionId, error instanceof Error ? error.message : "Unknown error");

			throw error;
		}
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
	 * Get max iterations
	 */
	getMaxIterations(): number {
		return this.maxIterations;
	}

	/**
	 * Run the main agent loop
	 */
	private async runAgentLoop(session: AgentSessionState, sessionEmitter: SessionEventEmitter): Promise<void> {
		const startTime = Date.now();

		// Check iteration limit
		const maxIterations = this.maxIterations || session.maxIterations;
		if (session.iteration >= maxIterations) {
			// Max iterations reached
			const finalMessage =
				"Maximum iterations reached. Please start a new conversation if you need further assistance.";

			await sessionEmitter.emitAgentLoopComplete({
				finalMessage,
				iterations: session.iteration,
				toolsUsed: this.extractUsedTools(session.messages),
				duration: Date.now() - startTime,
			});

			// Write completion to delta stream
			await this.streamWriter.writeComplete(session.sessionId);
			return;
		}

		// Make a decision using streamText for immediate feedback
		const { decision, chunkCount, fullContent } = await this.makeDecision(session, sessionEmitter);

		// Update iteration count locally
		session.iteration += 1;

		// Handle the decision - only process tool calls
		if (decision.action === "tool_call") {
			await this.handleToolCall(session, decision, sessionEmitter);
		} else {
			// For non-tool actions (complete), signal completion and finish
			await sessionEmitter.emitAgentLoopComplete({
				finalMessage: "Agent loop completed",
				iterations: session.iteration + 1,
				toolsUsed: this.extractUsedTools(session.messages),
				duration: Date.now() - startTime,
			});

			// Write completion to delta stream
			await this.streamWriter.writeComplete(session.sessionId);
		}
	}

	/**
	 * Make a decision using streamText for immediate feedback
	 */
	private async makeDecision(
		session: AgentSessionState,
		sessionEmitter: SessionEventEmitter,
	): Promise<{ decision: AgentDecision; chunkCount: number; fullContent: string }> {
		// Build the system prompt
		const systemPrompt = this.buildSystemPrompt(session);

		// Prepare messages for the model
		const preparedMessages = this.prepareMessages(session.messages);

		let finalDecision: AgentDecision | null = null;
		let responseMessages: UIMessage[] = [];
		let chunkCount = 0;

		// Start of decision making (no longer emit metadata)

		// Create a prompt that will naturally generate structured output
		const structuredPrompt = `${systemPrompt}

Please analyze the conversation and decide if you need to use a tool. Respond with your decision in the following JSON format:
{
  "action": "tool_call" | "complete",
  "reasoning": "your reasoning here",
  "toolCall": { "tool": "tool_name", "arguments": {...} } // only if action is tool_call
}

Think through this step by step first, then provide your JSON decision.`;

		// Stream the decision-making process
		const { textStream } = streamText({
			...this.config, // Spread all streamText-compatible properties
			system: structuredPrompt,
			messages: preparedMessages,
			// Override with session-specific values if needed
			temperature: session.temperature ?? this.config.temperature,
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
				console.log(`[Agent ${this.config.name}] Decision for session ${session.sessionId}:`, {
					action: finalDecision?.action,
					reasoning: finalDecision?.reasoning,
					tool: finalDecision?.toolCall?.tool,
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
				await this.streamWriter.writeChunk(session.sessionId, chunk);
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
				await this.messageWriter.writeUIMessage(session.sessionId, reasoningMessage);
			}
		}

		if (!finalDecision) {
			throw new Error("Failed to get structured decision from streamText");
		}

		// Decision complete (no longer emit metadata)

		return { decision: finalDecision, chunkCount, fullContent };
	}

	/**
	 * Build the system prompt for the agent
	 */
	private buildSystemPrompt(session: AgentSessionState): string {
		const toolNames = this.getAvailableTools();
		const toolsSection = toolNames.length
			? `
Available Tools:
${toolNames.map((tool) => `- ${tool}: ${this.getToolDescription(tool, session.sessionId)}`).join("\n")}

When you need to use a tool, set action to "tool_call" and provide the tool name and arguments.
`
			: "";

		const maxIterations = this.maxIterations || session.maxIterations;

		return `${this.systemPrompt}

Your task is to help the user by analyzing their request and determining if you need to use a tool.

You must decide between:
1. "tool_call" - Use a tool to gather information or perform an action
2. "complete" - No tool is needed, the task is complete

${toolsSection}

Current iteration: ${session.iteration + 1}/${maxIterations}

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

	/**
	 * Handle tool call decision
	 */
	private async handleToolCall(
		session: AgentSessionState,
		decision: AgentDecision,
		sessionEmitter: SessionEventEmitter,
	): Promise<void> {
		if (!decision.toolCall) {
			throw new Error("Tool call decision without tool details");
		}

		const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

		// Tool call starting (no longer emit events)

		// Add assistant message with tool decision to local state
		session.messages.push({
			role: "assistant",
			content: `I'll use the ${decision.toolCall.tool} tool to help with your request. ${decision.reasoning}`,
		});

		// Write tool message with tool call part (UIMessage persistence)
		const toolMessage: UIMessage = {
			id: this.generateMessageId(),
			role: "assistant",
			parts: [
				{
					type: "text",
					text: `Using ${decision.toolCall.tool} tool...`,
				},
				{
					type: `tool-${decision.toolCall.tool}`,
					toolCallId,
					state: "input-available",
					input: decision.toolCall.arguments,
				},
			],
		};
		await this.messageWriter.writeUIMessage(session.sessionId, toolMessage);

		// Tool executing (no longer emit events)

		// Emit tool call event (existing event system)
		await sessionEmitter.emitAgentToolCall({
			toolCallId,
			tool: decision.toolCall.tool,
			arguments: decision.toolCall.arguments,
			iteration: session.iteration + 1,
			priority: "normal",
		});

		// Update local session status
		session.status = "waiting_for_tool";
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
