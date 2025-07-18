import { NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function GET(
	request: Request,
	context: { params: Promise<{ agentName: string; threadId: string }> }
) {
	try {
		const { agentName, threadId } = await context.params;

		// For now, we only support v1Agent
		if (agentName !== "v1Agent") {
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}

		// Get the agent from Mastra
		const agent = mastra.getAgent("V1Agent");
		if (!agent) {
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}

		// Get the agent's memory
		const memory = agent.getMemory();
		if (!memory) {
			return NextResponse.json({ error: "Agent memory not configured" }, { status: 404 });
		}

		// Fetch the thread
		const thread = await memory.getThreadById({ threadId });
		if (!thread) {
			return NextResponse.json({ error: "Thread not found" }, { status: 404 });
		}

		// Get working memory for this thread through the memory query
		// Since workingMemory is not directly on thread, we need to fetch it differently
		// For now, return empty tasks as we'll need to query the memory store directly
		const workingMemory = { tasks: [], lastUpdated: new Date().toISOString() };

		return NextResponse.json({
			threadId,
			workingMemory,
			updatedAt: thread.updatedAt,
		});
	} catch (error) {
		console.error("Error fetching agent memory:", error);
		return NextResponse.json(
			{ error: "Failed to fetch agent memory" },
			{ status: 500 }
		);
	}
}