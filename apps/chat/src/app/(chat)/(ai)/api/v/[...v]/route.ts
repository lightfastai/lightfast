import { createAgent } from "@lightfast/core/agent";
import { fetchRequestHandler } from "@lightfast/core/agent/handlers";
import { smoothStream, wrapLanguageModel } from "ai";
import { BraintrustMiddleware, currentSpan, initLogger } from "braintrust";
import { getBraintrustConfig, isOtelEnabled } from "@lightfast/core/v2/braintrust-env";
import { uuidv4 } from "@lightfast/core/v2/utils";
import { webSearchTool } from "~/ai/tools/web-search";
import type { AppRuntimeContext } from "~/ai/types";
import { env } from "~/env";
import { auth } from "@clerk/nextjs/server";
import { anthropic } from "@ai-sdk/anthropic";

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
const handler = async (req: Request, { params }: { params: Promise<{ v: string[] }> }) => {
	// Await the params
	const { v } = await params;

	// Extract agentId and threadId
	const [agentId, threadId] = v || [];

	// For now, we're not requiring authentication
	// You can enable this later when auth is set up
	// const { userId } = await auth();
	// if (!userId) {
	//   return Response.json({ error: "Unauthorized" }, { status: 401 });
	// }
	const userId = "anonymous"; // Temporary for development

	// Validate params
	if (!agentId || !threadId) {
		return Response.json({ error: "Invalid path. Expected /api/v/[agentId]/[threadId]" }, { status: 400 });
	}

	// Validate agent exists
	if (agentId !== "c010") {
		return Response.json({ error: "Agent not found" }, { status: 404 });
	}

	// Define the handler function that will be used for both GET and POST
	const executeHandler = async () => {
		// Pass everything to fetchRequestHandler with inline agent
		const response = await fetchRequestHandler({
			agent: createAgent<C010ToolSchema, AppRuntimeContext>({
				name: "c010",
				system: `You are a helpful AI assistant with access to web search capabilities.
You can help users find information, answer questions, and provide insights based on current web data.
When searching, be thoughtful about your queries and provide comprehensive, well-sourced answers.`,
				tools: c010Tools,
				createRuntimeContext: ({ threadId, resourceId }): AppRuntimeContext => ({
					userId,
					agentId,
				}),
				model: wrapLanguageModel({
					model: anthropic("claude-3-5-sonnet-20241022"),
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
						threadId,
						userId,
					},
				},
				onChunk: ({ chunk }) => {
					if (chunk.type === "tool-call") {
						if (chunk.toolName === "webSearch") {
							// Web search called - you can add logging here if needed
							console.log("Web search tool called");
						}
					}
				},
				onFinish: (result) => {
					// Log to Braintrust for POST requests
					if (req.method === "POST") {
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
							},
						});
					}
				},
			}),
			threadId,
			memory: null, // No memory/persistence for now
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

		return response;
	};

	// For now, just execute without tracing wrapper
	// You can add Braintrust tracing later if needed
	return executeHandler();
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };