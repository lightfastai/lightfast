/**
 * Schemas for worker-specific data structures
 */

import { z } from "zod";

/**
 * Schema for agent decision output
 */
export const AgentDecisionSchema = z.object({
	toolCall: z
		.object({
			id: z.string().describe("Unique identifier for this tool call"),
			name: z.string().describe("Name of the tool to call"),
			args: z.record(z.any()).describe("Arguments to pass to the tool"),
		})
		.optional()
		.describe("Tool call to execute, if any"),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

/**
 * Schema for tool definitions used in generateObject
 */
export const ToolDefinitionSchema = z.object({
	name: z.string(),
	description: z.string(),
	parameters: z.record(z.any()),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Schema for worker configuration
 */
export const WorkerConfigSchema = z.object({
	maxExecutionTime: z.number().default(25000).describe("Maximum execution time in milliseconds"),
	retryAttempts: z.number().default(3).describe("Number of retry attempts for recoverable errors"),
	retryDelay: z.number().default(1000).describe("Delay between retries in milliseconds"),
});

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
