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

			// CRITICAL: Add step-start part to separate loop iterations
			// This prevents tool calls from previous steps being incorrectly grouped
			if (stepIndex > 0) {
				const messageWriter = new MessageWriter(this.redis);
				await messageWriter.appendMessageParts(sessionId, assistantMessageId, [{ type: "step-start" }]);
			}
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
		await this.eventWriter.writeAgentToolCall(sessionId, state.agentId, toolName, toolCallId);

		// Log to structured logger
		this.logger.logEvent(LogEventName.AGENT_TOOL_CALL, {
			sessionId,
			agentId: state.agentId,
			toolName,
			toolCallId,
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
				Date.now() - startTime,
			);

			// Log to structured logger
			this.logger.logEvent(LogEventName.AGENT_TOOL_RESULT, {
				sessionId,
				agentId: state.agentId,
				toolName,
				toolCallId,
				duration: Date.now() - startTime,
				timestamp: new Date().toISOString(),
			});

			// Update pending tool calls and save state
			if (state.pendingToolCalls) {
				state.pendingToolCalls = state.pendingToolCalls.filter((tc) => tc.id !== toolCallId);
				await this.saveSessionState(sessionId, state);
			}

			// Write tool result to delta stream
			const streamWriter = new StreamWriter(this.redis);
			console.log(`[AgentRuntime] Writing tool result to stream:`, {
				streamId: state.assistantMessageId,
				toolCallId,
				toolName,
				result: typeof result === 'object' ? JSON.stringify(result).slice(0, 100) + '...' : result,
			});
			await streamWriter.writeToolResult(state.assistantMessageId, {
				toolCallId,
				toolName,
				result,
			});

			// Write tool result as part of the assistant message
			const messageWriter = new MessageWriter(this.redis);
			const messageReader = new MessageReader(this.redis);

			// Get the current assistant message
			const assistantMessage = await messageReader.getMessage(sessionId, state.assistantMessageId);

			if (assistantMessage && assistantMessage.parts) {
				// Add tool result part using AI SDK v5 format
				// Tool parts use type: "tool-{toolName}" and state to indicate result
				const toolResultPart: any = {
					type: `tool-${toolName}`,
					toolCallId,
					state: "output-available",
					input: toolArgs,
					output: result,
				};

				// Append the tool result part to the existing message
				await messageWriter.appendMessageParts(sessionId, state.assistantMessageId, [toolResultPart]);
			} else {
				throw new Error(`Assistant message not found: ${state.assistantMessageId}`);
			}

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

			// Write error tool result to delta stream
			const streamWriter = new StreamWriter(this.redis);
			console.log(`[AgentRuntime] Writing tool error to stream:`, {
				streamId: state.assistantMessageId,
				toolCallId,
				toolName,
				error: error instanceof Error ? error.message : String(error),
			});
			await streamWriter.writeToolResult(state.assistantMessageId, {
				toolCallId,
				toolName,
				result: {
					error: error instanceof Error ? error.message : String(error),
				},
			});

			// Write error tool result as part of the assistant message
			const messageWriter = new MessageWriter(this.redis);
			const messageReader = new MessageReader(this.redis);

			const assistantMessage = await messageReader.getMessage(sessionId, state.assistantMessageId);

			if (assistantMessage && assistantMessage.parts) {
				// Add error tool result part using AI SDK v5 format
				// Tool parts use type: "tool-{toolName}" and state to indicate error
				const errorResultPart: any = {
					type: `tool-${toolName}`,
					toolCallId,
					state: "output-error", // Error case
					// For errors, AI SDK expects errorText field
					errorText: error instanceof Error ? error.message : String(error),
				};

				// Append the error result part to the existing message
				await messageWriter.appendMessageParts(sessionId, state.assistantMessageId, [errorResultPart]);
			}

			// Update pending tool calls and save state
			if (state.pendingToolCalls) {
				state.pendingToolCalls = state.pendingToolCalls.filter((tc) => tc.id !== toolCallId);
				await this.saveSessionState(sessionId, state);
			}

			// Continue to next step even on error
			// Check if all pending tool calls are done
			if (!state.pendingToolCalls || state.pendingToolCalls.length === 0) {
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
				await this.completeAgentLoop(sessionId, agent.getName(), updatedState, baseUrl);
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
			Date.now() - state.startTime,
			state.toolCallCount,
			state.stepIndex + 1,
		);

		// Log to structured logger
		this.logger.logEvent(LogEventName.AGENT_LOOP_COMPLETE, {
			sessionId,
			agentId,
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
			// Look for tool-call and tool result parts in assistant messages
			if (msg.role === "assistant" && msg.parts) {
				msg.parts.forEach((part) => {
					// Tool call part
					if (part.type === "tool-call" && (part as any).toolName) {
						toolsUsed.add((part as any).toolName);
					}
					// Tool result part (type: tool-{toolName} with state)
					if (part.type.startsWith("tool-") && (part as any).state === "output-available") {
						// Extract tool name from type
						const toolName = part.type.split("-").slice(1).join("-");
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
