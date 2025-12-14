/**
 * Workspace Search API Route
 *
 * POST /[slug]/[workspaceName]/api/search
 *
 * Semantic search through a workspace's vector stores using Pinecone.
 * This API route is used by the console search UI and is designed for
 * authenticated users (via Clerk session).
 *
 * Uses the shared fourPathParallelSearch utility for 4-path retrieval:
 * 1. Vector similarity (Pinecone)
 * 2. Entity search (pattern matching)
 * 3. Cluster context (topic centroids)
 * 4. Actor profiles (contributor relevance)
 *
 * FUTURE EXTENSIBILITY:
 * - [x] User's public search API (see /v1/search)
 * - [ ] MCP search connection (tool calling interface)
 * - [ ] Rate limiting per user/org
 * - [ ] Search analytics and query logging
 * - [ ] Multi-store search (search across all stores in a workspace)
 * - [ ] Hybrid search (combine semantic + keyword)
 * - [x] Reranking with Cohere Rerank (see /v1/search modes)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@db/console/client";
import { resolveWorkspaceByName } from "@repo/console-auth-middleware";
import { log } from "@vendor/observability/log";
import { randomUUID } from "node:crypto";

import { fourPathParallelSearch } from "~/lib/neural/four-path-search";
import { llmRelevanceFilter } from "~/lib/neural/llm-filter";

// Filter validation schema
const SearchFiltersSchema = z
  .object({
    sourceTypes: z.array(z.string()).optional(),
    observationTypes: z.array(z.string()).optional(),
    actorNames: z.array(z.string()).optional(),
    dateRange: z
      .object({
        start: z.string().datetime().optional(),
        end: z.string().datetime().optional(),
      })
      .optional(),
  })
  .optional();

// Request validation schema
// Note: store parameter removed - each workspace has exactly ONE store (1:1 relationship)
const SearchRequestSchema = z.object({
  query: z.string().min(1, "Query must not be empty"),
  topK: z.number().int().min(1).max(100).default(10),
  filters: SearchFiltersSchema,
});

// Response types
interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface SearchResponse {
  results: SearchResult[];
  requestId: string;
  context?: {
    clusters: { topic: string | null; summary: string | null; keywords: string[] }[];
    relevantActors: { displayName: string; expertise: string[] }[];
  };
  latency: {
    total: number;
    embedding: number;
    retrieval: number;
    entitySearch: number;
    clusterSearch: number;
    actorSearch: number;
    llmFilter: number;
  };
}

/**
 * POST handler for workspace search
 *
 * Expects JSON body with:
 * - query: string - The search query
 * - topK?: number - Number of results to return (default 10, max 100)
 * - filters?: object - Optional filters for source types, observation types, etc.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string; workspaceName: string }> }
) {
  const startTime = Date.now();
  const requestId = randomUUID();
  const { slug, workspaceName } = await context.params;

  log.info("Search API request", { requestId, slug, workspaceName });

  try {
    // 1. Verify user authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required", requestId },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = SearchRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const { query, topK, filters } = parseResult.data;

    log.info("Search request validated", {
      requestId,
      userId,
      query,
      topK,
      filters: filters ?? null,
    });

    // 3. Resolve workspace access
    const workspaceResult = await resolveWorkspaceByName({
      clerkOrgSlug: slug,
      workspaceName: workspaceName,
      userId,
      db,
    });

    if (!workspaceResult.success) {
      const statusCode =
        workspaceResult.errorCode === "FORBIDDEN" ? 403 :
        workspaceResult.errorCode === "NOT_FOUND" ? 404 : 500;

      return NextResponse.json(
        { error: workspaceResult.error, requestId },
        { status: statusCode }
      );
    }

    const { workspaceId } = workspaceResult.data;

    log.info("Resolved workspace", { requestId, workspaceId });

    // 4. Execute 4-path parallel search (embedding + vector + entity + cluster + actor)
    const searchResult = await fourPathParallelSearch({
      workspaceId,
      query,
      topK,
      filters,
      requestId,
    });

    log.info("4-path parallel search complete", {
      requestId,
      candidates: searchResult.candidates.length,
      clusters: searchResult.clusters.length,
      actors: searchResult.actors.length,
      latency: searchResult.latency,
      paths: searchResult.paths,
    });

    // 5. Apply LLM relevance filtering (on merged candidates)
    const filterResult = await llmRelevanceFilter(query, searchResult.candidates, requestId);

    log.info("LLM filter result", {
      requestId,
      inputCount: searchResult.candidates.length,
      outputCount: filterResult.results.length,
      filteredOut: filterResult.filtered,
      llmLatency: filterResult.latency,
      bypassed: filterResult.bypassed,
    });

    // 6. Map results to response format (using filtered results)
    const searchResults: SearchResult[] = filterResult.results.map((result) => {
      const candidate = searchResult.candidates.find((c) => c.id === result.id);
      return {
        id: result.id,
        title: result.title,
        url: "", // URL not available from candidates - use enrichSearchResults for full metadata
        snippet: result.snippet,
        score: result.finalScore, // Use combined score
        metadata: {
          relevanceScore: result.relevanceScore,
          vectorScore: result.score,
          title: candidate?.title,
          snippet: candidate?.snippet,
        },
      };
    });

    // 7. Build context from cluster and actor results
    const responseContext = {
      clusters: searchResult.clusters.slice(0, 2).map((c) => ({
        topic: c.topicLabel,
        summary: c.summary,
        keywords: c.keywords,
      })),
      relevantActors: searchResult.actors.slice(0, 3).map((a) => ({
        displayName: a.displayName,
        expertise: a.expertiseDomains,
      })),
    };

    const response: SearchResponse = {
      results: searchResults,
      requestId,
      context: responseContext.clusters.length > 0 || responseContext.relevantActors.length > 0
        ? responseContext
        : undefined,
      latency: {
        total: Date.now() - startTime,
        embedding: searchResult.latency.embedding,
        retrieval: searchResult.latency.vector,
        entitySearch: searchResult.latency.entity,
        clusterSearch: searchResult.latency.cluster,
        actorSearch: searchResult.latency.actor,
        llmFilter: filterResult.latency,
      },
    };

    log.info("Search complete", {
      requestId,
      latency: response.latency,
      results: {
        total: searchResult.total,
        mergedCandidates: searchResult.candidates.length,
        afterLLMFilter: searchResults.length,
        filtered: filterResult.filtered,
      },
      context: {
        clusters: responseContext.clusters.length,
        actors: responseContext.relevantActors.length,
      },
      filters: filters ?? null,
      llmBypassed: filterResult.bypassed,
      paths: searchResult.paths,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("Search API error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      slug,
      workspaceName,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 *
 * FUTURE: Could support GET with query params for simple search links
 */
export function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
