"use server";

import { convertMastraToUIMessages } from "@/lib/convert-messages";
import { mastra } from "@/mastra";
import type { ExperimentalAgentId } from "@/mastra/agents/experimental/types";
import type { MastraUIMessage } from "@/types/lightfast-ui-messages";

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
		// Map experimental agent ID to Mastra agent key
		const agentMap: Record<ExperimentalAgentId, "A010" | "A011"> = {
			a010: "A010",
			a011: "A011",
		};

		const mastraAgentKey = agentMap[agentId];
		const agent = mastra.getAgent(mastraAgentKey);

		if (!agent) {
			console.log(`[OWNERSHIP] Agent not found: ${mastraAgentKey} for thread ${threadId}`);
			return { exists: false, isOwner: false };
		}

		const memory = agent.getMemory();
		if (!memory) {
			console.log(`[OWNERSHIP] No memory found for agent ${mastraAgentKey}, thread ${threadId}`);
			return { exists: false, isOwner: false };
		}

		// Query memory for this thread to check if it exists
		const result = await memory.query({
			threadId,
			selectBy: {
				last: 1, // Just check if thread exists
			},
		});

		console.log(`[OWNERSHIP] Thread ${threadId} query result:`, {
			messageCount: result.uiMessages.length,
			messages: result.uiMessages.map((m: any) => ({ role: m.role, id: m.id }))
		});

		if (result.uiMessages.length === 0) {
			// Thread has no messages yet - new thread
			console.log(`[OWNERSHIP] Thread ${threadId} has no messages - treating as new thread`);
			return { exists: true, isOwner: true };
		}

		// Check ownership
		const firstMessage = result.uiMessages[0] as unknown as MastraUIMessage;
		const isOwner = !firstMessage.metadata?.resourceId || firstMessage.metadata.resourceId === userId;

		console.log(`[OWNERSHIP] Thread ${threadId} exists, isOwner: ${isOwner}`);
		return { exists: true, isOwner };
	} catch (error) {
		console.error("Error checking thread ownership:", error);
		return { exists: false, isOwner: false };
	}
}

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

		console.log(`[GET_MESSAGES] Thread ${threadId} query result:`, {
			messageCount: result.uiMessages.length,
			messages: result.uiMessages.map((m: any) => ({ 
				role: m.role, 
				id: m.id,
				content: typeof m.content === 'string' ? m.content.substring(0, 50) + '...' : 'non-string',
				parts: m.parts ? `${m.parts.length} parts` : 'no parts'
			}))
		});

		// Convert Mastra messages to proper UI format
		// Cast as MastraUIMessage[] since the actual type from Mastra has compatible structure
		const convertedMessages = convertMastraToUIMessages(result.uiMessages as unknown as MastraUIMessage[]);

		console.log(`[GET_MESSAGES] Thread ${threadId} converted messages:`, {
			count: convertedMessages.length,
			messages: convertedMessages.map(m => ({ 
				role: m.role, 
				id: m.id,
				partsCount: m.parts?.length || 0
			}))
		});

		return {
			messages: result.messages,
			uiMessages: convertedMessages,
		};
	} catch (error) {
		return { messages: [], uiMessages: [] };
	}
}
