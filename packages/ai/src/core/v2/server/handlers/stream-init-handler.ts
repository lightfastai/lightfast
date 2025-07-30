/**
 * Stream Init Handler - Handles stream initialization requests
 */

import type { Client as QStashClient } from "@upstash/qstash";
import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { AgentLoopInitEvent, Message } from "../events/types";
import { getDeltaStreamKey, getSessionKey } from "../keys";
import { DeltaStreamType } from "../stream/types";

export interface StreamInitRequestBody {
	prompt: string;
	sessionId: string;
}

export interface StreamInitDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash?: QStashClient;
	baseUrl: string;
}

/**
 * Handle stream initialization request
 */
export async function handleStreamInit<TRuntimeContext = unknown>(
	request: Request,
	deps: StreamInitDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl } = deps;

	const body = (await request.json()) as StreamInitRequestBody;
	const { prompt, sessionId } = body;

	// Validate required fields
	if (!prompt || !prompt.trim()) {
		return Response.json({ error: "Prompt is required" }, { status: 400 });
	}

	if (!sessionId || !sessionId.trim()) {
		return Response.json({ error: "Session ID is required" }, { status: 400 });
	}

	// Convert prompt to messages format
	const messages = [{ role: "user", content: prompt.trim() }] as Message[];

	// Use Redis pipeline for atomic session initialization
	const pipeline = redis.pipeline();

	// Register session
	const sessionKey = getSessionKey(sessionId);
	pipeline.set(sessionKey, sessionId);

	// Write INIT message to stream
	const streamKey = getDeltaStreamKey(sessionId);
	const initMessage = {
		type: DeltaStreamType.INIT,
		timestamp: new Date().toISOString(),
	};
	pipeline.xadd(streamKey, "*", initMessage);

	// Publish notification
	pipeline.publish(streamKey, JSON.stringify({ type: DeltaStreamType.INIT }));

	// Execute all operations in a single batch
	await pipeline.exec();

	// Create agent loop init event
	const agentLoopEvent: AgentLoopInitEvent = {
		id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
		type: "agent.loop.init",
		sessionId,
		timestamp: new Date().toISOString(),
		version: "1.0",
		data: {
			messages: messages as Message[],
			systemPrompt: agent.getSystemPrompt(),
			temperature: agent.getTemperature() || 0.7,
			tools: agent.getAvailableTools(),
			metadata: {},
		},
	};

	// Publish the event to QStash for processing
	if (qstash) {
		// Don't await this - let it process in the background while we return the response
		qstash
			.publishJSON({
				url: `${baseUrl}/workers/agent-loop-init`,
				body: { event: agentLoopEvent },
			})
			.catch((error) => {
				console.error(`[Stream Init] Failed to publish agent loop init event for session ${sessionId}:`, error);
			});
	} else {
		console.warn(`[Stream Init] QStash not configured, cannot start agent loop for session ${sessionId}`);
	}

	// Return session info immediately
	return Response.json({
		sessionId,
		streamUrl: `${baseUrl}/stream/${sessionId}`,
		status: "initialized",
		message: "Agent loop initialized. Connect to the stream URL to receive updates.",
	});
}
