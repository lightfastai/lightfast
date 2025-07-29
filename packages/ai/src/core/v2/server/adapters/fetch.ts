/**
 * V2 Fetch Request Handler
 * Unified handler for v2 agent worker routes
 */

import type { Redis } from "@upstash/redis";
import type { Agent, AgentToolDefinition } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type {
	AgentLoopCompleteEvent,
	AgentLoopInitEvent,
	AgentToolCallEvent,
	Message,
	ToolExecutionCompleteEvent,
} from "../../events/schemas";
import { ToolResultHandler } from "../../workers/tool-result-handler";
import { StreamConsumer } from "../stream-consumer";
import { StreamGenerator } from "../stream-generator";
import { StreamWriter } from "../stream-writer";

export interface FetchRequestHandlerOptions {
	agent: Agent;
	redis: Redis;
	eventEmitter: EventEmitter;
	baseUrl: string; // Base URL for generating stream URLs (e.g., "/api/v2")
}

export interface WorkerRequestBody {
	type: "agent.loop.init" | "agent.tool.call" | "tool.execution.complete" | "agent.loop.complete";
	event: AgentLoopInitEvent | AgentToolCallEvent | ToolExecutionCompleteEvent | AgentLoopCompleteEvent;
}

export interface StreamInitRequestBody {
	messages: Message[];
	sessionId?: string;
	systemPrompt?: string;
	temperature?: number;
	maxIterations?: number;
	tools?: string[];
	metadata?: Record<string, any>;
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
export function fetchRequestHandler(options: FetchRequestHandlerOptions): (request: Request) => Promise<Response> {
	const { agent, redis, eventEmitter, baseUrl } = options;
	const streamGenerator = new StreamGenerator(redis);
	const streamConsumer = new StreamConsumer(redis);

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
						return handleStreamInit(request, agent, redis, eventEmitter, streamGenerator, baseUrl);
					} else if (request.method === "GET") {
						return handleStreamStatus(request, redis, streamGenerator);
					}
				} else if (pathSegments[1]) {
					// Handle GET /stream/[sessionId]
					const sessionId = pathSegments[1];
					return handleStreamSSE(sessionId, streamConsumer);
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

				case "agent.tool.call": {
					// Execute tool
					const toolEvent = event as AgentToolCallEvent;
					const streamKey = `v2:stream:${toolEvent.sessionId}`;
					let success = false;
					let result: any;

					try {
						// Execute the tool using the agent
						result = await agent.executeTool(toolEvent.data.tool, toolEvent.data.arguments || {});
						success = true;

						// Write result to stream
						await redis.xadd(streamKey, "*", {
							type: "tool",
							content: `Tool ${toolEvent.data.tool} executed successfully`,
							metadata: JSON.stringify({
								event: "tool.result",
								tool: toolEvent.data.tool,
								toolCallId: toolEvent.data.toolCallId,
								result,
								success,
							}),
						});
					} catch (error) {
						result = { error: error instanceof Error ? error.message : String(error) };
						success = false;

						// Write error to stream
						await redis.xadd(streamKey, "*", {
							type: "error",
							content: `Tool ${toolEvent.data.tool} failed: ${result.error}`,
							metadata: JSON.stringify({
								event: "tool.error",
								tool: toolEvent.data.tool,
								toolCallId: toolEvent.data.toolCallId,
								error: result.error,
							}),
						});
					}

					// Emit completion or failure event
					if (success) {
						await eventEmitter.emitToolExecutionComplete(toolEvent.sessionId, {
							toolCallId: toolEvent.data.toolCallId,
							tool: toolEvent.data.tool,
							result,
							duration: 500,
							attempts: 1,
						});

						// Add tool result to session messages
						const sessionKey = `v2:session:${toolEvent.sessionId}`;
						const sessionData = await redis.get(sessionKey);
						if (sessionData) {
							const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
							session.messages.push({
								role: "tool",
								content: JSON.stringify(result),
								toolCallId: toolEvent.data.toolCallId,
								toolName: toolEvent.data.tool,
							});
							session.updatedAt = new Date().toISOString();
							await redis.setex(sessionKey, 86400, JSON.stringify(session));
						}
					} else {
						await eventEmitter.emitToolExecutionFailed(toolEvent.sessionId, {
							toolCallId: toolEvent.data.toolCallId,
							tool: toolEvent.data.tool,
							error: result.error,
							lastAttemptDuration: 500,
							attempts: 1,
						});
					}

					return Response.json({ success: true });
				}

				case "tool.execution.complete": {
					// Handle tool completion
					const handler = new ToolResultHandler(redis, eventEmitter);
					await handler.handleToolComplete(event as ToolExecutionCompleteEvent);
					return Response.json({ success: true });
				}

				case "agent.loop.complete": {
					// Handle agent completion
					const completeEvent = event as AgentLoopCompleteEvent;
					const streamWriter = new StreamWriter(redis);

					// Update session status to completed
					const sessionKey = `v2:session:${completeEvent.sessionId}`;
					const sessionData = await redis.get(sessionKey);

					if (sessionData) {
						const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
						session.status = "completed";
						session.completedAt = new Date().toISOString();
						session.finalResponse = completeEvent.data.finalMessage;
						session.totalIterations = completeEvent.data.iterations || 1;

						// Extend TTL since session is complete
						await redis.setex(sessionKey, 86400, JSON.stringify(session)); // 24 hours
					}

					// Write completion event to stream
					await streamWriter.writeMessage(completeEvent.sessionId, {
						type: "completion",
						content: `Agent completed processing: ${completeEvent.data.finalMessage}`,
						metadata: JSON.stringify({
							event: "agent.complete",
							sessionId: completeEvent.sessionId,
							response: completeEvent.data.finalMessage,
							iterations: completeEvent.data.iterations,
							toolsUsed: completeEvent.data.toolsUsed,
							duration: completeEvent.data.duration,
						}),
					});

					// Write final response to stream
					if (completeEvent.data.finalMessage) {
						await streamWriter.writeChunk(completeEvent.sessionId, completeEvent.data.finalMessage);
					}

					// Write metadata with completed status to signal stream end
					await streamWriter.writeMessage(completeEvent.sessionId, {
						type: "metadata",
						content: "Stream completed",
						status: "completed",
						sessionId: completeEvent.sessionId,
						timestamp: new Date().toISOString(),
					});

					return Response.json({ success: true });
				}

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

// Helper function to handle stream initialization
async function handleStreamInit(
	request: Request,
	agent: Agent,
	redis: Redis,
	eventEmitter: EventEmitter,
	streamGenerator: StreamGenerator,
	baseUrl: string,
): Promise<Response> {
	const body = (await request.json()) as StreamInitRequestBody;
	const {
		messages,
		sessionId: providedSessionId,
		systemPrompt = agent.options.systemPrompt,
		temperature = agent.options.temperature || 0.7,
		maxIterations = agent.options.maxIterations || 10,
		tools = agent.getAvailableTools(),
		metadata = {},
	} = body;

	// Validate messages
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		return Response.json({ error: "Messages array is required" }, { status: 400 });
	}

	// Use provided session ID or generate new one
	const sessionId = providedSessionId || streamGenerator.createSessionId();

	// Check if stream already exists
	const exists = await streamGenerator.streamExists(sessionId);
	if (exists) {
		return Response.json({ error: "Session already exists", sessionId }, { status: 409 });
	}

	// Initialize session state in Redis
	const sessionKey = `v2:session:${sessionId}`;
	const sessionData = {
		sessionId,
		messages: messages as Message[],
		systemPrompt,
		temperature,
		maxIterations,
		tools,
		metadata,
		createdAt: new Date().toISOString(),
		status: "initializing",
		iteration: 0,
		updatedAt: new Date().toISOString(),
	};

	// Store session data (expire after 24 hours)
	await redis.setex(sessionKey, 86400, JSON.stringify(sessionData));

	// Create initial stream entry to establish the stream
	const streamKey = `v2:stream:${sessionId}`;
	await redis.xadd(streamKey, "*", {
		type: "status",
		content: "Session initialized",
		metadata: JSON.stringify({ status: "initialized" }),
	});

	// Create agent loop init event structure
	const agentLoopEvent: AgentLoopInitEvent = {
		id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
		type: "agent.loop.init",
		sessionId,
		timestamp: new Date().toISOString(),
		version: "1.0",
		data: {
			messages: messages as Message[],
			systemPrompt,
			temperature,
			maxIterations,
			tools,
			metadata,
		},
	};

	// Run the first agent loop immediately in the background
	// Don't await this - let it stream while we return the response
	agent.processEvent(agentLoopEvent).catch((error) => {
		console.error(`[Stream Init] First agent loop failed for session ${sessionId}:`, error);
	});

	// Return session info immediately
	return Response.json({
		sessionId,
		streamUrl: `${baseUrl}/stream/${sessionId}`,
		status: "initialized",
		message: "Agent loop initialized. Connect to the stream URL to receive updates.",
	});
}

// Helper function to handle stream status check
async function handleStreamStatus(request: Request, redis: Redis, streamGenerator: StreamGenerator): Promise<Response> {
	const url = new URL(request.url);
	const sessionId = url.searchParams.get("sessionId");

	if (!sessionId) {
		return Response.json({ error: "Session ID is required" }, { status: 400 });
	}

	// Get session data
	const sessionKey = `v2:session:${sessionId}`;
	const sessionData = await redis.get(sessionKey);

	if (!sessionData) {
		return Response.json({ error: "Session not found" }, { status: 404 });
	}

	// Get stream info
	const streamInfo = await streamGenerator.getStreamInfo(sessionId);

	return Response.json({
		sessionId,
		session: typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData,
		stream: streamInfo,
	});
}

// Helper function to handle SSE stream
function handleStreamSSE(sessionId: string, streamConsumer: StreamConsumer): Response {
	if (!sessionId) {
		return new Response("Session ID is required", { status: 400 });
	}

	try {
		// Create SSE stream
		const stream = streamConsumer.createSSEStream(sessionId);

		// Return SSE response
		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				// CORS headers if needed
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("Stream error:", error);
		return new Response("Failed to create stream", { status: 500 });
	}
}
