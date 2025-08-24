import type { RuntimeContext } from "lightfast/server/adapters/types";
import { createTool } from "lightfast/tool";
import { del, put } from "@vercel/blob";
import { currentSpan, wrapTraced } from "braintrust";
import { z } from "zod";
import type { AppRuntimeContext } from "@/app/(v1)/ai/types";
import { env } from "@/env";

const taskSchema = z.object({
	id: z.string().describe("Unique task identifier (e.g., TASK-001)"),
	content: z.string().min(1).describe("Brief description of the task"),
	status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status of the task"),
	priority: z.enum(["high", "medium", "low"]).describe("Task priority level"),
	notes: z.string().optional().describe("Additional context or progress notes"),
	createdAt: z.string().describe("ISO timestamp when task was created"),
	startedAt: z.string().optional().describe("ISO timestamp when task execution started"),
	completedAt: z.string().optional().describe("ISO timestamp when task was completed"),
});

type Task = z.infer<typeof taskSchema>;

/**
 * Wrapped todo write execution function with Braintrust tracing
 */
const executeTodoWrite = wrapTraced(
	async function executeTodoWrite(
		{
			tasks,
		}: {
			tasks: Task[];
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		try {
			// Count task statuses
			const completedCount = tasks.filter((t: Task) => t.status === "completed").length;
			const pendingCount = tasks.filter((t: Task) => t.status === "pending").length;
			const inProgressCount = tasks.filter((t: Task) => t.status === "in_progress").length;
			const cancelledCount = tasks.filter((t: Task) => t.status === "cancelled").length;

			// Log metadata
			currentSpan().log({
				metadata: {
					taskCount: tasks.length,
					statusBreakdown: {
						pending: pendingCount,
						inProgress: inProgressCount,
						completed: completedCount,
						cancelled: cancelledCount,
					},
					taskPriorities: {
						high: tasks.filter((t) => t.priority === "high").length,
						medium: tasks.filter((t) => t.priority === "medium").length,
						low: tasks.filter((t) => t.priority === "low").length,
					},
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			// Generate markdown content
			const todoContent = generateTodoMarkdown(tasks);

			// Store in blob with thread-scoped path
			const blobPath = `todos/shared/${context.sessionId}/todo.md`;
			const blob = await put(blobPath, todoContent, {
				access: "public",
				contentType: "text/markdown",
				allowOverwrite: true,
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				message: `Todo list updated: ${pendingCount} pending, ${inProgressCount} in progress, ${completedCount} completed`,
				blobUrl: blob.url,
				taskSummary: {
					total: tasks.length,
					pending: pendingCount,
					inProgress: inProgressCount,
					completed: completedCount,
					cancelled: cancelledCount,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
					},
				},
			});
			return {
				success: false,
				message: `Failed to update todo list: ${errorMessage}`,
			};
		}
	},
	{ type: "tool", name: "todoWrite" },
);

/**
 * Create todo write tool with injected runtime context
 */
export const todoWriteTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description:
		"Create and update a todo list for the current conversation thread. Use this tool to plan multi-step tasks, track progress, and ensure nothing is forgotten.",
	inputSchema: z.object({
		tasks: z.array(taskSchema).describe("The updated task list"),
	}),
	execute: executeTodoWrite,
});

/**
 * Wrapped todo read execution function with Braintrust tracing
 */
const executeTodoRead = wrapTraced(
	async function executeTodoRead(_params: {}, context: RuntimeContext<AppRuntimeContext>) {
		try {
			const blobPath = `todos/shared/${context.sessionId}/todo.md`;

			// Log metadata
			currentSpan().log({
				metadata: {
					blobPath,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			// Try to fetch the blob
			const response = await fetch(`https://vercel.blob.store/${blobPath}`);

			if (!response.ok) {
				if (response.status === 404) {
					return {
						success: true,
						message: "No todo list found for this thread",
						tasks: [],
					};
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const todoContent = await response.text();
			const tasks = parseTodoMarkdown(todoContent);

			const completedCount = tasks.filter((t: Task) => t.status === "completed").length;
			const pendingCount = tasks.filter((t: Task) => t.status === "pending").length;
			const inProgressCount = tasks.filter((t: Task) => t.status === "in_progress").length;
			const cancelledCount = tasks.filter((t: Task) => t.status === "cancelled").length;

			// Log task statistics
			currentSpan().log({
				metadata: {
					taskCount: tasks.length,
					statusBreakdown: {
						pending: pendingCount,
						inProgress: inProgressCount,
						completed: completedCount,
						cancelled: cancelledCount,
					},
				},
			});

			return {
				success: true,
				message: `Todo list loaded: ${pendingCount} pending, ${inProgressCount} in progress, ${completedCount} completed`,
				tasks,
				taskSummary: {
					total: tasks.length,
					pending: pendingCount,
					inProgress: inProgressCount,
					completed: completedCount,
					cancelled: cancelledCount,
				},
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
					},
				},
			});
			return {
				success: false,
				message: `Failed to read todo list: ${errorMessage}`,
				tasks: [],
			};
		}
	},
	{ type: "tool", name: "todoRead" },
);

/**
 * Create todo read tool with injected runtime context
 */
export const todoReadTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Read the current todo list for this conversation thread",
	inputSchema: z.object({}),
	execute: executeTodoRead,
});

/**
 * Wrapped todo clear execution function with Braintrust tracing
 */
const executeTodoClear = wrapTraced(
	async function executeTodoClear(_params: {}, context: RuntimeContext<AppRuntimeContext>) {
		try {
			const blobPath = `todos/shared/${context.sessionId}/todo.md`;

			// Log metadata
			currentSpan().log({
				metadata: {
					blobPath,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			await del(blobPath, {
				token: env.BLOB_READ_WRITE_TOKEN,
			});

			return {
				success: true,
				message: "Todo list cleared for this thread",
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
					},
				},
			});
			return {
				success: false,
				message: `Failed to clear todo list: ${errorMessage}`,
			};
		}
	},
	{ type: "tool", name: "todoClear" },
);

/**
 * Create todo clear tool with injected runtime context
 */
export const todoClearTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Clear the todo list for the current conversation thread",
	inputSchema: z.object({}),
	execute: executeTodoClear,
});

/**
 * Generate markdown content from tasks array
 */
function generateTodoMarkdown(tasks: Task[]): string {
	const now = new Date().toISOString();

	let content = `# Todo List\n\n`;
	content += `*Last updated: ${now}*\n\n`;

	if (tasks.length === 0) {
		content += `No tasks yet.\n`;
		return content;
	}

	// Group tasks by status
	const groupedTasks = {
		pending: tasks.filter((t) => t.status === "pending"),
		in_progress: tasks.filter((t) => t.status === "in_progress"),
		completed: tasks.filter((t) => t.status === "completed"),
		cancelled: tasks.filter((t) => t.status === "cancelled"),
	};

	// In Progress
	if (groupedTasks.in_progress.length > 0) {
		content += `## 🔄 In Progress\n\n`;
		for (const task of groupedTasks.in_progress) {
			content += formatTaskMarkdown(task);
		}
		content += `\n`;
	}

	// Pending
	if (groupedTasks.pending.length > 0) {
		content += `## 📋 Pending\n\n`;
		for (const task of groupedTasks.pending) {
			content += formatTaskMarkdown(task);
		}
		content += `\n`;
	}

	// Completed
	if (groupedTasks.completed.length > 0) {
		content += `## ✅ Completed\n\n`;
		for (const task of groupedTasks.completed) {
			content += formatTaskMarkdown(task);
		}
		content += `\n`;
	}

	// Cancelled
	if (groupedTasks.cancelled.length > 0) {
		content += `## ❌ Cancelled\n\n`;
		for (const task of groupedTasks.cancelled) {
			content += formatTaskMarkdown(task);
		}
		content += `\n`;
	}

	return content;
}

/**
 * Format a single task as markdown
 */
function formatTaskMarkdown(task: Task): string {
	const priorityEmoji = task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢";
	const statusIcon = getStatusIcon(task.status);

	let content = `### ${statusIcon} ${task.id}: ${task.content}\n\n`;
	content += `**Priority:** ${priorityEmoji} ${task.priority}\n`;
	content += `**Created:** ${new Date(task.createdAt).toLocaleString()}\n`;

	if (task.startedAt) {
		content += `**Started:** ${new Date(task.startedAt).toLocaleString()}\n`;
	}

	if (task.completedAt) {
		content += `**Completed:** ${new Date(task.completedAt).toLocaleString()}\n`;
	}

	if (task.notes) {
		content += `**Notes:** ${task.notes}\n`;
	}

	content += `\n`;
	return content;
}

/**
 * Get status icon for task
 */
function getStatusIcon(status: Task["status"]): string {
	switch (status) {
		case "pending":
			return "⏳";
		case "in_progress":
			return "🔄";
		case "completed":
			return "✅";
		case "cancelled":
			return "❌";
		default:
			return "📋";
	}
}

/**
 * Parse markdown content back into tasks array
 * This is a simplified parser - in production you might want more robust parsing
 */
function parseTodoMarkdown(content: string): Task[] {
	const tasks: Task[] = [];

	// This is a basic implementation - could be enhanced with proper markdown parsing
	const lines = content.split("\n");
	let currentTask: Partial<Task> | null = null;

	for (const line of lines) {
		// Look for task headers (### with status icon)
		const taskHeaderMatch = /^### [⏳🔄✅❌📋] (.+): (.+)$/u.exec(line);
		if (taskHeaderMatch) {
			// Save previous task if exists
			if (currentTask?.id && currentTask.content) {
				tasks.push(currentTask as Task);
			}

			// Start new task
			currentTask = {
				id: taskHeaderMatch[1],
				content: taskHeaderMatch[2],
				status: "pending", // Will be updated when we parse status
				priority: "medium", // Default, will be updated
				createdAt: new Date().toISOString(), // Default, will be updated
			};
			continue;
		}

		if (currentTask) {
			// Parse priority
			const priorityMatch = /\*\*Priority:\*\* [🔴🟡🟢] (high|medium|low)/u.exec(line);
			if (priorityMatch) {
				currentTask.priority = priorityMatch[1] as Task["priority"];
				continue;
			}

			// Parse created date
			const createdMatch = /\*\*Created:\*\* (.+)/.exec(line);
			if (createdMatch) {
				if (createdMatch[1]) {
					currentTask.createdAt = new Date(createdMatch[1]).toISOString();
				}
				continue;
			}

			// Parse started date
			const startedMatch = /\*\*Started:\*\* (.+)/.exec(line);
			if (startedMatch) {
				if (startedMatch[1]) {
					currentTask.startedAt = new Date(startedMatch[1]).toISOString();
				}
				continue;
			}

			// Parse completed date
			const completedMatch = /\*\*Completed:\*\* (.+)/.exec(line);
			if (completedMatch) {
				if (completedMatch[1]) {
					currentTask.completedAt = new Date(completedMatch[1]).toISOString();
				}
				continue;
			}

			// Parse notes
			const notesMatch = /\*\*Notes:\*\* (.+)/.exec(line);
			if (notesMatch) {
				currentTask.notes = notesMatch[1];
			}
		}
	}

	// Save last task
	if (currentTask?.id && currentTask.content) {
		tasks.push(currentTask as Task);
	}

	// Infer status from section headers
	const statusSections = {
		"🔄 In Progress": "in_progress" as const,
		"📋 Pending": "pending" as const,
		"✅ Completed": "completed" as const,
		"❌ Cancelled": "cancelled" as const,
	};

	let currentStatus: Task["status"] = "pending";
	const finalTasks: Task[] = [];
	let taskIndex = 0;

	for (const line of lines) {
		// Check for status section headers
		for (const [sectionName, status] of Object.entries(statusSections)) {
			if (line.includes(sectionName)) {
				currentStatus = status;
				break;
			}
		}

		// When we hit a task header, assign the current status
		if (/^### [⏳🔄✅❌📋]/u.exec(line)) {
			if (tasks[taskIndex]) {
				const task = tasks[taskIndex];
				if (task) {
					finalTasks.push({
						...task,
						status: currentStatus,
					});
					taskIndex++;
				}
			}
		}
	}

	return finalTasks;
}
