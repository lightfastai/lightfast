import { tool } from "ai";
// Import Exa if available, otherwise use fetch
import Exa from "exa-js";
import { z } from "zod";

import { env } from "~/env";

const exa = new Exa(env.EXA_API_KEY);

const webSearchToolSchema = z.object({
  query: z
    .string()
    .describe(
      "The search query to run on the web (e.g., 'types of Greek columns')",
    ),
  max_results: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of results to return (default: 10)"),
});

/**
 * Web search tool using Exa
 */
export function createWebSearchTool() {
  return tool({
    description:
      "Search for web pages. Normally you should call the extract tool after this one to get a spceific data point if search doesn't the exact data you need.",
    parameters: webSearchToolSchema,
    execute: async ({ query, max_results = 10 }) => {
      try {
        const exaResults = await exa.searchAndContents(query, {
          highlights: true,
          numResults: max_results,
        });
        return {
          results: exaResults.results.map((result) => ({
            title: result.title,
            url: result.url,
            content: result.highlights,
          })),
          query,
          number_of_results: exaResults.results.length,
        };
      } catch (error: unknown) {
        return {
          error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        };
      }
    },
  });
}
