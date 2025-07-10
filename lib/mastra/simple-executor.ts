import { taskExecutionChannel } from "@/lib/mastra/realtime";
import {
	analyzeTask,
	cleanupSandbox,
	executeScripts,
	generateScripts,
	setupEnvironment,
} from "@/mastra/agents/task-executor-agents";

export async function executeTaskWorkflow(input: { taskDescription: string; chatId: string; constraints?: string }) {
	const { taskDescription, chatId } = input;
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
}
