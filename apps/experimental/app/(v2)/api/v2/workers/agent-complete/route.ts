/**
 * V2 Agent Loop Complete Handler Endpoint
 * Handles agent.loop.complete events from Qstash
 * This is the final step where the agent has finished processing
 */

import type { AgentLoopCompleteEvent } from "@lightfast/ai/v2/core";
import { StreamWriter } from "@lightfast/ai/v2/core";
import { type NextRequest, NextResponse } from "next/server";
import { redis } from "@/app/(v2)/ai/config";

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: AgentLoopCompleteEvent = await request.json();

		console.log(`[Agent Complete Handler] Processing complete event for session ${event.sessionId}`);

		// Create stream writer for final updates
		const streamWriter = new StreamWriter(redis);

		// Update session status to completed
		const sessionKey = `session:${event.sessionId}`;
		const sessionData = await redis.get(sessionKey);

		if (sessionData) {
			const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
			session.status = "completed";
			session.completedAt = new Date().toISOString();
			session.finalResponse = event.data.finalMessage;
			session.totalIterations = event.data.iterations || 1;

			// Extend TTL since session is complete
			await redis.setex(sessionKey, 86400, JSON.stringify(session)); // 24 hours
		}

		// Write completion event to stream
		await streamWriter.writeMessage(event.sessionId, {
			type: "completion",
			content: `Agent completed processing: ${event.data.finalMessage}`,
			metadata: JSON.stringify({
				event: "agent.complete",
				sessionId: event.sessionId,
				response: event.data.finalMessage,
				iterations: event.data.iterations,
				toolsUsed: event.data.toolsUsed,
				duration: event.data.duration,
			}),
		});

		// Write final response to stream
		if (event.data.finalMessage) {
			await streamWriter.writeChunk(event.sessionId, event.data.finalMessage);
		}

		// Write metadata with completed status to signal stream end
		await streamWriter.writeMessage(event.sessionId, {
			type: "metadata",
			content: "Stream completed",
			status: "completed",
			sessionId: event.sessionId,
			timestamp: new Date().toISOString(),
		});

		console.log(`[Agent Complete Handler] Session ${event.sessionId} completed successfully`);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Agent Complete Handler] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to process agent completion",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
