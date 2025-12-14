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
import { orgWorkspaces, workspaceNeuralObservations, workspaceNeuralEntities } from "@db/console/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import type { FilterCandidate } from "./llm-filter";
import { searchByEntities } from "./entity-search";
import { searchClusters } from "./cluster-search";
import { searchActorProfiles } from "./actor-search";
import type { EntitySearchResult } from "@repo/console-types";

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
 * Merge vector search results with entity-matched results
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

  // 1. Look up workspace configuration
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  if (!workspace.indexName || !workspace.namespaceName) {
    throw new Error(`Workspace not configured for search: ${workspaceId}`);
  }

  const indexName = workspace.indexName;
  const namespaceName = workspace.namespaceName;

  // 2. Generate query embedding
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
    throw new Error("Failed to generate query embedding");
  }

  // 3. Execute 4-path parallel retrieval
  const pineconeFilter = buildPineconeFilter(filters);
  const parallelStart = Date.now();

  const [vectorResults, entityResults, clusterResults, actorResults] = await Promise.all([
    // Path 1: Vector similarity search
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

    // Path 2: Entity search
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

    // Path 3: Cluster context search
    (async () => {
      try {
        return await searchClusters(workspaceId, indexName, namespaceName, queryVector, 3);
      } catch (error) {
        log.error("Cluster search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
        return { results: [], latency: 0 };
      }
    })(),

    // Path 4: Actor profile search
    (async () => {
      try {
        return await searchActorProfiles(workspaceId, query, 5);
      } catch (error) {
        log.error("Actor search failed", { requestId, error: error instanceof Error ? error.message : String(error) });
        return { results: [], latency: 0 };
      }
    })(),
  ]);

  log.info("4-path parallel search complete", {
    requestId,
    totalLatency: Date.now() - parallelStart,
    vectorMatches: vectorResults.results.matches.length,
    entityMatches: entityResults.results.length,
    clusterMatches: clusterResults.results.length,
    actorMatches: actorResults.results.length,
  });

  // 4. Merge vector and entity results
  const mergedCandidates = mergeSearchResults(
    vectorResults.results.matches,
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

  // Fetch observations and entities in parallel
  const [observations, entities] = await Promise.all([
    // Observations query - skip content column, use candidate snippet instead
    db
      .select({
        id: workspaceNeuralObservations.id,
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
          inArray(workspaceNeuralObservations.id, resultIds)
        )
      ),

    // Entities query
    db
      .select({
        observationId: workspaceNeuralEntities.sourceObservationId,
        key: workspaceNeuralEntities.key,
        category: workspaceNeuralEntities.category,
      })
      .from(workspaceNeuralEntities)
      .where(
        and(
          eq(workspaceNeuralEntities.workspaceId, workspaceId),
          inArray(workspaceNeuralEntities.sourceObservationId, resultIds)
        )
      ),
  ]);

  // Group entities by observation
  const entityMap = new Map<string, { key: string; category: string }[]>();
  for (const entity of entities) {
    if (entity.observationId) {
      const existing = entityMap.get(entity.observationId) ?? [];
      existing.push({ key: entity.key, category: entity.category });
      entityMap.set(entity.observationId, existing);
    }
  }

  // Build observation map
  const observationMap = new Map(observations.map((o) => [o.id, o]));

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
