import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "@lightfast/core/agent";
import { fetchRequestHandler } from "@lightfast/core/agent/handlers";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import type { ModelId } from "~/lib/ai/providers";
import { getModelConfig, getModelStreamingDelay } from "~/lib/ai/providers";
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
import { AnonymousRedisMemory } from "~/ai/runtime/memory/redis";
import { env } from "~/env";
import {
	arcjet,
	shield,
	detectBot,
	slidingWindow,
	tokenBucket,
	checkDecision,
	createErrorResponse,
} from "@vendor/security";

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

// Create Arcjet instance for anonymous users only
// Strict limit: 10 messages per day
const anonymousArcjet = arcjet({
	key: env.ARCJET_KEY,
	characteristics: ["ip.src"], // Rate limit by IP for anonymous
	rules: [
		// Shield protects against common attacks
		shield({ mode: "LIVE" }),
		// Block all bots for anonymous users
		detectBot({ mode: "LIVE", allow: [] }),
		// Fixed window: 10 requests per day (86400 seconds)
		slidingWindow({ 
			mode: "LIVE", 
			max: 10, 
			interval: 86400 // 24 hours in seconds
		}),
		// Token bucket: Very limited for anonymous
		tokenBucket({
			mode: "LIVE",
			refillRate: 1,
			interval: 8640, // 1 token every 2.4 hours (10 per day)
			capacity: 10, // Allow up to 10 messages in burst (full daily limit)
		}),
	],
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
	
	// Server determines authentication status - no client control
	const authResult = await auth();
	const authenticatedUserId = authResult.userId;
	
	// Server decides if this is anonymous based on actual auth state
	const isAnonymous = !authenticatedUserId;
	
	// Apply rate limiting for anonymous users
	if (isAnonymous) {
		const decision = await anonymousArcjet.protect(req, { requested: 1 });
		
		if (decision.isDenied()) {
			console.warn(`[Security] Anonymous request denied:`, {
				sessionId,
				ip: decision.ip,
				reason: checkDecision(decision),
			});
			return createErrorResponse(decision);
		}
	}
	
	// Set userId based on authentication status
	let userId: string;
	if (isAnonymous) {
		// For anonymous users, use a special prefix to avoid collision
		userId = `anon_${sessionId}`;
	} else {
		userId = authenticatedUserId;
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
			// Extract modelId from request body for POST requests
			let selectedModelId: ModelId = "openai/gpt-5-nano"; // Default model
			
			if (req.method === "POST") {
				try {
					const requestBody = await req.clone().json() as { modelId?: string };
					if (requestBody.modelId && typeof requestBody.modelId === "string") {
						selectedModelId = requestBody.modelId as ModelId;
					}
				} catch (error) {
					// If parsing fails, use default model
					console.warn("Failed to parse request body for modelId:", error);
				}
			}

			// Get model configuration
			const modelConfig = getModelConfig(selectedModelId);
			const streamingDelay = getModelStreamingDelay(selectedModelId);

			// For Vercel AI Gateway, use the model name directly
			// Gateway handles provider routing automatically
			const gatewayModelString = modelConfig.name;

			// Log model selection for debugging
			console.log(`[Chat API] Using model: ${selectedModelId} -> ${gatewayModelString} (delay: ${streamingDelay}ms)`);

			// Create memory instance based on authentication status
			const memory = isAnonymous
				? new AnonymousRedisMemory({
						url: env.KV_REST_API_URL,
						token: env.KV_REST_API_TOKEN,
					})
				: new PlanetScaleMemory();

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
						model: gateway(gatewayModelString),
						middleware: BraintrustMiddleware({ debug: true }),
					}),
					experimental_transform: smoothStream({
						delayInMs: streamingDelay,
						chunking: "word",
					}),
					stopWhen: stepCountIs(10),
					experimental_telemetry: {
						isEnabled: isOtelEnabled(),
						metadata: {
							agentId,
							agentName: "c010",
							sessionId,
							userId,
							modelId: selectedModelId,
							modelProvider: modelConfig.provider,
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
								output:
									result.response.messages.length > 0
										? result.response.messages
										: result.text,
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
					console.error(
						`[API Error] Agent: ${agentId}, Session: ${sessionId}, User: ${userId}`,
						{
							error: error.message,
							stack: error.stack,
							agentId,
							sessionId,
							userId,
							method: req.method,
							url: req.url,
						},
					);
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
				{ status: 500 },
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
			console.warn(
				`[API Route] Traced wrapper failed, falling back to direct execution:`,
				error,
			);
			return executeHandler();
		}
	}

	// GET requests run without traced wrapper
	return executeHandler();
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };
