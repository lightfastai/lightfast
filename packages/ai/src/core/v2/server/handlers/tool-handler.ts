/**
 * Tool Handler - Handles agent tool call events
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type { AgentToolCallEvent } from "../../events/schemas";
import { getSessionKey } from "../keys";

export interface ToolHandlerDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	eventEmitter: EventEmitter;
}

/**
 * Handle agent tool call event
 */
export async function handleToolCall<TRuntimeContext = unknown>(
	toolEvent: AgentToolCallEvent,
	deps: ToolHandlerDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, eventEmitter } = deps;
	let success = false;
	let result: any;

	try {
		// Execute the tool using the agent
		result = await agent.executeTool(toolEvent.data.tool, toolEvent.data.arguments || {});
		success = true;

		// Note: Delta stream no longer handles event messages - removed event emission
	} catch (error) {
		result = { error: error instanceof Error ? error.message : String(error) };
		success = false;

		// Note: Delta stream no longer handles error messages - removed error emission
	}

	// Emit completion or failure event
	if (success) {
		await eventEmitter.emitToolExecutionComplete(toolEvent.sessionId, {
			toolCallId: toolEvent.data.toolCallId,
			tool: toolEvent.data.tool,
			result,
			duration: 500,
			attempts: 1,
		});

		// Add tool result to session messages
		await addToolResultToSession(toolEvent, result, redis);
	} else {
		await eventEmitter.emitToolExecutionFailed(toolEvent.sessionId, {
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
async function addToolResultToSession(toolEvent: AgentToolCallEvent, result: any, redis: Redis): Promise<void> {
	const sessionKey = getSessionKey(toolEvent.sessionId);
	const sessionData = await redis.get(sessionKey);

	if (sessionData) {
		const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
		session.messages.push({
			role: "tool",
			content: JSON.stringify(result),
			toolCallId: toolEvent.data.toolCallId,
			toolName: toolEvent.data.tool,
		});
		session.updatedAt = new Date().toISOString();
		await redis.set(sessionKey, JSON.stringify(session)); // No expiration
	}
}
