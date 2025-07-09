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
			system: `Analyze computational tasks and create detailed execution plans. When given a task, use the analyze_task tool to process it.`,

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
Provide:
1. Task type (computation/data-processing/api-integration/file-operation/analysis/other)
2. Complexity (simple/moderate/complex)
3. Dependencies needed
4. Step-by-step execution plan
5. Estimated duration
6. Risk factors`,
							schema: z.object({
								taskType: z.enum([
									"computation",
									"data-processing",
									"api-integration",
									"file-operation",
									"analysis",
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
			system: `Configure execution environments for computational tasks. When the task analysis is complete, use the setup_environment tool to configure the environment.

Vercel Sandbox Specifications:
- Base system: Amazon Linux 2023
- Available runtimes: node22 (/vercel/runtimes/node22) with npm/pnpm, python3.13 (/vercel/runtimes/python) with pip/uv
- Default working directory: /vercel/sandbox
- User: vercel-sandbox (with sudo access)
- Pre-installed packages: bind-utils bzip2 findutils git gzip iputils libicu libjpeg libpng ncurses-libs openssl openssl-libs procps tar unzip which whois zstd
- Additional packages can be installed using 'dnf install -y <package>' with sudo
- Sudo behavior: HOME set to /root, PATH unchanged, environment variables inherited`,

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

Create:
1. Minimal package.json
2. Setup script
3. Environment variables
4. System requirements`,
							schema: z.object({
								packageJson: z.object({
									dependencies: z.record(z.string()),
									devDependencies: z.record(z.string()).optional(),
								}),
								setupScript: z.string(),
								environmentVariables: z.record(z.string()).optional(),
								systemRequirements: z.array(z.string()).optional(),
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
			system: `Create executable JavaScript/Node.js scripts. When the environment is set up, use the generate_scripts tool to create the necessary scripts.

Vercel Sandbox Specifications:
- Base system: Amazon Linux 2023
- Available runtimes: node22 (/vercel/runtimes/node22) with npm/pnpm, python3.13 (/vercel/runtimes/python) with pip/uv
- Default working directory: /vercel/sandbox
- User: vercel-sandbox (with sudo access)
- Pre-installed packages: bind-utils bzip2 findutils git gzip iputils libicu libjpeg libpng ncurses-libs openssl openssl-libs procps tar unzip which whois zstd
- Additional packages can be installed using 'dnf install -y <package>' with sudo
- Sudo behavior: HOME set to /root, PATH unchanged, environment variables inherited

Important: Scripts should be aware they're running in /vercel/sandbox with node22 available by default.`,

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

Create:
1. Individual scripts for each step
2. Main orchestration script
3. Error handling
4. Structured output`,
							schema: z.object({
								scripts: z.array(
									z.object({
										name: z.string(),
										description: z.string(),
										code: z.string(),
										dependencies: z.array(z.string()),
										order: z.number(),
										retryable: z.boolean(),
									}),
								),
								mainScript: z.string(),
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
			system: `Execute scripts safely and collect results. When scripts are generated, use the execute_scripts tool to run them.

Vercel Sandbox Specifications:
- Base system: Amazon Linux 2023
- Available runtimes: node22 (/vercel/runtimes/node22) with npm/pnpm, python3.13 (/vercel/runtimes/python) with pip/uv
- Default working directory: /vercel/sandbox
- User: vercel-sandbox (with sudo access)
- Pre-installed packages: bind-utils bzip2 findutils git gzip iputils libicu libjpeg libpng ncurses-libs openssl openssl-libs procps tar unzip which whois zstd
- Additional packages can be installed using 'dnf install -y <package>' with sudo
- Sudo behavior: HOME set to /root, PATH unchanged, environment variables inherited

Scripts execute in /vercel/sandbox with access to node22 and python3.13.`,

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

						const executor = new SandboxExecutor();
						const results: any[] = [];
						let finalOutput: any = null;

						try {
							// Setup environment
							const setupResult = await executor.setupEnvironment(environment.packageJson, environment.setupScript);

							if (!setupResult.success) {
								throw new Error(`Environment setup failed: ${setupResult.error}`);
							}

							// Execute scripts
							for (const script of scripts.scripts.sort((a: any, b: any) => a.order - b.order)) {
								await publish(
									taskExecutionChannel(chatId).messages({
										id: crypto.randomUUID(),
										message: `⚙️ Running: ${script.name}`,
										role: "assistant",
									}),
								);

								const execResult = await executor.executeScript(`${script.name}.js`, script.code);

								results.push({
									scriptName: script.name,
									success: execResult.success,
									output: execResult.output,
									error: execResult.error,
									duration: execResult.duration,
									retryCount: 0,
								});

								if (execResult.output) {
									await publish(
										taskExecutionChannel(chatId).messages({
											id: crypto.randomUUID(),
											message: `📤 Output from ${script.name}:\n\`\`\`\n${execResult.output}\n\`\`\``,
											role: "assistant",
										}),
									);
								}

								if (!execResult.success && !script.retryable) {
									throw new Error(`Script ${script.name} failed: ${execResult.error}`);
								}
							}

							// Execute main script
							const mainResult = await executor.executeScript("main.js", scripts.mainScript);
							finalOutput = mainResult.output;

							await executor.cleanup();

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
							await executor.cleanup();
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

		return result;
	},
);
