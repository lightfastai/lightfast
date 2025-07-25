import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import { createAgents } from "@/app/ai/agents";
import type { LightfastUIMessage } from "@lightfast/types";
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
	{ params }: { params: Promise<{ ai: string[] }> }
) => {
	// Handle authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;
	const [agentId, threadId] = resolvedParams.ai;

	// Validate params
	if (!agentId || !threadId) {
		return Response.json({ error: "Invalid path: expected /api/ai/[agentId]/[threadId]" }, { status: 400 });
	}

	// Create all available agents with the current userId as resourceId
	const agents = createAgents({ resourceId: userId, memory });

	// Call fetchRequestHandler with the agents array
	return fetchRequestHandler({
		agents,
		req,
		params: { agentId, threadId },
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