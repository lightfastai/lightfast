/**
 * Stream Init Handler - Handles stream initialization requests
 */

import type { Client as QStashClient } from "@upstash/qstash";
import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import { uuidv4 } from "../../utils/uuid";
import { getDeltaStreamKey, getSessionKey } from "../keys";
import type { SessionState } from "../runtime/types";
import { DeltaStreamType } from "../stream/types";
import { MessageWriter } from "../writers/message-writer";

export interface StreamInitRequestBody {
	prompt: string;
	sessionId: string;
}

export interface StreamInitDependencies<TRuntimeContext = unknown> {
	agent: Agent<TRuntimeContext>;
	redis: Redis;
	qstash?: QStashClient;
	baseUrl: string;
	resourceId: string;
}

/**
 * Handle stream initialization request
 */
export async function handleStreamInit<TRuntimeContext = unknown>(
	request: Request,
	deps: StreamInitDependencies<TRuntimeContext>,
): Promise<Response> {
	const { agent, redis, qstash, baseUrl, resourceId } = deps;

	const body = (await request.json()) as StreamInitRequestBody;
	const { prompt, sessionId } = body;

	// Validate required fields
	if (!prompt || !prompt.trim()) {
		return Response.json({ error: "Prompt is required" }, { status: 400 });
	}

	if (!sessionId || !sessionId.trim()) {
		return Response.json({ error: "Session ID is required" }, { status: 400 });
	}

	// Check if this is a continuing conversation
	const sessionKey = getSessionKey(sessionId);
	const existingState = (await redis.get(sessionKey)) as SessionState | null;

	// Write user message
	const messageWriter = new MessageWriter(redis);
	await messageWriter.writeUIMessage(sessionId, resourceId, {
		id: uuidv4(),
		role: "user",
		parts: [{ type: "text", text: prompt.trim() }],
	});

	// Generate unique message ID for the assistant response
	const assistantMessageId = uuidv4();

	// Determine the step index
	let stepIndex = 0;
	if (existingState) {
		// This is a continuing conversation
		// The step index should be incremented from the last completed step
		stepIndex = existingState.stepIndex + 1;
		console.log(`[Stream Init] Continuing conversation for session ${sessionId} at step ${stepIndex}`);
	} else {
		// This is a new conversation
		console.log(`[Stream Init] Starting new conversation for session ${sessionId}`);
	}

	// Use Redis pipeline for atomic initialization
	const pipeline = redis.pipeline();

	// Write INIT message to message-specific stream (not session stream)
	const streamKey = getDeltaStreamKey(assistantMessageId);
	const initMessage = {
		type: DeltaStreamType.INIT,
		timestamp: new Date().toISOString(),
	};
	pipeline.xadd(streamKey, "*", initMessage);

	// Publish notification
	pipeline.publish(streamKey, JSON.stringify({ type: DeltaStreamType.INIT }));

	// Set TTL on the stream (24 hours)
	pipeline.expire(streamKey, 86400);

	// Execute all operations in a single batch
	await pipeline.exec();

	// Always publish agent-loop-step event (handles both new and continuing)
	if (qstash) {
		// Don't await this - let it process in the background while we return the response
		qstash
			.publishJSON({
				url: `${baseUrl}/workers/agent-loop-step`,
				body: {
					sessionId,
					stepIndex,
					resourceId,
					assistantMessageId, // Pass the message ID to the worker
				},
			})
			.catch((error) => {
				console.error(`[Stream Init] Failed to publish agent loop step message for session ${sessionId}:`, error);
			});
	} else {
		console.warn(`[Stream Init] QStash not configured, cannot start agent loop for session ${sessionId}`);
	}

	// Return session info immediately with message ID
	return Response.json({
		sessionId,
		messageId: assistantMessageId, // Return the assistant message ID
		streamUrl: `${baseUrl}/stream/${assistantMessageId}`, // Use message ID for stream URL
		status: existingState ? "continued" : "initialized",
		stepIndex,
		message: existingState
			? `Continuing conversation at step ${stepIndex}. Connect to the stream URL to receive updates.`
			: "New conversation started. Connect to the stream URL to receive updates.",
	});
}
