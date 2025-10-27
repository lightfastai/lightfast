# Storage Implementation Guide (2025 Refresh)

Quick reference for building the redesigned stack: PlanetScale (MySQL via Drizzle) as the durable store, S3/GCS for raw artifacts, Pinecone for chunk embeddings, and Redis for cache/queues.

Terminology: The chunked retrieval layer is the Knowledge Store. The relationships‑first layer is the Memory Graph (entities/relationships/beliefs). See `docs/KNOWLEDGE_STORE.md` and `docs/memory/GRAPH.md`.

---

## Dependencies

```bash
# Database (PlanetScale MySQL + Drizzle)
pnpm add drizzle-orm drizzle-zod @planetscale/database
# Migrations / tooling (in db/* workspaces)
pnpm add -D drizzle-kit dotenv-cli

# Storage / search / cache
pnpm add @aws-sdk/client-s3 @pinecone-database/pinecone @upstash/redis
```

Configure service credentials in `.env`:

```
# PlanetScale (MySQL)
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=

# Object store
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Pinecone
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

# Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Drizzle Schema (PlanetScale MySQL)

Example Drizzle definitions for the Knowledge Store tables. Use drizzle‑kit to generate and run migrations.

```ts
import {
  mysqlTable,
  varchar,
  text,
  mediumtext,
  int,
  char,
  json,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';

export const knowledgeDocuments = mysqlTable(
  'knowledge_documents',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 40 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    sourceId: varchar('source_id', { length: 128 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    state: varchar('state', { length: 32 }),
    rawPointer: varchar('raw_pointer', { length: 255 }),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    metadataJson: json('metadata_json').notNull(),
    authorJson: json('author_json').notNull(),
    occurredAt: timestamp('occurred_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).onUpdateNow().defaultNow().notNull(),
    version: int('version').notNull(),
    lineageJson: json('lineage_json').notNull(),
  },
  (t) => ({
    uniqWorkspaceSource: uniqueIndex('uniq_workspace_source').on(t.workspaceId, t.source, t.sourceId),
  }),
);

export const knowledgeChunks = mysqlTable(
  'knowledge_chunks',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    documentId: varchar('document_id', { length: 40 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
    chunkIndex: int('chunk_index').notNull(),
    text: mediumtext('text').notNull(),
    tokenCount: int('token_count').notNull(),
    sectionLabel: varchar('section_label', { length: 255 }),
    embeddingModel: varchar('embedding_model', { length: 64 }).notNull(),
    embeddingVersion: varchar('embedding_version', { length: 32 }).notNull(),
    chunkHash: char('chunk_hash', { length: 64 }).notNull(),
    keywords: json('keywords').notNull(),
    sparseVector: json('sparse_vector'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    supersededAt: timestamp('superseded_at', { mode: 'date' }),
  },
  (t) => ({
    idxByDocument: index('idx_knowledge_chunks_document').on(t.documentId),
    idxByWorkspaceHash: index('idx_knowledge_chunks_workspace').on(t.workspaceId, t.chunkHash),
  }),
);
```

Workspace scoping is enforced in the application layer (PlanetScale has no native RLS). See `docs/memory/GRAPH.md` for Memory Graph tables (`entities`, `relationships`, `relationship_evidence`, `beliefs`, etc.).

---

## Pinecone Index Configuration

Create a serverless index per environment with 768 dimensions (balances recall and storage cost) and dot-product similarity to support hybrid scoring. Keep metadata under 5KB and explicitly declare indexed fields once pod-based options are enabled.

```typescript
// If you inferred KnowledgeChunk from tRPC, import the alias here
// type KnowledgeChunk = CloudRouterOutputs['knowledge']['listChunks'][number];
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

await pinecone.createIndex({
  name: `lightfast-chunks-${process.env.NODE_ENV}`,
  dimension: 768,
  metric: 'dotproduct',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1',
    },
  },
});
```

When migrating to pod-based hybrid search, enable selective metadata indexing so only frequently-used filters incur index overhead:

```typescript
await pinecone.configureIndex({
  name: 'lightfast-chunks-prod',
  spec: {
    pod: {
      metadata_config: {
        indexed: ['workspace_id', 'entity_type', 'source', 'created_at', 'author_id'],
      },
    },
  },
});
```

---

## Persistence Helpers (Drizzle)

```ts
// Prefer inferring API-facing types from tRPC RouterOutputs
// Adjust the path to your actual route names
import type { CloudRouterOutputs } from '@api/cloud';
type KnowledgeDocument = CloudRouterOutputs['knowledge']['getDocumentById'];
// Optional: if you expose a 'listChunks' or similar endpoint
// type KnowledgeChunk = CloudRouterOutputs['knowledge']['listChunks'][number];

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@db/cloud/client';
import { knowledgeDocuments, knowledgeChunks } from '@db/cloud/schema';

export async function upsertKnowledgeDocument(input: KnowledgeDocumentInput) {
  const [existing] = await db
    .select()
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.workspaceId, input.workspaceId),
        eq(knowledgeDocuments.source, input.source),
        eq(knowledgeDocuments.sourceId, input.sourceId),
      ),
    )
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
        updatedAt: new Date(),
      },
    });

  const [row] = await db
    .select()
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.workspaceId, input.workspaceId),
        eq(knowledgeDocuments.source, input.source),
        eq(knowledgeDocuments.sourceId, input.sourceId),
      ),
    )
    .limit(1);

  return row!;
}
```

Replace chunks transactionally:

```ts
export async function replaceChunks(doc: KnowledgeDocument, drafts: ChunkDraft[]) {
  return db.transaction(async (tx) => {
    await tx
      .update(knowledgeChunks)
      .set({ supersededAt: new Date() })
      .where(and(eq(knowledgeChunks.documentId, doc.id), isNull(knowledgeChunks.supersededAt)));

    const rows = drafts.map((draft, index) => ({
      id: newId(),
      documentId: doc.id,
      workspaceId: doc.workspaceId,
      chunkIndex: index,
      text: draft.text,
      tokenCount: draft.tokenCount,
      sectionLabel: draft.sectionLabel ?? null,
      embeddingModel: draft.embeddingModel,
      embeddingVersion: draft.embeddingVersion,
      chunkHash: draft.chunkHash,
      keywords: draft.keywords,
    }));

    if (rows.length) await tx.insert(knowledgeChunks).values(rows);
    return rows;
  });
}
```

---

## Pinecone Upsert Helper

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

export async function upsertChunkVector(
  chunk: KnowledgeChunk,
  embedding: number[],
  opts: { source: string }
) {
  const namespace = `${chunk.workspaceId}-${chunk.embeddingVersion}`;

  await pinecone.index('lightfast-chunks').namespace(namespace).upsert([{
    id: chunk.id,
    values: embedding,
    metadata: {
      workspaceId: chunk.workspaceId,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      chunkHash: chunk.chunkHash,
      type: chunk.sectionLabel ?? null,
      createdAt: chunk.createdAt.toISOString(),
      source: opts.source,
    },
  }]);
}
```

To remove superseded chunks, call `deleteMany` using the chunk IDs returned from `replaceChunks` when chunks are replaced.

---

## Cohere Embedding Helpers

```typescript
import { cohere } from '@/lib/cohere';

export async function embedChunks(texts: string[], model: string) {
  return cohere.embed({
    texts,
    model,
    inputType: 'search_document',
  });
}

export async function embedQuery(text: string, model: string) {
  const { embeddings } = await cohere.embed({
    texts: [text],
    model,
    inputType: 'search_query',
  });
  return embeddings[0];
}
```

For >100k chunk backfills, use Embed Jobs so Cohere handles batching and validation:

```typescript
const job = await cohere.embedJobs.create({
  datasetId,
  model: 'embed-english-v3.0',
  inputType: 'search_document',
});

await pollUntilComplete(job.id);
const chunks = await cohere.embedJobs.getResults(job.id);
```

Track `embedding_version` whenever the model, dimension (Matryoshka truncation), or compression (`float32`, `int8`, `binary`) changes.

---

## Redis Cache Contract

```typescript
// If you inferred KnowledgeChunk from tRPC, import the alias here
// type KnowledgeChunk = CloudRouterOutputs['knowledge']['listChunks'][number];
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

export async function primeKnowledgeCache(doc: KnowledgeDocument, chunks: KnowledgeChunk[]): Promise<void> {
  await redis.pipeline()
    .set(`document:${doc.id}`, JSON.stringify(doc), { ex: 72 * 60 * 60 })
    .set(`chunks:${doc.id}:v${doc.version}`, JSON.stringify(chunks), { ex: 24 * 60 * 60 })
    .exec();
}
```

Dedup keys:

```typescript
await redis.set(`source-dedupe:${doc.source}:${doc.sourceId}`, doc.contentHash, { ex: 86_400 });
```

Relationship adjacency lists are stored as Redis sets for convenience but can be rebuilt from PlanetScale when caches invalidate.

---

## S3 Upload Helper

```typescript
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

We keep artifact keys under `workspaces/{workspaceId}/knowledge/{documentId}/...`.

---

## Braintrust Hooks

After inserting a document, enqueue a Braintrust test run if the workspace has suites:

```typescript
import { braintrust } from '@/lib/braintrust';

await braintrust.tests.enqueue({
  workspaceId: doc.workspaceId,
  suite: 'post-ingest-regression',
  payload: { documentId: doc.id, version: doc.version },
});
```

Braintrust callbacks write evaluation metrics into `feedback_events` for observability dashboards.

---

## Checklist per Ingestion

1. Normalize source payload → `KnowledgeDocumentInput` + `ChunkDraft[]`.
2. Persist via transaction (knowledge_documents + knowledge_chunks + artifact uploads).
3. Prime Redis caches (best-effort).
4. Enqueue embedding jobs with correct `inputType` values (`search_document` for chunks) and wait for Pinecone upserts.
5. Run relationship detection and update graph tables.
6. Trigger Braintrust evaluation and log ingestion metrics.
7. Periodically export representative rerank samples to recalibrate Cohere relevance thresholds.

---

_Last reviewed: 2025-02-10_
