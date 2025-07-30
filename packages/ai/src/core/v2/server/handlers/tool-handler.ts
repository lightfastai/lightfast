/**
 * Tool Handler - Handles agent tool call events
 */

import type { Redis } from "@upstash/redis";
import type { Client as QStashClient } from "@upstash/qstash";
import type { Agent } from "../../agent";
import type { AgentToolCallEvent } from "../events/types";
import { AgentRuntime } from "../../runtime/agent-runtime";
import type { ToolRegistry } from "../../runtime/types";

export interface ToolHandlerDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash: QStashClient;
	baseUrl: string;
}

/**
 * Handle agent tool call event
 */
export async function handleToolCall<TRuntimeContext = unknown>(
	toolEvent: AgentToolCallEvent,
	deps: ToolHandlerDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl } = deps;
	const runtime = new AgentRuntime(redis, qstash);

	// Create tool registry from agent
	const toolRegistry: ToolRegistry = {
		execute: async (toolName: string, args: Record<string, any>) => {
			return agent.executeTool(toolName, args);
		},
		has: (toolName: string) => {
			// Check if agent has this tool
			const availableTools = agent.getAvailableTools();
			return availableTools.includes(toolName);
		},
	};

	try {
		await runtime.executeTool({
			event: toolEvent,
			toolRegistry,
			baseUrl,
		});

		return Response.json({ success: true });
	} catch (error) {
		console.error(`[Tool Handler] Error processing tool event:`, error);
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
