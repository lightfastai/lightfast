/**
 * V2 Tool Executor Worker Endpoint
 * Handles agent.tool.call events from Qstash
 */

import { createEventEmitter, createRedisClient } from "@lightfast/ai/v2/core";
import type { AgentToolCallEvent } from "@lightfast/ai/v2/core";
import { NextRequest, NextResponse } from "next/server";

// Simple tool implementations
async function executeTool(tool: string, args: Record<string, any>) {
	switch (tool) {
		case "calculator":
			const { expression, a, b, operation } = args;
			if (expression) {
				// Simple expression evaluation (be careful in production!)
				try {
					const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
					return { expression, value: result };
				} catch {
					return { error: "Invalid expression" };
				}
			} else if (typeof a === 'number' && typeof b === 'number' && operation) {
				switch (operation) {
					case 'add': return { result: a + b };
					case 'subtract': return { result: a - b };
					case 'multiply': return { result: a * b };
					case 'divide': return { result: b !== 0 ? a / b : "Division by zero" };
					default: return { error: "Unknown operation" };
				}
			}
			return { error: "Invalid calculator arguments" };

		case "weather":
			// Mock weather data
			return {
				location: args.location || "San Francisco",
				temperature: 72,
				conditions: "Partly cloudy",
				humidity: 65,
			};

		default:
			throw new Error(`Unknown tool: ${tool}`);
	}
}

export async function POST(request: NextRequest) {
	try {
		// Parse the event from Qstash
		const event: AgentToolCallEvent = await request.json();
		
		console.log(`[Tool Executor] Processing tool call ${event.data.toolCallId} for session ${event.sessionId}`);

		// Create Redis client and event emitter
		const redis = createRedisClient();
		const eventEmitter = createEventEmitter({
			qstashUrl: process.env.QSTASH_URL!,
			qstashToken: process.env.QSTASH_TOKEN!,
			topicPrefix: process.env.QSTASH_TOPIC_PREFIX || "agent",
			directUrl: process.env.QSTASH_DIRECT_URL || "true",
			workerBaseUrl: process.env.WORKER_BASE_URL || "http://localhost:3000"
		});

		const streamKey = `stream:${event.sessionId}`;
		let success = false;
		let result: any;

		try {
			// Execute the tool
			result = await executeTool(event.data.tool, event.data.arguments || {});
			success = true;

			// Write result to stream
			await redis.xadd(streamKey, "*", {
				type: "tool",
				content: `Tool ${event.data.tool} executed successfully`,
				metadata: JSON.stringify({
					event: "tool.result",
					tool: event.data.tool,
					toolCallId: event.data.toolCallId,
					result,
					success,
				}),
			});

		} catch (error) {
			result = { error: error instanceof Error ? error.message : String(error) };
			success = false;

			// Write error to stream
			await redis.xadd(streamKey, "*", {
				type: "error",
				content: `Tool ${event.data.tool} failed: ${result.error}`,
				metadata: JSON.stringify({
					event: "tool.error",
					tool: event.data.tool,
					toolCallId: event.data.toolCallId,
					error: result.error,
				}),
			});
		}

		// Emit completion or failure event
		if (success) {
			await eventEmitter.emitToolExecutionComplete(event.sessionId, {
				toolCallId: event.data.toolCallId,
				tool: event.data.tool,
				result,
				duration: 500,
				attempts: 1,
			});

			// Add tool result to session messages
			const sessionKey = `session:${event.sessionId}`;
			const sessionData = await redis.get(sessionKey);
			if (sessionData) {
				const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
				session.messages.push({
					role: "tool",
					content: JSON.stringify(result),
					toolCallId: event.data.toolCallId,
					toolName: event.data.tool,
				});
				session.updatedAt = new Date().toISOString();
				await redis.setex(sessionKey, 86400, JSON.stringify(session));
			}
		} else {
			await eventEmitter.emitToolExecutionFailed(event.sessionId, {
				toolCallId: event.data.toolCallId,
				tool: event.data.tool,
				error: result.error,
				lastAttemptDuration: 500,
				attempts: 1,
			});
		}

		return NextResponse.json({ success: true });

	} catch (error) {
		console.error("[Tool Executor] Error:", error);
		return NextResponse.json(
			{ 
				error: "Failed to process tool execution",
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}