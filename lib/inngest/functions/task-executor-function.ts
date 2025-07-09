import { anthropic as anthropicProvider } from "@ai-sdk/anthropic";
import { anthropic, createAgent, createNetwork, createState, createTool } from "@inngest/agent-kit";
import { generateObject } from "ai";
import { z } from "zod";
import type { TaskNetworkState } from "@/lib/agent-kit/types/task-network-types";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";
import { inngest } from "../client";
import { wrapWithSSE } from "../helpers/sse-wrapper";
import { taskExecutionChannel } from "../realtime";

export const taskExecutorFunction = inngest.createFunction(
	{
		id: "task-executor",
		name: "Universal Task Executor",
	},
	{ event: "task/execute" },
	async ({ event, step, publish }) => {
		const { taskDescription, chatId, constraints } = event.data;
		const wrappedStep = wrapWithSSE(step, { chatId });

		// Store the step context to use in agents
		const inngestStep = step;

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
			system: `Analyze computational tasks and create detailed execution plans.`,

			tools: [
				createTool({
					name: "analyze_task",
					description: "Analyze a computational task",
					parameters: z.object({
						taskDescription: z.string(),
					}),
					handler: async (params, { network }) => {
						await publish(
							taskExecutionChannel(chatId).messages({
								id: crypto.randomUUID(),
								message: "🔍 Analyzing your task requirements...",
								role: "assistant",
							}),
						);

						const state = network.state.data;
						state.taskDescription = params.taskDescription;

						// Use step.run to handle AI inference with structured output
						const _result = await inngestStep.run("analyze-task", async () => {
							return await generateObject({
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
			system: `Configure execution environments for computational tasks.`,

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

						// Use step.run to handle AI inference with structured output
						const result = await inngestStep.run("setup-environment", async () => {
							return await generateObject({
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
			system: `Create executable JavaScript/Node.js scripts.`,

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

						// Use step.run to handle AI inference with structured output
						const result = await inngestStep.run("generate-scripts", async () => {
							return await generateObject({
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
			system: `Execute scripts safely and collect results.`,

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
			}),

			defaultModel: anthropic({
				model: "claude-3-5-sonnet-20241022",
				defaultParameters: {
					max_tokens: 4096,
				},
			}),

			router: async ({ network }) => {
				const state = network.state.data;

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
						return taskAnalyzerAgent;
				}
			},

			maxIter: 15,
		});

		// Run the task network
		const result = await wrappedStep.run("execute-task-network", async () => {
			try {
				const networkResult = await taskNetwork.run(taskDescription, {
					state: {
						chatId,
						status: "analyzing" as const,
						taskDescription,
					} as TaskNetworkState,
				});

				const finalState = networkResult.state.data as TaskNetworkState;

				if (finalState?.status === "complete" && finalState.executionResults) {
					return {
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
		});

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
