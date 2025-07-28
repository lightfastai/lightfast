/**
 * V2 Agent Loop Worker Endpoint
 * Handles agent.loop.init events from Qstash
 */

import { AgentLoopWorker, createEventEmitter, createRedisClient } from "@lightfast/ai/v2/core";
import type { AgentLoopInitEvent } from "@lightfast/ai/v2/core";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: AgentLoopInitEvent = await request.json();
		
		console.log(`[Agent Loop Worker] Processing event ${event.id} for session ${event.sessionId}`);

		// Create Redis client and event emitter
		const redis = createRedisClient();
		const eventEmitter = createEventEmitter({
			qstashUrl: process.env.QSTASH_URL!,
			qstashToken: process.env.QSTASH_TOKEN!,
			topicPrefix: process.env.QSTASH_TOPIC_PREFIX || "agent",
			directUrl: process.env.QSTASH_DIRECT_URL || "true",
			workerBaseUrl: process.env.WORKER_BASE_URL || "http://localhost:3000"
		});

		// Create and run the agent loop worker
		const worker = new AgentLoopWorker(redis, eventEmitter);
		await worker.processEvent(event);

		return NextResponse.json({ success: true });

	} catch (error) {
		console.error("[Agent Loop Worker] Error:", error);
		return NextResponse.json(
			{ 
				error: "Failed to process agent loop event",
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}