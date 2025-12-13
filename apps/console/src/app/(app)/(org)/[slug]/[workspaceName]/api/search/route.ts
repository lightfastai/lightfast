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
import { searchByEntities } from "~/lib/neural/entity-search";
import { searchClusters } from "~/lib/neural/cluster-search";
import { searchActorProfiles } from "~/lib/neural/actor-search";
import type { EntitySearchResult } from "@repo/console-types";

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
    retrieval: number;
    entitySearch: number;
    clusterSearch: number;
    actorSearch: number;
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
 * Merge vector search results with entity-matched results
 * Entity matches get a score boost since they're exact matches
 */
function mergeSearchResults(
  vectorMatches: { id: string; score: number; metadata?: VectorMetadata }[],
  entityResults: EntitySearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate>();

  // Add vector results
  for (const match of vectorMatches) {
    resultMap.set(match.id, {
      id: match.id,
      title: String(match.metadata?.title ?? ""),
      snippet: String(match.metadata?.snippet ?? ""),
      score: match.score,
    });
  }

  // Add/boost entity results
  for (const entity of entityResults) {
    const existing = resultMap.get(entity.observationId);
    if (existing) {
      // Boost existing result - entity match confirms relevance
      existing.score = Math.min(1.0, existing.score + 0.2);
    } else {
      // Add new result from entity match
      resultMap.set(entity.observationId, {
        id: entity.observationId,
        title: entity.observationTitle,
        snippet: entity.observationSnippet,
        score: 0.85 * entity.confidence, // High base score for exact entity match
      });
    }
  }

  // Sort by score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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

    // Extract narrowed types for use in parallel search paths
    const indexName = workspace.indexName;
    const namespaceName = workspace.namespaceName;

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

    // 6. 4-path parallel retrieval
    const pineconeFilter = buildPineconeFilter(filters);
    const parallelStart = Date.now();

    const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
      // Path 1: Vector similarity search
      (async () => {
        const start = Date.now();
        const results = await pineconeClient.query<VectorMetadata>(
          indexName,
          {
            vector: queryVector,
            topK,
            includeMetadata: true,
            filter: pineconeFilter,
          },
          namespaceName
        );
        return { results, latency: Date.now() - start };
      })(),

      // Path 2: Entity search
      (async () => {
        const start = Date.now();
        const results = await searchByEntities(query, workspaceId, topK);
        return { results, latency: Date.now() - start };
      })(),

      // Path 3: Cluster context search
      searchClusters(
        workspaceId,
        indexName,
        namespaceName,
        queryVector,
        3 // Top 3 clusters
      ),

      // Path 4: Actor profile search
      searchActorProfiles(workspaceId, query, 5),
    ]);

    log.info("4-path parallel search complete", {
      requestId,
      totalLatency: Date.now() - parallelStart,
      vectorMatches: vectorResults.results.matches.length,
      vectorLatency: vectorResults.latency,
      entityMatches: entityResults.results.length,
      entityLatency: entityResults.latency,
      clusterMatches: clusterResults.results.length,
      clusterLatency: clusterResults.latency,
      actorMatches: actorResults.results.length,
      actorLatency: actorResults.latency,
    });

    // 7. Merge vector and entity results
    const mergedCandidates = mergeSearchResults(
      vectorResults.results.matches,
      entityResults.results,
      topK
    );

    // 8. Apply LLM relevance filtering (on merged results)
    const filterResult = await llmRelevanceFilter(query, mergedCandidates, requestId);

    log.info("LLM filter result", {
      requestId,
      inputCount: mergedCandidates.length,
      outputCount: filterResult.results.length,
      filteredOut: filterResult.filtered,
      llmLatency: filterResult.latency,
      bypassed: filterResult.bypassed,
    });

    // 9. Map results to response format (using filtered results)
    const searchResults: SearchResult[] = filterResult.results.map((result) => {
      const match = vectorResults.results.matches.find((m) => m.id === result.id);
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

    // 10. Build context from cluster and actor results
    const context = {
      clusters: clusterResults.results.slice(0, 2).map((c) => ({
        topic: c.topicLabel,
        summary: c.summary,
        keywords: c.keywords,
      })),
      relevantActors: actorResults.results.slice(0, 3).map((a) => ({
        displayName: a.displayName,
        expertise: a.expertiseDomains,
      })),
    };

    const response: SearchResponse = {
      results: searchResults,
      requestId,
      context: context.clusters.length > 0 || context.relevantActors.length > 0 ? context : undefined,
      latency: {
        total: Date.now() - startTime,
        retrieval: vectorResults.latency,
        entitySearch: entityResults.latency,
        clusterSearch: clusterResults.latency,
        actorSearch: actorResults.latency,
        llmFilter: filterResult.latency,
      },
    };

    log.info("Search complete", {
      requestId,
      latency: {
        total: response.latency.total,
        embed: embedLatency,
        retrieval: response.latency.retrieval,
        entitySearch: response.latency.entitySearch,
        clusterSearch: response.latency.clusterSearch,
        actorSearch: response.latency.actorSearch,
        llmFilter: response.latency.llmFilter,
      },
      results: {
        vectorMatches: vectorResults.results.matches.length,
        entityMatches: entityResults.results.length,
        clusterMatches: clusterResults.results.length,
        actorMatches: actorResults.results.length,
        mergedCandidates: mergedCandidates.length,
        afterLLMFilter: searchResults.length,
        filtered: filterResult.filtered,
      },
      context: {
        clusters: context.clusters.length,
        actors: context.relevantActors.length,
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
