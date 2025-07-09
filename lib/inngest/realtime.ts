import { channel, topic } from "@inngest/realtime";
import { z } from "zod";

// Create a channel for each task execution, given a chat ID
export const taskExecutionChannel = channel((chatId: string) => `task:${chatId}`)
	// Add messages topic for all AI agent messages
	.addTopic(
		topic("messages").schema(
			z.object({
				message: z.string(),
				id: z.string(),
				role: z.enum(["user", "assistant"]),
			}),
		),
	)
	// Add status topic for global status updates
	.addTopic(
		topic("status").schema(
			z.object({
				status: z.enum(["starting", "running", "completed", "error"]),
				message: z.string().optional(),
			}),
		),
	);
