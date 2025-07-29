/**
 * V2 Unified Agent Worker Route
 * Handles all worker events through a single endpoint
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { Agent } from "@lightfast/ai/v2/core";
import { fetchRequestHandler } from "@lightfast/ai/v2/server";
import { smoothStream, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import type { NextRequest } from "next/server";
import { eventEmitter, redis } from "@/app/(v2)/ai/config";

// Define calculator tool
const calculatorTool = {
	name: "calculator",
	description: "Performs mathematical calculations",
	execute: async (args: Record<string, any>) => {
		const { expression, a, b, operation } = args;
		if (expression) {
			// Simple expression evaluation (be careful in production!)
			try {
				const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ""));
				return { expression, value: result };
			} catch {
				return { error: "Invalid expression" };
			}
		} else if (typeof a === "number" && typeof b === "number" && operation) {
			switch (operation) {
				case "add":
					return { result: a + b };
				case "subtract":
					return { result: a - b };
				case "multiply":
					return { result: a * b };
				case "divide":
					return { result: b !== 0 ? a / b : "Division by zero" };
				default:
					return { error: "Unknown operation" };
			}
		}
		return { error: "Invalid calculator arguments" };
	},
};

// Define weather tool
const weatherTool = {
	name: "weather",
	description: "Gets current weather information for a location",
	execute: async (args: Record<string, any>) => {
		// Mock weather data
		return {
			location: args.location || "San Francisco",
			temperature: 72,
			conditions: "Partly cloudy",
			humidity: 65,
		};
	},
};

// Define search tool
const searchTool = {
	name: "search",
	description: "Searches the web for information",
	execute: async (args: Record<string, any>) => {
		// Mock search results
		return {
			query: args.query,
			results: [
				{ title: "Result 1", snippet: "This is a mock search result" },
				{ title: "Result 2", snippet: "Another mock search result" },
			],
		};
	},
};

// Create the v2 test agent with the new Agent class
const v2TestAgent = new Agent(
	{
		name: "v2-test",
		systemPrompt: "You are a helpful AI assistant with access to various tools. Use them when needed to help the user.",
		tools: [calculatorTool, weatherTool, searchTool],
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
