import type { UIMessage } from "ai";
import type { Memory } from "../../memory";
import type { Agent } from "../../primitives/agent";
import {
	MethodNotAllowedError,
	NoMessagesError,
	toApiError
} from "../errors";
import type { ApiError } from "../errors";
import { resumeStream, streamChat } from "../runtime";
import type { ResumeOptions } from "../runtime";
import type { RequestContext } from "./types";
import type { LifecycleCallbacks } from "../lifecycle";

/**
 * Helper to convert ApiError to Response
 */
function mapStatusCodeToChatErrorType(status: number): string {
	if (status === 401) return "AUTHENTICATION";
	if (status === 403) return "SECURITY_BLOCKED";
	if (status === 404) return "INVALID_REQUEST";
	if (status === 429) return "RATE_LIMIT";
	if (status >= 500 && status < 600) return "SERVER_ERROR";
	if (status >= 400 && status < 500) return "INVALID_REQUEST";
	return "SERVER_ERROR";
}

function defaultUserMessageForType(type: string): string {
	switch (type) {
		case "AUTHENTICATION":
			return "Please sign in to continue.";
		case "SECURITY_BLOCKED":
			return "Access denied. Please try again later.";
		case "RATE_LIMIT":
			return "You're sending messages too quickly. Please slow down.";
		case "INVALID_REQUEST":
			return "The request could not be processed. Please check and try again.";
		case "SERVER_ERROR":
		default:
			return "An unexpected error occurred. Please try again.";
	}
}

function errorToResponse(error: ApiError, metadata?: Record<string, unknown>): Response {
	const status = error.statusCode ?? 500;
	const type = mapStatusCodeToChatErrorType(status);
	const payload = {
		type,
		error: error.message,
		message: defaultUserMessageForType(type),
		statusCode: status,
		metadata: {
			timestamp: Date.now(),
			errorCode: error.errorCode,
			...metadata,
		},
	};

	return new Response(JSON.stringify(payload), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export interface FetchRequestHandlerOptions<
	TAgent extends Agent<any, any> = Agent<any, any>,
	TRequestContext extends RequestContext = RequestContext,
	TFetchContext = {},
> extends LifecycleCallbacks {
	agent: TAgent;
	sessionId: string;
	memory: Memory<UIMessage, TFetchContext>;
	req: Request;
	resourceId: string;
	context?: TFetchContext;
	createRequestContext?: (req: Request) => TRequestContext;
	generateId?: () => string;
	enableResume?: boolean;
	resumeOptions?: ResumeOptions;
	body?: unknown;
}

/**
 * Handles agent streaming requests
 *
 * TODO: Add testing for:
 * - Test undefined sessionId handling (v1 runtime doesn't error on undefined sessionId)
 * - Add comprehensive test coverage for error cases
 * - Test sessionId validation and edge cases
 *
 * @example
 * ```typescript
 * // In your route handler (e.g., app/api/agents/[agentId]/sessions/[sessionId]/route.ts)
 * export async function POST(
 *   req: Request,
 *   { params }: { params: { agentId: string; sessionId: string } }
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
 *     sessionId: params.sessionId,
 *     memory,
 *     req,
 *     resourceId: userId,
 *     createRuntimeContext: ({ sessionId, resourceId }) => ({
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
	TAgent extends Agent<any, any> = Agent<any, any>,
	TRequestContext extends RequestContext = RequestContext,
	TFetchContext = {},
>(
	options: FetchRequestHandlerOptions<TAgent, TRequestContext, TFetchContext>,
): Promise<Response> {
	const {
		agent,
		sessionId,
		memory,
		req,
		resourceId,
		context,
		createRequestContext,
		generateId,
		enableResume,
		resumeOptions,
		onError,
		onStreamStart,
		onStreamComplete,
		onAgentStart,
		onAgentComplete,
		body: providedBody,
	} = options;

	try {
		// Check HTTP method
		if (req.method !== "POST" && req.method !== "GET") {
			throw new MethodNotAllowedError(req.method, ["GET", "POST"]);
		}

		// Handle POST request
		if (req.method === "POST") {
			const hasProvidedBody = Object.prototype.hasOwnProperty.call(
				options,
				"body",
			);
			const rawBody = hasProvidedBody ? providedBody : await req.json();
			const { messages } = (rawBody ?? {}) as { messages?: UIMessage[] };

			if (!messages || messages.length === 0) {
				throw new NoMessagesError();
			}

			// Extract the single user message (should always be the last one)
			const message = messages[messages.length - 1];
			if (!message) {
				throw new NoMessagesError();
			}

			// Create system context
			const systemContext = { sessionId, resourceId };

			// Create request context if function is provided
			const requestContext = createRequestContext?.(req) || {};

			// Use the streamChat function from runtime
			const result = await streamChat({
				agent,
				sessionId,
				message,
				memory,
				resourceId,
				systemContext,
				requestContext,
				context,
				generateId,
				enableResume,
				resumeOptions,
				abortSignal: req.signal,
				onError,
				onStreamStart,
				onStreamComplete,
				onAgentStart,
				onAgentComplete,
			});

			if (!result.ok) {
				throw result.error;
			}

			return result.value;
		}
		// Handle GET request (resume)
		const shouldEnableResume = enableResume || resumeOptions?.enabled;
		if (req.method === "GET" && shouldEnableResume) {
			const result = await resumeStream(memory, sessionId, resourceId);

			if (!result.ok) {
				throw result.error;
			}

			// Handle null response (no stream to resume)
			// Return 204 No Content as per AI SDK specification
			if (!result.value) {
				return new Response(null, { 
					status: 204,
					statusText: "No Content",
					headers: {
						"Cache-Control": "no-cache",
					}
				});
			}

			// Return the response directly (already has proper headers)
			return result.value;
		}

		// This should not happen due to earlier check
		throw new MethodNotAllowedError(req.method, ["GET", "POST"]);
	} catch (error) {
		const apiError = toApiError(error);

		onError?.({
			systemContext: { sessionId, resourceId },
			requestContext: createRequestContext?.(req),
			error: apiError,
		});

		return errorToResponse(apiError, { sessionId, resourceId });
	}
}
