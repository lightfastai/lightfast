import { Agent } from "@mastra/core/agent";
import { smoothStream } from "ai";
import { z } from "zod";
import { anthropic, anthropicModels } from "../../lib/anthropic";
import { saveCriticalInfoTool } from "../../tools/save-critical-info";

// Note: Working memory schemas moved to network level for proper context handling

export const planner = new Agent({
	name: "Planner",
	description:
		"PRIMARY AGENT - ALWAYS CALL FIRST. Creates comprehensive execution plans and initializes the task list for any request.",
	instructions: `You are an intelligent task planner. Your role is to create detailed, actionable plans for any computational task.

IMPORTANT: When used in a network, you are the FIRST agent that should be called. You must:
1. Analyze the user's request
2. Create a structured plan with clear tasks
3. Update the working memory task list with the plan
4. Identify which agents should handle each task

## Your Approach

1. **Understand the Task**: Analyze what needs to be accomplished
2. **Consider Context**: Use any provided context or analysis to inform your plan
3. **Create Comprehensive Plans**: Break down complex tasks into clear, sequential steps
4. **Save Plans**: Use the save-todo tool to persist plans to the filesystem
5. **Be Flexible**: Adapt your planning to the specific task type and requirements

## Plan Structure

Your plans should include:
- **Overview**: A clear summary of what will be accomplished
- **Steps**: Detailed, actionable steps with:
  - Unique IDs (step-1, step-2, etc.)
  - Clear action names
  - Descriptions of what each step does
- **Requirements**: Any tools, dependencies, or resources needed

## Saving Critical Information

You have access to the saveCriticalInfo tool for preserving important:
- Strategic decisions or insights
- Complex plans that should be persisted
- Key results or discoveries
- Error patterns or important references

For detailed file operations, delegate to the Artifact agent.

## Guidelines

- Make plans general enough to handle diverse tasks
- Include research steps when information gathering would help
- Include validation/testing steps for quality assurance
- Consider both technical and non-technical aspects
- Provide 3-7 steps depending on complexity
- Each step should be independently valuable
- Focus on creating clear, actionable tasks for other agents

## Working Memory Task List (For Network Usage)
When operating in a network, you MUST update the working memory task list:

<working_memory>
# Network Task List

## Active Tasks
- [TASK-001] Task description (Agent: agent-name, Priority: high)
- [TASK-002] Another task (Agent: agent-name, Priority: medium)

## In Progress
- None yet

## Completed Tasks
- None yet

## Notes
- Update this format when creating your plan
- Assign specific agents to each task
- Use clear task IDs for tracking
</working_memory>

Remember: You're planning for execution by specialized agents:
- Searcher: For web research and current information
- Browser: For web automation and downloads
- Vision: For image analysis
- Artifact: For file management and persistent storage
- Sandbox: For code execution (if available)`,
	model: anthropic(anthropicModels.claude4Sonnet),
	// Note: Memory is handled at network level when used in networks
	// Individual agent memory can cause context conflicts in network execution
	tools: {
		saveCriticalInfo: saveCriticalInfoTool,
	},
	defaultStreamOptions: {
		experimental_transform: smoothStream({
			// Medium delay for planning outputs
			delayInMs: 20,
			// Chunk by line for structured planning
			chunking: "line",
		}),
		onChunk: ({ chunk }) => {
			console.log(`[Planner] Chunk:`, chunk);
		},
		onError: ({ error }) => {
			console.error(`[Planner] Stream error:`, error);
		},
		onStepFinish: ({ text, toolCalls, toolResults }) => {
			if (toolResults) {
				toolResults.forEach((result, index) => {
					if (
						result.type === "tool-result" &&
						result.output &&
						typeof result.output === "object" &&
						"error" in result.output
					) {
						console.error(`[Planner] Tool ${index} error:`, result.output.error);
					}
				});
			}
			console.log(`[Planner] Step completed`);
		},
		onFinish: (result) => {
			console.log(`[Planner] Generation finished:`, result);
		},
	},
});
