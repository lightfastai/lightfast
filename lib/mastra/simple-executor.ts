import { executeTaskWorkflow as executeTask } from "@/lib/mastra/task-executor-workflow";

export async function executeTaskWorkflow(input: { taskDescription: string; chatId: string; constraints?: string }) {
	// Execute the task workflow with multi-agent orchestration
	return await executeTask(input);
}
