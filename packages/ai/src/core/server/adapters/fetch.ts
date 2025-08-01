import type { UIMessage } from "ai";
import type { Memory } from "../../memory";
import type { Agent } from "../../primitives/agent";
import { type ApiError, GenericBadRequestError, MethodNotAllowedError, NoMessagesError, toApiError } from "../errors";
import { resumeStream, streamChat } from "../runtime";
import type { RequestContext, SystemContext } from "./types";

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
	TAgent extends Agent<any, any>,
	TRequestContext extends RequestContext = RequestContext,
> {
	agent: TAgent;
	threadId: string;
	memory: Memory<UIMessage>;
	req: Request;
	resourceId: string;
	createRequestContext?: (req: Request) => TRequestContext;
	generateId?: () => string;
	enableResume?: boolean;
	onError?: (error: { error: Error }) => void;
}

/**
 * Handles agent streaming requests
 *
 * @example
 * ```typescript
 * // In your route handler (e.g., app/api/agents/[agentId]/threads/[threadId]/route.ts)
 * export async function POST(
 *   req: Request,
 *   { params }: { params: { agentId: string; threadId: string } }
 * ) {
 *   const { userId } = await auth();
 *   if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   // Resolve agent however you want
 *   const agent = myAgentRegistry.get(params.agentId);
 *   if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
 *
 *   const memory = new RedisMemory({
 *     url: env.KV_REST_API_URL,
 *     token: env.KV_REST_API_TOKEN,
 *   });
 *
 *   return fetchRequestHandler({
 *     agent,
 *     threadId: params.threadId,
 *     memory,
 *     req,
 *     resourceId: userId,
 *     createRuntimeContext: ({ threadId, resourceId }) => ({
 *       // Add your runtime context properties here
 *     }),
 *     onError({ error }) {
 *       console.error('Agent error:', error);
 *     }
 *   });
 * }
 * ```
 */
export async function fetchRequestHandler<
	TAgent extends Agent<any, any>,
	TRequestContext extends RequestContext = RequestContext,
>(options: FetchRequestHandlerOptions<TAgent, TRequestContext>): Promise<Response> {
	const { agent, threadId, memory, req, resourceId, createRequestContext, generateId, enableResume, onError } = options;

	try {
		// Check HTTP method
		if (req.method !== "POST" && req.method !== "GET") {
			throw new MethodNotAllowedError(req.method, ["GET", "POST"]);
		}

		// Handle POST request
		if (req.method === "POST") {
			const body = await req.json();
			const { messages } = body as { messages: UIMessage[] };

			if (!messages || messages.length === 0) {
				throw new NoMessagesError();
			}

			// Create system context
			const systemContext = { threadId, resourceId };

			// Create request context if function is provided
			const requestContext = createRequestContext?.(req) || {};

			// Use the streamChat function from runtime
			const result = await streamChat({
				agent,
				threadId,
				messages,
				memory,
				resourceId,
				systemContext,
				requestContext,
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
		onError?.({ error: apiError });

		// Return error response
		return errorToResponse(apiError);
	}
}
