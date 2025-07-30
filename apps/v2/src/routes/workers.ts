/**
 * Worker endpoints
 * Simulates Qstash worker endpoints for local testing
 */

import {
	Agent,
	type AgentLoopInitEvent,
	AgentLoopInitEventSchema,
	type AgentLoopStepEvent,
	AgentLoopStepEventSchema,
	type AgentToolCallEvent,
	AgentToolCallEventSchema,
	type AgentToolDefinition,
} from "@lightfast/ai/v2/core";
import { handleAgentInit, handleAgentStep, handleToolCall } from "@lightfast/ai/v2/server";
import { Hono } from "hono";
import { z } from "zod";
import { baseUrl, qstash, redis } from "../config";

const workerRoutes = new Hono();

// Define tools with proper typing
const tools: AgentToolDefinition[] = [
	{
		name: "calculator",
		description: "Performs mathematical calculations",
		execute: async (args: Record<string, any>) => {
			// Simple calculation for testing (safe approach)
			const expression = args.expression;
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
				return { expression, value };
			}
			throw new Error("Invalid expression format");
		},
	},
	{
		name: "weather",
		description: "Gets weather information for a location",
		execute: async (args: Record<string, any>) => {
			// Mock weather data
			return {
				location: args.location || "Unknown",
				temperature: 72,
				conditions: "Partly cloudy",
				humidity: 65,
			};
		},
	},
];

// Create test agent with tools
const agent = new Agent(
	{
		name: "test-agent",
		systemPrompt: "You are a helpful AI assistant.",
		model: "anthropic/claude-3-5-sonnet-20241022",
		temperature: 0.7,
		tools,
	},
	redis,
);

// POST /workers/agent-loop-init - Initialize agent loop
workerRoutes.post("/agent-loop-init", async (c) => {
	try {
		const body = await c.req.json();
		const event = AgentLoopInitEventSchema.parse(body);

		console.log(`[Worker] Processing agent.loop.init event ${event.id} for session ${event.sessionId}`);

		// Use the runtime handler
		const response = await handleAgentInit(event, {
			agent,
			redis,
			qstash,
			baseUrl,
		});

		return response;
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

		console.error("[Worker] Error:", error);
		return c.json(
			{
				error: "Agent loop initialization failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// POST /workers/agent-loop-step - Process agent loop step
workerRoutes.post("/agent-loop-step", async (c) => {
	try {
		const body = await c.req.json();
		const event = AgentLoopStepEventSchema.parse(body);

		console.log(`[Worker] Processing agent.loop.step event ${event.id} for session ${event.sessionId}`);

		// Use the runtime handler
		const response = await handleAgentStep(event, {
			agent,
			redis,
			qstash,
			baseUrl,
		});

		return response;
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

		console.error("[Worker] Error:", error);
		return c.json(
			{
				error: "Agent loop step processing failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// POST /workers/agent-tool-call - Execute tool
workerRoutes.post("/agent-tool-call", async (c) => {
	try {
		const body = await c.req.json();
		const event = AgentToolCallEventSchema.parse(body);

		console.log(`[Worker] Processing agent.tool.call event ${event.id} for session ${event.sessionId}`);

		// Use the runtime handler
		const response = await handleToolCall(event, {
			agent,
			redis,
			qstash,
			baseUrl,
		});

		return response;
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

		console.error("[Worker] Error:", error);
		return c.json(
			{
				error: "Tool call execution failed",
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
			agentLoopInit: {
				endpoint: "/workers/agent-loop-init",
				status: "ready",
			},
			agentLoopStep: {
				endpoint: "/workers/agent-loop-step",
				status: "ready",
			},
			agentToolCall: {
				endpoint: "/workers/agent-tool-call",
				status: "ready",
			},
		},
		timestamp: new Date().toISOString(),
	});
});

export { workerRoutes };
