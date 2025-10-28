# Storage Implementation Guide — Neural Memory

Last Updated: 2025-10-28

This guide implements the storage stack for Lightfast’s Neural Memory architecture: PlanetScale (MySQL via Drizzle) for durable metadata, S3 for raw artifacts, Pinecone for vector indexes (chunks/observations/summaries/profiles), and Redis for caches/queues.

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

Environment

```
# PlanetScale (MySQL)
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=

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

## Drizzle Schema (PlanetScale MySQL)

Representative Drizzle definitions for Knowledge (documents/chunks), Neural Memory (observations/summaries/profiles), and Graph (entities/relationships). Use `drizzle-kit` to generate migrations.

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
  double,
} from 'drizzle-orm/mysql-core';

// Knowledge — documents
export const knowledgeDocuments = mysqlTable(
  'knowledge_documents',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
    organizationId: varchar('organization_id', { length: 40 }).notNull(),
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

// Knowledge — chunks
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
    occurredAt: timestamp('occurred_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    supersededAt: timestamp('superseded_at', { mode: 'date' }),
  },
  (t) => ({
    idxByDocument: index('idx_knowledge_chunks_document').on(t.documentId),
    idxByWorkspaceHash: index('idx_knowledge_chunks_workspace').on(t.workspaceId, t.chunkHash),
  }),
);

// Neural Memory — observations
export const memoryObservations = mysqlTable(
  'memory_observations',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
    documentId: varchar('document_id', { length: 40 }), // optional link to source doc
    text: mediumtext('text').notNull(),
    title: text('title'),
    summary: text('summary'),
    occurredAt: timestamp('occurred_at', { mode: 'date' }).notNull(),
    importance: double('importance').default(0).notNull(),
    tags: json('tags'),
    subjectRefs: json('subject_refs'), // e.g., entities/messages
    embeddingModel: varchar('embedding_model', { length: 64 }).notNull(),
    embeddingVersion: varchar('embedding_version', { length: 32 }).notNull(),
    privacy: varchar('privacy', { length: 16 }).default('org').notNull(),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({ idxByWorkspace: index('idx_memory_obs_ws').on(t.workspaceId, t.occurredAt) }),
);

// Neural Memory — summaries (cluster rollups)
export const memorySummaries = mysqlTable(
  'memory_summaries',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
    windowJson: json('window_json').notNull(), // { entityId/topic, timeWindow }
    text: mediumtext('text').notNull(),
    embeddingModel: varchar('embedding_model', { length: 64 }).notNull(),
    embeddingVersion: varchar('embedding_version', { length: 32 }).notNull(),
    coverageJson: json('coverage_json').notNull(), // counts, sources
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
);

// Neural Memory — profiles (entity centroids)
export const memoryProfiles = mysqlTable(
  'memory_profiles',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
    entityId: varchar('entity_id', { length: 40 }).notNull(),
    centroidsJson: json('centroids_json').notNull(), // { title: number[], body: number[], summary: number[] }
    descriptors: json('descriptors'),
    drift: double('drift').default(0).notNull(),
    lastRebuiltAt: timestamp('last_rebuilt_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({ idxByEntity: index('idx_memory_profiles_entity').on(t.workspaceId, t.entityId) }),
);

// Graph — entities & relationships (sketch)
export const entities = mysqlTable('entities', {
  id: varchar('id', { length: 40 }).primaryKey(),
  workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
  kind: varchar('kind', { length: 24 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const entityAliases = mysqlTable('entity_aliases', {
  id: varchar('id', { length: 40 }).primaryKey(),
  entityId: varchar('entity_id', { length: 40 }).notNull(),
  aliasType: varchar('alias_type', { length: 24 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  verified: int('verified').default(0).notNull(),
});

export const relationships = mysqlTable('relationships', {
  id: varchar('id', { length: 40 }).primaryKey(),
  workspaceId: varchar('workspace_id', { length: 40 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  fromId: varchar('from_id', { length: 40 }).notNull(),
  toId: varchar('to_id', { length: 40 }).notNull(),
  confidence: double('confidence').default(1).notNull(),
  since: timestamp('since', { mode: 'date' }),
  until: timestamp('until', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const relationshipEvidence = mysqlTable('relationship_evidence', {
  id: varchar('id', { length: 40 }).primaryKey(),
  relationshipId: varchar('relationship_id', { length: 40 }).notNull(),
  documentId: varchar('document_id', { length: 40 }),
  chunkId: varchar('chunk_id', { length: 40 }),
  observationId: varchar('observation_id', { length: 40 }),
  weight: double('weight').default(1).notNull(),
});
```

Workspace isolation is enforced at the application layer (PlanetScale has no native RLS). Include workspace IDs in every table and index namespaces in Pinecone by workspace + version.

---

## Pinecone Indexes

We maintain four index families and per-workspace namespaces:

- chunks — `lightfast-chunks`
- observations — `lightfast-observations`
- summaries — `lightfast-summaries`
- profiles — `lightfast-profiles`

Namespace pattern: `${workspaceId}-${embeddingVersion}`.

Example creation (serverless):

```ts
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

await pinecone.createIndex({
  name: 'lightfast-chunks',
  dimension: 768,
  metric: 'dotproduct',
  spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
});
```

Upserts

```ts
export async function upsertChunkVector(chunk: KnowledgeChunk, embedding: number[]) {
  const namespace = `${chunk.workspaceId}-${chunk.embeddingVersion}`;
  await pinecone.index('lightfast-chunks').namespace(namespace).upsert([
    {
      id: chunk.id,
      values: embedding,
      metadata: {
        workspaceId: chunk.workspaceId,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        chunkHash: chunk.chunkHash,
        section: chunk.sectionLabel ?? null,
        occurredAt: chunk.occurredAt?.toISOString() ?? null,
        source: 'knowledge',
      },
    },
  ]);
}

export async function upsertObservationVectors(obs: MemoryObservation, views: { title?: number[]; body: number[]; summary?: number[] }) {
  const namespace = `${obs.workspaceId}-${obs.embeddingVersion}`;
  const items = [
    { id: `${obs.id}:body`, values: views.body },
    ...(views.title ? [{ id: `${obs.id}:title`, values: views.title }] : []),
    ...(views.summary ? [{ id: `${obs.id}:summary`, values: views.summary }] : []),
  ].map((v) => ({
    ...v,
    metadata: {
      workspaceId: obs.workspaceId,
      observationId: obs.id,
      occurredAt: obs.occurredAt.toISOString(),
      importance: obs.importance,
      source: 'observation',
    },
  }));
  await pinecone.index('lightfast-observations').namespace(namespace).upsert(items);
}
```

Keep metadata under ~1 KB; store heavy fields in PlanetScale and reference IDs in Pinecone.

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

Track `embeddingVersion` whenever model, dimension (Matryoshka truncation), or compression changes.

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
        updatedAt: new Date(),
      },
    });

  const [row] = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.workspaceId, input.workspaceId), eq(knowledgeDocuments.source, input.source), eq(knowledgeDocuments.sourceId, input.sourceId)))
    .limit(1);

  return row!;
}

export async function replaceChunks(doc: KnowledgeDocumentRow, drafts: ChunkDraft[]) {
  return db.transaction(async (tx) => {
    await tx.update(knowledgeChunks).set({ supersededAt: new Date() }).where(and(eq(knowledgeChunks.documentId, doc.id), isNull(knowledgeChunks.supersededAt)));

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
      occurredAt: doc.occurredAt,
    }));

    if (rows.length) await tx.insert(knowledgeChunks).values(rows);
    return rows;
  });
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

