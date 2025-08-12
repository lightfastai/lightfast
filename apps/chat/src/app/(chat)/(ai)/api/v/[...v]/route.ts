import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "@lightfast/core/agent";
import { fetchRequestHandler } from "@lightfast/core/agent/handlers";
import { smoothStream, wrapLanguageModel } from "ai";
import {
	BraintrustMiddleware,
	currentSpan,
	initLogger,
	traced,
} from "braintrust";
import {
	getBraintrustConfig,
	isOtelEnabled,
} from "@lightfast/core/v2/braintrust-env";
import { uuidv4 } from "@lightfast/core/v2/utils";
import { webSearchTool } from "~/ai/tools/web-search";
import type { AppRuntimeContext } from "~/ai/types";
import { auth } from "@clerk/nextjs/server";
import { PlanetScaleMemory } from "~/ai/runtime/memory/planetscale";

// Create tools object for c010 agent
const c010Tools = {
	webSearch: webSearchTool,
} as const;

// Infer the tool schema type
type C010ToolSchema = typeof c010Tools;

// Initialize Braintrust logging
const braintrustConfig = getBraintrustConfig();
initLogger({
	apiKey: braintrustConfig.apiKey,
	projectName: braintrustConfig.projectName || "chat-app",
});

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (
	req: Request,
	{ params }: { params: Promise<{ v: string[] }> },
) => {
	// Await the params
	const { v } = await params;

	// Extract agentId and sessionId
	const [agentId, sessionId] = v;

	// Get authenticated user ID from Clerk
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Validate params
	if (!agentId || !sessionId) {
		return Response.json(
			{ error: "Invalid path. Expected /api/v/[agentId]/[sessionId]" },
			{ status: 400 },
		);
	}

	// Validate agent exists
	if (agentId !== "c010") {
		return Response.json({ error: "Agent not found" }, { status: 404 });
	}

	// Define the handler function that will be used for both GET and POST
	const executeHandler = async () => {
		try {
			// Create PlanetScale memory instance using tRPC
			const memory = new PlanetScaleMemory();
			
			// Pass everything to fetchRequestHandler with inline agent
			const response = await fetchRequestHandler({
			agent: createAgent<C010ToolSchema, AppRuntimeContext>({
				name: "c010",
				system: `You are a helpful AI assistant with access to web search capabilities.
You can help users find information, answer questions, and provide insights based on current web data.
When searching, be thoughtful about your queries and provide comprehensive, well-sourced answers.`,
				tools: c010Tools,
				createRuntimeContext: ({
					sessionId: _sessionId,
					resourceId: _resourceId,
				}): AppRuntimeContext => ({
					userId,
					agentId,
				}),
				model: wrapLanguageModel({
					model: gateway("openai/gpt-4.1-nano"),
					middleware: BraintrustMiddleware({ debug: true }),
				}),
				experimental_transform: smoothStream({
					delayInMs: 25,
					chunking: "word",
				}),
				experimental_telemetry: {
					isEnabled: isOtelEnabled(),
					metadata: {
						agentId,
						agentName: "c010",
						sessionId,
						userId,
					},
				},
				onChunk: ({ chunk }) => {
					if (chunk.type === "tool-call") {
						// Tool called
					}
				},
				onFinish: (result) => {
					// Log to Braintrust for POST requests
					if (req.method === "POST") {
						currentSpan().log({
							input: {
								agentId,
								sessionId,
								userId,
							},
							output: result.response.messages.length > 0 ? result.response.messages : result.text,
							metadata: {
								finishReason: result.finishReason,
								usage: result.usage,
							},
						});
					}
				},
			}),
			sessionId,
			memory,
			req,
			resourceId: userId,
			createRequestContext: (req) => ({
				userAgent: req.headers.get("user-agent") ?? undefined,
				ipAddress:
					req.headers.get("x-forwarded-for") ??
					req.headers.get("x-real-ip") ??
					undefined,
			}),
			generateId: uuidv4,
			enableResume: true,
			onError({ error }) {
				console.error(`[API Error] Agent: ${agentId}, Session: ${sessionId}, User: ${userId}`, {
					error: error.message,
					stack: error.stack,
					agentId,
					sessionId,
					userId,
					method: req.method,
					url: req.url,
				});
			},
		});

		return response;
		} catch (error) {
			// Defensive catch - fetchRequestHandler should handle all errors,
			// but this provides a final safety net
			console.error(`[API Route Error] Unhandled error in route handler:`, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				agentId,
				sessionId,
				userId,
				method: req.method,
				url: req.url,
			});
			
			// Return a generic 500 error
			return Response.json(
				{ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
				{ status: 500 }
			);
		}
	};

	// Only wrap with traced for POST requests
	if (req.method === "POST") {
		try {
			return await traced(executeHandler, {
				type: "function",
				name: `POST /api/v/${agentId}/${sessionId}`,
			});
		} catch (error) {
			// If traced wrapper fails, fall back to direct execution
			console.warn(`[API Route] Traced wrapper failed, falling back to direct execution:`, error);
			return executeHandler();
		}
	}

	// GET requests run without traced wrapper
	return executeHandler();
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };

