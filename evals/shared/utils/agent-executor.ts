/**
 * Utilities for executing agents in evaluation contexts
 */

import type { CoreMessage } from "ai";
import { mastra } from "../../../mastra";

export interface AgentExecutionResult {
	output: string;
	toolCalls: Array<{ name: string; success: boolean; duration?: number }>;
	duration: number;
	error?: string;
	metadata?: Record<string, unknown>;
}

export interface AgentExecutionOptions {
	threadId?: string;
	resourceId?: string;
	timeout?: number;
	maxSteps?: number;
	maxRetries?: number;
}

/**
 * Generic agent executor that can be used across evaluations
 */
export async function executeAgent(
	agentName: string,
	query: string,
	options: AgentExecutionOptions = {}
): Promise<AgentExecutionResult> {
	const startTime = Date.now();
	const {
		threadId = `eval-${agentName}-${Date.now()}`,
		resourceId = "eval-user",
		timeout = 30000,
		maxSteps = 20,
		maxRetries = 3,
	} = options;

	try {
		const agent = mastra.getAgent(agentName);

		if (!agent) {
			throw new Error(`Agent '${agentName}' not found in mastra registry`);
		}

		const messages: CoreMessage[] = [
			{
				role: "user",
				content: query,
			},
		];

		console.log(`[EVAL] Executing ${agentName} with: "${query}"`);

		// Execute with timeout
		const result = await Promise.race([
			agent.generate(messages, {
				threadId,
				resourceId,
				maxSteps,
				maxRetries,
			}),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Execution timeout")), timeout)
			),
		]) as any;

		const duration = Date.now() - startTime;
		const output = result.text || "";

		// Extract tool calls from result
		const toolCalls = extractToolCallsFromResult(output, result);

		return {
			output,
			toolCalls,
			duration,
			metadata: {
				threadId,
				resourceId,
				agentName,
				maxSteps,
				maxRetries,
			},
		};
	} catch (error) {
		console.error(`[EVAL] Error executing ${agentName}:`, error);
		return {
			output: "",
			toolCalls: [],
			duration: Date.now() - startTime,
			error: error instanceof Error ? error.message : "Unknown error",
			metadata: {
				threadId,
				resourceId,
				agentName,
			},
		};
	}
}

/**
 * Execute multiple agents with the same query for comparison
 */
export async function executeMultipleAgents(
	agentNames: string[],
	query: string,
	options: AgentExecutionOptions = {}
): Promise<Record<string, AgentExecutionResult>> {
	const results: Record<string, AgentExecutionResult> = {};

	// Execute agents in parallel
	const executions = agentNames.map(async (agentName) => {
		const result = await executeAgent(agentName, query, {
			...options,
			threadId: `eval-multi-${agentName}-${Date.now()}`,
		});
		return { agentName, result };
	});

	const completedExecutions = await Promise.all(executions);

	for (const { agentName, result } of completedExecutions) {
		results[agentName] = result;
	}

	return results;
}

/**
 * Extract tool calls from agent result
 * This is a heuristic approach - in production you might have structured tool call data
 */
function extractToolCallsFromResult(output: string, result: any): Array<{ name: string; success: boolean; duration?: number }> {
	const toolCalls: Array<{ name: string; success: boolean; duration?: number }> = [];

	// Common tool patterns to look for
	const toolPatterns = [
		/(?:using|calling|executing)\s+(\w+)\s+tool/gi,
		/tool:\s*(\w+)/gi,
		/(\w+Tool)\s*\(/gi,
		/(webSearch|fileWrite|browserNavigate|todoWrite|todoRead|todoClear)/gi,
	];

	const foundTools = new Set<string>();

	for (const pattern of toolPatterns) {
		const matches = output.matchAll(pattern);
		for (const match of matches) {
			const toolName = match[1];
			if (toolName && !foundTools.has(toolName)) {
				foundTools.add(toolName);
				toolCalls.push({
					name: toolName,
					success: !output.toLowerCase().includes(`${toolName.toLowerCase()} failed`),
				});
			}
		}
	}

	// If we have structured tool call data from the result, use that instead
	if (result.toolCalls && Array.isArray(result.toolCalls)) {
		return result.toolCalls.map((tc: any) => ({
			name: tc.toolName || tc.name || "unknown",
			success: tc.success !== false, // Default to true unless explicitly false
			duration: tc.duration,
		}));
	}

	return toolCalls;
}

/**
 * Create a standardized execution context for consistent testing
 */
export function createEvaluationContext(agentName: string, testSuite: string) {
	const baseThreadId = `eval-${agentName}-${testSuite}`;
	
	return {
		threadId: `${baseThreadId}-${Date.now()}`,
		resourceId: "eval-user",
		testSuite,
		agentName,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Utility to check if an agent exists in the registry
 */
export function validateAgent(agentName: string): boolean {
	try {
		const agent = mastra.getAgent(agentName);
		return agent !== null && agent !== undefined;
	} catch {
		return false;
	}
}

/**
 * Get list of available agents for evaluation
 */
export function getAvailableAgents(): string[] {
	// This would ideally be a method on mastra to list all registered agents
	// For now, we'll return the known agents from the codebase structure
	return [
		"a010",
		"a011", 
		"c010",
		"artifact",
		"browser",
		"download",
		"planner",
		"sandbox",
		"searcher",
		"vision",
		"voice",
	];
}