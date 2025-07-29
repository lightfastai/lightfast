/**
 * Stream Status Types
 * Shared constants for streaming status across server and client
 */

export const StreamStatus = {
	STARTED: "started",
	STREAMING: "streaming",
	COMPLETED: "completed",
	ERROR: "error",
} as const;

export type StreamStatusType = (typeof StreamStatus)[keyof typeof StreamStatus];
