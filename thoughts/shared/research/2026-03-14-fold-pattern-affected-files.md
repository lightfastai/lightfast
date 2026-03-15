---
date: 2026-03-14T06:22:44+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Fold pattern adoption — affected files and architectural gaps"
tags: [research, codebase, entity-embed, narrative-builder, neural, pinecone, search]
status: complete
last_updated: 2026-03-14
related_to: "thoughts/shared/research/2026-03-14-fold-pattern-narrative-accumulator.md"
---

# Research: Fold Pattern Adoption — Affected Files and Architectural Gaps

**Date**: 2026-03-14
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Given the design in `2026-03-14-fold-pattern-narrative-accumulator.md`, what files need to change and what are the exact gaps between current implementation and proposed design?

## Summary

Three files require changes. The DB schema, Inngest event wiring, and graph layer require zero changes — all necessary columns and event hooks already exist. The search API requires no changes for the narrative fix itself.

The changes are scoped to:
1. `entity-embed.ts` — query restructure + metadata extension
2. `narrative-builder.ts` — full function rewrite (interface + sections)
3. `neural.ts` (console-validation) — 2 new fields on `EntityVectorMetadata`

---

## Detailed Findings

### File 1: `api/console/src/inngest/workflow/neural/entity-embed.ts`

Three distinct changes needed.

#### Change 1A — Step 1 "fetch-entity" (lines 49–58)

Current select:
```typescript
{ id, externalId, category, key }
```

Needs to add:
```typescript
value:           workspaceEntities.value,
extractedAt:     workspaceEntities.extractedAt,
lastSeenAt:      workspaceEntities.lastSeenAt,
occurrenceCount: workspaceEntities.occurrenceCount,
```

All four columns exist on `lightfast_workspace_entities` (confirmed in DB schema). `value` is `text` nullable. `extractedAt`, `lastSeenAt` are `TIMESTAMPTZ NOT NULL`. `occurrenceCount` is `INTEGER NOT NULL default 1`.

#### Change 1B — Step 3 "fetch-graph-and-events" (lines 75–112)

**Current** — single events query inside `Promise.all`:
```typescript
db
  .select({ title, sourceType, occurredAt, metadata })
  .from(workspaceEntityEvents)
  .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
  .where(eq(workspaceEntityEvents.entityId, entity.id))
  .orderBy(asc(workspaceEvents.occurredAt))   // oldest-first
  .limit(10)
```

Note: the current query orders ascending, so it fetches the 10 **oldest** events — not the 10 most recent. This differs from what the design doc described ("last 10 events"), but the amnesia problem is symmetrical either way.

**Needs to become** — two separate queries, both in `Promise.all`:
```typescript
// Genesis — first ever event (founding context, never lost)
db
  .select({ title, sourceType, occurredAt })
  .from(workspaceEntityEvents)
  .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
  .where(eq(workspaceEntityEvents.entityId, entity.id))
  .orderBy(asc(workspaceEvents.occurredAt))
  .limit(1),

// Recent — last 3 events (recency signal)
db
  .select({ title, sourceType, occurredAt })
  .from(workspaceEntityEvents)
  .innerJoin(workspaceEvents, eq(workspaceEntityEvents.eventId, workspaceEvents.id))
  .where(eq(workspaceEntityEvents.entityId, entity.id))
  .orderBy(desc(workspaceEvents.occurredAt))
  .limit(3),
```

The edges sub-query (lines 97–109) is **unchanged**.

The step destructure becomes `[genesisEvent, recentEvents, edges]` (was `[events, edges]`).

#### Change 1C — Metadata block (lines 142–155) and latestEvent ref

**Current metadata fields:**
| Field | Value |
|---|---|
| `layer` | `"entities"` |
| `entityExternalId` | `entity.externalId` |
| `entityType` | `entity.category` |
| `provider` | `provider` (from event payload) |
| `latestAction` | `latestEvent?.sourceType.split(".").pop() ?? ""` |
| `title` | `narrative.split("\n")[0] ?? entity.key` |
| `snippet` | `narrative.slice(0, 500)` |
| `occurredAt` | `new Date(latestEvent.occurredAt).getTime()` or `Date.now()` |
| `narrativeHash` | SHA-256 prefix |

**Add two fields:**
```typescript
createdAt:   new Date(entity.extractedAt).getTime(),   // Unix ms — entity birth timestamp
totalEvents: entity.occurrenceCount,                   // total event count for entity
```

**Also update latestEvent reference** (line ~116 in current code):
- Current: `const latestEvent = events.at(-1)`
- New: `const latestEvent = recentEvents[0]` (recentEvents is desc-ordered, so `[0]` is most recent)

---

### File 2: `api/console/src/inngest/workflow/neural/narrative-builder.ts`

Full rewrite of `buildEntityNarrative`. `narrativeHash` is unchanged.

#### Interface changes

**Current `NarrativeEntity`** (lines 16–19):
```typescript
interface NarrativeEntity {
  category: string;
  key: string;
}
```

**New `NarrativeEntity`** — adds temporal and count fields:
```typescript
interface NarrativeEntity {
  category: string;
  key: string;
  value: string | null;         // entity title (nullable — falls back to key)
  extractedAt: string | null;   // first seen (TIMESTAMPTZ as mode:"string")
  lastSeenAt: string | null;    // last seen (TIMESTAMPTZ as mode:"string")
  occurrenceCount: number;      // total events seen
}
```

The `metadata` field on `NarrativeEvent` (lines 3–8) is used only in the current "Context" section which is being removed. It can be dropped from the interface.

#### Function signature change

**Current:**
```typescript
buildEntityNarrative(
  entity: NarrativeEntity,
  events: NarrativeEvent[],
  edges: NarrativeEdge[]
): string
```

**New:**
```typescript
buildEntityNarrative(
  entity: NarrativeEntity,
  genesisEvent: NarrativeEvent | null,
  recentEvents: NarrativeEvent[],
  edges: NarrativeEdge[]
): string
```

#### Section-by-section changes

| # | Current section | Current source | New section | New source |
|---|---|---|---|---|
| 1 | Identity | `${category} ${key}: ${events[0]?.title ?? key}` | Identity | `${category} ${key}: ${entity.value ?? entity.key}` |
| 2 | Context | `latest.metadata` key-value pairs | Created | genesis event: `${date} ${action}: ${genesisEvent.title}` |
| 3 | Timeline | all events formatted | Temporal span | `First seen: X \| Last seen: Y \| Events: N` |
| 4 | Related | edges | Recent | last 3 events formatted |
| 5 | — | — | Related | edges (was section 4) |

The "Context" section (current section 2) is removed entirely — it reads `latest.metadata` scalar values, which add noise and vary per provider.

---

### File 3: `packages/console-validation/src/schemas/neural.ts`

Two new fields on `entityVectorMetadataSchema` (currently ends at line 79):

```typescript
createdAt:   z.number(),    // Unix ms timestamp of entity.extractedAt
totalEvents: z.number(),    // entity.occurrenceCount
```

Both are `z.number()` to match `occurredAt`'s numeric type (Pinecone range filters work on numbers, not ISO strings). The inline comment on `occurredAt` at lines 57–60 explains this convention.

The `.catchall(...)` at lines 77–79 already permits these fields to be present before the schema is updated — so existing Pinecone reads won't break until the schema is formally updated.

---

### Files with No Changes Required

#### `api/console/src/inngest/workflow/neural/entity-graph.ts`

Complete and correct as-is. It:
- Triggers on `apps-console/entity.upserted`
- Calls `resolveEdges(workspaceId, internalEventId, provider, entityRefs)`
- Emits `apps-console/entity.graphed` after edges are committed

This is exactly the event ordering the design doc requires. No changes.

#### `api/console/src/inngest/workflow/neural/event-store.ts`

Entity upsert at lines 449–529 already writes `lastSeenAt`, `occurrenceCount`, and `value` on every upsert via `onConflictDoUpdate`. No changes.

#### `api/console/src/inngest/client/client.ts`

`apps-console/entity.graphed` payload (lines 198–204) already carries `workspaceId`, `entityExternalId`, `entityType`, `provider`, `occurredAt`. No changes.

#### DB Schema — All Required Columns Exist

| Column needed | Table | Status |
|---|---|---|
| `extractedAt` | `workspaceEntities` | ✓ `TIMESTAMPTZ NOT NULL` |
| `lastSeenAt` | `workspaceEntities` | ✓ `TIMESTAMPTZ NOT NULL` |
| `occurrenceCount` | `workspaceEntities` | ✓ `INTEGER NOT NULL default 1` |
| `value` | `workspaceEntities` | ✓ `TEXT nullable` |
| `category` | `workspaceEntities` | ✓ `VARCHAR(50) NOT NULL` |
| `key` | `workspaceEntities` | ✓ `VARCHAR(500) NOT NULL` |
| `title` | `workspaceEvents` | ✓ `TEXT NOT NULL` |
| `sourceType` | `workspaceEvents` | ✓ `VARCHAR(100) NOT NULL` |
| `occurredAt` | `workspaceEvents` | ✓ `TIMESTAMPTZ NOT NULL` |
| `entityId` | `workspaceEntityEvents` | ✓ FK to entities |
| `eventId` | `workspaceEntityEvents` | ✓ FK to events |
| `sourceEntityId` | `workspaceEdges` | ✓ FK to entities |
| `targetEntityId` | `workspaceEdges` | ✓ FK to entities |
| `relationshipType` | `workspaceEdges` | ✓ `VARCHAR(50) NOT NULL` |

Zero schema migrations needed.

#### `api/console/src/router/org/search.ts` + `apps/console/src/lib/search.ts`

No changes required for the narrative fix. Both already:
- Query Pinecone with `layer: "entities"` filter ✓
- Construct results purely from Pinecone metadata (no DB enrichment) ✓

**Fields stored in Pinecone but not surfaced in search response** (optional follow-on):
- `latestAction` — stored, not read in result mapping
- `totalEvents` — will be stored after the schema change, not yet mapped
- `narrativeHash` — stored, intentionally not surfaced (internal dedup only)

---

## Architecture: Before vs. After

### entity-embed.ts step flow

**Before:**
```
step.run("fetch-entity")            → { id, externalId, category, key }
step.run("fetch-workspace")         → ws
step.run("fetch-graph-and-events")  → [events(10, asc), edges(10)]
[sync] buildEntityNarrative(entity, events, edges)
[sync] narrativeHash(narrative)
[sync] latestEvent = events.at(-1)
step.run("embed-narrative")         → vector
step.run("upsert-entity-vector")    → metadata: 9 fields
```

**After:**
```
step.run("fetch-entity")            → { id, externalId, category, key, value,
                                        extractedAt, lastSeenAt, occurrenceCount }
step.run("fetch-workspace")         → ws   [unchanged]
step.run("fetch-narrative-inputs")  → [genesisEvent(1), recentEvents(3), edges(10)]
[sync] buildEntityNarrative(entity, genesisEvent, recentEvents, edges)
[sync] narrativeHash(narrative)     [unchanged]
[sync] latestEvent = recentEvents[0]
step.run("embed-narrative")         → vector   [unchanged]
step.run("upsert-entity-vector")    → metadata: 11 fields (+createdAt, +totalEvents)
```

### narrative-builder.ts output

**Before (entity with 500 events, current asc-10 query):**
```
pr 12345#99: Add auth middleware

Context: state: open | number: 99 | draft: false

Timeline:
  2024-03-01 opened: Add auth middleware
  2024-03-01 labeled: Add auth middleware
  2024-03-01 review_requested: Add auth middleware
  [... 7 more events, all from genesis ...]

Related:
  head_commit → commit abc1234
  fixes → issue 12345678#7
```
(10 oldest events — genesis is captured but recent state is lost)

**After (genesis + last 3 + temporal span):**
```
pr 12345#99: Add auth middleware

Created: 2024-03-01 opened: Add auth middleware

First seen: 2024-03-01 | Last seen: 2024-03-15 | Events: 500

Recent:
  2024-03-15 merged: Add auth middleware
  2024-03-14 approved: Add auth middleware
  2024-03-13 review_requested: Add auth middleware

Related:
  head_commit → commit abc1234
  fixes → issue 12345678#7
  from_branch → branch 12345678:feature/auth
```
(~100 tokens, genesis + current state + temporal context)

---

## Code References

- `api/console/src/inngest/workflow/neural/entity-embed.ts:49–58` — Step 1 select (add 4 columns)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:75–112` — Step 3 event query (split into genesis + recent)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:115` — `buildEntityNarrative()` call (update signature)
- `api/console/src/inngest/workflow/neural/entity-embed.ts:116` — `latestEvent = events.at(-1)` → `recentEvents[0]`
- `api/console/src/inngest/workflow/neural/entity-embed.ts:142–155` — Pinecone metadata (add `createdAt`, `totalEvents`)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:16–19` — `NarrativeEntity` interface (add 4 fields)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:3–8` — `NarrativeEvent` interface (remove `metadata`)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:28–73` — `buildEntityNarrative` (full rewrite)
- `packages/console-validation/src/schemas/neural.ts:62–79` — `entityVectorMetadataSchema` (add 2 fields)
- `db/console/src/schema/tables/workspace-entities.ts:90–110` — `extractedAt`, `lastSeenAt`, `occurrenceCount` (read-only reference)

## Related Research

- `thoughts/shared/research/2026-03-14-fold-pattern-narrative-accumulator.md` — origin design doc (zero-column approach)
- `thoughts/shared/research/2026-03-13-entity-lifecycle-search-design.md` — original entity lifecycle design (superseded by above)
- `thoughts/shared/research/2026-03-13-observation-pipeline-architecture.md` — full 4-layer pipeline redesign

## Open Questions

1. **`metadata` field on `NarrativeEvent`**: The `metadata: Record<string, ...> | null` field is currently read in the "Context" section. If the section is removed, the field can be dropped from the interface and from the Step 3 select — reducing the data transferred per event row.

2. **Step rename**: "fetch-graph-and-events" (current name) no longer describes what Step 3 does after the split. A rename to "fetch-narrative-inputs" (as the design doc uses) would match the new intent.

3. **`latestAction` in search response**: Currently stored in Pinecone but not returned by the search API. If UI cards need to show state badges ("merged", "open", "resolved"), both `search.ts` and `apps/console/src/lib/search.ts` need to map this field. `SearchResultSchema` would also need a new optional field.

4. **Content-hash dedup**: The `narrativeHash` field is already in Pinecone metadata. The design doc's open question (option a = Pinecone read, option b = DB column) is unresolved. Current code does not perform dedup — it re-embeds on every `entity.graphed` event regardless of whether the narrative changed.
