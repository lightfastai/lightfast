# Sync Pipeline Design (2025 Refresh)

Describes how Lightfast ingests source events, normalizes them into canonical knowledge documents, persists them durably, and updates retrieval indices. For the relationships‑first Memory layer, see `docs/memory/GRAPH.md`.

---

## High-Level Flow

```
Source Event (GitHub/Slack/Linear/Notion)
        │
        ▼
Ingress Layer (webhooks, pollers) → Idempotency check (Redis)
        │
        ▼
Inngest Orchestrator (per-source functions)
        │
        ├─► Normalize payload → DocumentDraft
        ├─► Persist document + chunks (PlanetScale transaction)
        ├─► Upload large artifacts (S3)
        ├─► Publish embedding jobs
        ├─► Detect relationships
        └─► Emit evaluation/monitoring events
```

Key properties:
- **Idempotent**: Every ingestion run checks `content_hash` before writing.
- **Durable-first**: Pinecone/Redis updates happen *after* PlanetScale commits.
- **Chunk-aware**: Transformations produce chunk lists to embed asynchronously.
- **Observable**: Each step emits telemetry into `retrieval_logs` and Braintrust evaluation queues (playbook in `docs/EVALUATION_PLAYBOOK.md`).

---

## Event Contracts

### External Events

```typescript
interface SourceEventEnvelope<T> {
  workspaceId: string;
  organizationId: string;
  source: MemorySource;
  action: string;             // 'opened', 'updated', 'closed', etc.
  occurredAt: string;         // ISO timestamp of source system event
  idempotencyKey: string;     // Unique per resource + action
  payload: T;                 // Raw webhook / API payload
}
```

### Internal Events

```typescript
interface KnowledgePersistedEvent {
  name: 'knowledge.persisted';
  data: {
    documentId: string;
    workspaceId: string;
    organizationId: string;
    version: number;
    chunkIds: string[];
    embeddingModel: string;
  };
}

interface EmbeddingRequestedEvent {
  name: 'knowledge.embedding.requested';
  data: {
    documentId: string;
    chunkId: string;
    workspaceId: string;
    embeddingModel: string;
    chunkHash: string;
  };
}
```

`knowledge.persisted` triggers relationship detection, cache warming, Braintrust test scheduling, and Pinecone upserts once embeddings are ready (see `docs/EVALUATION_PLAYBOOK.md`).

---

## Webhook Handling

Example: GitHub pull request handler.

```typescript
export async function POST(request: Request) {
  const body = await request.text();
  verifySignature(body, request.headers.get('x-hub-signature-256'));
  const payload = JSON.parse(body);

  const workspaceId = resolveWorkspace(payload.installation.id);
  const idempotencyKey = buildIdempotencyKey('github', payload);

  if (await redis.get(idempotencyKey)) {
    return new Response('Already processed', { status: 200 });
  }

  await inngest.send({
    name: `github.pr.${payload.action}`,
    data: {
      workspaceId,
      organizationId: payload.organization?.id ?? workspaceId,
      source: 'github',
      action: payload.action,
      occurredAt: payload.pull_request?.updated_at ?? payload.repository.pushed_at,
      idempotencyKey,
      payload,
    },
  });

  await redis.set(idempotencyKey, Date.now(), { ex: 86_400 });
  return new Response('OK');
}
```

- Signatures validated before processing.
- Redis provides a 24h dedupe window; PlanetScale `content_hash` provides long-term idempotency.

---

## Inngest Function Template

```typescript
export const processGitHubPR = inngest.createFunction(
  { id: 'process-github-pr', retries: 3, concurrency: { limit: 8, key: 'event.data.workspaceId' } },
  { event: 'github.pr.*' },
  async ({ event, step }) => {
    const draft = await step.run('normalize', () => normalizePullRequest(event.data));

    const persistenceResult = await step.run('persist', () => persistKnowledgeDraft(draft));
    if (!persistenceResult.didChange) {
      return { skipped: true };
    }

    await step.run('enqueue-embeddings', () => enqueueEmbeddingJobs(persistenceResult));
    await step.run('relationship-detection', () => detectRelationships(persistenceResult));
    await step.run('cache-prime', () => primeCaches(persistenceResult));
    await step.run('emit-event', () => emitPersistedEvent(persistenceResult));

    return { documentId: persistenceResult.documentId, version: persistenceResult.version };
  }
);
```

### `normalizePullRequest`

- Fetches full PR details (reviews, comments) if not present in webhook.
- Generates `KnowledgeDocumentDraft` + `ChunkDraft[]`.
- Computes `content_hash` from normalized payload.

```typescript
interface KnowledgeDocumentDraft {
  document: KnowledgeDocumentInput;      // Fields for `knowledge_documents` table
  chunks: ChunkDraft[];           // Plain text + metadata
  rawArtifacts?: RawArtifact[];   // Attachments to upload to S3
}

interface ChunkDraft {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  sectionLabel?: string;
  keywords: string[];
}
```

---

## Persistence Layer

`persistKnowledgeDraft` wraps database writes in a PlanetScale transaction:

1. Upsert row in `knowledge_documents` using `content_hash` for optimistic concurrency.
2. If the hash changed or row missing:
   - Increment `version`.
   - Insert new chunks into `knowledge_chunks`, marking old ones `superseded_at = now()`.
   - Upload `rawArtifacts` to S3 and update `raw_pointer` fields.
3. Return metadata for downstream steps.

```typescript
async function persistKnowledgeDraft(draft: KnowledgeDocumentDraft): Promise<PersistResult> {
  return await db.$transaction(async (tx) => {
    const existing = await tx.knowledgeDocuments.findUnique(...);
    if (existing && existing.contentHash === draft.document.contentHash) {
      return { didChange: false };
    }

    const version = existing ? existing.version + 1 : 1;
    const docRow = await upsertKnowledgeDocument(tx, draft.document, version);
    const chunkRows = await replaceChunks(tx, docRow.id, version, draft.chunks);
    await uploadArtifacts(docRow, draft.rawArtifacts);

    return {
      didChange: true,
      documentId: docRow.id,
      version,
      chunkIds: chunkRows.map((c) => c.id),
      embeddingModel: selectEmbeddingModel(docRow.workspaceId),
    };
  });
}
```

Cache priming runs after commit so that Redis exposes the latest version.

---

## Embedding Jobs

`enqueueEmbeddingJobs` publishes one `knowledge.embedding.requested` event per chunk. Worker characteristics:

```typescript
export const embedChunk = inngest.createFunction(
  { id: 'embed-chunk', retries: 5, concurrency: { limit: 32, key: 'event.data.workspaceId' } },
  { event: 'knowledge.embedding.requested' },
  async ({ event, step }) => {
    const chunk = await db.knowledgeChunks.findUniqueOrThrow({ where: { id: event.data.chunkId } });
    if (chunk.supersededAt) return { skipped: 'superseded' };

    const embedding = await step.run('generate-embedding', () => embedText(chunk.text));
    await step.run('upsert-pinecone', () => upsertPineconeVector(chunk, embedding));
    await step.run('record-version', () => recordEmbeddingVersion(chunk, embedding));

    return { chunkId: chunk.id };
  }
);
```

- Embedding namespace = `${workspaceId}-${embeddingModelVersion}`.
- Pinecone metadata includes `documentId`, `chunkIndex`, `chunkHash`, `type`, `createdAt`.
- Sparse vectors (optional) are generated inside `embedText` or by an auxiliary worker.

---

## Relationship Detection

Triggered after persistence to keep ingest latency low:

```typescript
async function detectRelationships(result: PersistResult) {
  const chunks = await getChunkTexts(result.chunkIds);
  const references = await extractReferences(chunks.join('\n'));

  const resolved = await resolveReferences(references, result.workspaceId);
  await upsertRelationships(result.documentId, resolved);
}
```

- Resolution first checks deterministic IDs (e.g., `#123` → PR number) via PlanetScale queries before falling back to Pinecone keyword search.
- Writes to `relationships` and pushes adjacency lists into Redis (`refs:*`).

---

## Cache Priming

```typescript
async function primeCaches(result: PersistResult) {
  const doc = await db.knowledgeDocuments.findUniqueOrThrow({ where: { id: result.documentId } });
  const chunks = await db.knowledgeChunks.findMany({ where: { documentId: result.documentId, supersededAt: null }, orderBy: { chunkIndex: 'asc' } });

  await redis.pipeline()
    .set(`document:${doc.id}`, JSON.stringify(doc), { ex: 72 * 60 * 60 })
    .set(`chunks:${doc.id}:v${doc.version}`, JSON.stringify(chunks), { ex: 24 * 60 * 60 })
    .exec();
}
```

Cache priming is best-effort; failures are logged but do not fail the ingestion job.

---

## Braintrust Evaluation Hooks

- Each `knowledge.persisted` event creates a Braintrust test run when relevant benchmark suites exist for the workspace (suite definitions in `docs/EVALUATION_PLAYBOOK.md`).
- Retrieval queries generated from Braintrust scenarios run through the same hybrid pipeline and write results into `feedback_events`.

```typescript
await braintrust.tests.enqueue({
  workspaceId,
  suite: 'post-ingest-regression',
  payload: { documentId, version },
});
```

---

## Error Handling & Retries

- Idempotency keys ensure at-least-once delivery does not duplicate data.
- Persist step retries with exponential backoff; failed transactions roll back cleanly.
- Embedding worker retries transient Pinecone/network errors; repeated failures move the chunk to a dead-letter queue for manual inspection.

---

## Monitoring

- Inngest UI + Grafana dashboards track throughput, failure rates, and queue latency.
- `retrieval_logs` capture per-query latency splits; ingestion writes supplementary metrics (`ingest_latency_ms`, `chunk_count`).
- Alerting thresholds: ingestion backlog > 15 minutes, embedding retry rate > 5%, relationship resolver errors > 2%.

---

_Last reviewed: 2025-02-10_
