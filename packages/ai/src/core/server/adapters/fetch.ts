import type { UIMessage } from "ai";
import type { Memory } from "../../memory";
import type { Agent } from "../../primitives/agent";
import type { ToolFactorySet } from "../../primitives/tool";
import {
	type ApiError,
	GenericBadRequestError,
	InvalidPathError,
	MethodNotAllowedError,
	NoMessagesError,
	toApiError,
} from "../errors";
import { findAgent, resumeStream, streamChat } from "../runtime";

/**
 * Extract agent and thread IDs from path
 * Matches paths containing /v/[agentId]/[threadId] anywhere in the path
 */
function extractPathParams(pathname: string): { agentId: string; threadId: string } | null {
	// Find the index of '/v/' in the path
	const vIndex = pathname.lastIndexOf("/v/");
	if (vIndex === -1) return null;

	// Extract the segments after /v/
	const segments = pathname.slice(vIndex + 3).split("/");
	if (segments.length < 2) return null;

	const [agentId, threadId] = segments;
	if (!agentId || !threadId) return null;

	return { agentId, threadId };
}

/**
 * Helper to convert ApiError to Response
 */
function errorToResponse(error: ApiError): Response {
	return Response.json(error.toJSON(), {
		status: error.statusCode,
		headers: { "Content-Type": "application/json" },
	});
}

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

	// Extract path parameters
	const url = new URL(req.url);
	const pathParams = extractPathParams(url.pathname);

	// Initialize variables for error handler access
	let agentId = "";
	let threadId = "";

	try {
		// Validate path structure
		if (!pathParams) {
			throw new InvalidPathError("/api/v/[agentId]/[threadId]");
		}

		agentId = pathParams.agentId;
		threadId = pathParams.threadId;

		// Check HTTP method
		if (req.method !== "POST" && req.method !== "GET") {
			throw new MethodNotAllowedError(req.method, ["GET", "POST"]);
		}

		// Find the agent
		const agentResult = findAgent(agents, agentId);
		if (!agentResult.ok) {
			throw agentResult.error;
		}
		const agent = agentResult.value;

		// Handle POST request
		if (req.method === "POST") {
			const body = await req.json();
			const { messages } = body as { messages: TMessage[] };

			if (!messages || messages.length === 0) {
				throw new NoMessagesError();
			}

			// Use the streamChat function from runtime
			const result = await streamChat({
				agent,
				threadId,
				messages,
				memory,
				resourceId,
				createRuntimeContext,
				generateId,
				enableResume,
			});

			if (!result.ok) {
				throw result.error;
			}

			return result.value;
		}
		// Handle GET request (resume)
		if (req.method === "GET" && enableResume) {
			const result = await resumeStream(memory, threadId, resourceId);

			if (!result.ok) {
				throw result.error;
			}

			if (!result.value) {
				return new Response(null, { status: 204 });
			}

			return new Response(result.value);
		}

		// This should not happen due to earlier check
		throw new MethodNotAllowedError(req.method, ["GET", "POST"]);
	} catch (error) {
		// Convert to ApiError if needed
		const apiError = toApiError(error);

		// Call error handler if provided
		onError?.({ error: apiError, path: `${agentId}/${threadId}` });

		// Return error response
		return errorToResponse(apiError);
	}
}
