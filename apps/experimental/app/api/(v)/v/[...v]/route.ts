import { auth } from "@clerk/nextjs/server";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
import { createAgents, type A011Tools } from "@/app/ai/agents";
import type { AppRuntimeContext } from "@/app/ai/types";
import { env } from "@/env";
import { uuidv4 } from "@/lib/uuidv4";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Create Redis memory instance
const memory = new RedisMemory<LightfastUIMessage>({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

// Create all available agents
const agents = createAgents();

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (req: Request) => {
	// Handle authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Pass everything to fetchRequestHandler
	return fetchRequestHandler<LightfastUIMessage, AppRuntimeContext, A011Tools>({
		agents,
		memory,
		req,
		resourceId: userId,
		createRuntimeContext: ({ threadId, resourceId }) => {
			// Return user-defined context fields
			// The system will automatically add threadId and resourceId
			const userContext: AppRuntimeContext = {
				// Add any custom fields here
			};
			return userContext;
		},
		generateId: uuidv4,
		enableResume: true,
		onError({ error, path }) {
			console.error(`>>> Agent Error on '${path}'`, error);
		},
	});
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };
