---
title: "Phase 9: Retrieval Governor"
description: 2-key retrieval with LLM gating, parallel retrieval paths, fusion scoring
status: not_started
phase: 9
parent: "./README.md"
depends_on: ["./phase-07-basic-retrieval.md", "./phase-08-clusters-profiles.md"]
blocks: ["./phase-10-temporal-polish.md"]
---

# Phase 9: Retrieval Governor

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Implement the full 2-key Retrieval Governor: vector search (Key 1) for high recall, followed by LLM relevance filtering (Key 2) for high precision. Add parallel retrieval paths for clusters, entities, and actor profiles.

## Prerequisites

- [ ] Phase 7 (Basic Retrieval) completed
- [ ] Phase 8 (Clusters & Profiles) completed
- [ ] Clusters and profiles populated with data

## Changes Required

### 1. Create Retrieval Governor Service

**File**: `api/console/src/services/neural-retrieval-governor.ts`
**Action**: Create

```typescript
import { eq, and, or, ilike, desc, sql, inArray } from "drizzle-orm";
import { db } from "@db/console";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceObservationClusters,
  workspaceActorProfiles,
} from "@db/console/schema";
import { createEmbeddingProviderForStore } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { log } from "@repo/logger";

// Types
interface GovernorOptions {
  topK: number;
  minConfidence: number;
  includeEntities: boolean;
  includeClusters: boolean;
  includeActors: boolean;
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorIds?: string[];
    dateRange?: {
      start?: Date;
      end?: Date;
    };
  };
}

interface ScoredObservation {
  id: string;
  title: string;
  content: string;
  type: string;
  sourceType: string;
  actorId: string | null;
  actorName: string | null;
  occurredAt: Date;
  vectorScore: number;
  relevanceScore: number;
  finalScore: number;
  filterReason?: string;
  topics: string[];
}

interface ClusterContext {
  id: string;
  topicLabel: string;
  summary: string | null;
  observationCount: number;
  relevanceScore: number;
}

interface ActorMatch {
  actorId: string;
  displayName: string;
  expertiseDomains: Record<string, number>;
  relevanceScore: number;
}

interface GovernorResult {
  observations: ScoredObservation[];
  entities: Array<{
    id: string;
    category: string;
    key: string;
    value: string;
    confidence: number;
  }>;
  clusters: ClusterContext[];
  actorMatches: ActorMatch[];
  metrics: {
    key1Candidates: number;
    key2Filtered: number;
    entityMatches: number;
    clusterMatches: number;
    actorMatches: number;
    latencyMs: number;
  };
}

/**
 * Retrieval Governor: 2-key retrieval with parallel paths
 */
export async function retrievalGovernor(
  workspaceId: string,
  storeId: string,
  query: string,
  queryEmbedding: number[],
  options: GovernorOptions
): Promise<GovernorResult> {
  const startTime = Date.now();

  // PARALLEL EXECUTION: 4 independent retrieval paths
  const [vectorCandidates, entityMatches, clusterMatches, actorMatches] =
    await Promise.all([
      // Path 1: Vector search (Key 1) - High recall
      searchObservationVectors(workspaceId, queryEmbedding, {
        topK: options.topK * 3, // Fetch more for LLM filtering
        filters: options.filters,
      }),

      // Path 2: Entity exact-match lookup
      options.includeEntities
        ? searchEntityStore(workspaceId, query)
        : Promise.resolve([]),

      // Path 3: Cluster context retrieval
      options.includeClusters
        ? findRelevantClusters(workspaceId, query, queryEmbedding)
        : Promise.resolve([]),

      // Path 4: Actor profile matching
      options.includeActors
        ? matchActorProfiles(workspaceId, query, queryEmbedding)
        : Promise.resolve([]),
    ]);

  // KEY 2: LLM Gating - Filter vector candidates for relevance
  const filteredObservations = await llmRelevanceFilter(
    query,
    vectorCandidates,
    {
      maxCandidates: options.topK * 2,
      minConfidence: options.minConfidence,
    }
  );

  // Take top K after filtering
  const finalObservations = filteredObservations.slice(0, options.topK);

  const latencyMs = Date.now() - startTime;

  log.info("Retrieval Governor completed", {
    workspaceId,
    query: query.slice(0, 50),
    key1Candidates: vectorCandidates.length,
    key2Filtered: filteredObservations.length,
    finalCount: finalObservations.length,
    latencyMs,
  });

  return {
    observations: finalObservations,
    entities: entityMatches,
    clusters: clusterMatches,
    actorMatches,
    metrics: {
      key1Candidates: vectorCandidates.length,
      key2Filtered: filteredObservations.length,
      entityMatches: entityMatches.length,
      clusterMatches: clusterMatches.length,
      actorMatches: actorMatches.length,
      latencyMs,
    },
  };
}

/**
 * Key 1: Vector search for observations
 */
async function searchObservationVectors(
  workspaceId: string,
  queryEmbedding: number[],
  options: {
    topK: number;
    filters?: GovernorOptions["filters"];
  }
): Promise<ScoredObservation[]> {
  const namespace = `${workspaceId}/neural/observations`;

  // Build Pinecone filter
  const filter: Record<string, unknown> = {
    workspaceId: { $eq: workspaceId },
  };

  if (options.filters?.sourceTypes?.length) {
    filter.sourceType = { $in: options.filters.sourceTypes };
  }

  if (options.filters?.observationTypes?.length) {
    filter.type = { $in: options.filters.observationTypes };
  }

  if (options.filters?.actorIds?.length) {
    filter.actorId = { $in: options.filters.actorIds };
  }

  const results = await pineconeClient.queryVectors(
    "default",
    {
      vector: queryEmbedding,
      topK: options.topK,
      filter,
      includeMetadata: true,
    },
    namespace
  );

  // Map to scored observations
  return results.matches.map((match) => ({
    id: (match.metadata?.observationId as string) ?? match.id,
    title: (match.metadata?.title as string) ?? "",
    content: (match.metadata?.snippet as string) ?? "",
    type: (match.metadata?.type as string) ?? "",
    sourceType: (match.metadata?.sourceType as string) ?? "",
    actorId: (match.metadata?.actorId as string) ?? null,
    actorName: (match.metadata?.actorName as string) ?? null,
    occurredAt: new Date((match.metadata?.occurredAt as string) ?? Date.now()),
    vectorScore: match.score ?? 0,
    relevanceScore: 0, // Will be set by LLM filter
    finalScore: 0,
    topics: (match.metadata?.topics as string[]) ?? [],
  }));
}

/**
 * Key 2: LLM relevance filtering
 */
async function llmRelevanceFilter(
  query: string,
  candidates: ScoredObservation[],
  options: { maxCandidates: number; minConfidence: number }
): Promise<ScoredObservation[]> {
  // Skip LLM if few candidates (all likely relevant)
  if (candidates.length <= 5) {
    return candidates.map((c) => ({
      ...c,
      relevanceScore: c.vectorScore,
      finalScore: c.vectorScore,
      filterReason: "passthrough",
    }));
  }

  // Prepare candidate summaries for LLM
  const candidateSummaries = candidates
    .slice(0, options.maxCandidates)
    .map((c, idx) => ({
      idx,
      title: c.title.slice(0, 100),
      snippet: c.content.slice(0, 200),
      type: c.type,
      sourceType: c.sourceType,
      actor: c.actorName,
    }));

  try {
    // LLM relevance scoring
    const { object: ratings } = await generateObject({
      model: anthropic("claude-3-5-haiku-20241022"),
      schema: z.object({
        ratings: z.array(
          z.object({
            idx: z.number(),
            relevance: z.number().min(0).max(1),
            reason: z.string().max(50),
          })
        ),
      }),
      system: `You are a relevance filter for an engineering knowledge system.
Rate each candidate's relevance to the query from 0.0 to 1.0.

Consider:
- Direct semantic match to query
- Indirect relevance (context, background info)
- Temporal relevance if query implies time
- Actor relevance if query mentions people

Be strict: only rate >0.6 if genuinely relevant.`,
      prompt: `Query: "${query}"

Candidates:
${JSON.stringify(candidateSummaries, null, 2)}

Rate each candidate's relevance.`,
      maxTokens: 1000,
    });

    // Merge LLM ratings with candidates
    const ratingMap = new Map(ratings.ratings.map((r) => [r.idx, r]));

    return candidates
      .map((c, idx) => {
        const rating = ratingMap.get(idx);
        const relevanceScore = rating?.relevance ?? 0;
        // Combined score: 60% LLM relevance, 40% vector similarity
        const finalScore = relevanceScore * 0.6 + c.vectorScore * 0.4;

        return {
          ...c,
          relevanceScore,
          finalScore,
          filterReason: rating?.reason,
        };
      })
      .filter((c) => c.relevanceScore >= options.minConfidence)
      .sort((a, b) => b.finalScore - a.finalScore);
  } catch (error) {
    log.error("LLM relevance filter failed, falling back to vector scores", {
      error,
    });

    // Fallback to vector scores only
    return candidates.map((c) => ({
      ...c,
      relevanceScore: c.vectorScore,
      finalScore: c.vectorScore,
      filterReason: "fallback",
    }));
  }
}

/**
 * Entity exact-match search
 */
async function searchEntityStore(
  workspaceId: string,
  query: string
): Promise<GovernorResult["entities"]> {
  // Extract potential entity references from query
  const queryLower = query.toLowerCase();

  const results = await db
    .select()
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        or(
          ilike(workspaceNeuralEntities.key, `%${query}%`),
          ilike(workspaceNeuralEntities.value, `%${query}%`)
        )
      )
    )
    .orderBy(desc(workspaceNeuralEntities.occurrenceCount))
    .limit(10);

  return results.map((e) => ({
    id: e.id,
    category: e.category,
    key: e.key,
    value: e.value,
    confidence: parseFloat(e.confidence ?? "0.8"),
  }));
}

/**
 * Find relevant clusters
 */
async function findRelevantClusters(
  workspaceId: string,
  query: string,
  queryEmbedding: number[]
): Promise<ClusterContext[]> {
  // Vector search on cluster embeddings
  const namespace = `${workspaceId}/neural/clusters`;

  const results = await pineconeClient.queryVectors(
    "default",
    {
      vector: queryEmbedding,
      topK: 5,
      filter: { workspaceId: { $eq: workspaceId } },
      includeMetadata: true,
    },
    namespace
  );

  if (results.matches.length === 0) {
    return [];
  }

  // Hydrate from database
  const clusterIds = results.matches
    .map((m) => m.metadata?.clusterId as string)
    .filter(Boolean);

  if (clusterIds.length === 0) {
    return [];
  }

  const clusters = await db
    .select()
    .from(workspaceObservationClusters)
    .where(
      and(
        eq(workspaceObservationClusters.workspaceId, workspaceId),
        inArray(workspaceObservationClusters.id, clusterIds)
      )
    );

  // Merge with vector scores
  const scoreMap = new Map(
    results.matches.map((m) => [m.metadata?.clusterId, m.score ?? 0])
  );

  return clusters.map((c) => ({
    id: c.id,
    topicLabel: c.topicLabel,
    summary: c.summary,
    observationCount: parseInt(c.observationCount ?? "0", 10),
    relevanceScore: scoreMap.get(c.id) ?? 0,
  }));
}

/**
 * Match actor profiles
 */
async function matchActorProfiles(
  workspaceId: string,
  query: string,
  queryEmbedding: number[]
): Promise<ActorMatch[]> {
  // Vector search on profile embeddings
  const namespace = `${workspaceId}/neural/profiles`;

  const results = await pineconeClient.queryVectors(
    "default",
    {
      vector: queryEmbedding,
      topK: 5,
      filter: { workspaceId: { $eq: workspaceId } },
      includeMetadata: true,
    },
    namespace
  );

  if (results.matches.length === 0) {
    return [];
  }

  // Hydrate from database
  const actorIds = results.matches
    .map((m) => m.metadata?.actorId as string)
    .filter(Boolean);

  if (actorIds.length === 0) {
    return [];
  }

  const profiles = await db
    .select()
    .from(workspaceActorProfiles)
    .where(
      and(
        eq(workspaceActorProfiles.workspaceId, workspaceId),
        inArray(workspaceActorProfiles.actorId, actorIds)
      )
    );

  // Merge with vector scores
  const scoreMap = new Map(
    results.matches.map((m) => [m.metadata?.actorId, m.score ?? 0])
  );

  return profiles.map((p) => ({
    actorId: p.actorId,
    displayName: p.displayName,
    expertiseDomains: (p.expertiseDomains as Record<string, number>) ?? {},
    relevanceScore: scoreMap.get(p.actorId) ?? 0,
  }));
}
```

**Why**: Full 2-key retrieval with LLM gating for high precision.

### 2. Update Neural Search Router to Use Governor

**File**: `api/console/src/router/org/neural-search.ts`
**Action**: Modify

Add a new `governorSearch` procedure:

```typescript
import { retrievalGovernor } from "../../services/neural-retrieval-governor";

// Add to the router:
governorSearch: orgProcedure
  .input(
    z.object({
      workspaceId: z.string(),
      query: z.string().min(1).max(1000),
      topK: z.number().min(1).max(50).default(10),
      minConfidence: z.number().min(0).max(1).default(0.6),
      includeEntities: z.boolean().default(true),
      includeClusters: z.boolean().default(true),
      includeActors: z.boolean().default(true),
      filters: z
        .object({
          sourceTypes: z.array(z.string()).optional(),
          observationTypes: z.array(z.string()).optional(),
          actorIds: z.array(z.string()).optional(),
        })
        .optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const {
      workspaceId,
      query,
      topK,
      minConfidence,
      includeEntities,
      includeClusters,
      includeActors,
      filters,
    } = input;

    if (ctx.workspace.id !== workspaceId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Workspace access denied",
      });
    }

    // Get store for embedding config
    const store = await db.query.workspaceStores.findFirst({
      where: and(
        eq(workspaceStores.workspaceId, workspaceId),
        eq(workspaceStores.slug, "default")
      ),
    });

    if (!store) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Default store not found",
      });
    }

    // Generate query embedding
    const embeddingProvider = createEmbeddingProviderForStore(
      {
        id: store.id,
        embeddingModel: store.embeddingModel ?? "text-embedding-3-small",
        embeddingDim: store.embeddingDim ?? 1536,
      },
      { inputType: "search_query" }
    );

    const queryEmbedding = await embeddingProvider.embed([query]);

    // Call retrieval governor
    const result = await retrievalGovernor(
      workspaceId,
      store.id,
      query,
      queryEmbedding.embeddings[0]!,
      {
        topK,
        minConfidence,
        includeEntities,
        includeClusters,
        includeActors,
        filters,
      }
    );

    return {
      observations: result.observations.map((obs) => ({
        id: obs.id,
        title: obs.title,
        content: obs.content,
        type: obs.type,
        sourceType: obs.sourceType,
        actorName: obs.actorName,
        occurredAt: obs.occurredAt.toISOString(),
        vectorScore: obs.vectorScore,
        relevanceScore: obs.relevanceScore,
        finalScore: obs.finalScore,
        filterReason: obs.filterReason,
        topics: obs.topics,
      })),
      entities: result.entities,
      clusters: result.clusters.map((c) => ({
        id: c.id,
        topicLabel: c.topicLabel,
        summary: c.summary,
        observationCount: c.observationCount,
        relevanceScore: c.relevanceScore,
      })),
      actors: result.actorMatches.map((a) => ({
        actorId: a.actorId,
        displayName: a.displayName,
        topExpertise: Object.entries(a.expertiseDomains)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([domain, score]) => ({ domain, score })),
        relevanceScore: a.relevanceScore,
      })),
      query,
      metrics: result.metrics,
    };
  }),
```

**Why**: Expose governor through tRPC API.

## Database Changes

No new migrations - uses existing tables.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

### Manual Verification:
- [ ] Call `governorSearch` with a specific query
- [ ] Verify Key 1 (vector) returns more candidates than Key 2 (filtered)
- [ ] Verify `relevanceScore` differs from `vectorScore` (LLM is filtering)
- [ ] Verify low-relevance results are filtered out
- [ ] Verify clusters returned when `includeClusters: true`
- [ ] Verify actors returned when `includeActors: true`
- [ ] Check metrics show reasonable latency (<500ms for hybrid search)

### Quality Verification:
- [ ] Query "who worked on authentication" returns relevant actor matches
- [ ] Query "deployment failures" returns Sentry + Vercel observations
- [ ] Query "recent changes to API" filters out unrelated PRs

## Rollback Plan

1. Remove governor service file
2. Keep basic search endpoint (from Phase 7) as fallback
3. Remove `governorSearch` procedure from router

---

**CHECKPOINT**: After completing this phase, high-precision retrieval is available via 2-key filtering.

---

**Previous Phases**:
- [Phase 7: Basic Retrieval](./phase-07-basic-retrieval.md)
- [Phase 8: Clusters & Profiles](./phase-08-clusters-profiles.md)
**Next Phase**: [Phase 10: Temporal & Polish](./phase-10-temporal-polish.md)
