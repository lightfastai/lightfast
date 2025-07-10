import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core";
import { generateObject } from "ai";
import { z } from "zod";

// Schema for a single task step
const taskStepSchema = z.object({
	stepNumber: z.number(),
	title: z.string(),
	description: z.string(),
	command: z.string().describe("The shell command or script to execute"),
	expectedOutput: z.string().describe("What we expect this step to produce"),
	dependencies: z.array(z.number()).describe("Step numbers this depends on"),
});

// Schema for the complete task plan
export const taskPlanSchema = z.object({
	taskSummary: z.string(),
	complexity: z.enum(["simple", "moderate", "complex"]),
	steps: z.array(taskStepSchema).length(3),
	expectedDuration: z.string(),
	risks: z.array(z.string()),
});

export type TaskPlan = z.infer<typeof taskPlanSchema>;

export const plannerAgent = new Agent({
	name: "plannerAgent",
	description: "Analyzes tasks and creates execution plans",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `You are a task planning agent that breaks down user requests into exactly 3 concrete, executable steps.

Your role is to:
1. Analyze the user's request
2. Identify the core objectives
3. Create exactly 3 sequential steps that can be executed in a shell/sandbox environment
4. Ensure each step has a clear command that can be run

Guidelines:
- Each step must be a concrete action (not abstract)
- Steps should build on each other sequentially
- Commands should be executable in a Linux/Unix shell
- Consider dependencies between steps
- Keep steps focused and atomic
- Think about error handling and validation

Available capabilities:
- File system operations (create, read, write, delete)
- Package installation (npm, pip, dnf)
- Script execution (Node.js, Python, Bash)
- Network operations (curl, wget)
- Data processing tools
- Any standard Linux command

When creating the plan, be specific about commands and expected outputs.`,
});

// Helper function to generate a task plan
export async function generateTaskPlan(taskDescription: string): Promise<TaskPlan> {
	const result = await generateObject({
		model: anthropic("claude-4-sonnet-20250514"),
		prompt: `Analyze this task and create an execution plan with exactly 3 steps: ${taskDescription}

Remember:
- Each step must have a concrete shell command
- Steps should be sequential and build on each other
- Consider what tools/packages might need to be installed
- Think about validation and error checking
- Keep the scope manageable

Create a practical, executable plan.`,
		schema: taskPlanSchema,
	});

	return result.object;
}
