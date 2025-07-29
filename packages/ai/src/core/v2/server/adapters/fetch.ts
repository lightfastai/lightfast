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
import { AgentCompleteHandler } from "../handlers/agent-complete-handler";
import { StreamInitHandler } from "../handlers/stream-init-handler";
import { StreamSSEHandler } from "../handlers/stream-sse-handler";
import { StreamStatusHandler } from "../handlers/stream-status-handler";
import { ToolHandler } from "../handlers/tool-handler";

export interface FetchRequestHandlerOptions<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	eventEmitter: EventEmitter;
	baseUrl: string; // Base URL for generating stream URLs (e.g., "/api/v2")
}

export interface WorkerRequestBody {
	type: "agent.loop.init" | "agent.tool.call" | "tool.execution.complete" | "agent.loop.complete";
	event: AgentLoopInitEvent | AgentToolCallEvent | ToolExecutionCompleteEvent | AgentLoopCompleteEvent;
}

/**
 * Unified fetch request handler for v2 agent workers
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
 *     eventEmitter
 *   });
 * }
 * ```
 */
export function fetchRequestHandler<TRuntimeContext = unknown>(
	options: FetchRequestHandlerOptions<TRuntimeContext>,
): (request: Request) => Promise<Response> {
	const { agent, redis, eventEmitter, baseUrl } = options;

	// Initialize handlers
	const streamInitHandler = new StreamInitHandler<TRuntimeContext>(agent, redis, eventEmitter, baseUrl);
	const streamStatusHandler = new StreamStatusHandler(redis);
	const streamSSEHandler = new StreamSSEHandler(redis);
	const toolHandler = new ToolHandler<TRuntimeContext>(agent, redis, eventEmitter);
	const agentCompleteHandler = new AgentCompleteHandler(redis);

	return async function handler(request: Request): Promise<Response> {
		try {
			// Extract path from URL
			const url = new URL(request.url);
			const pathSegments = url.pathname.replace(baseUrl, "").split("/").filter(Boolean);

			// Handle stream endpoints
			if (pathSegments[0] === "stream") {
				if (pathSegments[1] === "init") {
					// Handle POST /stream/init
					if (request.method === "POST") {
						return streamInitHandler.handleStreamInit(request);
					} else if (request.method === "GET") {
						return streamStatusHandler.handleStreamStatus(request);
					}
				} else if (pathSegments[1]) {
					// Handle GET /stream/[sessionId]
					const sessionId = pathSegments[1];
					return await streamSSEHandler.handleStreamSSE(sessionId, request.signal);
				}
			}

			// Handle worker endpoints
			// Parse the request body
			const body = (await request.json()) as WorkerRequestBody;
			const { type, event } = body;

			console.log(`[V2 Worker Handler] Processing ${type} event`);

			switch (type) {
				case "agent.loop.init":
					// Process agent loop init event
					await agent.processEvent(event as AgentLoopInitEvent);
					return Response.json({ success: true });

				case "agent.tool.call":
					// Handle tool execution
					return toolHandler.handleToolCall(event as AgentToolCallEvent);

				case "tool.execution.complete": {
					// Handle tool completion
					const handler = new ToolResultHandler(redis, eventEmitter);
					await handler.handleToolComplete(event as ToolExecutionCompleteEvent);
					return Response.json({ success: true });
				}

				case "agent.loop.complete":
					// Handle agent completion
					return agentCompleteHandler.handleAgentComplete(event as AgentLoopCompleteEvent);

				default:
					return Response.json({ error: `Unknown event type: ${type}` }, { status: 400 });
			}
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
