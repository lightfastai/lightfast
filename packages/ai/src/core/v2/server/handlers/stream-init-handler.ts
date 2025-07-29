/**
 * Stream Init Handler - Handles stream initialization requests
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type { AgentLoopInitEvent, Message } from "../../events/schemas";
import { StreamWriter } from "../stream/stream-writer";
import { generateSessionId } from "../utils";
import { SessionWriter } from "../writers/session-writer";

export interface StreamInitRequestBody {
	prompt: string;
	sessionId?: string;
}

export interface StreamInitDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	eventEmitter: EventEmitter;
	baseUrl: string;
}

/**
 * Handle stream initialization request
 */
export async function handleStreamInit<TRuntimeContext = unknown>(
	request: Request,
	deps: StreamInitDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, eventEmitter, baseUrl } = deps;
	const streamWriter = new StreamWriter(redis);
	const sessionWriter = new SessionWriter(redis);

	const body = (await request.json()) as StreamInitRequestBody;
	const { prompt, sessionId: providedSessionId } = body;

	// Validate prompt
	if (!prompt || !prompt.trim()) {
		return Response.json({ error: "Prompt is required" }, { status: 400 });
	}

	// Convert prompt to messages format
	const messages = [{ role: "user", content: prompt.trim() }] as Message[];

	// Use provided session ID or generate new one
	const sessionId = providedSessionId || generateSessionId();

	// Register the session (creates if new, continues if existing)
	await sessionWriter.registerSession(sessionId);

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
