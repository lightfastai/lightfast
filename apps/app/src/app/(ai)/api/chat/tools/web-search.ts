import { tool } from "ai";
// Import Exa if available, otherwise use fetch
import Exa from "exa-js";
import { z } from "zod";

import { env } from "~/env";

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
      "Search the web using Exa for relevant information, links, or images.",
    parameters: webSearchToolSchema,
    execute: async ({ query, max_results = 10 }) => {
      const exa = new Exa(env.EXA_API_KEY);
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
    },
  });
}
