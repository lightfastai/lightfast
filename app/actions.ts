"use server";

import type { Realtime } from "@inngest/realtime";
import { randomUUID } from "crypto";
import { inngest } from "@/lib/inngest/client";
import type { taskExecutionChannel } from "@/lib/inngest/realtime";

export async function runTaskExecutor(taskDescription: string) {
	const chatId = randomUUID();

	await inngest.send({
		name: "task/execute",
		data: { taskDescription, chatId },
	});

	return chatId;
}

export async function fetchSubscriptionToken(chatId: string) {
	// For development, we'll use the Inngest dashboard's token generation
	// In production, implement proper authentication and token generation
	const response = await fetch(
		`${process.env.NEXT_PUBLIC_INNGEST_BASE_URL || "http://localhost:8288"}/realtime/token`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channelPatterns: [`task:${chatId}`],
				expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			}),
		},
	);

	if (!response.ok) {
		throw new Error("Failed to fetch subscription token");
	}

	const { token } = await response.json();
	return token as Realtime.Token<typeof taskExecutionChannel, ["messages", "status"]>;
}
