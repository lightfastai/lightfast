/**
 * Type-Safe a011 Agent Evaluation with Deep Mastra Integration
 * Leverages Mastra's type system for comprehensive testing
 */

import type { CoreMessage, GenerateTextResult, StepResult, ToolCallUnion, ToolSet } from "ai";
import { Eval, type EvalScorer, type EvalScorerArgs, type BaseMetadata, type DefaultMetadataType } from "braintrust";
import type { z } from "zod";

// Define Score type based on braintrust's expected format
type Score = { name: string; score: number | null };
import type { SimplifiedWorkingMemory } from "../../../../mastra/agents/experimental/a011";
import { a011 } from "../../../../mastra/agents/experimental/a011";

console.log("🎯 a011 Type-Safe Mastra Integration Evaluation\n");

// Type-safe test scenario interface
interface TestScenario {
	input: string;
	expected: string;
	metadata: {
		category: "simple_task" | "todo_workflow" | "conversational" | "complex_task";
		shouldUseTodos: boolean;
		description: string;
		expectedToolCalls?: string[];
		minDuration?: number;
		maxDuration?: number;
	};
	memorySetup?: Partial<SimplifiedWorkingMemory>;
	contextMessages?: CoreMessage[];
}

// Comprehensive test scenarios with type safety
const a011TestScenarios: TestScenario[] = [
	{
		input: "What is 25 * 4?",
		expected: "100",
		metadata: {
			category: "simple_task",
			shouldUseTodos: false,
			description: "Simple math that should skip todo tracking",
			expectedToolCalls: [],
		},
	},
	{
		input: "Create a todo list with: research TypeScript, write docs, review code. Start the first task.",
		expected: "todo list created and first task started",
		metadata: {
			category: "todo_workflow",
			shouldUseTodos: true,
			description: "Explicit todo creation and execution",
			expectedToolCalls: ["todoWrite", "todoRead"],
		},
	},
	{
		input: "Hello, how are you today?",
		expected: "friendly response",
		metadata: {
			category: "conversational",
			shouldUseTodos: false,
			description: "Conversational query",
			expectedToolCalls: [],
		},
	},
	{
		input: "Build a React component for user profile with avatar upload, then write tests for it.",
		expected: "component created with tests",
		metadata: {
			category: "complex_task",
			shouldUseTodos: true,
			description: "Complex multi-step development task",
			expectedToolCalls: ["todoWrite", "fileWrite", "todoWrite"],
			minDuration: 1000,
		},
	},
	{
		input: "Search for best practices for TypeScript error handling and create a summary document.",
		expected: "research completed and document created",
		metadata: {
			category: "complex_task",
			shouldUseTodos: true,
			description: "Research and documentation task",
			expectedToolCalls: ["todoWrite", "webSearch", "fileWrite", "todoWrite"],
		},
	},
];

// Type-safe tool call tracking
interface ToolCallMetrics {
	todoWrite: number;
	todoRead: number;
	todoClear: number;
	webSearch: number;
	fileWrite: number;
}

// Comprehensive execution result interface
interface ExecutionResult {
	output: string;
	todoOperations: { writes: number; reads: number; clears: number };
	toolCalls: string[];
	toolCallMetrics: ToolCallMetrics;
	duration: number;
	steps: number;
	error?: string;
	memoryUpdates?: Partial<SimplifiedWorkingMemory>;
	threadId: string;
	resourceId: string;
}

// Execute a011 agent with full type safety and Mastra integration
async function executeA011Agent(input: string, scenario?: TestScenario): Promise<ExecutionResult> {
	const startTime = Date.now();
	const threadId = `eval-a011-${Date.now()}`;
	const resourceId = "eval-user";

	try {
		console.log(`[EVAL] Executing a011: "${input}"`);
		console.log(`[EVAL] Thread: ${threadId}, Resource: ${resourceId}`);

		// Build messages with optional context
		const messages: CoreMessage[] = [
			...(scenario?.contextMessages || []),
			{
				role: "user" as const,
				content: input,
			},
		];

		// Type-safe generate options with memory configuration
		const generateOptions = {
			memory: {
				thread: threadId,
				resource: resourceId,
				options: {
					lastMessages: 10,
					workingMemory: scenario?.memorySetup,
				},
			},
			runId: `run-${Date.now()}`,
		};

		// Execute with full type safety
		const result = await a011.generate(messages, generateOptions as Parameters<typeof a011.generate>[1]) as GenerateTextResult<ToolSet, unknown>;

		const duration = Date.now() - startTime;

		// Extract text from AI SDK v5 result format with type safety
		let output = result.text || "";
		const toolCalls: string[] = [];
		const todoOperations = { writes: 0, reads: 0, clears: 0 };
		const toolCallMetrics: ToolCallMetrics = {
			todoWrite: 0,
			todoRead: 0,
			todoClear: 0,
			webSearch: 0,
			fileWrite: 0,
		};

		// Type-safe step processing
		if (result.steps && result.steps.length > 0) {
			result.steps.forEach((step: StepResult<ToolSet>) => {
				// Extract text content
				if (step.text) {
					output = output || step.text;
				}

				// Process tool calls with type safety
				if (step.toolCalls && step.toolCalls.length > 0) {
					step.toolCalls.forEach((toolCall: ToolCallUnion<ToolSet>) => {
						const toolName = toolCall.toolName;
						toolCalls.push(toolName);

						// Update metrics based on tool type
						switch (toolName) {
							case "todoWrite":
								todoOperations.writes++;
								toolCallMetrics.todoWrite++;
								break;
							case "todoRead":
								todoOperations.reads++;
								toolCallMetrics.todoRead++;
								break;
							case "todoClear":
								todoOperations.clears++;
								toolCallMetrics.todoClear++;
								break;
							case "webSearch":
								toolCallMetrics.webSearch++;
								break;
							case "fileWrite":
								toolCallMetrics.fileWrite++;
								break;
						}
					});
				}
			});
		}

		console.log(`[EVAL] Completed in ${duration}ms`);
		console.log(`[EVAL] Tools used: ${toolCalls.join(", ") || "none"}`);
		console.log(`[EVAL] Todo ops: ${todoOperations.writes}W ${todoOperations.reads}R ${todoOperations.clears}C`);
		console.log(`[EVAL] Steps: ${result.steps?.length || 0}`);
		console.log(`[EVAL] Output preview: "${output.substring(0, 100)}..."`);

		return {
			output,
			todoOperations,
			toolCalls,
			toolCallMetrics,
			duration,
			steps: result.steps?.length || 0,
			threadId,
			resourceId,
		};
	} catch (error) {
		console.error(`[EVAL] Error:`, error);
		return {
			output: "",
			todoOperations: { writes: 0, reads: 0, clears: 0 },
			toolCalls: [],
			toolCallMetrics: {
				todoWrite: 0,
				todoRead: 0,
				todoClear: 0,
				webSearch: 0,
				fileWrite: 0,
			},
			duration: Date.now() - startTime,
			steps: 0,
			error: error instanceof Error ? error.message : "Unknown error",
			threadId,
			resourceId,
		};
	}
}

// Type-safe scoring with detailed metrics
interface ScoringResult {
	task_completion: number;
	output_quality: number;
	relevancy: number;
	error_handling: number;
	tool_usage_accuracy: number;
	performance: number;
	task_management: number;
}

function scoreA011Performance(testCase: TestScenario | string, result: ExecutionResult): ScoringResult {
	// Extract test case data with type safety
	const scenario: TestScenario | null = typeof testCase === "object" ? testCase : null;
	const input = scenario?.input || (typeof testCase === "string" ? testCase : "");
	const metadata = scenario?.metadata;

	console.log(`[SCORE] Evaluating: "${input}"`);
	console.log(`[SCORE] Category: ${metadata?.category || "unknown"}`);

	if (!result.output || result.error) {
		return {
			task_completion: 0,
			output_quality: 0,
			relevancy: 0,
			error_handling: result.error ? 0 : 0.5,
			tool_usage_accuracy: 0,
			performance: 0,
			task_management: 0,
		};
	}

	// Calculate scores based on scenario expectations
	const scores: ScoringResult = {
		// Task completion based on output presence and expected content
		task_completion: calculateTaskCompletion(result, scenario),

		// Output quality based on length and structure
		output_quality: calculateOutputQuality(result.output),

		// Relevancy to input request
		relevancy: calculateRelevancy(input, result.output),

		// Error handling
		error_handling: result.error ? 0 : 1.0,

		// Tool usage accuracy
		tool_usage_accuracy: calculateToolUsageAccuracy(result, metadata),

		// Performance (duration-based)
		performance: calculatePerformanceScore(result.duration, metadata),

		// Task management effectiveness
		task_management: calculateTaskManagementScore(result, metadata),
	};

	console.log(`[SCORE] Detailed scores:`, scores);
	return scores;
}

// Helper scoring functions
function calculateTaskCompletion(result: ExecutionResult, scenario: TestScenario | null): number {
	if (!result.output) return 0;
	if (!scenario) return result.output.length > 10 ? 0.7 : 0.3;

	// Check if expected keywords are present
	const expectedWords = scenario.expected.toLowerCase().split(" ");
	const outputLower = result.output.toLowerCase();
	const matchedWords = expectedWords.filter((word) => outputLower.includes(word));

	return matchedWords.length / expectedWords.length;
}

function calculateOutputQuality(output: string): number {
	// Quality based on output characteristics
	const hasStructure = output.includes("\n") || output.includes("- ");
	const hasDetail = output.length > 50;
	const isCoherent = output.split(". ").length > 1;

	let score = 0.3; // Base score
	if (hasStructure) score += 0.2;
	if (hasDetail) score += 0.3;
	if (isCoherent) score += 0.2;

	return Math.min(score, 1.0);
}

function calculateRelevancy(input: string, output: string): number {
	const inputWords = input
		.toLowerCase()
		.split(" ")
		.filter((w) => w.length > 3);
	const outputLower = output.toLowerCase();
	const relevantWords = inputWords.filter((word) => outputLower.includes(word));

	return inputWords.length > 0 ? relevantWords.length / inputWords.length : 0.5;
}

function calculateToolUsageAccuracy(result: ExecutionResult, metadata?: TestScenario["metadata"]): number {
	if (!metadata?.expectedToolCalls) return 0.8; // No expectations

	const expected = new Set(metadata.expectedToolCalls);
	const actual = new Set(result.toolCalls);

	// Check if all expected tools were used
	let correctTools = 0;
	expected.forEach((tool) => {
		if (actual.has(tool)) correctTools++;
	});

	// Penalize for unexpected tools (but not as much)
	const unexpectedTools = result.toolCalls.filter((t) => !expected.has(t)).length;
	const penalty = unexpectedTools * 0.1;

	return Math.max(0, correctTools / expected.size - penalty);
}

function calculatePerformanceScore(duration: number, metadata?: TestScenario["metadata"]): number {
	// Performance scoring based on duration
	if (metadata?.minDuration && duration < metadata.minDuration) {
		return 0.5; // Too fast, might have skipped steps
	}
	if (metadata?.maxDuration && duration > metadata.maxDuration) {
		return 0.5; // Too slow
	}

	// General performance curve
	if (duration < 500) return 1.0; // Very fast
	if (duration < 2000) return 0.9; // Fast
	if (duration < 5000) return 0.7; // Acceptable
	if (duration < 10000) return 0.5; // Slow
	return 0.3; // Very slow
}

function calculateTaskManagementScore(result: ExecutionResult, metadata?: TestScenario["metadata"]): number {
	if (!metadata) return 0.5;

	const shouldUseTodos = metadata.shouldUseTodos;
	const actuallyUsedTodos = result.todoOperations.writes > 0;

	// Perfect score if expectations match reality
	if (shouldUseTodos === actuallyUsedTodos) {
		// Additional scoring for complex tasks
		if (shouldUseTodos && metadata.category === "complex_task") {
			// Check for proper task lifecycle (write, then updates)
			const hasProperLifecycle =
				result.todoOperations.writes > 0 && result.todoOperations.writes >= result.todoOperations.reads;
			return hasProperLifecycle ? 1.0 : 0.7;
		}
		return 1.0;
	}

	// Penalty for incorrect todo usage
	return 0.3;
}

// Main Braintrust evaluation with type safety
Eval("a011-typesafe-mastra-integration", {
	data: a011TestScenarios,

	task: async (testCase: TestScenario | string): Promise<{ output: string; metrics: ExecutionResult }> => {
		// Type-safe test case handling
		const scenario = typeof testCase === "object" ? testCase : null;
		const input = scenario?.input || (typeof testCase === "string" ? testCase : "");

		console.log(`\n[TASK] ====== Processing Test Case ======`);
		console.log(`[TASK] Input: "${input}"`);
		console.log(`[TASK] Category: ${scenario?.metadata.category || "unknown"}`);

		const result = await executeA011Agent(input, scenario || undefined);

		// Log execution summary
		console.log(`[TASK] Execution Summary:`);
		console.log(`[TASK]   - Duration: ${result.duration}ms`);
		console.log(`[TASK]   - Steps: ${result.steps}`);
		console.log(`[TASK]   - Tools: ${result.toolCalls.join(", ") || "none"}`);
		console.log(`[TASK]   - Output: "${result.output.substring(0, 100)}..."`);
		console.log(`[TASK] ====== Test Case Complete ======\n`);

		return {
			output: result.output || result.error || "No output",
			metrics: result,
		};
	},

	scores: [
		(args: EvalScorerArgs<TestScenario | string, { output: string; metrics: ExecutionResult }, string, BaseMetadata>) => {
			const { input: testCase, output: taskOutput } = args;
			console.log(`\n[SCORE] ====== Scoring Test Case ======`);

			// Extract the actual result from task output
			const output = typeof taskOutput === 'object' && taskOutput !== null && 'output' in taskOutput ? taskOutput.output : taskOutput;
			const metrics: ExecutionResult | undefined = typeof taskOutput === 'object' && taskOutput !== null && 'metrics' in taskOutput ? taskOutput.metrics : undefined;

			if (!output || typeof output !== "string") {
				console.log(`[SCORE] Invalid output format, returning zero scores`);
				const zeroScores = {
					task_completion: 0,
					output_quality: 0,
					relevancy: 0,
					error_handling: 0,
					tool_usage_accuracy: 0,
					performance: 0,
					task_management: 0,
				};
				return Object.entries(zeroScores).map(([name, score]) => ({
					name,
					score,
				}));
			}

			// Use metrics if available, otherwise create minimal result
			const result: ExecutionResult = metrics || {
				output,
				todoOperations: { writes: 0, reads: 0, clears: 0 },
				toolCalls: [],
				toolCallMetrics: {
					todoWrite: 0,
					todoRead: 0,
					todoClear: 0,
					webSearch: 0,
					fileWrite: 0,
				},
				duration: 0,
				steps: 0,
				threadId: "unknown",
				resourceId: "unknown",
			};

			const scores = scoreA011Performance(testCase, result);
			console.log(`[SCORE] ====== Scoring Complete ======\n`);

			// Convert to Braintrust Score format - return an array of score objects
			return Object.entries(scores).map(([name, score]) => ({
				name,
				score,
			}));
		},
	],

	metadata: {
		description: "Type-safe Mastra integration evaluation for a011 task management agent",
		version: "2.0.0",
		agent: "a011",
		framework: "mastra",
		features: [
			"Full type safety with Mastra types",
			"Thread and resource ID tracking",
			"Comprehensive tool usage metrics",
			"Detailed scoring across 7 dimensions",
			"Memory integration support",
		],
		timestamp: new Date().toISOString(),
	},
});

console.log(`
🎯 a011 Type-Safe Mastra Integration Evaluation

Features:
✅ Full TypeScript type safety with Mastra types
✅ Type-safe generate options with memory configuration
✅ Thread and resource ID propagation
✅ Comprehensive tool usage metrics (5 tools)
✅ 7-dimension scoring system:
   - Task completion
   - Output quality  
   - Relevancy
   - Error handling
   - Tool usage accuracy
   - Performance
   - Task management
✅ Test scenario interface with metadata
✅ Memory setup and context message support
✅ Detailed execution result tracking

Run: pnpm eval:a011:dev
`);
