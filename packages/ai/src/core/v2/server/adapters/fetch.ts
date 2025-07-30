/**
 * V2 Fetch Request Handler
 * Unified routing handler for v2 agent worker routes
 */

import type { Client as QStashClient } from "@upstash/qstash";
import { Receiver } from "@upstash/qstash";
import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import { env } from "../../env";
import { handleAgentStep } from "../handlers/runtime/step-handler";
import { handleToolCall } from "../handlers/runtime/tool-handler";
import { handleStreamInit } from "../handlers/stream-init-handler";
import { handleStreamSSE } from "../handlers/stream-sse-handler";
import { getSessionKey } from "../keys";
import type { SessionState } from "../runtime/types";

export interface FetchRequestHandlerOptions<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash?: QStashClient;
	baseUrl: string; // Base URL for generating stream URLs (e.g., "/api/v2")
	resourceId: string; // Required resource ID (user ID in our case)
}

export interface AgentLoopStepRequestBody {
	sessionId: string;
	stepIndex: number;
	resourceId?: string;
	assistantMessageId?: string;
}

export interface AgentToolCallRequestBody {
	sessionId: string;
	toolCallId: string;
	toolName: string;
	toolArgs: Record<string, any>;
}

export interface ToolExecutionCompleteRequestBody {
	sessionId: string;
	toolCallId: string;
	toolName: string;
	result: any;
}

export interface AgentLoopCompleteRequestBody {
	sessionId: string;
	finalMessage: string;
}

/**
 * Unified fetch request handler for v2 agent workers
 *
 * Routes:
 * - POST /stream/init - Initialize a new stream
 * - GET  /stream/[sessionId] - Server-Sent Events stream
 * - POST /workers/agent-loop-step - Process agent loop step
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
 * }, redis);
 *
 * export async function POST(req: NextRequest) {
 *   return fetchRequestHandler({
 *     agent: myAgent,
 *     redis,
 *     baseUrl: "/api/v2"
 *   });
 * }
 * ```
 */
export function fetchRequestHandler<TRuntimeContext = unknown>(
	options: FetchRequestHandlerOptions<TRuntimeContext>,
): (request: Request) => Promise<Response> {
	const { agent, redis, qstash, baseUrl, resourceId } = options;

	return async function handler(request: Request): Promise<Response> {
		try {
			// Extract path from URL
			const url = new URL(request.url);
			// Extract just the path part from baseUrl if it includes the full URL
			const baseUrlPath = baseUrl.includes("://") ? new URL(baseUrl).pathname : baseUrl;
			const pathSegments = url.pathname.replace(baseUrlPath, "").split("/").filter(Boolean);

			console.log(
				`[V2 Fetch Handler] URL: ${request.url}, Path: ${url.pathname}, BaseUrlPath: ${baseUrlPath}, Segments:`,
				pathSegments,
			);

			// Handle stream endpoints
			if (pathSegments[0] === "stream") {
				if (pathSegments[1] === "init") {
					// Handle POST /stream/init
					if (request.method === "POST") {
						return handleStreamInit(request, { agent, redis, qstash, baseUrl, resourceId });
					}
				} else if (pathSegments[1]) {
					// Handle GET /stream/[streamId] (can be sessionId or messageId)
					const streamId = pathSegments[1];
					return await handleStreamSSE(streamId, { redis }, request.signal);
				}
			}

			// Handle worker endpoints
			if (pathSegments[0] === "workers") {
				// Verify QStash signature if signing keys are configured
				if (qstash && env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
					const signature = request.headers.get("upstash-signature");
					if (!signature) {
						return Response.json({ error: "Missing QStash signature" }, { status: 401 });
					}

					// Clone request to read body for verification
					const body = await request.clone().text();

					try {
						// Create receiver instance for verification
						const receiver = new Receiver({
							currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
							nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
						});

						const isValid = await receiver.verify({
							signature,
							body,
							url: request.url,
						});

						if (!isValid) {
							return Response.json({ error: "Invalid QStash signature" }, { status: 401 });
						}
					} catch (error) {
						console.error("[V2 Worker Handler] QStash signature verification failed:", error);
						return Response.json({ error: "Invalid QStash signature" }, { status: 401 });
					}
				} else if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
					console.log("[V2 Worker Handler] QStash signing keys not configured - skipping signature verification");
				}

				const workerAction = pathSegments[1];

				switch (workerAction) {
					case "agent-loop-step": {
						// Handle POST /workers/agent-loop-step
						const body = (await request.json()) as AgentLoopStepRequestBody;
						console.log(`[V2 Worker Handler] Processing agent.loop.step event`);
						if (!qstash) {
							return Response.json({ error: "QStash client not configured" }, { status: 500 });
						}
						return handleAgentStep(body, { agent, redis, qstash, baseUrl, resourceId });
					}

					case "agent-tool-call": {
						// Handle POST /workers/agent-tool-call
						const body = (await request.json()) as AgentToolCallRequestBody;
						console.log(`[V2 Worker Handler] Processing agent.tool.call event`);
						if (!qstash) {
							return Response.json({ error: "QStash client not configured" }, { status: 500 });
						}
						return handleToolCall(body, { agent, redis, qstash, baseUrl, resourceId });
					}

					case "tool-execution-complete": {
						// Handle POST /workers/tool-execution-complete
						const body = (await request.json()) as ToolExecutionCompleteRequestBody;
						console.log(`[V2 Worker Handler] Processing tool.execution.complete event`);
						// TODO: This event handler needs to be refactored to work without EventEmitter
						// For now, just acknowledge the event
						return Response.json({ success: true });
					}

					case "agent-loop-complete": {
						// Handle POST /workers/agent-loop-complete
						const body = (await request.json()) as AgentLoopCompleteRequestBody;
						console.log(`[V2 Worker Handler] Processing agent.loop.complete event`);
						// TODO: Implement new event system handling
						return Response.json({ success: true });
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
