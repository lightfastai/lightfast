import { z } from "zod";

// Schema for tool execution tracking
const toolExecutionSchema = z.object({
	toolName: z.string().describe("Name of the tool executed"),
	executedAt: z.string().describe("ISO timestamp when tool was executed"),
	success: z.boolean().describe("Whether the tool execution succeeded"),
	resultSummary: z.string().optional().describe("Brief summary of the tool result"),
});

// Enhanced schema for task-led workflow in v1.1 agent
export const taskLedWorkingMemorySchema = z.object({
	tasks: z
		.array(
			z.object({
				id: z.string().describe("Unique task identifier (e.g., TASK-001)"),
				description: z.string().describe("Clear description of what needs to be done"),
				status: z.enum(["pending", "active", "completed", "failed"]).describe("Current status of the task"),
				priority: z.enum(["high", "medium", "low"]).describe("Task priority level"),
				requiredTools: z.array(z.string()).describe("List of tools needed for this task"),
				toolCalls: z.array(toolExecutionSchema).default([]).describe("Track tool executions for this task"),
				dependencies: z.array(z.string()).default([]).describe("Task IDs that must complete before this one"),
				notes: z.string().optional().describe("Additional context or progress notes"),
				createdAt: z.string().describe("ISO timestamp when task was created"),
				startedAt: z.string().optional().describe("ISO timestamp when task execution started"),
				completedAt: z.string().optional().describe("ISO timestamp when task was completed"),
			}),
		)
		.default([]),
	currentTaskId: z.string().optional().describe("ID of the currently active task"),
	summary: z.string().describe("Overall progress summary or context"),
	lastUpdated: z.string().describe("ISO timestamp of last update"),
});

export type TaskLedWorkingMemory = z.infer<typeof taskLedWorkingMemorySchema>;

// Helper function to create a new task
export function createTask(params: {
	id: string;
	description: string;
	requiredTools: string[];
	dependencies?: string[];
	priority?: "high" | "medium" | "low";
}): TaskLedWorkingMemory["tasks"][0] {
	return {
		id: params.id,
		description: params.description,
		status: "pending",
		priority: params.priority || "medium",
		requiredTools: params.requiredTools,
		toolCalls: [],
		dependencies: params.dependencies || [],
		createdAt: new Date().toISOString(),
	};
}
