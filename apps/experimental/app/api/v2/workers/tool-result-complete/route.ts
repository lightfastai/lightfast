/**
 * V2 Tool Result Handler Endpoint  
 * Handles tool.execution.complete events from Qstash
 */

import { ToolResultHandler } from "@lightfast/ai/v2/core";
import type { ToolExecutionCompleteEvent } from "@lightfast/ai/v2/core";
import { NextRequest, NextResponse } from "next/server";
import { redis, eventEmitter } from "@/app/ai/v2/config";

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: ToolExecutionCompleteEvent = await request.json();
		
		console.log(`[Tool Result Handler] Processing complete event for ${event.data.tool}`);

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