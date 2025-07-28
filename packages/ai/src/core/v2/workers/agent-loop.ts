/**
 * AgentLoopWorker - Core logic for processing agent loop events
 */

import { streamText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import type { Redis } from "@upstash/redis";
import { z } from "zod";
import { type EventEmitter, type SessionEventEmitter } from "../events/emitter";
import { type AgentLoopInitEvent, type Message } from "../events/schemas";
import { createStreamWriter, type StreamWriter } from "../server/stream-writer";
import {
	AgentDecisionSchema,
	type AgentDecision,
	type AgentSessionState,
	AgentSessionStateSchema,
	type WorkerConfig,
} from "./schemas";

export class AgentLoopWorker {
	private streamWriter: StreamWriter;

	constructor(
		private redis: Redis,
		private eventEmitter: EventEmitter,
		private config: Partial<WorkerConfig> = {},
	) {
		this.streamWriter = createStreamWriter(redis);
		// Apply defaults
		this.config = {
			maxExecutionTime: 25000,
			retryAttempts: 3,
			retryDelay: 1000,
			...config,
		};
	}

	/**
	 * Process an agent loop init event
	 */
	async processEvent(event: AgentLoopInitEvent): Promise<void> {
		const startTime = Date.now();
		const sessionEmitter = this.eventEmitter.forSession(event.sessionId);

		try {
			// Load session state
			const session = await this.loadSession(event.sessionId);
			if (!session) {
				throw new Error(`Session ${event.sessionId} not found`);
			}

			// Update session status
			await this.updateSessionStatus(event.sessionId, "processing");

			// Write status to stream
			await this.writeToStream(event.sessionId, {
				type: "event",
				content: "Agent loop started",
				metadata: JSON.stringify({
					event: "agent.loop.start",
					iteration: session.iteration + 1,
				}),
			});

			// Process the agent loop
			await this.runAgentLoop(session, sessionEmitter);
		} catch (error) {
			console.error(`[AgentLoopWorker] Error processing event ${event.id}:`, error);


			// Update session status
			await this.updateSessionStatus(event.sessionId, "error");

			// Write error to stream
			await this.writeToStream(event.sessionId, {
				type: "error",
				content: error instanceof Error ? error.message : "Unknown error",
				metadata: JSON.stringify({
					event: "agent.loop.error",
					duration: Date.now() - startTime,
				}),
			});

			throw error;
		}
	}

	/**
	 * Run the main agent loop
	 */
	private async runAgentLoop(session: AgentSessionState, sessionEmitter: SessionEventEmitter): Promise<void> {
		const startTime = Date.now();

		// Check iteration limit
		if (session.iteration >= session.maxIterations) {
			await sessionEmitter.emitAgentLoopComplete({
				finalMessage: "Maximum iterations reached. Please start a new conversation if you need further assistance.",
				iterations: session.iteration,
				toolsUsed: this.extractUsedTools(session.messages),
				duration: Date.now() - startTime,
			});
			await this.updateSessionStatus(session.sessionId, "completed");
			return;
		}

		// Make a decision using streamText for immediate feedback
		const decision = await this.makeDecision(session, sessionEmitter);

		// Update iteration count
		await this.incrementIteration(session.sessionId);

		// Handle the decision
		switch (decision.action) {
			case "tool_call":
				await this.handleToolCall(session, decision, sessionEmitter);
				break;

			case "respond":
				await this.handleResponse(session, decision, sessionEmitter, startTime);
				break;

			case "clarify":
				await this.handleClarification(session, decision, sessionEmitter, startTime);
				break;
		}
	}

	/**
	 * Make a decision using streamText for immediate feedback
	 */
	private async makeDecision(session: AgentSessionState, sessionEmitter: SessionEventEmitter): Promise<AgentDecision> {
		// Build the system prompt
		const systemPrompt = this.buildSystemPrompt(session);

		// Prepare messages for the model
		const messages = this.prepareMessages(session.messages);

		let finalDecision: AgentDecision | null = null;

		// Create a prompt that will naturally generate structured output
		const structuredPrompt = `${systemPrompt}

Please analyze the conversation and respond with your decision in the following JSON format:
{
  "action": "tool_call" | "respond" | "clarify",
  "reasoning": "your reasoning here",
  "toolCall": { "tool": "tool_name", "arguments": {...} } // only if action is tool_call
  "response": "your response text" // only if action is respond
  "clarification": "your clarification question" // only if action is clarify
}

Think through this step by step first, then provide your JSON decision.`;

		// Stream the decision-making process
		const { textStream } = await streamText({
			model: gateway("anthropic/claude-3-5-sonnet-latest"),
			system: structuredPrompt,
			messages,
			temperature: session.temperature,
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
					console.error(`[AgentLoopWorker] Failed to parse decision from text:`, error);
				}
				
				// Log the decision
				console.log(`[AgentLoopWorker] Decision for session ${session.sessionId}:`, {
					action: finalDecision?.action,
					reasoning: finalDecision?.reasoning,
					tool: finalDecision?.toolCall?.tool,
				});
			},
		});

		// Stream the thinking process to Redis
		for await (const chunk of textStream) {
			if (chunk) {
				await this.writeToStream(session.sessionId, {
					type: "thinking",
					content: chunk,
					metadata: JSON.stringify({
						event: "agent.thinking",
						iteration: session.iteration + 1,
					}),
				});
			}
		}
		
		if (!finalDecision) {
			throw new Error("Failed to get structured decision from streamText");
		}

		return finalDecision;
	}

	/**
	 * Build the system prompt for the agent
	 */
	private buildSystemPrompt(session: AgentSessionState): string {
		const toolsSection = session.tools?.length
			? `
Available Tools:
${session.tools.map((tool) => `- ${tool}: ${this.getToolDescription(tool)}`).join("\n")}

When you need to use a tool, set action to "tool_call" and provide the tool name and arguments.
`
			: "";

		return `${session.systemPrompt || "You are a helpful AI assistant."}

Your task is to help the user by analyzing their request and deciding on the best action to take.

You must respond with one of these actions:
1. "tool_call" - Use a tool to gather information or perform an action
2. "respond" - Provide a final response to the user
3. "clarify" - Ask for clarification if the request is unclear

${toolsSection}

Current iteration: ${session.iteration + 1}/${session.maxIterations}

Think through your reasoning step by step, then make your decision. Always provide clear reasoning for your decision.`;
	}

	/**
	 * Get tool description (would be loaded from tool registry in production)
	 */
	private getToolDescription(tool: string): string {
		const descriptions: Record<string, string> = {
			calculator: "Performs mathematical calculations",
			weather: "Gets current weather information for a location",
			search: "Searches the web for information",
		};
		return descriptions[tool] || "Tool for various operations";
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

		// Add assistant message with tool decision
		await this.addMessage(session.sessionId, {
			role: "assistant",
			content: `I'll use the ${decision.toolCall.tool} tool to help with your request. ${decision.reasoning}`,
		});

		// Write to stream
		await this.writeToStream(session.sessionId, {
			type: "chunk",
			content: `Using ${decision.toolCall.tool} tool...`,
			metadata: JSON.stringify({
				event: "agent.tool.decision",
				tool: decision.toolCall.tool,
				reasoning: decision.reasoning,
			}),
		});

		// Emit tool call event
		await sessionEmitter.emitAgentToolCall({
			toolCallId,
			tool: decision.toolCall.tool,
			arguments: decision.toolCall.arguments,
			iteration: session.iteration + 1,
			priority: "normal",
		});

		// Update session status
		await this.updateSessionStatus(session.sessionId, "waiting_for_tool");
	}

	/**
	 * Handle response decision (streaming already happened in makeDecision)
	 */
	private async handleResponse(
		session: AgentSessionState,
		decision: AgentDecision,
		sessionEmitter: SessionEventEmitter,
		startTime: number,
	): Promise<void> {
		if (!decision.response) {
			throw new Error("Response decision without response content");
		}

		// Add assistant message to conversation history
		await this.addMessage(session.sessionId, {
			role: "assistant",
			content: decision.response,
		});

		// Write final response to stream
		await this.writeToStream(session.sessionId, {
			type: "chunk",
			content: decision.response,
			metadata: JSON.stringify({
				event: "agent.response",
				reasoning: decision.reasoning,
			}),
		});

		// Emit completion event
		await sessionEmitter.emitAgentLoopComplete({
			finalMessage: decision.response,
			iterations: session.iteration + 1,
			toolsUsed: this.extractUsedTools(session.messages),
			duration: Date.now() - startTime,
		});

		// Update session status
		await this.updateSessionStatus(session.sessionId, "completed");
	}

	/**
	 * Handle clarification decision (streaming already happened in makeDecision)
	 */
	private async handleClarification(
		session: AgentSessionState,
		decision: AgentDecision,
		sessionEmitter: SessionEventEmitter,
		startTime: number,
	): Promise<void> {
		if (!decision.clarification) {
			throw new Error("Clarification decision without clarification content");
		}

		// Add assistant message to conversation history
		await this.addMessage(session.sessionId, {
			role: "assistant",
			content: decision.clarification,
		});

		// Write clarification to stream
		await this.writeToStream(session.sessionId, {
			type: "chunk",
			content: decision.clarification,
			metadata: JSON.stringify({
				event: "agent.clarification",
				reasoning: decision.reasoning,
			}),
		});

		// For now, treat clarification as completion
		// In a real system, we'd wait for user response
		await sessionEmitter.emitAgentLoopComplete({
			finalMessage: decision.clarification,
			iterations: session.iteration + 1,
			toolsUsed: this.extractUsedTools(session.messages),
			duration: Date.now() - startTime,
		});

		// Update session status
		await this.updateSessionStatus(session.sessionId, "completed");
	}

	/**
	 * Helper methods for session management
	 */
	private async loadSession(sessionId: string): Promise<AgentSessionState | null> {
		const sessionKey = `session:${sessionId}`;
		const data = await this.redis.get(sessionKey);
		if (!data) return null;

		// Handle both string and object responses from Redis
		const parsed = typeof data === "string" ? JSON.parse(data) : data;
		return AgentSessionStateSchema.parse(parsed);
	}

	private async updateSessionStatus(sessionId: string, status: AgentSessionState["status"]): Promise<void> {
		const sessionKey = `session:${sessionId}`;
		const session = await this.loadSession(sessionId);
		if (!session) return;

		session.status = status;
		session.updatedAt = new Date().toISOString();

		await this.redis.setex(sessionKey, 86400, JSON.stringify(session));
	}

	private async incrementIteration(sessionId: string): Promise<void> {
		const sessionKey = `session:${sessionId}`;
		const session = await this.loadSession(sessionId);
		if (!session) return;

		session.iteration += 1;
		session.updatedAt = new Date().toISOString();

		await this.redis.setex(sessionKey, 86400, JSON.stringify(session));
	}

	private async addMessage(sessionId: string, message: Message): Promise<void> {
		const sessionKey = `session:${sessionId}`;
		const session = await this.loadSession(sessionId);
		if (!session) return;

		session.messages.push(message);
		session.updatedAt = new Date().toISOString();

		await this.redis.setex(sessionKey, 86400, JSON.stringify(session));
	}

	private async writeToStream(sessionId: string, data: Record<string, string>): Promise<void> {
		const streamKey = `stream:${sessionId}`;
		await this.redis.xadd(streamKey, "*", data);
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