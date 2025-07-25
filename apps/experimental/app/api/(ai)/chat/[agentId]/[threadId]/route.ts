import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { Agent } from "@lightfast/ai/agent";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/redis";
import { A011_SYSTEM_PROMPT, type A011Tools, createA011Tools } from "@lightfast/ai/agents/a011";
import type { LightfastUIMessage } from "@lightfast/types";
import { smoothStream, stepCountIs } from "ai";
import { env } from "@/env";
import { uuidv4 } from "@/lib/uuidv4";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Create Redis memory instance
const memory = new RedisMemory<LightfastUIMessage>({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (
	req: Request,
	{ params }: { params: Promise<{ agentId: string; threadId: string }> }
) => {
	// Handle authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;

	// Call fetchRequestHandler with the agent
	return fetchRequestHandler({
		agent: new Agent<LightfastUIMessage, A011Tools>({
			name: "a011",
			resourceId: userId, // In our implementation, we use userId as resourceId
			memory,
			system: A011_SYSTEM_PROMPT,
			tools: createA011Tools,
			model: gateway("anthropic/claude-4-sonnet"),
			experimental_transform: smoothStream({
				delayInMs: 25,
				chunking: "word",
			}),
			stopWhen: stepCountIs(30),
		}),
		req,
		params: resolvedParams,
		createContext: () => ({
			resourceId: userId,
		}),
		generateId: uuidv4,
		enableResume: true,
		onError({ error, path }) {
			console.error(`>>> Agent Error on '${path}'`, error);
		},
	});
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };