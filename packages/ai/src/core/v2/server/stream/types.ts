/**
 * Stream Types
 * Shared constants and types for streaming across server and client
 */

export const StreamStatus = {
	STARTED: "started",
	STREAMING: "streaming",
	COMPLETED: "completed",
	ERROR: "error",
} as const;

export type StreamStatusType = (typeof StreamStatus)[keyof typeof StreamStatus];

// Delta stream message types
export enum DeltaStreamType {
	CHUNK = "chunk",
	ERROR = "error",
	COMPLETE = "complete",
}

// Delta stream message format
export interface DeltaStreamMessage {
	type: DeltaStreamType;
	content?: string;
	error?: string;
	timestamp: string;
}
