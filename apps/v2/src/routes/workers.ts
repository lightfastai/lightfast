/**
 * Worker endpoints
 * Simulates Qstash worker endpoints for local testing
 */

import {
	type AgentLoopInitEvent,
	AgentLoopInitEventSchema,
	type AgentToolCallEvent,
	AgentToolCallEventSchema,
	createV2Infrastructure,
} from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { z } from "zod";

const workerRoutes = new Hono();

// Initialize infrastructure
const { redis, eventEmitter, streamGenerator } = createV2Infrastructure();

// POST /workers/agent-loop - Agent loop worker endpoint
workerRoutes.post("/agent-loop", async (c) => {
	try {
		const body = await c.req.json();
		const event = AgentLoopInitEventSchema.parse(body);

		console.log(`[Agent Loop Worker] Processing event ${event.id} for session ${event.sessionId}`);

		// Get session data
		const sessionKey = `session:${event.sessionId}`;
		const sessionData = await redis.get(sessionKey);

		if (!sessionData) {
			throw new Error(`Session ${event.sessionId} not found`);
		}

		const session = JSON.parse(sessionData as string);

		// Update session status
		session.status = "processing";
		await redis.setex(sessionKey, 86400, JSON.stringify(session));

		// Write to stream
		const streamKey = `stream:${event.sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "event",
			content: "Agent loop started",
			metadata: JSON.stringify({
				event: "agent.loop.start",
				iteration: 1,
			}),
		});

		// Simulate agent thinking
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// For testing, always decide to use calculator tool
		const toolCallId = `tc_${Date.now()}`;

		// Write tool decision to stream
		await redis.xadd(streamKey, "*", {
			type: "event",
			content: "Decided to use calculator tool",
			metadata: JSON.stringify({
				event: "agent.decision",
				tool: "calculator",
				toolCallId,
			}),
		});

		// Emit tool call event
		await eventEmitter.emitAgentToolCall(event.sessionId, {
			toolCallId,
			tool: "calculator",
			arguments: { expression: "2 + 2" },
			iteration: 1,
			priority: "normal",
		});

		return c.json({
			success: true,
			message: "Agent loop processed",
			sessionId: event.sessionId,
			decision: {
				action: "tool_call",
				tool: "calculator",
				toolCallId,
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json(
				{
					error: "Invalid event",
					details: error.errors,
				},
				400,
			);
		}

		console.error("[Agent Loop Worker] Error:", error);
		return c.json(
			{
				error: "Agent loop processing failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// POST /workers/tool-executor - Tool executor worker endpoint
workerRoutes.post("/tool-executor", async (c) => {
	try {
		const body = await c.req.json();
		const event = AgentToolCallEventSchema.parse(body);

		console.log(`[Tool Executor] Processing tool call ${event.data.toolCallId} for session ${event.sessionId}`);

		// Emit tool execution start
		await eventEmitter.emitToolExecutionStart(event.sessionId, {
			toolCallId: event.data.toolCallId,
			tool: event.data.tool,
			attempt: 1,
			timeout: 5000,
		});

		// Write to stream
		const streamKey = `stream:${event.sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "event",
			content: `Executing ${event.data.tool} tool...`,
			metadata: JSON.stringify({
				event: "tool.execution.start",
				tool: event.data.tool,
				toolCallId: event.data.toolCallId,
			}),
		});

		// Simulate tool execution
		await new Promise((resolve) => setTimeout(resolve, 500));

		let result: any;
		let success = true;

		// Execute based on tool
		switch (event.data.tool) {
			case "calculator":
				try {
					// Simple calculation for testing (safe approach)
					const expression = (event.data.arguments as any).expression as string;
					// Parse simple expressions like "2 + 2" or "25 * 4"
					const match = expression.match(/^(\d+)\s*([+\-*/])\s*(\d+)$/);
					if (match) {
						const [, a, op, b] = match;
						const numA = Number(a);
						const numB = Number(b);
						let value = 0;
						switch (op) {
							case "+":
								value = numA + numB;
								break;
							case "-":
								value = numA - numB;
								break;
							case "*":
								value = numA * numB;
								break;
							case "/":
								value = numA / numB;
								break;
						}
						result = { expression, value };
					} else {
						throw new Error("Invalid expression format");
					}
				} catch (err) {
					success = false;
					result = { error: "Invalid expression" };
				}
				break;

			case "weather":
				// Mock weather data
				result = {
					location: (event.data.arguments as any).location || "Unknown",
					temperature: 72,
					conditions: "Partly cloudy",
					humidity: 65,
				};
				break;

			default:
				success = false;
				result = { error: `Unknown tool: ${event.data.tool}` };
		}

		// Write result to stream
		await redis.xadd(streamKey, "*", {
			type: "chunk",
			content: JSON.stringify(result),
			metadata: JSON.stringify({
				event: "tool.result",
				tool: event.data.tool,
				toolCallId: event.data.toolCallId,
				success,
			}),
		});

		// Emit completion or failure event
		if (success) {
			await eventEmitter.emitToolExecutionComplete(event.sessionId, {
				toolCallId: event.data.toolCallId,
				tool: event.data.tool,
				result,
				duration: 500,
				attempts: 1,
			});

			// For testing, complete the agent loop after tool execution
			await eventEmitter.emitAgentLoopComplete(event.sessionId, {
				finalMessage: `Tool ${event.data.tool} executed successfully. Result: ${JSON.stringify(result)}`,
				iterations: 1,
				toolsUsed: [event.data.tool],
				duration: 2000,
			});

			// Write completion to stream
			await redis.xadd(streamKey, "*", {
				type: "status",
				content: "completed",
				metadata: JSON.stringify({
					event: "agent.loop.complete",
				}),
			});
		} else {
			await eventEmitter.emitToolExecutionFailed(event.sessionId, {
				toolCallId: event.data.toolCallId,
				tool: event.data.tool,
				error: result.error || "Tool execution failed",
				attempts: 1,
				lastAttemptDuration: 500,
			});
		}

		return c.json({
			success,
			message: success ? "Tool executed successfully" : "Tool execution failed",
			sessionId: event.sessionId,
			result,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json(
				{
					error: "Invalid event",
					details: error.errors,
				},
				400,
			);
		}

		console.error("[Tool Executor] Error:", error);
		return c.json(
			{
				error: "Tool execution failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// GET /workers/status - Check worker status
workerRoutes.get("/status", (c) => {
	return c.json({
		status: "ok",
		workers: {
			agentLoop: {
				endpoint: "/workers/agent-loop",
				status: "ready",
			},
			toolExecutor: {
				endpoint: "/workers/tool-executor",
				status: "ready",
			},
		},
		timestamp: new Date().toISOString(),
	});
});

export { workerRoutes };
