"use server";

import { randomUUID } from "node:crypto";
import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "@/lib/inngest/client";
import { taskExecutionChannel } from "@/lib/inngest/realtime";

export async function fetchSubscriptionToken(chatId: string) {
	console.log("fetching subscription token for chatId", chatId);
	const token = await getSubscriptionToken(inngest, {
		channel: taskExecutionChannel(chatId),
		topics: ["messages", "status"],
	});

	return token;
}

export async function runTaskExecutor(taskDescription: string) {
	const chatId = randomUUID();

	await inngest.send({
		name: "task/execute",
		data: { taskDescription, chatId },
	});

	return chatId;
}
