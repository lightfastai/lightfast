import { Agent } from "@mastra/core/agent";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { searcher } from "../agents/searcher";
import { models, openrouter } from "../lib/openrouter";

// Create dedicated research agents
const plannerAgent = new Agent({
	name: "Research Planner",
	description: "Plans research tasks and generates search queries",
	instructions: `You are a research planning specialist. When given a topic, you must:
1. Create a brief overview of what needs to be researched
2. Break down the research into 3-5 clear steps
3. Generate specific search queries for each step

Format your response as JSON with the following structure:
{
  "overview": "Brief overview of the research plan",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "searchQueries": ["Query 1", "Query 2", "Query 3"]
}`,
	model: openrouter(models.claude4Sonnet),
});

const researchAgent = new Agent({
	name: "Research Executor",
	description: "Executes searches and gathers information",
	instructions: `You are a research specialist. For each search query provided:
1. Search for relevant information
2. Extract key points and findings
3. Note important sources
4. Provide bullet-point summaries

Be thorough but concise. Focus on facts and current information.`,
	model: openrouter(models.claude4Sonnet),
	tools: searcher.tools, // Use the searcher agent's tools
});

const synthesisAgent = new Agent({
	name: "Report Synthesizer",
	description: "Synthesizes research findings into comprehensive reports",
	instructions: `You are a report synthesis specialist. Your role is to:
1. Analyze all research findings
2. Create a comprehensive, well-structured report
3. Write in full paragraphs (NO bullet points in the final report)
4. Ensure the report flows naturally and covers all important aspects
5. Include a brief executive summary

The report should be professional, informative, and suitable for presentation.`,
	model: openrouter(models.claude4Sonnet),
});

// Step 1: Planning step
const planStep = createStep({
	id: "plan-research",
	description: "Analyze and break down the research task",
	inputSchema: z.object({
		topic: z.string().describe("The topic to research"),
		context: z.string().optional().describe("Additional context"),
	}),
	outputSchema: z.object({
		plan: z.object({
			overview: z.string(),
			steps: z.array(z.string()),
			searchQueries: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const prompt = `Research topic: ${inputData.topic}${inputData.context ? `\nContext: ${inputData.context}` : ""}

Please create a research plan with clear steps and search queries.`;

		const response = await plannerAgent.generate(prompt, {
			output: z.object({
				plan: z.object({
					overview: z.string(),
					steps: z.array(z.string()),
					searchQueries: z.array(z.string()),
				}),
			}),
		});

		return { plan: response.object.plan };
	},
});

// Step 2: Research step
const researchStep = createStep({
	id: "execute-research",
	description: "Perform web searches to gather information",
	inputSchema: z.object({
		topic: z.string(),
		plan: z.object({
			overview: z.string(),
			steps: z.array(z.string()),
			searchQueries: z.array(z.string()),
		}),
	}),
	outputSchema: z.object({
		findings: z.string(),
		keyPoints: z.array(z.string()),
	}),
	execute: async ({ inputData }) => {
		let allFindings = "";
		const allKeyPoints: string[] = [];

		// Execute searches for each query
		for (const query of inputData.plan.searchQueries) {
			const searchPrompt = `Search for: ${query}
Context: ${inputData.plan.overview}

Please find relevant information and summarize key findings.`;

			const response = await researchAgent.generate(searchPrompt);
			allFindings += `\n\n=== ${query} ===\n${response.text}`;

			// Extract key points
			const keyPoints = response.text
				.split("\n")
				.filter((line) => line.trim().startsWith("•") || line.trim().startsWith("-"))
				.map((line) => line.replace(/^[•-]\s*/, "").trim())
				.filter((line) => line.length > 0);

			allKeyPoints.push(...keyPoints);
		}

		return {
			findings: allFindings,
			keyPoints: allKeyPoints.length > 0 ? allKeyPoints : ["Research completed"],
		};
	},
});

// Step 3: Synthesis step
const synthesisStep = createStep({
	id: "synthesize-report",
	description: "Create final report from research findings",
	inputSchema: z.object({
		topic: z.string(),
		findings: z.string(),
		keyPoints: z.array(z.string()),
	}),
	outputSchema: z.object({
		report: z.string(),
		summary: z.string(),
	}),
	execute: async ({ inputData }) => {
		const prompt = `Topic: ${inputData.topic}

Research Findings:
${inputData.findings}

Key Points:
${inputData.keyPoints.join("\n")}

Please synthesize all this information into a comprehensive report with full paragraphs. Include an executive summary at the beginning.`;

		const response = await synthesisAgent.generate(prompt, {
			output: z.object({
				report: z.string(),
				summary: z.string(),
			}),
		});

		return response.object;
	},
});

// Create the main research workflow
const researchWorkflow = createWorkflow({
	id: "full-research",
	description: "Complete research workflow from planning to final report",
	inputSchema: z.object({
		topic: z.string(),
		context: z.string().optional(),
	}),
	outputSchema: z.object({
		report: z.string(),
		summary: z.string(),
	}),
})
	.then(planStep)
	.then(
		createStep({
			id: "prepare-research",
			description: "Prepare data for research execution",
			inputSchema: z.object({
				plan: z.object({
					overview: z.string(),
					steps: z.array(z.string()),
					searchQueries: z.array(z.string()),
				}),
			}),
			outputSchema: z.object({
				topic: z.string(),
				plan: z.object({
					overview: z.string(),
					steps: z.array(z.string()),
					searchQueries: z.array(z.string()),
				}),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					topic: initData.topic,
					plan: inputData.plan,
				};
			},
		}),
	)
	.then(researchStep)
	.then(
		createStep({
			id: "prepare-synthesis",
			description: "Prepare data for synthesis",
			inputSchema: z.object({
				findings: z.string(),
				keyPoints: z.array(z.string()),
			}),
			outputSchema: z.object({
				topic: z.string(),
				findings: z.string(),
				keyPoints: z.array(z.string()),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					topic: initData.topic,
					findings: inputData.findings,
					keyPoints: inputData.keyPoints,
				};
			},
		}),
	)
	.then(synthesisStep)
	.commit();

// Create a quick research step
const quickResearchStep = createStep({
	id: "quick-research",
	description: "Perform quick research for simple queries",
	inputSchema: z.object({
		query: z.string(),
	}),
	outputSchema: z.object({
		findings: z.string(),
	}),
	execute: async ({ inputData }) => {
		const quickSearchAgent = new Agent({
			name: "Quick Researcher",
			description: "Performs quick searches for straightforward queries",
			instructions: `You are a quick research specialist. Search for the requested information and provide a concise summary in 2-3 paragraphs. Be informative but brief.`,
			model: openrouter(models.claude4Sonnet),
			tools: searcher.tools,
		});

		const response = await quickSearchAgent.generate(
			`Quick search for: ${inputData.query}\nProvide a concise summary of key findings.`,
		);

		return { findings: response.text };
	},
});

// Quick research workflow
const quickResearchWorkflow = createWorkflow({
	id: "quick-research",
	description: "Quick research for straightforward topics",
	inputSchema: z.object({
		query: z.string(),
	}),
	outputSchema: z.object({
		findings: z.string(),
	}),
})
	.then(quickResearchStep)
	.commit();

// Export the unified researcher network
export const unifiedResearcherNetwork = new NewAgentNetwork({
	id: "unified-researcher",
	name: "Unified Research Network",
	instructions: `You are a comprehensive research network designed to handle any research request. You have two main workflows:

1. **Full Research Workflow**: For complex topics requiring thorough investigation
   - Plans the research approach
   - Executes multiple searches
   - Synthesizes findings into a professional report

2. **Quick Research Workflow**: For simple queries needing fast answers
   - Performs a single search
   - Provides concise findings

Always assess the complexity of the request and choose the appropriate workflow. For academic, technical, or multi-faceted topics, use the full workflow. For simple factual queries, use the quick workflow.

IMPORTANT: Final reports must be written in full paragraphs without bullet points. Maintain a professional, informative tone throughout.`,
	model: openrouter(models.claude4Sonnet),
	agents: {
		plannerAgent,
		researchAgent,
		synthesisAgent,
	},
	workflows: {
		researchWorkflow,
		quickResearchWorkflow,
	},
});
