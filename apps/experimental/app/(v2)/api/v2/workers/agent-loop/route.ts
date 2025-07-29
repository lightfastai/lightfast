/**
 * V2 Agent Loop Worker Endpoint
 * Handles agent.loop.init events from Qstash
 */

import type { AgentLoopInitEvent } from "@lightfast/ai/v2/core";
import { AgentLoopWorker } from "@lightfast/ai/v2/core";
import { type NextRequest, NextResponse } from "next/server";
import { eventEmitter, redis } from "@/app/(v2)/ai/config";

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: AgentLoopInitEvent = await request.json();

		console.log(`[Agent Loop Worker] Processing event ${event.id} for session ${event.sessionId}`);

		// Create and run the agent loop worker
		const worker = new AgentLoopWorker(redis, eventEmitter);
		await worker.processEvent(event);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Agent Loop Worker] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to process agent loop event",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
