import { createTool } from "@mastra/core/tools";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";

// Tool to create a new sandbox
export const createSandboxTool = createTool({
	id: "create_sandbox",
	description: "Create a new Vercel sandbox and return its ID",
	inputSchema: z.object({
		runtime: z.enum(["node22", "python3.13"]).default("node22").describe("Runtime environment"),
	}),
	outputSchema: z.object({
		sandboxId: z.string(),
		message: z.string(),
	}),
	execute: async ({ context }) => {
		const { runtime } = context;

		try {
			const sandbox = await Sandbox.create({
				runtime,
				timeout: 600000, // 10 minutes
			});

			// Get the sandbox ID
			const sandboxId = sandbox.sandboxId;

			return {
				sandboxId,
				message: `Created new ${runtime} sandbox with ID: ${sandboxId}`,
			};
		} catch (error) {
			throw new Error(`Failed to create sandbox: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	},
});

// Tool to execute commands using sandbox ID from memory
export const executeSandboxCommandTool = createTool({
	id: "execute_sandbox_command",
	description: "Execute a command in the sandbox and return full output",
	inputSchema: z.object({
		sandboxId: z.string().describe("The sandbox ID stored in memory"),
		command: z.string().describe("Command to execute"),
		args: z.array(z.string()).default([]).describe("Command arguments"),
		cwd: z.string().default("/home/vercel-sandbox").describe("Working directory"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		stdout: z.string(),
		stderr: z.string(),
		exitCode: z.number(),
		commandLine: z.string(),
	}),
	execute: async ({ context }) => {
		const { sandboxId, command, args, cwd } = context;

		try {
			// Get the sandbox instance using the ID
			const sandbox = await Sandbox.get({ sandboxId });

			// Execute the command
			const result = await sandbox.runCommand({
				cmd: command,
				args,
				cwd,
			});

			if (!result) {
				throw new Error("No result from command execution");
			}

			const stdout = await result.stdout();
			const stderr = await result.stderr();

			return {
				success: result.exitCode === 0,
				stdout,
				stderr,
				exitCode: result.exitCode,
				commandLine: `$ ${command} ${args.join(" ")}`.trim(),
			};
		} catch (error) {
			return {
				success: false,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				exitCode: -1,
				commandLine: `$ ${command} ${args.join(" ")}`.trim(),
			};
		}
	},
});
