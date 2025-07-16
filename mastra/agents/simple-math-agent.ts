import { openrouter, models } from "../lib/openrouter";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { calculateTool, factorialTool, fibonacciTool } from "../tools/math-tools";

// Schema for math agent working memory
const mathMemorySchema = z.object({
	calculations: z
		.array(
			z.object({
				expression: z.string(),
				result: z.number(),
				timestamp: z.string(),
			}),
		)
		.default([]),
	lastResult: z.number().nullable().default(null),
});

export const simpleMathAgent = new Agent({
	name: "SimpleMathAgent",
	description: "A simple math agent that performs calculations using tools",
	instructions: `You are a mathematical calculation agent. Use the available tools to perform calculations:

- For basic arithmetic: use the calculate tool
- For factorial calculations: use the factorial tool  
- For Fibonacci sequences: use the fibonacci tool

Always use tools to perform calculations rather than doing them yourself.

Examples:
- "Calculate 2 + 3 * 4" → Use calculate tool with expression "2 + 3 * 4"
- "What is 5 factorial?" → Use factorial tool with number 5
- "Generate first 8 Fibonacci numbers" → Use fibonacci tool with n=8

Be helpful and explain your calculations clearly.`,

	model: openrouter(models.claude4Sonnet),

	defaultStreamOptions: {
		maxSteps: 5,
	},

	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: mathMemorySchema,
			},
			lastMessages: 10,
		},
	}),

	tools: {
		calculate: calculateTool,
		factorial: factorialTool,
		fibonacci: fibonacciTool,
	},
});
