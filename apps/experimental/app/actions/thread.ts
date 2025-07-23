"use server";

import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId, MastraUIMessage } from "@lightfast/types";
import { convertMastraToUIMessages } from "@/lib/convert-messages";

/**
 * Check if a thread exists and belongs to a specific user
 * @param threadId - The thread ID to check
 * @param userId - The user ID to verify ownership
 * @param agentId - The experimental agent ID
 * @returns Object with exists flag and isOwner flag
 */
export async function checkThreadOwnership(
	threadId: string,
	userId: string,
	agentId: ExperimentalAgentId,
): Promise<{ exists: boolean; isOwner: boolean }> {
	try {
		// Agent ID is now consistent between types and Mastra config
		const agent = mastra.getAgent(agentId);

		if (!agent) {
			return { exists: false, isOwner: false };
		}

		const memory = await agent.getMemory();
		if (!memory) {
			// Allow access for agents without memory (they can still function)
			return { exists: true, isOwner: true };
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
			return { exists: true, isOwner: true };
		}

		// Check ownership
		const firstMessage = result.uiMessages[0] as unknown as MastraUIMessage;
		const isOwner = !firstMessage.metadata?.resourceId || firstMessage.metadata.resourceId === userId;

		return { exists: true, isOwner };
	} catch (error) {
		console.error("Error checking thread ownership:", error);
		return { exists: false, isOwner: false };
	}
}

export async function getThreadMessages(threadId: string, agentId: ExperimentalAgentId) {
	try {
		// Use agentId directly since it's now consistent with Mastra config
		const agentKey = agentId;

		// Try to get the agent's memory instance
		const agent = mastra.getAgent(agentKey);
		if (!agent) {
			return { messages: [], uiMessages: [] };
		}

		const memory = await agent.getMemory();
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
	} catch (_error) {
		return { messages: [], uiMessages: [] };
	}
}
