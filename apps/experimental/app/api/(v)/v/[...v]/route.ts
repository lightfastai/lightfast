import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { createAgent } from "@lightfast/ai/agent";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import { BraintrustMiddleware, currentSpan, initLogger, traced } from "braintrust";
import { A011_SYSTEM_PROMPT } from "@/app/ai/agents/a011";
import {
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileTool,
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
	file: fileTool,
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

	// Extract agentId and threadId early for span naming
	const [agentId, threadId] = v || [];

	// Wrap the entire handler logic with traced
	return traced(
		async (span) => {
			// Handle authentication
			const { userId } = await auth();
			if (!userId) {
				return Response.json({ error: "Unauthorized" }, { status: 401 });
			}

			if (!agentId || !threadId) {
				return Response.json({ error: "Invalid path. Expected /api/v/[agentId]/[threadId]" }, { status: 400 });
			}

			// Define agent based on agentId
			// For now, we only have a011
			if (agentId !== "a011") {
				return Response.json({ error: "Agent not found" }, { status: 404 });
			}


			// Wrap the model with Braintrust middleware
			const model = wrapLanguageModel({
				model: gateway("anthropic/claude-4-sonnet"),
				middleware: BraintrustMiddleware({ debug: true }),
			});

			const agent = createAgent<A011ToolSchema, AppRuntimeContext>({
				name: "a011",
				system: A011_SYSTEM_PROMPT,
				tools: a011Tools, // Pass the tools directly
				createRuntimeContext: ({ threadId, resourceId }): AppRuntimeContext => ({
					// Create agent-specific context
					// The agent can use threadId and resourceId if needed
					// but they're already available in system context
				}),
				model,
				experimental_transform: smoothStream({
					delayInMs: 25,
					chunking: "word",
				}),
				stopWhen: stepCountIs(30),
				experimental_telemetry: {
					isEnabled: !!env.OTEL_EXPORTER_OTLP_HEADERS, // Only enable if OTEL headers are configured
					metadata: {
						agentId,
						agentName: "a011",
						threadId,
						userId,
					},
				},
				// Optional: Add agent-specific callbacks with strong typing
				onChunk: ({ chunk }) => {
					if (chunk.type === "tool-call") {
						// TypeScript should now know the exact tool names from a011Tools
						console.log("Tool called:", chunk.toolName);

						// Test strong typing - these should work with our actual tools
						if (chunk.toolName === "file") {
							console.log("File tool called");
						} else if (chunk.toolName === "webSearch") {
							console.log("Web search called");
						} else if (chunk.toolName === "todoWrite") {
							console.log("Todo write tool called");
						} else if (chunk.toolName === "fileRead") {
							console.log("File read tool called");
						} else if (chunk.toolName === "todoRead") {
							console.log("Todo read tool called");
						} else if (chunk.toolName === "createSandbox") {
							console.log("Creating sandbox");
						} else if (chunk.toolName === "executeSandboxCommand") {
							console.log("Executing sandbox command");
						}

						// TypeScript correctly prevents invalid tool names:
						// if (chunk.toolName === "nonExistentTool") { // ❌ Error: This comparison appears to be unintentional
						// 	console.log("This should error!");
						// }
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
						},
					});

					// Keep existing console logging
					console.log("a011 finished:", {
						finishReason: result.finishReason,
						usage: result.usage,
						textLength: result.text?.length,
					});
				},
			});

			// Create Redis memory instance
			const memory = new RedisMemory({
				url: env.KV_REST_API_URL,
				token: env.KV_REST_API_TOKEN,
			});


			// Pass everything to fetchRequestHandler
			const response = await fetchRequestHandler({
				agent,
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
		{ type: "function", name: `${req.method} /api/v/${agentId}/${threadId}` },
	);
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };
