/**
 * Type-safe utilities for agent evaluations with Mastra integration
 */

import type { Agent, Metric, ToolAction } from "@mastra/core";
import type { CoreMessage, GenerateTextResult, StepResult, ToolCallUnion, ToolSet } from "ai";
import type { z } from "zod";

// Extract types from Agent's generate method since they're not exported
type ExtractGenerateOptions<T> = T extends (messages: CoreMessage[], options?: infer O) => unknown ? O : never;

type AgentGenerateOptions = NonNullable<ExtractGenerateOptions<Agent["generate"]>>;

// Define AgentMemoryOption based on the actual structure
type AgentMemoryOption = {
	thread: string | { id: string; [key: string]: unknown };
	resource: string;
	options?: Record<string, unknown>;
};

/**
 * Base test scenario interface that can be extended by specific agents
 */
export interface BaseTestScenario {
	input: string;
	expected: string;
	metadata: {
		category: string;
		description: string;
		expectedToolCalls?: string[];
		minDuration?: number;
		maxDuration?: number;
	};
	contextMessages?: CoreMessage[];
}

/**
 * Tool call metrics for tracking usage
 */
export interface ToolCallMetrics {
	[toolName: string]: number;
}

/**
 * Base execution result interface
 */
export interface BaseExecutionResult {
	output: string;
	toolCalls: string[];
	toolCallMetrics: ToolCallMetrics;
	duration: number;
	steps: number;
	error?: string;
	threadId: string;
	resourceId: string;
}

/**
 * Extract tool names from an agent's tools
 */
export type ExtractToolNames<TTools extends ToolsInput> = keyof TTools & string;

/**
 * Create a type-safe agent executor
 */
// Type aliases for Mastra's input types
type ToolsInput = Record<string, ToolAction<any, any, any>>;
type MetricsInput = Record<string, Metric>;

// The Agent type from Mastra has complex generic constraints for tools (ToolAction) and metrics
// We use proper type aliases to match Mastra's expectations
export function createAgentExecutor<
	TAgent extends Agent<string, ToolsInput, MetricsInput>,
	TResult extends BaseExecutionResult = BaseExecutionResult,
>(agent: TAgent) {
	return async function executeAgent(
		input: string,
		options?: {
			threadId?: string;
			resourceId?: string;
			memory?: AgentMemoryOption;
			contextMessages?: CoreMessage[];
		},
	): Promise<TResult> {
		const startTime = Date.now();
		const threadId = options?.threadId || `eval-${agent.name}-${Date.now()}`;
		const resourceId = options?.resourceId || "eval-user";

		try {
			console.log(`[EVAL] Executing ${agent.name}: "${input}"`);
			console.log(`[EVAL] Thread: ${threadId}, Resource: ${resourceId}`);

			// Build messages
			const messages: CoreMessage[] = [
				...(options?.contextMessages || []),
				{
					role: "user" as const,
					content: input,
				},
			];

			// Type-safe generate options
			const generateOptions = {
				memory: options?.memory || {
					thread: threadId,
					resource: resourceId,
				},
				runId: `run-${Date.now()}`,
			} satisfies Partial<AgentGenerateOptions>;

			// Execute agent with proper typing
			const result = (await agent.generate(messages, generateOptions)) as GenerateTextResult<ToolSet, unknown>;
			const duration = Date.now() - startTime;

			// Extract results
			let output = result.text || "";
			const toolCalls: string[] = [];
			const toolCallMetrics: ToolCallMetrics = {};

			// Process steps
			if (result.steps && result.steps.length > 0) {
				result.steps.forEach((step: StepResult<ToolSet>) => {
					if (step.text) {
						output = output || step.text;
					}

					if (step.toolCalls && step.toolCalls.length > 0) {
						step.toolCalls.forEach((toolCall) => {
							const toolName = toolCall.toolName;
							toolCalls.push(toolName);
							toolCallMetrics[toolName] = (toolCallMetrics[toolName] || 0) + 1;
						});
					}
				});
			}

			console.log(`[EVAL] Completed in ${duration}ms`);
			console.log(`[EVAL] Tools used: ${toolCalls.join(", ") || "none"}`);
			console.log(`[EVAL] Steps: ${result.steps?.length || 0}`);

			return {
				output,
				toolCalls,
				toolCallMetrics,
				duration,
				steps: result.steps?.length || 0,
				threadId,
				resourceId,
			} as unknown as TResult;
		} catch (error) {
			console.error(`[EVAL] Error:`, error);
			return {
				output: "",
				toolCalls: [],
				toolCallMetrics: {},
				duration: Date.now() - startTime,
				steps: 0,
				error: error instanceof Error ? error.message : "Unknown error",
				threadId,
				resourceId,
			} as unknown as TResult;
		}
	};
}

/**
 * Base scoring interface
 */
export interface BaseScores {
	task_completion: number;
	output_quality: number;
	relevancy: number;
	error_handling: number;
	[key: string]: number;
}

/**
 * Calculate basic relevancy score
 */
export function calculateRelevancy(input: string, output: string): number {
	const inputWords = input
		.toLowerCase()
		.split(" ")
		.filter((w) => w.length > 3);
	const outputLower = output.toLowerCase();
	const relevantWords = inputWords.filter((word) => outputLower.includes(word));

	return inputWords.length > 0 ? relevantWords.length / inputWords.length : 0.5;
}

/**
 * Calculate output quality score
 */
export function calculateOutputQuality(output: string): number {
	const hasStructure = output.includes("\n") || output.includes("- ");
	const hasDetail = output.length > 50;
	const isCoherent = output.split(". ").length > 1;

	let score = 0.3;
	if (hasStructure) score += 0.2;
	if (hasDetail) score += 0.3;
	if (isCoherent) score += 0.2;

	return Math.min(score, 1.0);
}

/**
 * Calculate performance score based on duration
 */
export function calculatePerformanceScore(
	duration: number,
	expectations?: { minDuration?: number; maxDuration?: number },
): number {
	if (expectations?.minDuration && duration < expectations.minDuration) {
		return 0.5;
	}
	if (expectations?.maxDuration && duration > expectations.maxDuration) {
		return 0.5;
	}

	if (duration < 500) return 1.0;
	if (duration < 2000) return 0.9;
	if (duration < 5000) return 0.7;
	if (duration < 10000) return 0.5;
	return 0.3;
}

/**
 * Calculate tool usage accuracy
 */
export function calculateToolUsageAccuracy(actualTools: string[], expectedTools?: string[]): number {
	if (!expectedTools || expectedTools.length === 0) return 0.8;

	const expected = new Set(expectedTools);
	const actual = new Set(actualTools);

	let correctTools = 0;
	expected.forEach((tool) => {
		if (actual.has(tool)) correctTools++;
	});

	const unexpectedTools = actualTools.filter((t) => !expected.has(t)).length;
	const penalty = unexpectedTools * 0.1;

	return Math.max(0, correctTools / expected.size - penalty);
}

/**
 * Type guard for checking if a value is a test scenario
 */
export function isTestScenario<T extends BaseTestScenario>(value: T | string | unknown): value is T {
	return typeof value === "object" && value !== null && "input" in value && "expected" in value && "metadata" in value;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format tool metrics for display
 */
export function formatToolMetrics(metrics: ToolCallMetrics): string {
	return (
		Object.entries(metrics)
			.map(([tool, count]) => `${tool}(${count})`)
			.join(", ") || "none"
	);
}
