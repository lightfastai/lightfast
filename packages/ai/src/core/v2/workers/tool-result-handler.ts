/**
 * Handler for processing tool execution results
 * Continues the agent loop after tool execution
 */

import type { Redis } from "@upstash/redis";
import type { EventEmitter, SessionEventEmitter } from "../events/emitter";
import type { ToolExecutionCompleteEvent, ToolExecutionFailedEvent } from "../events/schemas";
import { AgentLoopWorker } from "./agent-loop";
import type { AgentSessionState } from "./schemas";

export class ToolResultHandler {
	private agentLoopWorker: AgentLoopWorker;

	constructor(
		private redis: Redis,
		private eventEmitter: EventEmitter,
	) {
		this.agentLoopWorker = new AgentLoopWorker(redis, eventEmitter);
	}

	/**
	 * Handle tool execution complete event
	 */
	async handleToolComplete(event: ToolExecutionCompleteEvent): Promise<void> {
		const sessionEmitter = this.eventEmitter.forSession(event.sessionId);

		try {
			// Load session
			const sessionKey = `session:${event.sessionId}`;
			const sessionData = await this.redis.get(sessionKey);
			if (!sessionData) {
				throw new Error(`Session ${event.sessionId} not found`);
			}

			const session = JSON.parse(sessionData as string) as AgentSessionState;

			// Add tool result to messages
			session.messages.push({
				role: "tool",
				content: JSON.stringify(event.data.result),
				toolCallId: event.data.toolCallId,
				toolName: event.data.tool,
			});

			// Update session
			session.updatedAt = new Date().toISOString();
			await this.redis.setex(sessionKey, 86400, JSON.stringify(session));

			// Write to stream
			const streamKey = `stream:${event.sessionId}`;
			await this.redis.xadd(streamKey, "*", {
				type: "event",
				content: `Tool ${event.data.tool} completed`,
				metadata: JSON.stringify({
					event: "tool.result.received",
					tool: event.data.tool,
					toolCallId: event.data.toolCallId,
				}),
			});

			// Continue the agent loop
			await this.agentLoopWorker.processEvent({
				id: `evt_continue_${Date.now()}`,
				type: "agent.loop.init",
				sessionId: event.sessionId,
				timestamp: new Date().toISOString(),
				version: "1.0",
				data: {
					messages: session.messages,
					systemPrompt: session.systemPrompt,
					temperature: session.temperature,
					maxIterations: session.maxIterations,
					tools: session.tools,
					metadata: {
						...session.metadata,
						continuedFromTool: event.data.tool,
					},
				},
			});
		} catch (error) {
			console.error(`[ToolResultHandler] Error handling tool complete:`, error);
			await sessionEmitter.emitAgentLoopError({
				error: error instanceof Error ? error.message : String(error),
				code: "TOOL_RESULT_HANDLER_ERROR",
				iteration: 0,
				recoverable: false,
			});
			throw error;
		}
	}

	/**
	 * Handle tool execution failed event
	 */
	async handleToolFailed(event: ToolExecutionFailedEvent): Promise<void> {
		const sessionEmitter = this.eventEmitter.forSession(event.sessionId);

		try {
			// Load session
			const sessionKey = `session:${event.sessionId}`;
			const sessionData = await this.redis.get(sessionKey);
			if (!sessionData) {
				throw new Error(`Session ${event.sessionId} not found`);
			}

			const session = JSON.parse(sessionData as string) as AgentSessionState;

			// Add error message
			session.messages.push({
				role: "tool",
				content: `Error: ${event.data.error}`,
				toolCallId: event.data.toolCallId,
				toolName: event.data.tool,
			});

			// Update session
			session.updatedAt = new Date().toISOString();
			await this.redis.setex(sessionKey, 86400, JSON.stringify(session));

			// Write to stream
			const streamKey = `stream:${event.sessionId}`;
			await this.redis.xadd(streamKey, "*", {
				type: "error",
				content: `Tool ${event.data.tool} failed: ${event.data.error}`,
				metadata: JSON.stringify({
					event: "tool.result.error",
					tool: event.data.tool,
					toolCallId: event.data.toolCallId,
				}),
			});

			// Continue the agent loop with error context
			await this.agentLoopWorker.processEvent({
				id: `evt_continue_error_${Date.now()}`,
				type: "agent.loop.init",
				sessionId: event.sessionId,
				timestamp: new Date().toISOString(),
				version: "1.0",
				data: {
					messages: session.messages,
					systemPrompt: session.systemPrompt,
					temperature: session.temperature,
					maxIterations: session.maxIterations,
					tools: session.tools,
					metadata: {
						...session.metadata,
						toolError: {
							tool: event.data.tool,
							error: event.data.error,
						},
					},
				},
			});
		} catch (error) {
			console.error(`[ToolResultHandler] Error handling tool failure:`, error);
			await sessionEmitter.emitAgentLoopError({
				error: error instanceof Error ? error.message : String(error),
				code: "TOOL_RESULT_HANDLER_ERROR",
				iteration: 0,
				recoverable: false,
			});
			throw error;
		}
	}
}