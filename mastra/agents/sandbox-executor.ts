import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

// Create a tool for executing commands in the sandbox
const executeCommandTool = createTool({
	id: "execute_command",
	description: "Execute a command in the Vercel sandbox environment",
	inputSchema: z.object({
		command: z.string().describe("The command to execute"),
		args: z.array(z.string()).default([]).describe("Command arguments"),
		cwd: z.string().optional().describe("Working directory"),
		sudo: z.boolean().default(false).describe("Whether to run with sudo"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		stdout: z.string(),
		stderr: z.string(),
		exitCode: z.number(),
		duration: z.number(),
	}),
	execute: async ({ context }) => {
		const { command, args, cwd, sudo } = context;
		const executor = new SandboxExecutor();

		try {
			// Initialize sandbox if needed
			await executor.initialize();

			// Run the command
			const result = await executor.runCommand(command, args, {
				cwd,
				sudo,
			});

			return result;
		} catch (error) {
			return {
				success: false,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				exitCode: -1,
				duration: 0,
			};
		} finally {
			// Clean up sandbox resources
			await executor.cleanup();
		}
	},
});

export const sandboxExecutor = new Agent({
	name: "Sandbox Executor",
	description: "Executes commands in a secure Vercel sandbox environment",
	instructions: `You are a sandbox execution specialist. Your role is to:
1. Execute the provided commands safely in the Vercel sandbox
2. Capture and return the output (stdout, stderr, exit code)
3. Handle errors gracefully
4. Provide clear feedback about the execution results

IMPORTANT:
- Always use the execute_command tool to run commands
- Report both successful outputs and errors clearly
- If a command fails, explain what might have gone wrong
- For multi-step operations, execute commands sequentially and track results`,
	model: anthropic("claude-4-sonnet-20250514"),
	tools: {
		execute_command: executeCommandTool,
	},
});