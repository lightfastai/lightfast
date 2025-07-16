import { Agent } from "@mastra/core";
import { anthropic } from "@ai-sdk/anthropic";
import { calculateTool } from "../tools/calculate";
import { factorialTool } from "../tools/factorial";
import { fibonacciTool } from "../tools/fibonacci";
import { 
  quadraticSolverTool,
  matrixOperationsTool,
  statisticsTool,
  derivativeTool,
  integralTool
} from "../tools/complex-math-tools";
import { workingMemoryTool } from "../tools/working-memory";

export const complexMathAgent = new Agent({
  name: "ComplexMathAgent",
  description: "An advanced mathematical agent capable of solving complex problems including quadratic equations, matrix operations, statistics, calculus, and more",
  model: anthropic("claude-4-sonnet-20250514"),
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
    // Memory
    updateWorkingMemory: workingMemoryTool,
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
  maxSteps: 50,
});