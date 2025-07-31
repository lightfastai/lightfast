/**
 * Agent Runtime - Executes agent loops and tools with event tracking
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Agent } from "../../agent";
import type { ILogger } from "../../logger";
import { LogEventName, noopLogger } from "../../logger";
import { EventWriter } from "../events/event-writer";
import { getMessageKey, getSessionKey } from "../keys";
import { MessageReader } from "../readers/message-reader";
import { StreamWriter } from "../stream/stream-writer";
import { MessageWriter } from "../writers/message-writer";
import type { QStashClient, Runtime, SessionState, ToolRegistry } from "./types";

export class AgentRuntime implements Runtime {
	private eventWriter: EventWriter;
	private logger: ILogger;

	constructor(
		private redis: Redis,
		private qstash: QStashClient,
		logger?: ILogger,
	) {
		this.eventWriter = new EventWriter(redis);
		this.logger = logger || noopLogger;
	}

	/**
	 * Execute a step of the agent loop (handles initialization automatically)
	 */
	async executeStep<TRuntimeContext = unknown>({
		sessionId,
		stepIndex,
		agent,
		baseUrl,
		resourceId,
		assistantMessageId,
	}: {
		sessionId: string;
		stepIndex: number;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
		resourceId: string;
		assistantMessageId: string;
	}): Promise<void> {
		// Get or initialize session state
		let state = await this.getSessionState(sessionId);

		if (!state) {
			// First step - initialize state
			// Track loop start
			await this.eventWriter.writeAgentLoopStart(sessionId, agent.getName());

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_LOOP_START, {
				sessionId,
				agentId: agent.getName(),
				timestamp: new Date().toISOString(),
			});

			// Create initial state (minimal, no messages)
			// resourceId and assistantMessageId are now strictly required
			state = {
				resourceId,
				stepIndex: 0,
				startTime: Date.now(),
				toolCallCount: 0,
				agentId: agent.getName(),
				temperature: agent.getTemperature() || 0.7,
				assistantMessageId,
			};
			await this.saveSessionState(sessionId, state);
		} else {
			// Continuing conversation - just update step index
			state.stepIndex = stepIndex;
			await this.saveSessionState(sessionId, state);

			// Track continuation
			await this.eventWriter.writeAgentStepStart(sessionId, agent.getName(), stepIndex);

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_STEP_START, {
				sessionId,
				agentId: agent.getName(),
				stepIndex,
				timestamp: new Date().toISOString(),
			});
		}

		// Execute the step - fetch fresh messages
		const messageReader = new MessageReader(this.redis);
		const messages = await messageReader.getMessages(sessionId);

		await this._executeStepInternal({
			sessionId,
			agent,
			messages,
			stepIndex,
			baseUrl,
			assistantMessageId,
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

		// Log to structured logger
		this.logger.logEvent(LogEventName.AGENT_TOOL_CALL, {
			sessionId,
			agentId: state.agentId,
			toolName,
			toolCallId,
			args: toolArgs,
			timestamp: new Date().toISOString(),
		});

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

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_TOOL_RESULT, {
				sessionId,
				agentId: state.agentId,
				toolName,
				toolCallId,
				result,
				duration: Date.now() - startTime,
				timestamp: new Date().toISOString(),
			});

			// Update pending tool calls and save state
			if (state.pendingToolCalls) {
				state.pendingToolCalls = state.pendingToolCalls.filter((tc) => tc.id !== toolCallId);
				await this.saveSessionState(sessionId, state);
			}

			// Write tool result as part of the assistant message
			const messageWriter = new MessageWriter(this.redis);

			// Create tool result part
			const toolResultPart: any = {
				type: `tool-${toolName}`,
				toolCallId,
				state: "output-available",
				input: toolArgs,
				output: result,
			};

			// Update the assistant message with the tool result part
			// This does NOT send a stream complete signal
			await messageWriter.updateMessageParts(sessionId, state.assistantMessageId, [toolResultPart]);

			// Don't store tool results in state - they're already in the messages

			// Check if all tools for this step are complete
			if (!state.pendingToolCalls || state.pendingToolCalls.length === 0) {
				// All tools done - continue to next agent step
				await this.qstash.publishJSON({
					url: `${baseUrl}/workers/agent-loop-step`,
					body: {
						sessionId,
						stepIndex: state.stepIndex + 1,
						resourceId: state.resourceId,
						assistantMessageId: state.assistantMessageId,
					},
				});
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

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_ERROR, {
				sessionId,
				agentId: state.agentId,
				error: error instanceof Error ? error.message : String(error),
				code: "TOOL_ERROR",
				toolCallId,
				timestamp: new Date().toISOString(),
			});

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
		assistantMessageId: string;
	}): Promise<void> {
		const { sessionId, agent, messages, stepIndex, baseUrl, assistantMessageId } = params;

		// Track step start
		await this.eventWriter.writeAgentStepStart(sessionId, agent.getName(), stepIndex);

		// Log to structured logger
		this.logger.logEvent(LogEventName.AGENT_STEP_START, {
			sessionId,
			agentId: agent.getName(),
			stepIndex,
			timestamp: new Date().toISOString(),
		});

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
				state.resourceId,
				messages,
				state.temperature || 0.7,
				assistantMessageId,
			);

			// The agent has already written the assistant message during streaming
			// We just need to get the latest messages from state
			const updatedState = await this.getSessionState(sessionId);
			if (!updatedState) {
				throw new Error(`Session state not found after decision for ${sessionId}`);
			}

			// Update state
			updatedState.stepIndex = stepIndex;
			updatedState.assistantMessageId = assistantMessageId;
			await this.saveSessionState(sessionId, updatedState);

			// Track step complete
			await this.eventWriter.writeAgentStepComplete(sessionId, agent.getName(), stepIndex, Date.now() - stepStartTime);

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_STEP_COMPLETE, {
				sessionId,
				agentId: agent.getName(),
				stepIndex,
				duration: Date.now() - stepStartTime,
				timestamp: new Date().toISOString(),
			});

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
						sessionId,
						toolCallId: decision.toolCall.id,
						toolName: decision.toolCall.name,
						toolArgs: decision.toolCall.args,
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

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_ERROR, {
				sessionId,
				agentId: agent.getName(),
				error: error instanceof Error ? error.message : String(error),
				code: "AGENT_STEP_ERROR",
				stepIndex,
				timestamp: new Date().toISOString(),
			});

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
		// Complete the stream now that the agent loop is done
		const streamWriter = new StreamWriter(this.redis);
		await streamWriter.writeComplete(state.assistantMessageId);
		// Track completion
		await this.eventWriter.writeAgentLoopComplete(
			sessionId,
			agentId,
			output,
			Date.now() - state.startTime,
			state.toolCallCount,
			state.stepIndex + 1,
		);

		// Log to structured logger
		this.logger.logEvent(LogEventName.AGENT_LOOP_COMPLETE, {
			sessionId,
			agentId,
			output,
			duration: Date.now() - state.startTime,
			toolCalls: state.toolCallCount,
			steps: state.stepIndex + 1,
			timestamp: new Date().toISOString(),
		});

		// Extract tools used from messages in DB
		const messageReader = new MessageReader(this.redis);
		const messages = await messageReader.getMessages(sessionId);

		const toolsUsed = new Set<string>();
		messages.forEach((msg) => {
			if (msg.role === "assistant" && msg.parts) {
				msg.parts.forEach((part) => {
					if (part.type.startsWith("tool-") && (part as any).state === "output-available") {
						// Extract tool name from type (e.g., "tool-calculator" -> "calculator")
						const toolName = part.type.replace("tool-", "");
						toolsUsed.add(toolName);
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
