/**
 * Event Writer - Handles writing agent loop events to Redis streams
 */

import type { Redis } from "@upstash/redis";
import { uuidv4 } from "../../utils/uuid";
import {  EventName } from "./types";
import type {AgentEvent} from "./types";

export class EventWriter {
	constructor(private redis: Redis) {}

	/**
	 * Get the event stream key for a session
	 */
	private getEventStreamKey(sessionId: string): string {
		return `events:${sessionId}`;
	}

	/**
	 * Write an event to the event stream
	 */
	private async writeEvent(event: AgentEvent): Promise<void> {
		const streamKey = this.getEventStreamKey(event.sessionId);

		// Convert event to flat structure for Redis
		const message: Record<string, string> = {
			id: uuidv4(),
			name: event.name,
			timestamp: event.timestamp,
			sessionId: event.sessionId,
			agentId: event.agentId,
			// Flatten all other properties
			...Object.entries(event).reduce(
				(acc, [key, value]) => {
					if (!["name", "timestamp", "sessionId", "agentId"].includes(key)) {
						acc[key] =
							typeof value === "object" ? JSON.stringify(value) : String(value);
					}
					return acc;
				},
				{} as Record<string, string>,
			),
		};

		// Use pipeline for atomic operations
		const pipeline = this.redis.pipeline();

		// Write to Redis stream
		pipeline.xadd(streamKey, "*", message);

		// Set TTL on event stream (1 hour)
		pipeline.expire(streamKey, 3600);

		// Publish simple notification for real-time updates
		pipeline.publish(streamKey, "1");

		// Execute all operations atomically
		await pipeline.exec();
	}

	/**
	 * Write agent loop start event
	 */
	async writeAgentLoopStart(sessionId: string, agentId: string): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_LOOP_START,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
		});
	}

	/**
	 * Write agent loop complete event
	 */
	async writeAgentLoopComplete(
		sessionId: string,
		agentId: string,
		duration: number,
		toolCalls: number,
		steps: number,
	): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_LOOP_COMPLETE,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
			duration,
			toolCalls,
			steps,
		});
	}

	/**
	 * Write agent tool call event
	 */
	async writeAgentToolCall(
		sessionId: string,
		agentId: string,
		toolName: string,
		toolCallId: string,
	): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_TOOL_CALL,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
			toolName,
			toolCallId,
		});
	}

	/**
	 * Write agent tool result event
	 */
	async writeAgentToolResult(
		sessionId: string,
		agentId: string,
		toolName: string,
		toolCallId: string,
		duration: number,
	): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_TOOL_RESULT,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
			toolName,
			toolCallId,
			duration,
		});
	}

	/**
	 * Write agent step start event
	 */
	async writeAgentStepStart(
		sessionId: string,
		agentId: string,
		stepIndex: number,
	): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_STEP_START,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
			stepIndex,
		});
	}

	/**
	 * Write agent step complete event
	 */
	async writeAgentStepComplete(
		sessionId: string,
		agentId: string,
		stepIndex: number,
		duration: number,
	): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_STEP_COMPLETE,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
			stepIndex,
			duration,
		});
	}

	/**
	 * Write agent error event
	 */
	async writeAgentError(
		sessionId: string,
		agentId: string,
		error: string,
		code?: string,
		stepIndex?: number,
		toolCallId?: string,
	): Promise<void> {
		await this.writeEvent({
			name: EventName.AGENT_ERROR,
			timestamp: new Date().toISOString(),
			sessionId,
			agentId,
			error,
			code,
			stepIndex,
			toolCallId,
		});
	}
}
