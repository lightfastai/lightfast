import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { generateObject } from "ai";
import { z } from "zod";

const analyzeTaskTool = createTool({
	id: "analyze_task",
	description: "Break down a task into simple executable steps",
	inputSchema: z.object({
		taskDescription: z.string().describe("The task description to analyze"),
	}),
	outputSchema: z.object({
		tasks: z.array(z.string().describe("Simple task description")),
	}),
	execute: async ({ context }) => {
		const { taskDescription } = context;

		try {
			// Use Anthropic AI to analyze the task and generate steps
			const result = await generateObject({
				model: anthropic("claude-3-5-haiku-20241022"),
				prompt: `Break down this task into exactly 5 simple, actionable steps: "${taskDescription}"

Return exactly 5 high-level steps that cover the main phases of completing this task. Each step should be:
- Clear and actionable
- High-level (not overly detailed)
- Focused on the main actions needed
- Suitable for execution in a development environment

Keep the steps practical and straightforward. Do not exceed 5 steps.`,
				schema: z.object({
					tasks: z.array(z.string().describe("Simple task description")).length(5),
				}),
			});

			return result.object;
		} catch (error) {
			// Fallback to basic task breakdown if AI fails
			console.error("AI analysis failed, using fallback:", error);
			return {
				tasks: [
					"Set up development environment",
					"Research and plan approach",
					"Implement core functionality",
					"Test the implementation",
					"Document and finalize",
				],
			};
		}
	},
});

export const planner = new Agent({
	name: "Planner",
	description: "Breaks down tasks into simple executable steps",
	instructions: `You are the Planner agent. When given a task description, you MUST use the analyze_task tool to break it down into simple steps.

Always call the analyze_task tool first, then return only the simple task list from the tool output. Do not provide additional explanations or detailed analysis.

Your response should be a simple list of actionable steps based on the tool output.`,
	model: anthropic("claude-3-5-haiku-20241022"),
	tools: {
		analyze_task: analyzeTaskTool,
	},
});
