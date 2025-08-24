/**
 * V2 Unified Agent Worker Route
 * Handles all worker events through a single endpoint
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import type { RuntimeContext } from "lightfast/server/adapters/types";
import { Agent } from "lightfast/v2/core";
import { fetchRequestHandler } from "lightfast/v2/server";
import { smoothStream, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import type { NextRequest } from "next/server";
import { A011_SYSTEM_PROMPT } from "@/app/(v1)/ai/agents/a011";
import {
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileWriteTool,
} from "@/app/(v1)/ai/tools/file";
import {
	createSandboxTool,
	createSandboxWithPortsTool,
	executeSandboxCommandTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
} from "@/app/(v1)/ai/tools/sandbox";
import { todoClearTool, todoReadTool, todoWriteTool } from "@/app/(v1)/ai/tools/task";
import { webSearchTool } from "@/app/(v1)/ai/tools/web-search";
import type { AppRuntimeContext } from "@/app/(v1)/ai/types";
import { baseUrl as configBaseUrl, qstash, redis } from "@/app/(v2)/ai/config";
import { loggerFactory } from "@/lib/logger";

// Create tools object for v2 agent
const v2Tools = {
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

// Create the v2 test agent with the new Agent class
const v2TestAgent = new Agent<RuntimeContext<AppRuntimeContext>>(
	{
		name: "a011",
		systemPrompt: A011_SYSTEM_PROMPT,
		// Use actual v1 tool factories
		tools: v2Tools,
		// Create runtime context from session
		createRuntimeContext: ({ sessionId, userId }) => ({
			sessionId: sessionId,
			resourceId: userId || "anonymous",
			// App-specific context would be added here
		}),
		// Use the same model configuration as v1
		model: wrapLanguageModel({
			model: gateway("anthropic/claude-4-sonnet"),
			middleware: BraintrustMiddleware({ debug: true }),
		}),
		temperature: 0.7,
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
	},
	redis,
);

// Handler function - handles auth and passes resourceId
const handler = async (req: NextRequest, { params }: { params: Promise<{ v: string[] }> }) => {
	// Check if this is a worker route (called by QStash)
	const { v } = await params;
	const isWorkerRoute = v?.[0] === "workers";

	// Skip auth for worker routes (they use QStash signature verification instead)
	let resourceId = "";
	if (!isWorkerRoute) {
		// Handle authentication for user routes
		const { userId } = await auth();
		if (!userId) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}
		resourceId = userId;
	}

	// Create the handler with resourceId (empty for worker routes)
	const handlerFn = fetchRequestHandler({
		agent: v2TestAgent,
		redis,
		qstash,
		baseUrl: `${configBaseUrl}/api/v2`, // Use full URL for QStash
		resourceId,
		loggerFactory,
	});

	// Pass request to handler
	return handlerFn(req);
};

// Export the handler for both GET and POST requests
export { handler as GET, handler as POST };
