import { createTool } from "@mastra/core/tools";
import Exa, { type RegularSearchOptions, type SearchResponse } from "exa-js";
import { z } from "zod";
import { env } from "../../env";

/**
 * Advanced web search tool using Exa API
 * Supports multiple content types: highlights, summaries, and full text
 */
export const webSearchTool = createTool({
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

			// Handle specific error types with user-friendly messages
			if (error instanceof Error) {
				if (error.message.includes("API key")) {
					throw new Error("Search service is temporarily unavailable. Please try again later.");
				}
				if (error.message.includes("rate limit")) {
					throw new Error("Search rate limit exceeded. Please wait a moment and try again.");
				}
				if (error.message.includes("timeout")) {
					throw new Error("Search request timed out. Please try a simpler query.");
				}
				if (error.message.includes("network")) {
					throw new Error("Network error occurred during search. Please check your connection.");
				}
				throw new Error(`Search failed: ${error.message}`);
			}

			throw new Error("An unexpected error occurred during web search. Please try again.");
		}
	},
});
