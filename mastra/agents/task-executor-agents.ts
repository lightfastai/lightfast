import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core";
import { generateObject } from "ai";
import { z } from "zod";
import { taskExecutionChannel } from "@/lib/mastra/realtime";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

// Define the state interface for the task execution workflow
export interface TaskExecutionState {
	chatId: string;
	taskDescription: string;
	status: "analyzing" | "environment-setup" | "generating-scripts" | "executing" | "complete" | "error";
	analysis?: {
		taskType: string;
		complexity: string;
		dependencies: Array<{
			type: string;
			name: string;
			version?: string;
			required: boolean;
		}>;
		executionPlan: Array<{
			step: number;
			description: string;
			script?: string;
			dependencies: string[];
		}>;
		estimatedDuration: string;
		riskFactors: string[];
	};
	environment?: {
		language: string;
		systemPackages?: string[];
		npmPackages?: Record<string, string>;
		pipPackages?: string[];
		setupCommands: string[];
		directories?: string[];
		environmentVariables?: Record<string, string>;
	};
	scripts?: {
		scripts: Array<{
			filename: string;
			language: string;
			description: string;
			code: string;
			executable: boolean;
			order: number;
		}>;
		mainScript: {
			filename: string;
			language: string;
			code: string;
		};
	};
	executionResults?: {
		results: Array<{
			scriptName: string;
			success: boolean;
			output: string;
			error: string;
			duration: number;
		}>;
		finalOutput: string;
		summary: string;
		nextSteps: string[];
	};
	error?: string;
}

// Shared sandbox instance for all agents
let sharedSandbox: SandboxExecutor | null = null;

export const taskAnalyzerAgent = new Agent({
	name: "taskAnalyzerAgent",
	description: "Analyzes computational tasks and creates execution plans",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `Analyze computational tasks and create detailed execution plans for any type of task.

You have access to a powerful sandbox environment with:
- Multiple programming languages: Node.js 22, Python 3.13
- System tools: ffmpeg, ImageMagick, git, and more via dnf package manager
- File system operations and network access
- Ability to install any packages or dependencies

Analyze tasks broadly - they could involve:
- Data processing and analysis
- Web development and APIs
- Media processing (audio/video/images)
- System administration and automation
- Security analysis and scanning
- Machine learning and AI
- File transformations
- Or any other computational task

When given a task, analyze it thoroughly and provide a comprehensive execution plan.`,
});

export const environmentSetupAgent = new Agent({
	name: "environmentSetupAgent",
	description: "Configures execution environment based on task requirements",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `Configure execution environments for any type of computational task.

You need to prepare the sandbox environment based on the task analysis. Consider:
- Choose appropriate programming language(s) based on the task
- Install necessary system packages via dnf
- Set up language-specific dependencies (npm/pip packages)
- Create necessary directory structures
- Configure environment variables if needed

Available resources:
- Languages: Node.js 22, Python 3.13, Bash
- Package managers: npm, pnpm, pip, uv, dnf
- Working directory: /home/vercel-sandbox
- User: vercel-sandbox (with sudo access)
- Pre-installed: git, curl, tar, gzip, and basic system tools
- Can install: ffmpeg, ImageMagick, development tools, security scanners, etc.

Create a comprehensive environment setup plan based on the task analysis.`,
});

export const scriptGeneratorAgent = new Agent({
	name: "scriptGeneratorAgent",
	description: "Generates executable scripts in appropriate languages",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `Generate executable scripts in the appropriate language for the task.

You can create scripts in:
- JavaScript/Node.js (.js files)
- Python (.py files)
- Bash (.sh files)
- Or any combination needed

Consider the task requirements and environment setup to choose the right approach:
- Use Node.js for web APIs, JavaScript processing, npm packages
- Use Python for data science, ML, scientific computing, pip packages
- Use Bash for system operations, file processing, orchestration
- Mix languages when beneficial (e.g., bash to orchestrate, Python for processing)

Working directory: /home/vercel-sandbox
All scripts should handle errors gracefully and provide clear output.

Generate well-structured, maintainable scripts with clear documentation.`,
});

export const executionAgent = new Agent({
	name: "executionAgent",
	description: "Executes scripts in sandbox and manages results",
	model: anthropic("claude-4-sonnet-20250514"),
	instructions: `Execute scripts safely in the sandbox environment and collect results.

You will execute scripts that may be written in:
- JavaScript (node filename.js)
- Python (python3 filename.py)
- Bash (bash filename.sh or ./filename.sh if executable)

The sandbox provides:
- Working directory: /home/vercel-sandbox
- Full file system access
- Network access
- Installed tools and packages from environment setup
- Ability to run commands with sudo if needed

Execute scripts in order, handle errors gracefully, and collect all output.
Provide clear reporting of results and any errors encountered.`,
});

// Helper functions for task execution
export async function analyzeTask(taskDescription: string, chatId: string) {
	const channel = taskExecutionChannel(chatId);

	channel.messages({
		id: crypto.randomUUID(),
		message: "🔍 Analyzing your task requirements...",
		role: "assistant",
	});

	const result = await generateObject({
		model: anthropic("claude-4-sonnet-20250514"),
		prompt: `Analyze this task: ${taskDescription}

Consider that you have access to:
- Programming languages: Node.js 22, Python 3.13, Bash
- System tools: ffmpeg, ImageMagick, git, curl, and any tool installable via dnf
- Package managers: npm, pip, dnf
- Full file system access in /home/vercel-sandbox
- Network access for APIs and downloads

Provide:
1. Task type (choose the most appropriate)
2. Complexity (simple/moderate/complex)
3. Dependencies needed (languages, tools, packages)
4. Step-by-step execution plan
5. Estimated duration
6. Risk factors`,
		schema: z.object({
			taskType: z.enum([
				"web-development",
				"data-processing",
				"media-processing",
				"system-administration",
				"security-analysis",
				"machine-learning",
				"api-integration",
				"file-operation",
				"code-generation",
				"testing",
				"documentation",
				"other",
			]),
			complexity: z.enum(["simple", "moderate", "complex"]),
			dependencies: z.array(
				z.object({
					type: z.enum(["library", "api", "file", "system-tool", "data"]),
					name: z.string(),
					version: z.string().optional(),
					required: z.boolean(),
				}),
			),
			executionPlan: z.array(
				z.object({
					step: z.number(),
					description: z.string(),
					script: z.string().optional(),
					dependencies: z.array(z.string()),
				}),
			),
			estimatedDuration: z.string(),
			riskFactors: z.array(z.string()),
		}),
	});

	channel.messages({
		id: crypto.randomUUID(),
		message: `✅ Task analyzed: ${result.object.taskType} (${result.object.complexity} complexity)`,
		role: "assistant",
	});

	return result.object;
}

export async function setupEnvironment(analysis: TaskExecutionState["analysis"], chatId: string) {
	const channel = taskExecutionChannel(chatId);

	channel.messages({
		id: crypto.randomUUID(),
		message: "🛠️ Setting up execution environment...",
		role: "assistant",
	});

	const result = await generateObject({
		model: anthropic("claude-4-sonnet-20250514"),
		prompt: `Based on this task analysis, create environment setup:
${JSON.stringify(analysis, null, 2)}

Create a setup plan that includes:
1. Programming language setup (Node.js/Python/Both/Neither)
2. System packages to install via dnf
3. Language-specific packages (npm/pip)
4. Setup commands to run
5. Directory structure to create
6. Environment variables if needed

Be flexible - not all tasks need package.json. Some might need pip requirements, system tools, or just bash scripts.`,
		schema: z.object({
			language: z.enum(["nodejs", "python", "both", "bash-only"]),
			systemPackages: z.array(z.string()).optional(),
			npmPackages: z.record(z.string()).optional(),
			pipPackages: z.array(z.string()).optional(),
			setupCommands: z.array(z.string()),
			directories: z.array(z.string()).optional(),
			environmentVariables: z.record(z.string()).optional(),
		}),
	});

	channel.messages({
		id: crypto.randomUUID(),
		message: "✅ Environment configured",
		role: "assistant",
	});

	return result.object;
}

export async function generateScripts(
	analysis: TaskExecutionState["analysis"],
	environment: TaskExecutionState["environment"],
	taskDescription: string,
	chatId: string,
) {
	const channel = taskExecutionChannel(chatId);

	channel.messages({
		id: crypto.randomUUID(),
		message: "📝 Generating executable scripts...",
		role: "assistant",
	});

	const result = await generateObject({
		model: anthropic("claude-4-sonnet-20250514"),
		prompt: `Generate scripts for this task:
Analysis: ${JSON.stringify(analysis, null, 2)}
Environment: ${JSON.stringify(environment, null, 2)}
Original task: ${taskDescription}

Create scripts in the appropriate language(s) based on the environment setup.
Include:
1. Individual scripts/functions for each step
2. Main orchestration script
3. Error handling
4. Clear, structured output
5. Progress indicators

Scripts can be .js, .py, .sh or any combination.`,
		schema: z.object({
			scripts: z.array(
				z.object({
					filename: z.string(),
					language: z.enum(["javascript", "python", "bash", "other"]),
					description: z.string(),
					code: z.string(),
					executable: z.boolean(),
					order: z.number(),
				}),
			),
			mainScript: z.object({
				filename: z.string(),
				language: z.enum(["javascript", "python", "bash", "other"]),
				code: z.string(),
			}),
		}),
	});

	channel.messages({
		id: crypto.randomUUID(),
		message: `✅ Generated ${result.object.scripts.length} scripts`,
		role: "assistant",
	});

	return result.object;
}

export async function executeScripts(
	scripts: TaskExecutionState["scripts"],
	environment: TaskExecutionState["environment"],
	chatId: string,
) {
	const channel = taskExecutionChannel(chatId);

	channel.messages({
		id: crypto.randomUUID(),
		message: "🚀 Executing scripts in sandbox...",
		role: "assistant",
	});

	if (!scripts || !environment) {
		throw new Error("Missing required state");
	}

	// Initialize shared sandbox if not already created
	if (!sharedSandbox) {
		sharedSandbox = new SandboxExecutor();
	}

	const results: Array<{
		scriptName: string;
		success: boolean;
		output: string;
		error: string;
		duration: number;
	}> = [];
	let finalOutput = "";

	try {
		// Initialize sandbox
		await sharedSandbox.initialize();

		// Setup environment - install system packages
		if (environment.systemPackages?.length) {
			channel.messages({
				id: crypto.randomUUID(),
				message: `📦 Installing system packages: ${environment.systemPackages.join(", ")}`,
				role: "assistant",
			});
			await sharedSandbox.installPackages(environment.systemPackages);
		}

		// Create directories
		if (environment.directories?.length) {
			for (const dir of environment.directories) {
				await sharedSandbox.createDirectory(dir);
			}
		}

		// Run setup commands
		for (const cmd of environment.setupCommands) {
			channel.messages({
				id: crypto.randomUUID(),
				message: `⚙️ Running setup: ${cmd}`,
				role: "assistant",
			});
			await sharedSandbox.executeScript(cmd, "bash");
		}

		// Set environment variables
		const envVars = environment.environmentVariables || {};

		// Write all scripts
		const scriptFiles = scripts.scripts.map((s) => ({
			path: `/home/vercel-sandbox/${s.filename}`,
			content: s.code,
		}));

		scriptFiles.push({
			path: `/home/vercel-sandbox/${scripts.mainScript.filename}`,
			content: scripts.mainScript.code,
		});

		await sharedSandbox.writeFiles(scriptFiles);

		// Make executable scripts executable
		for (const script of scripts.scripts) {
			if (script.executable) {
				await sharedSandbox.runCommand("chmod", ["+x", script.filename], {
					cwd: "/home/vercel-sandbox",
				});
			}
		}

		// Execute scripts in order
		for (const script of scripts.scripts.sort((a, b) => a.order - b.order)) {
			channel.messages({
				id: crypto.randomUUID(),
				message: `⚙️ Running: ${script.filename}`,
				role: "assistant",
			});

			let execResult: Awaited<ReturnType<typeof sharedSandbox.runCommand>>;
			switch (script.language) {
				case "python":
					execResult = await sharedSandbox.runCommand("python3", [script.filename], {
						cwd: "/home/vercel-sandbox",
						env: envVars,
					});
					break;
				case "javascript":
					execResult = await sharedSandbox.runCommand("node", [script.filename], {
						cwd: "/home/vercel-sandbox",
						env: envVars,
					});
					break;
				case "bash":
					if (script.executable) {
						execResult = await sharedSandbox.runCommand(`./${script.filename}`, [], {
							cwd: "/home/vercel-sandbox",
							env: envVars,
						});
					} else {
						execResult = await sharedSandbox.runCommand("bash", [script.filename], {
							cwd: "/home/vercel-sandbox",
							env: envVars,
						});
					}
					break;
				default:
					execResult = await sharedSandbox.executeScript(`cat ${script.filename} | sh`, "bash");
			}

			results.push({
				scriptName: script.filename,
				success: execResult.success,
				output: execResult.stdout,
				error: execResult.stderr,
				duration: execResult.duration,
			});

			if (execResult.stdout) {
				channel.messages({
					id: crypto.randomUUID(),
					message: `📤 Output from ${script.filename}:\n\`\`\`\n${execResult.stdout}\n\`\`\``,
					role: "assistant",
				});
			}

			if (!execResult.success) {
				throw new Error(`Script ${script.filename} failed: ${execResult.stderr}`);
			}
		}

		// Execute main script
		let mainResult: Awaited<ReturnType<typeof sharedSandbox.runCommand>>;
		switch (scripts.mainScript.language) {
			case "python":
				mainResult = await sharedSandbox.runCommand("python3", [scripts.mainScript.filename], {
					cwd: "/home/vercel-sandbox",
					env: envVars,
				});
				break;
			case "javascript":
				mainResult = await sharedSandbox.runCommand("node", [scripts.mainScript.filename], {
					cwd: "/home/vercel-sandbox",
					env: envVars,
				});
				break;
			case "bash":
				mainResult = await sharedSandbox.runCommand("bash", [scripts.mainScript.filename], {
					cwd: "/home/vercel-sandbox",
					env: envVars,
				});
				break;
			default:
				mainResult = await sharedSandbox.executeScript(`cat ${scripts.mainScript.filename} | sh`, "bash");
		}

		finalOutput = mainResult.stdout;

		channel.messages({
			id: crypto.randomUUID(),
			message: `✅ Task completed successfully!\n\nFinal output:\n\`\`\`\n${finalOutput}\n\`\`\``,
			role: "assistant",
		});

		return {
			results,
			finalOutput,
			summary: "Task completed successfully",
			nextSteps: [],
		};
	} catch (error) {
		channel.messages({
			id: crypto.randomUUID(),
			message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			role: "assistant",
		});
		throw error;
	}
}

// Cleanup function for shared sandbox
export async function cleanupSandbox() {
	if (sharedSandbox) {
		await sharedSandbox.cleanup();
		sharedSandbox = null;
	}
}
