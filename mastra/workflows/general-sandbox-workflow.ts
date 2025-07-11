import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { commandPlanner } from "../agents/command-planner";
import { planner } from "../agents/planner";
import { sandboxExecutor } from "../agents/sandbox-executor";
import { searcher } from "../agents/searcher";
import { analyzeTaskTool } from "../tools/analyze-task-tool";

// Create a task orchestrator agent
const taskOrchestrator = new Agent({
	name: "Task Orchestrator",
	description: "Orchestrates complex tasks by coordinating planning, research, and execution",
	instructions: `You are a master task orchestrator. Your role is to:
1. Understand the user's task deeply
2. Coordinate between planning, research, and execution
3. Synthesize results into clear, actionable outputs
4. Handle any type of computational task intelligently

Always provide clear, structured responses that explain what was done and what the results mean.`,
	model: anthropic("claude-4-sonnet-20250514"),
	tools: {
		analyze_task: analyzeTaskTool,
	},
});

// Step 1: Analyze the task
const analyzeTaskStep = createStep({
	id: "analyze-task",
	description: "Analyze the task to determine approach",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
	}),
	outputSchema: z.object({
		taskType: z.string(),
		requiresSearch: z.boolean(),
		requiresSandbox: z.boolean(),
		suggestedApproach: z.string(),
		estimatedComplexity: z.string(),
		keyRequirements: z.array(z.string()),
	}),
	execute: async ({ inputData }) => {
		const prompt = `Analyze this task and determine the best approach:

Task: ${inputData.task}
${inputData.context ? `Context: ${inputData.context}` : ""}

Think deeply about:
1. What category best describes this task? (e.g., data processing, web development, media processing, system administration, security analysis, machine learning, file transformation, code generation, research, or general computation)
2. Would searching the web for information, best practices, or examples be helpful?
3. Would executing code or commands in a sandbox environment be beneficial?
4. How complex is this task? (simple, moderate, or complex)
5. What key tools, libraries, or capabilities might be required?

Provide a thoughtful analysis that will guide the execution strategy.`;

		const response = await taskOrchestrator.generate(prompt, {
			output: z.object({
				taskType: z.string().describe("The general category of the task"),
				requiresSearch: z.boolean().describe("Whether web search would be helpful"),
				requiresSandbox: z.boolean().describe("Whether sandbox execution is needed"),
				suggestedApproach: z.string().describe("High-level approach to tackle the task"),
				estimatedComplexity: z.string().describe("Task complexity: simple, moderate, or complex"),
				keyRequirements: z.array(z.string()).describe("Key requirements or tools needed"),
			}),
		});

		return response.object;
	},
});

// Step 2: Create execution plan
const createPlanStep = createStep({
	id: "create-plan",
	description: "Create detailed execution plan",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		taskAnalysis: z.object({
			taskType: z.string(),
			requiresSearch: z.boolean(),
			requiresSandbox: z.boolean(),
			suggestedApproach: z.string(),
			estimatedComplexity: z.string(),
			keyRequirements: z.array(z.string()),
		}),
	}),
	outputSchema: z.object({
		plan: z.object({
			overview: z.string(),
			steps: z.array(
				z.object({
					id: z.string(),
					action: z.string(),
					description: z.string(),
				}),
			),
			requirements: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const { task, context, taskAnalysis } = inputData;

		const planPrompt = `Create a detailed execution plan for this task:
Task: ${task}
${context ? `Context: ${context}` : ""}

Task Analysis:
- Type: ${taskAnalysis.taskType}
- Complexity: ${taskAnalysis.estimatedComplexity}
- Requires Search: ${taskAnalysis.requiresSearch}
- Requires Sandbox: ${taskAnalysis.requiresSandbox}
- Key Requirements: ${taskAnalysis.keyRequirements.join(", ")}

Suggested Approach: ${taskAnalysis.suggestedApproach}

Create a comprehensive plan with clear, actionable steps.`;

		const response = await planner.generate(planPrompt, {
			output: z.object({
				plan: z.object({
					overview: z.string(),
					steps: z.array(
						z.object({
							id: z.string(),
							action: z.string(),
							description: z.string(),
						}),
					),
					requirements: z.array(z.string()),
				}),
			}),
		});

		return { plan: response.object.plan };
	},
});

// Define plan schema for reuse
const planSchema = z.object({
	overview: z.string(),
	steps: z.array(
		z.object({
			id: z.string(),
			action: z.string(),
			description: z.string(),
		}),
	),
	requirements: z.array(z.string()),
});

// Step 3: Conditional research step
const researchStep = createStep({
	id: "research",
	description: "Research information if needed",
	inputSchema: z.object({
		task: z.string(),
		plan: planSchema,
		requiresSearch: z.boolean(),
	}),
	outputSchema: z.object({
		research: z
			.object({
				summary: z.string(),
				keyFindings: z.array(z.string()),
				resources: z.array(z.string()),
			})
			.optional(),
	}),
	execute: async ({ inputData }) => {
		if (!inputData.requiresSearch) {
			return { research: undefined };
		}

		const searchPrompt = `Research information for this task:
${inputData.task}

Focus on:
- Best practices and current approaches
- Relevant tools and technologies
- Examples and patterns
- Common pitfalls to avoid`;

		const response = await searcher.generate(searchPrompt, {
			output: z.object({
				research: z.object({
					summary: z.string(),
					keyFindings: z.array(z.string()),
					resources: z.array(z.string()),
				}),
			}),
		});

		return { research: response.object.research };
	},
});

// Define research schema
const researchSchema = z.object({
	summary: z.string(),
	keyFindings: z.array(z.string()),
	resources: z.array(z.string()),
});

// Step 4: Execute in sandbox
const executeStep = createStep({
	id: "execute",
	description: "Execute the plan in sandbox",
	inputSchema: z.object({
		task: z.string(),
		plan: planSchema,
		research: researchSchema.optional(),
		requiresSandbox: z.boolean(),
	}),
	outputSchema: z.object({
		execution: z
			.object({
				success: z.boolean(),
				output: z.string(),
				details: z.object({
					commandsExecuted: z.number(),
					filesCreated: z.array(z.string()),
					errors: z.array(z.string()),
				}),
			})
			.optional(),
	}),
	execute: async ({ inputData }) => {
		if (!inputData.requiresSandbox) {
			return { execution: undefined };
		}

		// First, plan the commands
		const commandPrompt = `Based on this task and plan, determine the Linux commands needed:
Task: ${inputData.task}

Plan Overview: ${inputData.plan.overview}
Steps: ${inputData.plan.steps.map((s) => `${s.id}: ${s.action}`).join("\n")}

${inputData.research ? `Research findings: ${inputData.research.summary}` : ""}

Provide the specific commands to execute this task.`;

		const commandPlan = await commandPlanner.generate(commandPrompt, {
			output: z.object({
				plan: z.object({
					commands: z.array(
						z.object({
							command: z.string(),
							args: z.array(z.string()),
							description: z.string(),
							expectedOutput: z.string(),
						}),
					),
					explanation: z.string(),
				}),
			}),
		});

		// Execute the commands
		const executionPrompt = `Execute these commands in the sandbox:
${commandPlan.object.plan.commands
	.map((cmd) => `- ${cmd.description}: ${cmd.command} ${cmd.args.join(" ")}`)
	.join("\n")}

Use the execute_command tool for each command and report the results.`;

		const executionResponse = await sandboxExecutor.generate(executionPrompt);

		// Parse execution results
		const successIndicators = ["success", "completed", "created", "generated", "finished"];
		const success = successIndicators.some((ind) => executionResponse.text.toLowerCase().includes(ind));

		// Extract created files
		const filesCreated: string[] = [];
		const fileMatches = executionResponse.text.matchAll(/created?:?\s*([\w\-./]+)/gi);
		for (const match of fileMatches) {
			filesCreated.push(match[1]);
		}

		// Extract errors
		const errors: string[] = [];
		const errorMatches = executionResponse.text.matchAll(/error:?\s*([^\n]+)/gi);
		for (const match of errorMatches) {
			errors.push(match[1]);
		}

		return {
			execution: {
				success,
				output: executionResponse.text,
				details: {
					commandsExecuted: commandPlan.object.plan.commands.length,
					filesCreated,
					errors,
				},
			},
		};
	},
});

// Define execution schema
const executionSchema = z.object({
	success: z.boolean(),
	output: z.string(),
	details: z.object({
		commandsExecuted: z.number(),
		filesCreated: z.array(z.string()),
		errors: z.array(z.string()),
	}),
});

// Define task analysis schema
const taskAnalysisSchema = z.object({
	taskType: z.string(),
	requiresSearch: z.boolean(),
	requiresSandbox: z.boolean(),
	suggestedApproach: z.string(),
	estimatedComplexity: z.string(),
	keyRequirements: z.array(z.string()),
});

// Step 5: Synthesize results
const synthesizeResultsStep = createStep({
	id: "synthesize",
	description: "Synthesize all results into final output",
	inputSchema: z.object({
		task: z.string(),
		taskAnalysis: taskAnalysisSchema,
		plan: planSchema,
		research: researchSchema.optional(),
		execution: executionSchema.optional(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		summary: z.string(),
		results: z.object({
			taskType: z.string(),
			complexity: z.string(),
			approach: z.string(),
			outcome: z.string(),
			keyDeliverables: z.array(z.string()),
			nextSteps: z.array(z.string()).optional(),
		}),
		fullReport: z.string(),
	}),
	execute: async ({ inputData }) => {
		const { task, taskAnalysis, plan, research, execution } = inputData;

		const synthesisPrompt = `Synthesize the results of this task execution:

Task: ${task}
Type: ${taskAnalysis.taskType}
Complexity: ${taskAnalysis.estimatedComplexity}

Plan: ${plan.overview}

${research ? `Research Summary: ${research.summary}` : "No research was conducted."}

${
	execution
		? `Execution Results:
- Success: ${execution.success}
- Commands Executed: ${execution.details.commandsExecuted}
- Files Created: ${execution.details.filesCreated.join(", ") || "None"}
- Errors: ${execution.details.errors.join(", ") || "None"}

Output: ${execution.output.substring(0, 500)}...`
		: "No sandbox execution was performed."
}

Create a comprehensive summary of what was accomplished, the results achieved, and any recommendations for next steps.`;

		const response = await taskOrchestrator.generate(synthesisPrompt);

		// Determine overall success
		const success = execution ? execution.success : true;

		// Extract key deliverables
		const keyDeliverables: string[] = [];
		if (execution && execution.details.filesCreated.length > 0) {
			keyDeliverables.push(...execution.details.filesCreated.map((f: string) => `File: ${f}`));
		}
		if (research) {
			keyDeliverables.push("Research findings and recommendations");
		}
		if (plan) {
			keyDeliverables.push("Detailed execution plan");
		}

		// Create structured results
		const results = {
			taskType: taskAnalysis.taskType,
			complexity: taskAnalysis.estimatedComplexity,
			approach: taskAnalysis.suggestedApproach,
			outcome: success ? "Successfully completed" : "Completed with issues",
			keyDeliverables,
			nextSteps: research?.keyFindings.slice(0, 3),
		};

		// Create summary
		const summary = `Task "${task}" (${taskAnalysis.taskType}) has been ${success ? "successfully completed" : "processed with some issues"}. 
${execution ? `Executed ${execution.details.commandsExecuted} commands in the sandbox.` : ""}
${research ? "Research was conducted to inform the approach." : ""}
${keyDeliverables.length} key deliverables were produced.`;

		return {
			success,
			summary,
			results,
			fullReport: response.text,
		};
	},
});

// Main workflow
export const generalSandboxWorkflow = createWorkflow({
	id: "general-sandbox-workflow",
	description: "Flexible workflow that can handle any computational task with planning, research, and execution",
	inputSchema: z.object({
		task: z.string().describe("The task to accomplish"),
		context: z.string().optional().describe("Additional context or requirements"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		summary: z.string(),
		results: z.object({
			taskType: z.string(),
			complexity: z.string(),
			approach: z.string(),
			outcome: z.string(),
			keyDeliverables: z.array(z.string()),
			nextSteps: z.array(z.string()).optional(),
		}),
		fullReport: z.string(),
	}),
})
	.then(analyzeTaskStep)
	.then(
		createStep({
			id: "prepare-planning",
			description: "Prepare data for planning",
			inputSchema: z.object({
				taskType: z.string(),
				requiresSearch: z.boolean(),
				requiresSandbox: z.boolean(),
				suggestedApproach: z.string(),
				estimatedComplexity: z.string(),
				keyRequirements: z.array(z.string()),
			}),
			outputSchema: z.object({
				task: z.string(),
				context: z.string().optional(),
				taskAnalysis: z.object({
					taskType: z.string(),
					requiresSearch: z.boolean(),
					requiresSandbox: z.boolean(),
					suggestedApproach: z.string(),
					estimatedComplexity: z.string(),
					keyRequirements: z.array(z.string()),
				}),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					task: initData.task,
					context: initData.context,
					taskAnalysis: inputData,
				};
			},
		}),
	)
	.then(createPlanStep)
	.then(
		createStep({
			id: "prepare-research",
			description: "Prepare data for research step",
			inputSchema: z.object({
				plan: planSchema,
			}),
			outputSchema: z.object({
				task: z.string(),
				plan: planSchema,
				requiresSearch: z.boolean(),
			}),
			execute: async ({ inputData, getInitData, getStepResult }) => {
				const initData = getInitData();
				const analysisResult = getStepResult(analyzeTaskStep) as { requiresSearch: boolean };
				return {
					task: initData.task,
					plan: inputData.plan,
					requiresSearch: analysisResult.requiresSearch,
				};
			},
		}),
	)
	.then(researchStep)
	.then(
		createStep({
			id: "prepare-execution",
			description: "Prepare data for execution step",
			inputSchema: z.object({
				research: researchSchema.optional(),
			}),
			outputSchema: z.object({
				task: z.string(),
				plan: planSchema,
				research: researchSchema.optional(),
				requiresSandbox: z.boolean(),
			}),
			execute: async ({ inputData, getInitData, getStepResult }) => {
				const initData = getInitData();
				const planResult = getStepResult(createPlanStep) as { plan: z.infer<typeof planSchema> };
				const analysisResult = getStepResult(analyzeTaskStep) as { requiresSandbox: boolean };
				return {
					task: initData.task,
					plan: planResult.plan,
					research: inputData.research,
					requiresSandbox: analysisResult.requiresSandbox,
				};
			},
		}),
	)
	.then(executeStep)
	.then(
		createStep({
			id: "prepare-synthesis",
			description: "Prepare all data for final synthesis",
			inputSchema: z.object({
				execution: executionSchema.optional(),
			}),
			outputSchema: z.object({
				task: z.string(),
				taskAnalysis: taskAnalysisSchema,
				plan: planSchema,
				research: researchSchema.optional(),
				execution: executionSchema.optional(),
			}),
			execute: async ({ inputData, getInitData, getStepResult }) => {
				const initData = getInitData();
				const analysisResult = getStepResult(analyzeTaskStep) as z.infer<typeof taskAnalysisSchema>;
				const planResult = getStepResult(createPlanStep) as { plan: z.infer<typeof planSchema> };
				const researchResult = getStepResult(researchStep) as { research?: z.infer<typeof researchSchema> };

				return {
					task: initData.task,
					taskAnalysis: analysisResult,
					plan: planResult.plan,
					research: researchResult.research,
					execution: inputData.execution,
				};
			},
		}),
	)
	.then(synthesizeResultsStep)
	.commit();
