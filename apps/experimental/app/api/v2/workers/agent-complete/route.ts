/**
 * V2 Agent Loop Complete Handler Endpoint  
 * Handles agent.loop.complete events from Qstash
 * This is the final step where the agent has finished processing
 */

import { createRedisClient, StreamWriter } from "@lightfast/ai/v2/core";
import type { AgentLoopCompleteEvent } from "@lightfast/ai/v2/core";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: AgentLoopCompleteEvent = await request.json();
		
		console.log(`[Agent Complete Handler] Processing complete event for session ${event.sessionId}`);

		// Create Redis client for final updates
		const redis = createRedisClient();
		const streamWriter = new StreamWriter(redis);

		// Update session status to completed
		const sessionKey = `session:${event.sessionId}`;
		const sessionData = await redis.get(sessionKey);
		
		if (sessionData) {
			const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
			session.status = "completed";
			session.completedAt = new Date().toISOString();
			session.finalResponse = event.data.response;
			session.totalIterations = event.data.iteration || 1;
			
			// Extend TTL since session is complete
			await redis.setex(sessionKey, 86400, JSON.stringify(session)); // 24 hours
		}

		// Write completion event to stream
		await streamWriter.writeMessage(event.sessionId, {
			type: "completion",
			content: `Agent completed processing: ${event.data.response}`,
			metadata: JSON.stringify({
				event: "agent.complete",
				sessionId: event.sessionId,
				response: event.data.response,
				iteration: event.data.iteration,
				reasoning: event.data.reasoning,
			}),
		});

		// Write final response to stream
		if (event.data.response) {
			await streamWriter.writeChunk(event.sessionId, event.data.response);
		}

		console.log(`[Agent Complete Handler] Session ${event.sessionId} completed successfully`);
		return NextResponse.json({ success: true });

	} catch (error) {
		console.error("[Agent Complete Handler] Error:", error);
		return NextResponse.json(
			{ 
				error: "Failed to process agent completion",
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}