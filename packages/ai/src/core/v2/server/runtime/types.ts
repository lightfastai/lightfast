/**
 * Runtime types for executing agent loops and tools with event tracking
 */

import type { Agent } from "../../agent";

/**
 * Session state stored in Redis
 */
export interface SessionState {
	messages: Array<{
		role: "system" | "user" | "assistant" | "tool";
		content: string;
		toolCallId?: string;
		toolCalls?: any[];
	}>;
	stepIndex: number;
	startTime: number;
	toolCallCount: number;
	pendingToolCalls?: Array<{
		id: string;
		name: string;
		args: any;
	}>;
	toolResults?: Array<{
		toolCallId: string;
		tool: string;
		output: any;
	}>;
	agentId: string;
	temperature?: number;
}

/**
 * Tool registry for executing tools
 */
export interface ToolRegistry {
	execute(toolName: string, args: Record<string, any>): Promise<any>;
	has(toolName: string): boolean;
}

/**
 * Runtime interface for executing agent loops and tools
 */
export interface Runtime {
	/**
	 * Initialize a new agent loop
	 */
	initAgentLoop<TRuntimeContext = unknown>(params: {
		sessionId: string;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void>;

	/**
	 * Execute one step of the agent loop
	 */
	executeAgentStep<TRuntimeContext = unknown>(params: {
		sessionId: string;
		stepIndex: number;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void>;

	/**
	 * Execute a tool call
	 */
	executeTool(params: {
		sessionId: string;
		toolCallId: string;
		toolName: string;
		toolArgs: Record<string, any>;
		toolRegistry: ToolRegistry;
		baseUrl: string;
	}): Promise<void>;
}

/**
 * Re-export QStash client type
 */
export type { Client as QStashClient } from "@upstash/qstash";
