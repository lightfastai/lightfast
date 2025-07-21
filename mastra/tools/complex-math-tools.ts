import { createTool } from "@mastra/core";
import { z } from "zod";

export const quadraticSolverTool = createTool({
	id: "quadratic-solver",
	description: "Solves quadratic equations of the form ax² + bx + c = 0",
	inputSchema: z.object({
		a: z.number().describe("Coefficient of x²"),
		b: z.number().describe("Coefficient of x"),
		c: z.number().describe("Constant term"),
	}),
	execute: async ({ context }) => {
		const { a, b, c } = context;
		const discriminant = b * b - 4 * a * c;

		if (discriminant > 0) {
			const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
			const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
			return {
				discriminant,
				roots: [x1, x2],
				type: "Two real roots",
			};
		} else if (discriminant === 0) {
			const x = -b / (2 * a);
			return {
				discriminant,
				roots: [x],
				type: "One real root (repeated)",
			};
		} else {
			const real = -b / (2 * a);
			const imaginary = Math.sqrt(-discriminant) / (2 * a);
			return {
				discriminant,
				roots: [`${real} + ${imaginary}i`, `${real} - ${imaginary}i`],
				type: "Two complex roots",
			};
		}
	},
});

export const matrixOperationsTool = createTool({
	id: "matrix-operations",
	description: "Performs matrix operations (addition, multiplication, transpose, determinant)",
	inputSchema: z.object({
		operation: z.enum(["add", "multiply", "transpose", "determinant"]).describe("Operation to perform"),
		matrixA: z.array(z.array(z.number())).describe("First matrix"),
		matrixB: z.array(z.array(z.number())).optional().describe("Second matrix (for add/multiply)"),
	}),
	execute: async ({ context }) => {
		const { operation, matrixA, matrixB } = context;

		switch (operation) {
			case "add": {
				if (!matrixB) throw new Error("Matrix B required for addition");
				if (matrixA.length !== matrixB.length || matrixA[0].length !== matrixB[0].length) {
					throw new Error("Matrices must have same dimensions for addition");
				}
				const sum = matrixA.map((row, i) => row.map((val, j) => val + matrixB[i][j]));
				return { result: sum, operation: "addition" };
			}

			case "multiply": {
				if (!matrixB) throw new Error("Matrix B required for multiplication");
				if (matrixA[0].length !== matrixB.length) {
					throw new Error("Invalid dimensions for matrix multiplication");
				}
				const product = Array(matrixA.length)
					.fill(null)
					.map(() => Array(matrixB[0].length).fill(0));
				for (let i = 0; i < matrixA.length; i++) {
					for (let j = 0; j < matrixB[0].length; j++) {
						for (let k = 0; k < matrixB.length; k++) {
							product[i][j] += matrixA[i][k] * matrixB[k][j];
						}
					}
				}
				return { result: product, operation: "multiplication" };
			}

			case "transpose": {
				const transposed = matrixA[0].map((_, colIndex) => matrixA.map((row) => row[colIndex]));
				return { result: transposed, operation: "transpose" };
			}

			case "determinant":
				if (matrixA.length !== matrixA[0].length) {
					throw new Error("Determinant requires square matrix");
				}
				if (matrixA.length === 2) {
					const det = matrixA[0][0] * matrixA[1][1] - matrixA[0][1] * matrixA[1][0];
					return { result: det, operation: "determinant" };
				}
				throw new Error("Currently only supports 2x2 determinants");
		}
	},
});

export const statisticsTool = createTool({
	id: "statistics",
	description: "Calculates statistical measures (mean, median, mode, std deviation)",
	inputSchema: z.object({
		data: z.array(z.number()).describe("Array of numbers"),
		measures: z.array(z.enum(["mean", "median", "mode", "stddev", "variance"])).describe("Measures to calculate"),
	}),
	execute: async ({ context }) => {
		const { data, measures } = context;
		const results: Record<string, number | number[]> = {};

		if (measures.includes("mean")) {
			results.mean = data.reduce((a, b) => a + b, 0) / data.length;
		}

		if (measures.includes("median")) {
			const sorted = [...data].sort((a, b) => a - b);
			const mid = Math.floor(sorted.length / 2);
			results.median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
		}

		if (measures.includes("mode")) {
			const counts: Record<number, number> = {};
			data.forEach((num) => {
				counts[num] = (counts[num] || 0) + 1;
			});
			const maxCount = Math.max(...Object.values(counts));
			results.mode = Object.keys(counts)
				.filter((key) => counts[Number(key)] === maxCount)
				.map(Number);
		}

		if (measures.includes("variance") || measures.includes("stddev")) {
			const mean = data.reduce((a, b) => a + b, 0) / data.length;
			const variance = data.reduce((sum, num) => sum + (num - mean) ** 2, 0) / data.length;
			if (measures.includes("variance")) results.variance = variance;
			if (measures.includes("stddev")) results.stddev = Math.sqrt(variance);
		}

		return results;
	},
});

export const derivativeTool = createTool({
	id: "derivative",
	description: "Calculates derivative of simple polynomial functions",
	inputSchema: z.object({
		coefficients: z.array(z.number()).describe("Polynomial coefficients [a0, a1, a2, ...] for a0 + a1*x + a2*x² + ..."),
		atPoint: z.number().optional().describe("Point to evaluate derivative at"),
	}),
	execute: async ({ context }) => {
		const { coefficients, atPoint } = context;

		// Calculate derivative coefficients
		const derivativeCoeffs = coefficients.slice(1).map((coeff, index) => coeff * (index + 1));

		const result: any = {
			originalPolynomial: coefficients.map((c, i) => (i === 0 ? `${c}` : `${c}x^${i}`)).join(" + "),
			derivativePolynomial: derivativeCoeffs.map((c, i) => (i === 0 ? `${c}` : `${c}x^${i}`)).join(" + "),
			derivativeCoefficients: derivativeCoeffs,
		};

		if (atPoint !== undefined) {
			const value = derivativeCoeffs.reduce((sum, coeff, index) => sum + coeff * atPoint ** index, 0);
			result.valueAtPoint = { x: atPoint, derivative: value };
		}

		return result;
	},
});

export const integralTool = createTool({
	id: "integral",
	description: "Calculates definite integral using numerical integration (trapezoidal rule)",
	inputSchema: z.object({
		expression: z.string().describe("Expression to integrate (simple functions like x^2, sin(x), etc)"),
		lowerBound: z.number().describe("Lower bound of integration"),
		upperBound: z.number().describe("Upper bound of integration"),
		intervals: z.number().default(1000).describe("Number of intervals for approximation"),
	}),
	execute: async ({ context }) => {
		const { expression, lowerBound, upperBound, intervals } = context;

		// Simple expression evaluator
		const evaluate = (x: number): number => {
			// Handle basic functions
			if (expression === "x") return x;
			if (expression === "x^2" || expression === "x²") return x * x;
			if (expression === "x^3" || expression === "x³") return x * x * x;
			if (expression === "sin(x)") return Math.sin(x);
			if (expression === "cos(x)") return Math.cos(x);
			if (expression === "e^x" || expression === "exp(x)") return Math.exp(x);
			if (expression === "ln(x)" || expression === "log(x)") return Math.log(x);
			if (expression === "1/x") return 1 / x;

			throw new Error(`Cannot evaluate expression: ${expression}`);
		};

		// Trapezoidal rule
		const h = (upperBound - lowerBound) / intervals;
		let sum = (evaluate(lowerBound) + evaluate(upperBound)) / 2;

		for (let i = 1; i < intervals; i++) {
			const x = lowerBound + i * h;
			sum += evaluate(x);
		}

		const result = sum * h;

		return {
			expression,
			bounds: { lower: lowerBound, upper: upperBound },
			approximateValue: result,
			method: "Trapezoidal rule",
			intervals,
		};
	},
});
