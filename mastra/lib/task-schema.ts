import { z } from "zod";

export const TaskStatus = z.enum(["active", "in_progress", "completed"]);
export const TaskPriority = z.enum(["high", "medium", "low"]);

export const TaskSchema = z.object({
	id: z.string(),
	description: z.string(),
	status: TaskStatus,
	priority: TaskPriority,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	completedAt: z.string().datetime().optional(),
	notes: z.string().optional(),
});

export const TaskMemorySchema = z.object({
	tasks: z.array(TaskSchema),
	lastUpdated: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskMemory = z.infer<typeof TaskMemorySchema>;
export type TaskStatusType = z.infer<typeof TaskStatus>;
export type TaskPriorityType = z.infer<typeof TaskPriority>;
