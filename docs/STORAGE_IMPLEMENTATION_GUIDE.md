# Storage Implementation Guide (2025 Refresh)

Quick reference for building the redesigned stack: PlanetScale (durable store), S3/GCS for raw artifacts, Pinecone for chunk embeddings, Redis for cache/queues.

Terminology: The chunked retrieval layer is the Knowledge Store. The relationships‑first layer is the Memory Graph (entities/relationships/beliefs). See `docs/KNOWLEDGE_STORE.md` and `docs/MEMORY_GRAPH_DESIGN.md`.

---

## Dependencies

```bash
pnpm add @planetscale/database            # PlanetScale client (or Prisma)
pnpm add @aws-sdk/client-s3               # S3 uploads
pnpm add @pinecone-database/pinecone
pnpm add @upstash/redis
```

Configure service credentials in `.env`:

```
PLANETSCALE_HOST=
PLANETSCALE_USERNAME=
PLANETSCALE_PASSWORD=
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## PlanetScale Schema Snippets

```sql
-- Knowledge Store (canonical tables)
CREATE TABLE knowledge_documents (
  id              varchar(40) PRIMARY KEY,
  organization_id varchar(40) NOT NULL,
  workspace_id    varchar(40) NOT NULL,
  source          varchar(20) NOT NULL,
  source_id       varchar(128) NOT NULL,
  type            varchar(32) NOT NULL,
  title           text NOT NULL,
  summary         text NULL,
  state           varchar(32) NULL,
  raw_pointer     varchar(255) NULL,
  content_hash    char(64) NOT NULL,
  metadata_json   json NOT NULL,
  author_json     json NOT NULL,
  occurred_at     timestamp NOT NULL,
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version         int NOT NULL,
  lineage_json    json NOT NULL,
  UNIQUE KEY uniq_workspace_source (workspace_id, source, source_id)
);

CREATE TABLE knowledge_chunks (
  id              varchar(40) PRIMARY KEY,
  document_id     varchar(40) NOT NULL,
  workspace_id    varchar(40) NOT NULL,
  chunk_index     int NOT NULL,
  text            mediumtext NOT NULL,
  token_count     int NOT NULL,
  section_label   varchar(255) NULL,
  embedding_model varchar(64) NOT NULL,
  embedding_version varchar(32) NOT NULL,
  chunk_hash      char(64) NOT NULL,
  keywords        json NOT NULL,
  sparse_vector   json NULL,
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at   timestamp NULL,
  INDEX idx_knowledge_chunks_document (document_id),
  INDEX idx_knowledge_chunks_workspace (workspace_id, chunk_hash)
);
```

RLS (via Prisma middleware or custom API layer) enforces workspace scoping.

See `docs/MEMORY_GRAPH_DESIGN.md` for the Memory Graph tables (`entities`, `relationships`, `relationship_evidence`, `beliefs`, etc.).

---

## Pinecone Index Configuration

Create a serverless index per environment with 768 dimensions (balances recall and storage cost) and dot-product similarity to support hybrid scoring. Keep metadata under 5KB and explicitly declare indexed fields once pod-based options are enabled.

```typescript
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

## Persistence Helpers

```typescript
import { db } from '@/lib/planetscale';

export async function upsertKnowledgeDocument(input: KnowledgeDocumentInput): Promise<KnowledgeDocument> {
  const existing = await db.knowledgeDocuments.findUnique({
    where: { workspaceId_source_sourceId: input.workspaceKey },
  });

  if (existing && existing.contentHash === input.contentHash) {
    return existing; // No-op
  }

  const version = existing ? existing.version + 1 : 1;
  return await db.knowledgeDocuments.upsert({
    where: { workspaceId_source_sourceId: input.workspaceKey },
    update: {
      title: input.title,
      summary: input.summary,
      state: input.state,
      rawPointer: input.rawPointer,
      contentHash: input.contentHash,
      metadataJson: input.metadataJson,
      authorJson: input.author,
      occurredAt: input.occurredAt,
      version,
      lineageJson: input.lineage,
    },
    create: { ...input, version },
  });
}
```

`replaceChunks` soft-deletes old chunks and inserts new ones:

```typescript
export async function replaceChunks(doc: KnowledgeDocument, drafts: ChunkDraft[]): Promise<KnowledgeChunkRecord[]> {
  await db.knowledgeChunks.updateMany({
    where: { documentId: doc.id, supersededAt: null },
    data: { supersededAt: new Date() },
  });

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

  await db.knowledgeChunks.createMany({ data: rows });
  return rows;
}
```

---

## Pinecone Upsert Helper

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

export async function upsertChunkVector(
  chunk: KnowledgeChunkRecord,
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
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

export async function primeKnowledgeCache(doc: KnowledgeDocument, chunks: KnowledgeChunkRecord[]): Promise<void> {
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
