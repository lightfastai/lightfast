import { z } from "zod";

/**
 * Standard search schema for most models
 */
const standardSearchSchema = z.object({
  query: z
    .string()
    .describe(
      "The search query to run on the web (e.g., 'history of quantum computing')",
    ),
  max_results: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of results to return (default: 20)"),
  search_depth: z
    .enum(["basic", "advanced"])
    .optional()
    .describe(
      "Depth of search - basic is faster, advanced is more thorough and comprehensive",
    ),
  include_domains: z
    .array(z.string())
    .optional()
    .describe(
      "List of domains to specifically include in search results (e.g., ['wikipedia.org', 'github.com'])",
    ),
  exclude_domains: z
    .array(z.string())
    .optional()
    .describe(
      "List of domains to exclude from search results (e.g., ['pinterest.com', 'facebook.com'])",
    ),
});

/**
 * Extended search schema for more capable models (GPT-4, Claude-3, etc.)
 */
const extendedSearchSchema = standardSearchSchema.extend({
  use_quotes: z
    .boolean()
    .optional()
    .describe("Whether to wrap part of the query in quotes for exact matching"),
  time_range: z
    .enum(["day", "week", "month", "year", "all"])
    .optional()
    .describe("Time range for search results (default: all)"),
});

/**
 * Returns the appropriate search schema based on the model
 * @param modelName The full model identifier (e.g., 'openai:gpt-4o-mini')
 * @returns Zod schema for search parameters
 */
export function getSearchSchemaForModel(modelName: string) {
  const lowerModel = modelName.toLowerCase();

  // Advanced models get the extended schema
  if (
    lowerModel.includes("gpt-4") ||
    lowerModel.includes("claude-3") ||
    lowerModel.includes("anthropic.claude") ||
    lowerModel.includes("llama-3-70b")
  ) {
    return extendedSearchSchema;
  }

  // Default to standard schema for all other models
  return standardSearchSchema;
}
