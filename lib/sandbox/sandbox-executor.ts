import { Sandbox } from "@vercel/sandbox";

export interface CommandResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number;
	duration: number;
}

export interface FileOperation {
	path: string;
	content: string;
}

/**
 * General-purpose sandbox executor with atomic operations
 * Supports any language/runtime through simple command execution
 */
export class SandboxExecutor {
	private sandbox: Sandbox | null = null;

	/**
	 * Initialize sandbox with configurable runtime
	 */
	async initialize(options?: { runtime?: "node22" | "python3.13" }): Promise<void> {
		if (!this.sandbox) {
			this.sandbox = await Sandbox.create({
				runtime: options?.runtime || "node22",
				timeout: 600000, // 10 minutes
			});
		}
	}

	/**
	 * Execute any command in the sandbox
	 * This is the core atomic operation that enables all functionality
	 */
	async runCommand(
		command: string,
		args: string[] = [],
		options?: {
			cwd?: string;
			env?: Record<string, string>;
			sudo?: boolean;
		},
	): Promise<CommandResult> {
		const startTime = Date.now();

		try {
			await this.initialize();

			const result = await this.sandbox?.runCommand({
				cmd: command,
				args,
				cwd: options?.cwd || "/home/vercel-sandbox",
				env: options?.env,
				sudo: options?.sudo,
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
				duration: Date.now() - startTime,
			};
		} catch (error) {
			return {
				success: false,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				exitCode: -1,
				duration: Date.now() - startTime,
			};
		}
	}

	/**
	 * Write multiple files atomically
	 * Uses shell commands for compatibility across all environments
	 */
	async writeFiles(files: FileOperation[]): Promise<CommandResult> {
		const startTime = Date.now();

		try {
			await this.initialize();

			// Create all directories first
			const dirs = [...new Set(files.map((f) => f.path.substring(0, f.path.lastIndexOf("/"))))].filter(
				(d) => d.length > 0,
			);

			for (const dir of dirs) {
				await this.runCommand("mkdir", ["-p", dir]);
			}

			// Write files using shell commands
			let allSuccess = true;
			let allOutput = "";
			let allErrors = "";

			for (const file of files) {
				// Use printf to handle special characters properly
				const writeResult = await this.runCommand("sh", [
					"-c",
					`printf '%s' '${file.content.replace(/'/g, "'\"'\"'")}' > '${file.path}'`,
				]);

				if (!writeResult.success) {
					allSuccess = false;
					allErrors += `Failed to write ${file.path}: ${writeResult.stderr}\n`;
				} else {
					allOutput += `Written: ${file.path}\n`;
				}
			}

			return {
				success: allSuccess,
				stdout: allOutput,
				stderr: allErrors,
				exitCode: allSuccess ? 0 : 1,
				duration: Date.now() - startTime,
			};
		} catch (error) {
			return {
				success: false,
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error writing files",
				exitCode: -1,
				duration: Date.now() - startTime,
			};
		}
	}

	/**
	 * Read a file from the sandbox
	 */
	async readFile(path: string): Promise<CommandResult> {
		return this.runCommand("cat", [path]);
	}

	/**
	 * Check if a file or directory exists
	 */
	async exists(path: string): Promise<boolean> {
		const result = await this.runCommand("test", ["-e", path]);
		return result.exitCode === 0;
	}

	/**
	 * Install system packages using dnf
	 */
	async installPackages(packages: string[]): Promise<CommandResult> {
		return this.runCommand("dnf", ["install", "-y", ...packages], { sudo: true });
	}

	/**
	 * Change working directory (for subsequent commands)
	 */
	async changeDirectory(path: string): Promise<CommandResult> {
		// Create directory if it doesn't exist
		await this.runCommand("mkdir", ["-p", path]);
		// Verify it exists
		return this.runCommand("cd", [path]);
	}

	/**
	 * List directory contents
	 */
	async listDirectory(path: string = "."): Promise<CommandResult> {
		return this.runCommand("ls", ["-la", path]);
	}

	/**
	 * Get current working directory
	 */
	async getCurrentDirectory(): Promise<CommandResult> {
		return this.runCommand("pwd");
	}

	/**
	 * Remove files or directories
	 */
	async remove(path: string, recursive = false): Promise<CommandResult> {
		const args = recursive ? ["-rf", path] : [path];
		return this.runCommand("rm", args);
	}

	/**
	 * Copy files or directories
	 */
	async copy(source: string, destination: string, recursive = false): Promise<CommandResult> {
		const args = recursive ? ["-r", source, destination] : [source, destination];
		return this.runCommand("cp", args);
	}

	/**
	 * Move/rename files or directories
	 */
	async move(source: string, destination: string): Promise<CommandResult> {
		return this.runCommand("mv", [source, destination]);
	}

	/**
	 * Create a directory
	 */
	async createDirectory(path: string, recursive = true): Promise<CommandResult> {
		const args = recursive ? ["-p", path] : [path];
		return this.runCommand("mkdir", args);
	}

	/**
	 * Download a file from URL
	 */
	async downloadFile(url: string, outputPath?: string): Promise<CommandResult> {
		// Use curl instead of wget as it's more commonly available
		if (outputPath) {
			return this.runCommand("curl", ["-L", "-o", outputPath, url]);
		} else {
			return this.runCommand("curl", ["-L", "-O", url]);
		}
	}

	/**
	 * Extract archive files
	 */
	async extractArchive(filePath: string, outputDir?: string): Promise<CommandResult> {
		const extension = filePath.split(".").pop()?.toLowerCase();

		switch (extension) {
			case "zip":
				return this.runCommand("unzip", outputDir ? [filePath, "-d", outputDir] : [filePath]);
			case "gz":
			case "tgz":
				return this.runCommand("tar", ["-xzf", filePath, ...(outputDir ? ["-C", outputDir] : [])]);
			case "tar":
				return this.runCommand("tar", ["-xf", filePath, ...(outputDir ? ["-C", outputDir] : [])]);
			default:
				return {
					success: false,
					stdout: "",
					stderr: `Unsupported archive format: ${extension}`,
					exitCode: 1,
					duration: 0,
				};
		}
	}

	/**
	 * Get system information
	 */
	async getSystemInfo(): Promise<CommandResult> {
		return this.runCommand("uname", ["-a"]);
	}

	/**
	 * Check available disk space
	 */
	async getDiskSpace(): Promise<CommandResult> {
		return this.runCommand("df", ["-h"]);
	}

	/**
	 * Get environment variables
	 */
	async getEnvironment(): Promise<CommandResult> {
		return this.runCommand("env");
	}

	/**
	 * Kill a process by PID or name
	 */
	async killProcess(identifier: string, byName = false): Promise<CommandResult> {
		if (byName) {
			return this.runCommand("pkill", [identifier]);
		}
		return this.runCommand("kill", [identifier]);
	}

	/**
	 * List running processes
	 */
	async listProcesses(): Promise<CommandResult> {
		return this.runCommand("ps", ["aux"]);
	}

	/**
	 * Execute a shell script
	 */
	async executeScript(script: string, interpreter = "sh"): Promise<CommandResult> {
		return this.runCommand(interpreter, ["-c", script]);
	}

	/**
	 * Clean up sandbox resources
	 */
	async cleanup(): Promise<void> {
		if (this.sandbox) {
			this.sandbox = null;
		}
	}
}
