/**
 * Tool Handler - Handles agent tool call events
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type { AgentToolCallEvent } from "../../events/schemas";

export class ToolHandler<TRuntimeContext = unknown> {
	constructor(
		private agent: Agent<TRuntimeContext>,
		private redis: Redis,
		private eventEmitter: EventEmitter,
	) {}

	/**
	 * Handle agent tool call event
	 */
	async handleToolCall(toolEvent: AgentToolCallEvent): Promise<Response> {
		const streamKey = `llm:stream:${toolEvent.sessionId}`;
		let success = false;
		let result: any;

		try {
			// Execute the tool using the agent
			result = await this.agent.executeTool(toolEvent.data.tool, toolEvent.data.arguments || {});
			success = true;

			// Write result to stream (with timestamp)
			await this.redis.xadd(streamKey, "*", {
				type: "event",
				content: `Tool ${toolEvent.data.tool} executed successfully`,
				event: "tool.result",
				tool: toolEvent.data.tool,
				toolCallId: toolEvent.data.toolCallId,
				result: JSON.stringify(result),
				success: String(success),
				timestamp: new Date().toISOString(),
			});
			await this.redis.publish(streamKey, JSON.stringify({ type: "event" }));
		} catch (error) {
			result = { error: error instanceof Error ? error.message : String(error) };
			success = false;

			// Write error to stream (with timestamp)
			await this.redis.xadd(streamKey, "*", {
				type: "error",
				content: `Tool ${toolEvent.data.tool} failed: ${result.error}`,
				error: result.error,
				tool: toolEvent.data.tool,
				toolCallId: toolEvent.data.toolCallId,
				timestamp: new Date().toISOString(),
			});
			await this.redis.publish(streamKey, JSON.stringify({ type: "error" }));
		}

		// Emit completion or failure event
		if (success) {
			await this.eventEmitter.emitToolExecutionComplete(toolEvent.sessionId, {
				toolCallId: toolEvent.data.toolCallId,
				tool: toolEvent.data.tool,
				result,
				duration: 500,
				attempts: 1,
			});

			// Add tool result to session messages
			await this.addToolResultToSession(toolEvent, result);
		} else {
			await this.eventEmitter.emitToolExecutionFailed(toolEvent.sessionId, {
				toolCallId: toolEvent.data.toolCallId,
				tool: toolEvent.data.tool,
				error: result.error,
				lastAttemptDuration: 500,
				attempts: 1,
			});
		}

		return Response.json({ success: true });
	}

	/**
	 * Add tool result to session messages
	 */
	private async addToolResultToSession(toolEvent: AgentToolCallEvent, result: any): Promise<void> {
		const sessionKey = `v2:session:${toolEvent.sessionId}`;
		const sessionData = await this.redis.get(sessionKey);

		if (sessionData) {
			const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
			session.messages.push({
				role: "tool",
				content: JSON.stringify(result),
				toolCallId: toolEvent.data.toolCallId,
				toolName: toolEvent.data.tool,
			});
			session.updatedAt = new Date().toISOString();
			await this.redis.setex(sessionKey, 86400, JSON.stringify(session));
		}
	}
}
