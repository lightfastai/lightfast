---
date: 2026-03-14T06:41:12Z
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Inngest pipeline audit: search architecture, dedup, linking, and future provider readiness"
tags: [research, audit, inngest, pipeline, search, entities, pinecone, architecture, critical-analysis]
status: complete
last_updated: 2026-03-14
---

# Research: Inngest Pipeline Architecture Audit

**Date**: 2026-03-14T06:41:12Z
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Go through the entire `@api/console/src/inngest/` pipeline for ingesting data. Build an architectural understanding of the entire architecture. Critically evaluate whether it is designed in the most accretive, efficient, and useful manner against the goal of: **the simplest search of all company data with proper dedup + linking of data**, considering 20-30 real user search queries, temporal/actor/event relationship dimensions, and future addition of Intercom, Clerk, Apollo, and Stripe.

---

## The Current Architecture

### Registered Inngest Functions

`api/console/src/inngest/index.ts:65`

| Function | Trigger | Path | SLA |
|---|---|---|---|
| `eventStore` | `event.capture` | Fast path | <2s |
| `entityGraph` | `entity.upserted` | Fast path | <500ms |
| `entityEmbed` | `entity.graphed` | Fast path (debounced 30s) | ~2s |
| `eventInterpret` | `event.stored` | Slow path | 5-30s |
| `processDocuments` | `documents.process` | Separate pipeline | 15m timeout |
| `deleteDocuments` | `documents.delete` | Separate pipeline | — |
| `recordActivity` | `activity.record` | Infrastructure | — |
| `notificationDispatch` | `notification.dispatch` | Notification | — |

### Event Flow

```
Webhook / Backfill
        ↓
apps-console/event.capture
        ↓
eventStore (fast path — <2s, 8 steps)
  ├─ Step 0:  generate-replay-safe-ids (nanoid, timestamp)
  ├─ Step 1:  resolve-clerk-org-id (from event or DB fallback)
  ├─ Step 2:  create-job (workspaceWorkflowRuns)
  ├─ Step 3:  check-duplicate (workspaceEvents by sourceId)
  ├─ Step 4:  check-event-allowed (workspaceIntegrations, providerConfig.sync.events)
  ├─ Step 5:  evaluate-significance (rule-based, threshold=40) — GATE
  ├─ Step 6:  extract-entities (regex + structured relations)
  ├─ Step 7:  store-observation (workspaceEvents INSERT)
  ├─ Step 8:  upsert-entities-and-junctions (workspaceEntities + workspaceEntityEvents)
  └─ Step 9:  emit-downstream-events (2 events in parallel):
              ├── apps-console/event.stored   → eventInterpret (slow path)
              └── apps-console/entity.upserted → entityGraph

entityGraph (fast, <500ms)
  ├─ resolveEdges (co-occurrence algorithm, pure SQL)
  │   ├─ Filter entityRefs to STRUCTURAL_TYPES only
  │   ├─ Find our entity rows
  │   ├─ Find co-occurring events via junction (limit 100)
  │   ├─ Load ALL entities for co-occurring events
  │   ├─ Evaluate EdgeRules from PROVIDERS registry
  │   └─ INSERT workspaceEdges (onConflictDoNothing)
  └─ emit entity.graphed → entityEmbed

entityEmbed (debounced 30s per entityExternalId, ~2s)
  ├─ fetch-entity
  ├─ fetch-workspace
  ├─ fetch-narrative-inputs (3 parallel queries):
  │   ├─ genesis event (oldest 1)
  │   ├─ recent events (latest 3)
  │   └─ edges (up to 10, with target entity details)
  ├─ buildEntityNarrative() — pure CPU, outside step
  ├─ embed-narrative (workspace embedding provider)
  └─ upsert-entity-vector (Pinecone, layer="entities", id=ent_{externalId})

eventInterpret (slow path, 5-30s)
  ├─ fetch-observation-and-workspace (parallel)
  ├─ classify-observation (Claude Haiku via step.ai.wrap, fallback: regex)
  ├─ generate-multi-view-embeddings (title, content, summary — 3 vectors)
  ├─ upsert-multi-view-vectors (Pinecone, layer="observations", 3 vectors per event)
  ├─ store-interpretation (workspaceInterpretations INSERT)
  └─ emit event.interpreted → notificationDispatch

processDocuments (separate pipeline, batch=25, unrelated to event pipeline)
  ├─ chunk content (workspace embedding config)
  ├─ generate embeddings (Cohere, batch 96)
  ├─ upsert vectors to Pinecone (NO layer tag, id=docId#chunkIndex)
  ├─ persist workspaceKnowledgeDocuments + workspaceKnowledgeVectorChunks
  └─ emit relationships.extract (⚠️ NO HANDLER REGISTERED)
```

### Search Layer

`api/console/src/router/org/search.ts:129`

```
User query string
  → embed query (workspace embedding provider, inputType="search_query")
  → Pinecone query (filter: { layer: "entities" })
  → map EntityVectorMetadata → SearchResult
  → return array
```

The search exclusively queries `layer="entities"`. The observation layer and document layer are **never queried**.

### DB Tables in Play

| Table | Purpose | Written by | Read by |
|---|---|---|---|
| `workspaceEvents` | Raw atomic events | eventStore | eventInterpret, entityEmbed, entityGraph |
| `workspaceEntities` | Deduplicated entity registry | eventStore | entityEmbed, entityGraph |
| `workspaceEntityEvents` | Entity ↔ event junction | eventStore | entityGraph, entityEmbed |
| `workspaceEdges` | Entity ↔ entity graph | entityGraph | entityEmbed |
| `workspaceInterpretations` | LLM classification + vector IDs | eventInterpret | **NEVER READ** |
| `workspaceKnowledgeDocuments` | Static docs (code, config) | processDocuments | **NEVER READ** at search |
| `workspaceKnowledgeVectorChunks` | Chunk tracking | processDocuments | processDocuments (dedup) |
| `workspaceUserActivities` | User activity log | recordActivity | **NEVER READ** |
| `workspaceIntegrations` | Source/repo integrations | external | eventStore (auth) |

---

## 20-30 Search Queries Against This Architecture

This is the core stress test. For each query, I'll assess whether the current pipeline can satisfy it.

### Temporal Queries

| # | Query | Can answer? | Gap |
|---|---|---|---|
| 1 | "What happened last week?" | Partial | Date filter on `occurredAt` works, but only returns entity snapshots — no event list |
| 2 | "What changed in the auth system this month?" | No | Topic/domain filtering not exposed; entity type ≠ topic |
| 3 | "What was deployed to production today?" | No | `observationType` filter not in search API; no deployment entity type |
| 4 | "What's been happening with the payments service?" | Partial | If "payments" is in entity key, the narrative will surface it. Topic filtering not possible |
| 5 | "Show me infrastructure changes this quarter" | No | Classification `infrastructure` is stored in `workspaceInterpretations` but never queried |

### Actor-Centric Queries

| # | Query | Can answer? | Gap |
|---|---|---|---|
| 6 | "What has @jeevanpillay been working on?" | Partial | `engineer` entity extracted via regex; no Clerk user resolution; no semantic join |
| 7 | "Who created this feature?" | No | Attribution requires actor → PR → commit chain; edges exist but no query path from actor |
| 8 | "What was the last thing deployed by the backend team?" | No | Team concept doesn't exist; no actor grouping |
| 9 | "Who owns the auth service?" | No | No ownership model; engineer entities are extracted from mentions, not system-of-record |

### Event-Level Queries

| # | Query | Can answer? | Gap |
|---|---|---|---|
| 10 | "Show me all PRs related to ENG-123" | Partial | Edges link `issue:ENG-123` → `pr:...`, but no traversal API from search |
| 11 | "What commits went into the last release?" | No | No release entity type; release → commit chain requires graph traversal |
| 12 | "What bugs were filed after the last deploy?" | No | Causal ordering: deploy → sentry issue requires cross-source temporal query |
| 13 | "What's the status of the mobile app?" | Partial | Narrative might surface recent events; but "status" needs structured state, not narrative text |
| 14 | "Which deployments failed this week?" | No | No deployment entity type; `deployment` is a relation type, not a first-class entity in most cases |

### Cross-Source / Linking Queries

| # | Query | Can answer? | Gap |
|---|---|---|---|
| 15 | "What Sentry errors spiked after the deploy?" | No | Temporal causal query; GitHub deploy ↔ Sentry error linking requires timestamp comparison |
| 16 | "What Linear issues closed because of which PRs?" | Partial | Edge: `issue` → `pr` via co-occurrence. But no causal direction (which came first?) |
| 17 | "What features shipped in Q1?" | No | Needs classification filter (feature) + time range + cross-source aggregation |
| 18 | "Why was this file changed?" | Partial | `definition`/`endpoint` entities in graph could surface PRs. But no "why" reasoning |
| 19 | "What's the blast radius of this API change?" | Partial | `endpoint` entity → edges → related PRs, but no downstream dependency graph |
| 20 | "Which APIs are most error-prone?" | No | Requires endpoint → sentry error co-occurrence + frequency count. Not possible currently |

### Future Provider Queries (Intercom, Clerk, Apollo, Stripe)

| # | Query | Requires | Gap |
|---|---|---|---|
| 21 | "Find all open bugs reported by customers" | Intercom → Linear linking | No `customer`/`ticket` entity type; no cross-provider actor resolution |
| 22 | "What does the payment flow look like end to end?" | Stripe + code + deploys | No `payment` entity type; no financial event schema |
| 23 | "Which users were affected by the auth outage?" | Clerk + Sentry | No `user_session` entity type; no Clerk user → event linking |
| 24 | "Show me the feature lifecycle for dark mode" | All sources | Requires idea → issue → PR → merge → deploy → customer feedback chain |
| 25 | "Which customers complained about performance?" | Intercom + Sentry | No customer entity; no conversation-to-code linking |
| 26 | "What deals are in flight that need this feature?" | Apollo + Linear | No CRM entity type |

**Score: The current architecture can meaningfully answer roughly 4-6 of 26 queries.** The rest hit structural gaps.

---

## Critical Assessment

### What's Working Well

**1. Entity deduplication is sound**
`event-store.ts:449-530` — Upsert by `(workspaceId, category, key)` with `onConflictDoUpdate` incrementing `occurrenceCount`. This is correct. The entity registry accumulates all occurrences without duplication.

**2. Fast/slow path separation is correct**
The <2s fast path stores facts; the 5-30s slow path handles LLM classification. This is the right design — you don't block the ingestion critical path on LLM latency.

**3. Genesis + recency narrative design**
`narrative-builder.ts:44-67` — Keeping the first event and last 3 events prevents the entity narrative from becoming purely recency-biased. This is a good design for preserving founding context.

**4. Inngest idempotency key**
`event-store.ts:117` — `workspaceId + '-' + sourceEvent.sourceId` is the right natural dedup key. The DB check is a belt-and-suspenders fallback.

**5. EdgeRule provider pattern**
The `PROVIDERS` registry with typed `EdgeRule[]` definitions is extensible — adding a new provider is just adding rules to the registry. Good design.

---

### Critical Issues

#### Issue 1: The observation layer is write-only (HIGH SEVERITY)

`event-interpret.ts:286-345` upserts 3 vectors to Pinecone with `layer="observations"`. `api/console/src/router/org/search.ts:134` filters to `layer="entities"` only.

**Impact**: Every event processed by `eventInterpret` produces:
- 3 Pinecone vectors (wasted storage + upsert cost)
- 1 `workspaceInterpretations` DB row (wasted storage)
- Claude Haiku API call for classification (wasted LLM cost)

None of these results are ever read at search time. The slow path is pure cost with zero user-facing return.

**Options**:
- A) Stop running `eventInterpret` entirely — remove it, save the LLM cost
- B) Make the search query both entity + observation layers (federated search)
- C) Use interpretation results to enrich entity metadata (pipe classifications back to entity vector metadata)

#### Issue 2: The significance gate is irreversibly lossy (HIGH SEVERITY)

`scoring.ts:23` — `SIGNIFICANCE_THRESHOLD = 40`. Events below this are logged and dropped. They never enter the DB.

**What's filtered out**:
- `chore: update deps` scores base + (-10 for "deps") = potentially under 40
- A `chore` commit that sneaks in a breaking change is permanently lost
- Routine commits that provide temporal context ("last touched by X on Y") are dropped

**The problem**: Search and entity narratives rely on the event history. If events are filtered before storage, you get gaps. "What happened between these two dates?" could miss critical context.

**Options**:
- A) Store everything, filter at search/scoring time (PostgreSQL + Pinecone have storage)
- B) Store filtered events as `significance_class: "noise"` — still in DB, but marked
- C) Make the threshold configurable per workspace
- D) Run significance scoring after storage (flag, not gate)

#### Issue 3: The document pipeline is completely disconnected (HIGH SEVERITY)

`process-documents.ts` is a separate pipeline that writes to:
- `workspaceKnowledgeDocuments`
- `workspaceKnowledgeVectorChunks`
- Pinecone with `docId#chunkIndex` IDs (no `layer` metadata)

The search router never queries these. **You cannot search code, configuration files, or any backfilled documents**.

Additionally: `process-documents.ts:307-336` emits `apps-console/relationships.extract` events, but `apps-console/index.ts:66-86` does NOT register a handler for this event. The event schema exists (`client.ts:115-124`) but nothing consumes it. This is dead code.

**Options**:
- A) Add `layer: "knowledge"` to document Pinecone metadata and include it in search with a federated query
- B) Unify document processing under the entity pipeline (a code file IS an entity: `definition` type)
- C) Remove `processDocuments` and handle code via a different mechanism

#### Issue 4: Actor resolution is a gap (MEDIUM SEVERITY)

The `engineer` entity type is extracted via regex: `/@([a-zA-Z0-9_-]{1,39})\b/g` from PR descriptions, commit messages. This captures GitHub usernames but:

- No mapping to Clerk user IDs (the authenticated user identity)
- No mapping to email addresses (needed for Intercom, Apollo)
- No mapping to Linear user IDs
- The `workspaceUserActivities` table tracks Clerk user actions but is never joined to event entities

For cross-source queries ("what did user X work on, and which customers did they talk to?"), you need an actor resolution layer. Without it, `@jeevanpillay` in GitHub and `jeevan@lightfast.ai` in Intercom are unrelated entities.

**What's needed**: An `actorRegistry` that maps (provider, externalUserId) → canonical actor ID, joined to entities and events.

#### Issue 5: Co-occurrence edges don't capture causality (MEDIUM SEVERITY)

`edge-resolver.ts:26` — The algorithm finds entities that appear in co-occurring events. This is correlation, not causality.

- A Sentry error and a GitHub PR co-occurring in the same time window creates an edge, but it doesn't know *which came first*
- The edge has no directionality beyond `sourceEntityId → targetEntityId`
- `onConflictDoNothing` means confidence never updates when the same edge is reinforced

For the query "What bugs were filed *after* the deploy?", you need temporal causality, not just co-occurrence.

#### Issue 6: Entity extraction from text is noisy (MEDIUM SEVERITY)

`entity-extraction-patterns.ts` extracts via regex from title + body text:
- `[A-Z][A-Z0-9_]{2,}` for env vars — matches too broadly (HTTP, ID, etc.)
- `[a-f0-9]{7,40}` for git hashes — matches any hex string in descriptions
- Branch references via `branch: <name>` — brittle

These produce low-quality entity nodes that pollute the graph. The structural relations from `sourceEvent.relations` (confidence 0.98) are reliable; the text extraction patterns are noisy. The ratio should flip — lean on structured relations, minimize regex extraction.

#### Issue 7: Edge resolution has N² scaling risk (MEDIUM SEVERITY)

`edge-resolver.ts:74-86` fetches 100 co-occurring events. For a high-frequency entity (e.g., `branch:main` in a busy repo), this is 100 events × N entities each × M of our entities. The inner loop is O(co-events × their-entities × our-entities × rules).

For busy workspaces, this will cause timeouts or very slow entity graph jobs.

#### Issue 8: No structured search API (LOW-MEDIUM SEVERITY)

`search.ts` — The current search API only supports:
- Semantic text query
- Date range (start only, no end)
- topK limit

Missing filters that are already in Pinecone metadata:
- `source` (github, vercel, sentry, linear)
- `entityType` (pr, commit, issue, deployment, engineer)
- `observationType`
- `totalEvents` (range — "active entities")
- `createdAt` (range — "new entities")

These are stored in entity metadata but never exposed as filter options.

#### Issue 9: workspaceInterpretations is a write-only sink (LOW SEVERITY)

`workspaceInterpretations` stores `primaryCategory`, `topics`, `significanceScore`, `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`. None of these are used at search time. The `topics` array is the most valuable — it could power topic-based filtered search.

---

## Architecture Simplification: What Can Be Removed

| Component | Status | Recommendation |
|---|---|---|
| `layer="observations"` Pinecone vectors (3 per event) | Written, never read | Remove or consolidate into entity metadata |
| `workspaceInterpretations` table | Written, never read | Remove or use topics to tag entity vectors |
| `apps-console/relationships.extract` event | Emitted, no handler | Remove (dead code) |
| Claude Haiku classification in `eventInterpret` | Runs but results go nowhere | Remove until observations layer is queryable |
| Multi-view embeddings (title/content/summary split) | Expensive, benefits unclear | Consolidate to single embedding until observation layer is live |
| `legacyVectorId` in embedding result | Backward compat shim | Remove |
| Text-based regex entity extraction | Noisy, low quality | Minimize; lean on `sourceEvent.relations` (0.98 confidence) |

**If you remove `eventInterpret` entirely**, you save:
- 1 Inngest function
- 3 Pinecone upserts per event
- 1 Claude Haiku API call per event
- 1 DB insert per event

This is the **highest-leverage single change**: the function runs, costs money, and produces nothing that users see.

---

## Architecture Additions for Goal: "Simplest Search of All Company Data"

### Addition 1: Federated Search Across All Layers

Instead of `filter: { layer: "entities" }` only, add a multi-pass query:

```
Query
  ├─ Pass 1: Entity layer (layer="entities") — topK=N
  ├─ Pass 2: Knowledge layer (layer="knowledge") — topK=N  ← add this
  └─ Merge + deduplicate by entity/doc ID
```

This immediately makes document search work.

### Addition 2: Actor Resolution Table

A new table `workspaceActors`:
```
workspaceActors(
  id, workspaceId,
  canonicalId,  -- our stable actor ID
  provider,     -- "github" | "clerk" | "linear" | "intercom"
  externalId,   -- provider's user ID
  handle,       -- username/@handle
  email         -- for cross-provider matching
)
```

All entity entities of category `engineer` get resolved against this table. Clerk user IDs from `workspaceUserActivities` get linked here too.

This enables: "What has this Clerk user been working on?" → resolve to GitHub handle → find `engineer` entity → traverse edges.

### Addition 3: Expose Classification in Search Filters

Surface `primaryCategory` and `topics` from `workspaceInterpretations` as searchable filters. Or move them to entity vector metadata as additional filter fields.

```typescript
filter: {
  layer: "entities",
  // NEW:
  ...(input.filters?.category ? { primaryCategory: input.filters.category } : {}),
  ...(input.filters?.source ? { provider: input.filters.source } : {}),
  ...(input.filters?.entityType ? { entityType: input.filters.entityType } : {}),
}
```

These are already in Pinecone metadata — just not exposed via the API.

### Addition 4: Store Significance Score on Entity Vectors

Currently `significanceScore` lives in `workspaceInterpretations` (never read). Move it to `EntityVectorMetadata`. Then search can boost high-significance entities in results.

### Addition 5: Significance as Metadata, Not a Gate

Change the significance scoring from a hard gate (drop below threshold) to metadata on the event row. Store all events. Let the search/ranking layer decide what's noise.

This makes the pipeline non-lossy and enables retrospective queries.

---

## Future Provider Readiness (Intercom, Clerk, Apollo, Stripe)

### What the Current Schema Supports

Current entity categories: `commit`, `branch`, `pr`, `issue`, `deployment`, `engineer`, `endpoint`, `config`, `definition`, `reference`, `project`.

These are all **engineering artifact** categories. None are business/customer categories.

### Entity Categories Needed for Full Coverage

| Provider | Entity Categories Needed |
|---|---|
| **Intercom** | `ticket`, `customer`, `conversation` |
| **Clerk** | `user`, `session`, `organization` |
| **Apollo** | `contact`, `deal`, `company` |
| **Stripe** | `payment`, `subscription`, `invoice`, `customer` |

Note: `customer` appears in both Intercom, Apollo, and Stripe. This is the canonical cross-source actor type for end-users (vs `engineer` for internal).

### Actor Resolution for Future Providers

The cross-provider linking problem:

```
Intercom conversation from user X
  → X has email: x@company.com
  → Apollo contact: x@company.com
  → Clerk user: user_xxx (primary email: x@company.com)
  → Sentry user impact: user ID user_xxx
```

For this to work: actor resolution must be email-anchored, with providers mapped to a canonical actor record. The `workspaceActors` table addition above handles this.

### Edge Rules for Cross-Source Business Linking

The `EdgeRule` pattern is the right abstraction. New rules needed:

```
Intercom → Linear: ticket mentions issue key → "reported_by"
Stripe → Clerk: payment from customer_id → Clerk user → "paid_by"
Apollo → Intercom: deal company → customer conversations → "stakeholder"
Sentry → Clerk: affected_user_id → "affected"
```

These are static rules, same pattern as current GitHub → Linear linking via `#ENG-123` mentions.

### The `PostTransformEvent` Schema Is Ready

The existing schema for `PostTransformEvent` with `entity`, `relations`, `attributes`, `occurredAt` is provider-agnostic. Adding Intercom/Clerk/Apollo/Stripe means:

1. Write a new provider transformer (like `packages/console-providers/src/providers/github/transformers.ts`)
2. Add `edgeRules` to the provider definition
3. Add new entity categories to the validation schemas
4. Ship the new webhook handler

The pipeline itself doesn't need to change — it's already generic at the `event.capture` level.

---

## Summary Verdict

### Current State

The pipeline has a **well-designed core** (entity upsert + graph edges + debounced embed) surrounded by significant waste and structural gaps:

1. **Half the pipeline runs but produces nothing queryable** — eventInterpret (LLM classification + observation vectors) costs money but is invisible to users
2. **The document pipeline is entirely disconnected** from search — documents are ingested but not searchable
3. **The significance gate is lossy** — events are dropped before storage with no recovery path
4. **Search has no temporal, actor, or cross-layer capabilities** — only entity-layer semantic similarity
5. **Actor entities exist but aren't resolved** to canonical identities across providers

### Highest Leverage Changes (in order)

1. **Remove `eventInterpret`** (or stop running it) until the observation layer is actually queried — immediate cost savings, no user impact
2. **Add `layer: "knowledge"` to document Pinecone vectors** and include in search query — immediately makes documents searchable
3. **Expose entity type + source + date range filters** in search API — they're already in Pinecone metadata
4. **Change significance to a soft flag, not a hard gate** — store everything, annotate with significance
5. **Actor resolution table** — prerequisite for all cross-source actor queries
6. **Add entity type categories for future providers** — customer, ticket, deal, contact, payment

### What to Keep As-Is

- Entity upsert design (category:key composite key, occurrenceCount)
- Fast path / slow path separation (correct latency model)
- Genesis + recency narrative (correct temporal memory design)
- EdgeRule provider pattern (extensible to new providers)
- Debounced entity embedding (correct for burst events)
- Inngest idempotency key (correct dedup)

---

## Code References

- `api/console/src/inngest/index.ts:65` — Function registry (processDocuments, eventStore, entityGraph, entityEmbed, eventInterpret)
- `api/console/src/inngest/workflow/neural/event-store.ts:109` — Fast path: 8 steps including significance gate
- `api/console/src/inngest/workflow/neural/event-store.ts:23` — `SIGNIFICANCE_THRESHOLD = 40`
- `api/console/src/inngest/workflow/neural/event-interpret.ts:89` — Slow path: classification + 3-vector embed
- `api/console/src/inngest/workflow/neural/entity-graph.ts:15` — Co-occurrence edge resolution
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:74` — Co-occurrence fetch (limit 100)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:29` — Debounced narrative + embed
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:31` — Genesis + recent 3 + edges
- `api/console/src/inngest/workflow/processing/process-documents.ts:92` — Disconnected document pipeline
- `api/console/src/inngest/workflow/processing/process-documents.ts:307` — Dead `relationships.extract` emit
- `api/console/src/router/org/search.ts:134` — Search: entity layer only, no observation/document layer
- `db/console/src/schema/tables/workspace-events.ts:19` — Event table schema (5 indexes)
- `packages/console-validation/src/schemas/neural.ts:62` — `EntityVectorMetadata` schema (fields available for Pinecone filters)
- `packages/console-validation/src/schemas/api/search.ts:9` — Search request schema (only query, limit, offset, mode, dateRange)

---

## Open Questions

1. **Is the observation layer (layer="observations") ever intended to be queried?** If yes: when? If no: cut it now.
2. **What is the intended use of `workspaceInterpretations`?** If it's for future use, document it. If not, remove it.
3. **Should significance scoring be a gate or a label?** This is a product decision with real data-loss implications.
4. **Is `processDocuments` the intended code indexing path long-term?** Or will code entities eventually flow through the event pipeline?
5. **Is there an actor resolution plan?** The `engineer` entity is the foundation, but without Clerk mapping it's incomplete.
6. **What's the rerank/fusion strategy for multi-layer search?** Entity layer vs observation layer vs knowledge layer have very different granularities (entity vs event vs chunk).
