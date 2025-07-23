import { auth } from "@clerk/nextjs/server";
import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId, MastraUIMessage } from "@lightfast/types";
import { type NextRequest, NextResponse } from "next/server";
import { convertMastraToUIMessages } from "@/lib/convert-messages";

export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
	try {
		// Check auth at the API route level
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { agentId } = (await request.json()) as { agentId: ExperimentalAgentId };

		if (!agentId) {
			return NextResponse.json({ error: "Missing agentId parameter" }, { status: 400 });
		}

		const { threadId } = params;

		// Use agentId directly since it's now consistent with Mastra config
		const agentKey = agentId;

		// Try to get the agent's memory instance
		const agent = mastra.getAgent(agentKey);
		if (!agent) {
			return NextResponse.json({ messages: [], uiMessages: [] });
		}

		const memory = await agent.getMemory();
		if (!memory) {
			return NextResponse.json({ messages: [], uiMessages: [] });
		}

		const result = await memory.query({
			threadId,
			selectBy: {
				last: 50,
			},
		});

		// Convert Mastra messages to proper UI format
		// Cast as MastraUIMessage[] since the actual type from Mastra has compatible structure
		const convertedMessages = convertMastraToUIMessages(result.uiMessages as unknown as MastraUIMessage[]);

		return NextResponse.json({
			messages: result.messages,
			uiMessages: convertedMessages,
		});
	} catch (error) {
		console.error("Error getting thread messages:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
