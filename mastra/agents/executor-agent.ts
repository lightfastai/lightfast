import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core";
import { generateObject } from "ai";
import { z } from "zod";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

// Schema for step execution input
export const stepExecutionInputSchema = z.object({
	stepNumber: z.number(),
	title: z.string(),
	description: z.string(),
	command: z.string(),
	expectedOutput: z.string(),
	previousResults: z
		.array(
			z.object({
				stepNumber: z.number(),
				output: z.string(),
				success: z.boolean(),
			}),
		)
		.optional(),
});

// Schema for step execution result
export const stepExecutionResultSchema = z.object({
	stepNumber: z.number(),
	success: z.boolean(),
	output: z.string(),
	error: z.string().optional(),
	duration: z.number(),
	filesCreated: z.array(z.string()).optional(),
	insights: z.string().describe("Key insights or important information from this step"),
});

export type StepExecutionInput = z.infer<typeof stepExecutionInputSchema>;
export type StepExecutionResult = z.infer<typeof stepExecutionResultSchema>;

export const executorAgent = new Agent({
	name: "executorAgent",
	description: "Executes individual steps in a sandbox environment",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `You are a step execution agent that runs commands in a sandbox environment.

Your role is to:
1. Take a single step from the task plan
2. Execute the command in the sandbox
3. Capture and analyze the output
4. Report success/failure with insights

Guidelines:
- Execute commands exactly as specified
- Handle errors gracefully
- Capture all relevant output
- Identify key information from the results
- Note any files created or modified
- Consider the context from previous steps

You have access to a full Linux sandbox with:
- File system operations
- Package managers (npm, pip, dnf)
- Programming languages (Node.js, Python, Bash)
- Network access
- Standard Linux tools

Focus on accurate execution and meaningful result extraction.`,
});

// Shared sandbox instance for the executor
let executorSandbox: SandboxExecutor | null = null;

// Helper function to execute a step
export async function executeStep(step: StepExecutionInput, sandbox?: SandboxExecutor): Promise<StepExecutionResult> {
	// Use provided sandbox or create/reuse the executor's sandbox
	const activeSandbox = sandbox || (executorSandbox = executorSandbox || new SandboxExecutor());

	const startTime = Date.now();

	try {
		// Initialize sandbox if needed
		if (!sandbox && !executorSandbox) {
			await activeSandbox.initialize();
		}

		// Execute the command
		const result = await activeSandbox.executeScript(step.command, "bash");

		// Analyze the output to extract insights
		const analysisResult = await generateObject({
			model: anthropic("claude-4-sonnet-20250514"),
			prompt: `Analyze this command execution result:

Command: ${step.command}
Expected: ${step.expectedOutput}
Actual Output: ${result.stdout}
Error Output: ${result.stderr}
Success: ${result.success}

Extract key insights and important information from this execution.`,
			schema: z.object({
				insights: z.string(),
				filesCreated: z.array(z.string()).optional(),
			}),
		});

		return {
			stepNumber: step.stepNumber,
			success: result.success,
			output: result.stdout,
			error: result.stderr || undefined,
			duration: Date.now() - startTime,
			filesCreated: analysisResult.object.filesCreated,
			insights: analysisResult.object.insights,
		};
	} catch (error) {
		return {
			stepNumber: step.stepNumber,
			success: false,
			output: "",
			error: error instanceof Error ? error.message : "Unknown error",
			duration: Date.now() - startTime,
			insights: "Step execution failed due to an error",
		};
	}
}

// Cleanup function for the executor sandbox
export async function cleanupExecutorSandbox() {
	if (executorSandbox) {
		await executorSandbox.cleanup();
		executorSandbox = null;
	}
}
