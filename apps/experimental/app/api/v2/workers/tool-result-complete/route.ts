/**
 * V2 Tool Result Handler Endpoint  
 * Handles tool.execution.complete events from Qstash
 */

import { createEventEmitter, createRedisClient, ToolResultHandler } from "@lightfast/ai/v2/core";
import type { ToolExecutionCompleteEvent } from "@lightfast/ai/v2/core";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: ToolExecutionCompleteEvent = await request.json();
		
		console.log(`[Tool Result Handler] Processing complete event for ${event.data.tool}`);

		// Create Redis client and event emitter
		const redis = createRedisClient();
		const eventEmitter = createEventEmitter({
			qstashUrl: process.env.QSTASH_URL!,
			qstashToken: process.env.QSTASH_TOKEN!,
			topicPrefix: process.env.QSTASH_TOPIC_PREFIX || "agent",
			directUrl: process.env.QSTASH_DIRECT_URL || "true",
			workerBaseUrl: process.env.WORKER_BASE_URL || "http://localhost:3000"
		});

		// Create and run the tool result handler
		const handler = new ToolResultHandler(redis, eventEmitter);
		await handler.handleToolComplete(event);

		return NextResponse.json({ success: true });

	} catch (error) {
		console.error("[Tool Result Handler] Error:", error);
		return NextResponse.json(
			{ 
				error: "Failed to process tool result",
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}