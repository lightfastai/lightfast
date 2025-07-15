import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const calculateTool = createTool({
	id: "calculate",
	description: "Performs basic mathematical calculations",
	inputSchema: z.object({
		expression: z.string().describe("Mathematical expression to evaluate (e.g., '2 + 3 * 4', 'sqrt(16)', 'pow(2, 3)')"),
	}),
	outputSchema: z.object({
		result: z.number().describe("The result of the calculation"),
		expression: z.string().describe("The original expression"),
	}),
	execute: async ({ context }) => {
		const { expression } = context;
		try {
			// Safe evaluation using Function constructor for basic math
			// This is a simplified implementation for demo purposes
			const sanitizedExpression = expression
				.replace(/[^0-9+\-*/().\s]/g, "") // Remove non-math characters
				.replace(/\^/g, "**"); // Replace ^ with ** for exponentiation

			// Basic math functions
			const mathFunctions = {
				sqrt: Math.sqrt,
				pow: Math.pow,
				abs: Math.abs,
				sin: Math.sin,
				cos: Math.cos,
				tan: Math.tan,
				log: Math.log,
				exp: Math.exp,
				floor: Math.floor,
				ceil: Math.ceil,
				round: Math.round,
				max: Math.max,
				min: Math.min,
			};

			// Create a safe evaluation context
			const safeEval = new Function("Math", `return ${sanitizedExpression}`);
			const result = safeEval(mathFunctions);

			return {
				result: typeof result === "number" ? result : Number(result),
				expression,
			};
		} catch (error) {
			throw new Error(`Invalid mathematical expression: ${expression}`);
		}
	},
});

export const factorialTool = createTool({
	id: "factorial",
	description: "Calculates the factorial of a number",
	inputSchema: z.object({
		number: z.number().min(0).max(20).describe("Number to calculate factorial for (0-20)"),
	}),
	outputSchema: z.object({
		result: z.number().describe("The factorial result"),
		number: z.number().describe("The original number"),
	}),
	execute: async ({ context }) => {
		const { number } = context;
		if (number < 0) {
			throw new Error("Factorial is only defined non-negative numbers");
		}

		let result = 1;
		for (let i = 2; i <= number; i++) {
			result *= i;
		}

		return {
			result,
			number,
		};
	},
});

export const fibonacciTool = createTool({
	id: "fibonacci",
	description: "Calculates the Fibonacci sequence up to the nth term",
	inputSchema: z.object({
		n: z.number().min(1).max(50).describe("Number of terms to calculate (1-50)"),
	}),
	outputSchema: z.object({
		sequence: z.array(z.number()).describe("The Fibonacci sequence"),
		nth_term: z.number().describe("The nth term in the sequence"),
	}),
	execute: async ({ context }) => {
		const { n } = context;
		if (n < 1) {
			throw new Error("n must be at least 1");
		}

		const sequence = [0, 1];

		for (let i = 2; i < n; i++) {
			sequence[i] = sequence[i - 1] + sequence[i - 2];
		}

		return {
			sequence: sequence.slice(0, n),
			nth_term: sequence[n - 1],
		};
	},
});
