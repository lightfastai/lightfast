import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { simpleSandboxExecutor } from "../agents/simple-sandbox-executor";
import { cleanupSandbox } from "../tools/enhanced-execute-command-tool";

// Step 1: Execute task
const executeTaskStep = createStep({
	id: "execute-task",
	description: "Execute commands in sandbox",
	inputSchema: z.object({
		task: z.string().describe("The task to accomplish"),
		context: z.string().optional().describe("Additional context or requirements"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		output: z.string(),
		summary: z.string(),
	}),
	execute: async ({ inputData }) => {
		const { task, context } = inputData;
		
		try {
			// Simple prompt that encourages action
			const prompt = `Task: ${task}
${context ? `\nContext: ${context}` : ""}

Execute the necessary commands to accomplish this task. Show the actual command outputs.`;

			// Execute with the agent
			const response = await simpleSandboxExecutor.generate(prompt);
			
			// Extract key information from response
			const output = response.text;
			
			// Simple success detection
			const success = !output.toLowerCase().includes("error") && 
			               !output.toLowerCase().includes("failed");
			
			// Generate summary
			const summary = success 
				? `Task completed successfully. ${output.length} characters of output generated.`
				: `Task encountered issues. Check output for details.`;
			
			return {
				success,
				output,
				summary,
			};
		} catch (error) {
			return {
				success: false,
				output: error instanceof Error ? error.message : "Unknown error",
				summary: "Task failed due to an error",
			};
		}
	},
});

// Step 2: Cleanup
const cleanupStep = createStep({
	id: "cleanup-sandbox",
	description: "Clean up sandbox resources",
	inputSchema: z.object({
		success: z.boolean(),
		output: z.string(),
		summary: z.string(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		output: z.string(),
		summary: z.string(),
	}),
	execute: async ({ inputData }) => {
		// Clean up sandbox
		await cleanupSandbox();
		
		return inputData; // Pass through the results
	},
});

// Main workflow
export const simpleSandboxWorkflow = createWorkflow({
	id: "simple-sandbox-workflow",
	description: "Execute tasks in sandbox environment",
	inputSchema: z.object({
		task: z.string().describe("The task to accomplish"),
		context: z.string().optional().describe("Additional context or requirements"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		output: z.string(),
		summary: z.string(),
	}),
})
	.then(executeTaskStep)
	.then(cleanupStep)
	.commit();