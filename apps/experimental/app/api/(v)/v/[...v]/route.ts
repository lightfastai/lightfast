import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { Agent } from "@lightfast/ai/agent";
import { fetchRequestHandler } from "@lightfast/ai/agent/handlers";
import { RedisMemory } from "@lightfast/ai/agent/memory/adapters/redis";
import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
import { smoothStream, stepCountIs } from "ai";
import { A011_SYSTEM_PROMPT } from "@/app/ai/agents/a011";
import {
	createSandboxTool,
	createSandboxWithPortsTool,
	executeSandboxCommandTool,
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
	todoClearTool,
	todoReadTool,
	todoWriteTool,
	webSearchTool,
} from "@/app/ai/tools";
import type { AppRuntimeContext } from "@/app/ai/types";
import { env } from "@/env";
import { uuidv4 } from "@/lib/uuidv4";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

// Create Redis memory instance
const memory = new RedisMemory<LightfastUIMessage>({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

// Handler function that handles auth and calls fetchRequestHandler
const handler = async (req: Request) => {
	// Handle authentication
	const { userId } = await auth();
	if (!userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Pass everything to fetchRequestHandler
	return fetchRequestHandler({
		agents: [
			new Agent<LightfastUIMessage, RuntimeContext<AppRuntimeContext>>({
				name: "a011",
				system: A011_SYSTEM_PROMPT,
				tools: {
					// File operations
					file: fileTool,
					fileRead: fileReadTool,
					fileDelete: fileDeleteTool,
					fileStringReplace: fileStringReplaceTool,
					fileFindInContent: fileFindInContentTool,
					fileFindByName: fileFindByNameTool,

					// Web search
					webSearch: webSearchTool,

					// Sandbox operations
					createSandbox: createSandboxTool,
					executeSandboxCommand: executeSandboxCommandTool,
					createSandboxWithPorts: createSandboxWithPortsTool,
					getSandboxDomain: getSandboxDomainTool,
					listSandboxRoutes: listSandboxRoutesTool,

					// Task management
					todoWrite: todoWriteTool,
					todoRead: todoReadTool,
					todoClear: todoClearTool,
				},
				model: gateway("anthropic/claude-4-sonnet"),
				experimental_transform: smoothStream({
					delayInMs: 25,
					chunking: "word",
				}),
				stopWhen: stepCountIs(30),
				// Optional: Add agent-specific callbacks with strong typing
				onChunk: ({ chunk }) => {
					if (chunk.type === "tool-call") {
						// TypeScript knows the exact tool names
						console.log("Tool called:", chunk.toolName);

						// All valid tools work
						if (chunk.toolName === "file") {
							console.log("File tool called");
						} else if (chunk.toolName === "webSearch") {
							console.log("Web search called");
						}
						// Note: If you uncomment the line below with a non-existent tool,
						// TypeScript may not catch it due to how Vercel AI SDK types work
						// if (chunk.toolName === "nonExistentTool") {}
					}
				},
				onFinish: ({ finishReason, usage }) => {
					console.log("a011 finished:", { finishReason, usage });
				},
			}),
		] as const,
		memory,
		req,
		resourceId: userId,
		createRuntimeContext: ({ threadId, resourceId }) => {
			// Return user-defined context fields
			// The system will automatically add threadId and resourceId
			const userContext: AppRuntimeContext = {
				// Add any custom fields here
			};
			return userContext;
		},
		generateId: uuidv4,
		enableResume: true,
		onError({ error, path }) {
			console.error(`>>> Agent Error on '${path}'`, error);
		},
	});
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };
