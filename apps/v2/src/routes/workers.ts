/**
 * Worker endpoints
 * Simulates Qstash worker endpoints for local testing
 */

import {
	Agent,
	type AgentLoopInitEvent,
	AgentLoopInitEventSchema,
	type AgentToolCallEvent,
	AgentToolCallEventSchema,
	type ToolExecutionCompleteEvent,
	ToolExecutionCompleteEventSchema,
	type ToolExecutionFailedEvent,
	ToolExecutionFailedEventSchema,
	ToolResultHandler,
} from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { z } from "zod";
import { eventEmitter, redis } from "../config";

const workerRoutes = new Hono();

// Create worker instances - using Agent instead of AgentLoopWorker
const agent = new Agent(
	{
		name: "test-agent",
		systemPrompt: "You are a helpful AI assistant.",
		model: "anthropic/claude-3-5-sonnet-20241022", // Required for streamText
		temperature: 0.7,
	},
	redis,
	eventEmitter,
	{
		maxExecutionTime: 25000,
		retryAttempts: 3,
		retryDelay: 1000,
	},
);

const toolResultHandler = new ToolResultHandler(redis, eventEmitter);

// POST /workers/agent-loop - Agent loop worker endpoint
workerRoutes.post("/agent-loop", async (c) => {
	try {
		const body = await c.req.json();
		const event = AgentLoopInitEventSchema.parse(body);

		console.log(`[Agent] Processing event ${event.id} for session ${event.sessionId}`);

		// Process the event using the Agent class
		await agent.processEvent(event);

		return c.json({
			success: true,
			message: "Agent loop processed successfully",
			sessionId: event.sessionId,
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

		console.error("[Agent] Error:", error);
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

			// Add tool result to session messages
			const sessionKey = `session:${event.sessionId}`;
			const sessionData = await redis.get(sessionKey);
			if (sessionData) {
				const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
				session.messages.push({
					role: "tool",
					content: JSON.stringify(result),
					toolCallId: event.data.toolCallId,
					toolName: event.data.tool,
				});
				session.updatedAt = new Date().toISOString();
				await redis.setex(sessionKey, 86400, JSON.stringify(session));
			}
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

// POST /workers/tool-result-complete - Handle tool execution complete
workerRoutes.post("/tool-result-complete", async (c) => {
	try {
		const body = await c.req.json();
		const event = ToolExecutionCompleteEventSchema.parse(body);

		console.log(`[Tool Result Handler] Processing complete event for ${event.data.tool}`);

		await toolResultHandler.handleToolComplete(event);

		return c.json({
			success: true,
			message: "Tool result processed successfully",
			sessionId: event.sessionId,
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

		console.error("[Tool Result Handler] Error:", error);
		return c.json(
			{
				error: "Tool result processing failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// POST /workers/tool-result-failed - Handle tool execution failed
workerRoutes.post("/tool-result-failed", async (c) => {
	try {
		const body = await c.req.json();
		const event = ToolExecutionFailedEventSchema.parse(body);

		console.log(`[Tool Result Handler] Processing failed event for ${event.data.tool}`);

		await toolResultHandler.handleToolFailed(event);

		return c.json({
			success: true,
			message: "Tool failure processed successfully",
			sessionId: event.sessionId,
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

		console.error("[Tool Result Handler] Error:", error);
		return c.json(
			{
				error: "Tool failure processing failed",
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
			toolResultComplete: {
				endpoint: "/workers/tool-result-complete",
				status: "ready",
			},
			toolResultFailed: {
				endpoint: "/workers/tool-result-failed",
				status: "ready",
			},
		},
		timestamp: new Date().toISOString(),
	});
});

export { workerRoutes };
