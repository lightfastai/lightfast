/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { log } from "@vendor/observability/log";
import { createRerankProvider } from "@repo/console-rerank";
import type { RerankCandidate } from "@repo/console-rerank";
import type { V1SearchResponse, V1SearchResult } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import {
  fourPathParallelSearch,
  enrichSearchResults,
} from "~/lib/neural/four-path-search";
import type { V1AuthContext } from "./index";

export interface SearchLogicInput {
  query: string;
  limit: number;
  offset: number;
  mode: "fast" | "balanced" | "thorough";
  filters?: { sourceTypes?: string[]; observationTypes?: string[]; actorNames?: string[] };
  includeContext: boolean;
  includeHighlights: boolean;
  requestId: string;
}

export type SearchLogicOutput = V1SearchResponse;

export async function searchLogic(
  auth: V1AuthContext,
  input: SearchLogicInput,
): Promise<SearchLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/search logic executing", { requestId: input.requestId });

  // 1. Execute 4-path parallel search
  const searchStart = Date.now();
  const searchResult = await fourPathParallelSearch({
    workspaceId: auth.workspaceId,
    query: input.query,
    topK: input.limit * 2, // Over-fetch for reranking
    filters: input.filters,
    requestId: input.requestId,
  });
  const searchLatency = Date.now() - searchStart;

  // 2. Apply reranking based on mode
  const rerankStart = Date.now();
  const reranker = createRerankProvider(input.mode);

  // Convert candidates to rerank format
  const rerankCandidates: RerankCandidate[] = searchResult.candidates.map(
    (c) => ({
      id: c.id,
      title: c.title,
      content: c.snippet,
      score: c.score,
    }),
  );

  const rerankResponse = await reranker.rerank(input.query, rerankCandidates, {
    topK: input.limit + input.offset, // Get enough for pagination
    threshold: input.mode === "thorough" ? 0.4 : undefined,
    minResults:
      input.mode === "balanced" ? Math.max(3, Math.ceil(input.limit / 2)) : undefined,
  });

  const rerankLatency = Date.now() - rerankStart;

  log.debug("v1/search reranked", {
    requestId: input.requestId,
    mode: input.mode,
    provider: rerankResponse.provider,
    inputCount: rerankCandidates.length,
    outputCount: rerankResponse.results.length,
    rerankLatency,
  });

  // 3. Apply pagination
  const paginatedResults = rerankResponse.results.slice(
    input.offset,
    input.offset + input.limit,
  );

  // 4. Enrich results with full metadata from database
  const enrichStart = Date.now();
  const enrichedResults = await enrichSearchResults(
    paginatedResults,
    searchResult.candidates,
    auth.workspaceId,
  );
  const enrichLatency = Date.now() - enrichStart;

  // 5. Build response results
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
    references: r.references.length > 0 ? r.references : undefined,
    highlights: input.includeHighlights
      ? { title: r.title, snippet: r.snippet }
      : undefined,
  }));

  // 6. Build context (if requested)
  const context = input.includeContext
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

  // 7. Calculate maxParallel (bottleneck among parallel operations)
  const maxParallel = Math.max(
    searchResult.latency.vector,
    searchResult.latency.entity,
    searchResult.latency.cluster,
    searchResult.latency.actor,
  );

  // 8. Build response
  const response: V1SearchResponse = {
    data: results,
    context,
    meta: {
      total: searchResult.total,
      limit: input.limit,
      offset: input.offset,
      took: Date.now() - startTime,
      mode: input.mode,
      paths: searchResult.paths,
    },
    latency: {
      total: Date.now() - startTime,
      auth: 0, // Not applicable for direct function call (will be set by route handler)
      parse: 0, // Not applicable
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
    requestId: input.requestId,
  };

  // Track search query (fire-and-forget, non-blocking)
  recordSystemActivity({
    workspaceId: auth.workspaceId,
    actorType: auth.authType === "api-key" ? "api" : "user",
    actorUserId: auth.userId,
    category: "search",
    action: "search.query",
    entityType: "search_query",
    entityId: input.requestId,
    metadata: {
      query: input.query.substring(0, 200),
      limit: input.limit,
      offset: input.offset,
      mode: input.mode,
      hasFilters: input.filters !== undefined,
      resultCount: results.length,
      totalMatches: searchResult.total,
      latencyMs: response.latency.total,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId,
    },
  });

  log.debug("v1/search logic complete", {
    requestId: input.requestId,
    resultCount: results.length,
  });

  return response;
}
