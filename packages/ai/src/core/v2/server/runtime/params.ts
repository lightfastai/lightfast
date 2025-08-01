/**
 * Parameter types for Runtime methods
 * These types are extracted from the runtime implementation to ensure consistency
 */

import type { Agent } from "../../agent";
import type { ToolRegistry } from "./types";

/**
 * Parameters for executing an agent step
 */
export interface ExecuteStepParams<TRuntimeContext = unknown> {
	sessionId: string;
	stepIndex: number;
	agent: Agent<TRuntimeContext>;
	baseUrl: string;
	resourceId: string;
	assistantMessageId: string;
}

/**
 * Parameters for executing a tool call
 */
export interface ExecuteToolParams {
	sessionId: string;
	toolCallId: string;
	toolName: string;
	toolArgs: Record<string, any>;
	toolRegistry: ToolRegistry;
	baseUrl: string;
}

/**
 * Parameters for completing an agent loop
 */
export interface CompleteAgentLoopParams {
	sessionId: string;
	agentId: string;
	output: string;
	duration: number;
	toolCallCount: number;
	stepCount: number;
}

/**
 * Parameters for tool execution tracking
 */
export interface ToolExecutionParams {
	sessionId: string;
	agentId: string;
	toolName: string;
	toolCallId: string;
	args: Record<string, any>;
}

/**
 * Parameters for tool result tracking
 */
export interface ToolResultParams {
	sessionId: string;
	agentId: string;
	toolName: string;
	toolCallId: string;
	result: any;
	duration: number;
}
