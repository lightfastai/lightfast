/**
 * Init Handler - Handles agent loop initialization events
 */

import type { Redis } from "@upstash/redis";
import type { Client as QStashClient } from "@upstash/qstash";
import type { Agent } from "../../../agent";
import type { AgentLoopInitEvent } from "../../events/types";
import { AgentRuntime } from "../../runtime/agent-runtime";

export interface InitHandlerDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash: QStashClient;
	baseUrl: string;
}

/**
 * Handle agent loop init event
 */
export async function handleAgentInit<TRuntimeContext = unknown>(
	initEvent: AgentLoopInitEvent,
	deps: InitHandlerDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl } = deps;
	const runtime = new AgentRuntime(redis, qstash);

	try {
		await runtime.initAgentLoop({
			event: initEvent,
			agent,
			baseUrl,
		});

		return Response.json({ success: true });
	} catch (error) {
		console.error(`[Init Handler] Error processing init event:`, error);
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}