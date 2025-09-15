import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { smoothStream, stepCountIs, wrapLanguageModel, generateObject, NoSuchToolError } from "ai";
import type { ModelId } from "~/ai/providers";
import {
	getModelConfig,
	getModelStreamingDelay,
	MODELS,
} from "~/ai/providers";
import { BraintrustMiddleware, initLogger, traced } from "braintrust";
import {
	getBraintrustConfig,
	isOtelEnabled,
} from "lightfast/v2/braintrust-env";
import { uuidv4 } from "lightfast/v2/utils";
import { webSearchTool } from "~/ai/tools/web-search";
import type { AppRuntimeContext } from "~/ai/lightfast-app-chat-ui-messages";
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
import { buildAnonymousSystemPrompt, buildAuthenticatedSystemPrompt } from "~/ai/prompts/builders/system-prompt-builder";
import { 
	requireMessageAccess,
	trackMessageSent,
	UsageLimitExceededError
} from "~/lib/billing/usage-service";
import { 
	ClerkPlanKey, 
	BILLING_LIMITS, 
	hasClerkPlan
} from "~/lib/billing/types";

// Import artifact tools
import { createDocumentTool } from "~/ai/tools/create-document";

// Complete tools object for c010 agent including artifact tools
const c010Tools = {
	webSearch: webSearchTool,
	createDocument: createDocumentTool,
};

/**
 * Get user's billing plan from Clerk authentication
 */
const getUserPlan = async (): Promise<ClerkPlanKey> => {
	try {
		const { has } = await auth();
		const hasPlusPlan = hasClerkPlan(has, ClerkPlanKey.PLUS_TIER);
		return hasPlusPlan ? ClerkPlanKey.PLUS_TIER : ClerkPlanKey.FREE_TIER;
	} catch (error) {
		console.warn('[Billing] Failed to get user plan, defaulting to FREE_TIER:', error);
		return ClerkPlanKey.FREE_TIER;
	}
};

// Get active tool names based on authentication status, user plan, and user preferences
const getActiveToolsForUser = (isAnonymous: boolean, userPlan: ClerkPlanKey, webSearchEnabled: boolean): (keyof typeof c010Tools)[] | undefined => {
	if (isAnonymous) {
		// Anonymous users: only web search tool can be active, and only if enabled
		return webSearchEnabled ? ["webSearch"] : [];
	} else {
		// Authenticated users: tools based on plan and preferences
		const activeTools: (keyof typeof c010Tools)[] = ["createDocument"]; // All authenticated users get artifacts
		
		if (webSearchEnabled) {
			// Check if user's plan allows web search
			const planLimits = BILLING_LIMITS[userPlan];
			if (planLimits.hasWebSearch) {
				activeTools.push("webSearch");
			}
			// If user doesn't have web search access, silently don't add the tool
			// The client should already prevent this, but this is server-side enforcement
		}
		
		return activeTools;
	}
};

// Create conditional system prompts based on authentication status using centralized builders
const createSystemPromptForUser = (isAnonymous: boolean): string => {
	return isAnonymous 
		? buildAnonymousSystemPrompt(true) 
		: buildAuthenticatedSystemPrompt(true);
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
					isAnonymous,
				});

				// Create conditional active tools and system prompt for resume
				// For resume requests, we don't have request body, so default webSearch to enabled
				// Get user plan for authenticated users (needed for tool access)
				const resumeUserPlan = isAnonymous ? ClerkPlanKey.FREE_TIER : await getUserPlan();
				const activeToolsForUser = getActiveToolsForUser(isAnonymous, resumeUserPlan, true);
				const resumeSystemPrompt = createSystemPromptForUser(isAnonymous);

				// Just pass a minimal agent configuration for resume
				// The actual model doesn't matter for resuming an existing stream
				const response = await fetchRequestHandler({
					agent: createAgent<AppRuntimeContext, typeof c010Tools>({
						name: "c010",
						system: resumeSystemPrompt,
						tools: c010Tools,
						activeTools: activeToolsForUser,
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
						experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
							// Don't attempt to fix invalid tool names
							if (NoSuchToolError.isInstance(error)) {
								return null;
							}

							const tool = tools[toolCall.toolName];
							if (!tool) return null;

							try {
								const result = await generateObject({
									model: gateway('google/gemini-2.5-flash'),
									schema: tool.inputSchema,
									prompt: [
										`The model tried to call the tool "${toolCall.toolName}" with the following inputs:`,
										JSON.stringify(toolCall.input),
										`The tool accepts the following schema:`,
										JSON.stringify(inputSchema(toolCall)),
										'Please fix the inputs to match the schema exactly. Preserve the original intent while ensuring all parameters are valid.',
									].join('\n'),
								});

								console.log(`[Tool Repair] Successfully repaired: ${toolCall.toolName}`);
								return { ...toolCall, input: JSON.stringify(result.object) };
							} catch {
								return null;
							}
						},
						experimental_telemetry: {
							isEnabled: isOtelEnabled(),
							functionId: "chat-resume",
							metadata: {
								context: "production",
								inferenceType: "chat-resume",
								agentId,
								agentName: "c010",
								sessionId,
								userId,
								modelId: "gpt-4o-mini",
								modelProvider: "gateway",
								isAnonymous,
								resumeOperation: true,
							},
						},
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

			// POST request logic - extract modelId, messages, and webSearchEnabled
			let selectedModelId: ModelId = "openai/gpt-5-nano"; // Default model
			let lastUserMessage = "";
			let webSearchEnabled = false; // Default to false

			try {
				const requestBody = (await req.clone().json()) as {
					modelId?: string;
					messages?: { role: string; parts?: { text?: string }[] }[];
					webSearchEnabled?: boolean;
				};
				if (requestBody.modelId && typeof requestBody.modelId === "string") {
					selectedModelId = requestBody.modelId as ModelId;
				}

				// Extract webSearchEnabled preference
				if (typeof requestBody.webSearchEnabled === "boolean") {
					webSearchEnabled = requestBody.webSearchEnabled;
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

			// For authenticated users, check billing-based model access and message limits
			let userPlan: ClerkPlanKey = ClerkPlanKey.FREE_TIER; // Default for anonymous users
			if (!isAnonymous) {
				try {
					// Get user's billing plan
					userPlan = await getUserPlan();
					const planLimits = BILLING_LIMITS[userPlan];
					
					// Check model access based on user's plan
					if (!planLimits.allowedModels.length || planLimits.allowedModels.includes(selectedModelId)) {
						// User has access - either all models allowed (empty array) or specific model is in allowed list
						console.log(`[Billing] Model access granted for ${userPlan} user: ${selectedModelId}`);
					} else {
						// User doesn't have access to this model
						console.warn(`[Billing] Model access denied for ${userPlan} user: ${selectedModelId}`, {
							allowedModels: planLimits.allowedModels
						});
						return new Response(
							JSON.stringify({
								error: "Model not allowed",
								message: `Model ${selectedModelId} requires upgrade to Plus plan`,
								code: "MODEL_NOT_ALLOWED",
								details: { modelId: selectedModelId, userPlan, allowedModels: planLimits.allowedModels }
							}),
							{
								status: 403, // Forbidden
								headers: {
									"Content-Type": "application/json",
								},
							}
						);
					}
					
					// Check web search access based on user's plan
					if (webSearchEnabled && !planLimits.hasWebSearch) {
						console.warn(`[Billing] Web search access denied for ${userPlan} user`);
						return new Response(
							JSON.stringify({
								error: "Feature not allowed",
								message: "Web search requires upgrade to Plus plan",
								code: "FEATURE_NOT_ALLOWED",
								details: { feature: "webSearch", userPlan }
							}),
							{
								status: 403, // Forbidden
								headers: {
									"Content-Type": "application/json",
								},
							}
						);
					}
					
					// Check message usage limits using TRPC
					await requireMessageAccess(selectedModelId);
					
					console.log(`[Billing] User ${authenticatedUserId} (${userPlan}) passed all billing checks for model: ${selectedModelId}`, {
						webSearchEnabled,
						modelId: selectedModelId,
						hasWebSearchAccess: planLimits.hasWebSearch
					});

				} catch (error) {
					if (error instanceof UsageLimitExceededError) {
						console.warn(
							`[Billing] Usage limit exceeded for user ${authenticatedUserId}:`,
							error.details
						);
						return new Response(
							JSON.stringify({
								error: "Usage limit exceeded",
								message: error.message,
								code: error.code,
								details: error.details
							}),
							{
								status: 402, // Payment Required
								headers: {
									"Content-Type": "application/json",
								},
							}
						);
					} else {
						console.error(
							`[Billing] Unexpected error checking billing for user ${authenticatedUserId}:`,
							error
						);
						return new Response(
							JSON.stringify({
								error: "Internal server error",
								message: "Failed to check billing access",
								code: "INTERNAL_ERROR"
							}),
							{
								status: 500, // Internal Server Error
								headers: {
									"Content-Type": "application/json",
								},
							}
						);
					}
				}
			}

			// For Vercel AI Gateway, use the model name directly
			// Gateway handles provider routing automatically
			const gatewayModelString = modelConfig.name;

			// Log model selection for debugging
			console.log(
				`[Chat API] Using model: ${selectedModelId} -> ${gatewayModelString} (delay: ${streamingDelay}ms)`,
			);

			// Create conditional active tools and system prompt based on authentication and preferences
			const activeToolsForUser = getActiveToolsForUser(isAnonymous, userPlan, webSearchEnabled);
			const systemPrompt = createSystemPromptForUser(isAnonymous);

			// Log active tools for debugging
			console.log(`[Chat API] Active tools for ${isAnonymous ? 'anonymous' : 'authenticated'} user:`, {
				activeTools: activeToolsForUser ?? 'all tools',
				webSearchEnabled,
				isAnonymous,
				userPlan: isAnonymous ? 'N/A' : userPlan
			});

			// Pass everything to fetchRequestHandler with inline agent
			const response = await fetchRequestHandler({
				agent: createAgent<AppRuntimeContext, typeof c010Tools>({
					name: "c010",
					system: systemPrompt,
					tools: c010Tools,
					activeTools: activeToolsForUser,
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
					experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
						// Don't attempt to fix invalid tool names
						if (NoSuchToolError.isInstance(error)) {
							return null;
						}

						const tool = tools[toolCall.toolName];
						if (!tool) return null;

						try {
							const result = await generateObject({
								model: gateway('google/gemini-2.5-flash'),
								schema: tool.inputSchema,
								prompt: [
									`The model tried to call the tool "${toolCall.toolName}" with the following inputs:`,
									JSON.stringify(toolCall.input),
									`The tool accepts the following schema:`,
									JSON.stringify(inputSchema(toolCall)),
									'Please fix the inputs to match the schema exactly. Preserve the original intent while ensuring all parameters are valid.',
								].join('\n'),
							});

							console.log(`[Tool Repair] Successfully repaired: ${toolCall.toolName}`);
							return { ...toolCall, input: JSON.stringify(result.object) };
						} catch {
							return null;
						}
					},
					experimental_telemetry: {
						isEnabled: isOtelEnabled(),
						functionId: "chat-inference",
						metadata: {
							context: "production",
							inferenceType: "chat-conversation",
							agentId,
							agentName: "c010",
							sessionId,
							userId,
							modelId: selectedModelId,
							modelProvider: modelConfig.provider,
							isAnonymous,
							webSearchEnabled,
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

					// Track message usage for authenticated users
					if (!isAnonymous) {
						trackMessageSent(selectedModelId)
							.then(() => {
								console.log(`[Billing] Usage tracked for user ${authenticatedUserId}:`, {
									modelId: selectedModelId
								});
							})
							.catch((error) => {
								console.error(`[Billing] Failed to track usage for user ${authenticatedUserId}:`, error);
							});
					}

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
