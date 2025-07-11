import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const analyzeTaskTool = createTool({
	id: "analyze_task",
	description: "Intelligently analyze a task to determine what capabilities and approach are needed",
	inputSchema: z.object({
		task: z.string().describe("The task description to analyze"),
		context: z.string().optional().describe("Additional context about the task"),
	}),
	outputSchema: z.object({
		taskType: z.string().describe("The general category that best fits this task"),
		requiresSearch: z.boolean().describe("Whether web search would be helpful"),
		requiresSandbox: z.boolean().describe("Whether sandbox execution is needed"),
		suggestedApproach: z.string().describe("High-level approach to tackle the task"),
		estimatedComplexity: z.string().describe("Task complexity: simple, moderate, or complex"),
		keyRequirements: z.array(z.string()).describe("Key requirements or tools needed"),
		reasoning: z.string().describe("Explanation of the analysis"),
	}),
	execute: async ({ context }) => {
		const { task, context: additionalContext } = context;
		
		// This tool is designed to be called by an AI agent that can intelligently
		// analyze the task. The agent using this tool will determine the appropriate
		// values based on its understanding of the task.
		
		// The AI agent will analyze the task and provide:
		// - taskType: A descriptive category for the task
		// - requiresSearch: Whether web search would enhance the solution
		// - requiresSandbox: Whether code execution is needed
		// - suggestedApproach: A strategic plan for tackling the task
		// - estimatedComplexity: How complex the task appears to be
		// - keyRequirements: Tools, libraries, or resources needed
		// - reasoning: Explanation of the analysis
		
		// This is a placeholder implementation that the AI agent will override
		// with its intelligent analysis
		return {
			taskType: "general_computation",
			requiresSearch: false,
			requiresSandbox: true,
			suggestedApproach: "Analyze requirements, plan approach, execute solution",
			estimatedComplexity: "moderate",
			keyRequirements: [],
			reasoning: "Task analysis pending",
		};
	},
});