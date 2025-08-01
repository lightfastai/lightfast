/**
 * Stream Types
 * Shared constants and types for streaming across server and client
 */

// Tool call part format that matches Vercel AI SDK
export interface ToolCallPart {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args: any;
}

// Tool result part format
export interface ToolResultPart {
	toolCallId: string;
	toolName: string;
	result: any;
}

export const StreamStatus = {
	STARTED: "started",
	STREAMING: "streaming",
	COMPLETED: "completed",
	ERROR: "error",
} as const;

export type StreamStatusType = (typeof StreamStatus)[keyof typeof StreamStatus];

// Delta stream message types
export enum DeltaStreamType {
	INIT = "init",
	CHUNK = "chunk",
	TOOL_CALL = "tool-call",
	TOOL_RESULT = "tool-result",
	ERROR = "error",
	COMPLETE = "complete",
}

// Delta stream message formats using discriminated unions
export type DeltaStreamMessage =
	| {
			type: DeltaStreamType.INIT;
			timestamp: string;
	  }
	| {
			type: DeltaStreamType.CHUNK;
			content: string;
			timestamp: string;
	  }
	| {
			type: DeltaStreamType.TOOL_CALL;
			toolCall: ToolCallPart;
			timestamp: string;
	  }
	| {
			type: DeltaStreamType.TOOL_RESULT;
			toolResult: ToolResultPart;
			timestamp: string;
	  }
	| {
			type: DeltaStreamType.ERROR;
			error: string;
			timestamp: string;
	  }
	| {
			type: DeltaStreamType.COMPLETE;
			timestamp: string;
	  };
