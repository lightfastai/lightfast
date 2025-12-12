/**
 * Workspace Search API Route
 *
 * POST /[slug]/[workspaceName]/api/search
 *
 * Semantic search through a workspace's vector stores using Pinecone.
 * This API route is used by the console search UI and is designed for
 * authenticated users (via Clerk session).
 *
 * FUTURE EXTENSIBILITY:
 * - [ ] User's public search API (requires API key auth instead of session)
 * - [ ] MCP search connection (tool calling interface)
 * - [ ] Rate limiting per user/org
 * - [ ] Search analytics and query logging
 * - [ ] Multi-store search (search across all stores in a workspace)
 * - [ ] Hybrid search (combine semantic + keyword)
 * - [ ] Reranking with Cohere Rerank
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";

import { resolveWorkspaceByName } from "@repo/console-auth-middleware";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { randomUUID } from "node:crypto";
import { llmRelevanceFilter } from "~/lib/neural/llm-filter";
import type { FilterCandidate } from "~/lib/neural/llm-filter";

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
  latency: {
    total: number;
    retrieval: number;
    llmFilter: number;
  };
}

type SearchFilters = z.infer<typeof SearchFiltersSchema>;

/**
 * Build Pinecone metadata filter from search filters
 * Uses MongoDB-style operators supported by Pinecone
 */
function buildPineconeFilter(
  filters?: SearchFilters
): Record<string, unknown> | undefined {
  if (!filters) return undefined;

  const pineconeFilter: Record<string, unknown> = {
    // Always filter to observations layer
    layer: { $eq: "observations" },
  };

  if (filters.sourceTypes?.length) {
    pineconeFilter.source = { $in: filters.sourceTypes };
  }

  if (filters.observationTypes?.length) {
    pineconeFilter.observationType = { $in: filters.observationTypes };
  }

  if (filters.actorNames?.length) {
    pineconeFilter.actorName = { $in: filters.actorNames };
  }

  if (filters.dateRange?.start || filters.dateRange?.end) {
    const occurredAtFilter: Record<string, string> = {};
    if (filters.dateRange.start) {
      occurredAtFilter.$gte = filters.dateRange.start;
    }
    if (filters.dateRange.end) {
      occurredAtFilter.$lte = filters.dateRange.end;
    }
    pineconeFilter.occurredAt = occurredAtFilter;
  }

  return pineconeFilter;
}

/**
 * POST handler for workspace search
 *
 * Expects JSON body with:
 * - query: string - The search query
 * - store: string - The store slug to search in
 * - topK?: number - Number of results to return (default 10, max 100)
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

    // 4. Look up workspace configuration (embedding config now lives on workspace)
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found", requestId },
        { status: 404 }
      );
    }

    if (!workspace.indexName || !workspace.namespaceName) {
      return NextResponse.json(
        { error: "Workspace is not configured for search", requestId },
        { status: 404 }
      );
    }

    log.info("Resolved workspace", {
      requestId,
      workspaceId: workspace.id,
      indexName: workspace.indexName,
      namespaceName: workspace.namespaceName,
    });

    // 5. Generate query embedding
    const embedStart = Date.now();
    const embedding = createEmbeddingProviderForWorkspace(
      {
        id: workspace.id,
        embeddingModel: workspace.embeddingModel,
        embeddingDim: workspace.embeddingDim,
      },
      { inputType: "search_query" }
    );

    const { embeddings } = await embedding.embed([query]);
    const embedLatency = Date.now() - embedStart;

    const queryVector = embeddings[0];
    if (!queryVector) {
      log.error("Failed to generate embedding", { requestId });
      return NextResponse.json(
        { error: "Failed to generate query embedding", requestId },
        { status: 500 }
      );
    }

    log.info("Generated embedding", {
      requestId,
      embedLatency,
      dimension: queryVector.length,
    });

    // 6. Query Pinecone
    const queryStart = Date.now();
    const pineconeFilter = buildPineconeFilter(filters);
    const results = await pineconeClient.query<VectorMetadata>(
      workspace.indexName,
      {
        vector: queryVector,
        topK,
        includeMetadata: true,
        filter: pineconeFilter,
      },
      workspace.namespaceName
    );
    const queryLatency = Date.now() - queryStart;

    log.info("Pinecone query complete", {
      requestId,
      queryLatency,
      matchCount: results.matches.length,
      filterApplied: !!pineconeFilter,
    });

    // 7. Apply LLM relevance filtering
    const candidates: FilterCandidate[] = results.matches.map((match) => ({
      id: match.id,
      title: String(match.metadata?.title ?? ""),
      snippet: String(match.metadata?.snippet ?? ""),
      score: match.score,
    }));

    const filterResult = await llmRelevanceFilter(query, candidates, requestId);

    log.info("LLM filter result", {
      requestId,
      inputCount: candidates.length,
      outputCount: filterResult.results.length,
      filteredOut: filterResult.filtered,
      llmLatency: filterResult.latency,
      bypassed: filterResult.bypassed,
    });

    // 8. Map results to response format (using filtered results)
    const searchResults: SearchResult[] = filterResult.results.map((result) => {
      const match = results.matches.find((m) => m.id === result.id);
      return {
        id: result.id,
        title: result.title,
        url: String(match?.metadata?.url ?? ""),
        snippet: result.snippet,
        score: result.finalScore, // Use combined score
        metadata: {
          ...match?.metadata,
          relevanceScore: result.relevanceScore,
          vectorScore: result.score,
        },
      };
    });

    const response: SearchResponse = {
      results: searchResults,
      requestId,
      latency: {
        total: Date.now() - startTime,
        retrieval: queryLatency,
        llmFilter: filterResult.latency,
      },
    };

    log.info("Search complete", {
      requestId,
      latency: {
        total: response.latency.total,
        embed: embedLatency,
        retrieval: response.latency.retrieval,
        llmFilter: response.latency.llmFilter,
      },
      results: {
        vectorMatches: results.matches.length,
        afterLLMFilter: searchResults.length,
        filtered: filterResult.filtered,
      },
      filters: filters ?? null,
      llmBypassed: filterResult.bypassed,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("Search API error", {
      requestId,
      error,
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
