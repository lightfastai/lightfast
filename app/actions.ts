"use server";

import { randomUUID } from "node:crypto";
import { executeTaskWorkflow } from "@/lib/mastra/simple-executor";

export async function fetchSubscriptionToken(chatId: string) {
	console.log("fetching subscription token for chatId", chatId);
	// For Mastra, we'll return the SSE endpoint URL instead of a token
	return {
		url: `/api/mastra/subscribe/${chatId}`,
		chatId,
	};
}

export async function runTaskExecutor(taskDescription: string) {
	const chatId = randomUUID();

	// Execute the workflow directly
	// In a production setup, you might want to queue this
	executeTaskWorkflow({
		taskDescription,
		chatId,
	}).catch((error) => {
		console.error("Error executing workflow:", error);
	});

	return chatId;
}
