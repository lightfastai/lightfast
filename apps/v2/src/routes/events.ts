/**
 * Event management routes
 * For testing and debugging event emission
 */

import type { Event } from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { z } from "zod";
import { eventEmitter, redis } from "../config";

const eventRoutes = new Hono();

// POST /events/emit - Manually emit an event (for testing)
eventRoutes.post("/emit", async (c) => {
	try {
		const body = await c.req.json();

		// Validate event against schema
		// For now, just validate basic structure
		const event = body as Event;

		// Emit the event
		await eventEmitter.emit(event);

		return c.json({
			success: true,
			event: {
				id: event.id,
				type: event.type,
				sessionId: event.sessionId,
			},
			message: "Event emitted successfully",
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

		console.error("Event emission error:", error);
		return c.json(
			{
				error: "Failed to emit event",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// GET /events/list - List recent events for a session
eventRoutes.get("/list/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");
	const limit = Number(c.req.query("limit")) || 10;

	try {
		// Get events from Redis (stored in a list for debugging)
		const eventKey = `events:${sessionId}`;
		const events = await redis.lrange(eventKey, 0, limit - 1);

		const parsedEvents = events.map((event) => {
			try {
				return JSON.parse(event as string);
			} catch {
				return event;
			}
		});

		return c.json({
			sessionId,
			events: parsedEvents,
			count: parsedEvents.length,
		});
	} catch (error) {
		console.error("List events error:", error);
		return c.json(
			{
				error: "Failed to list events",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// POST /events/test/:type - Emit a test event of specific type
eventRoutes.post("/test/:type", async (c) => {
	const type = c.req.param("type");
	const { sessionId = "test-session" } = await c.req.json().catch(() => ({}));

	try {
		// Create test events based on type
		switch (type) {
			case "agent.loop.init":
				await eventEmitter.emitAgentLoopInit(sessionId, {
					messages: [{ role: "user", content: "Test message" }],
					temperature: 0.7,
					maxIterations: 5,
				});
				break;

			case "agent.tool.call":
				await eventEmitter.emitAgentToolCall(sessionId, {
					toolCallId: "test-tool-call",
					tool: "calculator",
					arguments: { expression: "2 + 2" },
					iteration: 1,
					priority: "normal",
				});
				break;

			case "tool.execution.complete":
				await eventEmitter.emitToolExecutionComplete(sessionId, {
					toolCallId: "test-tool-call",
					tool: "calculator",
					result: { value: 4 },
					duration: 100,
					attempts: 1,
				});
				break;

			case "agent.loop.complete":
				await eventEmitter.emitAgentLoopComplete(sessionId, {
					finalMessage: "Test completed successfully",
					iterations: 1,
					toolsUsed: ["calculator"],
					duration: 1000,
				});
				break;

			default:
				return c.json(
					{
						error: "Unknown event type",
						availableTypes: [
							"agent.loop.init",
							"agent.loop.complete",
							"agent.loop.error",
							"agent.tool.call",
							"tool.execution.start",
							"tool.execution.complete",
							"tool.execution.failed",
						],
					},
					400,
				);
		}

		// Store event for debugging
		const eventKey = `events:${sessionId}`;
		await redis.lpush(
			eventKey,
			JSON.stringify({
				type,
				sessionId,
				timestamp: new Date().toISOString(),
				test: true,
			}),
		);
		await redis.expire(eventKey, 3600); // 1 hour TTL

		return c.json({
			success: true,
			type,
			sessionId,
			message: `Test ${type} event emitted`,
		});
	} catch (error) {
		console.error("Test event error:", error);
		return c.json(
			{
				error: "Failed to emit test event",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// GET /events/types - List all available event types
eventRoutes.get("/types", (c) => {
	const eventTypes = [
		{ key: "AGENT_LOOP_INIT", value: "agent.loop.init" },
		{ key: "AGENT_LOOP_COMPLETE", value: "agent.loop.complete" },
		{ key: "AGENT_LOOP_ERROR", value: "agent.loop.error" },
		{ key: "AGENT_TOOL_CALL", value: "agent.tool.call" },
		{ key: "TOOL_EXECUTION_START", value: "tool.execution.start" },
		{ key: "TOOL_EXECUTION_COMPLETE", value: "tool.execution.complete" },
		{ key: "TOOL_EXECUTION_FAILED", value: "tool.execution.failed" },
		{ key: "STREAM_WRITE", value: "stream.write" },
		{ key: "RESOURCE_REQUEST", value: "resource.request" },
		{ key: "RESOURCE_RELEASE", value: "resource.release" },
	];

	return c.json({
		types: eventTypes.map(({ key, value }) => ({
			key,
			value,
			description: getEventDescription(value),
		})),
	});
});

function getEventDescription(type: string): string {
	const descriptions: Record<string, string> = {
		"agent.loop.init": "Initialize a new agent conversation",
		"agent.loop.complete": "Agent finished successfully",
		"agent.loop.error": "Agent encountered an error",
		"agent.tool.call": "Agent requests tool execution",
		"tool.execution.start": "Tool begins processing",
		"tool.execution.complete": "Tool finished successfully",
		"tool.execution.failed": "Tool failed after retries",
		"stream.write": "Write data to Redis stream",
		"resource.request": "Request a pooled resource",
		"resource.release": "Release a pooled resource",
	};

	return descriptions[type] || "Unknown event type";
}

export { eventRoutes };
