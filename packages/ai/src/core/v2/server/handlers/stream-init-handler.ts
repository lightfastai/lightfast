/**
 * Stream Init Handler - Handles stream initialization requests
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type { AgentLoopInitEvent, Message } from "../../events/schemas";
import { StreamWriter } from "../stream/stream-writer";
import { StreamGenerator } from "../stream-generator";
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
 * Create agent loop init event
 */
function createAgentLoopEvent<TRuntimeContext>(
	sessionId: string,
	messages: Message[],
	agent: Agent<TRuntimeContext>,
): AgentLoopInitEvent {
	return {
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
}

/**
 * Start agent loop in background
 */
function startAgentLoop<TRuntimeContext>(
	agent: Agent<TRuntimeContext>,
	agentLoopEvent: AgentLoopInitEvent,
	sessionId: string,
): void {
	// Run the first agent loop immediately in the background
	// Don't await this - let it stream while we return the response
	agent.processEvent(agentLoopEvent).catch((error) => {
		console.error(`[Stream Init] First agent loop failed for session ${sessionId}:`, error);
	});
}

/**
 * Handle stream initialization request
 */
export async function handleStreamInit<TRuntimeContext = unknown>(
	request: Request,
	deps: StreamInitDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, eventEmitter, baseUrl } = deps;
	const streamGenerator = new StreamGenerator(redis);
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
	const sessionId = providedSessionId || streamGenerator.createSessionId();

	// Check if session already exists using SessionWriter
	const exists = await sessionWriter.sessionExists(sessionId);
	if (exists) {
		return Response.json({ error: "Session already exists", sessionId }, { status: 409 });
	}

	// Register the session
	await sessionWriter.registerSession(sessionId);

	// Start agent loop in background
	const agentLoopEvent = createAgentLoopEvent(sessionId, messages, agent);
	startAgentLoop(agent, agentLoopEvent, sessionId);

	// Return session info immediately
	return Response.json({
		sessionId,
		streamUrl: `${baseUrl}/stream/${sessionId}`,
		status: "initialized",
		message: "Agent loop initialized. Connect to the stream URL to receive updates.",
	});
}
