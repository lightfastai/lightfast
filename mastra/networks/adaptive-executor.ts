import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { browserAgent } from "../agents/browser";
import { planner } from "../agents/planner";
import { sandboxAgent } from "../agents/sandbox";
import { searcher } from "../agents/searcher";

// Thread agent management - removed as agents handle their own memory
// The agents themselves have thread-scoped memory configured

// Shared context schema for all agents to access
const sharedContextSchema = z.object({
	taskDescription: z.string(),
	requiredCapabilities: z.array(z.enum(["planning", "research", "code", "browser"])),
	executionHistory: z.array(
		z.object({
			agent: z.string(),
			action: z.string(),
			result: z.string(),
			timestamp: z.string(),
		}),
	),
	aggregatedResults: z.record(z.string(), z.unknown()),
	currentPhase: z.enum(["analysis", "planning", "execution", "synthesis"]),
	threadId: z.string(),
});

// Task analyzer agent that understands requirements
const taskAnalyzer = new Agent({
	name: "Task Analyzer",
	description: "Analyzes tasks to determine required capabilities and execution strategy",
	instructions: `You are a task analysis expert. Your role is to:

1. **Understand the Request**: Analyze what the user wants to accomplish
2. **Identify Capabilities**: Determine which capabilities are needed:
   - planning: For complex tasks needing strategic decomposition
   - research: For tasks requiring information gathering
   - code: For programming, scripting, or computational tasks
   - browser: For web interaction, scraping, or automation
3. **Suggest Execution Order**: Recommend the best sequence of operations
4. **Identify Dependencies**: Note which steps depend on others

Output your analysis as JSON:
{
  "taskSummary": "Brief summary of the task",
  "requiredCapabilities": ["planning", "research", "code", "browser"],
  "suggestedOrder": ["research", "planning", "code"],
  "complexity": "simple|moderate|complex",
  "dependencies": ["step X needs output from step Y"]
}`,
	model: anthropic("claude-4-sonnet-20250514"),
});

// Result synthesizer that combines outputs from multiple agents
const resultSynthesizer = new Agent({
	name: "Result Synthesizer",
	description: "Combines and formats results from multiple agents into coherent output",
	instructions: `You are a result synthesis expert. Your role is to:

1. **Aggregate Results**: Combine outputs from different agents
2. **Remove Redundancy**: Eliminate duplicate information
3. **Create Coherent Output**: Format results in a clear, user-friendly way
4. **Highlight Key Findings**: Emphasize the most important results
5. **Provide Summary**: Create an executive summary when appropriate

Consider the execution history and create a comprehensive response that addresses the original task.`,
	model: anthropic("claude-4-sonnet-20250514"),
});

// Dynamic task analysis step
const analyzeTaskStep = createStep({
	id: "analyze-task",
	description: "Analyze task to determine required capabilities",
	inputSchema: z.object({
		task: z.string().describe("The task to analyze"),
		context: z.string().optional().describe("Additional context"),
		threadId: z.string().describe("Thread ID for maintaining context"),
	}),
	outputSchema: z.object({
		analysis: z.object({
			taskSummary: z.string(),
			requiredCapabilities: z.array(z.enum(["planning", "research", "code", "browser"])),
			suggestedOrder: z.array(z.enum(["planning", "research", "code", "browser"])),
			complexity: z.enum(["simple", "moderate", "complex"]),
			dependencies: z.array(z.string()),
		}),
		sharedContext: sharedContextSchema,
	}),
	execute: async ({ inputData }) => {
		const prompt = `Analyze this task: ${inputData.task}
${inputData.context ? `\nContext: ${inputData.context}` : ""}

Determine what capabilities are needed and suggest an execution strategy.`;

		const response = await taskAnalyzer.generate(prompt, {
			output: z.object({
				analysis: z.object({
					taskSummary: z.string(),
					requiredCapabilities: z.array(z.enum(["planning", "research", "code", "browser"])),
					suggestedOrder: z.array(z.enum(["planning", "research", "code", "browser"])),
					complexity: z.enum(["simple", "moderate", "complex"]),
					dependencies: z.array(z.string()),
				}),
			}),
		});

		const sharedContext = {
			taskDescription: inputData.task,
			requiredCapabilities: response.object.analysis.requiredCapabilities,
			executionHistory: [],
			aggregatedResults: {},
			currentPhase: "analysis" as const,
			threadId: inputData.threadId,
		};

		return {
			analysis: response.object.analysis,
			sharedContext,
		};
	},
});

// Main adaptive workflow
const adaptiveWorkflow = createWorkflow({
	id: "adaptive-workflow",
	description: "Adaptive workflow that routes tasks dynamically",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		threadId: z.string().describe("Thread ID for maintaining context"),
	}),
	outputSchema: z.object({
		finalResult: z.string(),
		summary: z.string(),
	}),
})
	.then(analyzeTaskStep)
	.then(
		createStep({
			id: "route-execution",
			description: "Route to appropriate execution path",
			inputSchema: z.object({
				analysis: z.object({
					taskSummary: z.string(),
					requiredCapabilities: z.array(z.enum(["planning", "research", "code", "browser"])),
					suggestedOrder: z.array(z.enum(["planning", "research", "code", "browser"])),
					complexity: z.enum(["simple", "moderate", "complex"]),
					dependencies: z.array(z.string()),
				}),
				sharedContext: sharedContextSchema,
			}),
			outputSchema: z.object({
				executionPath: z.enum(["simple", "complex"]),
				task: z.string(),
				analysis: z.object({
					taskSummary: z.string(),
					requiredCapabilities: z.array(z.enum(["planning", "research", "code", "browser"])),
					suggestedOrder: z.array(z.enum(["planning", "research", "code", "browser"])),
					complexity: z.enum(["simple", "moderate", "complex"]),
					dependencies: z.array(z.string()),
				}),
				sharedContext: sharedContextSchema,
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				const isSimple = 
					inputData.analysis.complexity === "simple" && 
					inputData.analysis.requiredCapabilities.length === 1;

				return {
					executionPath: (isSimple ? "simple" : "complex") as "simple" | "complex",
					task: initData.task,
					analysis: inputData.analysis,
					sharedContext: inputData.sharedContext,
				};
			},
		}),
	)
	.then(
		createStep({
			id: "conditional-execution",
			description: "Execute based on complexity",
			inputSchema: z.object({
				executionPath: z.enum(["simple", "complex"]),
				task: z.string(),
				analysis: z.object({
					taskSummary: z.string(),
					requiredCapabilities: z.array(z.enum(["planning", "research", "code", "browser"])),
					suggestedOrder: z.array(z.enum(["planning", "research", "code", "browser"])),
					complexity: z.enum(["simple", "moderate", "complex"]),
					dependencies: z.array(z.string()),
				}),
				sharedContext: sharedContextSchema,
			}),
			outputSchema: z.object({
				finalResult: z.string(),
				summary: z.string(),
			}),
			execute: async ({ inputData }) => {
				const threadId = inputData.sharedContext.threadId;

				if (inputData.executionPath === "simple") {
					// Simple path - single agent execution
					let response: { text: string };
					const capability = inputData.analysis.requiredCapabilities[0];
					
					switch (capability) {
						case "planning":
							response = await planner.generate(inputData.task, { 
								resourceId: threadId,
								threadId 
							});
							break;
						case "research":
							response = await searcher.generate(inputData.task, { 
								maxSteps: 5,
								resourceId: threadId,
								threadId 
							});
							break;
						case "code":
							response = await sandboxAgent.generate(inputData.task, { 
								maxSteps: 10,
								resourceId: threadId,
								threadId 
							});
							break;
						case "browser":
							response = await browserAgent.generate(inputData.task, { 
								maxSteps: 8,
								resourceId: threadId,
								threadId 
							});
							break;
					}
					
					return {
						finalResult: response.text,
						summary: `Task completed using ${capability} agent.`,
					};
				} else {
					// Complex path - multi-agent execution
					const results: Record<string, unknown> = {};
					const executionHistory = [...inputData.sharedContext.executionHistory];

					// Execute based on suggested order
					for (const capability of inputData.analysis.suggestedOrder) {
						const timestamp = new Date().toISOString();
						
						try {
							switch (capability) {
								case "planning": {
									const planPrompt = `Task: ${inputData.task}
Summary: ${inputData.analysis.taskSummary}
${executionHistory.length > 0 ? `\nPrevious steps:\n${executionHistory.map(h => `- ${h.agent}: ${h.action}`).join("\n")}` : ""}

Create a detailed execution plan.`;
									const planResponse = await planner.generate(planPrompt, { 
										resourceId: threadId,
										threadId 
									});
									results.planning = planResponse.text;
									executionHistory.push({
										agent: "planner",
										action: "Created execution plan",
										result: "Plan created successfully",
										timestamp,
									});
									break;
								}
								case "research": {
									const researchPrompt = `Research task: ${inputData.task}
${results.planning ? `\nPlan:\n${results.planning}` : ""}

Conduct thorough research and provide findings.`;
									const researchResponse = await searcher.generate(researchPrompt, { 
										maxSteps: 8,
										resourceId: threadId,
										threadId 
									});
									results.research = researchResponse.text;
									executionHistory.push({
										agent: "searcher",
										action: "Conducted web research",
										result: "Research completed",
										timestamp,
									});
									break;
								}
								case "code": {
									const codePrompt = `Task: ${inputData.task}
${results.planning ? `\nPlan:\n${results.planning}` : ""}
${results.research ? `\nResearch findings:\n${results.research}` : ""}

Execute this task programmatically.`;
									const codeResponse = await sandboxAgent.generate(codePrompt, { 
										maxSteps: 15,
										resourceId: threadId,
										threadId 
									});
									results.code = codeResponse.text;
									executionHistory.push({
										agent: "sandbox",
										action: "Executed code",
										result: "Code execution completed",
										timestamp,
									});
									break;
								}
								case "browser": {
									const browserPrompt = `Task: ${inputData.task}
${results.planning ? `\nPlan:\n${results.planning}` : ""}
${results.research ? `\nResearch:\n${results.research}` : ""}

Perform necessary browser automation.`;
									const browserResponse = await browserAgent.generate(browserPrompt, { 
										maxSteps: 10,
										resourceId: threadId,
										threadId 
									});
									results.browser = browserResponse.text;
									executionHistory.push({
										agent: "browser",
										action: "Performed browser automation",
										result: "Browser tasks completed",
										timestamp,
									});
									break;
								}
							}
						} catch (error) {
							executionHistory.push({
								agent: capability,
								action: `Attempted ${capability} execution`,
								result: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
								timestamp,
							});
						}
					}

					// Synthesize results
					const prompt = `Original task: ${inputData.task}

Execution history:
${executionHistory.map(h => `- ${h.agent} (${h.timestamp}): ${h.action} - ${h.result}`).join("\n")}

Results from agents:
${Object.entries(results)
	.map(([agent, result]) => `\n### ${agent.toUpperCase()} Results:\n${result}`)
	.join("\n\n")}

Please synthesize these results into a comprehensive response that addresses the original task.
Create both a detailed result and a brief summary.`;

					const response = await resultSynthesizer.generate(prompt, {
						output: z.object({
							finalResult: z.string(),
							summary: z.string(),
						}),
					});

					return response.object;
				}
			},
		}),
	)
	.commit();

// Quick task workflow for very simple requests
const quickTaskWorkflow = createWorkflow({
	id: "quick-task",
	description: "Direct execution for very simple tasks",
	inputSchema: z.object({
		task: z.string(),
		threadId: z.string().describe("Thread ID for maintaining context"),
	}),
	outputSchema: z.object({
		result: z.string(),
	}),
})
	.then(
		createStep({
			id: "quick-analysis",
			description: "Quick capability detection",
			inputSchema: z.object({
				task: z.string(),
				threadId: z.string(),
			}),
			outputSchema: z.object({
				capability: z.enum(["planning", "research", "code", "browser", "unknown"]),
				threadId: z.string(),
			}),
			execute: async ({ inputData }) => {
				const taskLower = inputData.task.toLowerCase();
				
				if (taskLower.includes("plan") || taskLower.includes("strategy") || taskLower.includes("steps")) {
					return { capability: "planning" as const, threadId: inputData.threadId };
				} else if (taskLower.includes("search") || taskLower.includes("find") || taskLower.includes("research")) {
					return { capability: "research" as const, threadId: inputData.threadId };
				} else if (taskLower.includes("code") || taskLower.includes("script") || taskLower.includes("program")) {
					return { capability: "code" as const, threadId: inputData.threadId };
				} else if (taskLower.includes("browse") || taskLower.includes("web") || taskLower.includes("click")) {
					return { capability: "browser" as const, threadId: inputData.threadId };
				}
				
				return { capability: "unknown" as const, threadId: inputData.threadId };
			},
		}),
	)
	.then(
		createStep({
			id: "quick-execution",
			description: "Execute quick task",
			inputSchema: z.object({
				capability: z.enum(["planning", "research", "code", "browser", "unknown"]),
				threadId: z.string(),
			}),
			outputSchema: z.object({
				result: z.string(),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				if (inputData.capability === "unknown") {
					// Fall back to research agent for general questions
					const response = await searcher.generate(initData.task, { 
						maxSteps: 3, 
						resourceId: inputData.threadId,
						threadId: inputData.threadId 
					});
					return { result: response.text };
				}
				
				let response: { text: string };
				
				switch (inputData.capability) {
					case "planning":
						response = await planner.generate(initData.task, { 
							resourceId: inputData.threadId,
							threadId: inputData.threadId 
						});
						break;
					case "research":
						response = await searcher.generate(initData.task, { 
							maxSteps: 5, 
							resourceId: inputData.threadId,
							threadId: inputData.threadId 
						});
						break;
					case "code":
						response = await sandboxAgent.generate(initData.task, { 
							maxSteps: 10, 
							resourceId: inputData.threadId,
							threadId: inputData.threadId 
						});
						break;
					case "browser":
						response = await browserAgent.generate(initData.task, { 
							maxSteps: 8, 
							resourceId: inputData.threadId,
							threadId: inputData.threadId 
						});
						break;
				}
				
				return { result: response.text };
			},
		}),
	)
	.commit();

// Export the adaptive executor network
export const adaptiveExecutorNetwork = new NewAgentNetwork({
	id: "adaptive-executor",
	name: "Adaptive Executor Network",
	instructions: `You are an adaptive task execution network that intelligently routes tasks to appropriate agents.

## Core Principles:
1. **Minimal Agent Usage**: Only use the agents that are necessary
2. **Dynamic Routing**: Adapt execution based on task requirements
3. **Progressive Enhancement**: Start simple, add complexity only when needed
4. **Context Awareness**: Share context between agents for better results
5. **Memory Persistence**: Maintain agent memory within the same thread

## Capabilities:
- **Planning**: Strategic thinking and task decomposition
- **Research**: Information gathering and fact-finding
- **Code**: Programming and computational tasks (with persistent sandbox)
- **Browser**: Web interaction and automation

## Execution Modes:
1. **Quick Mode**: For simple, single-capability tasks
2. **Adaptive Mode**: For tasks requiring dynamic analysis and routing
3. **Complex Mode**: For multi-agent collaborative tasks

## Important:
- Always provide a threadId to maintain context across agent calls
- Sandboxes and other stateful resources are preserved within the same thread
- Use cleanupThread() when a conversation/task is complete

You excel at:
- Understanding user intent
- Selecting the right tools for the job
- Coordinating multiple agents when needed
- Providing comprehensive results
- Maintaining state across complex workflows

Always aim for efficiency while ensuring task completion quality.`,
	model: anthropic("claude-4-sonnet-20250514"),
	agents: {
		taskAnalyzer,
		resultSynthesizer,
		planner,
		searcher,
		sandbox: sandboxAgent,
		browser: browserAgent,
	},
	workflows: {
		adaptiveWorkflow,
		quickTaskWorkflow,
	},
});