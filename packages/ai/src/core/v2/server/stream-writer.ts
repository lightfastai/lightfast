/**
 * Stream Writer - Utility for writing UIMessages and events to Redis streams
 * Used by workers to write agent responses, tool results, and status updates
 */

import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import {
	getEventStreamKey,
	getStreamKey,
	type RedisUIMessageEntry,
	type RedisUIMessagePartEntry,
	type StreamStatus,
	type SystemEvent,
	type SystemEventType,
	type UIMessagePart,
} from "./types";

export class StreamWriter {
	constructor(private redis: Redis) {}

	/**
	 * Write a UIMessage to stream
	 */
	async writeUIMessage(sessionId: string, message: UIMessage): Promise<string> {
		const streamKey = getStreamKey(sessionId);

		const entry: RedisUIMessageEntry = {
			messageId: message.id,
			role: message.role,
			parts: JSON.stringify(message.parts),
			timestamp: new Date().toISOString(),
		};

		if (message.metadata) {
			entry.metadata = JSON.stringify(message.metadata);
		}

		// Convert to flat fields for Redis
		const fields: Record<string, string> = {};
		Object.entries(entry).forEach(([key, value]) => {
			fields[key] = typeof value === "string" ? value : String(value);
		});

		// Write to Redis stream
		const id = await this.redis.xadd(streamKey, "*", fields);
		return id as string;
	}

	/**
	 * Write a system event (not a message)
	 */
	async writeEvent(
		sessionId: string,
		type: SystemEventType,
		data?: Record<string, any>,
		status?: StreamStatus,
		error?: string,
		code?: string,
	): Promise<string> {
		const eventKey = getEventStreamKey(sessionId);

		const event: SystemEvent = {
			id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			type,
			sessionId,
			timestamp: new Date().toISOString(),
		};

		if (data) event.data = data;
		if (status) event.status = status;
		if (error) event.error = error;
		if (code) event.code = code;

		// Flatten for Redis
		const fields: Record<string, string> = {
			id: event.id,
			type: event.type,
			sessionId: event.sessionId,
			timestamp: event.timestamp,
		};

		if (event.data) fields.data = JSON.stringify(event.data);
		if (event.status) fields.status = event.status;
		if (event.error) fields.error = event.error;
		if (event.code) fields.code = event.code;

		const id = await this.redis.xadd(eventKey, "*", fields);
		return id as string;
	}

	/**
	 * Write a status event
	 */
	async writeStatusEvent(sessionId: string, status: StreamStatus, data?: Record<string, any>): Promise<string> {
		return this.writeEvent(sessionId, "status", data, status);
	}

	/**
	 * Write an error event
	 */
	async writeErrorEvent(sessionId: string, error: string, code?: string, data?: Record<string, any>): Promise<string> {
		return this.writeEvent(sessionId, "error", data, undefined, error, code);
	}

	/**
	 * Write a metadata event
	 */
	async writeMetadataEvent(sessionId: string, status: StreamStatus, data?: Record<string, any>): Promise<string> {
		return this.writeEvent(sessionId, "metadata", data, status);
	}
}

/**
 * Create a stream writer instance
 */
export function createStreamWriter(redis: Redis): StreamWriter {
	return new StreamWriter(redis);
}
