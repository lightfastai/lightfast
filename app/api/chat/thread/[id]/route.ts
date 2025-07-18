import type { NextRequest } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { messages, stream = false } = await request.json();
		const { id: threadId } = await params;

		// Using the ChatAgent for simple conversations without tools
		// You can implement logic to select different agents based on thread context
		const agent = mastra.getAgent("ChatAgent");

		if (!agent) {
			return Response.json({ error: "Chat agent not available" }, { status: 500 });
		}

		// Include threadId in the agent call for proper memory/context handling
		const options = {
			threadId,
			resourceId: threadId, // Using threadId as resourceId for now
		};

		// Always use streaming with AI SDK v5
		const result = await agent.stream(messages, options);
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
