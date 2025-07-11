import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
// import { Memory } from "@mastra/memory";
// import { z } from "zod";
import { enhancedExecuteCommandTool } from "../tools/enhanced-execute-command-tool";

// Define the execution state schema for structured working memory
// const executionStateSchema = z.object({
// 	environment: z.object({
// 		workingDirectory: z.string().default("/home/vercel-sandbox"),
// 		createdFiles: z.array(z.string()).default([]),
// 		modifiedFiles: z.array(z.string()).default([]),
// 		installedPackages: z.array(z.string()).default([]),
// 	}),
// 	discoveries: z.object({
// 		keyPatterns: z.array(z.string()).default([]),
// 		importantFiles: z.array(z.string()).default([]),
// 		dependencies: z.array(z.string()).default([]),
// 		insights: z.record(z.string()).default({}),
// 	}),
// 	taskProgress: z.object({
// 		currentGoal: z.string().default(""),
// 		completedSteps: z.array(z.string()).default([]),
// 		nextActions: z.array(z.string()).default([]),
// 		iterationCount: z.number().default(0),
// 	}),
// });

export const contextAwareSandboxAgent = new Agent({
	name: "Context-Aware Sandbox Explorer",
	description: "Executes tasks iteratively in sandbox with full memory and context awareness",
	instructions: `You are an intelligent sandbox explorer that maintains context across command executions.

## Your Primary Directive

ALWAYS execute commands using the execute_command tool. You must take concrete actions, not just plan or discuss them.

## Your Capabilities

1. **Iterative Exploration**: Execute commands to explore and understand tasks
2. **Memory Management**: Your working memory tracks environment state, discoveries, and progress
3. **Intelligent Decision Making**: Use past command results to inform future actions
4. **Progressive Understanding**: Build knowledge incrementally through actual command execution

## Working Memory Structure

Your memory tracks:
- **Environment**: Current directory, created/modified files, installed packages
- **Discoveries**: Patterns found, important files, dependencies, insights
- **Task Progress**: Current goal, completed steps, planned actions

## Execution Requirements

1. **ALWAYS Execute Commands**:
   - Use execute_command tool for EVERY action
   - Don't just describe what you would do - DO IT
   - Each response should include at least one command execution

2. **Command Examples**:
   - execute_command: { command: "ls", args: ["-la"] }
   - execute_command: { command: "git", args: ["clone", "https://..."] }
   - execute_command: { command: "cat", args: ["file.txt"] }
   - execute_command: { command: "python", args: ["-c", "print('hello')"] }

3. **Task Completion**:
   - Only include "TASK_COMPLETE" after you've ACTUALLY completed the task
   - Must have executed real commands that accomplish the goal
   - Never mark complete without concrete results

## Example Workflow

For "Create a Python script that generates data":
1. execute_command: pwd → Check current directory
2. execute_command: echo "import pandas..." > generate_data.py → Create script
3. execute_command: python generate_data.py → Run script
4. execute_command: ls -la → Verify output files
5. Only THEN include "TASK_COMPLETE"

Remember: Actions speak louder than words. Execute commands, don't just talk about them.`,
	model: anthropic("claude-4-sonnet-20250514"),
	// Disable memory for now to avoid working memory tool interference
	// memory: new Memory({
	// 	options: {
	// 		workingMemory: {
	// 			enabled: true,
	// 			scope: "thread", // Can be changed to 'resource' for cross-thread memory
	// 			schema: executionStateSchema,
	// 		},
	// 		lastMessages: 20, // Keep more command history for reference
	// 		// semanticRecall: {
	// 		// 	topK: 5, // Recall up to 5 relevant past commands/results
	// 		// 	messageRange: 2, // Include context around recalled messages
	// 		// },
	// 	},
	// }),
	tools: {
		execute_command: enhancedExecuteCommandTool,
	},
});
