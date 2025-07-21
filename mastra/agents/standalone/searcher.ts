import { Agent } from "@mastra/core/agent";
import { openai, openaiModels } from "@/lib/ai/provider";
import { webSearchTool } from "../../tools/web-search-tools";

// Note: Working memory schemas moved to network level for proper context handling

export const searcher = new Agent({
	name: "Searcher",
	description: "Performs advanced web searches using Exa to find current information",
	instructions: `You are the Searcher agent. Your role is to find current, relevant information from the web using advanced search capabilities.

USAGE GUIDELINES:
• First assess if your internal knowledge can answer the query adequately
• Use web search primarily for: recent events, time-sensitive info, current prices/availability, or when explicitly asked
• For complex topics requiring comprehensive research, use an iterative approach

SEARCH STRATEGIES:
• Use "highlights" for quick fact-finding and overview
• Use "summary" for in-depth understanding of complex topics  
• Use "text" when you need exact quotes or detailed technical information
• Adjust numResults based on topic complexity (3-5 for simple queries, 7-10 for research)
• Use domain filters to focus on authoritative sources when appropriate

Always use the web_search tool to find information and provide clear, well-sourced answers based on the search results.`,
	model: openai(openaiModels.gpt4oMini),
	// Note: Memory is handled at network level when used in networks
	// Individual agent memory can cause context conflicts in network execution
	tools: {
		web_search: webSearchTool,
	},
	defaultStreamOptions: {
		onChunk: ({ chunk }) => {
			console.log(`[Searcher] Chunk:`, chunk);
		},
		onError: ({ error }) => {
			console.error(`[Searcher] Stream error:`, error);
		},
		onStepFinish: (step) => {
			if (step.toolResults) {
				step.toolResults.forEach((result, index) => {
					if (
						result.type === "tool-result" &&
						result.output &&
						typeof result.output === "object" &&
						"error" in result.output
					) {
						console.error(`[Searcher] Tool ${index} error:`, result.output.error);
					}
				});
			}
			console.log(`[Searcher] Step completed`);
		},
		onFinish: (result) => {
			console.log(`[Searcher] Generation finished:`, result);
		},
	},
});
