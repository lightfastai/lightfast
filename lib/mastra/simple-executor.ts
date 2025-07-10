import { taskExecutorWorkflow } from "@/mastra/workflows/task-executor-workflow";

export async function executeTaskWorkflow(input: { taskDescription: string; chatId: string; constraints?: string }) {
	// Create a workflow run
	const run = await taskExecutorWorkflow.createRunAsync({
		runId: `run-${input.chatId}-${Date.now()}`,
	});

	// Execute the workflow with input data
	const result = await run.start({ inputData: input });

	// Return the workflow result
	return result;
}
