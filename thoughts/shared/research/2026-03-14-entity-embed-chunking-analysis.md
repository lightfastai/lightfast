---
date: 2026-03-14T09:25:27+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Do we need a chunking strategy for entity-embed.ts?"
tags: [research, codebase, entity-embed, narrative-builder, cohere, pinecone, embedding]
status: complete
last_updated: 2026-03-14
---

# Research: Do We Need a Chunking Strategy for `entity-embed.ts`?

**Date**: 2026-03-14T09:25:27+00:00
**Git Commit**: 4ec3c541776200e318c670c5064af752d9e142f0
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Consider `api/console/src/inngest/workflow/neural/entity-embed.ts` — do we need a chunking strategy for the embed?

## Summary

No chunking strategy exists today, and the current architecture is intentionally **one vector per entity**. The narrative fed to Cohere is a compact, structured string of bounded sections. However, Cohere `embed-english-v3.0` has a 512-token context window, and the SDK call passes **no `truncate` parameter** — meaning the Cohere API silently discards tokens from the **tail** of the narrative when the input exceeds ~512 tokens. Since the narrative sections are ordered most-important-first (identity → genesis → temporal span → recent events → graph edges), the graph edges section — which appears last — is the first content to be silently dropped in a truncation scenario.

The existing `chunkMaxTokens` / `chunkOverlap` workspace settings are unrelated to entity embedding; they were part of the now-deleted document chunking system (`console-chunking` package).

---

## Detailed Findings

### 1. Narrative Structure and Length (`narrative-builder.ts`)

**File**: `api/console/src/inngest/workflow/neural/narrative-builder.ts`

`buildEntityNarrative` assembles a plain-text string from five discrete sections joined by `"\n\n"`:

| # | Section | Always present? | Max chars (est.) |
|---|---|---|---|
| 1 | `{category} {key}: {value}` | Yes | 50 + 500 + unbounded `text` |
| 2 | `Created: {date} {action}: {title}` | Only if genesis event exists | ~250 (titles ≤120 chars by convention) |
| 3 | `First seen: {date} | Last seen: {date} | Events: {n}` | Yes | ~60 |
| 4 | `Recent:\n  {date} {action}: {title}` × 0–3 | Only if events exist | ~400 (3 × ~130 chars) |
| 5 | `Related:\n  {rel} → {cat} {key}` × 0–10 | Only if edges exist | ~1,800 (10 × ~180 chars) |

**Realistic upper bound**: ~2,900 chars total (full entity, 3 events, 10 edges, 120-char titles).

There is **no truncation inside `buildEntityNarrative`** itself. The only hard ceiling is `edges.slice(0, 10)` at line 72, capping the edge section regardless of how many edges are passed in.

Upstream caps set by the DB queries in `entity-embed.ts`:
- Genesis: `LIMIT 1` (`entity-embed.ts:101`)
- Recent events: `LIMIT 3` (`entity-embed.ts:117`)
- Edges: `LIMIT 10` (`entity-embed.ts:132`)

`narrativeHash` (`narrative-builder.ts:86-88`) computes `sha256(narrative).hex().slice(0, 16)` — a 16-char stable fingerprint of the full narrative string. It is stored in Pinecone metadata but **does not currently gate the embed step** — the embed always runs regardless of hash change.

### 2. Embedding Model and Token Limit

**File**: `packages/console-validation/src/constants/embedding.ts:32-39`

The active model is **Cohere `embed-english-v3.0`** with dimension `1024`. This is the only model wired in production — `createEmbeddingProviderForWorkspace` always passes `EMBEDDING_CONFIG.cohere.model` regardless of the workspace's stored `embeddingModel` string (`packages/console-embed/src/utils.ts:149`).

The workspace `embeddingModel` field is a free `z.string()` in `workspaceEmbeddingConfigSchema` (`packages/console-validation/src/schemas/workspace-settings.ts:10`), but at the store-configuration level it is enum-validated against `cohereEmbeddingModelSchema` (6 values: `embed-english-v3.0`, `embed-multilingual-v3.0`, `embed-english-light-v3.0`, `embed-multilingual-light-v3.0`, `embed-english-v2.0`, `embed-multilingual-v2.0` — `packages/console-validation/src/schemas/store.ts:113-120`).

**Only `embeddingDim: 1024` appears anywhere in the codebase** — no `1536` or `3072` values exist in constants, schemas, or tests.

Cohere's `embed-english-v3.0` context window: **512 tokens**.

### 3. Cohere Token Truncation Behaviour

**File**: `vendor/embed/src/provider/cohere.ts:111-116`

The SDK call is:

```ts
const response = await this.client.embed({
  texts,
  model: this.model,
  inputType: this.inputType,
  embeddingTypes: ["float"],
});
```

**No `truncate` parameter is passed**. There is zero mention of `"truncate"` anywhere in `vendor/embed/src/`. The SDK declares the field as `.optional()` (`node_modules/.pnpm/cohere-ai@7.20.0/.../EmbedRequest.js:48`), so when omitted the field is absent from the HTTP body.

The Cohere API's documented server-side default when `truncate` is absent is **`"END"`**:

> Passing `END` will discard the end of the input [...] until the remaining input is exactly the maximum input token length for the model.

Source: SDK JSDoc at `cohere-ai@7.20.0/.../EmbedRequest.d.ts:43-49`.

**What this means in practice**: When a narrative exceeds ~512 tokens, Cohere silently truncates from the tail of the string and returns a valid embedding with no error. The pipeline has no visibility into this (no warning, no usage flag from the API response that would indicate truncation occurred). There is no `truncate: "NONE"` guard to surface an error if the limit is breached.

Given the narrative's section order (identity → genesis → temporal span → recent events → graph edges), the content most at risk of silent truncation is:
- The **graph edges section** (last section, up to ~1,800 chars / ~450 tokens alone)
- The **recent events section** (second-to-last, up to ~400 chars / ~100 tokens)

### 4. Pinecone Vector Structure — One Vector Per Entity

**Files**: `api/console/src/inngest/workflow/neural/entity-embed.ts:202-210`, `api/console/src/router/org/search.ts:128-162`

The design is definitively **one vector per entity**. The upsert call always passes a single-element array:

```ts
consolePineconeClient.upsertVectors<EntityVectorMetadata>(
  indexName,
  { ids: [`ent_${entity.externalId}`], vectors: [embedding], metadata: [metadata] },
  namespaceName
)
```

The `ent_` prefix appears only at `entity-embed.ts:205` and `entity-embed.ts:215` — nowhere else in the codebase constructs or queries by this ID prefix. Search consumers filter by `layer: "entities"` metadata, not by ID prefix (`search.ts:151` comment: `"entity layer only (one vector per entity, no duplicates)"`).

`EntityVectorMetadata` fields stored per vector (`packages/console-validation/src/schemas/neural.ts:21-46`):

| Field | Source |
|---|---|
| `layer` | hardcoded `"entities"` |
| `entityExternalId` | `entity.externalId` |
| `entityType` | `entity.category` |
| `provider` | `event.data.provider` |
| `latestAction` | last `.`-segment of `latestEvent.sourceType` |
| `title` | first line of narrative (identity section) |
| `snippet` | first 500 chars of narrative |
| `occurredAt` | Unix ms of latest event |
| `createdAt` | Unix ms of `entity.extractedAt` |
| `narrativeHash` | 16-char SHA-256 hex prefix |
| `totalEvents` | `entity.occurrenceCount` |
| `significanceScore` | `MAX(significanceScore)` across linked events |

### 5. Existing `chunkMaxTokens` / `chunkOverlap` Workspace Settings

**File**: `packages/console-validation/src/schemas/workspace-settings.ts:15-16`

```ts
chunkMaxTokens: z.number().int().min(64).max(4096).default(512),
chunkOverlap: z.number().int().min(0).max(1024).default(50),
```

These fields exist in `workspaceEmbeddingConfigSchema` and in `EMBEDDING_DEFAULTS` (`packages/console-validation/src/constants/embedding.ts:57-58`). They **are not consumed by `entity-embed.ts`** or any surviving entity pipeline code. They were part of the now-deleted `console-chunking` package (deleted on this branch: `packages/console-chunking/` files are marked `D` in git status). They remain in the workspace settings schema as vestigial fields.

---

## Code References

- `api/console/src/inngest/workflow/neural/entity-embed.ts:29` — `entityEmbed` Inngest function (sole entity vector producer)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:84-146` — DB queries feeding the narrative
- `api/console/src/inngest/workflow/neural/entity-embed.ts:152-158` — `buildEntityNarrative` + `narrativeHash` call
- `api/console/src/inngest/workflow/neural/entity-embed.ts:162-178` — `embed-narrative` step (passes full narrative string)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:202-210` — `upsert-entity-vector` step (single `ent_<id>` vector)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:31-80` — `buildEntityNarrative` implementation
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:86-88` — `narrativeHash` (SHA-256 prefix)
- `vendor/embed/src/provider/cohere.ts:111-116` — SDK embed call (no `truncate` param)
- `packages/console-embed/src/utils.ts:143-153` — `createEmbeddingProviderForWorkspace` (ignores workspace `embeddingModel`)
- `packages/console-validation/src/constants/embedding.ts:32-39` — defaults: model `embed-english-v3.0`, dim `1024`
- `packages/console-validation/src/schemas/neural.ts:21-46` — `EntityVectorMetadata` Zod schema
- `packages/console-validation/src/schemas/workspace-settings.ts:6-17` — `workspaceEmbeddingConfigSchema` (includes vestigial `chunkMaxTokens`)
- `api/console/src/router/org/search.ts:128-162` — search query with `layer: "entities"` filter

## Architecture Documentation

### Current embedding pipeline (per entity trigger)

```
apps-console/entity.graphed event
        │
        ▼ (debounce 30s per entityExternalId)
entityEmbed Inngest function
        │
        ├─ step: fetch-entity      → workspaceEntities row
        ├─ step: fetch-workspace   → orgWorkspaces row (indexName, namespaceName, dim)
        ├─ step: fetch-narrative-inputs → 4 parallel DB queries
        │         ├─ genesis event (oldest, LIMIT 1)
        │         ├─ recent events (newest 3, LIMIT 3)
        │         ├─ graph edges (LIMIT 10, joined to workspaceEntities)
        │         └─ MAX(significanceScore)
        │
        ├─ buildEntityNarrative()  → plain-text string (no truncation, no limit)
        ├─ narrativeHash()         → 16-char SHA-256 prefix
        │
        ├─ step: embed-narrative   → CohereEmbedding.embed([narrative])
        │         └─ Cohere API: POST /v1/embed (truncate="END" by server default)
        │
        └─ step: upsert-entity-vector → Pinecone upsert
                  ids: ["ent_<externalId>"]   ← single vector, overwrites previous
                  vectors: [float[1024]]
                  metadata: EntityVectorMetadata
```

### Narrative section order (relevant to truncation tail)

```
Line 1:  {category} {key}: {value}          ← identity, always first
Line 2:  (blank)
Line 3:  Created: {date} {action}: {title}  ← genesis, if present
Line 4:  (blank)
Line 5:  First seen: … | Last seen: … | Events: …  ← temporal span
Line 6:  (blank)
Line 7:  Recent:
Line 8:    {date} {action}: {title}         ← ┐
...                                           ├─ up to 3 events
Line N:  (blank)
Line N+1: Related:
Line N+2:   {rel} → {cat} {key}            ← ┐
...                                           └─ up to 10 edges  ← last, most at risk
```

## Open Questions

- Does Cohere's API response include any signal (usage metadata, header) when `"END"` truncation is applied, that could be surfaced in `CohereEmbedding.embed()`'s return value?
- What is the actual token count of a typical entity narrative in production (requires runtime instrumentation or sampling)?
- Are the vestigial `chunkMaxTokens` / `chunkOverlap` fields in `workspaceEmbeddingConfigSchema` still written to the DB for existing workspaces?
