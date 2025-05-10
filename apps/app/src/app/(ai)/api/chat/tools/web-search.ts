import { tool } from "ai";
import Exa from "exa-js";

import type { SearchResults } from "../types/search";
import { env } from "~/env";
import { getSearchSchemaForModel } from "../schema/search";

/**
 * Creates a search tool with the appropriate schema for the given model.
 */
export function createSearchTool(fullModel: string) {
  return tool({
    description:
      "Search the web for real-time information about any topic. Use this when you need up-to-date information that might not be in your training data.",
    parameters: getSearchSchemaForModel(fullModel),
    execute: async ({
      query,
      max_results = 20,
      search_depth = "basic",
      include_domains = [],
      exclude_domains = [],
    }) => {
      // Ensure max_results is at least 5
      const effectiveMaxResults = Math.max(max_results || 5, 5);
      const effectiveSearchDepth = search_depth as
        | "basic"
        | "advanced"
        | "architectural";

      // For very short queries, add padding to meet minimum length requirements
      const filledQuery =
        query.length < 5 ? query + " ".repeat(5 - query.length) : query;

      try {
        // Special handling for architectural searches
        if (effectiveSearchDepth === "architectural") {
          return await architecturalSearch(
            filledQuery,
            effectiveMaxResults,
            include_domains,
            exclude_domains,
          );
        }

        return await exaSearch(
          filledQuery,
          effectiveMaxResults,
          effectiveSearchDepth === "advanced" ? "advanced" : "basic",
          include_domains,
          exclude_domains,
        );
      } catch (error) {
        console.error("Search API error:", error);
        return {
          results: [],
          query: filledQuery,
          images: [],
          number_of_results: 0,
        };
      }
    },
  });
}

/**
 * Specialized search implementation for architectural structures
 * Performs multiple targeted searches to gather comprehensive information
 */
async function architecturalSearch(
  query: string,
  maxResults = 10,
  includeDomains: string[] = [],
  excludeDomains: string[] = [],
): Promise<SearchResults> {
  // Enhanced searches for architectural research
  const architecturalQueries = [
    `${query} key components and dimensions`,
    `${query} architectural elements and features`,
    `${query} floor plan proportions measurements`,
  ];

  // Perform multiple searches and combine results
  const allResults: SearchResults = {
    results: [],
    query,
    images: [],
    number_of_results: 0,
  };

  // Distribute max results across queries
  const resultsPerQuery = Math.max(
    Math.floor(maxResults / architecturalQueries.length),
    3,
  );

  // Execute all searches in parallel
  const searchPromises = architecturalQueries.map((architecturalQuery) =>
    exaSearch(
      architecturalQuery,
      resultsPerQuery,
      "advanced", // Always use advanced search for architectural queries
      includeDomains,
      excludeDomains,
    ),
  );

  const searchResults = await Promise.all(searchPromises);

  // Combine results, avoiding duplicates by URL
  const seenUrls = new Set<string>();

  for (const result of searchResults) {
    for (const item of result.results) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allResults.results.push(item);
      }
    }
  }

  allResults.number_of_results = allResults.results.length;

  return allResults;
}

/**
 * Exa search implementation
 */
async function exaSearch(
  query: string,
  maxResults = 10,
  searchDepth: "basic" | "advanced" = "basic",
  includeDomains: string[] = [],
  excludeDomains: string[] = [],
): Promise<SearchResults> {
  const apiKey = env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not set in the environment variables");
  }

  const exa = new Exa(apiKey);

  const searchOptions = {
    highlights: true as const,
    numResults: maxResults,
    ...(includeDomains.length > 0 && { includeDomains }),
    ...(excludeDomains.length > 0 && { excludeDomains }),
    ...(searchDepth === "advanced" && {
      useAutoprompt: true,
      type: "keyword" as const,
    }),
  };

  const exaResults = await exa.searchAndContents(query, searchOptions);

  return {
    results: exaResults.results.map((result) => ({
      title: result.title ?? "",
      url: result.url,
      content: result.highlights.map((highlight) => highlight).join(" "),
    })),
    query,
    images: [],
    number_of_results: exaResults.results.length,
  };
}
