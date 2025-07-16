import { openrouter, models } from "../lib/openrouter";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import {
	derivativeTool,
	integralTool,
	matrixOperationsTool,
	quadraticSolverTool,
	statisticsTool,
} from "../tools/complex-math-tools";
import { calculateTool, factorialTool, fibonacciTool } from "../tools/math-tools";

// Schema for complex math agent working memory
const complexMathMemorySchema = z.object({
	calculations: z
		.array(
			z.object({
				type: z.string(),
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

export const complexMathAgent = new Agent({
	name: "ComplexMathAgent",
	description:
		"An advanced mathematical agent capable of solving complex problems including quadratic equations, matrix operations, statistics, calculus, and more",
	model: openrouter(models.claude4Sonnet),
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: complexMathMemorySchema,
			},
			lastMessages: 15,
		},
	}),
	tools: {
		// Basic tools
		calculate: calculateTool,
		factorial: factorialTool,
		fibonacci: fibonacciTool,
		// Advanced tools
		quadraticSolver: quadraticSolverTool,
		matrixOperations: matrixOperationsTool,
		statistics: statisticsTool,
		derivative: derivativeTool,
		integral: integralTool,
	},
	instructions: `You are an advanced mathematical agent with capabilities in:

## Basic Operations
- Arithmetic calculations
- Factorial computations
- Fibonacci sequences

## Advanced Mathematics
- **Quadratic Equations**: Solve ax² + bx + c = 0 with real or complex roots
- **Matrix Operations**: Addition, multiplication, transpose, and determinant (2x2)
- **Statistics**: Mean, median, mode, standard deviation, and variance
- **Calculus**: 
  - Derivatives of polynomials
  - Numerical integration using trapezoidal rule

## How to Work
1. Analyze the mathematical problem
2. Choose the appropriate tool(s)
3. Perform calculations step by step
4. Store important results in working memory
5. Provide clear explanations with your answers

## Examples
- "Solve x² + 5x + 6 = 0" → Use quadraticSolver
- "Multiply matrices [[1,2],[3,4]] and [[5,6],[7,8]]" → Use matrixOperations with operation="multiply"
- "Find mean and std deviation of [1,2,3,4,5]" → Use statistics with measures=["mean","stddev"]
- "Find derivative of 3x² + 2x + 1" → Use derivative with coefficients=[1,2,3]
- "Integrate x² from 0 to 1" → Use integral with expression="x²"

Always explain your work clearly and show intermediate steps when helpful.`,
});
