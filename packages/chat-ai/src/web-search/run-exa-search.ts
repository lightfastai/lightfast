import type { RegularSearchOptions, SearchResponse } from "exa-js";
import { currentSpan, wrapTraced } from "braintrust";
import Exa from "exa-js";
import type {
  LightfastRuntimeContext,
  WebSearchToolInput,
  WebSearchToolOutput,
} from "@repo/chat-ai-types";
/**
 * Wrapped web search execution function with Braintrust tracing
 */
export function createExecuteWebSearch() {
  return wrapTraced(
    async function executeWebSearch(
      {
        query,
        useAutoprompt = true,
        numResults = 5,
        contentType = "highlights",
        maxCharacters = 2000,
        summaryQuery,
        includeDomains,
        excludeDomains,
      }: WebSearchToolInput,
      context: LightfastRuntimeContext,
    ): Promise<WebSearchToolOutput> {
      try {
        const exaApiKey = context.tools?.webSearch?.exaApiKey;

        if (!exaApiKey) {
          throw new Error(
            "Web search tool runtime configuration is missing the Exa API key.",
          );
        }

        const exa = new Exa(exaApiKey);

        // Log initial search metadata
        currentSpan().log({
          metadata: {
            query,
            contentType,
            numResults,
            contextInfo: {
              sessionId: context.sessionId,
              resourceId: context.resourceId,
            },
          },
        });

        // Build search options with proper typing
        const baseOptions: RegularSearchOptions = {
          useAutoprompt,
          numResults,
          type: "auto", // Use auto to let Exa choose between neural/keyword
        };

        // Add domain filters if provided
        if (includeDomains) {
          baseOptions.includeDomains = includeDomains;
        }
        if (excludeDomains) {
          baseOptions.excludeDomains = excludeDomains;
        }

        // Configure content retrieval based on contentType with proper typing
        type HighlightsResponse = SearchResponse<{ highlights: true }>;
        type SummaryResponse = SearchResponse<{ summary: { query: string } }>;
        type TextResponse = SearchResponse<{ text: { maxCharacters: number } }>;

        let response: HighlightsResponse | SummaryResponse | TextResponse;
        switch (contentType) {
          case "highlights": {
            const searchOptions = {
              ...baseOptions,
              highlights: true,
            } as const;
            response = await exa.searchAndContents(query, searchOptions);
            break;
          }
          case "summary": {
            const searchOptions = {
              ...baseOptions,
              summary: {
                query: summaryQuery ?? query,
              },
            } as const;
            response = await exa.searchAndContents(query, searchOptions);
            break;
          }
          case "text": {
            const searchOptions = {
              ...baseOptions,
              text: {
                maxCharacters,
              },
            } as const;
            response = await exa.searchAndContents(query, searchOptions);
            break;
          }
          default: {
            // This should never happen due to the enum type
            const searchOptions = {
              ...baseOptions,
              highlights: true,
            } as const;
            response = await exa.searchAndContents(query, searchOptions);
            break;
          }
        }

        // Log search results metadata
        currentSpan().log({
          metadata: {
            resultCount: response.results.length,
            autopromptUsed: !!response.autopromptString,
          },
        });

        // Calculate estimated tokens (rough estimate: 1 token ≈ 4 characters)
        let totalCharacters = 0;
        const results: WebSearchToolOutput["results"] = response.results.map(
          (result) => {
            let content = "";

            // Extract content based on what was returned - now properly typed
            if (contentType === "highlights" && "highlights" in result) {
              content = result.highlights.join(" ... ");
            } else if (contentType === "summary" && "summary" in result) {
              content = result.summary;
            } else if ("text" in result) {
              content = result.text;
            }

            totalCharacters += content.length;

            return {
              title: result.title ?? "Untitled",
              url: result.url,
              content,
              contentType,
              score: result.score ?? undefined,
            };
          },
        );

        // Create citation sources from results for easy AI access
        const citationSources: WebSearchToolOutput["citationSources"] =
          results.map((result, index) => ({
            id: `src-${index + 1}`,
            title: result.title,
            url: result.url,
            domain: new URL(result.url).hostname,
            description:
              result.content.slice(0, 200) +
              (result.content.length > 200 ? "..." : ""),
            quote: contentType === "highlights" ? result.content : undefined,
          }));

        return {
          results,
          citationSources,
          query,
          autopromptString: response.autopromptString,
          tokensEstimate: Math.ceil(totalCharacters / 4),
        };
      } catch (error) {
        console.error("Web search error:", error);

        // Log error to Braintrust span
        currentSpan().log({
          metadata: {
            error: {
              message: error instanceof Error ? error.message : "Unknown error",
              type:
                error instanceof Error
                  ? error.constructor.name
                  : "UnknownError",
              query,
            },
          },
        });

        // Handle specific error types with user-friendly messages
        if (error instanceof Error) {
          if (error.message.includes("API key")) {
            throw new Error(
              "Search service is temporarily unavailable. Please try again later.",
            );
          }
          if (error.message.includes("rate limit")) {
            throw new Error(
              "Search rate limit exceeded. Please wait a moment and try again.",
            );
          }
          if (error.message.includes("timeout")) {
            throw new Error(
              "Search request timed out. Please try a simpler query.",
            );
          }
          if (error.message.includes("network")) {
            throw new Error(
              "Network error occurred during search. Please check your connection.",
            );
          }
          throw new Error(`Search failed: ${error.message}`);
        }

        throw new Error(
          "An unexpected error occurred during web search. Please try again.",
        );
      }
    },
    { type: "tool", name: "webSearch" },
  );
}

