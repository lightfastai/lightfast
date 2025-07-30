/**
 * Tool Handler - Handles agent tool call events
 */

import type { Client as QStashClient } from "@upstash/qstash";
import type { Redis } from "@upstash/redis";
import type { Agent } from "../../../agent";
import type { LoggerFactory } from "../../../logger";
import { noopLogger } from "../../../logger";
import { AgentRuntime } from "../../runtime/agent-runtime";
import type { ToolRegistry } from "../../runtime/types";

export interface ToolHandlerDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash: QStashClient;
	baseUrl: string;
	resourceId?: string;
	loggerFactory?: LoggerFactory;
}

/**
 * Handle agent tool call event
 */
export async function handleToolCall<TRuntimeContext = unknown>(
	body: { sessionId: string; toolCallId: string; toolName: string; toolArgs: Record<string, any> },
	deps: ToolHandlerDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl, resourceId, loggerFactory } = deps;
	
	// Create logger for this session
	const logger = loggerFactory ? loggerFactory({
		sessionId: body.sessionId,
		agentId: agent.getName(),
		userId: resourceId,
	}) : noopLogger;
	
	const runtime = new AgentRuntime(redis, qstash, logger);

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
			sessionId: body.sessionId,
			toolCallId: body.toolCallId,
			toolName: body.toolName,
			toolArgs: body.toolArgs,
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
