/**
 * Tool Handler - Handles agent tool call events
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type { AgentToolCallEvent } from "../../events/schemas";
import { getSessionKey } from "../keys";

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
		let success = false;
		let result: any;

		try {
			// Execute the tool using the agent
			result = await this.agent.executeTool(toolEvent.data.tool, toolEvent.data.arguments || {});
			success = true;

			// Note: Delta stream no longer handles event messages - removed event emission
		} catch (error) {
			result = { error: error instanceof Error ? error.message : String(error) };
			success = false;

			// Note: Delta stream no longer handles error messages - removed error emission
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
		const sessionKey = getSessionKey(toolEvent.sessionId);
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
			await this.redis.set(sessionKey, JSON.stringify(session)); // No expiration
		}
	}
}
