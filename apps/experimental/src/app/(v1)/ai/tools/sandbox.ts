import type { RuntimeContext } from "lightfast/server/adapters/types";
import { createTool } from "lightfast/tool";
import { Sandbox } from "@vercel/sandbox";
import { currentSpan, wrapTraced } from "braintrust";
import { z } from "zod";
import type { AppRuntimeContext } from "@/app/(v1)/ai/types";

/**
 * Wrapped create sandbox execution function with Braintrust tracing
 */
const executeCreateSandbox = wrapTraced(
	async function executeCreateSandbox(
		{
			runtime,
		}: {
			runtime: "node22" | "python3.13";
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		try {
			// Log metadata
			currentSpan().log({
				metadata: {
					runtime,
					timeout: 300000,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			const sandbox = await Sandbox.create({
				runtime,
				timeout: 300000, // 5 minutes
			});

			// Get the sandbox ID
			const sandboxId = sandbox.sandboxId;

			// Log success
			currentSpan().log({
				metadata: {
					sandboxId,
				},
			});

			return {
				sandboxId,
				message: `Created new ${runtime} sandbox with ID: ${sandboxId}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						runtime,
					},
				},
			});
			throw new Error(`Failed to create sandbox: ${errorMessage}`);
		}
	},
	{ type: "tool", name: "createSandbox" },
);

/**
 * Create sandbox tool with injected runtime context
 */
export const createSandboxTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Create a new Vercel sandbox and return its ID",
	inputSchema: z.object({
		runtime: z.enum(["node22", "python3.13"]).default("node22").describe("Runtime environment"),
	}),
	execute: executeCreateSandbox,
});

/**
 * Wrapped execute sandbox command function with Braintrust tracing
 */
const executeCommand = wrapTraced(
	async function executeCommand(
		{
			sandboxId,
			command,
			args,
			cwd,
			background,
		}: {
			sandboxId: string;
			command: string;
			args?: string[];
			cwd?: string;
			background?: boolean;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		try {
			// Log metadata
			currentSpan().log({
				metadata: {
					sandboxId,
					command,
					args: args || [],
					cwd: cwd || "/home/vercel-sandbox",
					background: !!background,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			// Get the sandbox instance using the ID
			const sandbox = await Sandbox.get({ sandboxId });

			// For background commands, modify the command to run in background
			let actualCommand = command;
			let actualArgs = args;

			if (background) {
				// Use shell to run command in background
				actualCommand = "sh";
				actualArgs = ["-c", `${command} ${args!.join(" ")} &`];
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

			// Log execution result
			currentSpan().log({
				metadata: {
					exitCode: result.exitCode,
					success: result.exitCode === 0,
					stdoutLength: stdout.length,
					stderrLength: stderr.length,
				},
			});

			return {
				success: result.exitCode === 0,
				stdout: background ? `Process started in background\n${stdout}` : stdout,
				stderr,
				exitCode: result.exitCode,
				commandLine: `$ ${command} ${args!.join(" ")}${backgroundNote}`.trim(),
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			const backgroundNote = background ? " (running in background)" : "";

			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						sandboxId,
						command,
					},
				},
			});

			return {
				success: false,
				stdout: "",
				stderr: errorMessage,
				exitCode: -1,
				commandLine: `$ ${command} ${args!.join(" ")}${backgroundNote}`.trim(),
			};
		}
	},
	{ type: "tool", name: "executeSandboxCommand" },
);

/**
 * Create sandbox command execution tool with injected runtime context
 */
export const executeSandboxCommandTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description:
		"Execute a command in the sandbox and return full output. Use background=true for long-running processes like servers.",
	inputSchema: z.object({
		sandboxId: z.string().describe("The sandbox ID stored in memory"),
		command: z.string().describe("Command to execute"),
		args: z.array(z.string()).default([]).describe("Command arguments"),
		cwd: z.string().default("/home/vercel-sandbox").describe("Working directory"),
		background: z.boolean().default(false).describe("Run command in background (append &)"),
	}),
	execute: executeCommand,
});

/**
 * Wrapped create sandbox with ports function with Braintrust tracing
 */
const executeCreateSandboxWithPorts = wrapTraced(
	async function executeCreateSandboxWithPorts(
		{
			runtime,
			ports,
			source,
		}: {
			runtime: "node22" | "python3.13";
			ports: number[];
			source?: { type: "git"; url: string; revision?: string };
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		try {
			// Log metadata
			currentSpan().log({
				metadata: {
					runtime,
					timeout: 300000,
					ports,
					hasSource: !!source,
					sourceUrl: source?.url,
					sourceRevision: source?.revision,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

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

			// Log success with routes
			currentSpan().log({
				metadata: {
					sandboxId,
					routeCount: routes.length,
					routes,
				},
			});

			return {
				sandboxId,
				routes,
				message: `Created new ${runtime} sandbox with ID: ${sandboxId} and exposed ports: ${ports.join(", ")}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						runtime,
						ports,
					},
				},
			});
			throw new Error(`Failed to create sandbox with ports: ${errorMessage}`);
		}
	},
	{ type: "tool", name: "createSandboxWithPorts" },
);

/**
 * Create sandbox with ports tool with injected runtime context
 */
export const createSandboxWithPortsTool = createTool<RuntimeContext<AppRuntimeContext>>({
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
	execute: executeCreateSandboxWithPorts,
});

/**
 * Wrapped get sandbox domain function with Braintrust tracing
 */
const executeGetSandboxDomain = wrapTraced(
	async function executeGetSandboxDomain(
		{
			sandboxId,
			port,
		}: {
			sandboxId: string;
			port: number;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		try {
			// Log metadata
			currentSpan().log({
				metadata: {
					sandboxId,
					port,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			// Get the sandbox instance using the ID
			const sandbox = await Sandbox.get({ sandboxId });

			// Get the domain for the specific port
			const url = sandbox.domain(port);

			// Log success
			currentSpan().log({
				metadata: {
					url,
				},
			});

			return {
				success: true,
				url,
				port,
				message: `Port ${port} is accessible at: ${url}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						sandboxId,
						port,
					},
				},
			});
			return {
				success: false,
				port,
				message: errorMessage,
			};
		}
	},
	{ type: "tool", name: "getSandboxDomain" },
);

/**
 * Create sandbox domain tool with injected runtime context
 */
export const getSandboxDomainTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "Get the public domain URL for a specific port in a sandbox",
	inputSchema: z.object({
		sandboxId: z.string().describe("The sandbox ID"),
		port: z.number().describe("Port number to get domain for"),
	}),
	execute: executeGetSandboxDomain,
});

/**
 * Wrapped list sandbox routes function with Braintrust tracing
 */
const executeListSandboxRoutes = wrapTraced(
	async function executeListSandboxRoutes(
		{
			sandboxId,
		}: {
			sandboxId: string;
		},
		context: RuntimeContext<AppRuntimeContext>,
	) {
		try {
			// Log metadata
			currentSpan().log({
				metadata: {
					sandboxId,
					contextInfo: {
						threadId: context.sessionId,
						resourceId: context.resourceId,
					},
				},
			});

			// Get the sandbox instance using the ID
			const sandbox = await Sandbox.get({ sandboxId });

			// Get all routes
			const routes = sandbox.routes.map((route) => ({
				port: route.port,
				url: route.url,
				subdomain: route.subdomain,
			}));

			// Log results
			currentSpan().log({
				metadata: {
					routeCount: routes.length,
					routes,
				},
			});

			return {
				success: true,
				routes,
				message: `Found ${routes.length} exposed port(s) for sandbox ${sandboxId}`,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			// Log error
			currentSpan().log({
				metadata: {
					error: {
						message: errorMessage,
						type: error instanceof Error ? error.constructor.name : "UnknownError",
						sandboxId,
					},
				},
			});
			return {
				success: false,
				message: errorMessage,
			};
		}
	},
	{ type: "tool", name: "listSandboxRoutes" },
);

/**
 * Create list sandbox routes tool with injected runtime context
 */
export const listSandboxRoutesTool = createTool<RuntimeContext<AppRuntimeContext>>({
	description: "List all exposed ports and their public URLs for a sandbox",
	inputSchema: z.object({
		sandboxId: z.string().describe("The sandbox ID"),
	}),
	execute: executeListSandboxRoutes,
});
