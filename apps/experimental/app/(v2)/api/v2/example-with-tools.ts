/**
 * Example of using v2 Agent with tool factories and runtime context
 */

import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
import { createTool } from "@lightfast/ai/tool";
import { Agent } from "@lightfast/ai/v2/core";
import { smoothStream, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { z } from "zod";
import { eventEmitter, redis } from "@/app/(v2)/ai/config";

// Define runtime context type
interface AppRuntimeContext {
	feature?: string;
	environment?: string;
}

// Create calculator tool using the tool factory pattern
const calculatorTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Performs mathematical calculations with context awareness",
	inputSchema: z.object({
		expression: z.string().optional().describe("Mathematical expression to evaluate"),
		a: z.number().optional().describe("First number"),
		b: z.number().optional().describe("Second number"),
		operation: z.enum(["add", "subtract", "multiply", "divide"]).optional(),
	}),
	execute: async (args, context) => {
		// Access runtime context
		console.log("Calculator tool called with context:", {
			threadId: context.threadId,
			resourceId: context.resourceId,
			feature: context.feature,
		});

		const { expression, a, b, operation } = args;
		if (expression) {
			try {
				// Simple expression evaluation (be careful in production!)
				const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ""));
				return {
					expression,
					result,
					context: {
						threadId: context.threadId,
						feature: context.feature,
					},
				};
			} catch {
				return { error: "Invalid expression" };
			}
		} else if (typeof a === "number" && typeof b === "number" && operation) {
			let result: number;
			switch (operation) {
				case "add":
					result = a + b;
					break;
				case "subtract":
					result = a - b;
					break;
				case "multiply":
					result = a * b;
					break;
				case "divide":
					result = b !== 0 ? a / b : NaN;
					break;
				default:
					result = NaN;
			}
			return {
				operation,
				a,
				b,
				result,
				context: {
					threadId: context.threadId,
					feature: context.feature,
				},
			};
		}
		return { error: "Invalid calculator arguments" };
	},
});

// Create file info tool using the tool factory pattern
const fileInfoTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Get information about files in the context",
	inputSchema: z.object({
		filename: z.string().describe("Name of the file to get info about"),
	}),
	execute: async ({ filename }, context) => {
		// This would normally interact with blob storage or file system
		// For demo, we'll return mock data that uses context
		return {
			filename,
			path: `threads/${context.threadId}/${filename}`,
			exists: Math.random() > 0.5,
			size: Math.floor(Math.random() * 10000),
			lastModified: new Date().toISOString(),
			owner: context.resourceId,
			environment: context.environment || "development",
		};
	},
});

// Create the v2 agent with tool factories
export const v2AgentWithTools = new Agent<RuntimeContext<AppRuntimeContext>>(
	{
		name: "v2-tools-demo",
		systemPrompt: "You are a helpful AI assistant with access to calculation and file tools. Each tool has access to the current user context and thread information.",
		// Use tool factories instead of direct tools
		tools: {
			calculator: calculatorTool,
			fileInfo: fileInfoTool,
		},
		// Function to create runtime context
		createRuntimeContext: ({ sessionId, userId }) => ({
			threadId: sessionId,
			resourceId: userId || "anonymous",
			// App-specific context
			feature: "v2-tool-demo",
			environment: process.env.NODE_ENV || "development",
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
	},
	redis,
	eventEmitter,
);

// Example usage in a route handler:
/*
import { fetchRequestHandler } from "@lightfast/ai/v2/server";

const handler = fetchRequestHandler({
	agent: v2AgentWithTools,
	redis,
	eventEmitter,
	baseUrl: "/api/v2",
});

export { handler as GET, handler as POST };
*/