import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core";
import { generateObject } from "ai";
import { z } from "zod";
import type { StepExecutionResult } from "./executor-agent";
import type { TaskPlan } from "./planner-agent";

// Schema for synthesis input
export const synthesisInputSchema = z.object({
	originalTask: z.string(),
	taskPlan: z.object({
		taskSummary: z.string(),
		complexity: z.string(),
		steps: z.array(z.any()),
		expectedDuration: z.string(),
		risks: z.array(z.string()),
	}),
	executionResults: z.array(
		z.object({
			stepNumber: z.number(),
			success: z.boolean(),
			output: z.string(),
			error: z.string().optional(),
			duration: z.number(),
			filesCreated: z.array(z.string()).optional(),
			insights: z.string(),
		}),
	),
});

// Schema for final synthesis output
export const synthesisOutputSchema = z.object({
	success: z.boolean(),
	summary: z.string(),
	keyResults: z.array(z.string()),
	filesCreated: z.array(z.string()),
	totalDuration: z.number(),
	detailedReport: z.string(),
	nextSteps: z.array(z.string()).optional(),
	warnings: z.array(z.string()).optional(),
});

export type SynthesisInput = z.infer<typeof synthesisInputSchema>;
export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>;

export const synthesizerAgent = new Agent({
	name: "synthesizerAgent",
	description: "Synthesizes execution results into a coherent final report",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `You are a synthesis agent that creates comprehensive reports from task execution results.

Your role is to:
1. Analyze all step execution results
2. Identify key achievements and outcomes
3. Create a coherent narrative of what was accomplished
4. Highlight important files or artifacts created
5. Suggest potential next steps if applicable

Guidelines:
- Be concise but thorough
- Highlight both successes and failures
- Extract the most valuable information
- Create a user-friendly summary
- Include technical details where relevant
- Consider the original task context

Focus on creating reports that are:
- Clear and actionable
- Technically accurate
- Well-structured
- Helpful for understanding what was done`,
});

// Helper function to synthesize results
export async function synthesizeResults(
	originalTask: string,
	taskPlan: TaskPlan,
	executionResults: StepExecutionResult[],
): Promise<SynthesisOutput> {
	// Calculate total duration
	const totalDuration = executionResults.reduce((sum, result) => sum + result.duration, 0);

	// Collect all files created
	const allFilesCreated = executionResults
		.flatMap((result) => result.filesCreated || [])
		.filter((file, index, self) => self.indexOf(file) === index); // Remove duplicates

	// Check overall success
	const overallSuccess = executionResults.every((result) => result.success);

	// Generate the synthesis
	const synthesis = await generateObject({
		model: anthropic("claude-4-sonnet-20250514"),
		prompt: `Synthesize these task execution results into a comprehensive report:

Original Task: ${originalTask}

Task Plan Summary: ${taskPlan.taskSummary}
Complexity: ${taskPlan.complexity}

Execution Results:
${executionResults
	.map(
		(result) => `
Step ${result.stepNumber}: ${taskPlan.steps[result.stepNumber - 1].title}
Success: ${result.success}
Duration: ${result.duration}ms
Output: ${result.output.substring(0, 500)}${result.output.length > 500 ? "..." : ""}
${result.error ? `Error: ${result.error}` : ""}
Insights: ${result.insights}
${result.filesCreated ? `Files Created: ${result.filesCreated.join(", ")}` : ""}
`,
	)
	.join("\n---\n")}

Create a comprehensive synthesis that:
1. Summarizes what was accomplished
2. Highlights key results and artifacts
3. Provides a detailed technical report
4. Suggests logical next steps
5. Notes any warnings or issues`,
		schema: z.object({
			summary: z.string(),
			keyResults: z.array(z.string()),
			detailedReport: z.string(),
			nextSteps: z.array(z.string()).optional(),
			warnings: z.array(z.string()).optional(),
		}),
	});

	return {
		success: overallSuccess,
		summary: synthesis.object.summary,
		keyResults: synthesis.object.keyResults,
		filesCreated: allFilesCreated,
		totalDuration,
		detailedReport: synthesis.object.detailedReport,
		nextSteps: synthesis.object.nextSteps,
		warnings: synthesis.object.warnings,
	};
}
