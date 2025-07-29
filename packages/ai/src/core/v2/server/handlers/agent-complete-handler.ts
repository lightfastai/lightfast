/**
 * Agent Complete Handler - Handles agent loop completion events
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { AgentLoopCompleteEvent } from "../../events/schemas";
import { getSessionKey } from "../keys";
import { EventWriter } from "../writers/event-writer";
import { MessageWriter } from "../writers/message-writer";

export interface AgentCompleteDependencies {
	redis: Redis;
}

/**
 * Handle agent loop completion
 */
export async function handleAgentComplete(
	completeEvent: AgentLoopCompleteEvent,
	deps: AgentCompleteDependencies,
): Promise<Response> {
	const { redis } = deps;
	const eventWriter = new EventWriter(redis);
	const messageWriter = new MessageWriter(redis);

	// Update session status to completed
	await updateSessionStatus(completeEvent, redis);

	// Write completion event
	await writeCompletionEvent(completeEvent, eventWriter);

	// Write final response as UIMessage
	if (completeEvent.data.finalMessage) {
		await writeFinalMessage(completeEvent, messageWriter);
	}

	// Write metadata completion event
	await writeMetadataCompletion(completeEvent, eventWriter);

	return Response.json({ success: true });
}

/**
 * Update session status to completed
 */
async function updateSessionStatus(completeEvent: AgentLoopCompleteEvent, redis: Redis): Promise<void> {
	const sessionKey = getSessionKey(completeEvent.sessionId);
	const sessionData = await redis.get(sessionKey);

	if (sessionData) {
		const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
		session.status = "completed";
		session.completedAt = new Date().toISOString();
		session.finalResponse = completeEvent.data.finalMessage;
		session.totalIterations = completeEvent.data.iterations || 1;

		// Save session (no expiration)
		await redis.set(sessionKey, JSON.stringify(session));
	}
}

/**
 * Write completion event
 */
async function writeCompletionEvent(completeEvent: AgentLoopCompleteEvent, eventWriter: EventWriter): Promise<void> {
	await eventWriter.writeEvent(completeEvent.sessionId, "event", {
		event: "agent.complete",
		sessionId: completeEvent.sessionId,
		response: completeEvent.data.finalMessage,
		iterations: completeEvent.data.iterations,
		toolsUsed: completeEvent.data.toolsUsed,
		duration: completeEvent.data.duration,
	});
}

/**
 * Write final response as UIMessage
 */
async function writeFinalMessage(completeEvent: AgentLoopCompleteEvent, messageWriter: MessageWriter): Promise<void> {
	const finalMessage: UIMessage = {
		id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
		role: "assistant",
		parts: [
			{
				type: "text",
				text: completeEvent.data.finalMessage,
			},
		],
	};
	await messageWriter.writeUIMessage(completeEvent.sessionId, finalMessage);
}

/**
 * Write metadata completion event
 */
async function writeMetadataCompletion(completeEvent: AgentLoopCompleteEvent, eventWriter: EventWriter): Promise<void> {
	await eventWriter.writeMetadataEvent(completeEvent.sessionId, "completed", {
		sessionId: completeEvent.sessionId,
	});
}
