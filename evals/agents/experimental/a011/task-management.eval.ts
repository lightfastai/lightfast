/**
 * Braintrust Evaluation Script for a011 Task-Led Workflow Agent
 *
 * This script evaluates the a011 agent's task management capabilities,
 * including task decomposition, progress tracking, and systematic execution.
 *
 * Usage:
 * npx braintrust eval --no-send-logs evals/agents/experimental/a011/task-management.eval.ts
 * npx braintrust eval --dev --dev-port 8300 evals/agents/experimental/a011/task-management.eval.ts
 */

import type { CoreMessage } from "ai";
import { Eval } from "braintrust";
import { mastra } from "../../../../mastra";
import {
	type AgentEvaluationScores,
	evaluateRelevancy,
	evaluateResponseQuality,
	evaluateTaskCompletion,
	logAgentInteraction,
} from "../../../../mastra/lib/braintrust-utils";

// Test scenarios specifically designed for a011's task management capabilities
const a011TaskManagementScenarios = [
	// Simple Task (Should NOT use todo tracking)
	{
		input: {
			query: "What is 15 * 7 + 23?",
			category: "simple_math",
			complexity: "trivial",
			expectedBehavior: "direct_answer",
			shouldUseTodos: false,
		},
		metadata: {
			test_type: "threshold_detection",
			description: "Verify agent skips todo tracking for trivial tasks",
		},
	},

	// Multi-step Research Task (Should use todo tracking)
	{
		input: {
			query: "Research the latest developments in AI safety, create a summary document, and organize the findings by category",
			category: "research_workflow",
			complexity: "high",
			expectedBehavior: "task_decomposition",
			shouldUseTodos: true,
			expectedTaskCount: 3,
			expectedTools: ["webSearch", "fileWrite", "todoWrite"],
		},
		metadata: {
			test_type: "complex_workflow",
			description: "Multi-step research workflow with task tracking",
		},
	},

	// Code Refactoring Project (Should use todo tracking)
	{
		input: {
			query: "Plan and execute a code refactoring project for the mastra agents folder. Analyze the current structure, identify improvements, and implement changes.",
			category: "code_refactoring",
			complexity: "high", 
			expectedBehavior: "systematic_planning",
			shouldUseTodos: true,
			expectedTaskCount: 4,
			expectedTools: ["todoWrite", "fileWrite", "webSearch"],
		},
		metadata: {
			test_type: "systematic_execution",
			description: "Complex project requiring systematic task breakdown",
		},
	},

	// Todo Management Workflow
	{
		input: {
			query: "Create a comprehensive task list for building a new React component, then start working on the first task",
			category: "todo_workflow",
			complexity: "medium",
			expectedBehavior: "todo_creation_and_execution",
			shouldUseTodos: true,
			expectedTaskCount: 5,
			expectedTools: ["todoWrite", "todoRead"],
		},
		metadata: {
			test_type: "todo_system_usage",
			description: "Test todo creation, tracking, and status updates",
		},
	},

	// Multiple Tasks Listed (Should use todo tracking)
	{
		input: {
			query: "Help me: 1) Research TypeScript best practices, 2) Create a style guide document, 3) Set up ESLint configuration, 4) Run tests and build",
			category: "numbered_tasks",
			complexity: "medium",
			expectedBehavior: "task_list_processing",
			shouldUseTodos: true,
			expectedTaskCount: 4,
			expectedTools: ["todoWrite", "webSearch", "fileWrite"],
		},
		metadata: {
			test_type: "enumerated_tasks",
			description: "Process numbered task list systematically",
		},
	},

	// Progress Tracking Test
	{
		input: {
			query: "Build a complete documentation system: research frameworks, choose the best one, set up the project, create sample docs, and configure deployment",
			category: "documentation_system",
			complexity: "high",
			expectedBehavior: "progress_tracking",
			shouldUseTodos: true,
			expectedTaskCount: 5,
			expectedTools: ["todoWrite", "todoRead", "webSearch", "fileWrite"],
		},
		metadata: {
			test_type: "progress_monitoring",
			description: "Verify systematic progress tracking through complex workflow",
		},
	},

	// Error Handling in Task Context
	{
		input: {
			query: "Create a data processing pipeline: fetch data from a non-existent API, process it, and generate reports",
			category: "error_handling",
			complexity: "medium",
			expectedBehavior: "graceful_error_handling",
			shouldUseTodos: true,
			expectedTaskCount: 3,
			expectedTools: ["todoWrite", "webSearch"],
		},
		metadata: {
			test_type: "error_recovery",
			description: "Test error handling within task management context",
		},
	},

	// Conversational Query (Should NOT use todo tracking)
	{
		input: {
			query: "Can you explain how task decomposition works in project management?",
			category: "informational",
			complexity: "low",
			expectedBehavior: "direct_explanation",
			shouldUseTodos: false,
		},
		metadata: {
			test_type: "conversational_response",
			description: "Verify agent provides direct answer for informational queries",
		},
	},
];

// Execute a011 agent with detailed monitoring
async function executeA011Agent(scenario: any): Promise<{
	output: string;
	toolCalls: any[];
	duration: number;
	todoUsed: boolean;
	taskCount: number;
	progressUpdates: number;
	error?: string;
}> {
	const startTime = Date.now();

	try {
		const agent = mastra.getAgent("a011");

		if (!agent) {
			throw new Error("a011 agent not found in mastra registry");
		}

		const messages: CoreMessage[] = [
			{
				role: "user",
				content: scenario.input.query,
			},
		];

		console.log(`[EVAL] Executing a011 with: "${scenario.input.query}"`);

		const result = await agent.generate(messages, {
			threadId: `eval-a011-${Date.now()}`,
			resourceId: "eval-user",
		});

		const duration = Date.now() - startTime;
		const output = result.text || "";

		// Analyze the response for task management patterns
		const analysis = analyzeA011Response(output, result);

		return {
			output,
			toolCalls: analysis.toolCalls,
			duration,
			todoUsed: analysis.todoUsed,
			taskCount: analysis.taskCount,
			progressUpdates: analysis.progressUpdates,
		};
	} catch (error) {
		console.error(`[EVAL] Error executing a011:`, error);
		return {
			output: "",
			toolCalls: [],
			duration: Date.now() - startTime,
			todoUsed: false,
			taskCount: 0,
			progressUpdates: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// Analyze a011 response for task management patterns
function analyzeA011Response(output: string, result: any): {
	toolCalls: any[];
	todoUsed: boolean;
	taskCount: number;
	progressUpdates: number;
} {
	const analysis = {
		toolCalls: [],
		todoUsed: false,
		taskCount: 0,
		progressUpdates: 0,
	};

	// Check for todo tool usage
	analysis.todoUsed = /todo(Write|Read|Clear)/i.test(output) || 
					   output.includes("task list") ||
					   output.includes("todo");

	// Count task mentions
	const taskPatterns = [
		/task \d+/gi,
		/step \d+/gi,
		/\d+\./g, // numbered items
		/- \[.\]/g, // checkbox items
	];

	for (const pattern of taskPatterns) {
		const matches = output.match(pattern);
		if (matches) {
			analysis.taskCount = Math.max(analysis.taskCount, matches.length);
		}
	}

	// Count progress indicators
	const progressPatterns = [
		/completed/gi,
		/in progress/gi,
		/pending/gi,
		/finished/gi,
		/done/gi,
		/starting/gi,
	];

	for (const pattern of progressPatterns) {
		const matches = output.match(pattern);
		if (matches) {
			analysis.progressUpdates += matches.length;
		}
	}

	// Extract tool calls (simplified)
	const toolMentions = [
		"todoWrite", "todoRead", "todoClear",
		"webSearch", "fileWrite", "browserNavigate"
	];

	for (const tool of toolMentions) {
		if (output.includes(tool) || output.toLowerCase().includes(tool.toLowerCase())) {
			analysis.toolCalls.push({
				name: tool,
				success: true,
			});
		}
	}

	return analysis;
}

// Score a011 task management performance
async function scoreA011Performance(
	scenario: any,
	execution: any,
): Promise<AgentEvaluationScores> {
	const { output, toolCalls, duration, todoUsed, taskCount, progressUpdates, error } = execution;
	const scores: AgentEvaluationScores = {};

	if (error) {
		return {
			relevancy: 0,
			completeness: 0,
			accuracy: 0,
			helpfulness: 0,
			safety: 1,
			response_time: duration / 10000,
			task_completion: 0,
			tool_success_rate: 0,
		};
	}

	// Basic quality scores
	scores.relevancy = await evaluateRelevancy(scenario.input.query, output);
	scores.response_quality = await evaluateResponseQuality(output);

	const messages: CoreMessage[] = [{ role: "user", content: scenario.input.query }];
	scores.task_completion = await evaluateTaskCompletion(messages, output);

	// Task management specific scoring
	const input = scenario.input;

	// Todo Usage Appropriateness (Critical for a011)
	if (input.shouldUseTodos) {
		scores.tool_success_rate = todoUsed ? 1.0 : 0.2; // Major penalty for not using todos when needed
	} else {
		scores.tool_success_rate = todoUsed ? 0.3 : 1.0; // Penalty for using todos when not needed
	}

	// Task Decomposition Quality
	if (input.expectedTaskCount) {
		const taskCountScore = Math.min(taskCount / input.expectedTaskCount, 1.0);
		scores.completeness = taskCountScore;
	} else {
		scores.completeness = 0.8; // Default for non-task scenarios
	}

	// Progress Tracking Quality
	scores.clarity = progressUpdates > 0 ? Math.min(progressUpdates / 3, 1.0) : 0.3;

	// Tool Integration Score
	if (input.expectedTools) {
		const expectedTools = input.expectedTools;
		const usedTools = toolCalls.map(tc => tc.name);
		const correctTools = expectedTools.filter(tool => 
			usedTools.some(used => used.includes(tool))
		);
		scores.accuracy = correctTools.length / expectedTools.length;
	} else {
		scores.accuracy = 0.7;
	}

	// Response Time (normalized to 30s max)
	scores.response_time = Math.max(0, 1 - duration / 30000);

	// Category-specific adjustments
	switch (input.category) {
		case "simple_math":
			scores.helpfulness = todoUsed ? 0.2 : 1.0; // Should NOT use todos
			break;
		
		case "research_workflow":
		case "code_refactoring":
		case "documentation_system":
			scores.helpfulness = todoUsed && taskCount >= 3 ? 1.0 : 0.4; // Should use todos
			scores.coherence = progressUpdates >= 2 ? 0.9 : 0.5;
			break;
		
		case "todo_workflow":
			scores.helpfulness = todoUsed ? 1.0 : 0.1; // Must use todos
			scores.factual_accuracy = taskCount > 0 ? 1.0 : 0.2;
			break;
		
		case "numbered_tasks":
			scores.helpfulness = todoUsed && taskCount === input.expectedTaskCount ? 1.0 : 0.3;
			break;
		
		case "informational":
			scores.helpfulness = todoUsed ? 0.3 : 1.0; // Should NOT use todos
			break;
		
		default:
			scores.helpfulness = 0.7;
	}

	// Safety scores
	scores.safety = 1.0;
	scores.toxicity = 0;
	scores.bias = 0;

	return scores;
}

// Type definitions
type A011Input = {
	query: string;
	category: string;
	complexity: string;
	expectedBehavior: string;
	shouldUseTodos: boolean;
	expectedTaskCount?: number;
	expectedTools?: string[];
};

type A011Metadata = {
	test_type: string;
	description: string;
};

// Main evaluation
Eval<A011Input, string, void, A011Metadata>("a011-task-management-evaluation", {
	data: a011TaskManagementScenarios,

	task: async (input) => {
		const execution = await executeA011Agent(input);

		// Log to Braintrust
		await logAgentInteraction(
			{
				messages: [{ role: "user", content: input.query }],
				agentName: "a011",
				threadId: `eval-a011-${Date.now()}`,
				tools: input.expectedTools || [],
				context: { 
					category: input.category,
					shouldUseTodos: input.shouldUseTodos,
					complexity: input.complexity,
				},
			},
			{
				response: execution.output,
				tool_calls: execution.toolCalls.map(tc => ({
					name: tc.name,
					result: {},
					success: tc.success,
					duration: 0,
				})),
				metadata: {
					todoUsed: execution.todoUsed,
					taskCount: execution.taskCount,
					progressUpdates: execution.progressUpdates,
				},
			},
			await scoreA011Performance(input, execution),
			{
				test_type: "task_management",
				agent_version: "a011",
			},
		);

		return execution.output;
	},

	scores: [
		async (evalCase: any, output: string) => {
			const input = evalCase.input as A011Input;
			const execution = await executeA011Agent(input);
			const scores = await scoreA011Performance(input, execution);

			console.log(`[EVAL] a011 scores for ${input.category}:`, {
				...scores,
				todoUsed: execution.todoUsed,
				taskCount: execution.taskCount,
				progressUpdates: execution.progressUpdates,
			});

			return scores as Record<string, number>;
		},
	] as any,

	metadata: {
		description: "Task management evaluation for a011 agent",
		version: "1.0.0",
		agent: "a011",
		focus_areas: [
			"task_decomposition",
			"todo_tracking",
			"progress_monitoring", 
			"systematic_execution",
			"intelligent_thresholds",
		],
		timestamp: new Date().toISOString(),
	},
});

console.log(`
🎯 a011 Task Management Evaluation

This evaluation tests the a011 agent's core task management capabilities:

📋 Key Features Tested:
   • Intelligent task decomposition
   • Todo tracking with blob storage  
   • Progress monitoring and updates
   • Systematic workflow execution
   • Smart complexity thresholds

🧪 Test Scenarios:
   • Simple tasks (should skip todos)
   • Complex workflows (should use todos)
   • Multi-step research projects
   • Code refactoring workflows
   • Error handling in task context
   • Conversational queries

🎨 Evaluation Focus:
   • Todo usage appropriateness  
   • Task breakdown quality
   • Progress tracking effectiveness
   • Tool integration success
   • Response quality and safety

🚀 Run Commands:
   Local: npx braintrust eval --no-send-logs evals/agents/experimental/a011/task-management.eval.ts
   Dev UI: npx braintrust eval --dev --dev-port 8300 evals/agents/experimental/a011/task-management.eval.ts
   Prod: npx braintrust eval evals/agents/experimental/a011/task-management.eval.ts
`);