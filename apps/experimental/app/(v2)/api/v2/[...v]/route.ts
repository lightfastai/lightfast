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

// Handler function that determines the event type and processes accordingly
const handler = async (req: NextRequest, { params }: { params: Promise<{ v: string[] }> }) => {
	// Await the params
	const { v } = await params;

	// Check if this is a stream endpoint
	if (v?.[0] === "stream") {
		// Let the unified handler process stream endpoints
		return handlerFn(req);
	}

	// Otherwise, it's a worker endpoint
	// Extract worker type from the path
	// Expected format: /api/v2/workers/[worker-type]
	const workerType = v?.[1]; // e.g., "agent-loop", "tool-executor", etc.

	if (!workerType) {
		return Response.json({ error: "Missing worker type in path" }, { status: 400 });
	}

	// Map worker types to event types
	const eventTypeMap: Record<string, string> = {
		"agent-loop": "agent.loop.init",
		"tool-executor": "agent.tool.call",
		"tool-result-complete": "tool.execution.complete",
		"agent-complete": "agent.loop.complete",
	};

	const eventType = eventTypeMap[workerType];
	if (!eventType) {
		return Response.json({ error: `Invalid worker type: ${workerType}` }, { status: 400 });
	}

	// Parse the original event from the request
	const event = await req.json();

	// Create a new request with the wrapped body
	const wrappedBody = JSON.stringify({
		type: eventType,
		event,
	});

	const wrappedRequest = new Request(req.url, {
		method: req.method,
		headers: req.headers,
		body: wrappedBody,
	});

	// Call the handler with the wrapped request
	return handlerFn(wrappedRequest);
};

// Export the handler for both GET and POST requests
export { handler as GET, handler as POST };
