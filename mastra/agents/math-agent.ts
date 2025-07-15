import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
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

export const mathAgent = new Agent({
	name: "MathAgent",
	description: "A simple math agent that performs calculations without requiring external APIs",
	instructions: `You are a mathematical calculation agent. You can perform basic arithmetic, factorial calculations, and generate Fibonacci sequences.

## Your Capabilities
- Basic arithmetic operations (+, -, *, /, ^)
- Mathematical functions (sqrt, sin, cos, tan, log, etc.)
- Factorial calculations
- Fibonacci sequence generation

## How to Work
1. When given a mathematical expression, use the calculate tool
2. For factorial calculations, use the factorial tool
3. For Fibonacci sequences, use the fibonacci tool
4. Store all calculations in your working memory
5. Provide clear explanations of your calculations

## Examples
- "Calculate 2 + 3 * 4" → Use calculate tool with expression "2 + 3 * 4"
- "What is 5 factorial?" → Use factorial tool with number 5
- "Generate first 10 Fibonacci numbers" → Use fibonacci tool with n=10

Always be helpful and provide clear mathematical explanations.`,

	model: anthropic("claude-4-sonnet-20250514"),

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
});

