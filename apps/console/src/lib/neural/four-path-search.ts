/**
 * Four-Path Parallel Search
 *
 * Executes parallel retrieval across:
 * 1. Vector similarity (Pinecone)
 * 2. Entity search (pattern matching)
 * 3. Cluster context (topic centroids)
 * 4. Actor profiles (contributor relevance)
 *
 * Extracted from internal search route for reuse in public API.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console/schema";
import { and, or, inArray, eq } from "drizzle-orm";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
import { log } from "@vendor/observability/log";
import type { FilterCandidate } from "./llm-filter";
import { searchByEntities } from "./entity-search";
import { searchClusters } from "./cluster-search";
import { searchActorProfiles } from "./actor-search";
import type { EntitySearchResult } from "@repo/console-types";

// ============================================================================
// EMPTY RESULT CONSTANTS
// ============================================================================

/** Empty cluster result for skipped path */
const EMPTY_CLUSTER_RESULT = { results: [], latency: 0 } as const;

/** Empty actor result for skipped path */
const EMPTY_ACTOR_RESULT = { results: [], latency: 0 } as const;

// ============================================================================
// VECTOR ID NORMALIZATION
// ============================================================================

/**
 * Information about which embedding views matched for an observation
 */
interface ViewMatch {
  view: "title" | "content" | "summary" | "legacy";
  score: number;
  vectorId: string;
}

/**
 * Normalized vector result with observation ID
 */
interface NormalizedVectorResult {
  observationId: string;
  score: number;
  matchedViews: ViewMatch[];
  metadata?: VectorMetadata;
}

/**
 * Extract view type from vector ID prefix
 */
function getViewFromVectorId(vectorId: string): "title" | "content" | "summary" | "legacy" {
  if (vectorId.startsWith("obs_title_")) return "title";
  if (vectorId.startsWith("obs_content_")) return "content";
  if (vectorId.startsWith("obs_summary_")) return "summary";
  return "legacy";
}

/**
 * Normalize Pinecone vector IDs to database observation IDs.
 * Groups multi-view matches by observation and returns max score.
 *
 * This function handles the ID mismatch between Pinecone (which stores
 * vector IDs like obs_content_...) and the database (which uses nanoid
 * observation IDs).
 *
 * Phase 3 optimization: New observations have observationId in metadata,
 * allowing direct lookup without database queries. Legacy observations
 * (without metadata.observationId) fall back to database lookup.
 */
async function normalizeVectorIds(
  workspaceId: string,
  vectorMatches: { id: string; score: number; metadata?: VectorMetadata }[],
  requestId?: string
): Promise<NormalizedVectorResult[]> {
  if (vectorMatches.length === 0) return [];

  // Separate matches with observationId in metadata (Phase 3) from those without (legacy)
  const withObsId: typeof vectorMatches = [];
  const withoutObsId: typeof vectorMatches = [];

  for (const match of vectorMatches) {
    // Check if metadata has observationId (Phase 3 vectors)
    const metadata = match.metadata as Record<string, unknown> | undefined;
    if (typeof metadata?.observationId === "string") {
      withObsId.push(match);
    } else {
      withoutObsId.push(match);
    }
  }

  // Group matches by observation ID
  const obsGroups = new Map<string, {
    matches: ViewMatch[];
    metadata?: VectorMetadata;
  }>();

  // Process matches with observationId directly (no DB lookup needed - Phase 3 path)
  for (const match of withObsId) {
    const metadata = match.metadata as Record<string, unknown>;
    const obsId = metadata.observationId as string;
    const view = getViewFromVectorId(match.id);

    const existing = obsGroups.get(obsId);
    if (existing) {
      existing.matches.push({ view, score: match.score, vectorId: match.id });
    } else {
      obsGroups.set(obsId, {
        matches: [{ view, score: match.score, vectorId: match.id }],
        metadata: match.metadata,
      });
    }
  }

  // For legacy vectors without observationId, fall back to database lookup (Phase 2 path)
  if (withoutObsId.length > 0) {
    const vectorIds = withoutObsId.map((m) => m.id);

    const observations = await db
      .select({
        id: workspaceNeuralObservations.id,
        externalId: workspaceNeuralObservations.externalId,
        embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
        embeddingContentId: workspaceNeuralObservations.embeddingContentId,
        embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
        embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          or(
            inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
          )
        )
      );

    // Build vector ID → observation mapping for legacy vectors
    // Uses externalId (nanoid) for API-facing lookups
    const vectorToObs = new Map<string, { id: string; view: "title" | "content" | "summary" | "legacy" }>();
    for (const obs of observations) {
      if (obs.embeddingTitleId) vectorToObs.set(obs.embeddingTitleId, { id: obs.externalId, view: "title" });
      if (obs.embeddingContentId) vectorToObs.set(obs.embeddingContentId, { id: obs.externalId, view: "content" });
      if (obs.embeddingSummaryId) vectorToObs.set(obs.embeddingSummaryId, { id: obs.externalId, view: "summary" });
      if (obs.embeddingVectorId) vectorToObs.set(obs.embeddingVectorId, { id: obs.externalId, view: "legacy" });
    }

    // Add legacy matches to obsGroups
    for (const match of withoutObsId) {
      const obs = vectorToObs.get(match.id);
      if (!obs) {
        log.warn("Vector ID not found in database", { vectorId: match.id, requestId });
        continue;
      }

      const existing = obsGroups.get(obs.id);
      if (existing) {
        existing.matches.push({ view: obs.view, score: match.score, vectorId: match.id });
      } else {
        obsGroups.set(obs.id, {
          matches: [{ view: obs.view, score: match.score, vectorId: match.id }],
          metadata: match.metadata,
        });
      }
    }
  }

  // Log Phase 3 effectiveness
  if (withObsId.length > 0 || withoutObsId.length > 0) {
    log.info("normalizeVectorIds paths", {
      requestId,
      phase3Direct: withObsId.length,
      phase2Lookup: withoutObsId.length,
    });
  }

  // Convert to result array with max score aggregation
  const results: NormalizedVectorResult[] = [];

  for (const [obsId, group] of obsGroups) {
    // Use MAX score across all matching views
    const maxScore = Math.max(...group.matches.map((m) => m.score));

    results.push({
      observationId: obsId,
      score: maxScore,
      matchedViews: group.matches,
      metadata: group.metadata,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

// ============================================================================
// SEARCH INTERFACES
// ============================================================================

export interface FourPathSearchParams {
  workspaceId: string;
  query: string;
  topK: number;
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
  requestId?: string;
}

export interface FourPathSearchResult {
  /** Merged candidates ready for reranking */
  candidates: FilterCandidate[];
  /** Cluster context results */
  clusters: {
    topicLabel: string | null;
    summary: string | null;
    keywords: string[];
    score: number;
  }[];
  /** Actor profile results */
  actors: {
    displayName: string;
    expertiseDomains: string[];
    score: number;
  }[];
  /** Latency breakdown */
  latency: {
    embedding: number;
    vector: number;
    entity: number;
    cluster: number;
    actor: number;
    normalize: number;
    total: number;
  };
  /** Total candidates before dedup */
  total: number;
  /** Search paths status */
  paths: {
    vector: boolean;
    entity: boolean;
    cluster: boolean;
    actor: boolean;
  };
}

/**
 * Build Pinecone metadata filter from search filters
 */
function buildPineconeFilter(
  filters?: FourPathSearchParams["filters"]
): Record<string, unknown> | undefined {
  if (!filters) {
    return { layer: { $eq: "observations" } };
  }

  const pineconeFilter: Record<string, unknown> = {
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
 * Merge normalized vector results with entity-matched results.
 * All IDs are now observation IDs (database nanoids).
 */
function mergeSearchResults(
  normalizedVectorResults: NormalizedVectorResult[],
  entityResults: EntitySearchResult[],
  limit: number
): FilterCandidate[] {
  const resultMap = new Map<string, FilterCandidate>();

  // Add normalized vector results (now using observation IDs)
  for (const result of normalizedVectorResults) {
    resultMap.set(result.observationId, {
      id: result.observationId,
      title: String(result.metadata?.title ?? ""),
      snippet: String(result.metadata?.snippet ?? ""),
      score: result.score,
    });
  }

  // Merge with entity results
  for (const entity of entityResults) {
    const existing = resultMap.get(entity.observationId);
    if (existing) {
      // Boost score for entity confirmation (+0.2)
      existing.score = Math.min(1.0, existing.score + 0.2);
      // Prefer entity title/snippet if available
      if (entity.observationTitle) existing.title = entity.observationTitle;
      if (entity.observationSnippet) existing.snippet = entity.observationSnippet;
    } else {
      // Add new result from entity match
      resultMap.set(entity.observationId, {
        id: entity.observationId,
        title: entity.observationTitle,
        snippet: entity.observationSnippet,
        score: 0.85 * entity.confidence,
      });
    }
  }

  // Sort by score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Execute 4-path parallel search
 *
 * @param params - Search parameters
 * @returns Combined results from all paths with latency metrics
 */
export async function fourPathParallelSearch(
  params: FourPathSearchParams
): Promise<FourPathSearchResult> {
  const { workspaceId, query, topK, filters, requestId } = params;
  const startTime = Date.now();

  // 1. Look up workspace configuration (cached)
  const workspace = await getCachedWorkspaceConfig(workspaceId);

  if (!workspace) {
    throw new Error(`Workspace not found or not configured for search: ${workspaceId}`);
  }

  const { indexName, namespaceName, embeddingModel, embeddingDim, hasClusters, hasActors } = workspace;

  // 2. Generate query embedding
  const embedStart = Date.now();
  const embedding = createEmbeddingProviderForWorkspace(
    {
      id: workspaceId,
      embeddingModel,
      embeddingDim,
    },
    { inputType: "search_query" }
  );

  const { embeddings } = await embedding.embed([query]);
  const embedLatency = Date.now() - embedStart;

  const queryVector = embeddings[0];
  if (!queryVector) {
    throw new Error("Failed to generate query embedding");
  }

  // 3. Execute 4-path parallel retrieval (skip empty paths)
  const pineconeFilter = buildPineconeFilter(filters);
  const parallelStart = Date.now();

  const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
    // Path 1: Vector similarity search (always execute)
    (async () => {
      const start = Date.now();
      try {
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
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Vector search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
        return { results: { matches: [] }, latency: Date.now() - start, success: false };
      }
    })(),

    // Path 2: Entity search (always execute - fast pattern matching)
    (async () => {
      const start = Date.now();
      try {
        const results = await searchByEntities(query, workspaceId, topK);
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Entity search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
        return { results: [], latency: Date.now() - start, success: false };
      }
    })(),

    // Path 3: Cluster context search (skip if no clusters)
    hasClusters
      ? (async () => {
          try {
            return await searchClusters(workspaceId, indexName, namespaceName, queryVector, 3);
          } catch (error) {
            log.error("Cluster search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
            return EMPTY_CLUSTER_RESULT;
          }
        })()
      : Promise.resolve(EMPTY_CLUSTER_RESULT),

    // Path 4: Actor profile search (skip if no actors)
    hasActors
      ? (async () => {
          try {
            return await searchActorProfiles(workspaceId, query, 5);
          } catch (error) {
            log.error("Actor search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
            return EMPTY_ACTOR_RESULT;
          }
        })()
      : Promise.resolve(EMPTY_ACTOR_RESULT),
  ]);

  log.info("4-path parallel search complete", {
    requestId,
    totalLatency: Date.now() - parallelStart,
    vectorMatches: vectorResults.results.matches.length,
    entityMatches: entityResults.results.length,
    clusterMatches: clusterResults.results.length,
    actorMatches: actorResults.results.length,
    // Add skip indicators for observability
    clusterSkipped: !hasClusters,
    actorSkipped: !hasActors,
  });

  // 4. Normalize vector IDs to observation IDs
  const normalizeStart = Date.now();
  const normalizedVectorResults = await normalizeVectorIds(
    workspaceId,
    vectorResults.results.matches,
    requestId
  );
  const normalizeLatency = Date.now() - normalizeStart;

  log.info("4-path search normalized", {
    requestId,
    inputVectorCount: vectorResults.results.matches.length,
    outputObsCount: normalizedVectorResults.length,
    normalizeLatency,
  });

  // 5. Merge normalized vector and entity results
  const mergedCandidates = mergeSearchResults(
    normalizedVectorResults,
    entityResults.results,
    topK
  );

  return {
    candidates: mergedCandidates,
    clusters: clusterResults.results.map((c) => ({
      topicLabel: c.topicLabel,
      summary: c.summary,
      keywords: c.keywords,
      score: c.score,
    })),
    actors: actorResults.results.map((a) => ({
      displayName: a.displayName,
      expertiseDomains: a.expertiseDomains,
      score: a.score,
    })),
    latency: {
      embedding: embedLatency,
      vector: vectorResults.latency,
      entity: entityResults.latency,
      cluster: clusterResults.latency,
      actor: actorResults.latency,
      normalize: normalizeLatency,
      total: Date.now() - startTime,
    },
    total: vectorResults.results.matches.length + entityResults.results.length,
    paths: {
      vector: vectorResults.success,
      entity: entityResults.success,
      cluster: clusterResults.results.length > 0,
      actor: actorResults.results.length > 0,
    },
  };
}

// ============================================================================
// RESULT ENRICHMENT
// ============================================================================

export interface EnrichedResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: string;
  type: string;
  occurredAt: string | null;
  entities: { key: string; category: string }[];
}

/**
 * Enrich reranked results with full metadata from database
 *
 * Fetches observation details and associated entities to provide
 * complete result data for the API response.
 *
 * Optimizations:
 * - Parallel queries with Promise.all (vs sequential)
 * - Skips content column (uses candidate snippet from Pinecone instead)
 */
export async function enrichSearchResults(
  results: { id: string; score: number }[],
  candidates: FilterCandidate[],
  workspaceId: string
): Promise<EnrichedResult[]> {
  if (results.length === 0) {
    return [];
  }

  const resultIds = results.map((r) => r.id);

  // Build candidate map for O(1) lookup (used for snippets)
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  // Fetch observations first, then entities using internal IDs
  // Query by externalId since resultIds contains nanoid strings
  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      externalId: workspaceNeuralObservations.externalId,
      title: workspaceNeuralObservations.title,
      source: workspaceNeuralObservations.source,
      observationType: workspaceNeuralObservations.observationType,
      occurredAt: workspaceNeuralObservations.occurredAt,
      metadata: workspaceNeuralObservations.metadata,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.externalId, resultIds)
      )
    );

  // Get internal IDs for entity query
  const internalObsIds = observations.map((o) => o.id);

  // Query entities using internal BIGINT IDs
  const entities = internalObsIds.length > 0
    ? await db
        .select({
          observationId: workspaceNeuralEntities.sourceObservationId,
          key: workspaceNeuralEntities.key,
          category: workspaceNeuralEntities.category,
        })
        .from(workspaceNeuralEntities)
        .where(
          and(
            eq(workspaceNeuralEntities.workspaceId, workspaceId),
            inArray(workspaceNeuralEntities.sourceObservationId, internalObsIds)
          )
        )
    : [];

  // Build internal ID to externalId map for entity grouping
  const internalToExternalMap = new Map(observations.map((o) => [o.id, o.externalId]));

  // Group entities by externalId (for result matching)
  const entityMap = new Map<string, { key: string; category: string }[]>();
  for (const entity of entities) {
    if (entity.observationId !== null) {
      const externalId = internalToExternalMap.get(entity.observationId);
      if (externalId) {
        const existing = entityMap.get(externalId) ?? [];
        existing.push({ key: entity.key, category: entity.category });
        entityMap.set(externalId, existing);
      }
    }
  }

  // Build observation map keyed by externalId (nanoid) for lookup
  const observationMap = new Map(observations.map((o) => [o.externalId, o]));

  // Map results with enrichment
  return results.map((r) => {
    const obs = observationMap.get(r.id);
    const candidate = candidateMap.get(r.id);

    // Extract URL from metadata if available
    const metadata = obs?.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    const url = typeof metadataUrl === "string" ? metadataUrl : "";

    // Use candidate snippet from Pinecone (already computed during indexing)
    const snippet = candidate?.snippet ?? "";

    return {
      id: r.id,
      title: obs?.title ?? candidate?.title ?? "",
      url,
      snippet,
      score: r.score,
      source: obs?.source ?? "unknown",
      type: obs?.observationType ?? "unknown",
      occurredAt: obs?.occurredAt ?? null,
      entities: entityMap.get(r.id) ?? [],
    };
  });
}
