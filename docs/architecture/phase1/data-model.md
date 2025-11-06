---
title: Data Model (Phase 1 — Docs)
description: PlanetScale Postgres schema for stores, docs, vector entries, and ingestion commits
status: working
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [schema, drizzle, planetscale]
---

# Data Model (Phase 1 — Docs)

Minimal schema to support push-to-main docs ingestion and Mastra Pinecone indexing.

---

## Goals

- Idempotent ingestion per file/commit
- Fast deletes/updates of chunk vectors
- Store-scoped isolation (workspace + store)
- Lean metadata in index; durable state in DB

---

## Tables

1) stores
- Identity and config per `(workspaceId, store)`

Fields
- id (pk, uuid, varchar(191))
- workspaceId (varchar(191), idx)
- name (varchar(191)) — human store name; unique per workspace
- indexName (varchar(191)) — resolved `ws_${workspaceId}__store_${name}`
- embeddingDim (int) — default 1536
- createdAt, updatedAt (datetime)

Constraints
- unique(workspaceId, name)

2) docs_documents
- Latest version state per repo-relative file path

Fields
- id (pk, uuid)
- storeId (fk → stores.id, idx)
- path (varchar(512)) — repo-relative path
- slug (varchar(256))
- title (varchar(256)) nullable
- description (text) nullable
- contentHash (char(64)) — latest processed
- commitSha (char(40)) — last processed commit
- committedAt (datetime)
- frontmatter (json) nullable
- chunkCount (int) — latest chunk count
- createdAt, updatedAt (datetime)

Constraints/Indexes
- unique(storeId, path)
- index(storeId, slug)

3) vector_entries
- Mapping of doc chunks to vector IDs for idempotent upsert/delete

Fields
- id (pk, varchar(191)) — vectorId used in index (`${docId}#${chunkIndex}` or stable hash)
- storeId (fk → stores.id, idx)
- docId (fk → docs_documents.id, idx)
- chunkIndex (int)
- contentHash (char(64)) — doc version
- indexName (varchar(191)) — Pinecone index via Mastra
- upsertedAt (datetime)

Constraints
- unique(storeId, docId, chunkIndex, contentHash)

4) ingestion_commits
- Idempotency and audit for push deliveries

Fields
- id (pk, uuid)
- storeId (fk → stores.id, idx)
- beforeSha (char(40))
- afterSha (char(40))
- deliveryId (varchar(191)) — GitHub delivery id
- status (enum: processed | skipped | failed)
- processedAt (datetime)

Constraints
- unique(storeId, afterSha)
- unique(storeId, deliveryId)

---

## Drizzle Schemas (TypeScript, Postgres)

```ts
import { pgTable, varchar, timestamp, integer, jsonb, index, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const stores = pgTable('lf_stores', {
  id: varchar('id', { length: 191 }).primaryKey(),
  workspaceId: varchar('workspace_id', { length: 191 }).notNull(),
  name: varchar('name', { length: 191 }).notNull(),
  indexName: varchar('index_name', { length: 191 }).notNull(),
  embeddingDim: integer('embedding_dim').notNull().default(1536),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().default(sql`now()`),
}, (t) => ({
  byWorkspace: index('idx_stores_ws').on(t.workspaceId),
  uniqueStore: uniqueIndex('uq_ws_name').on(t.workspaceId, t.name),
}));

export const docsDocuments = pgTable('lf_docs_documents', {
  id: varchar('id', { length: 191 }).primaryKey(),
  storeId: varchar('store_id', { length: 191 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(),
  slug: varchar('slug', { length: 256 }).notNull(),
  title: varchar('title', { length: 256 }),
  description: text('description'),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  commitSha: varchar('commit_sha', { length: 64 }).notNull(),
  committedAt: timestamp('committed_at', { withTimezone: false }).notNull().default(sql`now()`),
  frontmatter: jsonb('frontmatter'),
  chunkCount: integer('chunk_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().default(sql`now()`),
}, (t) => ({
  byStore: index('idx_docs_store').on(t.storeId),
  bySlug: index('idx_docs_store_slug').on(t.storeId, t.slug),
  uniquePath: uniqueIndex('uq_docs_store_path').on(t.storeId, t.path),
}));

export const vectorEntries = pgTable('lf_vector_entries', {
  id: varchar('id', { length: 191 }).primaryKey(),
  storeId: varchar('store_id', { length: 191 }).notNull(),
  docId: varchar('doc_id', { length: 191 }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  indexName: varchar('index_name', { length: 191 }).notNull(),
  upsertedAt: timestamp('upserted_at', { withTimezone: false }).notNull().default(sql`now()`),
}, (t) => ({
  byStoreDoc: index('idx_vec_store_doc').on(t.storeId, t.docId),
  uniq: uniqueIndex('uq_vec_unique').on(t.storeId, t.docId, t.chunkIndex, t.contentHash),
}));

export const ingestionCommits = pgTable('lf_ingestion_commits', {
  id: varchar('id', { length: 191 }).primaryKey(),
  storeId: varchar('store_id', { length: 191 }).notNull(),
  beforeSha: varchar('before_sha', { length: 64 }).notNull(),
  afterSha: varchar('after_sha', { length: 64 }).notNull(),
  deliveryId: varchar('delivery_id', { length: 191 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('processed'),
  processedAt: timestamp('processed_at', { withTimezone: false }).notNull().default(sql`now()`),
}, (t) => ({
  byStore: index('idx_commits_store').on(t.storeId),
  uniqAfter: uniqueIndex('uq_commit_after').on(t.storeId, t.afterSha),
  uniqDelivery: uniqueIndex('uq_commit_delivery').on(t.storeId, t.deliveryId),
}));
```

---

## Lifecycle & Operations

- Upsert doc: insert or update `docs_documents` with new `contentHash`, `commitSha`, `chunkCount`.
- Upsert chunk vectors: generate stable vector ids; upsert to index and insert `vector_entries` rows (ignore on duplicate).
- Delete doc: find prior `vector_entries` by `(storeId, docId)` and remove corresponding vectors; delete rows.
- Idempotency: dedupe `ingestion_commits` by `(storeId, afterSha)` and `(storeId, deliveryId)`.

Retention
- Keep only latest doc row per `(storeId, path)`.
- Optionally purge old `vector_entries` where `contentHash` != current.
- Keep commits 30–90 days for audit.

---

## Future (Phase 2 hooks)

- Add `embedding_versions` and reference on stores or vectors when we adopt learned embeddings.
- Add `observations`, `summaries`, `profiles`, `relationships` tables.
- Expand vector families or labels for non-docs memory.
