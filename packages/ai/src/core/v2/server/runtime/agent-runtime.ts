/**
 * Agent Runtime - Executes agent loops and tools with event tracking
 */

import type { UIMessage } from "ai";
import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import { EventWriter } from "../events/event-writer";
import { getSessionKey } from "../keys";
import { MessageReader } from "../readers/message-reader";
import type { QStashClient, Runtime, SessionState, ToolRegistry } from "./types";

export class AgentRuntime implements Runtime {
	private eventWriter: EventWriter;

	constructor(
		private redis: Redis,
		private qstash: QStashClient,
	) {
		this.eventWriter = new EventWriter(redis);
	}

	/**
	 * Execute a step of the agent loop (handles initialization automatically)
	 */
	async executeStep<TRuntimeContext = unknown>({
		sessionId,
		stepIndex,
		agent,
		baseUrl,
	}: {
		sessionId: string;
		stepIndex: number;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void> {
		// Get or initialize session state
		let state = await this.getSessionState(sessionId);

		if (!state) {
			// First step - initialize state
			const messageReader = new MessageReader(this.redis);
			const uiMessages = await messageReader.getMessages(sessionId);

			// Track loop start
			const userMessage = uiMessages.find((m) => m.role === "user");
			const userContent = userMessage?.parts?.find((p) => p.type === "text")?.text || "";
			await this.eventWriter.writeAgentLoopStart(sessionId, agent.getName(), userContent);

			// Create initial state with UIMessages
			state = {
				messages: uiMessages,
				stepIndex: 0,
				startTime: Date.now(),
				toolCallCount: 0,
				agentId: agent.getName(),
				temperature: agent.getTemperature() || 0.7,
			};
			await this.saveSessionState(sessionId, state);
		} else {
			// Continuing conversation - refresh messages from storage
			// This ensures we have all messages including the new user message
			const messageReader = new MessageReader(this.redis);
			const uiMessages = await messageReader.getMessages(sessionId);

			// Update state with fresh UIMessages
			state.messages = uiMessages;
			state.stepIndex = stepIndex;
			await this.saveSessionState(sessionId, state);

			// Track continuation
			const lastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
			if (lastUserMessage) {
				const lastUserContent = lastUserMessage.parts?.find((p) => p.type === "text")?.text || "";
				await this.eventWriter.writeAgentStepStart(
					sessionId,
					agent.getName(),
					stepIndex,
					lastUserContent,
				);
			}
		}

		// Execute the step with UIMessages
		await this._executeStepInternal({
			sessionId,
			agent,
			messages: state.messages,
			stepIndex,
			baseUrl,
		});
	}

	/**
	 * Execute a tool call
	 */
	async executeTool({
		sessionId,
		toolCallId,
		toolName,
		toolArgs,
		toolRegistry,
		baseUrl,
	}: {
		sessionId: string;
		toolCallId: string;
		toolName: string;
		toolArgs: Record<string, any>;
		toolRegistry: ToolRegistry;
		baseUrl: string;
	}): Promise<void> {
		const startTime = Date.now();

		// Get session state
		const state = await this.getSessionState(sessionId);
		if (!state) {
			throw new Error(`Session state not found for ${sessionId}`);
		}

		// Track tool call
		await this.eventWriter.writeAgentToolCall(sessionId, state.agentId, toolName, toolCallId, toolArgs);

		try {
			// Execute tool
			const result = await toolRegistry.execute(toolName, toolArgs);

			// Track tool result
			await this.eventWriter.writeAgentToolResult(
				sessionId,
				state.agentId,
				toolName,
				toolCallId,
				result,
				Date.now() - startTime,
			);

			// Update pending tool calls
			if (state.pendingToolCalls) {
				state.pendingToolCalls = state.pendingToolCalls.filter((tc) => tc.id !== toolCallId);
			}

			// Store tool result in state
			const toolResults = state.toolResults || [];
			toolResults.push({
				toolCallId,
				tool: toolName,
				output: result,
			});

			// Check if all tools for this step are complete
			if (!state.pendingToolCalls || state.pendingToolCalls.length === 0) {
				// All tools done - continue to next agent step
				await this.qstash.publishJSON({
					url: `${baseUrl}/workers/agent-loop-step`,
					body: {
						sessionId,
						stepIndex: state.stepIndex + 1,
					},
				});
			} else {
				// Save updated state with tool results
				await this.saveSessionState(sessionId, { ...state, toolResults });
			}
		} catch (error) {
			await this.eventWriter.writeAgentError(
				sessionId,
				state.agentId,
				error instanceof Error ? error.message : String(error),
				"TOOL_ERROR",
				undefined,
				toolCallId,
			);
			throw error;
		}
	}

	/**
	 * Execute a single step of the agent loop (internal implementation)
	 */
	private async _executeStepInternal<TRuntimeContext = unknown>(params: {
		sessionId: string;
		agent: Agent<TRuntimeContext>;
		messages: UIMessage[];
		stepIndex: number;
		baseUrl: string;
	}): Promise<void> {
		const { sessionId, agent, messages, stepIndex, baseUrl } = params;

		// Track step start
		const lastMessage = messages[messages.length - 1];
		const lastMessageContent = lastMessage?.parts?.find((p) => p.type === "text")?.text || "";
		await this.eventWriter.writeAgentStepStart(
			sessionId,
			agent.getName(),
			stepIndex,
			lastMessageContent,
		);

		const stepStartTime = Date.now();

		try {
			// Get current state
			const state = await this.getSessionState(sessionId);
			if (!state) {
				throw new Error(`Session state not found for ${sessionId}`);
			}

			// Agent makes decision and streams response
			const { decision, chunkCount, fullContent } = await agent.makeDecisionForRuntime(
				sessionId,
				messages,
				state.temperature || 0.7,
			);

			// The agent has already written the assistant message during streaming
			// We just need to get the latest messages from state
			const updatedState = await this.getSessionState(sessionId);
			if (!updatedState) {
				throw new Error(`Session state not found after decision for ${sessionId}`);
			}

			// Update state
			updatedState.stepIndex = stepIndex;
			await this.saveSessionState(sessionId, updatedState);

			// Track step complete
			await this.eventWriter.writeAgentStepComplete(
				sessionId,
				agent.getName(),
				stepIndex,
				fullContent,
				Date.now() - stepStartTime,
			);

			if (decision.toolCall) {
				// Agent wants to call a tool
				updatedState.pendingToolCalls = [
					{
						id: decision.toolCall.id,
						name: decision.toolCall.name,
						args: decision.toolCall.args,
					},
				];
				updatedState.toolCallCount += 1;
				await this.saveSessionState(sessionId, updatedState);

				// Publish tool call event
				await this.qstash.publishJSON({
					url: `${baseUrl}/workers/agent-tool-call`,
					body: {
						id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
						type: "agent.tool.call",
						sessionId,
						timestamp: new Date().toISOString(),
						version: "1.0",
						data: {
							toolCallId: decision.toolCall.id,
							tool: decision.toolCall.name,
							arguments: decision.toolCall.args,
							iteration: stepIndex,
							priority: "normal",
						},
					},
				});
			} else {
				// No tools - complete the loop
				await this.completeAgentLoop(sessionId, agent.getName(), fullContent, updatedState, baseUrl);
			}
		} catch (error) {
			await this.eventWriter.writeAgentError(
				sessionId,
				agent.getName(),
				error instanceof Error ? error.message : String(error),
				"AGENT_STEP_ERROR",
				stepIndex,
			);
			throw error;
		}
	}

	/**
	 * Complete the agent loop
	 */
	private async completeAgentLoop(
		sessionId: string,
		agentId: string,
		output: string,
		state: SessionState,
		baseUrl: string,
	): Promise<void> {
		// Track completion
		await this.eventWriter.writeAgentLoopComplete(
			sessionId,
			agentId,
			output,
			Date.now() - state.startTime,
			state.toolCallCount,
			state.stepIndex + 1,
		);

		// Extract tools used from UIMessage parts
		const toolsUsed = new Set<string>();
		state.messages.forEach((msg) => {
			if (msg.role === "assistant" && msg.parts) {
				msg.parts.forEach((part) => {
					if (part.type.startsWith("tool-call-")) {
						// Extract tool name from tool-call part
						const toolName = (part as any).toolName;
						if (toolName) {
							toolsUsed.add(toolName);
						}
					}
				});
			}
		});

		// Publish completion event
		await this.qstash.publishJSON({
			url: `${baseUrl}/workers/agent-loop-complete`,
			body: {
				id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
				type: "agent.loop.complete",
				sessionId,
				timestamp: new Date().toISOString(),
				version: "1.0",
				data: {
					finalMessage: output,
					iterations: state.stepIndex + 1,
					toolsUsed: Array.from(toolsUsed),
					duration: Date.now() - state.startTime,
				},
			},
		});

		// Clean up state
		await this.redis.del(getSessionKey(sessionId));
	}

	/**
	 * Get session state from Redis
	 */
	private async getSessionState(sessionId: string): Promise<SessionState | null> {
		const key = getSessionKey(sessionId);
		const data = await this.redis.get(key);
		return data as SessionState | null;
	}

	/**
	 * Save session state to Redis
	 */
	private async saveSessionState(sessionId: string, state: SessionState): Promise<void> {
		const key = getSessionKey(sessionId);
		await this.redis.set(key, state);
	}
}
