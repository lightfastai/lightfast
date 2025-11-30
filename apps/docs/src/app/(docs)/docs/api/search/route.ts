import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface LightfastSearchRequest {
  query: string;
  limit?: number;
  workspace?: string;
}

interface LightfastSearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  snippet?: string;
  score?: number;
  source?: string;
  highlights?: Array<{
    text: string;
    isHighlighted: boolean;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query: string };
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    // Get Lightfast API key from environment
    const apiKey = process.env.LIGHTFAST_API_KEY;
    const apiUrl = process.env.LIGHTFAST_API_URL || "https://api.lightfast.ai";

    if (!apiKey) {
      console.error("LIGHTFAST_API_KEY not configured");
      // For now, return mock results if API key is not configured
      return NextResponse.json({
        results: getMockResults(query),
      });
    }

    // Call Lightfast search API
    const searchRequest: LightfastSearchRequest = {
      query,
      limit: 10,
      // Add workspace if configured
      workspace: process.env.LIGHTFAST_WORKSPACE,
    };

    const response = await fetch(`${apiUrl}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(searchRequest),
    });

    if (!response.ok) {
      throw new Error(`Lightfast API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Lightfast response to our format
    const results: LightfastSearchResult[] = (data.results || []).map((item: any) => ({
      id: item.id || generateId(),
      title: item.title || item.name || "Untitled",
      description: item.description || item.summary,
      url: item.url || `/docs/${item.slug || item.id}`,
      snippet: item.snippet || item.highlight,
      score: item.score || item.relevance,
      source: item.source || item.type,
      highlights: item.highlights,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Mock results for development/testing
function getMockResults(query: string): LightfastSearchResult[] {
  const mockData = [
    {
      id: "1",
      title: "Getting Started with Lightfast",
      description: "Learn how to integrate Lightfast into your application",
      url: "/docs/get-started",
      snippet: "Lightfast is a neural memory system for teams. Get started by installing the SDK...",
      source: "Documentation",
    },
    {
      id: "2",
      title: "API Reference",
      description: "Complete API documentation for Lightfast",
      url: "/docs/api-reference",
      snippet: "Explore the four core endpoints: search, contents, similar, and answer...",
      source: "API Reference",
    },
    {
      id: "3",
      title: "Search Endpoint",
      description: "Search and rank results with semantic understanding",
      url: "/docs/api-reference/search",
      snippet: "POST /v1/search - Search through your team's knowledge base...",
      source: "API Reference",
    },
    {
      id: "4",
      title: "Authentication",
      description: "Set up authentication for your Lightfast integration",
      url: "/docs/authentication",
      snippet: "Use API keys to authenticate requests to Lightfast...",
      source: "Documentation",
    },
    {
      id: "5",
      title: "Examples",
      description: "Code examples and use cases",
      url: "/docs/examples",
      snippet: "See how to implement common patterns with Lightfast...",
      source: "Examples",
    },
  ];

  // Simple filtering based on query
  const filtered = mockData.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.description?.toLowerCase().includes(query.toLowerCase()) ||
    item.snippet?.toLowerCase().includes(query.toLowerCase())
  );

  return filtered.length > 0 ? filtered : mockData.slice(0, 3);
}