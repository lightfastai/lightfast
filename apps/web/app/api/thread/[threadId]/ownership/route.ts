import { auth } from "@clerk/nextjs/server";
import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId, MastraUIMessage } from "@lightfast/types";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
	try {
		// First check auth at the API route level
		const { userId: authUserId } = await auth();
		if (!authUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { userId, agentId } = (await request.json()) as { userId: string; agentId: ExperimentalAgentId };

		if (!userId || !agentId) {
			return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
		}

		const { threadId } = params;

		// Agent ID is now consistent between types and Mastra config
		const agent = mastra.getAgent(agentId);

		if (!agent) {
			return NextResponse.json({ exists: false, isOwner: false });
		}

		const memory = await agent.getMemory();
		if (!memory) {
			// Allow access for agents without memory (they can still function)
			return NextResponse.json({ exists: true, isOwner: true });
		}

		// Query memory for this thread to check if it exists
		const result = await memory.query({
			threadId,
			selectBy: {
				last: 1, // Just check if thread exists
			},
		});

		if (result.uiMessages.length === 0) {
			// Thread has no messages yet - new thread
			return NextResponse.json({ exists: true, isOwner: true });
		}

		// Check ownership
		const firstMessage = result.uiMessages[0] as unknown as MastraUIMessage;
		const isOwner = !firstMessage.metadata?.resourceId || firstMessage.metadata.resourceId === userId;

		return NextResponse.json({ exists: true, isOwner });
	} catch (error) {
		console.error("Error checking thread ownership:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
