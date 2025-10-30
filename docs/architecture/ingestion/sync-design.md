---
title: Ingestion & Consolidation — Neural Memory
description: Source events to normalized documents/chunks/observations, embedding/indexing, and consolidation
status: working
owner: platform-ingest
audience: engineering
last_updated: 2025-10-28
tags: [ingestion]
---

# Ingestion & Consolidation — Neural Memory

Describes how Lightfast ingests source events, produces both durable Knowledge (chunks) and Neural Memory (observations), persists them, and updates vector indexes. Also covers consolidation jobs that build summaries and profiles.

---

## High-Level Flow

Source Event (GitHub/Slack/Linear/Notion)
        │
        ▼
Ingress Layer (webhooks, pollers) → Idempotency check (Redis)
        │
        ▼
Inngest Orchestrator (per-source functions)
        │
        ├─► Normalize payload → DocumentDraft + ObservationDrafts
        ├─► Persist document + chunks + observations (Drizzle transaction, PlanetScale)
        ├─► Upload large artifacts (S3)
        ├─► Publish embedding/index jobs (chunks/observations)
        ├─► Detect relationships (deterministic first)
        └─► Emit evaluation/monitoring events

Key properties
- Idempotent writes via `content_hash` + Redis dedupe keys
- Durable-first: vector/cache updates follow committed DB writes
- Dual products: chunk lists and observation lists from the same payload
- Observable: telemetry into retrieval logs and Braintrust queues

---

## Event Contracts

External envelope

```ts
interface SourceEventEnvelope<T> {
  workspaceId: string;
  organizationId: string;
  source: string;
  action: string;
  occurredAt: string;         // ISO timestamp of source system event
  idempotencyKey: string;     // Unique per resource + action
  payload: T;                 // Raw webhook / API payload
}
```

Internal events

```ts
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
  data: { documentId: string; chunkId: string; workspaceId: string; embeddingModel: string; chunkHash: string };
}

interface ObservationPersistedEvent {
  name: 'memory.observation.created';
  data: { observationId: string; workspaceId: string; occurredAt: string; importance: number; embeddingModel: string };
}

interface ObservationEmbeddingRequestedEvent {
  name: 'memory.observation.embedding.requested';
  data: { observationId: string; workspaceId: string; embeddingModel: string };
}
```

`knowledge.persisted` schedules chunk embeddings, relationship detection, cache priming, and eval. `memory.observation.created` schedules observation embeddings and may trigger consolidation.

---

## Webhook Handling (example)

```ts
export async function POST(request: Request) {
  const body = await request.text();
  verifySignature(body, request.headers.get('x-hub-signature-256'));
  const payload = JSON.parse(body);

  const workspaceId = resolveWorkspace(payload.installation.id);
  const idempotencyKey = buildIdempotencyKey('github', payload);

  if (await redis.get(idempotencyKey)) return new Response('Already processed', { status: 200 });

  await inngest.send({
    name: `github.pr.${payload.action}`,
    data: { workspaceId, organizationId: payload.organization?.id ?? workspaceId, source: 'github', action: payload.action, occurredAt: payload.pull_request?.updated_at ?? payload.repository.pushed_at, idempotencyKey, payload },
  });

  await redis.set(idempotencyKey, Date.now(), { ex: 86_400 });
  return new Response('OK');
}
```

---

## Inngest Function Template

```ts
export const processGitHubPR = inngest.createFunction(
  { id: 'process-github-pr', retries: 3, concurrency: { limit: 8, key: 'event.data.workspaceId' } },
  { event: 'github.pr.*' },
  async ({ event, step }) => {
    const draft = await step.run('normalize', () => normalizePullRequest(event.data));

    const persistenceResult = await step.run('persist', () => persistKnowledgeDraft(draft));
    if (!persistenceResult.didChange) return { skipped: true };

    await step.run('enqueue-embeddings', () => enqueueEmbeddingJobs(persistenceResult));
    await step.run('enqueue-observation-embeddings', () => enqueueObservationEmbeddings(persistenceResult));
    await step.run('relationship-detection', () => detectRelationships(persistenceResult));
    await step.run('cache-prime', () => primeCaches(persistenceResult));
    await step.run('emit-events', () => emitPersistedEvent(persistenceResult));

    return { documentId: persistenceResult.documentId, version: persistenceResult.version };
  }
);
```

### normalizePullRequest

- Fetch full PR context (reviews, comments) if needed.
- Generate `KnowledgeDocumentDraft` + `ChunkDraft[]` + `ObservationDraft[]`.
- Compute `content_hash` from normalized payload.

```ts
interface KnowledgeDocumentDraft {
  document: KnowledgeDocumentInput;      // for `knowledge_documents`
  chunks: ChunkDraft[];                  // plain text + metadata
  observations: ObservationDraft[];      // salient moments (titles, decisions, incident lines)
  rawArtifacts?: RawArtifact[];          // attachments for S3
}

interface ChunkDraft { chunkIndex: number; text: string; tokenCount: number; sectionLabel?: string; keywords: string[]; }

interface ObservationDraft { text: string; title?: string; summary?: string; occurredAt: string; importance: number; tags?: string[]; subjectRefs?: SubjectRef[]; }
```

---

## Persistence Layer

```ts
async function persistKnowledgeDraft(draft: KnowledgeDocumentDraft): Promise<PersistResult> {
  return await db.$transaction(async (tx) => {
    const existing = await tx.knowledgeDocuments.findUnique(...);
    if (existing && existing.contentHash === draft.document.contentHash) return { didChange: false };

    const version = existing ? existing.version + 1 : 1;
    const docRow = await upsertKnowledgeDocument(tx, draft.document, version);
    const chunkRows = await replaceChunks(tx, docRow.id, version, draft.chunks);
    const obsRows = await insertObservations(tx, docRow.workspaceId, draft.observations, docRow.id);
    await uploadArtifacts(docRow, draft.rawArtifacts);

    return { didChange: true, documentId: docRow.id, version, chunkIds: chunkRows.map((c) => c.id), observationIds: obsRows.map((o) => o.id), embeddingModel: selectEmbeddingModel(docRow.workspaceId) };
  });
}
```

Cache priming runs after commit.

---

## Embedding Jobs

Chunks

```ts
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

Observations

```ts
export const embedObservation = inngest.createFunction(
  { id: 'embed-observation', retries: 5, concurrency: { limit: 32, key: 'event.data.workspaceId' } },
  { event: 'memory.observation.embedding.requested' },
  async ({ event, step }) => {
    const obs = await db.memoryObservations.findUniqueOrThrow({ where: { id: event.data.observationId } });
    const emb = await step.run('generate-embedding', () => embedObservationViews(obs));
    await step.run('upsert-pinecone', () => upsertObservationVectors(obs, emb));
    await step.run('record-version', () => recordObservationEmbeddingVersion(obs, emb));
    return { observationId: obs.id };
  }
);
```

Namespaces
- `${workspaceId}-${embeddingModelVersion}` per family (chunks, observations, summaries, profiles)

---

## Relationship Detection

Run post-persist to minimize ingest latency.

```ts
async function detectRelationships(result: PersistResult) {
  const chunks = await getChunkTexts(result.chunkIds);
  const references = await extractReferences(chunks.join('\n'));
  const resolved = await resolveReferences(references, result.workspaceId);
  await upsertRelationships(result.documentId, resolved);
}
```

Deterministic first; LLM-assisted extraction can propose edges with confidence gating and evidence spans.

---

## Cache Priming

```ts
async function primeCaches(result: PersistResult) {
  const doc = await db.knowledgeDocuments.findUniqueOrThrow({ where: { id: result.documentId } });
  const chunks = await db.knowledgeChunks.findMany({ where: { documentId: result.documentId, supersededAt: null }, orderBy: { chunkIndex: 'asc' } });
  await redis.pipeline()
    .set(`document:${doc.id}`, JSON.stringify(doc), { ex: 72 * 60 * 60 })
    .set(`chunks:${doc.id}:v${doc.version}`, JSON.stringify(chunks), { ex: 24 * 60 * 60 })
    .exec();
}
```

Best-effort; failures are logged.

---

## Consolidation Jobs

- Cluster observations by entity/topic/time to create `memory_summaries`; embed and index summaries.
- Rebuild `memory_profiles` centroids per entity; compute drift and descriptors.
- Trigger on thresholds (count/time) or via nightly cron per workspace.

---

## Braintrust Evaluation Hooks

- `knowledge.persisted` and consolidation jobs enqueue regression suites.
- Evaluate recall/precision, rerank calibration, snippet accuracy, and rationale faithfulness.

---

## Error Handling, Monitoring

- Idempotency keys + transaction retries with exponential backoff.
- Retry transient Pinecone/network errors; dead-letter on repeated failures.
- Dashboards show throughput, queue latency, retry rates; alerts on backlogs and error spikes.

---

_Last reviewed: 2025-10-28_
