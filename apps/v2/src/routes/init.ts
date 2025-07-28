/**
 * Session initialization routes
 * Similar to /api/v2/stream/init but simplified for testing
 */

import type { Message } from "@lightfast/ai/v2/core";
import { Hono } from "hono";
import { z } from "zod";
import { redis, eventEmitter, streamGenerator, SYSTEM_LIMITS } from "../config";

const initRoutes = new Hono();

// Request schema
const InitRequestSchema = z.object({
	messages: z.array(
		z.object({
			role: z.enum(["system", "user", "assistant", "tool"]),
			content: z.string(),
		}),
	),
	sessionId: z.string().optional(),
	systemPrompt: z.string().optional(),
	temperature: z.number().min(0).max(2).default(0.7),
	maxIterations: z.number().min(1).max(50).default(SYSTEM_LIMITS.agentMaxIterations),
	tools: z.array(z.string()).optional(),
	metadata: z.record(z.any()).optional(),
});

// POST /init - Initialize a new agent session
initRoutes.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const params = InitRequestSchema.parse(body);

		// Generate or use provided session ID
		const sessionId = params.sessionId || streamGenerator.createSessionId();

		// Check if session already exists
		const exists = await streamGenerator.streamExists(sessionId);
		if (exists) {
			return c.json(
				{
					error: "Session already exists",
					sessionId,
				},
				409,
			);
		}

		// Initialize session state
		const sessionKey = `session:${sessionId}`;
		const sessionData = {
			messages: params.messages as Message[],
			systemPrompt: params.systemPrompt,
			temperature: params.temperature,
			maxIterations: params.maxIterations,
			tools: params.tools || [],
			metadata: params.metadata || {},
			createdAt: new Date().toISOString(),
			status: "initializing",
			iterations: 0,
		};

		// Store session data (24 hour TTL)
		await redis.setex(sessionKey, 86400, JSON.stringify(sessionData));

		// Create initial stream entry
		const streamKey = `stream:${sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "status",
			content: "Session initialized",
			metadata: JSON.stringify({ status: "initialized" }),
		});

		// Emit agent.loop.init event
		await eventEmitter.emitAgentLoopInit(sessionId, {
			messages: params.messages as Message[],
			systemPrompt: params.systemPrompt,
			temperature: params.temperature,
			maxIterations: params.maxIterations,
			tools: params.tools,
			metadata: params.metadata,
		});

		return c.json({
			sessionId,
			streamUrl: `/stream/${sessionId}`,
			status: "initialized",
			message: "Agent loop initialized. Connect to the stream URL to receive updates.",
			session: sessionData,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json(
				{
					error: "Invalid request",
					details: error.errors,
				},
				400,
			);
		}

		console.error("Init error:", error);
		return c.json(
			{
				error: "Failed to initialize session",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// GET /init/:sessionId - Get session status
initRoutes.get("/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");

	try {
		// Get session data
		const sessionKey = `session:${sessionId}`;
		const sessionData = await redis.get(sessionKey);

		if (!sessionData) {
			return c.json(
				{
					error: "Session not found",
					sessionId,
				},
				404,
			);
		}

		// Get stream info
		const streamInfo = await streamGenerator.getStreamInfo(sessionId);

		return c.json({
			sessionId,
			session: JSON.parse(sessionData as string),
			stream: streamInfo,
		});
	} catch (error) {
		console.error("Get session error:", error);
		return c.json(
			{
				error: "Failed to get session info",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

export { initRoutes };
