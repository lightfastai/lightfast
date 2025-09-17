import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import type { ModelId } from "~/ai/providers";
import {
	getModelConfig,
	getModelStreamingDelay,
	getDefaultModelForUser,
	MODELS,
} from "~/ai/providers";
import { BraintrustMiddleware, initLogger, traced } from "braintrust";
import {
	getBraintrustConfig,
	isOtelEnabled,
} from "lightfast/v2/braintrust-env";
import { uuidv4 } from "lightfast/v2/utils";
import type { AppRuntimeContext } from "~/ai/lightfast-app-chat-ui-messages";
import { auth } from "@clerk/nextjs/server";
import { createPlanetScaleMemory, AnonymousRedisMemory } from "~/ai/runtime/memory";
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
import { 
	UsageLimitExceededError
} from "~/services/usage.service";
import {
	reserveQuota,
	releaseQuotaReservation,
	QuotaReservationError
} from "~/services/quota-reservation.service";
import { 
	ClerkPlanKey, 
	BILLING_LIMITS
} from "~/lib/billing/types";

// Import shared utilities
import { c010Tools } from "./_lib/tools";
import { getUserPlan, getActiveToolsForUser, createSystemPromptForUser } from "./_lib/user-utils";



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
		// Quota reservation tracking for proper cleanup on errors
		let quotaReservation: { reservationId: string } | null = null;
		try {
			// Create memory instance based on authentication status (needed for both GET and POST)
			let memory;
			try {
				memory = isAnonymous
					? new AnonymousRedisMemory({
							url: env.KV_REST_API_URL,
							token: env.KV_REST_API_TOKEN,
						})
					: createPlanetScaleMemory();
			} catch (error) {
				console.error(`[API] Failed to create memory instance:`, error);
				return ApiErrors.memoryInitFailed({ requestId, isAnonymous });
			}

			// Extract request parameters - defaults for GET (resume) requests
			const isResume = req.method === "GET";
			console.log(`[Chat API] ${isResume ? 'GET request for stream resume' : 'POST request for new message'}`, {
				sessionId,
				agentId,
				userId,
				isAnonymous,
			});

			// Request parsing and defaults
			let selectedModelId: ModelId = isResume ? getDefaultModelForUser(!isAnonymous) : "google/gemini-2.5-flash";
			let lastUserMessage = "";
			let webSearchEnabled = isResume ? true : false; // Default webSearch enabled for resume

			// Only parse request body for POST requests
			if (!isResume) {
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
			}

			// Development-only: Check for test error commands (POST only)
			if (!isResume && isTestErrorCommand(lastUserMessage)) {
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
					
					// Check model access based on user's plan (skip for resume requests)
					if (!isResume && !planLimits.allowedModels.includes(selectedModelId)) {
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
					
					// Check web search access based on user's plan (skip for resume requests)
					if (!isResume && webSearchEnabled && !planLimits.hasWebSearch) {
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
					
					// Reserve quota atomically (POST requests only)
					if (!isResume) {
						if (!authenticatedUserId) {
							throw new Error("User ID required for quota reservation");
						}
						quotaReservation = await reserveQuota(
							authenticatedUserId,
							selectedModelId,
							messageId
						);
					}
					
					console.log(`[Billing] User ${authenticatedUserId} (${userPlan}) passed billing checks for model: ${selectedModelId}`, {
						webSearchEnabled,
						modelId: selectedModelId,
						hasWebSearchAccess: planLimits.hasWebSearch,
						isResume
					});

				} catch (error) {
					if (error instanceof UsageLimitExceededError || error instanceof QuotaReservationError) {
						console.warn(
							`[Billing] Usage limit exceeded for user ${authenticatedUserId}:`,
							error instanceof QuotaReservationError ? error.details : error.details
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
				`[Chat API] Using model: ${selectedModelId} -> ${gatewayModelString} (delay: ${streamingDelay}ms, isResume: ${isResume})`,
			);

			// Create conditional active tools and system prompt based on authentication and preferences
			const activeToolsForUser = getActiveToolsForUser(isAnonymous, userPlan, webSearchEnabled);
			const systemPrompt = createSystemPromptForUser(isAnonymous);

			// Log active tools for debugging
			console.log(`[Chat API] Active tools for ${isAnonymous ? 'anonymous' : 'authenticated'} user:`, {
				activeTools: activeToolsForUser ?? 'all tools',
				webSearchEnabled,
				isAnonymous,
				userPlan: isAnonymous ? 'N/A' : userPlan,
				isResume
			});

			// Create agent configuration - unified for both GET and POST
			const agentConfig: Parameters<typeof createAgent<AppRuntimeContext, typeof c010Tools>>[0] = {
				name: "c010",
				system: systemPrompt,
				tools: c010Tools,
				activeTools: activeToolsForUser,
				createRuntimeContext: ({ sessionId: _sessionId, resourceId: _resourceId }): AppRuntimeContext => ({
					userId,
					agentId,
					messageId,
				}),
				model: wrapLanguageModel({
					model: gateway(gatewayModelString),
					middleware: BraintrustMiddleware({ debug: true }),
				}),
				experimental_telemetry: {
					isEnabled: isOtelEnabled(),
					functionId: isResume ? "chat-resume" : "chat-inference",
					metadata: {
						context: "production",
						inferenceType: isResume ? "chat-resume" : "chat-conversation",
						agentId,
						agentName: "c010",
						sessionId,
						userId,
						modelId: selectedModelId,
						modelProvider: modelConfig.provider,
						isAnonymous,
						webSearchEnabled,
						...(isResume && { resumeOperation: true }),
					},
				},
			};

			// Add POST-specific features for non-resume requests
			if (!isResume) {
				Object.assign(agentConfig, {
					experimental_transform: smoothStream({
						delayInMs: streamingDelay,
						chunking: "word",
					}),
					stopWhen: stepCountIs(10),
				});
			}

			// Single unified fetchRequestHandler call
			const response = await fetchRequestHandler({
				agent: createAgent<AppRuntimeContext, typeof c010Tools>(agentConfig),
				sessionId,
				memory,
				req,
				resourceId: userId,
				context: {
					modelId: selectedModelId,
					isAnonymous,
				},
				createRequestContext: (requestArg) => ({
					userAgent: requestArg.headers.get("user-agent") ?? undefined,
					ipAddress:
						requestArg.headers.get("x-forwarded-for") ??
						requestArg.headers.get("x-real-ip") ??
						undefined,
				}),
				generateId: () => messageId,
				enableResume: true,
				onError(event) {
					const { error, systemContext, requestContext } = event;
					const logPrefix = isResume ? '[API Error - Resume]' : '[API Error]';
					console.error(
						`${logPrefix} Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}, Code: ${error.statusCode}`,
						{
							error: error.message || JSON.stringify(error),
							statusCode: error.statusCode,
							errorCode: error.statusCode,
							stack: error.stack,
							agentId,
							sessionId: systemContext.sessionId,
							userId: systemContext.resourceId,
							method: req.method,
							url: req.url,
							requestContext,
							isResume,
						},
					);

					// Release quota reservation if message processing fails (POST only)
					if (!isResume && !isAnonymous && quotaReservation) {
						const reservationId = quotaReservation.reservationId;
						releaseQuotaReservation(reservationId)
							.then(() => {
								console.log(`[Billing] Quota reservation released due to error for user ${authenticatedUserId}:`, {
									reservationId,
									errorCode: error.statusCode
								});
							})
							.catch((releaseError) => {
								console.error(`[Billing] Failed to release quota reservation for user ${authenticatedUserId}:`, releaseError);
								// This leaves reserved quota stuck - cleanup job will handle it
							});
					}

					// Handle specific error types
					if (error.statusCode === 500) {
						console.error(
							`[Memory Error] Failed for user ${systemContext.resourceId}`,
							{
								sessionId: systemContext.sessionId,
								agentId,
								errorType: error.statusCode,
								errorMessage: error.message || JSON.stringify(error),
								isResume,
							},
						);
					}
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
