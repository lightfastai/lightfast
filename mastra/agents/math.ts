import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { calculateTool, factorialTool, fibonacciTool } from "../tools/math-tools";
import { models, openrouter } from "../lib/openrouter";
import {
	derivativeTool,
	integralTool,
	matrixOperationsTool,
	quadraticSolverTool,
	statisticsTool,
} from "../tools/complex-math-tools";

// Schema for unified math agent working memory
const mathMemorySchema = z.object({
	calculations: z
		.array(
			z.object({
				type: z.string(),
				expression: z.string().optional(),
				input: z.any(),
				result: z.any(),
				timestamp: z.string(),
			}),
		)
		.default([]),
	lastResult: z.any().nullable().default(null),
	equations: z
		.array(
			z.object({
				equation: z.string(),
				roots: z.array(z.union([z.number(), z.string()])),
				type: z.string(),
			}),
		)
		.default([]),
	matrices: z
		.array(
			z.object({
				operation: z.string(),
				result: z.array(z.array(z.number())),
			}),
		)
		.default([]),
	statistics: z
		.object({
			lastDataset: z.array(z.number()).optional(),
			lastMeasures: z.record(z.union([z.number(), z.array(z.number())])).optional(),
		})
		.default({}),
});

export const mathAgent = new Agent({
	name: "Math",
	description: "A comprehensive mathematical agent capable of both basic and complex calculations",
	model: openrouter(models.claude4Sonnet),
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: mathMemorySchema,
			},
			lastMessages: 15,
		},
	}),
	
	defaultStreamOptions: {
		maxSteps: 5,
	},
	
	tools: {
		// Basic math tools
		calculate: calculateTool,
		factorial: factorialTool,
		fibonacci: fibonacciTool,
		// Complex math tools
		quadraticSolver: quadraticSolverTool,
		matrixOperations: matrixOperationsTool,
		statistics: statisticsTool,
		derivative: derivativeTool,
		integral: integralTool,
	},
	
	instructions: `You are a comprehensive mathematical agent with capabilities ranging from basic arithmetic to advanced mathematics.

## Basic Operations
- **Arithmetic**: Use the calculate tool for expressions like "2 + 3 * 4"
- **Factorial**: Use the factorial tool for n! calculations
- **Fibonacci**: Use the fibonacci tool to generate Fibonacci sequences

## Advanced Mathematics
- **Quadratic Equations**: Solve ax² + bx + c = 0 with real or complex roots using quadraticSolver
- **Matrix Operations**: Addition, multiplication, transpose, and determinant (2x2) using matrixOperations
- **Statistics**: Mean, median, mode, standard deviation, and variance using statistics tool
- **Calculus**: 
  - Derivatives of polynomials using derivative tool
  - Numerical integration using trapezoidal rule with integral tool

## How to Work
1. Analyze the mathematical problem
2. Choose the appropriate tool(s) based on the problem type
3. Always use tools to perform calculations rather than computing manually
4. Store important results in working memory
5. Provide clear explanations with your answers

## Examples
- "Calculate 15 * 7 + 23" → Use calculate tool
- "What is 8 factorial?" → Use factorial tool
- "Generate first 10 Fibonacci numbers" → Use fibonacci tool with n=10
- "Solve x² + 5x + 6 = 0" → Use quadraticSolver
- "Multiply matrices [[1,2],[3,4]] and [[5,6],[7,8]]" → Use matrixOperations
- "Find mean and std deviation of [1,2,3,4,5]" → Use statistics
- "Find derivative of 3x² + 2x + 1" → Use derivative
- "Integrate x² from 0 to 1" → Use integral

Always explain your work clearly and show intermediate steps when helpful.`,
});