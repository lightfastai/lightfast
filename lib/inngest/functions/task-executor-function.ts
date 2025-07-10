import { anthropic as anthropicProvider } from "@ai-sdk/anthropic";
import { anthropic, createAgent, createNetwork, createState, createTool } from "@inngest/agent-kit";
import { generateObject } from "ai";
import { z } from "zod";
import { env } from "@/env";
import type { TaskNetworkState } from "@/lib/agent-kit/types/task-network-types";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";
import { inngest } from "../client";
import { taskExecutionChannel } from "../realtime";

export const taskExecutorFunction = inngest.createFunction(
	{
		id: "task-executor",
		name: "Universal Task Executor",
	},
	{ event: "task/execute" },
	async ({ event, step, publish }) => {
		const { taskDescription, chatId, constraints } = event.data;

		// Create a shared sandbox instance for all agents
		const sharedSandbox = new SandboxExecutor();

		// Publish initial status
		await publish(
			taskExecutionChannel(chatId).status({
				status: "starting",
				message: "Task execution started",
			}),
		);

		// Define agents inside the function to access publish
		const taskAnalyzerAgent = createAgent<TaskNetworkState>({
			name: "Task Analyzer",
			description: "Analyzes computational tasks",
			system: `Analyze computational tasks and create detailed execution plans for any type of task.

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

When given a task, use the analyze_task tool to process it.`,

			tools: [
				createTool({
					name: "analyze_task",
					description: "Analyze a computational task",
					parameters: z.object({
						taskDescription: z.string(),
					}),
					handler: async (params, { network }) => {
						console.log("Analyze task handler called with params:", params);

						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: "🔍 Analyzing your task requirements...",
								role: "assistant",
							}),
						);

						const state = network.state.data;
						console.log("Current state before update:", JSON.stringify(state, null, 2));
						state.taskDescription = params.taskDescription;

						// Generate object directly without nested step
						const _result = await generateObject({
							model: anthropicProvider("claude-3-5-sonnet-20241022"),
							prompt: `Analyze this task: ${params.taskDescription}

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

						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: `✅ Task analyzed: ${_result.object.taskType} (${_result.object.complexity} complexity)`,
								role: "assistant",
							}),
						);

						state.analysis = _result.object;
						state.status = "environment-setup";

						return { success: true, data: _result.object };
					},
				}),
			],
		});

		const environmentSetupAgent = createAgent<TaskNetworkState>({
			name: "Environment Setup",
			description: "Sets up execution environment",
			system: `Configure execution environments for any type of computational task. 

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

When the task analysis is complete, use the setup_environment tool to configure the environment.`,

			tools: [
				createTool({
					name: "setup_environment",
					description: "Create environment configuration",
					parameters: z.object({}),
					handler: async (_params, { network }) => {
						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: "🛠️ Setting up execution environment...",
								role: "assistant",
							}),
						);

						const state = network.state.data;
						const analysis = state.analysis;

						if (!analysis) {
							return { success: false, error: "No task analysis found" };
						}

						// Generate object directly without nested step
						const result = await generateObject({
							model: anthropicProvider("claude-3-5-sonnet-20241022"),
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

						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: "✅ Environment configured",
								role: "assistant",
							}),
						);

						state.environment = result.object;
						state.status = "generating-scripts";

						return { success: true, data: result.object };
					},
				}),
			],
		});

		const scriptGeneratorAgent = createAgent<TaskNetworkState>({
			name: "Script Generator",
			description: "Generates executable scripts",
			system: `Generate executable scripts in the appropriate language for the task.

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

When the environment is set up, use the generate_scripts tool to create the necessary scripts.`,

			tools: [
				createTool({
					name: "generate_scripts",
					description: "Generate executable scripts",
					parameters: z.object({}),
					handler: async (_params, { network }) => {
						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: "📝 Generating executable scripts...",
								role: "assistant",
							}),
						);

						const state = network.state.data;
						const analysis = state.analysis;
						const environment = state.environment;

						if (!analysis || !environment) {
							return { success: false, error: "Missing required state" };
						}

						// Generate object directly without nested step
						const result = await generateObject({
							model: anthropicProvider("claude-3-5-sonnet-20241022"),
							prompt: `Generate scripts for this task:
Analysis: ${JSON.stringify(analysis, null, 2)}
Environment: ${JSON.stringify(environment, null, 2)}
Original task: ${state.taskDescription}

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
										filename: z.string(), // e.g., "process_data.py", "setup.sh"
										language: z.enum(["javascript", "python", "bash", "other"]),
										description: z.string(),
										code: z.string(),
										executable: z.boolean(), // whether to chmod +x
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

						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: `✅ Generated ${result.object.scripts.length} scripts`,
								role: "assistant",
							}),
						);

						state.scripts = result.object;
						state.status = "executing";

						return { success: true, data: result.object };
					},
				}),
			],
		});

		const executionAgent = createAgent<TaskNetworkState>({
			name: "Execution Agent",
			description: "Executes scripts in sandbox",
			system: `Execute scripts safely in the sandbox environment and collect results.

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
When scripts are generated, use the execute_scripts tool to run them.`,

			tools: [
				createTool({
					name: "execute_scripts",
					description: "Execute generated scripts",
					parameters: z.object({}),
					handler: async (_params, { network }) => {
						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: "🚀 Executing scripts in sandbox...",
								role: "assistant",
							}),
						);

						const state = network.state.data;
						const scripts = state.scripts;
						const environment = state.environment;

						if (!scripts || !environment) {
							return { success: false, error: "Missing required state" };
						}

						const results: any[] = [];
						let finalOutput: any = null;

						try {
							// Initialize sandbox
							await sharedSandbox.initialize();

							// Setup environment - install system packages
							if (environment.systemPackages?.length) {
								await publish(
									taskExecutionChannel(chatId).messages({
										id: crypto.randomUUID(),
										message: `📦 Installing system packages: ${environment.systemPackages.join(", ")}`,
										role: "assistant",
									}),
								);
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
								await publish(
									taskExecutionChannel(chatId).messages({
										id: crypto.randomUUID(),
										message: `⚙️ Running setup: ${cmd}`,
										role: "assistant",
									}),
								);
								await sharedSandbox.executeScript(cmd, "bash");
							}

							// Set environment variables
							const envVars = environment.environmentVariables || {};

							// Write and execute scripts
							const scriptFiles = scripts.scripts.map((s: any) => ({
								path: `/home/vercel-sandbox/${s.filename}`,
								content: s.code,
							}));

							// Add main script
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
							for (const script of scripts.scripts.sort((a: any, b: any) => a.order - b.order)) {
								await publish(
									taskExecutionChannel(chatId).messages({
										id: crypto.randomUUID(),
										message: `⚙️ Running: ${script.filename}`,
										role: "assistant",
									}),
								);

								let execResult;
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
									await publish(
										taskExecutionChannel(chatId).messages({
											id: crypto.randomUUID(),
											message: `📤 Output from ${script.filename}:\n\`\`\`\n${execResult.stdout}\n\`\`\``,
											role: "assistant",
										}),
									);
								}

								if (!execResult.success) {
									throw new Error(`Script ${script.filename} failed: ${execResult.stderr}`);
								}
							}

							// Execute main script
							let mainResult;
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

							const executionResults = {
								results,
								finalOutput,
								summary: "Task completed successfully",
								nextSteps: [],
							};

							state.executionResults = executionResults;
							state.status = "complete";

							await publish(
								taskExecutionChannel(chatId).messages({
									id: crypto.randomUUID(),
									message: `✅ Task completed successfully!\n\nFinal output:\n\`\`\`\n${finalOutput}\n\`\`\``,
									role: "assistant",
								}),
							);

							return { success: true, data: executionResults };
						} catch (error) {
							await publish(
								taskExecutionChannel(chatId).messages({
									id: crypto.randomUUID(),
									message: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
									role: "assistant",
								}),
							);
							return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
						}
					},
				}),
			],
		});

		// Create the task network
		const taskNetwork = createNetwork<TaskNetworkState>({
			name: "Universal Task Network",
			description: "A general-purpose computational task execution system",
			agents: [taskAnalyzerAgent, environmentSetupAgent, scriptGeneratorAgent, executionAgent],

			defaultState: createState<TaskNetworkState>({
				chatId,
				status: "analyzing" as const,
				taskDescription,
			}),

			defaultModel: anthropic({
				model: "claude-3-5-sonnet-20241022",
				defaultParameters: {
					max_tokens: 4096,
				},
				apiKey: env.ANTHROPIC_API_KEY,
			}),

			router: async ({ network }) => {
				const state = network.state.data;
				console.log("Router state:", JSON.stringify(state, null, 2));

				switch (state.status) {
					case "analyzing":
						return taskAnalyzerAgent;
					case "environment-setup":
						return environmentSetupAgent;
					case "generating-scripts":
						return scriptGeneratorAgent;
					case "executing":
						return executionAgent;
					case "complete":
					case "error":
						return undefined;
					default:
						console.log("Router defaulting to taskAnalyzerAgent for status:", state.status);
						return taskAnalyzerAgent;
				}
			},

			maxIter: 15,
		});

		// Run the task network
		let result: {
			success: boolean;
			chatId: string;
			results?: TaskNetworkState["executionResults"];
			analysis?: TaskNetworkState["analysis"];
			scripts?: TaskNetworkState["scripts"];
		};
		try {
			const networkResult = await taskNetwork.run(taskDescription);

			const finalState = networkResult.state.data as TaskNetworkState;

			if (finalState?.status === "complete" && finalState.executionResults) {
				result = {
					success: true,
					chatId,
					results: finalState.executionResults,
					analysis: finalState.analysis,
					scripts: finalState.scripts,
				};
			} else if (finalState?.status === "error") {
				throw new Error(finalState.error || "Task execution failed");
			} else {
				throw new Error("Task did not complete successfully");
			}
		} catch (error) {
			console.error("Task execution error:", error);
			throw error;
		}

		// Publish completion status
		await publish(
			taskExecutionChannel(chatId).status({
				status: "completed",
				message: "Task execution completed",
			}),
		);

		// Clean up the shared sandbox
		await sharedSandbox.cleanup();

		return result;
	},
);
