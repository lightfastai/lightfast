/**
 * Runtime types for executing agent loops and tools with event tracking
 */

import type { UIMessage } from "ai";
import type { Agent } from "../../agent";

/**
 * Session state stored in Redis
 */
export interface SessionState {
	resourceId: string;
	stepIndex: number;
	startTime: number;
	toolCallCount: number;
	pendingToolCalls?: Array<{
		id: string;
		name: string;
		args: any;
	}>;
	agentId: string;
	temperature?: number;
	assistantMessageId: string;
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
	 * Execute a step of the agent loop (handles initialization automatically)
	 */
	executeStep<TRuntimeContext = unknown>(params: {
		sessionId: string;
		stepIndex: number;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
		resourceId: string;
		assistantMessageId: string;
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
