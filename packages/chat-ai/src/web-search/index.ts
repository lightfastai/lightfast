import { createTool } from "lightfast/tool";
import { z } from "zod";

import type {
  LightfastRuntimeContext,
  WebSearchToolInput,
  WebSearchToolOutput,
} from "@repo/chat-ai-types";
import { WEB_SEARCH_CONTENT_TYPES } from "@repo/chat-ai-types";

import { createExecuteWebSearch } from "./run-exa-search";

/**
 * Create web search tool with runtime-configured dependencies.
 */
const inputSchema: z.ZodType<WebSearchToolInput> = z
  .object({
    query: z.string().describe("The search query"),
    useAutoprompt: z
      .boolean()
      .default(true)
      .describe("Whether to enhance the query automatically"),
    numResults: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return"),
    contentType: z
      .enum(WEB_SEARCH_CONTENT_TYPES)
      .default("highlights")
      .describe(
        "Type of content to retrieve: highlights (excerpts), summary (AI-generated), or text (full)",
      ),
    maxCharacters: z
      .number()
      .min(100)
      .max(5000)
      .default(2000)
      .describe("Maximum characters per result when using text content type"),
    summaryQuery: z
      .string()
      .optional()
      .describe(
        "Custom query for generating summaries (only used with summary content type)",
      ),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe("Domains to include in search results"),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe("Domains to exclude from search results"),
  })
  .strict();

const outputSchema: z.ZodType<WebSearchToolOutput> = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      contentType: z.enum(WEB_SEARCH_CONTENT_TYPES),
      score: z.number().optional(),
    }),
  ),
  citationSources: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      domain: z.string(),
      description: z.string(),
      quote: z.string().optional(),
    }),
  ),
  query: z.string(),
  autopromptString: z.string().optional(),
  tokensEstimate: z.number(),
});

export function webSearchTool() {
  return createTool<
    LightfastRuntimeContext,
    typeof inputSchema,
    typeof outputSchema
  >({
    description:
      "Advanced web search with optimized content retrieval using Exa",
    inputSchema,
    outputSchema,
    execute: createExecuteWebSearch(),
  });
}
