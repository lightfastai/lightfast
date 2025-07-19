import { z } from "zod";

// Schema for structured task management in working memory
export const taskWorkingMemorySchema = z.object({
	tasks: z
		.array(
			z.object({
				id: z.string().describe("Unique task identifier (e.g., TASK-001)"),
				description: z.string().describe("Clear description of what needs to be done"),
				status: z.enum(["active", "in_progress", "completed"]).describe("Current status of the task"),
				priority: z.enum(["high", "medium", "low"]).describe("Task priority level"),
				notes: z.string().optional().describe("Additional context or progress notes"),
				createdAt: z.string().optional().describe("ISO timestamp when task was created"),
				completedAt: z.string().optional().describe("ISO timestamp when task was completed"),
			}),
		)
		.default([]),
	summary: z.string().optional().describe("Overall progress summary or context"),
	lastUpdated: z.string().optional().describe("ISO timestamp of last update"),
});

export type TaskWorkingMemory = z.infer<typeof taskWorkingMemorySchema>;
