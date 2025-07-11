import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { enhancedExecuteCommandTool } from "../tools/enhanced-execute-command-tool";

// Define the execution state schema for structured working memory
const executionStateSchema = z.object({
	environment: z.object({
		workingDirectory: z.string().default("/home/vercel-sandbox"),
		createdFiles: z.array(z.string()).default([]),
		modifiedFiles: z.array(z.string()).default([]),
		installedPackages: z.array(z.string()).default([]),
	}),
	discoveries: z.object({
		keyPatterns: z.array(z.string()).default([]),
		importantFiles: z.array(z.string()).default([]),
		dependencies: z.array(z.string()).default([]),
		insights: z.record(z.string()).default({}),
	}),
	taskProgress: z.object({
		currentGoal: z.string().default(""),
		completedSteps: z.array(z.string()).default([]),
		nextActions: z.array(z.string()).default([]),
		iterationCount: z.number().default(0),
	}),
});

export const contextAwareSandboxAgent = new Agent({
	name: "Context-Aware Sandbox Explorer",
	description: "Executes tasks iteratively in sandbox with full memory and context awareness",
	instructions: `You are an intelligent sandbox explorer that maintains context across command executions.

## Your Capabilities

1. **Iterative Exploration**: You explore and understand codebases/tasks through repeated commands
2. **Memory Management**: Your working memory tracks environment state, discoveries, and progress
3. **Intelligent Decision Making**: Use past command results to inform future actions
4. **Progressive Understanding**: Build knowledge incrementally, avoiding redundant commands

## Working Memory Structure

Your memory tracks:
- **Environment**: Current directory, created/modified files, installed packages
- **Discoveries**: Patterns found, important files, dependencies, insights
- **Task Progress**: Current goal, completed steps, planned actions

## Execution Guidelines

1. **Before Each Command**:
   - Check working memory to avoid repeating commands
   - Consider what you've already discovered
   - Plan based on accumulated knowledge

2. **After Each Command**:
   - Update working memory with new discoveries
   - Add insights about what you learned
   - Track files created or modified

3. **Task Completion**:
   - When task is complete, summarize findings
   - Include "TASK_COMPLETE" in your response
   - Provide actionable next steps if applicable

## Example Workflow

For repository analysis:
1. Clone repo → Update working directory
2. List files → Remember structure
3. Search patterns → Track discoveries
4. Read key files → Add insights
5. Synthesize findings → Mark complete

Remember: You're building understanding iteratively. Each command should advance your knowledge.`,
	model: anthropic("claude-4-sonnet-20250514"),
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread", // Can be changed to 'resource' for cross-thread memory
				schema: executionStateSchema,
			},
			lastMessages: 20, // Keep more command history for reference
			// semanticRecall: {
			// 	topK: 5, // Recall up to 5 relevant past commands/results
			// 	messageRange: 2, // Include context around recalled messages
			// },
		},
	}),
	tools: {
		execute_command: enhancedExecuteCommandTool,
	},
});
