import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { search } from "../../(ai)/api/chat/tools/web-search";

/**
 * API handler for web search requests
 */
export async function POST(req: NextRequest) {
  try {
    const {
      query,
      max_results = 10,
      search_depth = "basic",
      include_domains = [],
      exclude_domains = [],
      use_quotes,
      time_range,
    } = await req.json();

    // Validate the query parameter
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing query parameter" },
        { status: 400 },
      );
    }

    // Process quotes if specified
    let processedQuery = query;
    if (use_quotes && typeof query === "string") {
      // Simple implementation for adding quotes - in a real app, this could be more sophisticated
      const words = query.split(" ");
      if (words.length > 2) {
        // Add quotes around the middle part of the query
        const start = Math.floor(words.length / 3);
        const end = Math.min(start + Math.ceil(words.length / 3), words.length);
        const quotedPart = words.slice(start, end).join(" ");
        processedQuery = [
          ...words.slice(0, start),
          `"${quotedPart}"`,
          ...words.slice(end),
        ].join(" ");
      }
    }

    // Log the search request
    console.log(
      `🔍 Web search: "${processedQuery}" (Depth: ${search_depth}, Max: ${max_results})`,
    );

    // Execute the search
    const results = await search(
      processedQuery,
      max_results,
      search_depth,
      include_domains,
      exclude_domains,
    );

    // Return the search results
    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in web search API:", error);
    return NextResponse.json(
      { error: "Failed to execute search", details: String(error) },
      { status: 500 },
    );
  }
}
