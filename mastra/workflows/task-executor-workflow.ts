import { createStep, createWorkflow } from "@mastra/core";
import { z } from "zod";
import { taskExecutionChannel } from "@/lib/mastra/realtime";
import {
	analyzeTask,
	cleanupSandbox,
	executeScripts,
	generateScripts,
	setupEnvironment,
} from "../agents/task-executor-agents";

// Define schemas
const inputSchema = z.object({
	taskDescription: z.string(),
	chatId: z.string(),
	constraints: z.string().optional(),
});

const outputSchema = z.object({
	success: z.boolean(),
	chatId: z.string(),
	results: z.any().optional(),
	analysis: z.any().optional(),
	scripts: z.any().optional(),
	error: z.string().optional(),
});

// Create the main execution step
const executeTaskStep = createStep({
	id: "execute-task",
	description: "Execute the complete task workflow",
	inputSchema,
	outputSchema,
	execute: async ({ inputData }) => {
		const { taskDescription, chatId } = inputData;
		const channel = taskExecutionChannel(chatId);

		try {
			// Send initial status
			channel.status({
				status: "starting",
				message: "Task execution started",
			});

			// Step 1: Analyze task
			const analysis = await analyzeTask(taskDescription, chatId);

			// Step 2: Setup environment
			const environment = await setupEnvironment(analysis, chatId);

			// Step 3: Generate scripts
			const scripts = await generateScripts(analysis, environment, taskDescription, chatId);

			// Step 4: Execute scripts
			const executionResults = await executeScripts(scripts, environment, chatId);

			// Send completion status
			channel.status({
				status: "completed",
				message: "Task execution completed",
			});

			// Clean up sandbox
			await cleanupSandbox();

			return {
				success: true,
				chatId,
				results: executionResults,
				analysis,
				scripts,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";

			channel.status({
				status: "error",
				message: errorMessage,
			});

			// Clean up sandbox on error
			await cleanupSandbox();

			return {
				success: false,
				chatId,
				error: errorMessage,
			};
		}
	},
});

// Create the workflow using the simple approach
export const taskExecutorWorkflow = createWorkflow({
	id: "task-executor-workflow",
	description: "Multi-agent workflow for executing computational tasks",
	inputSchema,
	outputSchema,
})
	.then(executeTaskStep)
	.commit();
