import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Task executor tool for managing task lifecycle in v1.1 agent
 * This tool updates the current task context and tracks tool executions
 */
export const taskExecutorTool = createTool({
	id: "task_executor",
	description: "Manage task execution lifecycle - activate tasks, track tool calls, and mark completion",
	inputSchema: z.object({
		action: z.enum(["activate", "complete", "fail", "log_tool"]).describe("Action to perform on the task"),
		taskId: z.string().describe("ID of the task to update"),
		toolName: z.string().optional().describe("Name of tool executed (for log_tool action)"),
		toolResult: z.string().optional().describe("Summary of tool execution result"),
		notes: z.string().optional().describe("Additional notes about the task or tool execution"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		currentTaskId: z.string().optional(),
		message: z.string(),
	}),
	execute: async ({ context, threadId, resourceId }) => {
		const { action, taskId, toolName, toolResult, notes } = context;

		// In a real implementation, this would update the working memory
		// For now, we'll return a success response
		switch (action) {
			case "activate":
				return {
					success: true,
					currentTaskId: taskId,
					message: `Task ${taskId} activated. Context set for subsequent tool calls.`,
				};

			case "complete":
				return {
					success: true,
					currentTaskId: undefined,
					message: `Task ${taskId} marked as completed.`,
				};

			case "fail":
				return {
					success: true,
					currentTaskId: undefined,
					message: `Task ${taskId} marked as failed. ${notes || ""}`,
				};

			case "log_tool":
				if (!toolName) {
					return {
						success: false,
						message: "Tool name is required for log_tool action",
					};
				}
				return {
					success: true,
					currentTaskId: taskId,
					message: `Logged tool execution: ${toolName} for task ${taskId}. Result: ${toolResult || "Success"}`,
				};

			default:
				return {
					success: false,
					message: `Unknown action: ${action}`,
				};
		}
	},
});
