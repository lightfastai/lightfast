/**
 * Types and schemas for UIMessage-based resumable LLM streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

import type { UIMessage } from "ai";

// UIMessagePart type for our usage
export type UIMessagePart = {
	type: string;
	[key: string]: any;
};

// Stream status for system events (not messages)
export const StreamStatus = {
	STARTED: "started",
	STREAMING: "streaming",
	COMPLETED: "completed",
	ERROR: "error",
} as const;

export type StreamStatus = (typeof StreamStatus)[keyof typeof StreamStatus];

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
	parts: string; // JSON stringified UIMessagePart[]
	metadata?: string; // JSON stringified metadata
	timestamp: string;
}

// Redis storage format for UIMessagePart (for streaming)
export interface RedisUIMessagePartEntry {
	messageId: string;
	partIndex: number;
	partType: string;
	partData: string; // JSON stringified part data
	timestamp: string;
}

// Redis stream entry format
export interface RedisStreamEntry {
	id: string;
	fields: Record<string, string>;
}

// Utility to convert array to object (as shown in blog)
export function arrToObj(arr: string[]): Record<string, string> {
	const obj: Record<string, string> = {};
	for (let i = 0; i < arr.length; i += 2) {
		const key = arr[i];
		const value = arr[i + 1];
		if (key !== undefined && value !== undefined) {
			obj[key] = value;
		}
	}
	return obj;
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

// Parse UIMessagePart from Redis entry
export function parseUIMessagePartEntry(entry: any): UIMessagePart | null {
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

		// Check if this is a UIMessagePart entry
		if (!fields.partType || !fields.partData) {
			return null;
		}

		return JSON.parse(fields.partData) as UIMessagePart;
	} catch (error) {
		console.error("Failed to parse UIMessagePart:", error);
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

// Stream configuration
export interface StreamConfig {
	/** Redis stream key prefix */
	streamPrefix?: string;
	/** Consumer group prefix */
	groupPrefix?: string;
	/** Stream TTL in seconds (default: 3600) */
	ttl?: number;
	/** Max stream length (default: 1000) */
	maxLength?: number;
}

// Helper to generate stream keys
export function getStreamKey(sessionId: string, prefix = "stream"): string {
	return `v2:${prefix}:${sessionId}`;
}

// Helper to generate event stream keys
export function getEventStreamKey(sessionId: string): string {
	return `v2:events:${sessionId}`;
}

export function getGroupName(sessionId: string, prefix = "stream"): string {
	return `v2:${prefix}:${sessionId}:consumers`;
}

// Check if entry is a UIMessage
export function isUIMessageEntry(fields: Record<string, string>): boolean {
	return !!(fields.messageId && fields.role && fields.parts);
}

// Check if entry is a UIMessagePart
export function isUIMessagePartEntry(fields: Record<string, string>): boolean {
	return !!(fields.partType && fields.partData);
}

// Check if entry is a system event
export function isSystemEventEntry(fields: Record<string, string>): boolean {
	return !!(fields.type && fields.sessionId && Object.values(SystemEventType).includes(fields.type as SystemEventType));
}
