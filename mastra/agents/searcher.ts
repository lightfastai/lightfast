import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import Exa, { type RegularSearchOptions, type SearchResponse } from "exa-js";
import { z } from "zod";
import { env } from "@/env";
import { models, openrouter } from "../lib/openrouter";

const webSearchTool = createTool({
	id: "web_search",
	description: "Advanced web search with optimized content retrieval using Exa",
	inputSchema: z.object({
		query: z.string().describe("The search query"),
		useAutoprompt: z.boolean().default(true).describe("Whether to enhance the query automatically"),
		numResults: z.number().min(1).max(10).default(5).describe("Number of results to return"),
		contentType: z
			.enum(["highlights", "summary", "text"])
			.default("highlights")
			.describe("Type of content to retrieve: highlights (excerpts), summary (AI-generated), or text (full)"),
		maxCharacters: z
			.number()
			.min(100)
			.max(5000)
			.default(2000)
			.describe("Maximum characters per result when using text content type"),
		summaryQuery: z
			.string()
			.optional()
			.describe("Custom query for generating summaries (only used with summary content type)"),
		includeDomains: z.array(z.string()).optional().describe("Domains to include in search results"),
		excludeDomains: z.array(z.string()).optional().describe("Domains to exclude from search results"),
	}),
	outputSchema: z.object({
		results: z.array(
			z.object({
				title: z.string(),
				url: z.string(),
				content: z.string().describe("The retrieved content based on contentType"),
				contentType: z.enum(["highlights", "summary", "text"]),
				score: z.number().optional(),
			}),
		),
		query: z.string(),
		autopromptString: z.string().optional(),
		tokensEstimate: z.number().describe("Estimated tokens used for content retrieval"),
	}),
	execute: async ({ context }) => {
		try {
			const exa = new Exa(env.EXA_API_KEY);

			// Build search options with proper typing
			const baseOptions: RegularSearchOptions = {
				useAutoprompt: context.useAutoprompt,
				numResults: context.numResults,
				type: "auto", // Use auto to let Exa choose between neural/keyword
			};

			// Add domain filters if provided
			if (context.includeDomains) {
				baseOptions.includeDomains = context.includeDomains;
			}
			if (context.excludeDomains) {
				baseOptions.excludeDomains = context.excludeDomains;
			}

			// Configure content retrieval based on contentType with proper typing
			type HighlightsResponse = SearchResponse<{ highlights: true }>;
			type SummaryResponse = SearchResponse<{ summary: { query: string } }>;
			type TextResponse = SearchResponse<{ text: { maxCharacters: number } }>;

			let response: HighlightsResponse | SummaryResponse | TextResponse;
			switch (context.contentType) {
				case "highlights": {
					const searchOptions = {
						...baseOptions,
						highlights: true,
					} as const;
					response = await exa.searchAndContents(context.query, searchOptions);
					break;
				}
				case "summary": {
					const searchOptions = {
						...baseOptions,
						summary: {
							query: context.summaryQuery || context.query,
						},
					} as const;
					response = await exa.searchAndContents(context.query, searchOptions);
					break;
				}
				case "text": {
					const searchOptions = {
						...baseOptions,
						text: {
							maxCharacters: context.maxCharacters,
						},
					} as const;
					response = await exa.searchAndContents(context.query, searchOptions);
					break;
				}
			}

			// Calculate estimated tokens (rough estimate: 1 token ≈ 4 characters)
			let totalCharacters = 0;
			const results = response.results.map((result) => {
				let content = "";

				// Extract content based on what was returned - now properly typed
				if (context.contentType === "highlights" && "highlights" in result) {
					content = result.highlights.join(" ... ");
				} else if (context.contentType === "summary" && "summary" in result) {
					content = result.summary;
				} else if ("text" in result) {
					content = result.text;
				}

				totalCharacters += content.length;

				return {
					title: result.title || "Untitled",
					url: result.url,
					content,
					contentType: context.contentType,
					score: result.score || undefined,
				};
			});

			return {
				results,
				query: context.query,
				autopromptString: response.autopromptString,
				tokensEstimate: Math.ceil(totalCharacters / 4),
			};
		} catch (error) {
			console.error("Web search error:", error);
			throw error;
		}
	},
});

// Schema for searcher working memory
const searcherMemorySchema = z.object({
	searchHistory: z
		.array(
			z.object({
				query: z.string(),
				results: z.array(
					z.object({
						title: z.string(),
						url: z.string(),
					}),
				),
				timestamp: z.string(),
			}),
		)
		.default([]),
	relevantFindings: z.record(z.string(), z.any()).default({}),
	currentResearchTopic: z.string().nullable().default(null),
});

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
	model: openrouter(models.claude4Sonnet),
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: searcherMemorySchema,
			},
			lastMessages: 20,
		},
	}),
	tools: {
		web_search: webSearchTool,
	},
});
