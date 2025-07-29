/**
 * V2 Fetch Request Handler
 * Unified routing handler for v2 agent worker routes
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type {
	AgentLoopCompleteEvent,
	AgentLoopInitEvent,
	AgentToolCallEvent,
	ToolExecutionCompleteEvent,
} from "../../events/schemas";
import { ToolResultHandler } from "../../workers/tool-result-handler";
import { handleAgentComplete } from "../handlers/agent-complete-handler";
import { handleStreamInit } from "../handlers/stream-init-handler";
import { handleStreamSSE } from "../handlers/stream-sse-handler";
import { handleToolCall } from "../handlers/tool-handler";

export interface FetchRequestHandlerOptions<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	eventEmitter: EventEmitter;
	baseUrl: string; // Base URL for generating stream URLs (e.g., "/api/v2")
}

export interface AgentLoopInitRequestBody {
	event: AgentLoopInitEvent;
}

export interface AgentToolCallRequestBody {
	event: AgentToolCallEvent;
}

export interface ToolExecutionCompleteRequestBody {
	event: ToolExecutionCompleteEvent;
}

export interface AgentLoopCompleteRequestBody {
	event: AgentLoopCompleteEvent;
}

/**
 * Unified fetch request handler for v2 agent workers
 *
 * Routes:
 * - POST /stream/init - Initialize a new stream
 * - GET  /stream/[sessionId] - Server-Sent Events stream
 * - POST /workers/agent-loop-init - Initialize agent loop
 * - POST /workers/agent-tool-call - Execute agent tool
 * - POST /workers/tool-execution-complete - Handle tool completion
 * - POST /workers/agent-loop-complete - Handle agent loop completion
 *
 * @example
 * ```typescript
 * // In your route handler (e.g., app/api/v2/[...v]/route.ts)
 * import { fetchRequestHandler } from "@lightfast/ai/v2/server";
 * import { Agent } from "@lightfast/ai/v2/core";
 *
 * // Define your agent
 * const myAgent = new Agent({
 *   name: "my-agent",
 *   systemPrompt: "You are a helpful assistant...",
 *   tools: [
 *     {
 *       name: "calculator",
 *       description: "Performs mathematical calculations",
 *       execute: async (args) => {
 *         // Tool implementation
 *       }
 *     }
 *   ]
 * }, redis, eventEmitter);
 *
 * export async function POST(req: NextRequest) {
 *   return fetchRequestHandler({
 *     agent: myAgent,
 *     redis,
 *     eventEmitter,
 *     baseUrl: "/api/v2"
 *   });
 * }
 * ```
 */
export function fetchRequestHandler<TRuntimeContext = unknown>(
	options: FetchRequestHandlerOptions<TRuntimeContext>,
): (request: Request) => Promise<Response> {
	const { agent, redis, eventEmitter, baseUrl } = options;

	return async function handler(request: Request): Promise<Response> {
		try {
			// Extract path from URL
			const url = new URL(request.url);
			const pathSegments = url.pathname.replace(baseUrl, "").split("/").filter(Boolean);

			console.log(`[V2 Fetch Handler] URL: ${request.url}, Path: ${url.pathname}, Segments:`, pathSegments);

			// Handle stream endpoints
			if (pathSegments[0] === "stream") {
				if (pathSegments[1] === "init") {
					// Handle POST /stream/init
					if (request.method === "POST") {
						return handleStreamInit(request, { agent, redis, eventEmitter, baseUrl });
					}
				} else if (pathSegments[1]) {
					// Handle GET /stream/[sessionId]
					const sessionId = pathSegments[1];
					return await handleStreamSSE(sessionId, { redis }, request.signal);
				}
			}

			// Handle worker endpoints
			if (pathSegments[0] === "workers") {
				const workerAction = pathSegments[1];

				switch (workerAction) {
					case "agent-loop-init": {
						// Handle POST /workers/agent-loop-init
						const body = (await request.json()) as AgentLoopInitRequestBody;
						console.log(`[V2 Worker Handler] Processing agent.loop.init event`);
						await agent.processEvent(body.event);
						return Response.json({ success: true });
					}

					case "agent-tool-call": {
						// Handle POST /workers/agent-tool-call
						const body = (await request.json()) as AgentToolCallRequestBody;
						console.log(`[V2 Worker Handler] Processing agent.tool.call event`);
						return handleToolCall(body.event, { agent, redis, eventEmitter });
					}

					case "tool-execution-complete": {
						// Handle POST /workers/tool-execution-complete
						const body = (await request.json()) as ToolExecutionCompleteRequestBody;
						console.log(`[V2 Worker Handler] Processing tool.execution.complete event`);
						const handler = new ToolResultHandler(redis, eventEmitter);
						await handler.handleToolComplete(body.event);
						return Response.json({ success: true });
					}

					case "agent-loop-complete": {
						// Handle POST /workers/agent-loop-complete
						const body = (await request.json()) as AgentLoopCompleteRequestBody;
						console.log(`[V2 Worker Handler] Processing agent.loop.complete event`);
						return handleAgentComplete(body.event, { redis });
					}

					default:
						return Response.json({ error: `Unknown worker action: ${workerAction}` }, { status: 404 });
				}
			}

			// If no route matches
			return Response.json({ error: "Not found" }, { status: 404 });
		} catch (error) {
			console.error("[V2 Worker Handler] Error:", error);
			return Response.json(
				{
					error: "Failed to process worker event",
					details: error instanceof Error ? error.message : String(error),
				},
				{ status: 500 },
			);
		}
	};
}
