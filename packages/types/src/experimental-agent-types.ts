import type { Agent } from "@mastra/core";
import type { z } from "zod";

/**
 * Type representing all available experimental agent IDs
 * This provides TypeScript inference throughout the application
 */
export type ExperimentalAgentId = "a010" | "a011";

/**
 * Default experimental agent ID
 */
export const DEFAULT_EXPERIMENTAL_AGENT: ExperimentalAgentId = "a011";

/**
 * Tool Schema Extraction for UI Type System
 */

// Utility type to extract tool schemas from a tools object
type ExtractToolSchemas<TTools> = {
	[K in keyof TTools]: TTools[K] extends {
		inputSchema: infer Input extends z.ZodSchema;
		outputSchema: infer Output extends z.ZodSchema;
	}
		? {
				input: z.infer<Input>;
				output: z.infer<Output>;
			}
		: never;
};

// Generic experimental agent tool schemas type
export type ExperimentalAgentToolSchemas = Record<string, {
	input: unknown;
	output: unknown;
}>;

// Utility types for working with tools
export type ExperimentalAgentToolName = keyof ExperimentalAgentToolSchemas;

export type ExperimentalAgentToolInput<T extends ExperimentalAgentToolName> = ExperimentalAgentToolSchemas[T]["input"];

export type ExperimentalAgentToolOutput<T extends ExperimentalAgentToolName> =
	ExperimentalAgentToolSchemas[T]["output"];

/**
 * Working Memory Schema Types
 */

// Task working memory for a010
export interface TaskWorkingMemory {
	tasks: Array<{
		description: string;
		status: "active" | "in_progress" | "completed";
	}>;
	summary: string;
	lastUpdated?: string;
}

// Simplified working memory for a011
export interface SimplifiedWorkingMemory {
	summary: string;
	lastUpdated: string;
	sandboxId: string | null;
	sandboxDirectory: string;
}

// Map agent IDs to their working memory types
export interface ExperimentalAgentWorkingMemoryMap {
	a010: TaskWorkingMemory;
	a011: SimplifiedWorkingMemory;
}

// Extract working memory type for a specific agent
export type ExperimentalAgentWorkingMemory<T extends ExperimentalAgentId> = ExperimentalAgentWorkingMemoryMap[T];

// Extract task type for a specific agent (only for agents that have tasks)
export type ExperimentalAgentTask<T extends ExperimentalAgentId> = T extends "a010"
	? ExperimentalAgentWorkingMemoryMap[T]["tasks"][number]
	: never;

// Union of all possible task types (only from agents that have tasks)
export type ExperimentalAgentTaskUnion = ExperimentalAgentTask<"a010">;


