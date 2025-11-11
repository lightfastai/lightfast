---
title: Storage Implementation Guide — Neural Memory
description: Implementing PlanetScale Postgres, S3, Mastra Pinecone, and Redis for the Neural Memory stack
status: working
owner: platform-storage
audience: engineering
last_updated: 2025-10-28
tags: [storage, implementation]
---

# Storage Implementation Guide — Neural Memory

Last Updated: 2025-11-06

This guide implements the storage stack for Lightfast’s Neural Memory architecture: PlanetScale Postgres (via Drizzle) for durable metadata, S3 for raw artifacts, Mastra Pinecone for vector indexes (docs/observations/summaries/profiles), and Redis for caches/queues.

---

## Dependencies

```bash
# Database (PlanetScale Postgres + Drizzle)
pnpm add drizzle-orm drizzle-zod pg
# Migrations / tooling (in db/* workspaces)
pnpm add -D drizzle-kit dotenv-cli

# Storage / search / cache
pnpm add @aws-sdk/client-s3 @pinecone-database/pinecone @upstash/redis
```

Environment

```
# PlanetScale (Postgres)
DATABASE_URL=

# Object store
AWS_REGION=us-east-1
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Pinecone
PINECONE_API_KEY=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Drizzle Schema (Postgres)

See per-phase data models:
- Phase 1: docs/architecture/phase1/data-model.md (stores, docs_documents, vector_entries, ingestion_commits)
- Phase 2: will introduce observations/summaries/profiles/relationships and embedding_versions in a Postgres-first design.

Workspace isolation can adopt Postgres RLS in Phase 2. Include workspace IDs in every table and scope queries by workspace.

---

## Mastra Pinecone Indexes

We maintain one index per `(workspace, store)` for docs in Phase 1. Phase 2 may add families or labels for observations/summaries/profiles.

Index naming: `ws_${workspaceId}__store_${store}` (dimension 1536 in v1).

Example creation and upsert via the official client:

```ts
import { Pinecone } from '@pinecone-database/pinecone';

const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
await client.createIndex({
  name: indexName,
  dimension: 1536,
  metric: 'cosine',
  spec: { serverless: { cloud: 'aws', region: 'us-west-2' } },
  suppressConflicts: true,
  waitUntilReady: true,
});

const index = client.index(indexName);
await index.upsert([
  { id: 'doc#0', values: vectorValues, metadata: { path: 'README.md' } },
]);
```

Keep metadata under ~1 KB; store heavy fields in Postgres and reference IDs in index metadata.

---

## Embedding Helpers

```ts
import { cohere } from '@/lib/cohere';

export async function embedQuery(text: string, model: string) {
  const { embeddings } = await cohere.embed({ texts: [text], model, inputType: 'search_query' });
  return embeddings[0];
}

export async function embedChunkText(text: string, model: string) {
  const { embeddings } = await cohere.embed({ texts: [text], model, inputType: 'search_document' });
  return embeddings[0];
}

export async function embedObservationViews(obs: { title?: string; text: string; summary?: string }, model: string) {
  const texts = [obs.text, obs.title, obs.summary].filter(Boolean) as string[];
  const { embeddings } = await cohere.embed({ texts, model, inputType: 'search_document' });
  const [body, title, summary] = embeddings;
  return { body: body ?? embeddings[0], title, summary };
}
```

Track `embeddingVersion` in Phase 2 whenever model, dimension, or compression changes.

---

## Persistence Helpers (Drizzle)

Upsert documents, replace chunks, and insert observations in a transaction.

```ts
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { knowledgeDocuments, knowledgeChunks, memoryObservations } from '@/db/schema';

export async function upsertKnowledgeDocument(input: KnowledgeDocumentInput) {
  const [existing] = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.workspaceId, input.workspaceId), eq(knowledgeDocuments.source, input.source), eq(knowledgeDocuments.sourceId, input.sourceId)))
    .limit(1);

  if (existing && existing.contentHash === input.contentHash) return existing; // No-op

  const version = existing ? existing.version + 1 : 1;

  await db
    .insert(knowledgeDocuments)
    .values({ ...input, version })
    .onDuplicateKeyUpdate({
      set: {
        title: input.title,
        summary: input.summary ?? null,
        state: input.state ?? null,
        rawPointer: input.rawPointer ?? null,
        contentHash: input.contentHash,
        metadataJson: input.metadataJson,
        authorJson: input.author,
        occurredAt: input.occurredAt,
        version,
        lineageJson: input.lineage,
      },
    });

  const [row] = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.workspaceId, input.workspaceId), eq(knowledgeDocuments.source, input.source), eq(knowledgeDocuments.sourceId, input.sourceId)))
    .limit(1);

  return row!;
}

export async function replaceChunks(tx: any, documentId: string, version: number, drafts: ChunkDraft[]) {
  // delete superseded
  await tx.update(knowledgeChunks).set({ supersededAt: new Date() }).where(and(eq(knowledgeChunks.documentId, documentId), isNull(knowledgeChunks.supersededAt)));

  const rows = drafts.map((draft, i) => ({
    id: newId(),
    documentId,
    workspaceId: (await tx.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId))).at(0)!.workspaceId,
    chunkIndex: draft.chunkIndex ?? i,
    text: draft.text,
    tokenCount: draft.tokenCount,
    sectionLabel: draft.sectionLabel ?? null,
    embeddingModel: draft.embeddingModel,
    embeddingVersion: draft.embeddingVersion,
    chunkHash: draft.chunkHash,
    keywords: draft.keywords,
    occurredAt: (await tx.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId))).at(0)!.occurredAt,
  }));

  if (rows.length) await tx.insert(knowledgeChunks).values(rows);
  return rows;
}

export async function insertObservations(workspaceId: string, drafts: ObservationDraft[], documentId?: string) {
  if (!drafts.length) return [] as MemoryObservationRow[];
  const rows = drafts.map((d) => ({
    id: newId(),
    workspaceId,
    documentId: documentId ?? null,
    text: d.text,
    title: d.title ?? null,
    summary: d.summary ?? null,
    occurredAt: new Date(d.occurredAt),
    importance: d.importance ?? 0,
    tags: d.tags ?? null,
    subjectRefs: d.subjectRefs ?? null,
    embeddingModel: d.embeddingModel,
    embeddingVersion: d.embeddingVersion,
    privacy: d.privacy ?? 'org',
    contentHash: d.contentHash,
  }));
  await db.insert(memoryObservations).values(rows);
  return rows;
}
```

---

## Redis Cache Contracts

```ts
import { Redis } from '@upstash/redis';
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

export async function primeKnowledgeCache(doc: KnowledgeDocumentRow, chunks: KnowledgeChunkRow[]): Promise<void> {
  await redis.pipeline()
    .set(`document:${doc.id}`, JSON.stringify(doc), { ex: 72 * 60 * 60 })
    .set(`chunks:${doc.id}:v${doc.version}`, JSON.stringify(chunks), { ex: 24 * 60 * 60 })
    .exec();
}

export async function setDedupeKey(source: string, sourceId: string, contentHash: string) {
  await redis.set(`source-dedupe:${source}:${sourceId}`, contentHash, { ex: 86_400 });
}

// Graph adjacency caches (example keys)
// graph:out:{workspaceId}:{kind}:{id} -> JSON-encoded neighbor list
```

---

## S3 Upload Helper

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });

export async function storeRawArtifact(key: string, body: Uint8Array | string) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: typeof body === 'string' ? Buffer.from(body) : body,
    ContentType: 'application/json',
  }));
}
```

Key pattern: `workspaces/{workspaceId}/knowledge/{documentId}/...`.

---

## Consolidation Jobs (Sketch)

```ts
export async function clusterObservations(workspaceId: string) {
  // 1) Fetch recent observations; 2) cluster by entity/topic/time window; 3) generate summary text; 4) embed and store in memory_summaries
}

export async function rebuildProfiles(workspaceId: string) {
  // compute centroids per entity across observations/summaries; update memory_profiles
}
```

Run nightly or on thresholds (count/time) per workspace. Store coverage/drift metrics.

---

## Braintrust Hooks

```ts
import { braintrust } from '@/lib/braintrust';
await braintrust.tests.enqueue({ workspaceId: doc.workspaceId, suite: 'post-ingest-regression', payload: { documentId: doc.id, version: doc.version } });
```

Hook both `knowledge.persisted` and consolidation jobs to regression suites.

---

## Checklists

Per ingestion
- Normalize payload → Document + Chunks + Observations
- Transactionally persist rows; upload raw artifacts
- Prime caches; set dedupe key
- Enqueue embeddings for chunks/observations; upsert Pinecone
- Detect relationships (deterministic first); update caches
- Emit eval events

Nightly
- Cluster observations → summaries; embed/index
- Rebuild profiles; compute drift
- Refresh stale embeddings if needed; archive old namespaces after migrations

---

_Last reviewed: 2025-10-28_
