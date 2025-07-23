"use server";

import { mastraServer as mastra } from "@lightfast/ai/server";
import type { ExperimentalAgentId, MastraUIMessage } from "@lightfast/types";
import { cache } from "react";
import { convertMastraToUIMessages } from "@/lib/convert-messages";

// Cache agent instances at request level to avoid repeated instantiation
const getCachedAgent = cache((agentId: ExperimentalAgentId) => {
	return mastra.getAgent(agentId);
});

// Cache agent memory instances at request level
const getCachedAgentMemory = cache(async (agentId: ExperimentalAgentId) => {
	const agent = getCachedAgent(agentId);
	if (!agent) return null;
	return await agent.getMemory();
});

/**
 * Optimized server action that checks thread ownership and fetches messages in parallel
 * This eliminates the data fetching waterfall by combining both operations
 */
export async function getThreadDataWithOwnership(
	threadId: string,
	userId: string,
	agentId: ExperimentalAgentId,
): Promise<{
	exists: boolean;
	isOwner: boolean;
	messages: unknown[];
	uiMessages: unknown[];
}> {
	try {
		const memory = await getCachedAgentMemory(agentId);

		if (!memory) {
			// Allow access for agents without memory (they can still function)
			return { exists: true, isOwner: true, messages: [], uiMessages: [] };
		}

		// Parallel fetch: both ownership check and full messages in single memory query
		const [ownershipResult, messagesResult] = await Promise.all([
			// Query for ownership check (first message only)
			memory.query({
				threadId,
				selectBy: { last: 1 },
			}),
			// Query for full message history
			memory.query({
				threadId,
				selectBy: { last: 50 },
			}),
		]);

		// Check ownership from first query
		let isOwner = true;
		if (ownershipResult.uiMessages.length > 0) {
			const firstMessage = ownershipResult.uiMessages[0] as unknown as MastraUIMessage;
			isOwner = !firstMessage.metadata?.resourceId || firstMessage.metadata.resourceId === userId;
		}

		// Process messages from second query
		const convertedMessages = convertMastraToUIMessages(messagesResult.uiMessages as unknown as MastraUIMessage[]);

		return {
			exists: true,
			isOwner,
			messages: messagesResult.messages,
			uiMessages: convertedMessages,
		};
	} catch (error) {
		console.error("Error getting thread data:", error);
		return { exists: false, isOwner: false, messages: [], uiMessages: [] };
	}
}

/**
 * Legacy function - Check if a thread exists and belongs to a specific user
 * @deprecated Use getThreadDataWithOwnership for better performance
 */
export async function checkThreadOwnership(
	threadId: string,
	userId: string,
	agentId: ExperimentalAgentId,
): Promise<{ exists: boolean; isOwner: boolean }> {
	const result = await getThreadDataWithOwnership(threadId, userId, agentId);
	return { exists: result.exists, isOwner: result.isOwner };
}

/**
 * Legacy function - Get thread messages
 * @deprecated Use getThreadDataWithOwnership for better performance
 */
export async function getThreadMessages(threadId: string, agentId: ExperimentalAgentId) {
	try {
		const memory = await getCachedAgentMemory(agentId);
		if (!memory) {
			return { messages: [], uiMessages: [] };
		}

		const result = await memory.query({
			threadId,
			selectBy: { last: 50 },
		});

		const convertedMessages = convertMastraToUIMessages(result.uiMessages as unknown as MastraUIMessage[]);

		return {
			messages: result.messages,
			uiMessages: convertedMessages,
		};
	} catch (_error) {
		return { messages: [], uiMessages: [] };
	}
}
