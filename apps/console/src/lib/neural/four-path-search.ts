/**
 * Three-Path Parallel Search
 *
 * Executes parallel retrieval across:
 * 1. Vector similarity (Pinecone)
 * 2. Entity search (pattern matching)
 * 3. Actor profiles (contributor relevance)
 *
 * Extracted from internal search route for reuse in public API.
 */

import { db } from "@db/console/client";
import {
  workspaceEntityObservations,
  workspaceNeuralEntities,
  workspaceNeuralObservations,
  workspaceObservationInterpretations,
} from "@db/console/schema";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import type { VectorMetadata } from "@repo/console-pinecone";
import { pineconeClient } from "@repo/console-pinecone";
import type { EntitySearchResult } from "@repo/console-validation";
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
import { log } from "@vendor/observability/log";
import { and, eq, inArray, or } from "drizzle-orm";
import { searchByEntities } from "./entity-search";
import type { FilterCandidate } from "./llm-filter";

// ============================================================================
// VECTOR ID NORMALIZATION
// ============================================================================

/**
 * Information about which embedding views matched for an observation
 */
interface ViewMatch {
  score: number;
  vectorId: string;
  view: "title" | "content" | "summary" | "legacy";
}

/**
 * Normalized vector result with observation ID
 */
interface NormalizedVectorResult {
  matchedViews: ViewMatch[];
  metadata?: VectorMetadata;
  observationId: string;
  score: number;
}

/**
 * Extract view type from vector ID prefix
 */
function getViewFromVectorId(
  vectorId: string
): "title" | "content" | "summary" | "legacy" {
  if (vectorId.startsWith("obs_title_")) {
    return "title";
  }
  if (vectorId.startsWith("obs_content_")) {
    return "content";
  }
  if (vectorId.startsWith("obs_summary_")) {
    return "summary";
  }
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
  if (vectorMatches.length === 0) {
    return [];
  }

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
  const obsGroups = new Map<
    string,
    {
      matches: ViewMatch[];
      metadata?: VectorMetadata;
    }
  >();

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

  // For legacy vectors without observationId, fall back to interpretation table lookup
  if (withoutObsId.length > 0) {
    const vectorIds = withoutObsId.map((m) => m.id);

    // Query interpretation table for embedding IDs
    const interpretations = await db
      .select({
        observationId: workspaceObservationInterpretations.observationId,
        embeddingTitleId: workspaceObservationInterpretations.embeddingTitleId,
        embeddingContentId:
          workspaceObservationInterpretations.embeddingContentId,
        embeddingSummaryId:
          workspaceObservationInterpretations.embeddingSummaryId,
      })
      .from(workspaceObservationInterpretations)
      .where(
        and(
          eq(workspaceObservationInterpretations.workspaceId, workspaceId),
          or(
            inArray(
              workspaceObservationInterpretations.embeddingTitleId,
              vectorIds
            ),
            inArray(
              workspaceObservationInterpretations.embeddingContentId,
              vectorIds
            ),
            inArray(
              workspaceObservationInterpretations.embeddingSummaryId,
              vectorIds
            )
          )
        )
      );

    // Resolve internal observation IDs to externalIds (nanoid)
    const obsInternalIds = [
      ...new Set(interpretations.map((i) => i.observationId)),
    ];
    const obsRows =
      obsInternalIds.length > 0
        ? await db
            .select({
              id: workspaceNeuralObservations.id,
              externalId: workspaceNeuralObservations.externalId,
            })
            .from(workspaceNeuralObservations)
            .where(inArray(workspaceNeuralObservations.id, obsInternalIds))
        : [];
    const internalToExternal = new Map(
      obsRows.map((o) => [o.id, o.externalId])
    );

    // Build vector ID → observation mapping
    const vectorToObs = new Map<
      string,
      { id: string; view: "title" | "content" | "summary" | "legacy" }
    >();
    for (const interp of interpretations) {
      const externalId = internalToExternal.get(interp.observationId);
      if (!externalId) {
        continue;
      }
      if (interp.embeddingTitleId) {
        vectorToObs.set(interp.embeddingTitleId, {
          id: externalId,
          view: "title",
        });
      }
      if (interp.embeddingContentId) {
        vectorToObs.set(interp.embeddingContentId, {
          id: externalId,
          view: "content",
        });
      }
      if (interp.embeddingSummaryId) {
        vectorToObs.set(interp.embeddingSummaryId, {
          id: externalId,
          view: "summary",
        });
      }
    }

    // Add legacy matches to obsGroups
    for (const match of withoutObsId) {
      const obs = vectorToObs.get(match.id);
      if (!obs) {
        log.warn("Vector ID not found in database", {
          vectorId: match.id,
          requestId,
        });
        continue;
      }

      const existing = obsGroups.get(obs.id);
      if (existing) {
        existing.matches.push({
          view: obs.view,
          score: match.score,
          vectorId: match.id,
        });
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
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
  query: string;
  requestId?: string;
  topK: number;
  workspaceId: string;
}

export interface FourPathSearchResult {
  /** Merged candidates ready for reranking */
  candidates: FilterCandidate[];
  /** Latency breakdown */
  latency: {
    embedding: number;
    vector: number;
    entity: number;
    normalize: number;
    total: number;
  };
  /** Search paths status */
  paths: {
    vector: boolean;
    entity: boolean;
  };
  /** Total candidates before dedup */
  total: number;
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
      if (entity.observationTitle) {
        existing.title = entity.observationTitle;
      }
      if (entity.observationSnippet) {
        existing.snippet = entity.observationSnippet;
      }
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
    throw new Error(
      `Workspace not found or not configured for search: ${workspaceId}`
    );
  }

  const { indexName, namespaceName, embeddingModel, embeddingDim } = workspace;

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

  // 3. Execute 2-path parallel retrieval
  const pineconeFilter = buildPineconeFilter(filters);
  const parallelStart = Date.now();

  const [vectorResults, entityResults] = await Promise.all([
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
        log.error("Vector search failed", {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          results: { matches: [] },
          latency: Date.now() - start,
          success: false,
        };
      }
    })(),

    // Path 2: Entity search (always execute - fast pattern matching)
    (async () => {
      const start = Date.now();
      try {
        const results = await searchByEntities(query, workspaceId, topK);
        return { results, latency: Date.now() - start, success: true };
      } catch (error) {
        log.error("Entity search failed", {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { results: [], latency: Date.now() - start, success: false };
      }
    })(),
  ]);

  log.info("2-path parallel search complete", {
    requestId,
    totalLatency: Date.now() - parallelStart,
    vectorMatches: vectorResults.results.matches.length,
    entityMatches: entityResults.results.length,
  });

  // 4. Normalize vector IDs to observation IDs
  const normalizeStart = Date.now();
  const normalizedVectorResults = await normalizeVectorIds(
    workspaceId,
    vectorResults.results.matches,
    requestId
  );
  const normalizeLatency = Date.now() - normalizeStart;

  log.info("2-path search normalized", {
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
    latency: {
      embedding: embedLatency,
      vector: vectorResults.latency,
      entity: entityResults.latency,
      normalize: normalizeLatency,
      total: Date.now() - startTime,
    },
    total: vectorResults.results.matches.length + entityResults.results.length,
    paths: {
      vector: vectorResults.success,
      entity: entityResults.success,
    },
  };
}

// ============================================================================
// RESULT ENRICHMENT
// ============================================================================

export interface EnrichedResult {
  entities: { key: string; category: string }[];
  id: string;
  occurredAt: string | null;
  references: { type: string; id: string; url?: string; label?: string }[];
  score: number;
  snippet: string;
  source: string;
  title: string;
  type: string;
  url: string;
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
      sourceReferences: workspaceNeuralObservations.sourceReferences,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.externalId, resultIds)
      )
    );

  // Get internal IDs for junction + entity query
  const internalObsIds = observations.map((o) => o.id);
  const internalToExternalMap = new Map(
    observations.map((o) => [o.id, o.externalId])
  );

  // Query junction table for entity IDs per observation
  const junctions =
    internalObsIds.length > 0
      ? await db
          .select({
            observationId: workspaceEntityObservations.observationId,
            entityId: workspaceEntityObservations.entityId,
          })
          .from(workspaceEntityObservations)
          .where(
            inArray(workspaceEntityObservations.observationId, internalObsIds)
          )
      : [];

  // Fetch entity details
  const junctionEntityIds = [...new Set(junctions.map((j) => j.entityId))];
  const entityRows =
    junctionEntityIds.length > 0
      ? await db
          .select({
            id: workspaceNeuralEntities.id,
            key: workspaceNeuralEntities.key,
            category: workspaceNeuralEntities.category,
          })
          .from(workspaceNeuralEntities)
          .where(inArray(workspaceNeuralEntities.id, junctionEntityIds))
      : [];

  const entityDetailsMap = new Map(entityRows.map((e) => [e.id, e]));

  // Group entities by externalId (for result matching)
  const entityMap = new Map<string, { key: string; category: string }[]>();
  for (const junction of junctions) {
    const externalId = internalToExternalMap.get(junction.observationId);
    const entityDetail = entityDetailsMap.get(junction.entityId);
    if (externalId && entityDetail) {
      const existing = entityMap.get(externalId) ?? [];
      existing.push({ key: entityDetail.key, category: entityDetail.category });
      entityMap.set(externalId, existing);
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

    // Extract references from sourceReferences (typed as JSONB array)
    const rawRefs = obs?.sourceReferences as
      | { type: string; id: string; url?: string; label?: string }[]
      | null;
    const references = rawRefs ?? [];

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
      references,
    };
  });
}
