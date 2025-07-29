/**
 * Types and schemas for UIMessage-based resumable LLM streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { UIMessage } from "ai";
import type { StreamStatusType as StreamStatus } from "./stream/types";

// System event types (stored separately from messages)
export const SystemEventType = {
	STATUS: "status",
	ERROR: "error",
	METADATA: "metadata",
	EVENT: "event",
} as const;

export type SystemEventType = (typeof SystemEventType)[keyof typeof SystemEventType];

// System event interface (not a message)
export interface SystemEvent {
	id: string;
	type: SystemEventType;
	sessionId: string;
	timestamp: string;
	data?: Record<string, any>;
	status?: StreamStatus;
	error?: string;
	code?: string;
}

// Redis storage format for UIMessage
export interface RedisUIMessageEntry {
	messageId: string;
	role: string;
	parts: string; // JSON stringified parts array
	metadata?: string; // JSON stringified metadata
	timestamp: string;
}

// Redis stream entry format
export interface RedisStreamEntry {
	id: string;
	fields: Record<string, string>;
}

// Parse UIMessage from Redis entry
export function parseUIMessageEntry(entry: any): UIMessage | null {
	try {
		let fields: Record<string, string>;

		if (entry && typeof entry === "object" && "id" in entry) {
			// Upstash format: { id: string, ...fields }
			const { id, ...rest } = entry;
			fields = rest;
		} else if (entry && typeof entry === "object") {
			// Direct fields object
			fields = entry;
		} else {
			return null;
		}

		// Check if this is a UIMessage entry
		if (!fields.messageId || !fields.role || !fields.parts) {
			return null;
		}

		// Reconstruct UIMessage
		const message: UIMessage = {
			id: fields.messageId,
			role: fields.role as "system" | "user" | "assistant",
			parts: typeof fields.parts === "string" ? JSON.parse(fields.parts) : fields.parts,
		};

		if (fields.metadata) {
			message.metadata = typeof fields.metadata === "string" ? JSON.parse(fields.metadata) : fields.metadata;
		}

		return message;
	} catch (error) {
		console.error("Failed to parse UIMessage:", error);
		return null;
	}
}

// Parse system event from Redis entry
export function parseSystemEvent(entry: any): SystemEvent | null {
	try {
		let fields: Record<string, string>;

		if (entry && typeof entry === "object" && "id" in entry) {
			const { id, ...rest } = entry;
			fields = rest;
		} else if (entry && typeof entry === "object") {
			fields = entry;
		} else {
			return null;
		}

		// Check if this is a system event
		if (!fields.type || !fields.sessionId) {
			return null;
		}

		const event: SystemEvent = {
			id: fields.id || "",
			type: fields.type as SystemEventType,
			sessionId: fields.sessionId,
			timestamp: fields.timestamp || new Date().toISOString(),
		};

		if (fields.data) {
			try {
				// Handle both string and object cases
				event.data = typeof fields.data === "string" ? JSON.parse(fields.data) : fields.data;
			} catch (parseError) {
				console.error("Failed to parse event data:", fields.data, parseError);
				// If parsing fails, skip setting data
			}
		}
		if (fields.status) {
			event.status = fields.status as StreamStatus;
		}
		if (fields.error) {
			event.error = fields.error;
		}
		if (fields.code) {
			event.code = fields.code;
		}

		return event;
	} catch (error) {
		console.error("Failed to parse system event:", error);
		return null;
	}
}

// Helper to generate stream keys
export function getStreamKey(sessionId: string, prefix = "stream"): string {
	return `v2:${prefix}:${sessionId}`;
}

// Helper to generate event stream keys
export function getEventStreamKey(sessionId: string): string {
	return `v2:events:${sessionId}`;
}

// Stream configuration interface
export interface StreamConfig {
	streamPrefix?: string;
	groupPrefix?: string;
	ttl?: number;
	maxLength?: number;
}

// Check if entry is a UIMessage
export function isUIMessageEntry(fields: Record<string, string>): boolean {
	return !!(fields.messageId && fields.role && fields.parts);
}

// Check if entry is a system event
export function isSystemEventEntry(fields: Record<string, string>): boolean {
	return !!(fields.type && fields.sessionId && Object.values(SystemEventType).includes(fields.type as SystemEventType));
}
