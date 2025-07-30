/**
 * Step Handler - Handles agent loop step events
 */

import type { Redis } from "@upstash/redis";
import type { Client as QStashClient } from "@upstash/qstash";
import type { Agent } from "../../../agent";
import type { AgentLoopStepEvent } from "../../runtime/types";
import { AgentRuntime } from "../../runtime/agent-runtime";

export interface StepHandlerDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash: QStashClient;
	baseUrl: string;
}

/**
 * Handle agent loop step event
 */
export async function handleAgentStep<TRuntimeContext = unknown>(
	stepEvent: AgentLoopStepEvent,
	deps: StepHandlerDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl } = deps;
	const runtime = new AgentRuntime(redis, qstash);

	try {
		await runtime.executeAgentStep({
			event: stepEvent,
			agent,
			baseUrl,
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