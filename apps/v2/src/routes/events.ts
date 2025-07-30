/**
 * Event management routes
 * For testing and debugging event publishing
 */

import type { OrchestrationMessage } from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { z } from "zod";
import { baseUrl, qstash, redis } from "../config";

const eventRoutes = new Hono();

// POST /events/publish - Manually publish an event to workers (for testing)
eventRoutes.post("/publish", async (c) => {
	try {
		const body = await c.req.json();

		// Validate event against schema
		const event = body as OrchestrationMessage;

		// Determine worker URL based on event type
		let workerUrl: string;
		switch (event.type) {
			case "agent.loop.init":
				workerUrl = `${baseUrl}/workers/agent-loop-init`;
				break;
			case "agent.loop.step":
				workerUrl = `${baseUrl}/workers/agent-loop-step`;
				break;
			case "agent.tool.call":
				workerUrl = `${baseUrl}/workers/agent-tool-call`;
				break;
			default:
				return c.json(
					{
						error: `Unknown event type: ${event.type}`,
					},
					400,
				);
		}

		// Publish the event via QStash
		await qstash.publishJSON({
			url: workerUrl,
			body: { event },
		});

		return c.json({
			success: true,
			event: {
				id: event.id,
				type: event.type,
				sessionId: event.sessionId,
			},
			message: "Event published successfully",
			workerUrl,
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

		console.error("Event publishing error:", error);
		return c.json(
			{
				error: "Failed to publish event",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// GET /events/session/:sessionId - Get event history for a session
eventRoutes.get("/session/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");

	try {
		// Get stream entries
		const streamKey = `stream:${sessionId}`;
		const entries = (await redis.xrange(streamKey, "-", "+")) as unknown as any[];

		// Parse entries
		const events = entries.map((entry) => ({
			id: entry.id,
			timestamp: entry.id.split("-")[0],
			data: entry.data,
		}));

		return c.json({
			sessionId,
			eventCount: events.length,
			events,
		});
	} catch (error) {
		console.error("Event history error:", error);
		return c.json(
			{
				error: "Failed to retrieve event history",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// GET /events/sessions - List active sessions
eventRoutes.get("/sessions", async (c) => {
	try {
		// Get all session keys
		const keys = await redis.keys("session:*");

		const sessions = [];
		for (const key of keys) {
			const sessionId = key.replace("session:", "");
			const sessionData = await redis.get(key);
			if (sessionData) {
				const data = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
				sessions.push({
					sessionId,
					status: data.status,
					createdAt: data.createdAt,
					messageCount: data.messages?.length || 0,
				});
			}
		}

		return c.json({
			sessionCount: sessions.length,
			sessions,
		});
	} catch (error) {
		console.error("Session list error:", error);
		return c.json(
			{
				error: "Failed to list sessions",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

export { eventRoutes };
