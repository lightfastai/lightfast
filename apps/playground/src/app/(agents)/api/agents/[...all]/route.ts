import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { auth } from "@clerk/nextjs/server";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { RedisMemory } from "lightfast/memory/adapters/redis";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { uuidv4 } from "lightfast/v2/utils";
import {
	BraintrustMiddleware,
	currentSpan,
	initLogger,
	traced,
} from "braintrust";
import {
	getBraintrustConfig,
	isOtelEnabled,
} from "lightfast/v2/braintrust-env";
import { AgentId } from "~/app/(agents)/types";
import {
	BROWSER_010_SYSTEM_PROMPT,
	browser010Tools,
	
	cleanup as cleanupBrowser
} from "~/app/(agents)/browser";
import type {Browser010ToolSchema} from "~/app/(agents)/browser";
import { redis } from "~/vendor/upstash";
import { env } from "~/env";
import type { AppRuntimeContext } from "~/app/(agents)/shared-types";

// Initialize Braintrust logging
const braintrustConfig = getBraintrustConfig();
initLogger({
	apiKey: braintrustConfig.apiKey,
	projectName: braintrustConfig.projectName,
});

// Create memory instance
const memory = new RedisMemory({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (
	req: Request,
	{ params }: { params: Promise<{ all: string[] }> },
) => {
	// Await the params
	const { all } = await params;

	// Extract agentId and sessionId early
	const [agentId, sessionId] = all || [];

	// Handle authentication before processing
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Validate params
	if (!agentId || !sessionId) {
		return Response.json(
			{ error: "Invalid path. Expected /api/agents/[agentId]/[sessionId]" },
			{ status: 400 },
		);
	}

	// Validate agent exists
	if (!Object.values(AgentId).includes(agentId as AgentId)) {
		return Response.json({ error: "Agent not found" }, { status: 404 });
	}

	// Note: Session ownership validation is handled by the runtime's streamChat function
	// which checks that sessionData.resourceId === userId (passed as resourceId below)

	// Define the handler function that will be used for both GET and POST
	const executeHandler = async () => {
		try {
			// Route to appropriate agent
			switch (agentId) {
				case AgentId.BROWSER_010: {
					const response = await fetchRequestHandler({
						agent: createAgent<Browser010ToolSchema, AppRuntimeContext>({
							name: "browser_010",
							system: BROWSER_010_SYSTEM_PROMPT,
							tools: browser010Tools,
							createRuntimeContext: ({
								sessionId,
								resourceId,
							}): AppRuntimeContext => ({
								sessionId,
								resourceId,
							}),
							model: wrapLanguageModel({
								model: gateway("anthropic/claude-4-sonnet"),
								middleware: BraintrustMiddleware({ debug: true }),
							}),
							providerOptions: {
								anthropic: {
									// Enable Claude Code thinking
									thinking: {
										type: "enabled",
										budgetTokens: 32000, // Generous budget for complex reasoning
									},
								} satisfies AnthropicProviderOptions,
							},
							experimental_transform: smoothStream({
								delayInMs: 25,
								chunking: "word",
							}),
							stopWhen: stepCountIs(30),
							experimental_telemetry: {
								isEnabled: isOtelEnabled(),
								metadata: {
									agentId,
									agentName: "browser_010",
									sessionId,
									userId,
								},
							},
							onChunk: ({ chunk }) => {
								if (chunk.type === "tool-call") {
									if (chunk.toolName === "stagehandNavigate") {
										console.log("Navigating to URL...");
									} else if (chunk.toolName === "stagehandAct") {
										console.log("Performing browser action...");
									} else if (chunk.toolName === "stagehandExtract") {
										console.log("Extracting data...");
									} else if (chunk.toolName === "stagehandObserve") {
										console.log("Observing page elements...");
									} else if (chunk.toolName === "stagehandScreenshot") {
										console.log("Taking screenshot...");
									}
								}
							},
							onFinish: async (result) => {
								// Only log to Braintrust if we're in a traced context
								if (req.method === "POST") {
									currentSpan().log({
										input: {
											agentId,
											sessionId,
											userId,
										},
										output: result.response?.messages || result.text,
										metadata: {
											finishReason: result.finishReason,
											usage: result.usage,
											// Include thinking metadata if available
											reasoningText: result.reasoningText,
											providerOptions: result.providerOptions,
										},
									});
								}
								console.log("Agent completed", {
									agentId,
									finishReason: result.finishReason,
									usage: result.usage,
								});
							},
							onError: async ({ error }) => {
								console.error(`Agent error [${agentId}]:`, error);
							},
						}),
						sessionId,
						memory,
						req,
						resourceId: userId,
						createRequestContext: (req) => ({
							userAgent: req.headers.get("user-agent") || undefined,
							ipAddress:
								req.headers.get("x-forwarded-for") ||
								req.headers.get("x-real-ip") ||
								undefined,
						}),
						generateId: uuidv4,
						enableResume: true,
						onError({ error }) {
							console.error(`>>> Agent Error [${agentId}]`, error);
						},
					});

					return response;
				}

				default:
					return Response.json({ error: "Agent not found" }, { status: 404 });
			}
		} catch (error) {
			// Ensure cleanup on any error
			if (agentId === AgentId.BROWSER_010) {
				await cleanupBrowser();
			}

			console.error("Handler error:", error);
			return Response.json(
				{
					error: "Internal server error",
					message: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 500 },
			);
		}
	};

	// Only wrap with traced for POST requests
	if (req.method === "POST") {
		return traced(executeHandler, {
			type: "function",
			name: `POST /api/agents/${agentId}/${sessionId}`,
		});
	}

	// GET requests run without traced wrapper
	return executeHandler();
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };

