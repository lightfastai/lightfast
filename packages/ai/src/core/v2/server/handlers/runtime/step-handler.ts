/**
 * Step Handler - Handles agent loop step events
 */

import type { Client as QStashClient } from "@upstash/qstash";
import type { Redis } from "@upstash/redis";
import type { Agent } from "../../../agent";
import { AgentRuntime } from "../../runtime/agent-runtime";

export interface StepHandlerDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash: QStashClient;
	baseUrl: string;
	resourceId: string;
}

/**
 * Handle agent loop step event
 */
export async function handleAgentStep<TRuntimeContext = unknown>(
	body: { sessionId: string; stepIndex: number; resourceId?: string; assistantMessageId?: string },
	deps: StepHandlerDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl, resourceId: depsResourceId } = deps;
	const runtime = new AgentRuntime(redis, qstash);

	try {
		// Validate required parameters
		const resourceId = body.resourceId || depsResourceId;
		const assistantMessageId = body.assistantMessageId;

		if (!resourceId) {
			throw new Error('resourceId is required for agent step execution');
		}

		if (!assistantMessageId) {
			throw new Error('assistantMessageId is required for agent step execution');
		}

		await runtime.executeStep({
			sessionId: body.sessionId,
			stepIndex: body.stepIndex,
			agent,
			baseUrl,
			resourceId,
			assistantMessageId,
		});

		return Response.json({ success: true });
	} catch (error) {
		console.error(`[Step Handler] Error processing step event:`, error);
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
