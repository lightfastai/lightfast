/**
 * Agent Complete Handler - Handles agent loop completion events
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { AgentLoopCompleteEvent } from "../../events/schemas";
import { getSessionKey } from "../keys";
import { EventWriter } from "../writers/event-writer";
import { MessageWriter } from "../writers/message-writer";

export class AgentCompleteHandler {
	private eventWriter: EventWriter;
	private messageWriter: MessageWriter;

	constructor(private redis: Redis) {
		this.eventWriter = new EventWriter(redis);
		this.messageWriter = new MessageWriter(redis);
	}

	/**
	 * Handle agent loop completion
	 */
	async handleAgentComplete(completeEvent: AgentLoopCompleteEvent): Promise<Response> {
		// Update session status to completed
		await this.updateSessionStatus(completeEvent);

		// Write completion event
		await this.writeCompletionEvent(completeEvent);

		// Write final response as UIMessage
		if (completeEvent.data.finalMessage) {
			await this.writeFinalMessage(completeEvent);
		}

		// Write metadata completion event
		await this.writeMetadataCompletion(completeEvent);

		return Response.json({ success: true });
	}

	/**
	 * Update session status to completed
	 */
	private async updateSessionStatus(completeEvent: AgentLoopCompleteEvent): Promise<void> {
		const sessionKey = getSessionKey(completeEvent.sessionId);
		const sessionData = await this.redis.get(sessionKey);

		if (sessionData) {
			const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
			session.status = "completed";
			session.completedAt = new Date().toISOString();
			session.finalResponse = completeEvent.data.finalMessage;
			session.totalIterations = completeEvent.data.iterations || 1;

			// Save session (no expiration)
			await this.redis.set(sessionKey, JSON.stringify(session));
		}
	}

	/**
	 * Write completion event
	 */
	private async writeCompletionEvent(completeEvent: AgentLoopCompleteEvent): Promise<void> {
		await this.eventWriter.writeEvent(completeEvent.sessionId, "event", {
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
	private async writeFinalMessage(completeEvent: AgentLoopCompleteEvent): Promise<void> {
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
		await this.messageWriter.writeUIMessage(completeEvent.sessionId, finalMessage);
	}

	/**
	 * Write metadata completion event
	 */
	private async writeMetadataCompletion(completeEvent: AgentLoopCompleteEvent): Promise<void> {
		await this.eventWriter.writeMetadataEvent(completeEvent.sessionId, "completed", {
			sessionId: completeEvent.sessionId,
		});
	}
}
