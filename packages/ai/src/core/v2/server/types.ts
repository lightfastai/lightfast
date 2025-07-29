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
