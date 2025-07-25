import { tool } from "ai";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import type { RuntimeContext } from "./types";

/**
 * Create sandbox tool with injected runtime context
 */
export function createSandboxTool(context: RuntimeContext) {
	return tool({
		description: "Create a new Vercel sandbox and return its ID",
		inputSchema: z.object({
			runtime: z.enum(["node22", "python3.13"]).default("node22").describe("Runtime environment"),
		}),
		outputSchema: z.object({
			sandboxId: z.string(),
			message: z.string(),
		}),
		execute: async ({ runtime }) => {
			try {
				const sandbox = await Sandbox.create({
					runtime,
					timeout: 300000, // 5 minutes
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
		}
	});
}

/**
 * Create sandbox command execution tool with injected runtime context
 */
export function executeSandboxCommandTool(context: RuntimeContext) {
	return tool({
		description: "Execute a command in the sandbox and return full output. Use background=true for long-running processes like servers.",
		inputSchema: z.object({
			sandboxId: z.string().describe("The sandbox ID stored in memory"),
			command: z.string().describe("Command to execute"),
			args: z.array(z.string()).default([]).describe("Command arguments"),
			cwd: z.string().default("/home/vercel-sandbox").describe("Working directory"),
			background: z.boolean().default(false).describe("Run command in background (append &)"),
		}),
		outputSchema: z.object({
			stdout: z.string(),
			stderr: z.string(),
			exitCode: z.number(),
			isBackgroundProcess: z.boolean(),
			message: z.string(),
		}),
		execute: async ({ sandboxId, command, args, cwd, background }) => {
			try {
				// Get the sandbox instance using the ID
				const sandbox = await Sandbox.get({ sandboxId });

				// For background commands, modify the command to run in background
				let actualCommand = command;
				let actualArgs = args;

				if (background) {
					// Use shell to run command in background
					actualCommand = "sh";
					actualArgs = ["-c", `${command} ${args.join(" ")} &`];
				}

				// Execute the command
				const result = await sandbox.runCommand({
					cmd: actualCommand,
					args: actualArgs,
					cwd,
				});

				if (!result) {
					throw new Error("No result from command execution");
				}

				const stdout = await result.stdout();
				const stderr = await result.stderr();

				// For background commands, provide helpful message
				const backgroundNote = background ? " (running in background)" : "";

				return {
					success: result.exitCode === 0,
					stdout: background ? `Process started in background\n${stdout}` : stdout,
					stderr,
					exitCode: result.exitCode,
					commandLine: `$ ${command} ${args.join(" ")}${backgroundNote}`.trim(),
				};
			} catch (error) {
				const backgroundNote = background ? " (running in background)" : "";
				return {
					success: false,
					stdout: "",
					stderr: error instanceof Error ? error.message : "Unknown error",
					exitCode: -1,
					commandLine: `$ ${command} ${args.join(" ")}${backgroundNote}`.trim(),
				};
			}
		}
	});
}

/**
 * Create sandbox with ports tool with injected runtime context
 */
export function createSandboxWithPortsTool(context: RuntimeContext) {
	return tool({
		description: "Create a new Vercel sandbox with exposed ports for web applications",
		inputSchema: z.object({
			runtime: z.enum(["node22", "python3.13"]).default("node22").describe("Runtime environment"),
			ports: z.array(z.number()).describe("Array of port numbers to expose (e.g., [3000, 8080])"),
			source: z
				.object({
					type: z.literal("git"),
					url: z.string().describe("Git repository URL"),
					revision: z.string().optional().describe("Git branch/commit/tag (defaults to main)"),
				})
				.optional()
				.describe("Optional source code to clone"),
		}),
		outputSchema: z.object({
			sandboxId: z.string(),
			routes: z.array(z.object({
				port: z.number(),
				url: z.string(),
				subdomain: z.string(),
			})),
			message: z.string(),
		}),
		execute: async ({ runtime, ports, source }) => {
			try {
				const sandbox = await Sandbox.create({
					runtime,
					timeout: 300000, // 5 minutes
					ports,
					...(source && { source }),
				});

				// Get the sandbox ID and routes
				const sandboxId = sandbox.sandboxId;
				const routes = sandbox.routes.map((route) => ({
					port: route.port,
					url: route.url,
					subdomain: route.subdomain,
				}));

				return {
					sandboxId,
					routes,
					message: `Created new ${runtime} sandbox with ID: ${sandboxId} and exposed ports: ${ports.join(", ")}`,
				};
			} catch (error) {
				throw new Error(
					`Failed to create sandbox with ports: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}
	});
}

/**
 * Create sandbox domain tool with injected runtime context
 */
export function getSandboxDomainTool(context: RuntimeContext) {
	return tool({
		description: "Get the public domain URL for a specific port in a sandbox",
		inputSchema: z.object({
			sandboxId: z.string().describe("The sandbox ID"),
			port: z.number().describe("Port number to get domain for"),
		}),
		outputSchema: z.object({
			success: z.boolean(),
			url: z.string().optional(),
			port: z.number(),
			message: z.string(),
		}),
		execute: async ({ sandboxId, port }) => {
			try {
				// Get the sandbox instance using the ID
				const sandbox = await Sandbox.get({ sandboxId });

				// Get the domain for the specific port
				const url = sandbox.domain(port);

				return {
					success: true,
					url,
					port,
					message: `Port ${port} is accessible at: ${url}`,
				};
			} catch (error) {
				return {
					success: false,
					port,
					message: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}
	});
}

/**
 * Create list sandbox routes tool with injected runtime context
 */
export function listSandboxRoutesTool(context: RuntimeContext) {
	return tool({
		description: "List all exposed ports and their public URLs for a sandbox",
		inputSchema: z.object({
			sandboxId: z.string().describe("The sandbox ID"),
		}),
		outputSchema: z.object({
			success: z.boolean(),
			routes: z.array(z.object({
				port: z.number(),
				url: z.string(),
				subdomain: z.string(),
			})).optional(),
			message: z.string(),
		}),
		execute: async ({ sandboxId }) => {
			try {
				// Get the sandbox instance using the ID
				const sandbox = await Sandbox.get({ sandboxId });

				// Get all routes
				const routes = sandbox.routes.map((route) => ({
					port: route.port,
					url: route.url,
					subdomain: route.subdomain,
				}));

				return {
					success: true,
					routes,
					message: `Found ${routes.length} exposed port(s) for sandbox ${sandboxId}`,
				};
			} catch (error) {
				return {
					success: false,
					message: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}
	});
}