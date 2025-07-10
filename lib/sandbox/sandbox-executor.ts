import { Sandbox } from "@vercel/sandbox";
import ms from "ms";

export interface SandboxExecutionResult {
	success: boolean;
	output?: string;
	error?: string;
	exitCode?: number;
	duration: number;
}

export class SandboxExecutor {
	private sandbox: Sandbox | null = null;

	async initialize(): Promise<void> {
		if (!this.sandbox) {
			// Create sandbox with proper configuration
			// VERCEL_OIDC_TOKEN is automatically inferred from environment
			this.sandbox = await Sandbox.create({
				timeout: ms("10m"), // 10 minute timeout
				runtime: "node22",
			});
		}
	}

	async setupEnvironment(packageJson: object, setupScript: string): Promise<SandboxExecutionResult> {
		const startTime = Date.now();

		try {
			await this.initialize();

			// Create directory structure first
			await this.sandbox?.runCommand({
				cmd: "mkdir",
				args: ["-p", "/home/vercel-sandbox/project"],
			});

			// Write package.json using Node.js
			const packageJsonContent = JSON.stringify(packageJson, null, 2);
			await this.sandbox?.runCommand({
				cmd: "node",
				args: [
					"-e",
					`require('fs').writeFileSync('/home/vercel-sandbox/project/package.json', ${JSON.stringify(packageJsonContent)})`,
				],
			});

			// Install dependencies
			const installResult = await this.sandbox?.runCommand({
				cmd: "npm",
				args: ["install"],
				cwd: "/home/vercel-sandbox/project",
			});

			if (!installResult || installResult.exitCode !== 0) {
				const stderr = installResult ? await installResult.stderr() : "No install result";
				return {
					success: false,
					error: `Failed to install dependencies: ${stderr}`,
					exitCode: installResult?.exitCode,
					duration: Date.now() - startTime,
				};
			}

			// Write setup script using Node.js
			await this.sandbox?.runCommand({
				cmd: "node",
				args: [
					"-e",
					`require('fs').writeFileSync('/home/vercel-sandbox/project/setup.js', ${JSON.stringify(setupScript)})`,
				],
			});
			
			const setupResult = await this.sandbox?.runCommand({
				cmd: "node",
				args: ["setup.js"],
				cwd: "/home/vercel-sandbox/project",
			});

			if (!setupResult) {
				return {
					success: false,
					error: "No setup result",
					duration: Date.now() - startTime,
				};
			}

			const stdout = await setupResult.stdout();
			const stderr = await setupResult.stderr();

			return {
				success: setupResult.exitCode === 0,
				output: stdout,
				error: stderr || undefined,
				exitCode: setupResult.exitCode,
				duration: Date.now() - startTime,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error during setup",
				duration: Date.now() - startTime,
			};
		}
	}

	async executeScript(scriptName: string, scriptContent: string): Promise<SandboxExecutionResult> {
		const startTime = Date.now();

		try {
			await this.initialize();

			// Ensure directory exists
			await this.sandbox?.runCommand({
				cmd: "mkdir",
				args: ["-p", "/home/vercel-sandbox/project"],
			});

			// Write script using Node.js
			await this.sandbox?.runCommand({
				cmd: "node",
				args: [
					"-e",
					`require('fs').writeFileSync('/home/vercel-sandbox/project/${scriptName}', ${JSON.stringify(scriptContent)})`,
				],
			});

			// Execute script
			const result = await this.sandbox?.runCommand({
				cmd: "node",
				args: [scriptName],
				cwd: "/home/vercel-sandbox/project",
			});

			if (!result) {
				return {
					success: false,
					error: "No execution result",
					duration: Date.now() - startTime,
				};
			}

			const stdout = await result.stdout();
			const stderr = await result.stderr();

			return {
				success: result.exitCode === 0,
				output: stdout,
				error: stderr || undefined,
				exitCode: result.exitCode,
				duration: Date.now() - startTime,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error during execution",
				duration: Date.now() - startTime,
			};
		}
	}

	async cleanup(): Promise<void> {
		if (this.sandbox) {
			// Sandbox is cleaned up automatically when dereferenced
			this.sandbox = null;
		}
	}
}