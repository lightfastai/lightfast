import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { taskExecutionChannel } from "@/lib/mastra/realtime";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function executeTaskWorkflow(input: { taskDescription: string; chatId: string; constraints?: string }) {
	const { taskDescription, chatId } = input;
	const channel = taskExecutionChannel(chatId);
	const sandbox = new SandboxExecutor();

	try {
		// Send initial status
		channel.status({
			status: "starting",
			message: "Task execution started",
		});

		// Step 1: Analyze task
		channel.messages({
			id: crypto.randomUUID(),
			message: "🔍 Analyzing your task requirements...",
			role: "assistant",
		});

		const analysis = await generateObject({
			model: anthropic("claude-3-5-sonnet-20241022"),
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
			message: `✅ Task analyzed: ${analysis.object.taskType} (${analysis.object.complexity} complexity)`,
			role: "assistant",
		});

		// Step 2: Setup environment
		channel.messages({
			id: crypto.randomUUID(),
			message: "🛠️ Setting up execution environment...",
			role: "assistant",
		});

		const environment = await generateObject({
			model: anthropic("claude-3-5-sonnet-20241022"),
			prompt: `Based on this task analysis, create environment setup:
${JSON.stringify(analysis.object, null, 2)}

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

		// Step 3: Generate scripts
		channel.messages({
			id: crypto.randomUUID(),
			message: "📝 Generating executable scripts...",
			role: "assistant",
		});

		const scripts = await generateObject({
			model: anthropic("claude-3-5-sonnet-20241022"),
			prompt: `Generate scripts for this task:
Analysis: ${JSON.stringify(analysis.object, null, 2)}
Environment: ${JSON.stringify(environment.object, null, 2)}
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
			message: `✅ Generated ${scripts.object.scripts.length} scripts`,
			role: "assistant",
		});

		// Step 4: Execute scripts
		channel.messages({
			id: crypto.randomUUID(),
			message: "🚀 Executing scripts in sandbox...",
			role: "assistant",
		});

		interface ScriptResult {
			scriptName: string;
			success: boolean;
			output: string;
			error: string;
			duration: number;
		}
		const results: ScriptResult[] = [];
		let finalOutput: string | null = null;

		// Initialize sandbox
		await sandbox.initialize();

		// Setup environment - install system packages
		if (environment.object.systemPackages?.length) {
			channel.messages({
				id: crypto.randomUUID(),
				message: `📦 Installing system packages: ${environment.object.systemPackages.join(", ")}`,
				role: "assistant",
			});
			await sandbox.installPackages(environment.object.systemPackages);
		}

		// Create directories
		if (environment.object.directories?.length) {
			for (const dir of environment.object.directories) {
				await sandbox.createDirectory(dir);
			}
		}

		// Run setup commands
		for (const cmd of environment.object.setupCommands) {
			channel.messages({
				id: crypto.randomUUID(),
				message: `⚙️ Running setup: ${cmd}`,
				role: "assistant",
			});
			await sandbox.executeScript(cmd, "bash");
		}

		// Set environment variables
		const envVars = environment.object.environmentVariables || {};

		// Write all scripts
		const scriptFiles = scripts.object.scripts.map((s) => ({
			path: `/home/vercel-sandbox/${s.filename}`,
			content: s.code,
		}));

		scriptFiles.push({
			path: `/home/vercel-sandbox/${scripts.object.mainScript.filename}`,
			content: scripts.object.mainScript.code,
		});

		await sandbox.writeFiles(scriptFiles);

		// Make executable scripts executable
		for (const script of scripts.object.scripts) {
			if (script.executable) {
				await sandbox.runCommand("chmod", ["+x", script.filename], {
					cwd: "/home/vercel-sandbox",
				});
			}
		}

		// Execute scripts in order
		for (const script of scripts.object.scripts.sort((a, b) => a.order - b.order)) {
			channel.messages({
				id: crypto.randomUUID(),
				message: `⚙️ Running: ${script.filename}`,
				role: "assistant",
			});

			let execResult: Awaited<ReturnType<typeof sandbox.runCommand>>;
			switch (script.language) {
				case "python":
					execResult = await sandbox.runCommand("python3", [script.filename], {
						cwd: "/home/vercel-sandbox",
						env: envVars,
					});
					break;
				case "javascript":
					execResult = await sandbox.runCommand("node", [script.filename], {
						cwd: "/home/vercel-sandbox",
						env: envVars,
					});
					break;
				case "bash":
					if (script.executable) {
						execResult = await sandbox.runCommand(`./${script.filename}`, [], {
							cwd: "/home/vercel-sandbox",
							env: envVars,
						});
					} else {
						execResult = await sandbox.runCommand("bash", [script.filename], {
							cwd: "/home/vercel-sandbox",
							env: envVars,
						});
					}
					break;
				default:
					execResult = await sandbox.executeScript(`cat ${script.filename} | sh`, "bash");
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
		let mainResult: Awaited<ReturnType<typeof sandbox.runCommand>>;
		switch (scripts.object.mainScript.language) {
			case "python":
				mainResult = await sandbox.runCommand("python3", [scripts.object.mainScript.filename], {
					cwd: "/home/vercel-sandbox",
					env: envVars,
				});
				break;
			case "javascript":
				mainResult = await sandbox.runCommand("node", [scripts.object.mainScript.filename], {
					cwd: "/home/vercel-sandbox",
					env: envVars,
				});
				break;
			case "bash":
				mainResult = await sandbox.runCommand("bash", [scripts.object.mainScript.filename], {
					cwd: "/home/vercel-sandbox",
					env: envVars,
				});
				break;
			default:
				mainResult = await sandbox.executeScript(`cat ${scripts.object.mainScript.filename} | sh`, "bash");
		}

		finalOutput = mainResult.stdout;

		const executionResults = {
			results,
			finalOutput,
			summary: "Task completed successfully",
			nextSteps: [],
		};

		channel.messages({
			id: crypto.randomUUID(),
			message: `✅ Task completed successfully!\n\nFinal output:\n\`\`\`\n${finalOutput}\n\`\`\``,
			role: "assistant",
		});

		channel.status({
			status: "completed",
			message: "Task execution completed",
		});

		// Clean up
		await sandbox.cleanup();

		return {
			success: true,
			chatId,
			results: executionResults,
			analysis: analysis.object,
			scripts: scripts.object,
		};
	} catch (error) {
		await sandbox.cleanup();

		channel.messages({
			id: crypto.randomUUID(),
			message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			role: "assistant",
		});

		channel.status({
			status: "error",
			message: error instanceof Error ? error.message : "Unknown error",
		});

		return {
			success: false,
			chatId,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
