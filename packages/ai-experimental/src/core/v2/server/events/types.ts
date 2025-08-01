/**
 * Event Types for V2 Agent System
 *
 * These events are used for monitoring and tracking agent execution.
 * They are written to Redis streams by EventWriter and consumed by EventConsumer.
 */

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

interface BaseEvent {
	name: EventName;
	timestamp: string;
	sessionId: string;
	agentId: string;
}

export interface AgentLoopStartEvent extends BaseEvent {
	name: typeof EventName.AGENT_LOOP_START;
}

export interface AgentLoopCompleteEvent extends BaseEvent {
	name: typeof EventName.AGENT_LOOP_COMPLETE;
	duration: number;
	toolCalls: number;
	steps: number;
}

export interface AgentStepStartEvent extends BaseEvent {
	name: typeof EventName.AGENT_STEP_START;
	stepIndex: number;
}

export interface AgentStepCompleteEvent extends BaseEvent {
	name: typeof EventName.AGENT_STEP_COMPLETE;
	stepIndex: number;
	duration: number;
}

export interface AgentToolCallEvent extends BaseEvent {
	name: typeof EventName.AGENT_TOOL_CALL;
	toolName: string;
	toolCallId: string;
}

export interface AgentToolResultEvent extends BaseEvent {
	name: typeof EventName.AGENT_TOOL_RESULT;
	toolName: string;
	toolCallId: string;
	duration: number;
}

export interface AgentErrorEvent extends BaseEvent {
	name: typeof EventName.AGENT_ERROR;
	error: string;
	code?: string;
	stepIndex?: number;
	toolCallId?: string;
}

export type AgentEvent =
	| AgentLoopStartEvent
	| AgentLoopCompleteEvent
	| AgentStepStartEvent
	| AgentStepCompleteEvent
	| AgentToolCallEvent
	| AgentToolResultEvent
	| AgentErrorEvent;

/**
 * Parameter types for EventWriter methods
 * These types extract the parameters from the methods to ensure consistency
 */

export interface AgentLoopStartParams {
	sessionId: string;
	agentId: string;
}

export interface AgentLoopCompleteParams {
	sessionId: string;
	agentId: string;
	duration: number;
	toolCalls: number;
	steps: number;
}

export interface AgentToolCallParams {
	sessionId: string;
	agentId: string;
	toolName: string;
	toolCallId: string;
}

export interface AgentToolResultParams {
	sessionId: string;
	agentId: string;
	toolName: string;
	toolCallId: string;
	duration: number;
}

export interface AgentStepStartParams {
	sessionId: string;
	agentId: string;
	stepIndex: number;
}

export interface AgentStepCompleteParams {
	sessionId: string;
	agentId: string;
	stepIndex: number;
	duration: number;
}

export interface AgentErrorParams {
	sessionId: string;
	agentId: string;
	error: string;
	code?: string;
	stepIndex?: number;
	toolCallId?: string;
}
