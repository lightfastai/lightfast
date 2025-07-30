/**
 * Orchestration Message Types for V2 Agent System
 *
 * These messages are used for worker-to-worker communication via QStash.
 * They orchestrate the execution flow between different workers.
 */

import { z } from "zod";

// Base message schema that all orchestration messages extend
const BaseMessageSchema = z.object({
	id: z.string().describe("Unique message ID"),
	type: z.string().describe("Message type identifier"),
	sessionId: z.string().describe("Session ID for correlation"),
	timestamp: z.string().datetime().describe("ISO 8601 timestamp"),
	version: z.literal("1.0").default("1.0").describe("Message schema version"),
});

/**
 * Emitted when a new agent loop should be initialized
 * Source: Stream Init API
 * Handler: Agent Loop Worker
 */
export const AgentLoopInitMessageSchema = BaseMessageSchema.extend({
	type: z.literal("agent.loop.init"),
	data: z.object({
		agentId: z.string().describe("Agent identifier"),
		userId: z.string().optional().describe("User ID for context"),
		metadata: z.record(z.any()).optional().describe("Additional metadata"),
	}),
});

/**
 * Emitted when agent loop continues after tool execution
 * Source: Tool Executor (after all tools complete)
 * Handler: Agent Loop Worker
 */
export const AgentLoopStepMessageSchema = BaseMessageSchema.extend({
	type: z.literal("agent.loop.step"),
	data: z.object({
		stepIndex: z.number().describe("Current step index"),
		metadata: z.record(z.any()).optional().describe("Additional metadata"),
	}),
});

/**
 * Emitted when agent loop completes successfully
 * Source: Agent Loop Worker
 * Handler: Client notification
 */
export const AgentLoopCompleteMessageSchema = BaseMessageSchema.extend({
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
export const AgentLoopErrorMessageSchema = BaseMessageSchema.extend({
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
export const AgentToolCallMessageSchema = BaseMessageSchema.extend({
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
export const ToolExecutionStartMessageSchema = BaseMessageSchema.extend({
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
export const ToolExecutionCompleteMessageSchema = BaseMessageSchema.extend({
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
export const ToolExecutionFailedMessageSchema = BaseMessageSchema.extend({
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

// Message type discriminated union for orchestration messages
export const OrchestrationMessageSchema = z.discriminatedUnion("type", [
	AgentLoopInitMessageSchema,
	AgentLoopStepMessageSchema,
	AgentLoopCompleteMessageSchema,
	AgentLoopErrorMessageSchema,
	AgentToolCallMessageSchema,
	ToolExecutionStartMessageSchema,
	ToolExecutionCompleteMessageSchema,
	ToolExecutionFailedMessageSchema,
]);

// Type exports for orchestration messages
export type BaseOrchestrationMessage = z.infer<typeof BaseMessageSchema>;

export type AgentLoopInitMessage = z.infer<typeof AgentLoopInitMessageSchema>;
export type AgentLoopStepMessage = z.infer<typeof AgentLoopStepMessageSchema>;
export type AgentLoopCompleteMessage = z.infer<typeof AgentLoopCompleteMessageSchema>;
export type AgentLoopErrorMessage = z.infer<typeof AgentLoopErrorMessageSchema>;
export type AgentToolCallMessage = z.infer<typeof AgentToolCallMessageSchema>;
export type ToolExecutionStartMessage = z.infer<typeof ToolExecutionStartMessageSchema>;
export type ToolExecutionCompleteMessage = z.infer<typeof ToolExecutionCompleteMessageSchema>;
export type ToolExecutionFailedMessage = z.infer<typeof ToolExecutionFailedMessageSchema>;

export type OrchestrationMessage = z.infer<typeof OrchestrationMessageSchema>;

// Message type enum for orchestration messages
export const MessageType = {
	AGENT_LOOP_INIT: "agent.loop.init",
	AGENT_LOOP_STEP: "agent.loop.step",
	AGENT_LOOP_COMPLETE: "agent.loop.complete",
	AGENT_LOOP_ERROR: "agent.loop.error",
	AGENT_TOOL_CALL: "agent.tool.call",
	TOOL_EXECUTION_START: "tool.execution.start",
	TOOL_EXECUTION_COMPLETE: "tool.execution.complete",
	TOOL_EXECUTION_FAILED: "tool.execution.failed",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
