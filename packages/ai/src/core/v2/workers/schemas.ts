/**
 * Schemas for worker-specific data structures
 */

import { z } from "zod";

/**
 * Schema for agent decision output from generateObject
 */
export const AgentDecisionSchema = z.object({
	action: z.enum(["tool_call", "complete"]).describe("The action the agent decided to take"),
	reasoning: z.string().describe("The agent's reasoning for this decision"),
	toolCall: z
		.object({
			tool: z.string().describe("Name of the tool to call"),
			arguments: z.record(z.any()).describe("Arguments to pass to the tool"),
		})
		.optional()
		.describe("Tool call details if action is tool_call"),
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
 * Schema for agent session state
 */
export const AgentSessionStateSchema = z.object({
	sessionId: z.string(),
	messages: z.array(
		z.object({
			role: z.enum(["system", "user", "assistant", "tool"]),
			content: z.string(),
			toolCallId: z.string().optional(),
			toolName: z.string().optional(),
		}),
	),
	status: z.enum(["initializing", "processing", "waiting_for_tool", "completed", "error"]),
	iteration: z.number().default(0),
	maxIterations: z.number().default(10),
	temperature: z.number().default(0.7),
	tools: z.array(z.string()).optional(),
	systemPrompt: z.string().optional(),
	metadata: z.record(z.any()).optional(),
	createdAt: z.string(),
	updatedAt: z.string().optional(),
});

export type AgentSessionState = z.infer<typeof AgentSessionStateSchema>;

/**
 * Schema for worker configuration
 */
export const WorkerConfigSchema = z.object({
	maxExecutionTime: z.number().default(25000).describe("Maximum execution time in milliseconds"),
	retryAttempts: z.number().default(3).describe("Number of retry attempts for recoverable errors"),
	retryDelay: z.number().default(1000).describe("Delay between retries in milliseconds"),
});

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
