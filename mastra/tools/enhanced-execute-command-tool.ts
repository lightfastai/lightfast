import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

// Shared sandbox instance to maintain state across commands
let sharedSandbox: SandboxExecutor | null = null;
let currentWorkingDirectory = "/home/vercel-sandbox";

// Tool for executing commands with automatic memory updates
export const enhancedExecuteCommandTool = createTool({
	id: "execute_command",
	description: "Execute a command in the sandbox with automatic context tracking",
	inputSchema: z.object({
		command: z.string().describe("The command to execute"),
		args: z.array(z.string()).default([]).describe("Command arguments"),
		description: z.string().optional().describe("What this command is intended to do"),
		updateMemory: z
			.object({
				discoveredPattern: z.string().optional(),
				importantFile: z.string().optional(),
				insight: z.object({
					key: z.string(),
					value: z.string(),
				}).optional(),
				completedStep: z.string().optional(),
			})
			.optional()
			.describe("Memory updates to apply after command execution"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		stdout: z.string(),
		stderr: z.string(),
		exitCode: z.number(),
		duration: z.number(),
		memoryUpdates: z.object({
			workingDirectory: z.string().optional(),
			createdFile: z.string().optional(),
			modifiedFile: z.string().optional(),
			installedPackage: z.string().optional(),
			discovery: z.string().optional(),
		}).optional(),
	}),
	execute: async ({ context }) => {
		const { command, args, description, updateMemory } = context;
		
		// Initialize or reuse sandbox
		if (!sharedSandbox) {
			sharedSandbox = new SandboxExecutor();
			await sharedSandbox.initialize();
		}

		try {
			// Execute the command with current working directory
			const result = await sharedSandbox.runCommand(command, args, {
				cwd: currentWorkingDirectory,
			});

			// Prepare memory updates based on command type
			const memoryUpdates: any = {};

			// Track directory changes
			if (command === "cd" && result.success && args.length > 0) {
				const newPath = args[0];
				if (newPath.startsWith("/")) {
					currentWorkingDirectory = newPath;
				} else if (newPath === "..") {
					currentWorkingDirectory = currentWorkingDirectory.split("/").slice(0, -1).join("/") || "/";
				} else {
					currentWorkingDirectory = `${currentWorkingDirectory}/${newPath}`.replace(/\/+/g, "/");
				}
				memoryUpdates.workingDirectory = currentWorkingDirectory;
			}

			// Track file creation
			if ((command === "touch" || command === "echo" || command === "cp") && result.success) {
				const fileName = args[args.length - 1];
				if (fileName && !fileName.startsWith("-")) {
					memoryUpdates.createdFile = fileName;
				}
			}

			// Track file modifications
			if ((command === "sed" || command === "awk" || command === "perl") && result.success) {
				const fileName = args.find(arg => !arg.startsWith("-") && arg.includes("."));
				if (fileName) {
					memoryUpdates.modifiedFile = fileName;
				}
			}

			// Track package installations
			if (command === "npm" && args[0] === "install" && result.success) {
				const packageName = args.find(arg => !arg.startsWith("-") && arg !== "install");
				if (packageName) {
					memoryUpdates.installedPackage = packageName;
				}
			} else if (command === "pip" && args[0] === "install" && result.success) {
				const packageName = args.find(arg => !arg.startsWith("-") && arg !== "install");
				if (packageName) {
					memoryUpdates.installedPackage = packageName;
				}
			} else if (command === "dnf" && args[0] === "install" && result.success) {
				const packages = args.slice(2); // Skip "install -y"
				if (packages.length > 0) {
					memoryUpdates.installedPackage = packages.join(", ");
				}
			}

			// Track git operations
			if (command === "git" && args[0] === "clone" && result.success) {
				const repoUrl = args.find(arg => arg.includes("://") || arg.includes("@"));
				if (repoUrl) {
					const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
					memoryUpdates.createdFile = repoName;
					memoryUpdates.discovery = `Cloned repository: ${repoName}`;
				}
			}

			// Add any custom memory updates requested
			if (updateMemory) {
				if (updateMemory.discoveredPattern) {
					memoryUpdates.discovery = updateMemory.discoveredPattern;
				}
				if (updateMemory.importantFile) {
					memoryUpdates.discovery = `Important file: ${updateMemory.importantFile}`;
				}
			}

			// Include description as part of the result for context
			const enhancedStdout = description 
				? `[${description}]\n${result.stdout}` 
				: result.stdout;

			return {
				success: result.success,
				stdout: enhancedStdout,
				stderr: result.stderr,
				exitCode: result.exitCode,
				duration: result.duration,
				memoryUpdates: Object.keys(memoryUpdates).length > 0 ? memoryUpdates : undefined,
			};
		} catch (error) {
			return {
				success: false,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				exitCode: -1,
				duration: 0,
			};
		}
	},
});

// Function to cleanup sandbox when done
export async function cleanupSandbox() {
	if (sharedSandbox) {
		await sharedSandbox.cleanup();
		sharedSandbox = null;
		currentWorkingDirectory = "/home/vercel-sandbox";
	}
}