/**
 * API route to initialize an agent loop session
 * POST /api/v2/stream/init
 *
 * This replaces the old /api/v2/generate endpoint.
 * Instead of directly generating LLM output, this endpoint:
 * 1. Creates a new session
 * 2. Initializes Redis state
 * 3. Emits an agent.loop.init event to Qstash
 * 4. Returns the sessionId immediately
 */

import { createV2Infrastructure, getSystemLimits } from "@lightfast/ai/v2/core";
import type { Message } from "@lightfast/ai/v2/events";
import { type NextRequest, NextResponse } from "next/server";

// Initialize V2 infrastructure (singleton)
const { redis, streamGenerator: generator, eventEmitter } = createV2Infrastructure();
const limits = getSystemLimits();

export async function POST(req: NextRequest) {
	try {
		const {
			messages,
			sessionId: providedSessionId,
			systemPrompt,
			temperature = 0.7,
			maxIterations = limits.agentMaxIterations,
			tools = [],
			metadata = {},
		} = await req.json();

		// Validate messages
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
		}

		// Use provided session ID or generate new one
		const sessionId = providedSessionId || generator.createSessionId();

		// Check if stream already exists
		const exists = await generator.streamExists(sessionId);
		if (exists) {
			return NextResponse.json({ error: "Session already exists", sessionId }, { status: 409 });
		}

		// Initialize session state in Redis
		const sessionKey = `session:${sessionId}`;
		const sessionData = {
			messages: messages as Message[],
			systemPrompt,
			temperature,
			maxIterations,
			tools,
			metadata,
			createdAt: new Date().toISOString(),
			status: "initializing",
			iterations: 0,
		};

		// Store session data (expire after 24 hours)
		await redis.setex(sessionKey, 86400, JSON.stringify(sessionData));

		// Create initial stream entry to establish the stream
		const streamKey = `stream:${sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "status",
			content: "Session initialized",
			metadata: JSON.stringify({ status: "initialized" }),
		});

		// Emit agent.loop.init event to start the agent loop
		await eventEmitter.emitAgentLoopInit(sessionId, {
			messages: messages as Message[],
			systemPrompt,
			temperature,
			maxIterations,
			tools,
			metadata,
		});

		// Return session info immediately
		return NextResponse.json({
			sessionId,
			streamUrl: `/api/v2/stream/${sessionId}`,
			status: "initialized",
			message: "Agent loop initialized. Connect to the stream URL to receive updates.",
		});
	} catch (error) {
		console.error("Stream init error:", error);
		return NextResponse.json({ error: "Failed to initialize agent loop" }, { status: 500 });
	}
}

// GET endpoint to check session status
export async function GET(req: NextRequest) {
	try {
		const sessionId = req.nextUrl.searchParams.get("sessionId");

		if (!sessionId) {
			return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
		}

		// Get session data
		const sessionKey = `session:${sessionId}`;
		const sessionData = await redis.get(sessionKey);

		if (!sessionData) {
			return NextResponse.json({ error: "Session not found" }, { status: 404 });
		}

		// Get stream info
		const streamInfo = await generator.getStreamInfo(sessionId);

		return NextResponse.json({
			sessionId,
			session: JSON.parse(sessionData as string),
			stream: streamInfo,
		});
	} catch (error) {
		console.error("Session info error:", error);
		return NextResponse.json({ error: "Failed to get session info" }, { status: 500 });
	}
}
