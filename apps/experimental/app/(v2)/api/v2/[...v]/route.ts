/**
 * V2 Unified Agent Worker Route
 * Handles all worker events through a single endpoint
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
import { Agent } from "@lightfast/ai/v2/core";
import { fetchRequestHandler } from "@lightfast/ai/v2/server";
import { smoothStream, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import type { NextRequest } from "next/server";
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
import { eventEmitter, redis } from "@/app/(v2)/ai/config";

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
		name: "v2-test",
		systemPrompt:
			"You are a helpful AI assistant with comprehensive capabilities. You can manage files, search the web, maintain todo lists, and execute code in sandboxes. Use your tools effectively to help users with their tasks.",
		// Use actual v1 tool factories
		tools: v2Tools,
		// Create runtime context from session
		createRuntimeContext: ({ sessionId, userId }) => ({
			threadId: sessionId,
			resourceId: userId || "anonymous",
			// App-specific context would be added here
		}),
		// Use the same model configuration as v1
		model: wrapLanguageModel({
			model: gateway("anthropic/claude-4-sonnet"),
			middleware: BraintrustMiddleware({ debug: true }),
		}),
		temperature: 0.7,
		maxIterations: 10,
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
	eventEmitter,
);

// Create the handler using fetchRequestHandler
const handlerFn = fetchRequestHandler({
	agent: v2TestAgent,
	redis,
	eventEmitter,
	baseUrl: "/api/v2",
});

// Handler function - now just passes through to fetchRequestHandler
const handler = async (req: NextRequest, { params }: { params: Promise<{ v: string[] }> }) => {
	// The fetchRequestHandler now handles all routing internally
	return handlerFn(req);
};

// Export the handler for both GET and POST requests
export { handler as GET, handler as POST };
