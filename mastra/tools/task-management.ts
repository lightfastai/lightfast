import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Task Management Tool for V1 Agent
 * Integrates with working memory to provide structured task tracking
 */
export const taskManagementTool = createTool({
	id: "task-management",
	description: "Manage tasks in working memory with structured tracking (add, update, complete tasks)",
	inputSchema: z.object({
		action: z.enum(["add", "add_batch", "update", "complete", "list", "clear"]).describe("Action to perform"),
		taskId: z.string().optional().describe("Task ID (e.g., TASK-001) - required for update/complete"),
		description: z.string().optional().describe("Task description - required for add/update"),
		priority: z.enum(["high", "medium", "low"]).optional().describe("Task priority - optional for add/update"),
		status: z.enum(["active", "in_progress", "completed"]).optional().describe("Task status - optional for update"),
		notes: z.string().optional().describe("Additional notes for the task"),
		tasks: z.array(z.object({
			description: z.string().describe("Task description"),
			priority: z.enum(["high", "medium", "low"]).default("medium").describe("Task priority"),
			notes: z.string().optional().describe("Additional notes for the task"),
		})).optional().describe("Array of tasks for batch operations - required for add_batch"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		currentTasks: z.array(z.object({
			id: z.string(),
			description: z.string(),
			priority: z.enum(["high", "medium", "low"]),
			status: z.enum(["active", "in_progress", "completed"]),
			notes: z.string().optional(),
		})).optional(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		const { action, taskId, description, priority, status, notes, tasks } = context;

		try {
			switch (action) {
				case "add":
					if (!description) {
						return {
							success: false,
							message: "Description is required when adding a task",
						};
					}
					
					// Generate task ID if not provided
					const newTaskId = taskId || `TASK-${Date.now().toString().slice(-6)}`;
					
					return {
						success: true,
						message: `Task ${newTaskId} added successfully`,
						currentTasks: [{
							id: newTaskId,
							description,
							priority: priority || "medium",
							status: "active" as const,
							notes,
						}],
					};

				case "add_batch":
					if (!tasks || tasks.length === 0) {
						return {
							success: false,
							message: "Tasks array is required when adding tasks in batch",
						};
					}
					
					// Generate unique task IDs for each task
					const timestamp = Date.now();
					const batchTasks = tasks.map((task, index) => ({
						id: `TASK-${(timestamp + index).toString().slice(-6)}`,
						description: task.description,
						priority: task.priority,
						status: "active" as const,
						notes: task.notes,
					}));
					
					return {
						success: true,
						message: `Successfully added ${batchTasks.length} tasks`,
						currentTasks: batchTasks,
					};

				case "update":
					if (!taskId) {
						return {
							success: false,
							message: "Task ID is required for updating",
						};
					}
					
					return {
						success: true,
						message: `Task ${taskId} updated successfully`,
						currentTasks: [{
							id: taskId,
							description: description || "Task description updated",
							priority: priority || "medium",
							status: (status || "in_progress") as "active" | "in_progress" | "completed",
							notes,
						}],
					};

				case "complete":
					if (!taskId) {
						return {
							success: false,
							message: "Task ID is required for completing",
						};
					}
					
					return {
						success: true,
						message: `Task ${taskId} completed successfully`,
						currentTasks: [{
							id: taskId,
							description: description || "Task completed",
							priority: priority || "medium",
							status: "completed" as const,
							notes,
						}],
					};

				case "list":
					return {
						success: true,
						message: "Current task list retrieved from working memory",
						currentTasks: [],
					};

				case "clear":
					return {
						success: true,
						message: "All tasks cleared from working memory",
						currentTasks: [],
					};

				default:
					return {
						success: false,
						message: `Unknown action: ${action}`,
					};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: `Task management error: ${errorMessage}`,
			};
		}
	},
});

/**
 * Auto Task Detection Tool
 * Automatically detects when task management should be activated
 */
export const autoTaskDetectionTool = createTool({
	id: "auto-task-detection",
	description: "Automatically detect if a user request requires task management and suggest breakdown",
	inputSchema: z.object({
		userRequest: z.string().describe("The user's request to analyze"),
		currentContext: z.string().optional().describe("Current conversation context"),
	}),
	outputSchema: z.object({
		shouldUseTaskManagement: z.boolean(),
		reasoning: z.string(),
		suggestedTasks: z.array(z.object({
			description: z.string(),
			priority: z.enum(["high", "medium", "low"]),
			estimatedSteps: z.number(),
			notes: z.string().optional(),
		})).optional(),
	}),
	execute: async ({ context }) => {
		const { userRequest, currentContext } = context;

		// Simple heuristics for task detection
		const complexityIndicators = [
			/\b(step|steps|phase|phases)\b/i,
			/\b(first|second|third|then|next|after|before)\b/i,
			/\b(create|build|implement|develop|setup|configure)\b/i,
			/\b(and|also|additionally|furthermore|moreover)\b/i,
			/\b(multiple|several|various|different)\b/i,
			/\b(complete|comprehensive|full|entire)\b/i,
		];

		const multiTaskIndicators = [
			/\d+\.\s/g, // Numbered lists
			/[-*]\s/g,  // Bullet points
			/\b(and|then|also|plus)\b/gi, // Conjunctions
		];

		const complexityScore = complexityIndicators.reduce((score, pattern) => {
			return score + (pattern.test(userRequest) ? 1 : 0);
		}, 0);

		const multiTaskMatches = multiTaskIndicators.reduce((count, pattern) => {
			return count + (userRequest.match(pattern) || []).length;
		}, 0);

		const shouldUseTaskManagement = complexityScore >= 2 || multiTaskMatches >= 2 || userRequest.length > 200;

		if (shouldUseTaskManagement) {
			// Generate suggested task breakdown
			const suggestedTasks: Array<{
				description: string;
				priority: "high" | "medium" | "low";
				estimatedSteps: number;
				notes?: string;
			}> = [];
			
			// Extract numbered items
			const numberedItems = userRequest.match(/\d+\.\s*([^.]+)/g);
			if (numberedItems) {
				numberedItems.forEach((item, index) => {
					suggestedTasks.push({
						description: item.replace(/^\d+\.\s*/, '').trim(),
						priority: "medium" as const,
						estimatedSteps: 1,
					});
				});
			}

			// Extract bullet points
			const bulletItems = userRequest.match(/[-*]\s*([^-*\n]+)/g);
			if (bulletItems && suggestedTasks.length === 0) {
				bulletItems.forEach((item, index) => {
					suggestedTasks.push({
						description: item.replace(/^[-*]\s*/, '').trim(),
						priority: "medium" as const,
						estimatedSteps: 1,
					});
				});
			}

			return {
				shouldUseTaskManagement: true,
				reasoning: `Request complexity score: ${complexityScore}, multi-task indicators: ${multiTaskMatches}. This appears to be a multi-step request that would benefit from structured task management.`,
				suggestedTasks: suggestedTasks.length > 0 ? suggestedTasks : undefined,
			};
		}

		return {
			shouldUseTaskManagement: false,
			reasoning: `Request appears to be simple and straightforward. Complexity score: ${complexityScore}, multi-task indicators: ${multiTaskMatches}.`,
		};
	},
});