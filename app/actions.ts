"use server";

import { randomUUID } from "node:crypto";
import { taskExecutionChannel } from "@/lib/mastra/realtime";

export async function fetchSubscriptionToken(chatId: string) {
	console.log("fetching subscription token for chatId", chatId);
	// For Mastra, we'll return the SSE endpoint URL instead of a token
	return {
		url: `/api/mastra/subscribe/${chatId}`,
		chatId,
	};
}

export async function runTaskExecutor(_taskDescription: string) {
	const chatId = randomUUID();
	const _channel = taskExecutionChannel(chatId);

	// Execute the network
	// In a production setup, you might want to queue this
	// taskExecutorNetwork
	// 	.execute({
	// 		task: taskDescription,
	// 		chatId,
	// 		context: {
	// 			environment: "sandbox",
	// 			allowFileOperations: true,
	// 			maxIterations: 10,
	// 		},
	// 	})
	// 	.then((result) => {
	// 		channel.messages({
	// 			role: "assistant",
	// 			message: result.finalOutput.summary,
	// 			id: `msg-${Date.now()}`,
	// 		});
	// 		channel.status({
	// 			status: "completed",
	// 			message: "Task execution completed",
	// 		});
	// 	})
	// 	.catch((error: Error) => {
	// 		console.error("Error executing task:", error);
	// 		channel.status({
	// 			status: "error",
	// 			message: error.message,
	// 		});
	// 	});

	return chatId;
}
