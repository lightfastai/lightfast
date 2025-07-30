/**
 * Agent Runtime - Executes agent loops and tools with event tracking
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import { EventWriter } from "../events/event-writer";
import type { AgentLoopInitEvent, AgentToolCallEvent, Message } from "../events/types";
import { getSessionKey } from "../keys";
import type { AgentLoopStepEvent, QStashClient, Runtime, SessionState, ToolRegistry } from "./types";

export class AgentRuntime implements Runtime {
	private eventWriter: EventWriter;

	constructor(
		private redis: Redis,
		private qstash: QStashClient,
	) {
		this.eventWriter = new EventWriter(redis);
	}

	/**
	 * Initialize a new agent loop
	 */
	async initAgentLoop<TRuntimeContext = unknown>({
		event,
		agent,
		baseUrl,
	}: {
		event: AgentLoopInitEvent;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void> {
		const { sessionId, data } = event;

		// Track loop start
		const userMessage = data.messages.find((m: Message) => m.role === "user");
		await this.eventWriter.writeAgentLoopStart(sessionId, agent.getName(), userMessage?.content || "");

		// Save initial state
		const state: SessionState = {
			messages: data.messages,
			stepIndex: 0,
			startTime: Date.now(),
			toolCallCount: 0,
			agentId: agent.getName(),
			temperature: data.temperature,
		};
		await this.saveSessionState(sessionId, state);

		// Execute first step
		await this.executeStep({
			sessionId,
			agent,
			messages: data.messages,
			stepIndex: 0,
			baseUrl,
		});
	}

	/**
	 * Execute one step of the agent loop
	 */
	async executeAgentStep<TRuntimeContext = unknown>({
		event,
		agent,
		baseUrl,
	}: {
		event: AgentLoopStepEvent;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void> {
		const { sessionId, data } = event;

		// Get session state
		const state = await this.getSessionState(sessionId);
		if (!state) {
			throw new Error(`Session state not found for ${sessionId}`);
		}

		// Add tool results to messages if any
		if (data.toolResults) {
			for (const result of data.toolResults) {
				state.messages.push({
					role: "tool",
					content: JSON.stringify(result.output),
					toolCallId: result.toolCallId,
				});
			}
		}

		// Execute next step
		await this.executeStep({
			sessionId,
			agent,
			messages: state.messages,
			stepIndex: data.stepIndex,
			baseUrl,
		});
	}

	/**
	 * Execute a tool call
	 */
	async executeTool({
		event,
		toolRegistry,
		baseUrl,
	}: {
		event: AgentToolCallEvent;
		toolRegistry: ToolRegistry;
		baseUrl: string;
	}): Promise<void> {
		const { sessionId, data } = event;
		const startTime = Date.now();

		// Get session state to get agentId
		const state = await this.getSessionState(sessionId);
		if (!state) {
			throw new Error(`Session state not found for ${sessionId}`);
		}

		// Track tool call
		await this.eventWriter.writeAgentToolCall(sessionId, state.agentId, data.tool, data.toolCallId, data.arguments);

		try {
			// Execute tool
			const result = await toolRegistry.execute(data.tool, data.arguments);

			// Track tool result
			await this.eventWriter.writeAgentToolResult(
				sessionId,
				state.agentId,
				data.tool,
				data.toolCallId,
				result,
				Date.now() - startTime,
			);

			// Update pending tool calls
			if (state.pendingToolCalls) {
				state.pendingToolCalls = state.pendingToolCalls.filter((tc) => tc.id !== data.toolCallId);
			}

			// Store tool result in state
			const toolResults = state.toolResults || [];
			toolResults.push({
				toolCallId: data.toolCallId,
				tool: data.tool,
				output: result,
			});

			// Check if all tools for this step are complete
			if (!state.pendingToolCalls || state.pendingToolCalls.length === 0) {
				// All tools done - continue to next agent step
				await this.qstash.publishJSON({
					url: `${baseUrl}/workers/agent-loop-step`,
					body: {
						id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
						type: "agent.loop.step",
						sessionId,
						timestamp: new Date().toISOString(),
						version: "1.0",
						data: {
							toolResults,
							stepIndex: state.stepIndex + 1,
						},
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
				data.toolCallId,
			);
			throw error;
		}
	}

	/**
	 * Execute a single step of the agent loop
	 */
	private async executeStep<TRuntimeContext = unknown>(params: {
		sessionId: string;
		agent: Agent<TRuntimeContext>;
		messages: Message[];
		stepIndex: number;
		baseUrl: string;
	}): Promise<void> {
		const { sessionId, agent, messages, stepIndex, baseUrl } = params;

		// Track step start
		await this.eventWriter.writeAgentStepStart(
			sessionId,
			agent.getName(),
			stepIndex,
			messages[messages.length - 1]?.content || "",
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

		// Extract tools used
		const toolsUsed = new Set<string>();
		state.messages.forEach((msg) => {
			if (msg.role === "assistant" && msg.toolCalls) {
				msg.toolCalls.forEach((tc) => toolsUsed.add(tc.name));
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
