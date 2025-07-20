import type { z } from "zod";
import { a010 } from "./a010";
import { a011 } from "./a011";

/**
 * All experimental agents with their exports
 */
export const experimentalAgents = {
	a010,
	a011,
} as const;

/**
 * Type representing all available experimental agent IDs
 * This provides TypeScript inference throughout the application
 */
export type ExperimentalAgentId = keyof typeof experimentalAgents;

/**
 * Default experimental agent ID
 */
export const DEFAULT_EXPERIMENTAL_AGENT: ExperimentalAgentId = "a010";

// Re-export individual agents for convenience
export { a010, a011 };

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

// Extract tool schemas from each experimental agent
type A010Tools = ExtractToolSchemas<typeof a010.tools>;
type A011Tools = ExtractToolSchemas<typeof a011.tools>;

// Union of all experimental agent tool schemas
export type ExperimentalAgentToolSchemas = A010Tools & A011Tools;

// Utility types for working with tools
export type ExperimentalAgentToolName = keyof ExperimentalAgentToolSchemas;

export type ExperimentalAgentToolInput<T extends ExperimentalAgentToolName> = 
	ExperimentalAgentToolSchemas[T]["input"];

export type ExperimentalAgentToolOutput<T extends ExperimentalAgentToolName> = 
	ExperimentalAgentToolSchemas[T]["output"];

/**
 * Working Memory Schema Extraction for Task Management
 */

// Import the working memory types from agents
import type { TaskWorkingMemory as A010WorkingMemory } from "./a010";
import type { TaskLedWorkingMemory as A011WorkingMemory } from "./a011";

// Map agent IDs to their working memory types
export interface ExperimentalAgentWorkingMemoryMap {
	a010: A010WorkingMemory;
	a011: A011WorkingMemory;
}

// Extract working memory type for a specific agent
export type ExperimentalAgentWorkingMemory<T extends ExperimentalAgentId> = 
	ExperimentalAgentWorkingMemoryMap[T];

// Extract task type for a specific agent
export type ExperimentalAgentTask<T extends ExperimentalAgentId> = 
	ExperimentalAgentWorkingMemoryMap[T]["tasks"][number];

// Union of all possible task types
export type ExperimentalAgentTaskUnion = {
	[K in ExperimentalAgentId]: ExperimentalAgentTask<K>
}[ExperimentalAgentId];