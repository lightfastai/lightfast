import { taskExecutionChannel } from "@/lib/mastra/realtime";
import {
	analyzeTask,
	cleanupSandbox,
	executeScripts,
	generateScripts,
	setupEnvironment,
	type TaskExecutionState,
} from "@/mastra/agents/task-executor-agents";

export async function executeTaskWorkflow(input: { taskDescription: string; chatId: string; constraints?: string }) {
	const { taskDescription, chatId } = input;
	const channel = taskExecutionChannel(chatId);

	// Initialize state
	const state: TaskExecutionState = {
		chatId,
		taskDescription,
		status: "analyzing",
	};

	try {
		// Send initial status
		channel.status({
			status: "starting",
			message: "Task execution started",
		});

		// Step 1: Analyze task
		state.analysis = await analyzeTask(taskDescription, chatId);
		state.status = "environment-setup";

		// Step 2: Setup environment
		state.environment = await setupEnvironment(state.analysis, chatId);
		state.status = "generating-scripts";

		// Step 3: Generate scripts
		state.scripts = await generateScripts(state.analysis, state.environment, taskDescription, chatId);
		state.status = "executing";

		// Step 4: Execute scripts
		state.executionResults = await executeScripts(state.scripts, state.environment, chatId);
		state.status = "complete";

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
			results: state.executionResults,
			analysis: state.analysis,
			scripts: state.scripts,
		};
	} catch (error) {
		state.status = "error";
		state.error = error instanceof Error ? error.message : "Unknown error";

		channel.status({
			status: "error",
			message: state.error,
		});

		// Clean up sandbox on error
		await cleanupSandbox();

		return {
			success: false,
			chatId,
			error: state.error,
		};
	}
}
