/**
 * Message types and schemas for resumable LLM streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

export const MessageType = {
	CHUNK: "chunk",
	METADATA: "metadata",
	EVENT: "event",
	ERROR: "error",
	STATUS: "status",
	TOOL: "tool",
	THINKING: "thinking",
	COMPLETE: "complete",
	COMPLETION: "completion",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const StreamStatus = {
	STARTED: "started",
	STREAMING: "streaming",
	COMPLETED: "completed",
	ERROR: "error",
} as const;

export type StreamStatus = (typeof StreamStatus)[keyof typeof StreamStatus];

// Message types
export interface ChunkMessage {
	type: typeof MessageType.CHUNK;
	content: string;
}

export interface MetadataMessage {
	type: typeof MessageType.METADATA;
	status: StreamStatus;
	sessionId: string;
	timestamp: string;
}

export interface EventMessage {
	type: typeof MessageType.EVENT;
	event: string;
	data?: unknown;
}

export interface ErrorMessage {
	type: typeof MessageType.ERROR;
	error: string;
	code?: string;
}

// V2 Event-driven architecture message types
export interface StatusMessage {
	type: typeof MessageType.STATUS;
	content: string;
	metadata?: any;
}

export interface ToolMessage {
	type: typeof MessageType.TOOL;
	content: string;
	metadata?: any;
}

export interface ThinkingMessage {
	type: typeof MessageType.THINKING;
	content: string;
	metadata?: any;
}

export interface CompleteMessage {
	type: typeof MessageType.COMPLETE | typeof MessageType.COMPLETION;
	content: string;
	metadata?: any;
}

// Extended StreamMessage with V2 types
export type StreamMessage =
	| ChunkMessage
	| MetadataMessage
	| EventMessage
	| ErrorMessage
	| StatusMessage
	| ToolMessage
	| ThinkingMessage
	| CompleteMessage
	| (BaseMessage & { type: string }); // Fallback for unknown types

// Base message interface for flexibility
export interface BaseMessage {
	id?: string;
	type: string;
	content: string;
	metadata?: any;
	timestamp?: string;
	status?: string;
	error?: string;
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

// Validate and parse message from Redis
export function validateMessage(entry: any): StreamMessage | null {
	try {
		// Handle both raw fields object and Upstash entry format
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

		const type = fields.type as MessageType;

		switch (type) {
			case MessageType.CHUNK:
				return {
					type: MessageType.CHUNK,
					content: fields.content || "",
				};

			case MessageType.METADATA:
				return {
					type: MessageType.METADATA,
					status: fields.status as StreamStatus,
					sessionId: fields.sessionId || "",
					timestamp: fields.timestamp || new Date().toISOString(),
				};

			case MessageType.EVENT:
				return {
					type: MessageType.EVENT,
					event: fields.event || "",
					data: fields.data ? JSON.parse(fields.data) : undefined,
				};

			case MessageType.ERROR:
				return {
					type: MessageType.ERROR,
					error: fields.error || "Unknown error",
					code: fields.code,
				};

			case MessageType.STATUS:
				return {
					type: MessageType.STATUS,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			case MessageType.TOOL:
				return {
					type: MessageType.TOOL,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			case MessageType.THINKING:
				return {
					type: MessageType.THINKING,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			case MessageType.COMPLETE:
			case MessageType.COMPLETION:
				return {
					type: type,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			default:
				// Fallback for unknown types - return as BaseMessage
				return {
					id: fields.id,
					type: type || "unknown",
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
					timestamp: fields.timestamp,
					status: fields.status,
					error: fields.error,
				};
		}
	} catch (error) {
		console.error("Failed to validate message:", error);
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
	return `${prefix}:${sessionId}`;
}

export function getGroupName(sessionId: string, prefix = "stream"): string {
	return `${prefix}:${sessionId}:consumers`;
}
