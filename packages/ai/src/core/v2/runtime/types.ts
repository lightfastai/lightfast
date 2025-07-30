/**
 * Runtime types for executing agent loops and tools with event tracking
 */

import type { Agent } from "../agent";
import type { AgentLoopInitEvent, AgentToolCallEvent } from "../server/events/types";

/**
 * Event for continuing agent loop after tool execution
 */
export interface AgentLoopStepEvent {
	id: string;
	type: "agent.loop.step";
	sessionId: string;
	timestamp: string;
	version: "1.0";
	data: {
		stepIndex: number;
		toolResults?: Array<{
			toolCallId: string;
			tool: string;
			output: any;
		}>;
		metadata?: Record<string, any>;
	};
}

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
		event: AgentLoopInitEvent;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void>;

	/**
	 * Execute one step of the agent loop
	 */
	executeAgentStep<TRuntimeContext = unknown>(params: {
		event: AgentLoopStepEvent;
		agent: Agent<TRuntimeContext>;
		baseUrl: string;
	}): Promise<void>;

	/**
	 * Execute a tool call
	 */
	executeTool(params: {
		event: AgentToolCallEvent;
		toolRegistry: ToolRegistry;
		baseUrl: string;
	}): Promise<void>;
}

/**
 * QStash client interface - matches the @upstash/qstash Client
 */
export interface QStashClient {
	publish(params: {
		url: string;
		body: any;
		headers?: Record<string, string>;
		delay?: number;
		retries?: number;
	}): Promise<{ messageId: string }>;
}