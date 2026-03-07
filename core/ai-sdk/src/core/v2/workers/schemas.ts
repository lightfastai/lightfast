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
			id: z.string().meta({ description: "Unique identifier for this tool call" }),
			name: z.string().meta({ description: "Name of the tool to call" }),
			args: z.record(z.string(), z.any()).meta({ description: "Arguments to pass to the tool" }),
		})
		.optional()
		.meta({ description: "Tool call to execute, if any" }),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

/**
 * Schema for tool definitions used in generateObject
 */
export const ToolDefinitionSchema = z.object({
	name: z.string(),
	description: z.string(),
	inputSchema: z.record(z.string(), z.any()),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Schema for worker configuration
 */
export const WorkerConfigSchema = z.object({
	maxExecutionTime: z
		.number()
		.default(25000)
		.meta({ description: "Maximum execution time in milliseconds" }),
	retryAttempts: z
		.number()
		.default(3)
		.meta({ description: "Number of retry attempts for recoverable errors" }),
	retryDelay: z
		.number()
		.default(1000)
		.meta({ description: "Delay between retries in milliseconds" }),
});

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
