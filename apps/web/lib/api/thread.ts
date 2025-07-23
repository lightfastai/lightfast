import type { ExperimentalAgentId } from "@lightfast/types";
import { cookies } from "next/headers";

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
		// Get the base URL from environment or use localhost
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		// Get cookies for authentication
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const response = await fetch(`${baseUrl}/api/thread/${threadId}/ownership`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookieHeader,
			},
			body: JSON.stringify({ userId, agentId }),
		});

		if (!response.ok) {
			console.error(`Failed to check thread ownership: ${response.status} ${response.statusText}`);
			return { exists: false, isOwner: false };
		}

		return await response.json();
	} catch (error) {
		console.error("Error checking thread ownership:", error);
		return { exists: false, isOwner: false };
	}
}

export async function getThreadMessages(threadId: string, agentId: ExperimentalAgentId) {
	try {
		// Get the base URL from environment or use localhost
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		// Get cookies for authentication
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const response = await fetch(`${baseUrl}/api/thread/${threadId}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookieHeader,
			},
			body: JSON.stringify({ agentId }),
		});

		if (!response.ok) {
			console.error(`Failed to get thread messages: ${response.status} ${response.statusText}`);
			return { messages: [], uiMessages: [] };
		}

		return await response.json();
	} catch (error) {
		console.error("Error getting thread messages:", error);
		return { messages: [], uiMessages: [] };
	}
}
