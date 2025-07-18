import { NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const { id: threadId } = await context.params;

		// Get the V1Agent from Mastra (our default agent for now)
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
		
		// If thread doesn't exist yet, return empty working memory
		// This is normal for new conversations that haven't been started yet
		if (!thread) {
			return NextResponse.json({
				threadId,
				workingMemory: { tasks: [], lastUpdated: new Date().toISOString() },
				updatedAt: new Date(),
			});
		}

		// For schema-based working memory, we need to look for the updateWorkingMemory tool calls
		// The agent uses this tool to update the working memory
		const { messages } = await memory.query({
			threadId,
			selectBy: {
				last: 100, // Get more messages to find working memory updates
			},
		});

		// Find the most recent working memory update
		let workingMemory = { tasks: [], lastUpdated: new Date().toISOString() };
		
		// Look for updateWorkingMemory tool calls in reverse order (most recent first)
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			if (message.role === 'assistant' && message.toolInvocations) {
				for (const invocation of message.toolInvocations) {
					if (invocation.toolName === 'updateWorkingMemory' && invocation.state === 'result') {
						// The args should contain the working memory update
						// The memory is passed as a JSON string in the 'memory' field
						if (invocation.args && typeof invocation.args === 'object' && 'memory' in invocation.args) {
							try {
								const memoryString = (invocation.args as any).memory;
								workingMemory = JSON.parse(memoryString);
								// Ensure lastUpdated is set
								if (!workingMemory.lastUpdated) {
									workingMemory.lastUpdated = new Date().toISOString();
								}
								console.log("Found working memory:", workingMemory);
								// Exit both loops once we found the working memory
								i = -1;
								break;
							} catch (e) {
								console.error("Failed to parse working memory:", e);
							}
						}
					}
				}
			}
		}

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