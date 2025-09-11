import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import type { ModelId } from "~/lib/ai/providers";
import {
	getModelConfig,
	getModelStreamingDelay,
	MODELS,
} from "~/lib/ai/providers";
import { BraintrustMiddleware, initLogger, traced } from "braintrust";
import {
	getBraintrustConfig,
	isOtelEnabled,
} from "lightfast/v2/braintrust-env";
import { uuidv4 } from "lightfast/v2/utils";
import { webSearchTool } from "~/ai/tools/web-search";
import type { AppRuntimeContext } from "~/ai/types";
import { auth } from "@clerk/nextjs/server";
import { PlanetScaleMemory } from "~/ai/runtime/memory/planetscale";
import { AnonymousRedisMemory } from "~/ai/runtime/memory/redis";
import { env } from "~/env";
import {
	isTestErrorCommand,
	handleTestErrorCommand,
} from "~/lib/errors/test-commands";
import { ApiErrors } from "~/lib/errors/api-error-builder";
import {
	arcjet,
	shield,
	detectBot,
	slidingWindow,
	tokenBucket,
	checkDecision,
} from "@vendor/security";

// Import artifact tools
import { createDocumentTool } from "~/ai/tools/create-document";

// Create complete tools object for c010 agent including artifact tools
const c010Tools = {
	webSearch: webSearchTool,
	createDocument: createDocumentTool,
};

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
		// Block all bots for anonymous users (disabled in dev for testing)
		detectBot({
			mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
			allow: [],
		}),
		// Fixed window: 10 requests per day (86400 seconds)
		slidingWindow({
			mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
			max: 10,
			interval: 86400, // 24 hours in seconds
		}),
		// Token bucket: Very limited for anonymous
		tokenBucket({
			mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
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
	let authenticatedUserId: string | null;
	const requestId = uuidv4();

	try {
		const authResult = await auth();
		authenticatedUserId = authResult.userId;
	} catch (error) {
		console.error(`[API] Authentication check failed:`, error);
		return ApiErrors.authenticationUnavailable({ requestId });
	}

	// Server decides if this is anonymous based on actual auth state
	const isAnonymous = !authenticatedUserId;

	// Apply rate limiting for anonymous users
	if (isAnonymous) {
		const decision = await anonymousArcjet.protect(req, { requested: 1 });

		if (decision.isDenied()) {
			const check = checkDecision(decision);
			console.warn(`[Security] Anonymous request denied:`, {
				sessionId,
				ip: decision.ip,
				reason: check,
			});

			// Create appropriate error response based on denial reason
			if (check.isRateLimit) {
				return ApiErrors.rateLimitExceeded({ requestId, isAnonymous: true });
			}

			if (check.isBot) {
				return ApiErrors.botDetected({ requestId, isAnonymous: true });
			}

			if (check.isShield) {
				return ApiErrors.securityBlocked({ requestId, isAnonymous: true });
			}

			// Generic denial
			return ApiErrors.securityBlocked({ requestId, isAnonymous: true });
		}
	}

	// Set userId based on authentication status
	let userId: string;
	if (isAnonymous) {
		// For anonymous users, use a special prefix to avoid collision
		userId = `anon_${sessionId}`;
	} else {
		// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
		userId = authenticatedUserId as string; // We know it's not null since isAnonymous is false
	}

	// Validate params
	if (!agentId || !sessionId) {
		return ApiErrors.invalidPath({ requestId });
	}

	// Validate agent exists
	if (agentId !== "c010") {
		return ApiErrors.agentNotFound(agentId, { requestId });
	}

	// Simple: generate one messageId and use it everywhere
	const messageId = uuidv4();

	// Define the handler function that will be used for both GET and POST
	const executeHandler = async (): Promise<Response> => {
		try {
			// Create memory instance based on authentication status (needed for both GET and POST)
			let memory;
			try {
				memory = isAnonymous
					? new AnonymousRedisMemory({
							url: env.KV_REST_API_URL,
							token: env.KV_REST_API_TOKEN,
						})
					: new PlanetScaleMemory();
			} catch (error) {
				console.error(`[API] Failed to create memory instance:`, error);
				return ApiErrors.memoryInitFailed({ requestId, isAnonymous });
			}

			// For GET requests (resume), skip all the model/message logic
			if (req.method === "GET") {
				console.log("[Chat API] GET request for stream resume", {
					sessionId,
					agentId,
					userId,
				});

				// Just pass a minimal agent configuration for resume
				// The actual model doesn't matter for resuming an existing stream
				const response = await fetchRequestHandler({
					agent: createAgent<AppRuntimeContext, typeof c010Tools>({
						name: "c010",
						system: `Stream resume agent`,
						tools: c010Tools,
						createRuntimeContext: ({
							sessionId: _sessionId,
							resourceId: _resourceId,
						}): AppRuntimeContext => ({
							userId,
							agentId,
							messageId, // Use the generated messageId
						}),
						model: wrapLanguageModel({
							model: gateway("gpt-4o-mini"), // Use a minimal model for resume
							middleware: BraintrustMiddleware({ debug: true }),
						}),
					}),
					sessionId,
					memory,
					req,
					resourceId: userId,
					context: {
						modelId: "unknown", // Model is not relevant for resume
						isAnonymous,
					},
					createRequestContext: (req) => ({
						userAgent: req.headers.get("user-agent") ?? undefined,
						ipAddress:
							req.headers.get("x-forwarded-for") ??
							req.headers.get("x-real-ip") ??
							undefined,
					}),
					generateId: () => messageId,
					enableResume: true,
					onError(event) {
						const { error, systemContext, requestContext } = event;
						console.error(
							`[API Error - Resume] Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}, Code: ${error.errorCode}`,
							{
								error: error.message,
								statusCode: error.statusCode,
								errorCode: error.errorCode,
								stack: error.stack,
								sessionId: systemContext.sessionId,
								userId: systemContext.resourceId,
								method: req.method,
								url: req.url,
								requestContext,
							},
						);
					},
				});

				return response;
			}

			// POST request logic - extract modelId and messages
			let selectedModelId: ModelId = "openai/gpt-5-nano"; // Default model
			let lastUserMessage = "";

			try {
				const requestBody = (await req.clone().json()) as {
					modelId?: string;
					messages?: { role: string; parts?: { text?: string }[] }[];
				};
				if (requestBody.modelId && typeof requestBody.modelId === "string") {
					selectedModelId = requestBody.modelId as ModelId;
				}

				// Extract last user message for command detection
				if (requestBody.messages && Array.isArray(requestBody.messages)) {
					const lastMessage =
						requestBody.messages[requestBody.messages.length - 1];
					if (lastMessage?.role === "user" && lastMessage.parts?.[0]?.text) {
						lastUserMessage = lastMessage.parts[0].text;
					}
				}
			} catch (error) {
				// If parsing fails, use default model
				console.warn("Failed to parse request body:", error);
			}

			// Development-only: Check for test error commands
			if (isTestErrorCommand(lastUserMessage)) {
				const testResponse = handleTestErrorCommand(lastUserMessage);
				if (testResponse) {
					return testResponse;
				}
			}

			// Validate model exists before getting configuration
			if (!(selectedModelId in MODELS)) {
				console.warn(`[API] Invalid model requested: ${selectedModelId}`);
				return ApiErrors.invalidModel(selectedModelId, {
					requestId,
					isAnonymous,
				});
			}

			// Get model configuration
			const modelConfig = getModelConfig(selectedModelId);
			const streamingDelay = getModelStreamingDelay(selectedModelId);

			// Validate model access based on authentication status
			if (isAnonymous && modelConfig.accessLevel === "authenticated") {
				console.warn(
					`[Security] Anonymous user attempted to use authenticated model: ${selectedModelId}`,
				);
				return ApiErrors.modelAccessDenied(selectedModelId, {
					requestId,
					isAnonymous: true,
				});
			}

			// For Vercel AI Gateway, use the model name directly
			// Gateway handles provider routing automatically
			const gatewayModelString = modelConfig.name;

			// Log model selection for debugging
			console.log(
				`[Chat API] Using model: ${selectedModelId} -> ${gatewayModelString} (delay: ${streamingDelay}ms)`,
			);

			// Pass everything to fetchRequestHandler with inline agent
			const response = await fetchRequestHandler({
				agent: createAgent<AppRuntimeContext, typeof c010Tools>({
					name: "c010",
					system:
						"You are a helpful AI assistant with access to web search, code generation, and diagram creation capabilities.\n\nIMPORTANT: When users request code generation, examples, substantial code snippets, or diagrams, ALWAYS use the createDocument tool. Do NOT include the code or diagram syntax in your text response - they should ONLY exist in the document artifact.\n\nUse createDocument for:\n\nCODE ARTIFACTS (kind: code):\n- Code examples, functions, components\n- Create, build, write, generate requests\n- Working implementations and prototypes\n- Code analysis or refactoring\n- Scripts, configuration files\n\nDIAGRAM ARTIFACTS (kind: diagram):\n- Flowcharts and process diagrams\n- System architecture diagrams\n- Database schemas and ER diagrams\n- Sequence diagrams and timelines\n- Organizational charts and mind maps\n- Network diagrams and data flows\n- Any visual representation or diagram\n\nParameters:\n- title: Clear description (e.g. 'React Counter Component', 'User Authentication Flow')\n- kind: 'code' for code artifacts, 'diagram' for diagrams\n\nAfter creating the document, explain what you built but don't duplicate the code or diagram syntax in your response.\n\nCITATION USAGE:\nWhen referencing external information, use numbered citations in your response.\n\nFormat: Use [1], [2], [3] etc. in your text, then provide the URLs at the end.\n\nExamples:\n- React 19 introduces server components [1]\n- Next.js now supports this natively [2]\n- The official documentation explains this [3]\n\nAt the end of your response, provide the citation URLs:\n[1] https://react.dev/blog/react-19\n[2] https://nextjs.org/docs/app-router\n[3] https://docs.example.com\n\nRules:\n- Use numbered citations [1], [2], [3] for facts, statistics, API details, version numbers, quotes\n- Always provide the URL list at the end\n- Don't cite common knowledge or your own analysis",
					tools: c010Tools,
					createRuntimeContext: ({
						sessionId: _sessionId,
						resourceId: _resourceId,
					}): AppRuntimeContext => ({
						userId,
						agentId,
						messageId, // Use the generated messageId
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
				}),
				sessionId,
				memory,
				req,
				resourceId: userId,
				context: {
					modelId: selectedModelId,
					isAnonymous,
				},
				createRequestContext: (req) => ({
					userAgent: req.headers.get("user-agent") ?? undefined,
					ipAddress:
						req.headers.get("x-forwarded-for") ??
						req.headers.get("x-real-ip") ??
						undefined,
				}),
				generateId: () => messageId,
				enableResume: true,
				onError(event) {
					const { error, systemContext, requestContext } = event;
					console.error(
						`[API Error] Agent: ${agentId}, Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}, Code: ${error.errorCode}`,
						{
							error: error.message,
							statusCode: error.statusCode,
							errorCode: error.errorCode,
							stack: error.stack,
							agentId,
							sessionId: systemContext.sessionId,
							userId: systemContext.resourceId,
							method: req.method,
							url: req.url,
							requestContext,
						},
					);

					// Handle specific error types
					if (error.errorCode === "MEMORY_ERROR") {
						console.error(
							`[Memory Error] Failed for user ${systemContext.resourceId}`,
							{
								sessionId: systemContext.sessionId,
								agentId,
								errorType: error.errorCode,
								errorMessage: error.message,
							},
						);

						// Memory failures could trigger:
						// - Immediate retry mechanism
						// - User notification via WebSocket
						// - Priority alerts to monitoring system
						// - Fallback to read-only mode for this session
					}
				},
				onStreamStart(event) {
					const { streamId, agentName, messageCount, systemContext } = event;
					console.log(`[Stream Started] ${agentName}`, {
						streamId,
						sessionId: systemContext.sessionId,
						agentName,
						messageCount,
						userId: systemContext.resourceId,
					});
				},
				onStreamComplete(event) {
					const { streamId, agentName, systemContext } = event;
					console.log(`[Stream Completed] ${agentName}`, {
						streamId,
						sessionId: systemContext.sessionId,
						agentName,
						userId: systemContext.resourceId,
					});

					// Here you could send analytics data to external systems
					// analytics.track('agent_stream_complete', { ... });
				},
				onAgentStart(event) {
					const { agentName, messageCount, systemContext } = event;
					console.log(`[Agent Started] ${agentName}`, {
						agentName,
						sessionId: systemContext.sessionId,
						messageCount,
						userId: systemContext.resourceId,
					});
				},
				onAgentComplete(event) {
					const { agentName, systemContext } = event;

					console.log(`[Agent Completed] ${agentName}`, {
						agentName,
						sessionId: systemContext.sessionId,
						userId: systemContext.resourceId,
					});

					// Here you could track agent completion metrics
					// metrics.counter('agent_completions', 1, { agent: agentName });
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
			return ApiErrors.internalError(
				error instanceof Error ? error : new Error(String(error)),
				{ requestId, agentId, sessionId, userId, isAnonymous },
			);
		}
	};

	// Only wrap with traced for POST requests
	if (req.method === "POST") {
		try {
			return traced(executeHandler, {
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
