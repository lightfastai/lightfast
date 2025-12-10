---
title: "Phase 7: Basic Retrieval"
description: Vector search on observations, entity lookup, simple retrieval endpoint
status: not_started
phase: 7
parent: "./README.md"
depends_on: ["./phase-06-embedding-storage.md"]
blocks: ["./phase-08-clusters-profiles.md", "./phase-09-retrieval-governor.md"]
---

# Phase 7: Basic Retrieval

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Create a basic retrieval endpoint that searches observations via vector similarity and entity exact-match. This provides testable retrieval before implementing the full 2-key Retrieval Governor in Phase 9.

## Prerequisites

- [ ] Phase 6 completed and verified
- [ ] Observations with embeddings in Pinecone
- [ ] Entities extracted and stored in database

## Changes Required

### 1. Create Neural Search tRPC Router

**File**: `api/console/src/router/org/neural-search.ts`
**Action**: Create

```typescript
import { z } from "zod";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { createTRPCRouter, orgProcedure } from "../../trpc";
import { db } from "@db/console";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceStores,
} from "@db/console/schema";
import { createEmbeddingProviderForStore } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import { log } from "@repo/logger";

// Input schema for neural search
const neuralSearchInputSchema = z.object({
  workspaceId: z.string(),
  query: z.string().min(1).max(1000),
  topK: z.number().min(1).max(50).default(10),
  filters: z
    .object({
      sourceTypes: z.array(z.string()).optional(),
      observationTypes: z.array(z.string()).optional(),
      actorIds: z.array(z.string()).optional(),
      dateRange: z
        .object({
          start: z.string().datetime().optional(),
          end: z.string().datetime().optional(),
        })
        .optional(),
    })
    .optional(),
  includeEntities: z.boolean().default(true),
});

// Output types
interface ObservationResult {
  id: string;
  title: string;
  content: string;
  type: string;
  sourceType: string;
  actorName: string | null;
  occurredAt: string;
  significanceScore: number;
  vectorScore: number;
  topics: string[];
  sourceId: string;
}

interface EntityResult {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  occurrenceCount: number;
}

interface NeuralSearchResult {
  observations: ObservationResult[];
  entities: EntityResult[];
  query: string;
  metrics: {
    vectorSearchMs: number;
    entitySearchMs: number;
    totalMs: number;
    observationCount: number;
    entityCount: number;
  };
}

export const neuralSearchRouter = createTRPCRouter({
  /**
   * Search neural observations and entities
   */
  search: orgProcedure
    .input(neuralSearchInputSchema)
    .query(async ({ ctx, input }): Promise<NeuralSearchResult> => {
      const startTime = Date.now();
      const { workspaceId, query, topK, filters, includeEntities } = input;

      // Verify workspace access
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
      const vectorSearchStart = Date.now();

      // Search Pinecone
      const namespace = `${workspaceId}/neural/observations`;

      // Build Pinecone filter
      const pineconeFilter: Record<string, unknown> = {
        workspaceId: { $eq: workspaceId },
      };

      if (filters?.sourceTypes?.length) {
        pineconeFilter.sourceType = { $in: filters.sourceTypes };
      }

      if (filters?.observationTypes?.length) {
        pineconeFilter.type = { $in: filters.observationTypes };
      }

      if (filters?.actorIds?.length) {
        pineconeFilter.actorId = { $in: filters.actorIds };
      }

      const vectorResults = await pineconeClient.queryVectors(
        "default",
        {
          vector: queryEmbedding.embeddings[0]!,
          topK: topK * 2, // Fetch more for potential filtering
          filter: pineconeFilter,
          includeMetadata: true,
        },
        namespace
      );

      const vectorSearchMs = Date.now() - vectorSearchStart;

      // Hydrate observations from database
      const observationIds = vectorResults.matches
        .filter((m) => m.metadata?.observationId)
        .map((m) => m.metadata!.observationId as string);

      const observations: ObservationResult[] = [];

      if (observationIds.length > 0) {
        const dbObservations = await db
          .select()
          .from(workspaceNeuralObservations)
          .where(
            and(
              eq(workspaceNeuralObservations.workspaceId, workspaceId),
              sql`${workspaceNeuralObservations.id} = ANY(${observationIds})`
            )
          )
          .limit(topK);

        // Merge vector scores with DB results
        const scoreMap = new Map(
          vectorResults.matches.map((m) => [
            m.metadata?.observationId,
            m.score ?? 0,
          ])
        );

        for (const obs of dbObservations) {
          observations.push({
            id: obs.id,
            title: obs.title,
            content: obs.content,
            type: obs.observationType,
            sourceType: obs.sourceType,
            actorName: obs.actorName,
            occurredAt: obs.occurredAt.toISOString(),
            significanceScore: parseFloat(obs.significanceScore ?? "0"),
            vectorScore: scoreMap.get(obs.id) ?? 0,
            topics: (obs.topics as string[]) ?? [],
            sourceId: obs.sourceId,
          });
        }

        // Sort by vector score
        observations.sort((a, b) => b.vectorScore - a.vectorScore);
      }

      // Entity search
      const entitySearchStart = Date.now();
      const entities: EntityResult[] = [];

      if (includeEntities) {
        // Extract potential entity references from query
        const queryTerms = query.toLowerCase().split(/\s+/);

        const entityResults = await db
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

        for (const entity of entityResults) {
          entities.push({
            id: entity.id,
            category: entity.category,
            key: entity.key,
            value: entity.value,
            confidence: parseFloat(entity.confidence ?? "0.8"),
            occurrenceCount: parseInt(entity.occurrenceCount ?? "1", 10),
          });
        }
      }

      const entitySearchMs = Date.now() - entitySearchStart;
      const totalMs = Date.now() - startTime;

      log.info("Neural search completed", {
        workspaceId,
        query: query.slice(0, 50),
        observationCount: observations.length,
        entityCount: entities.length,
        totalMs,
      });

      return {
        observations,
        entities,
        query,
        metrics: {
          vectorSearchMs,
          entitySearchMs,
          totalMs,
          observationCount: observations.length,
          entityCount: entities.length,
        },
      };
    }),

  /**
   * Get recent observations (no search, just list)
   */
  recent: orgProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        sourceType: z.string().optional(),
        observationType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, limit, sourceType, observationType } = input;

      if (ctx.workspace.id !== workspaceId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Workspace access denied",
        });
      }

      const conditions = [eq(workspaceNeuralObservations.workspaceId, workspaceId)];

      if (sourceType) {
        conditions.push(eq(workspaceNeuralObservations.sourceType, sourceType));
      }

      if (observationType) {
        conditions.push(
          eq(workspaceNeuralObservations.observationType, observationType)
        );
      }

      const observations = await db
        .select()
        .from(workspaceNeuralObservations)
        .where(and(...conditions))
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
        .limit(limit);

      return {
        observations: observations.map((obs) => ({
          id: obs.id,
          title: obs.title,
          content: obs.content.slice(0, 500),
          type: obs.observationType,
          sourceType: obs.sourceType,
          actorName: obs.actorName,
          occurredAt: obs.occurredAt.toISOString(),
          significanceScore: parseFloat(obs.significanceScore ?? "0"),
          topics: (obs.topics as string[]) ?? [],
        })),
        count: observations.length,
      };
    }),

  /**
   * Get entity by key
   */
  getEntity: orgProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        category: z.string(),
        key: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, category, key } = input;

      if (ctx.workspace.id !== workspaceId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Workspace access denied",
        });
      }

      const entity = await db.query.workspaceNeuralEntities.findFirst({
        where: and(
          eq(workspaceNeuralEntities.workspaceId, workspaceId),
          eq(workspaceNeuralEntities.category, category),
          eq(workspaceNeuralEntities.key, key)
        ),
      });

      if (!entity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entity not found",
        });
      }

      // Get related observations
      const relatedObservations = await db
        .select()
        .from(workspaceNeuralObservations)
        .where(
          and(
            eq(workspaceNeuralObservations.workspaceId, workspaceId),
            sql`${workspaceNeuralObservations.content} ILIKE ${`%${key}%`}`
          )
        )
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
        .limit(10);

      return {
        entity: {
          id: entity.id,
          category: entity.category,
          key: entity.key,
          value: entity.value,
          aliases: entity.aliases as string[],
          confidence: parseFloat(entity.confidence ?? "0.8"),
          occurrenceCount: parseInt(entity.occurrenceCount ?? "1", 10),
          firstSeen: entity.extractedAt.toISOString(),
          lastSeen: entity.lastSeenAt.toISOString(),
        },
        relatedObservations: relatedObservations.map((obs) => ({
          id: obs.id,
          title: obs.title,
          type: obs.observationType,
          sourceType: obs.sourceType,
          occurredAt: obs.occurredAt.toISOString(),
        })),
      };
    }),
});
```

**Why**: tRPC router for neural search functionality.

### 2. Register Neural Search Router

**File**: `api/console/src/router/org/index.ts`
**Action**: Modify

Add import and registration:

```typescript
import { neuralSearchRouter } from "./neural-search";

export const orgRouter = createTRPCRouter({
  // ... existing routers
  neuralSearch: neuralSearchRouter,
});
```

**Why**: Make neural search available via tRPC.

### 3. Add Pinecone Query Method (if not exists)

**File**: `vendor/pinecone/src/client.ts`
**Action**: Verify or add

Ensure `queryVectors` method exists:

```typescript
async queryVectors(
  indexName: string,
  request: {
    vector: number[];
    topK: number;
    filter?: Record<string, unknown>;
    includeMetadata?: boolean;
    includeValues?: boolean;
  },
  namespace?: string
): Promise<{
  matches: Array<{
    id: string;
    score?: number;
    metadata?: Record<string, unknown>;
    values?: number[];
  }>;
}> {
  const index = this.client.index(indexName);
  const ns = namespace ? index.namespace(namespace) : index;

  const result = await ns.query({
    vector: request.vector,
    topK: request.topK,
    filter: request.filter,
    includeMetadata: request.includeMetadata ?? true,
    includeValues: request.includeValues ?? false,
  });

  return {
    matches: result.matches ?? [],
  };
}
```

**Why**: Query interface for Pinecone vector search.

## Database Changes

No new migrations - uses existing tables.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] tRPC router compiles without errors

### Manual Verification:
- [ ] Call `neuralSearch.search` via tRPC playground
- [ ] Query "authentication" returns relevant PR/issue observations
- [ ] Query "deployment failed" returns Sentry/Vercel observations
- [ ] Verify vector scores are reasonable (>0.5 for relevant results)
- [ ] Verify entity search returns matching entities
- [ ] Verify `neuralSearch.recent` returns recent observations
- [ ] Verify `neuralSearch.getEntity` returns entity with related observations

### Performance Verification:
- [ ] Search completes in <500ms (p95)
- [ ] Vector search portion <50ms
- [ ] Entity search portion <20ms

## Rollback Plan

1. Remove `neural-search.ts` router
2. Remove registration from `org/index.ts`
3. Existing observations and embeddings remain intact

---

**CHECKPOINT**: After completing this phase, neural memory is queryable via tRPC API.

---

**Previous Phase**: [Phase 6: Embedding & Storage](./phase-06-embedding-storage.md)
**Next Phase**: [Phase 8: Clusters & Profiles](./phase-08-clusters-profiles.md)
