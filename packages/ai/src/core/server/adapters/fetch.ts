import type { UIMessage } from "ai";
import type { Memory } from "../../memory";
import type { Agent } from "../../primitives/agent";
import type { ToolFactorySet } from "../../primitives/tool";
import { findAgent, processMessages, resumeStream, streamChat, validateThread } from "../runtime";

export interface FetchRequestHandlerOptions<
	TAgents extends readonly Agent<UIMessage, unknown, ToolFactorySet<unknown>>[],
	TMessage extends UIMessage = UIMessage,
	TUserContext = {},
> {
	agents: TAgents;
	memory: Memory<TMessage>;
	req: Request;
	resourceId: string;
	createRuntimeContext: (params: { threadId: string; resourceId: string }) => TUserContext;
	generateId?: () => string;
	enableResume?: boolean;
	onError?: (error: { error: Error; path?: string }) => void;
}

/**
 * Handles agent requests following the tRPC pattern
 *
 * @example
 * ```typescript
 * const agents = [
 *   new Agent({
 *     name: "a011",
 *     system: A011_SYSTEM_PROMPT,
 *     tools: createA011Tools,
 *     // ... other config
 *   }),
 *   // ... more agents
 * ];
 *
 * const memory = new RedisMemory({
 *   url: env.KV_REST_API_URL,
 *   token: env.KV_REST_API_TOKEN,
 * });
 *
 * const handler = async (req) => {
 *   const { userId } = await auth();
 *   if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   return fetchRequestHandler({
 *     agents,
 *     memory,
 *     req,
 *     resourceId: userId,
 *     createRuntimeContext: ({ threadId, resourceId }) => ({
 *       threadId,
 *       // Add your runtime context properties here
 *     }),
 *     onError({ error, path }) {
 *       console.error(`Agent error on '${path}':`, error);
 *     }
 *   });
 * };
 *
 * export { handler as GET, handler as POST };
 * ```
 */
export async function fetchRequestHandler<
	TAgents extends readonly Agent<UIMessage, unknown, ToolFactorySet<unknown>>[],
	TMessage extends UIMessage = UIMessage,
	TUserContext = {},
>(options: FetchRequestHandlerOptions<TAgents, TMessage, TUserContext>): Promise<Response> {
	const { agents, memory, req, resourceId, createRuntimeContext, generateId, enableResume, onError } = options;

	// Extract agentId and threadId from URL path
	const url = new URL(req.url);
	const pathSegments = url.pathname.split("/").filter(Boolean);

	// Find the index of 'v' in the path
	const vIndex = pathSegments.indexOf("v");
	if (vIndex === -1 || vIndex + 2 >= pathSegments.length) {
		return Response.json({ error: "Invalid path: expected /api/v/[agentId]/[threadId]" }, { status: 400 });
	}

	// Extract agentId and threadId from path
	const agentId = pathSegments[vIndex + 1];
	const threadId = pathSegments[vIndex + 2];

	if (!agentId || !threadId) {
		return Response.json({ error: "Missing agentId or threadId in path" }, { status: 400 });
	}

	if (req.method !== "POST" && req.method !== "GET") {
		return new Response("Method not allowed", { status: 405 });
	}

	// Find the agent by name
	const agent = findAgent(agents, agentId);
	if (!agent) {
		const error = new Error(`Agent '${agentId}' not found`);
		onError?.({ error, path: `${agentId}/${threadId}` });
		return Response.json({ error: `Agent '${agentId}' not found` }, { status: 404 });
	}

	// Validate thread ownership
	const threadValidation = await validateThread(memory, threadId, resourceId);
	if (threadValidation.exists && !threadValidation.isAuthorized) {
		const error = new Error("Forbidden: Thread belongs to another user");
		onError?.({ error, path: `${agentId}/${threadId}` });
		return Response.json({ error: "Forbidden" }, { status: 403 });
	}

	if (req.method === "POST") {
		try {
			const body = await req.json();
			const { messages } = body as { messages: TMessage[] };

			if (!messages || messages.length === 0) {
				throw new Error("At least one message is required");
			}

			// Use the streamChat function from runtime
			return await streamChat({
				agent,
				threadId,
				messages,
				memory,
				resourceId,
				createRuntimeContext,
				generateId,
				enableResume,
			});
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			onError?.({ error: err, path: `${agentId}/${threadId}` });
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	} else if (req.method === "GET" && enableResume) {
		if (!threadId) {
			return new Response("threadId is required", { status: 400 });
		}

		try {
			// Use the resumeStream function from runtime
			const resumedStream = await resumeStream(memory, threadId, resourceId);
			
			if (!resumedStream) {
				return new Response(null, { status: 204 });
			}

			return new Response(resumedStream);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			if (err.message.includes("not found")) {
				return Response.json({ error: "Not found" }, { status: 404 });
			}
			onError?.({ error: err, path: `${agentId}/${threadId}` });
			throw err;
		}
	}

	// Method not allowed
	return new Response("Method not allowed", { status: 405 });
}
