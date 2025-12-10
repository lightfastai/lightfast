---
title: "Phase 6: Embedding & Storage"
description: Multi-view embeddings, Pinecone upsert, entity extraction and storage
status: not_started
phase: 6
parent: "./README.md"
depends_on: ["./phase-03-github-ingestion.md", "./phase-04-vercel-ingestion.md", "./phase-05-sentry-ingestion.md"]
blocks: ["./phase-07-basic-retrieval.md"]
---

# Phase 6: Embedding & Storage

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Extend the observation capture pipeline to generate multi-view embeddings (title, content, summary), upsert to Pinecone's `observations` namespace, and extract structured entities. This phase makes observations searchable.

## Prerequisites

- [ ] At least one source ingestion phase completed (3, 4, or 5)
- [ ] Observations being created in database
- [ ] Pinecone index available (existing infrastructure)

## Changes Required

### 1. Update Observation Capture with Embedding Generation

**File**: `api/console/src/inngest/workflow/neural/capture-observation.ts`
**Action**: Modify

Add after the existing `store-observation` step (around line 200):

```typescript
// Import at top of file
import { createEmbeddingProviderForStore } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import { workspaceNeuralEntities } from "@db/console/schema";

// Add these steps after store-observation step:

// Step 6: Generate Multi-View Embeddings (PARALLEL)
const embeddings = await step.run("generate-embeddings", async () => {
  const embeddingProvider = createEmbeddingProviderForStore(
    {
      id: storeId,
      embeddingModel: "text-embedding-3-small", // Or use store config
      embeddingDim: 1536,
    },
    { inputType: "search_document" }
  );

  // Generate embeddings for title, content, and combined summary
  const textsToEmbed = [
    observation.title, // View 1: Title only
    observation.content, // View 2: Full content
    `${observation.title}\n\n${observation.content.slice(0, 500)}`, // View 3: Summary
  ];

  const result = await embeddingProvider.embed(textsToEmbed);

  return {
    titleEmbedding: result.embeddings[0],
    contentEmbedding: result.embeddings[1],
    summaryEmbedding: result.embeddings[2],
  };
});

// Step 7: Upsert to Pinecone
await step.run("upsert-pinecone", async () => {
  const namespace = `${workspaceId}/neural/observations`;

  // Upsert content embedding (primary search vector)
  await pineconeClient.upsertVectors(
    "default", // index name from config
    {
      ids: [`obs:${stored.id}:content`],
      vectors: [embeddings.contentEmbedding!],
      metadata: [
        {
          observationId: stored.id,
          workspaceId,
          type: classification.type,
          sourceType: sourceEvent.source,
          actorId: actor.actorId,
          actorName: actor.actorName,
          occurredAt: observation.occurredAt.toISOString(),
          title: observation.title,
          snippet: observation.content.slice(0, 500),
          topics: classification.topics,
          significanceScore: significance.score,
        },
      ],
    },
    100, // batch size
    namespace
  );

  // Also upsert title embedding for title-focused queries
  await pineconeClient.upsertVectors(
    "default",
    {
      ids: [`obs:${stored.id}:title`],
      vectors: [embeddings.titleEmbedding!],
      metadata: [
        {
          observationId: stored.id,
          workspaceId,
          type: classification.type,
          sourceType: sourceEvent.source,
          view: "title",
        },
      ],
    },
    100,
    namespace
  );

  log.info("Observation embeddings upserted to Pinecone", {
    observationId: stored.id,
    namespace,
  });
});

// Step 8: Update observation with embedding IDs
await step.run("update-embedding-ids", async () => {
  await db
    .update(workspaceNeuralObservations)
    .set({
      embeddingTitleId: `obs:${stored.id}:title`,
      embeddingContentId: `obs:${stored.id}:content`,
      embeddingSummaryId: `obs:${stored.id}:summary`,
    })
    .where(eq(workspaceNeuralObservations.id, stored.id));
});

// Step 9: Extract and Store Entities
const entities = await step.run("extract-entities", async () => {
  return await extractEntities(observation, stored.id, workspaceId, storeId);
});

if (entities.length > 0) {
  await step.run("store-entities", async () => {
    // Upsert entities (update occurrence count if exists)
    for (const entity of entities) {
      await db
        .insert(workspaceNeuralEntities)
        .values(entity)
        .onConflictDoUpdate({
          target: [
            workspaceNeuralEntities.workspaceId,
            workspaceNeuralEntities.category,
            workspaceNeuralEntities.key,
          ],
          set: {
            lastSeenAt: new Date(),
            occurrenceCount: sql`${workspaceNeuralEntities.occurrenceCount}::integer + 1`,
          },
        });
    }

    log.info("Entities extracted and stored", {
      observationId: stored.id,
      entityCount: entities.length,
    });
  });
}
```

**Why**: Generate embeddings and store in Pinecone for vector search.

### 2. Add Entity Extraction Function

**File**: `api/console/src/inngest/workflow/neural/capture-observation.ts`
**Action**: Modify (add function)

Add this function before the main workflow:

```typescript
interface ExtractedEntity {
  id: string;
  workspaceId: string;
  storeId: string;
  category: string;
  key: string;
  value: string;
  aliases: string[];
  sourceObservationId: string;
  evidenceSnippet: string;
  confidence: string;
}

/**
 * Extract entities from observation using rule-based patterns
 */
async function extractEntities(
  observation: {
    title: string;
    content: string;
    actorName?: string;
    sourceType: string;
  },
  observationId: string,
  workspaceId: string,
  storeId: string
): Promise<ExtractedEntity[]> {
  const entities: ExtractedEntity[] = [];
  const content = `${observation.title} ${observation.content}`;

  // Pattern 1: API endpoints (GET/POST/PUT/DELETE /path)
  const endpointPattern = /(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s"'<>]+)/g;
  for (const match of content.matchAll(endpointPattern)) {
    const endpoint = `${match[1]} ${match[2]}`;
    entities.push({
      id: nanoid(),
      workspaceId,
      storeId,
      category: "endpoint",
      key: endpoint,
      value: extractContext(content, match.index!, 100),
      aliases: [],
      sourceObservationId: observationId,
      evidenceSnippet: content.slice(
        Math.max(0, match.index! - 20),
        match.index! + endpoint.length + 20
      ),
      confidence: "0.95",
    });
  }

  // Pattern 2: Environment variables (UPPER_SNAKE_CASE)
  const envPattern = /\b([A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)+)\b/g;
  const envMatches = new Set<string>();
  for (const match of content.matchAll(envPattern)) {
    const envVar = match[1]!;
    // Filter out common false positives
    if (
      !envVar.startsWith("HTTP") &&
      !envVar.startsWith("JSON") &&
      !envMatches.has(envVar)
    ) {
      envMatches.add(envVar);
      entities.push({
        id: nanoid(),
        workspaceId,
        storeId,
        category: "config",
        key: envVar,
        value: "environment variable",
        aliases: [],
        sourceObservationId: observationId,
        evidenceSnippet: content.slice(
          Math.max(0, match.index! - 20),
          match.index! + envVar.length + 20
        ),
        confidence: "0.85",
      });
    }
  }

  // Pattern 3: @mentions (GitHub/Slack style)
  const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
  const mentionMatches = new Set<string>();
  for (const match of content.matchAll(mentionPattern)) {
    const username = match[1]!;
    if (!mentionMatches.has(username)) {
      mentionMatches.add(username);
      entities.push({
        id: nanoid(),
        workspaceId,
        storeId,
        category: "engineer",
        key: username,
        value: "mentioned user",
        aliases: [`@${username}`],
        sourceObservationId: observationId,
        evidenceSnippet: content.slice(
          Math.max(0, match.index! - 20),
          match.index! + username.length + 21
        ),
        confidence: "0.90",
      });
    }
  }

  // Pattern 4: Issue/PR references (#123, PROJ-123)
  const refPattern = /(#\d+|[A-Z]{2,}-\d+)/g;
  const refMatches = new Set<string>();
  for (const match of content.matchAll(refPattern)) {
    const ref = match[1]!;
    if (!refMatches.has(ref)) {
      refMatches.add(ref);
      entities.push({
        id: nanoid(),
        workspaceId,
        storeId,
        category: "project",
        key: ref,
        value: ref.startsWith("#") ? "issue/PR reference" : "ticket reference",
        aliases: [],
        sourceObservationId: observationId,
        evidenceSnippet: content.slice(
          Math.max(0, match.index! - 20),
          match.index! + ref.length + 20
        ),
        confidence: "0.95",
      });
    }
  }

  // Pattern 5: File paths (common patterns)
  const filePattern = /(?:src|lib|packages|apps|components)\/[^\s"'<>]+\.[a-z]+/g;
  const fileMatches = new Set<string>();
  for (const match of content.matchAll(filePattern)) {
    const filePath = match[0];
    if (!fileMatches.has(filePath)) {
      fileMatches.add(filePath);
      entities.push({
        id: nanoid(),
        workspaceId,
        storeId,
        category: "definition",
        key: filePath,
        value: "file path",
        aliases: [],
        sourceObservationId: observationId,
        evidenceSnippet: content.slice(
          Math.max(0, match.index! - 10),
          match.index! + filePath.length + 10
        ),
        confidence: "0.80",
      });
    }
  }

  // Add actor as engineer entity if present
  if (observation.actorName && observation.actorName !== "System") {
    entities.push({
      id: nanoid(),
      workspaceId,
      storeId,
      category: "engineer",
      key: observation.actorName,
      value: `contributor (${observation.sourceType})`,
      aliases: [],
      sourceObservationId: observationId,
      evidenceSnippet: `Actor in ${observation.title}`,
      confidence: "0.95",
    });
  }

  return entities;
}

/**
 * Extract surrounding context for entity value
 */
function extractContext(content: string, index: number, length: number): string {
  const start = Math.max(0, index - length);
  const end = Math.min(content.length, index + length);
  return content.slice(start, end).trim();
}
```

**Why**: Extract structured entities for exact-match retrieval.

### 3. Add Required Imports

**File**: `api/console/src/inngest/workflow/neural/capture-observation.ts`
**Action**: Modify (add imports)

```typescript
import { sql } from "drizzle-orm";
import { createEmbeddingProviderForStore } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import { workspaceNeuralEntities } from "@db/console/schema";
```

**Why**: Dependencies for embedding and entity storage.

### 4. Configure Pinecone Namespace

**File**: `packages/console-pinecone/src/client.ts`
**Action**: Modify (if needed)

Ensure the client supports the new namespace format. The existing client should work, but verify the namespace handling:

```typescript
// Namespace format for neural observations:
// {workspaceId}/neural/observations
// {workspaceId}/neural/clusters
// {workspaceId}/neural/profiles
```

**Why**: Separate namespace for neural observations vs existing knowledge documents.

## Database Changes

No new migrations - uses tables and schema from Phase 1.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

### Manual Verification:
- [ ] Trigger a source event (e.g., merge a PR)
- [ ] Verify observation in database has `embeddingContentId`, `embeddingTitleId` populated
- [ ] Query Pinecone directly to confirm vectors exist in `{workspaceId}/neural/observations` namespace
- [ ] Verify entities extracted and stored in `workspace_neural_entities` table
- [ ] Check entity categories: endpoints, env vars, mentions, references, file paths
- [ ] Verify entity deduplication works (trigger same content twice, check occurrence count increments)

### Performance Verification:
- [ ] Observation capture completes in <500ms (p95)
- [ ] Entity extraction completes in <200ms

## Rollback Plan

1. Remove embedding and entity extraction steps from workflow
2. Observations will still be stored but not searchable via vector search
3. Existing observations without embeddings will need re-processing if embeddings are added back

---

**CHECKPOINT**: After completing this phase, observations are searchable via vector similarity.

---

**Previous Phases**:
- [Phase 3: GitHub Ingestion](./phase-03-github-ingestion.md)
- [Phase 4: Vercel Ingestion](./phase-04-vercel-ingestion.md)
- [Phase 5: Sentry Ingestion](./phase-05-sentry-ingestion.md)
**Next Phase**: [Phase 7: Basic Retrieval](./phase-07-basic-retrieval.md)
