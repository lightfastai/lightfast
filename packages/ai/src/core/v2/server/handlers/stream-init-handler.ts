/**
 * Stream Init Handler - Handles stream initialization requests
 */

import type { Client as QStashClient } from "@upstash/qstash";
import type { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Agent } from "../../agent";
import { uuidv4 } from "../../utils/uuid";
import { getDeltaStreamKey, getMessageKey, getSessionKey } from "../keys";
import type { SessionState } from "../runtime/types";
import { DeltaStreamType } from "../stream/types";

interface LightfastDBMessage {
	sessionId: string;
	resourceId: string;
	messages: UIMessage[];
	createdAt: string;
	updatedAt: string;
}

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
	const { agent: _agent, redis, qstash, baseUrl, resourceId } = deps;

	const body = (await request.json()) as StreamInitRequestBody;
	const { prompt, sessionId } = body;

	// Validate required fields
	if (!prompt || !prompt.trim()) {
		return Response.json({ error: "Prompt is required" }, { status: 400 });
	}

	if (!sessionId || !sessionId.trim()) {
		return Response.json({ error: "Session ID is required" }, { status: 400 });
	}

	// Generate IDs and timestamp once
	const now = new Date().toISOString();
	const userMessageId = uuidv4();
	const assistantMessageId = uuidv4();

	// Prepare keys for Redis operations
	const sessionKey = getSessionKey(sessionId);
	const messageKey = getMessageKey(sessionId);
	const streamKey = getDeltaStreamKey(assistantMessageId);

	// Read operations in parallel (Promise.all for better typing)
	const [existingState, existingMessages] = await Promise.all([
		redis.get(sessionKey) as Promise<SessionState | null>,
		redis.json.get(messageKey, "$") as Promise<LightfastDBMessage[] | null>,
	]);

	// Determine the step index
	const stepIndex = existingState ? existingState.stepIndex + 1 : 0;

	console.log(
		existingState
			? `[Stream Init] Continuing conversation for session ${sessionId} at step ${stepIndex}`
			: `[Stream Init] Starting new conversation for session ${sessionId}`,
	);

	// Create user message
	const userMessage: UIMessage = {
		id: userMessageId,
		role: "user",
		parts: [{ type: "text", text: prompt.trim() }],
	};

	// Second pipeline: All write operations atomically
	const writePipeline = redis.pipeline();

	// Write user message to storage
	if (!existingMessages || existingMessages.length === 0) {
		// Create new message storage
		const storage: LightfastDBMessage = {
			sessionId,
			resourceId,
			messages: [userMessage],
			createdAt: now,
			updatedAt: now,
		};
		writePipeline.json.set(messageKey, "$", storage as unknown as Record<string, unknown>);
	} else {
		// Append to existing messages
		writePipeline.json.arrappend(messageKey, "$.messages", userMessage as unknown as Record<string, unknown>);
		writePipeline.json.set(messageKey, "$.updatedAt", now);
	}

	// Initialize stream
	writePipeline.xadd(streamKey, "*", {
		type: DeltaStreamType.INIT,
		timestamp: now,
	});

	// Publish notification
	writePipeline.publish(streamKey, JSON.stringify({ type: DeltaStreamType.INIT }));

	// Set TTL on the stream (24 hours)
	writePipeline.expire(streamKey, 86400);

	// Execute all write operations atomically
	await writePipeline.exec();

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
