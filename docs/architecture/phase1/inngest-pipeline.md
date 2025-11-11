---
title: Inngest Pipeline — Docs Ingestion (v1)
description: Event-driven flow from GitHub push → glob match → chunk → embed → upsert via Mastra Pinecone
status: working
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [inngest, ingestion, pipeline]
---

# Inngest Pipeline — Docs Ingestion (v1)

Diagrammatic flow for v1 docs ingestion: GitHub push to main → match repo-relative globs from `lightfast.yml` → chunk → embed (char-hash 1536) → upsert via Mastra Pinecone.

---

## High-Level Diagram

```
GitHub (push:main)
       │ webhook
       ▼
Ingress (verify, auth, workspace) ──► Inngest event: docs.push.main
       │                                       │
       │                                       ▼
       │                             Fn: docs_push_main
       │                                ├─ load lightfast.yml
       │                                ├─ read include globs
       │                                ├─ fetch commit diff
       │                                ├─ filter changed files
       │                                ├─ build file tasks (content_hash)
       │                                └─ emit per-file events:
       │                                      • docs.file.changed
       │                                      • docs.file.deleted
       │
       ▼
Inngest event: docs.file.changed ─────► Fn: docs_file_changed
                                              ├─ fetch file contents
                                              ├─ parse MDX frontmatter
                                              ├─ derive slug + url (from path)
                                              ├─ persist doc row (content_hash)
                                              ├─ chunk (len=1600, overlap=200)
                                              └─ emit docs.chunk.embed (per chunk)

Inngest event: docs.chunk.upsert ─────► Fn: docs_chunk_upsert
                                             ├─ char-hash embedding (dim=1536)
                                             ├─ L2 normalize
                                             └─ Upsert to Mastra Pinecone index

Inngest event: docs.file.deleted ─────► Fn: docs_file_deleted
                                             └─ Delete chunk IDs from Mastra Pinecone index
```

---

## Events and Functions (contracts)

Event: `docs.push.main`
- Emitted by ingress handler after verifying GitHub push (main branch) and resolving `workspaceId` and `store` from `lightfast.yml`.

Payload
```ts
interface DocsPushMainEvent {
  workspaceId: string;
  store: string;               // v1 key
  repo: { remote: string; defaultBranch: string };
  commit: { before: string; after: string; timestamp: string };
}
```

Fn: `docs_push_main`
- Steps: load config → compute diff → filter files by `include` globs → classify added/modified/deleted → compute `content_hash` for changed files → emit per-file events.

Emits
```ts
// changed or added
event 'docs.file.changed': {
  workspaceId, store, path: string, sha: string, contentHash: string, committedAt: string
}

// removed/renamed (old path)
event 'docs.file.deleted': {
  workspaceId, store, path: string, sha: string, committedAt: string
}
```

Fn: `docs_file_changed`
- Fetch file contents at commit → parse MDX (frontmatter/title/description) → derive slug/url from path (repo-relative) → upsert doc row with `content_hash` (idempotent) → chunk body (v1: char-based) → emit `docs.chunk.embed` per chunk.

Emits
```ts
event 'docs.chunk.upsert': {
  workspaceId, store, slug: string, path: string,
  chunkIndex: number, text: string, contentHash: string, committedAt: string
}
```

Fn: `docs_chunk_upsert`
- Compute char 3–5-gram hashed embedding to 1536-dim; L2 normalize → upsert chunk vector + metadata to Mastra Pinecone.

Metadata (per vector)
```ts
{
  workspaceId, store, slug, path, contentHash, chunkIndex, committedAt,
  title?, description?
}
```

Fn: `docs_file_deleted`
- Compute prior chunk IDs (from cache or doc row) and delete from Pinecone.

---

## Idempotency & Keys

- Event-level: use GitHub delivery id to dedupe `docs.push.main`.
- File-level: `(workspaceId, store, path, contentHash)` ensures we skip unchanged files.
- Chunk-level: `(workspaceId, store, path, contentHash, chunkIndex)` identifies vectors.

---

## Mastra Pinecone Integration Details

- Index: one Pinecone index per `(workspaceId, store)` via the official `@pinecone-database/pinecone` SDK.
- Index name format: `ws_${workspaceId}__store_${store}` (URL-safe); dimension=1536.
- Vector IDs: `${docId}#${chunkIndex}` (or stable hash of path + chunkIndex) for idempotence.
- Search: Lightfast wraps Mastra Pinecone query behind `/v1/search` (store index)

---

## Retrieval Path (for context)

`/v1/search` (docs store)
- Queries the Mastra Pinecone index (store), optional rerank (if enabled) → snippets → return JSON (title, url, snippet, score, requestId, latency splits).

apps/docs `/api/search`
- Thin proxy that scopes by `store:<name>`.

---

## Observability

- Ingestion metrics: diff counts, files changed, chunks produced, embedding + upsert latency, dedupe hits.
- Retrieval: query latency (Pinecone via Mastra), rerank latency (if used), final K; p95 dashboards.
- Errors: retry transient upserts; soft-fail rerank.

---

## Pseudocode (Inngest)

```ts
export const docs_push_main = inngest.createFunction(
  { id: 'docs-push-main', retries: 3, concurrency: { limit: 8, key: 'event.data.workspaceId' } },
  { event: 'docs.push.main' },
  async ({ event, step }) => {
    const cfg = await step.run('load-config', () => loadLightfastYml(event.data));
    const diff = await step.run('diff', () => getCommitDiff(event.data.commit));
    const files = filterByGlobs(diff.changed, cfg.include);
    const tasks = await step.run('hash', () => addContentHashes(files));
    await step.send(
      tasks.map(t => ({ name: 'docs.file.changed', data: { ...t, workspaceId: event.data.workspaceId, store: cfg.store } }))
    );
    const removed = filterByGlobs(diff.deleted, cfg.include);
    await step.send(
      removed.map(p => ({ name: 'docs.file.deleted', data: { path: p, workspaceId: event.data.workspaceId, store: cfg.store } }))
    );
  }
);
```

```ts
export const docs_file_changed = inngest.createFunction(
  { id: 'docs-file-changed', retries: 3 },
  { event: 'docs.file.changed' },
  async ({ event, step }) => {
    const body = await step.run('fetch-file', () => fetchFile(event.data));
    if (isSameHash(event.data)) return { skipped: true };
    const doc = await step.run('upsert-doc', () => upsertDoc(event.data, body));
    const chunks = await step.run('chunk', () => chunkBody(body));
    await step.send(
      chunks.map((c, i) => ({ name: 'docs.chunk.embed', data: { ...event.data, chunkIndex: i, text: c } }))
    );
  }
);
```

```ts
export const docs_chunk_upsert = inngest.createFunction(
  { id: 'docs-chunk-upsert', retries: 5, concurrency: { limit: 32, key: 'event.data.workspaceId' } },
  { event: 'docs.chunk.upsert' },
  async ({ event, step }) => {
    const vec = await step.run('embed', () => charHashEmbed1536(event.data.text));
    await step.run('upsert', () => mastraPineconeUpsert(event.data, vec));
  }
);
```
