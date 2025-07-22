"use server";

import { convertMastraToUIMessages } from "@/lib/convert-messages";
import { mastra } from "@/mastra";
import type { ExperimentalAgentId } from "@/mastra/agents/experimental/types";
import type { MastraUIMessage } from "@/types/lightfast-ui-messages";

export async function getThreadMessages(threadId: string, agentId?: ExperimentalAgentId) {
	try {
		// Map experimental agent ID to Mastra agent key
		const agentMap: Record<ExperimentalAgentId, "A010" | "A011"> = {
			a010: "A010",
			a011: "A011",
		};

		const mastraAgentKey = agentId ? agentMap[agentId] : "A011";

		// Try to get the agent's memory instance
		const agent = mastra.getAgent(mastraAgentKey);
		if (!agent) {
			return { messages: [], uiMessages: [] };
		}

		const memory = agent.getMemory();
		if (!memory) {
			return { messages: [], uiMessages: [] };
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

		return {
			messages: result.messages,
			uiMessages: convertedMessages,
		};
	} catch (error) {
		return { messages: [], uiMessages: [] };
	}
}
