import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { createAgent } from "@lightfast/ai/agent";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import { AnthropicProviderCache, ClineConversationStrategy } from "@lightfast/ai/agent/primitives/cache";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import { BraintrustMiddleware, currentSpan, initLogger, traced } from "braintrust";
import { A011_SYSTEM_PROMPT } from "@/app/ai/agents/a011";
import {
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileWriteTool,
} from "@/app/ai/tools/file";
import {
	createSandboxTool,
	createSandboxWithPortsTool,
	executeSandboxCommandTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
} from "@/app/ai/tools/sandbox";
import { todoClearTool, todoReadTool, todoWriteTool } from "@/app/ai/tools/task";
import { webSearchTool } from "@/app/ai/tools/web-search";
import type { AppRuntimeContext } from "@/app/ai/types";
import { env } from "@/env";
import { uuidv4 } from "@/lib/uuidv4";

// Create tools object for agent
const a011Tools = {
	// File tools
	fileWrite: fileWriteTool,
	fileRead: fileReadTool,
	fileDelete: fileDeleteTool,
	fileStringReplace: fileStringReplaceTool,
	fileFindInContent: fileFindInContentTool,
	fileFindByName: fileFindByNameTool,
	// Web search
	webSearch: webSearchTool,
	// Todo tools
	todoWrite: todoWriteTool,
	todoRead: todoReadTool,
	todoClear: todoClearTool,
	// Sandbox tools
	createSandbox: createSandboxTool,
	executeSandboxCommand: executeSandboxCommandTool,
	createSandboxWithPorts: createSandboxWithPortsTool,
	getSandboxDomain: getSandboxDomainTool,
	listSandboxRoutes: listSandboxRoutesTool,
} as const;

// Infer the tool schema type
type A011ToolSchema = typeof a011Tools;

// Initialize Braintrust logging
initLogger({
	apiKey: env.BRAINTRUST_API_KEY,
	projectName: env.BRAINTRUST_PROJECT_NAME,
});

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (req: Request, { params }: { params: Promise<{ v: string[] }> }) => {
	// Await the params
	const { v } = await params;

	// Extract agentId and threadId early
	const [agentId, threadId] = v || [];

	// Handle authentication before tracing
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Validate params before tracing
	if (!agentId || !threadId) {
		return Response.json({ error: "Invalid path. Expected /api/v/[agentId]/[threadId]" }, { status: 400 });
	}

	// Validate agent exists before tracing
	if (agentId !== "a011") {
		return Response.json({ error: "Agent not found" }, { status: 404 });
	}

	// Skip tracing for GET requests (reusable stream endpoint)
	if (req.method === "GET") {
		// Direct handler without Braintrust tracing
		const memory = new RedisMemory({
			url: env.KV_REST_API_URL,
			token: env.KV_REST_API_TOKEN,
		});

		return fetchRequestHandler({
			agent: createAgent<A011ToolSchema, AppRuntimeContext>({
				name: "a011",
				system: A011_SYSTEM_PROMPT,
				tools: a011Tools,
				cache: new AnthropicProviderCache({
					strategy: new ClineConversationStrategy({
						cacheSystemPrompt: true,
						recentUserMessagesToCache: 2,
					}),
				}),
				createRuntimeContext: ({ threadId, resourceId }): AppRuntimeContext => ({}),
				model: gateway("anthropic/claude-4-sonnet"),
				providerOptions: {
					anthropic: {
						thinking: {
							type: "enabled",
							budgetTokens: 32000,
						},
					} satisfies AnthropicProviderOptions,
				},
				headers: {
					"anthropic-beta": "interleaved-thinking-2025-05-14,token-efficient-tools-2025-02-19",
				},
				experimental_transform: smoothStream({
					delayInMs: 25,
					chunking: "word",
				}),
				stopWhen: stepCountIs(30),
				experimental_telemetry: {
					isEnabled: !!env.OTEL_EXPORTER_OTLP_HEADERS,
					metadata: {
						agentId,
						agentName: "a011",
						threadId,
						userId,
					},
				},
			}),
			threadId,
			memory,
			req,
			resourceId: userId,
			createRequestContext: (req) => ({
				userAgent: req.headers.get("user-agent") || undefined,
				ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
			}),
			generateId: uuidv4,
			enableResume: true,
			onError({ error }) {
				console.error(`>>> Agent Error`, error);
			},
		});
	}

	// Wrap only POST requests with traced
	return traced(
		async (span) => {
			// Create Redis memory instance
			const memory = new RedisMemory({
				url: env.KV_REST_API_URL,
				token: env.KV_REST_API_TOKEN,
			});

			// Pass everything to fetchRequestHandler with inline agent
			const response = await fetchRequestHandler({
				agent: createAgent<A011ToolSchema, AppRuntimeContext>({
					name: "a011",
					system: A011_SYSTEM_PROMPT,
					tools: a011Tools,
					// 🔍 CLINE-INSPIRED CACHING STRATEGY:
					// Using Cline AI assistant's proven approach for Anthropic cache breakpoints:
					// 1. Always cache system prompt (biggest efficiency gain, works with thinking)
					// 2. Cache last 2 user messages only (strategic conversation breakpoints)
					// 3. Up to 4 breakpoints total (within Anthropic's limits)
					//
					// This strategy is confirmed to work with thinking models!
					cache: new AnthropicProviderCache({
						strategy: new ClineConversationStrategy({
							cacheSystemPrompt: true,
							recentUserMessagesToCache: 2,
						}),
					}),
					createRuntimeContext: ({ threadId, resourceId }): AppRuntimeContext => ({
						// Create agent-specific context
						// The agent can use threadId and resourceId if needed
						// but they're already available in system context
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
					headers: {
						// Note: token-efficient-tools-2025-02-19 is only available for Claude 3.7 Sonnet
						// It reduces token usage by ~14% average (up to 70%) and improves latency
						"anthropic-beta": "interleaved-thinking-2025-05-14,token-efficient-tools-2025-02-19",
					},
					experimental_transform: smoothStream({
						delayInMs: 25,
						chunking: "word",
					}),
					stopWhen: stepCountIs(30),
					experimental_telemetry: {
						isEnabled: !!env.OTEL_EXPORTER_OTLP_HEADERS,
						metadata: {
							agentId,
							agentName: "a011",
							threadId,
							userId,
						},
					},
					onChunk: ({ chunk }) => {
						if (chunk.type === "tool-call") {
							// Test strong typing - these should work with our actual tools
							if (chunk.toolName === "fileWrite") {
								// File write tool called
							} else if (chunk.toolName === "webSearch") {
								// Web search called
							} else if (chunk.toolName === "todoWrite") {
								// Todo write tool called
							} else if (chunk.toolName === "fileRead") {
								// File read tool called
							} else if (chunk.toolName === "todoRead") {
								// Todo read tool called
							} else if (chunk.toolName === "createSandbox") {
								// Creating sandbox
							} else if (chunk.toolName === "executeSandboxCommand") {
								// Executing sandbox command
							}
						}
					},
					onFinish: (result) => {
						// Log to Braintrust span with full output
						currentSpan().log({
							input: {
								agentId,
								threadId,
								userId,
							},
							output: result.response?.messages || result.text,
							metadata: {
								finishReason: result.finishReason,
								usage: result.usage,
								// Include thinking metadata if available
								reasoning: result.reasoning,
								reasoningText: result.reasoningText,
								providerMetadata: result.providerMetadata,
							},
						});
					},
				}),
				threadId,
				memory,
				req,
				resourceId: userId,
				createRequestContext: (req) => ({
					// Create request-level context from HTTP request
					userAgent: req.headers.get("user-agent") || undefined,
					ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
				}),
				generateId: uuidv4,
				enableResume: true,
				onError({ error }) {
					console.error(`>>> Agent Error`, error);
				},
			});

			return response;
		},
		// Metadata for the span
		{ type: "function", name: `POST /api/v/${agentId}/${threadId}` },
	);
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };
