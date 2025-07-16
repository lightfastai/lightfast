import { Agent } from "@mastra/core/agent";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { browserAgent } from "../agents/browser";
import { planner } from "../agents/planner";
import { sandboxAgent } from "../agents/sandbox";
import { searcher } from "../agents/searcher";
import { models, openrouter } from "../lib/openrouter";

// Create a coordinator agent that decides which agents to use
const coordinatorAgent = new Agent({
	name: "Task Coordinator",
	description: "Analyzes tasks and coordinates between different execution agents",
	instructions: `You are a task coordination specialist. When given a task, you must:
1. Analyze what type of task it is (research, code execution, browser automation, or complex planning)
2. Determine which agents are needed
3. Create an execution plan

Format your response as JSON with the following structure:
{
  "taskType": "research|code|browser|complex",
  "agents": ["planner", "searcher", "sandbox", "browserbase"],
  "executionPlan": ["Step 1", "Step 2", "Step 3"],
  "reasoning": "Brief explanation of your choices"
}`,
	model: openrouter(models.claude4Sonnet),
});

// Step 1: Task Analysis
const analyzeTaskStep = createStep({
	id: "analyze-task",
	description: "Analyze the task and determine execution strategy",
	inputSchema: z.object({
		task: z.string().describe("The task to execute"),
		context: z.string().optional().describe("Additional context or constraints"),
	}),
	outputSchema: z.object({
		analysis: z.object({
			taskType: z.enum(["research", "code", "browser", "complex"]),
			agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
			executionPlan: z.array(z.string()),
			reasoning: z.string(),
		}),
	}),
	execute: async ({ inputData }) => {
		const prompt = `Task: ${inputData.task}${inputData.context ? `\nContext: ${inputData.context}` : ""}

Please analyze this task and determine the best execution strategy.`;

		const response = await coordinatorAgent.generate(prompt, {
			output: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
		});

		return { analysis: response.object.analysis };
	},
});

// Step 2: Research Execution
const researchExecutionStep = createStep({
	id: "research-execution",
	description: "Execute research tasks using searcher agent",
	inputSchema: z.object({
		task: z.string(),
		plan: z.array(z.string()),
	}),
	outputSchema: z.object({
		findings: z.string(),
		sources: z.array(z.string()),
	}),
	execute: async ({ inputData }) => {
		const response = await searcher.generate(
			`Research task: ${inputData.task}\n\nPlan:\n${inputData.plan.join("\n")}\n\nPlease conduct thorough research and provide findings with sources.`,
			{
				maxSteps: 10,
			},
		);

		// Extract sources from the response
		const sources =
			response.text.match(/https?:\/\/[^\s]+/g)?.filter((url, index, self) => self.indexOf(url) === index) || [];

		return {
			findings: response.text,
			sources,
		};
	},
});

// Step 3: Code Execution
const codeExecutionStep = createStep({
	id: "code-execution",
	description: "Execute code tasks using sandbox agent",
	inputSchema: z.object({
		task: z.string(),
		plan: z.array(z.string()),
		language: z.enum(["python", "javascript", "typescript", "bash"]).optional(),
	}),
	outputSchema: z.object({
		code: z.string(),
		output: z.string(),
		files: z.array(z.string()),
	}),
	execute: async ({ inputData }) => {
		const response = await sandboxAgent.generate(
			`Task: ${inputData.task}\n\nExecution plan:\n${inputData.plan.join("\n")}\n\n${
				inputData.language ? `Language preference: ${inputData.language}` : ""
			}\n\nPlease execute this task step by step.`,
			{
				maxSteps: 20,
			},
		);

		// Extract code blocks and output
		const codeBlocks = response.text.match(/```[\s\S]*?```/g) || [];
		const code = codeBlocks.map((block) => block.replace(/```\w*\n?|```/g, "")).join("\n\n");

		// Extract file paths mentioned
		const files =
			response.text
				.match(/(?:created?|modified?|wrote to)\s+(?:file\s+)?([/\w.-]+\.\w+)/gi)
				?.map((match) => match.replace(/^(?:created?|modified?|wrote to)\s+(?:file\s+)?/i, "")) || [];

		return {
			code,
			output: response.text,
			files,
		};
	},
});

// Step 4: Browser Automation
const browserAutomationStep = createStep({
	id: "browser-automation",
	description: "Execute browser automation tasks",
	inputSchema: z.object({
		task: z.string(),
		plan: z.array(z.string()),
		targetUrl: z.string().optional(),
	}),
	outputSchema: z.object({
		result: z.string(),
		screenshots: z.array(z.string()),
		extractedData: z.unknown().optional(),
	}),
	execute: async ({ inputData }) => {
		const response = await browserAgent.generate(
			`Task: ${inputData.task}\n\n${
				inputData.targetUrl ? `Target URL: ${inputData.targetUrl}\n\n` : ""
			}Execution plan:\n${inputData.plan.join("\n")}\n\nPlease execute this browser automation task.`,
			{
				maxSteps: 15,
			},
		);

		// Extract screenshot references
		const screenshots = response.text.match(/screenshot.*?saved|took screenshot/gi) || [];

		return {
			result: response.text,
			screenshots,
			extractedData: null,
		};
	},
});

// Step 5: Complex Task Orchestration
const complexTaskStep = createStep({
	id: "complex-task",
	description: "Orchestrate complex tasks using multiple agents",
	inputSchema: z.object({
		task: z.string(),
		analysis: z.object({
			taskType: z.enum(["research", "code", "browser", "complex"]),
			agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
			executionPlan: z.array(z.string()),
			reasoning: z.string(),
		}),
	}),
	outputSchema: z.object({
		result: z.string(),
		details: z.record(z.unknown()),
	}),
	execute: async ({ inputData }) => {
		const results: Record<string, unknown> = {};

		// First, use planner if included
		if (inputData.analysis.agents.includes("planner")) {
			const planResponse = await planner.generate(
				`Create a detailed plan for: ${inputData.task}\n\nConsider these aspects:\n${inputData.analysis.executionPlan.join("\n")}`,
			);
			results.plan = planResponse.text;
		}

		// Execute based on task components
		for (const step of inputData.analysis.executionPlan) {
			const stepLower = step.toLowerCase();

			if (stepLower.includes("research") || stepLower.includes("search")) {
				const searchResponse = await searcher.generate(`Research: ${step}`, { maxSteps: 5 });
				results.research = `${results.research || ""}\n\n${searchResponse.text}`;
			}

			if (stepLower.includes("code") || stepLower.includes("implement") || stepLower.includes("script")) {
				const codeResponse = await sandboxAgent.generate(`Implement: ${step}`, { maxSteps: 10 });
				results.code = `${results.code || ""}\n\n${codeResponse.text}`;
			}

			if (stepLower.includes("browser") || stepLower.includes("web") || stepLower.includes("scrape")) {
				const browserResponse = await browserAgent.generate(`Browser task: ${step}`, { maxSteps: 8 });
				results.browser = `${results.browser || ""}\n\n${browserResponse.text}`;
			}
		}

		// Synthesize results
		const synthesis = Object.entries(results)
			.map(([key, value]) => `### ${key.charAt(0).toUpperCase() + key.slice(1)}\n${value}`)
			.join("\n\n");

		return {
			result: synthesis,
			details: results,
		};
	},
});

// Main workflows

// Research Workflow
const researchWorkflow = createWorkflow({
	id: "research-workflow",
	description: "Execute research-focused tasks",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
	}),
	outputSchema: z.object({
		findings: z.string(),
		sources: z.array(z.string()),
	}),
})
	.then(analyzeTaskStep)
	.then(
		createStep({
			id: "prepare-research",
			description: "Prepare research execution",
			inputSchema: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			outputSchema: z.object({
				task: z.string(),
				plan: z.array(z.string()),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					task: initData.task,
					plan: inputData.analysis.executionPlan,
				};
			},
		}),
	)
	.then(researchExecutionStep)
	.commit();

// Code Execution Workflow
const codeWorkflow = createWorkflow({
	id: "code-workflow",
	description: "Execute code-focused tasks",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		language: z.enum(["python", "javascript", "typescript", "bash"]).optional(),
	}),
	outputSchema: z.object({
		code: z.string(),
		output: z.string(),
		files: z.array(z.string()),
	}),
})
	.then(
		createStep({
			id: "analyze-code-task",
			description: "Analyze code task",
			inputSchema: z.object({
				task: z.string(),
				context: z.string().optional(),
				language: z.enum(["python", "javascript", "typescript", "bash"]).optional(),
			}),
			outputSchema: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			execute: async ({ inputData }) => {
				const prompt = `Task: ${inputData.task}${inputData.context ? `\nContext: ${inputData.context}` : ""}

Please analyze this task and determine the best execution strategy.`;

				const response = await coordinatorAgent.generate(prompt, {
					output: z.object({
						analysis: z.object({
							taskType: z.enum(["research", "code", "browser", "complex"]),
							agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
							executionPlan: z.array(z.string()),
							reasoning: z.string(),
						}),
					}),
				});

				return { analysis: response.object.analysis };
			},
		}),
	)
	.then(
		createStep({
			id: "prepare-code",
			description: "Prepare code execution",
			inputSchema: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			outputSchema: z.object({
				task: z.string(),
				plan: z.array(z.string()),
				language: z.enum(["python", "javascript", "typescript", "bash"]).optional(),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					task: initData.task,
					plan: inputData.analysis.executionPlan,
					language: initData.language,
				};
			},
		}),
	)
	.then(codeExecutionStep)
	.commit();

// Browser Automation Workflow
const browserWorkflow = createWorkflow({
	id: "browser-workflow",
	description: "Execute browser automation tasks",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		targetUrl: z.string().optional(),
	}),
	outputSchema: z.object({
		result: z.string(),
		screenshots: z.array(z.string()),
		extractedData: z.record(z.unknown()).optional(),
	}),
})
	.then(
		createStep({
			id: "analyze-browser-task",
			description: "Analyze browser task",
			inputSchema: z.object({
				task: z.string(),
				context: z.string().optional(),
				targetUrl: z.string().optional(),
			}),
			outputSchema: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			execute: async ({ inputData }) => {
				const prompt = `Task: ${inputData.task}${inputData.context ? `\nContext: ${inputData.context}` : ""}

Please analyze this task and determine the best execution strategy.`;

				const response = await coordinatorAgent.generate(prompt, {
					output: z.object({
						analysis: z.object({
							taskType: z.enum(["research", "code", "browser", "complex"]),
							agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
							executionPlan: z.array(z.string()),
							reasoning: z.string(),
						}),
					}),
				});

				return { analysis: response.object.analysis };
			},
		}),
	)
	.then(
		createStep({
			id: "prepare-browser",
			description: "Prepare browser automation",
			inputSchema: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			outputSchema: z.object({
				task: z.string(),
				plan: z.array(z.string()),
				targetUrl: z.string().optional(),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					task: initData.task,
					plan: inputData.analysis.executionPlan,
					targetUrl: initData.targetUrl,
				};
			},
		}),
	)
	.then(browserAutomationStep)
	.commit();

// Complex Task Workflow
const complexWorkflow = createWorkflow({
	id: "complex-workflow",
	description: "Execute complex multi-agent tasks",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
	}),
	outputSchema: z.object({
		result: z.string(),
		details: z.record(z.unknown()),
	}),
})
	.then(analyzeTaskStep)
	.then(
		createStep({
			id: "prepare-complex",
			description: "Prepare complex task execution",
			inputSchema: z.object({
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			outputSchema: z.object({
				task: z.string(),
				analysis: z.object({
					taskType: z.enum(["research", "code", "browser", "complex"]),
					agents: z.array(z.enum(["planner", "searcher", "sandbox", "browserbase"])),
					executionPlan: z.array(z.string()),
					reasoning: z.string(),
				}),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					task: initData.task,
					analysis: inputData.analysis,
				};
			},
		}),
	)
	.then(complexTaskStep)
	.commit();

// Export the unified executor network
export const unifiedExecutorNetwork = new NewAgentNetwork({
	id: "unified-executor",
	name: "Unified Executor Network",
	instructions: `You are a comprehensive task execution network that integrates multiple specialized agents:

1. **Planner Agent**: Strategic planning and task decomposition
2. **Searcher Agent**: Web research and information gathering
3. **Sandbox Agent**: Code execution in isolated environments
4. **Browserbase Agent**: Browser automation and web scraping

You have four main workflows:

1. **Research Workflow**: For information gathering and analysis
2. **Code Workflow**: For programming and script execution
3. **Browser Workflow**: For web automation and data extraction
4. **Complex Workflow**: For multi-faceted tasks requiring multiple agents

Your role is to:
- Analyze incoming tasks to determine the best approach
- Select appropriate agents and workflows
- Coordinate execution across multiple agents when needed
- Provide comprehensive results

Always choose the most efficient approach based on the task requirements. For simple tasks, use single-agent workflows. For complex tasks, orchestrate multiple agents to achieve the best results.`,
	model: openrouter(models.claude4Sonnet),
	agents: {
		coordinator: coordinatorAgent,
		planner,
		searcher,
		sandbox: sandboxAgent,
		browserbase: browserAgent,
	},
	workflows: {
		researchWorkflow,
		codeWorkflow,
		browserWorkflow,
		complexWorkflow,
	},
});
