import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { Agent, type DatabaseOperations } from "@lightfast/ai/agent";
import { agentHandler } from "@lightfast/ai/agent/handlers";
import { A011_SYSTEM_PROMPT, type A011Tools, createA011Tools } from "@lightfast/ai/agents/a011";
import type { LightfastUIMessage } from "@lightfast/types";
import { smoothStream, stepCountIs } from "ai";
import {
	appendMessages,
	createMessages,
	createStream,
	createThread,
	getMessages,
	getThread,
	getThreadStreams,
} from "@/lib/db";
import { uuidv4 } from "@/lib/uuidv4";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Create database operations object
const dbOperations: DatabaseOperations<LightfastUIMessage> = {
	appendMessages,
	createMessages,
	createStream,
	createThread,
	getMessages,
	getThread,
	getThreadStreams,
};

// Export handlers WITHOUT resume functionality
// This demonstrates a simpler agent that doesn't support stream resumption
export const { POST } = agentHandler({
	createAgent: ({ resourceId }) => {
		return new Agent<LightfastUIMessage, A011Tools>({
			name: "a011-simple",
			resourceId,
			db: dbOperations,
			system: A011_SYSTEM_PROMPT,
			tools: createA011Tools,
			model: gateway("anthropic/claude-4-sonnet"),
			experimental_transform: smoothStream({
				delayInMs: 25,
				chunking: "word",
			}),
			stopWhen: stepCountIs(30),
			_internal: {
				generateId: uuidv4,
			},
			// UI stream options for reasoning and sources
			uiStreamOptions: {
				sendReasoning: true,
				sendSources: false,
			},
		});
	},
	auth: async () => {
		const authResult = await auth();
		if (!authResult || !authResult.userId) return null;
		return { resourceId: authResult.userId };
	},
	generateId: uuidv4,
	enableResume: false, // Disable resumable streams - no GET handler will be created
});
