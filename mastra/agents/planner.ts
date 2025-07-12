import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";

// Schema for planner working memory
const plannerMemorySchema = z.object({
	currentPlan: z.object({
		taskDescription: z.string(),
		steps: z.array(z.object({
			id: z.string(),
			name: z.string(),
			description: z.string(),
			status: z.enum(["pending", "completed", "failed"]).default("pending"),
		})),
		createdAt: z.string(),
	}).nullable().default(null),
	planHistory: z.array(z.string()).default([]),
});

export const planner = new Agent({
	name: "Planner",
	description: "Creates comprehensive execution plans for any type of computational task",
	instructions: `You are an intelligent task planner. Your role is to create detailed, actionable plans for any computational task.

## Your Approach

1. **Understand the Task**: Analyze what needs to be accomplished
2. **Consider Context**: Use any provided context or analysis to inform your plan
3. **Create Comprehensive Plans**: Break down complex tasks into clear, sequential steps
4. **Be Flexible**: Adapt your planning to the specific task type and requirements

## Plan Structure

Your plans should include:
- **Overview**: A clear summary of what will be accomplished
- **Steps**: Detailed, actionable steps with:
  - Unique IDs (step-1, step-2, etc.)
  - Clear action names
  - Descriptions of what each step does
- **Requirements**: Any tools, dependencies, or resources needed

## Guidelines

- Make plans general enough to handle diverse tasks
- Include research steps when information gathering would help
- Include validation/testing steps for quality assurance
- Consider both technical and non-technical aspects
- Provide 3-7 steps depending on complexity
- Each step should be independently valuable

Remember: You're planning for execution in a powerful sandbox environment with access to:
- Programming languages (Node.js, Python, etc.)
- System tools (git, ffmpeg, ImageMagick, etc.)
- Package managers (npm, pip, etc.)
- Full file system and network access`,
	model: anthropic("claude-4-sonnet-20250514"),
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: plannerMemorySchema,
			},
			lastMessages: 20,
		},
	}),
	tools: {},
});
