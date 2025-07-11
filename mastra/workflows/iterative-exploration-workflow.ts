import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { contextAwareSandboxAgent } from "../agents/context-aware-sandbox";
import { cleanupSandbox } from "../tools/enhanced-execute-command-tool";

// Step 1: Initialize exploration
const initializeExplorationStep = createStep({
	id: "initialize-exploration",
	description: "Initialize the exploration context",
	inputSchema: z.object({
		task: z.string().describe("The task to accomplish"),
		context: z.string().optional().describe("Additional context or requirements"),
		maxIterations: z.number().default(20).describe("Maximum number of exploration iterations"),
		resourceId: z.string().optional().describe("Resource ID for persistent memory across sessions"),
	}),
	outputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		maxIterations: z.number(),
		threadId: z.string(),
		resourceId: z.string(),
	}),
	execute: async ({ inputData }) => {
		// Generate unique IDs for this exploration session
		const threadId = `explore-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		
		// Use provided resourceId or generate a default one
		const resourceId = inputData.resourceId || `sandbox-user-${Date.now()}`;

		return {
			task: inputData.task,
			context: inputData.context,
			maxIterations: inputData.maxIterations,
			threadId,
			resourceId,
		};
	},
});

// Step 2: Iterative exploration loop
const explorationLoopStep = createStep({
	id: "exploration-loop",
	description: "Iteratively explore and execute commands",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		maxIterations: z.number(),
		threadId: z.string(),
		resourceId: z.string(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		iterations: z.number(),
		finalSummary: z.string(),
		discoveries: z.array(z.string()),
		createdFiles: z.array(z.string()),
		error: z.string().optional(),
	}),
	execute: async ({ inputData }) => {
		const { task, context, maxIterations, threadId, resourceId } = inputData;
		
		let iteration = 0;
		let taskComplete = false;
		const discoveries: string[] = [];
		const createdFiles: string[] = [];
		let lastResponse = "";
		let error: string | undefined;

		try {
			// Initial prompt to start exploration
			const initialPrompt = `Task: ${task}
${context ? `\nContext: ${context}` : ""}

Begin exploring and executing commands to accomplish this task. 
Use your working memory to track progress and avoid redundant commands.
When the task is complete, include "TASK_COMPLETE" in your response.`;

			// First iteration
			const generateOptions: any = { 
				threadId,
				resourceId 
			};
			
			let response = await contextAwareSandboxAgent.generate(initialPrompt, generateOptions);
			lastResponse = response.text;
			iteration++;

			// Continue iterating until task is complete or max iterations reached
			while (!taskComplete && iteration < maxIterations) {
				// Check if task is marked as complete
				taskComplete = lastResponse.includes("TASK_COMPLETE");
				
				if (!taskComplete) {
					// Continue exploration
					const continuePrompt = `Continue exploring to complete the task. 
Check your working memory for what you've already discovered.
Build on your previous findings and execute the next logical commands.
Remember to include "TASK_COMPLETE" when finished.`;

					response = await contextAwareSandboxAgent.generate(continuePrompt, generateOptions);
					lastResponse = response.text;
					iteration++;

					// Extract discoveries and created files from response
					const discoveryMatches = lastResponse.matchAll(/discovered?:?\s*(.+?)(?:\n|$)/gi);
					for (const match of discoveryMatches) {
						if (match[1] && !discoveries.includes(match[1])) {
							discoveries.push(match[1].trim());
						}
					}

					const fileMatches = lastResponse.matchAll(/created?:?\s*([/\w\-.]+)/gi);
					for (const match of fileMatches) {
						if (match[1] && !createdFiles.includes(match[1])) {
							createdFiles.push(match[1]);
						}
					}
				}
			}

			// Generate final summary
			const summaryPrompt = `Task completed after ${iteration} iterations.
Provide a comprehensive summary of:
1. What was accomplished
2. Key discoveries and insights
3. Files created or modified
4. Any recommendations or next steps

Base your summary on your working memory and command history.`;

			const summaryResponse = await contextAwareSandboxAgent.generate(summaryPrompt, generateOptions);

			return {
				success: true,
				iterations: iteration,
				finalSummary: summaryResponse.text,
				discoveries,
				createdFiles,
			};
		} catch (err) {
			error = err instanceof Error ? err.message : "Unknown error during exploration";
			return {
				success: false,
				iterations: iteration,
				finalSummary: `Exploration failed after ${iteration} iterations: ${error}`,
				discoveries,
				createdFiles,
				error,
			};
		}
	},
});

// Step 3: Cleanup and finalize
const cleanupStep = createStep({
	id: "cleanup",
	description: "Cleanup sandbox resources",
	inputSchema: z.object({
		success: z.boolean(),
		iterations: z.number(),
		finalSummary: z.string(),
		discoveries: z.array(z.string()),
		createdFiles: z.array(z.string()),
		error: z.string().optional(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		summary: z.string(),
		results: z.object({
			iterations: z.number(),
			discoveries: z.array(z.string()),
			createdFiles: z.array(z.string()),
			error: z.string().optional(),
		}),
		fullReport: z.string(),
	}),
	execute: async ({ inputData }) => {
		// Clean up sandbox resources
		await cleanupSandbox();

		// Create structured summary
		const summary = inputData.success
			? `Successfully completed task in ${inputData.iterations} iterations. ${inputData.discoveries.length} discoveries made, ${inputData.createdFiles.length} files created.`
			: `Task failed after ${inputData.iterations} iterations. Error: ${inputData.error}`;

		return {
			success: inputData.success,
			summary,
			results: {
				iterations: inputData.iterations,
				discoveries: inputData.discoveries,
				createdFiles: inputData.createdFiles,
				error: inputData.error,
			},
			fullReport: inputData.finalSummary,
		};
	},
});

// Main workflow definition
export const iterativeExplorationWorkflow = createWorkflow({
	id: "iterative-exploration-workflow",
	description: "Explore and execute tasks iteratively with memory and context awareness",
	inputSchema: z.object({
		task: z.string().describe("The task to accomplish"),
		context: z.string().optional().describe("Additional context or requirements"),
		maxIterations: z.number().default(20).describe("Maximum number of exploration iterations"),
		resourceId: z.string().optional().describe("Resource ID for persistent memory across sessions"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		summary: z.string(),
		results: z.object({
			iterations: z.number(),
			discoveries: z.array(z.string()),
			createdFiles: z.array(z.string()),
			error: z.string().optional(),
		}),
		fullReport: z.string(),
	}),
})
	.then(initializeExplorationStep)
	.then(explorationLoopStep)
	.then(cleanupStep)
	.commit();