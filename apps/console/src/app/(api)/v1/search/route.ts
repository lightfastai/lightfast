/**
 * POST /v1/search - Public Search API
 *
 * Semantic search through a workspace's neural memory using API key authentication.
 * Supports mode-based reranking for quality/latency tradeoffs.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - query: string (required) - Search query
 * - limit: number (1-100, default 10) - Results per page
 * - offset: number (default 0) - Pagination offset
 * - mode: "fast" | "balanced" | "thorough" (default: balanced)
 * - filters: object (optional) - Source/type/date filters
 * - includeContext: boolean (default true) - Include cluster/actor context
 * - includeHighlights: boolean (default true) - Include highlighted snippets
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { log } from "@vendor/observability/log";
import { createRerankProvider } from "@repo/console-rerank";
import type { RerankCandidate } from "@repo/console-rerank";
import { V1SearchRequestSchema } from "@repo/console-types";
import type { V1SearchResponse, V1SearchResult } from "@repo/console-types";

import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";
import { fourPathParallelSearch, enrichSearchResults } from "~/lib/neural/four-path-search";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/search request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authStart = Date.now();
    const authResult = await withDualAuth(request, requestId);
    const authLatency = Date.now() - authStart;

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/search authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
      authLatency,
    });

    // 2. Parse and validate request body
    const parseStart = Date.now();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = V1SearchRequestSchema.safeParse(body);
    const parseLatency = Date.now() - parseStart;

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const {
      query,
      limit,
      offset,
      mode,
      filters,
      includeContext,
      includeHighlights,
    } = parseResult.data;

    log.info("v1/search validated", {
      requestId,
      query,
      limit,
      offset,
      mode,
      filters: filters ?? null,
    });

    // 3. Execute 4-path parallel search
    const searchStart = Date.now();
    const searchResult = await fourPathParallelSearch({
      workspaceId,
      query,
      topK: limit * 2, // Over-fetch for reranking
      filters,
      requestId,
    });
    const searchLatency = Date.now() - searchStart;

    // 4. Apply reranking based on mode
    const rerankStart = Date.now();
    const reranker = createRerankProvider(mode);

    // Convert candidates to rerank format
    const rerankCandidates: RerankCandidate[] = searchResult.candidates.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.snippet,
      score: c.score,
    }));

    const rerankResponse = await reranker.rerank(query, rerankCandidates, {
      topK: limit + offset, // Get enough for pagination
      threshold: mode === "thorough" ? 0.4 : undefined,
      minResults: mode === "balanced" ? Math.max(3, Math.ceil(limit / 2)) : undefined,
    });

    const rerankLatency = Date.now() - rerankStart;

    log.info("v1/search reranked", {
      requestId,
      mode,
      provider: rerankResponse.provider,
      inputCount: rerankCandidates.length,
      outputCount: rerankResponse.results.length,
      rerankLatency,
    });

    // 5. Apply pagination
    const paginatedResults = rerankResponse.results.slice(offset, offset + limit);

    // 6. Enrich results with full metadata from database
    const enrichStart = Date.now();
    const enrichedResults = await enrichSearchResults(
      paginatedResults,
      searchResult.candidates,
      workspaceId
    );
    const enrichLatency = Date.now() - enrichStart;

    // 7. Build response results
    const results: V1SearchResult[] = enrichedResults.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      score: r.score,
      source: r.source,
      type: r.type,
      occurredAt: r.occurredAt ?? undefined,
      entities: r.entities,
      highlights: includeHighlights
        ? { title: r.title, snippet: r.snippet }
        : undefined,
    }));

    // 8. Build context (if requested)
    const context = includeContext
      ? {
          clusters: searchResult.clusters.slice(0, 2).map((c) => ({
            topic: c.topicLabel,
            summary: c.summary,
            keywords: c.keywords,
          })),
          relevantActors: searchResult.actors.slice(0, 3).map((a) => ({
            displayName: a.displayName,
            expertiseDomains: a.expertiseDomains,
          })),
        }
      : undefined;

    // 9. Calculate maxParallel (bottleneck among parallel operations)
    const maxParallel = Math.max(
      searchResult.latency.vector,
      searchResult.latency.entity,
      searchResult.latency.cluster,
      searchResult.latency.actor,
    );

    // 10. Build response
    const response: V1SearchResponse = {
      data: results,
      context,
      meta: {
        total: searchResult.total,
        limit,
        offset,
        took: Date.now() - startTime,
        mode,
        paths: searchResult.paths,
      },
      latency: {
        total: Date.now() - startTime,
        auth: authLatency,
        parse: parseLatency,
        search: searchLatency,
        embedding: searchResult.latency.embedding,
        retrieval: searchResult.latency.vector,
        entitySearch: searchResult.latency.entity,
        clusterSearch: searchResult.latency.cluster,
        actorSearch: searchResult.latency.actor,
        rerank: rerankLatency,
        enrich: enrichLatency,
        maxParallel,
      },
      requestId,
    };

    log.info("v1/search complete", {
      requestId,
      resultCount: results.length,
      latency: response.latency,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/search error", { requestId, error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Search failed",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 }
  );
}
