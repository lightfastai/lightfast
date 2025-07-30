/**
 * Unified Event Types for V2 Agent System
 *
 * This file contains both:
 * 1. Orchestration Events - Used for worker-to-worker communication via QStash
 * 2. Tracking Events - Used for monitoring and observability via Redis pub/sub
 */

import { z } from "zod";

// ==================== ORCHESTRATION EVENTS ====================
// These events drive the agent execution flow between workers

// Base event schema that all orchestration events extend
const BaseEventSchema = z.object({
	id: z.string().describe("Unique event ID"),
	type: z.string().describe("Event type identifier"),
	sessionId: z.string().describe("Session ID for correlation"),
	timestamp: z.string().datetime().describe("ISO 8601 timestamp"),
	version: z.literal("1.0").default("1.0").describe("Event schema version"),
});

// Message schema (matches Vercel AI SDK)
export const MessageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.string(),
	toolCallId: z.string().optional(),
	toolCalls: z.array(z.any()).optional(),
});

/**
 * Emitted when a new agent loop should be initialized
 * Source: Stream Init API
 * Handler: Agent Loop Worker
 */
export const AgentLoopInitEventSchema = BaseEventSchema.extend({
	type: z.literal("agent.loop.init"),
	data: z.object({
		messages: z.array(MessageSchema).describe("Initial conversation messages"),
		systemPrompt: z.string().optional().describe("System prompt for the agent"),
		temperature: z.number().min(0).max(2).default(0.7).describe("LLM temperature"),
		tools: z.array(z.string()).optional().describe("Available tool names"),
		metadata: z.record(z.any()).optional().describe("Additional metadata"),
	}),
});

/**
 * Emitted when agent loop continues after tool execution
 * Source: Tool Executor (after all tools complete)
 * Handler: Agent Loop Worker
 */
export const AgentLoopStepEventSchema = BaseEventSchema.extend({
	type: z.literal("agent.loop.step"),
	data: z.object({
		stepIndex: z.number().describe("Current step index"),
		toolResults: z
			.array(
				z.object({
					toolCallId: z.string().describe("Tool call identifier"),
					tool: z.string().describe("Tool name"),
					output: z.any().describe("Tool execution output"),
				}),
			)
			.optional()
			.describe("Results from completed tool calls"),
		metadata: z.record(z.any()).optional().describe("Additional metadata"),
	}),
});

/**
 * Emitted when agent loop completes successfully
 * Source: Agent Loop Worker
 * Handler: Client notification
 */
export const AgentLoopCompleteEventSchema = BaseEventSchema.extend({
	type: z.literal("agent.loop.complete"),
	data: z.object({
		finalMessage: z.string().describe("Final agent response"),
		iterations: z.number().describe("Number of iterations completed"),
		toolsUsed: z.array(z.string()).describe("List of tools used"),
		duration: z.number().describe("Total duration in milliseconds"),
	}),
});

/**
 * Emitted when agent loop fails
 * Source: Agent Loop Worker
 * Handler: Error handling & client notification
 */
export const AgentLoopErrorEventSchema = BaseEventSchema.extend({
	type: z.literal("agent.loop.error"),
	data: z.object({
		error: z.string().describe("Error message"),
		code: z.string().optional().describe("Error code"),
		iteration: z.number().describe("Iteration where error occurred"),
		recoverable: z.boolean().describe("Whether the error is recoverable"),
	}),
});

/**
 * Emitted when agent decides to call a tool
 * Source: Agent Loop Worker
 * Handler: Tool Executor
 */
export const AgentToolCallEventSchema = BaseEventSchema.extend({
	type: z.literal("agent.tool.call"),
	data: z.object({
		toolCallId: z.string().describe("Unique tool call identifier"),
		tool: z.string().describe("Tool name to execute"),
		arguments: z.record(z.any()).describe("Tool arguments"),
		iteration: z.number().describe("Current loop iteration"),
		priority: z.enum(["low", "normal", "high"]).default("normal"),
	}),
});

/**
 * Emitted when tool execution starts
 * Source: Tool Executor
 * Handler: Monitoring/logging
 */
export const ToolExecutionStartEventSchema = BaseEventSchema.extend({
	type: z.literal("tool.execution.start"),
	data: z.object({
		toolCallId: z.string().describe("Tool call identifier"),
		tool: z.string().describe("Tool name"),
		attempt: z.number().describe("Attempt number (for retries)"),
		timeout: z.number().optional().describe("Execution timeout in ms"),
	}),
});

/**
 * Emitted when tool execution completes successfully
 * Source: Tool Executor
 * Handler: Agent Loop Worker
 */
export const ToolExecutionCompleteEventSchema = BaseEventSchema.extend({
	type: z.literal("tool.execution.complete"),
	data: z.object({
		toolCallId: z.string().describe("Tool call identifier"),
		tool: z.string().describe("Tool name"),
		result: z.any().describe("Tool execution result"),
		duration: z.number().describe("Execution duration in ms"),
		attempts: z.number().describe("Number of attempts"),
	}),
});

/**
 * Emitted when tool execution fails (after all retries)
 * Source: Tool Executor
 * Handler: Agent Loop Worker
 */
export const ToolExecutionFailedEventSchema = BaseEventSchema.extend({
	type: z.literal("tool.execution.failed"),
	data: z.object({
		toolCallId: z.string().describe("Tool call identifier"),
		tool: z.string().describe("Tool name"),
		error: z.string().describe("Error message"),
		code: z.string().optional().describe("Error code"),
		attempts: z.number().describe("Total attempts made"),
		lastAttemptDuration: z.number().describe("Duration of last attempt"),
	}),
});

/**
 * Emitted when data should be written to Redis stream
 * Source: Agent Loop Worker, Tool Executor
 * Handler: Stream Writer
 */
export const StreamWriteEventSchema = BaseEventSchema.extend({
	type: z.literal("stream.write"),
	data: z.object({
		messageType: z.enum(["chunk", "metadata", "event", "error"]),
		content: z.string().optional(),
		metadata: z.record(z.any()).optional(),
	}),
});

/**
 * Emitted when a resource is requested (future use)
 * Source: Tool Executor
 * Handler: Resource Pool Manager
 */
export const ResourceRequestEventSchema = BaseEventSchema.extend({
	type: z.literal("resource.request"),
	data: z.object({
		resourceType: z.string().describe("Type of resource (e.g., 'browserbase')"),
		priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
		timeout: z.number().optional().describe("Max wait time in ms"),
		metadata: z.record(z.any()).optional(),
	}),
});

/**
 * Emitted when a resource is released (future use)
 * Source: Tool Executor
 * Handler: Resource Pool Manager
 */
export const ResourceReleaseEventSchema = BaseEventSchema.extend({
	type: z.literal("resource.release"),
	data: z.object({
		resourceType: z.string(),
		resourceId: z.string(),
		usage: z.object({
			duration: z.number().describe("Usage duration in ms"),
			success: z.boolean().describe("Whether usage was successful"),
		}),
	}),
});

// Event type discriminated union for orchestration events
export const EventSchema = z.discriminatedUnion("type", [
	AgentLoopInitEventSchema,
	AgentLoopStepEventSchema,
	AgentLoopCompleteEventSchema,
	AgentLoopErrorEventSchema,
	AgentToolCallEventSchema,
	ToolExecutionStartEventSchema,
	ToolExecutionCompleteEventSchema,
	ToolExecutionFailedEventSchema,
	StreamWriteEventSchema,
	ResourceRequestEventSchema,
	ResourceReleaseEventSchema,
]);

// Type exports for orchestration events
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type Message = z.infer<typeof MessageSchema>;

export type AgentLoopInitEvent = z.infer<typeof AgentLoopInitEventSchema>;
export type AgentLoopStepEvent = z.infer<typeof AgentLoopStepEventSchema>;
export type AgentLoopCompleteEvent = z.infer<typeof AgentLoopCompleteEventSchema>;
export type AgentLoopErrorEvent = z.infer<typeof AgentLoopErrorEventSchema>;
export type AgentToolCallEvent = z.infer<typeof AgentToolCallEventSchema>;
export type ToolExecutionStartEvent = z.infer<typeof ToolExecutionStartEventSchema>;
export type ToolExecutionCompleteEvent = z.infer<typeof ToolExecutionCompleteEventSchema>;
export type ToolExecutionFailedEvent = z.infer<typeof ToolExecutionFailedEventSchema>;
export type StreamWriteEvent = z.infer<typeof StreamWriteEventSchema>;
export type ResourceRequestEvent = z.infer<typeof ResourceRequestEventSchema>;
export type ResourceReleaseEvent = z.infer<typeof ResourceReleaseEventSchema>;

export type Event = z.infer<typeof EventSchema>;

// Event type enum for orchestration events
export const EventType = {
	AGENT_LOOP_INIT: "agent.loop.init",
	AGENT_LOOP_STEP: "agent.loop.step",
	AGENT_LOOP_COMPLETE: "agent.loop.complete",
	AGENT_LOOP_ERROR: "agent.loop.error",
	AGENT_TOOL_CALL: "agent.tool.call",
	TOOL_EXECUTION_START: "tool.execution.start",
	TOOL_EXECUTION_COMPLETE: "tool.execution.complete",
	TOOL_EXECUTION_FAILED: "tool.execution.failed",
	STREAM_WRITE: "stream.write",
	RESOURCE_REQUEST: "resource.request",
	RESOURCE_RELEASE: "resource.release",
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

// ==================== TRACKING EVENTS ====================
// These events are emitted by the Runtime for monitoring and observability

// Event names for tracking events
export const EventName = {
	AGENT_LOOP_START: "agent.loop.start",
	AGENT_LOOP_COMPLETE: "agent.loop.complete",
	AGENT_TOOL_CALL: "agent.tool.call",
	AGENT_TOOL_RESULT: "agent.tool.result",
	AGENT_STEP_START: "agent.step.start",
	AGENT_STEP_COMPLETE: "agent.step.complete",
	AGENT_ERROR: "agent.error",
} as const;

export type EventName = (typeof EventName)[keyof typeof EventName];

// Base tracking event interface
interface BaseTrackingEvent {
	name: EventName;
	timestamp: string;
	sessionId: string;
	agentId: string;
}

// Tracking event types
export interface AgentLoopStartEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_LOOP_START;
	input: string;
}

export interface TrackingAgentLoopCompleteEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_LOOP_COMPLETE;
	output: string;
	duration: number;
	toolCalls: number;
	steps: number;
}

export interface AgentStepStartEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_STEP_START;
	stepIndex: number;
	input: string;
}

export interface AgentStepCompleteEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_STEP_COMPLETE;
	stepIndex: number;
	output: string;
	duration: number;
}

export interface TrackingAgentToolCallEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_TOOL_CALL;
	toolName: string;
	toolCallId: string;
	args: Record<string, any>;
}

export interface AgentToolResultEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_TOOL_RESULT;
	toolName: string;
	toolCallId: string;
	result: any;
	duration: number;
}

export interface AgentErrorEvent extends BaseTrackingEvent {
	name: typeof EventName.AGENT_ERROR;
	error: string;
	code?: string;
	stepIndex?: number;
	toolCallId?: string;
}

// Union type for all tracking events
export type AgentEvent =
	| AgentLoopStartEvent
	| TrackingAgentLoopCompleteEvent
	| AgentStepStartEvent
	| AgentStepCompleteEvent
	| TrackingAgentToolCallEvent
	| AgentToolResultEvent
	| AgentErrorEvent;
