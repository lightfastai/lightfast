/**
 * Message types and schemas for resumable LLM streams
 * Following the pattern from https://upstash.com/blog/resumable-llm-streams
 */

// AI Completion Message Types (saved to DB)
export const AIMessageType = {
	CHUNK: "chunk",
	THINKING: "thinking",
	TOOL: "tool",
	COMPLETE: "complete",
	COMPLETION: "completion",
} as const;

// Event/System Message Types (not saved to DB)
export const EventMessageType = {
	METADATA: "metadata",
	EVENT: "event",
	ERROR: "error",
	STATUS: "status",
} as const;

export type AIMessageType = (typeof AIMessageType)[keyof typeof AIMessageType];
export type EventMessageType = (typeof EventMessageType)[keyof typeof EventMessageType];

export const StreamStatus = {
	STARTED: "started",
	STREAMING: "streaming",
	COMPLETED: "completed",
	ERROR: "error",
} as const;

export type StreamStatus = (typeof StreamStatus)[keyof typeof StreamStatus];

// AI Completion Message Interfaces
export interface ChunkMessage {
	type: typeof AIMessageType.CHUNK;
	content: string;
}

export interface ThinkingMessage {
	type: typeof AIMessageType.THINKING;
	content: string;
	metadata?: any;
}

export interface ToolMessage {
	type: typeof AIMessageType.TOOL;
	content: string;
	metadata?: any;
}

export interface CompleteMessage {
	type: typeof AIMessageType.COMPLETE | typeof AIMessageType.COMPLETION;
	content: string;
	metadata?: any;
}

// Event/System Message Interfaces
export interface MetadataMessage {
	type: typeof EventMessageType.METADATA;
	status: StreamStatus;
	sessionId: string;
	timestamp: string;
}

export interface EventMessage {
	type: typeof EventMessageType.EVENT;
	event: string;
	data?: unknown;
}

export interface ErrorMessage {
	type: typeof EventMessageType.ERROR;
	error: string;
	code?: string;
}

export interface StatusMessage {
	type: typeof EventMessageType.STATUS;
	content: string;
	metadata?: any;
}

// AI Completion Messages Union
export type AICompletionMessage = ChunkMessage | ThinkingMessage | ToolMessage | CompleteMessage;

// Event/System Messages Union
export type EventSystemMessage = MetadataMessage | EventMessage | ErrorMessage | StatusMessage;

// Stream message type (includes both for streaming, but only AI messages are saved)
export type StreamMessage = AICompletionMessage | EventSystemMessage;

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

		const type = fields.type as AIMessageType | EventMessageType;

		// AI Completion Messages
		switch (type) {
			case AIMessageType.CHUNK:
				return {
					type: AIMessageType.CHUNK,
					content: fields.content || "",
				};

			case AIMessageType.THINKING:
				return {
					type: AIMessageType.THINKING,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			case AIMessageType.TOOL:
				return {
					type: AIMessageType.TOOL,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			case AIMessageType.COMPLETE:
			case AIMessageType.COMPLETION:
				return {
					type: type as typeof AIMessageType.COMPLETE | typeof AIMessageType.COMPLETION,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};
		}

		// Event/System Messages
		switch (type) {
			case EventMessageType.METADATA:
				return {
					type: EventMessageType.METADATA,
					status: fields.status as StreamStatus,
					sessionId: fields.sessionId || "",
					timestamp: fields.timestamp || new Date().toISOString(),
				};

			case EventMessageType.EVENT:
				return {
					type: EventMessageType.EVENT,
					event: fields.event || "",
					data: fields.data ? JSON.parse(fields.data) : undefined,
				};

			case EventMessageType.ERROR:
				return {
					type: EventMessageType.ERROR,
					error: fields.error || "Unknown error",
					code: fields.code,
				};

			case EventMessageType.STATUS:
				return {
					type: EventMessageType.STATUS,
					content: fields.content || "",
					metadata: fields.metadata
						? typeof fields.metadata === "string"
							? JSON.parse(fields.metadata)
							: fields.metadata
						: undefined,
				};

			default:
				console.warn(`Unknown message type: ${type}`);
				return null;
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
	return `v2:${prefix}:${sessionId}`;
}

export function getGroupName(sessionId: string, prefix = "stream"): string {
	return `v2:${prefix}:${sessionId}:consumers`;
}

// Type guards to distinguish message categories
export function isAICompletionMessage(message: StreamMessage): message is AICompletionMessage {
	return (
		message.type === AIMessageType.CHUNK ||
		message.type === AIMessageType.THINKING ||
		message.type === AIMessageType.TOOL ||
		message.type === AIMessageType.COMPLETE ||
		message.type === AIMessageType.COMPLETION
	);
}

export function isEventSystemMessage(message: StreamMessage): message is EventSystemMessage {
	return (
		message.type === EventMessageType.METADATA ||
		message.type === EventMessageType.EVENT ||
		message.type === EventMessageType.ERROR ||
		message.type === EventMessageType.STATUS
	);
}

// Filter messages for database storage (only AI completion messages)
export function filterForDatabaseStorage(messages: StreamMessage[]): AICompletionMessage[] {
	return messages.filter(isAICompletionMessage);
}

// Check if a message should be saved to database
export function shouldSaveToDatabase(message: StreamMessage): boolean {
	return isAICompletionMessage(message);
}
