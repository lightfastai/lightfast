import type { NextRequest } from "next/server";
import { mastra } from "@/mastra";
import {
	logConversationEvaluation,
	evaluateTaskCompletion,
	evaluateResponseQuality,
	extractMessageContent,
	type ConversationEvaluationData
} from "@/mastra/lib/braintrust-utils";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const requestBody = await request.json();
		const { messages, stream = false, threadId: bodyThreadId } = requestBody;
		const { id: paramsThreadId } = await params;

		console.log(`[API] URL param threadId: ${paramsThreadId}`);
		console.log(`[API] Request body threadId: ${bodyThreadId}`);
		console.log(`[API] Request body keys:`, Object.keys(requestBody));

		// Use the threadId from request body if available, otherwise use URL param
		const threadId = bodyThreadId || paramsThreadId;
		console.log(`[API] Final threadId: ${threadId}`);

		// Using the V010 agent which has comprehensive tools for all tasks
		// You can implement logic to select different agents based on thread context
		const agent = mastra.getAgent("V010");

		if (!agent) {
			return Response.json({ error: "Chat agent not available" }, { status: 500 });
		}

		// Log available tools for debugging
		console.log(`[API] Agent tools:`, Object.keys(agent.tools || {}));

		// Include threadId in the agent call for proper memory/context handling
		const options = {
			threadId,
			resourceId: threadId, // Using threadId as resourceId for now
		};

		console.log(`[API] Agent options:`, options);

		// Track conversation start time for performance evaluation
		const startTime = Date.now();

		// Always use streaming with AI SDK v5
		const result = await agent.stream(messages, options);

		// Log conversation-level evaluation to Braintrust (fire and forget)
		const endTime = Date.now();
		logConversationEvaluation({
			messages,
			final_response: result.text || "",
			thread_id: threadId,
			agent_name: "V010",
			duration: endTime - startTime,
			tool_calls_count: result.steps?.reduce((acc, step) => 
				acc + (step.toolCalls?.length || 0), 0) || 0,
			success: true,
		}).catch(error => {
			console.warn("[API] Braintrust conversation logging failed:", error);
		});

		// Use the new v5 method toUIMessageStreamResponse
		return result.toUIMessageStreamResponse();
	} catch (error) {
		console.error("Chat error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: threadId } = await params;

		// This could be used to retrieve thread history or metadata
		// For now, just return thread info
		return Response.json({
			threadId,
			message: "Thread endpoint active",
		});
	} catch (error) {
		console.error("Thread info error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
