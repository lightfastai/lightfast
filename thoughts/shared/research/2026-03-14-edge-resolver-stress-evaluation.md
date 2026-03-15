---
date: 2026-03-14T00:00:00+11:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "edge-resolver.ts — usage, efficiency, and bug stress evaluation"
tags: [research, stress-evaluation, bugs, edge-resolver, entity-graph, inngest, neural]
status: complete
last_updated: 2026-03-14
---

# Research: `edge-resolver.ts` — Stress Evaluation

**Date**: 2026-03-14
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Understand the usage of `resolveEdges` and stress-evaluate whether the implementation is maximally efficient, and identify any bugs that can surface from the logic.

---

## What The Code Does

`resolveEdges` (`api/console/src/inngest/workflow/neural/edge-resolver.ts:26`) resolves entity↔entity edges for a newly processed event. It is the exclusive write path for the `workspaceEdges` table.

**Sole caller**: `api/console/src/inngest/workflow/neural/entity-graph.ts:27-29` — an Inngest step inside the `entityGraph` function, triggered by the `"apps-console/entity.upserted"` event. The return value (`edgeCount`) is returned from the function but not emitted in the downstream `"apps-console/entity.graphed"` event.

### Algorithm (6 effective DB stages)

| Stage | Query | Returns |
|---|---|---|
| 1 | Find our structural entity IDs | `ourEntities[]` |
| 2 | Find co-occurring junction rows | `coOccurring[]` (limit 100) |
| 3a (parallel) | Find co-event sources | `coEvents[]` |
| 3b (parallel) | Find all co-event→entity junctions | `coEventEntityJunctions[]` |
| 4 | Find full entity details for co-entities | `allCoEntities[]` |
| 5 | Insert edge candidates | `workspaceEdges` rows |

### Rule Matching

Providers define `edgeRules?: EdgeRule[]` (`packages/console-providers/src/define.ts:311`). Rules are matched per `(refType, matchProvider, matchRefType)` triplet, with an optional `selfLabel` refinement.

Current live rules by provider:

| Provider | `refType` | `selfLabel` | `matchProvider` | `matchRefType` | `relationshipType` | `confidence` |
|---|---|---|---|---|---|---|
| GitHub | `commit` | — | `vercel` | `deployment` | `deploys` | 1.0 |
| GitHub | `issue` | `fixes` | `*` | `issue` | `fixes` | 1.0 |
| GitHub | `issue` | — | `*` | `issue` | `references` | 0.8 |
| Vercel | `deployment` | — | `github` | `commit` | `deploys` | 1.0 |
| Linear | `issue` | — | `*` | `issue` | `references` | 0.8 |
| Sentry | (empty) | — | — | — | — | — |

---

## Schema Facts Relevant to the Evaluation

- `workspaceEntities.id` — globally unique auto-identity BIGINT (database sequence). Workspace scoping is via a separate `workspaceId` FK + unique index `(workspaceId, category, key)`.
- `workspaceEntityEvents` — junction table; has `workspaceId` column; unique index on `(entityId, eventId)` only (no workspace in that unique constraint).
- `workspaceEdges` unique index: `(workspaceId, sourceEntityId, targetEntityId, relationshipType)` — directed edge constraint.

---

## Bugs Found

### Bug 1: Silent Truncation of Co-occurring Events (Definite Bug)

**Location**: `edge-resolver.ts:74-86`

```ts
const coOccurring = await db
  .select({ eventId: ..., entityId: ... })
  .from(workspaceEntityEvents)
  .where(
    and(
      inArray(workspaceEntityEvents.entityId, ourEntityIds),
      ne(workspaceEntityEvents.eventId, eventId)
    )
  )
  .limit(100);  // ← No ORDER BY
```

**Problem**: The `.limit(100)` has no `ORDER BY` clause. Postgres is free to return any 100 rows. On a high-traffic entity (e.g., `branch:main` or `issue:#123` referenced across hundreds of events), the 100 cheapest-to-scan rows may omit the most recent or most relevant co-occurrences. There is no log warning, no metric, and no way for the caller to detect truncation — the function returns a count, not an indication of partial results.

**Concrete failure mode**: A PR entity that appears in 500 events will silently miss 400 potential edge candidates on each invocation. The edges are never re-evaluated unless `resolveEdges` is called again for the same `eventId`.

**Fix direction**: Add `orderBy(desc(workspaceEntityEvents.id))` to prefer recent events, and/or increase the limit. Alternatively, paginate and loop.

---

### Bug 2: Bidirectional Edge Duplication Across Event Processings (Definite Bug)

**Location**: `edge-resolver.ts:190-213` + the overall algorithm design

Each event runs `resolveEdges` independently. Consider two events processed in order:

**Event A (GitHub `push`)**: Has a `commit` entity. Co-occurring Event B has a Vercel `deployment` entity.
- `findBestRule(githubRules, "commit", null, "vercel", "deployment")` → matches GitHub's rule
- Inserts: `(sourceEntityId=commit, targetEntityId=deployment, relationshipType="deploys")`

**Event B (Vercel `deployment`)**: Has a `deployment` entity. Co-occurring Event A has a GitHub `commit` entity.
- `findBestRule(vercelRules, "deployment", null, "github", "commit")` → matches Vercel's rule
- Inserts: `(sourceEntityId=deployment, targetEntityId=commit, relationshipType="deploys")`

**Result in `workspaceEdges`**:
```
(commit, deployment, "deploys")   ← from processing event A
(deployment, commit, "deploys")   ← from processing event B
```

The DB unique constraint `(workspaceId, sourceEntityId, targetEntityId, relationshipType)` is satisfied by both rows because source/target are swapped. Both edges exist simultaneously. The graph consumer now sees "commit deploys deployment" AND "deployment deploys deployment" — the same named relationship in both directions.

**Root cause**: GitHub's rule and Vercel's rule both define `relationshipType: "deploys"`, but they produce edges in opposite directions. The in-memory deduplication at `edge-resolver.ts:218-222` only deduplicates within a single invocation — it does not prevent cross-invocation duplicates.

**Impact**: Any graph query or traversal that consumes `workspaceEdges` will find contradictory or redundant directed edges for the same entity pair. The `workspaceEdges` composite unique constraint does not protect against bidirectional duplicates.

---

### Non-Bug: Workspace Isolation in Junction Queries (Safe By Construction)

**Concern area**: `edge-resolver.ts:74-86, 96-107, 118-125` — queries on `workspaceEntityEvents` and `workspaceEntities` that do not explicitly filter by `workspaceId`.

**Why it is safe**: All queries use derived entity IDs (`ourEntityIds`, `coEntityIds`) that originate from `edge-resolver.ts:46-58`, where `workspaceEntities` is explicitly filtered by `workspaceId`. Since `workspaceEntities.id` is a globally auto-incrementing BIGINT (database sequence), an entity ID is globally unique — it cannot appear in a different workspace. The derived ID sets are therefore implicitly workspace-scoped.

**Caveat**: Adding explicit `workspaceId` filters to the downstream queries would allow Postgres to use workspace-indexed scans and make the isolation intent explicit, even if the current behavior is correct.

---

## Efficiency Assessment

### DB Round-Trip Count: 5 Sequential Stages

| # | Query | Can be eliminated? |
|---|---|---|
| 1 | `SELECT` our entity IDs from `workspaceEntities` | Not easily — entry point |
| 2 | `SELECT` co-occurring junctions | Could be merged into a JOIN with #1 |
| 3 (parallel pair) | `SELECT` co-event sources + co-event junctions | Could be merged into one query; currently parallel |
| 4 | `SELECT` entity details for co-entity IDs | Could be merged with #3b via JOIN |
| 5 | `INSERT` edge candidates | Unavoidable write |

**Current:** 4 sequential IO stages (3a/3b are parallel but depend on stage 2).
**Theoretical minimum:** Could be 2 stages (one compound query + one insert) using CTEs or subquery joins.

### Provider Lookup: Linear Scan (Minor)

`edge-resolver.ts:159`: `Object.values(PROVIDERS).find((p) => p.name === src)` is O(n) where n=4. The `rulesCache` Map means this scan only runs once per unique source in a given invocation. With only 4 providers, this is inconsequential.

### Insert: `onConflictDoNothing` — WAL Cost

Every `INSERT` attempt generates a write-ahead log entry even when the row already exists and the conflict is silently dropped. For high-frequency entity pairs (e.g., main branch appearing in every commit event), the same `(commit, deployment, "deploys")` edge candidate may be redundantly attempted on every event. This adds WAL pressure proportional to entity co-occurrence frequency.

**Mitigation**: A pre-insert `SELECT` to filter already-existing edges would trade one read for reduced write amplification, but only worthwhile at high insert rates.

---

## Summary Table

| Issue | Severity | Type | Location |
|---|---|---|---|
| `.limit(100)` without `ORDER BY` → silent truncation | High | Definite Bug | `edge-resolver.ts:86` |
| Bidirectional edge duplication across event processings | Medium | Definite Bug | `edge-resolver.ts:190-213` + algorithm design |
| `edgeCount=0` ambiguous (no edges vs insert failure) | Low | Design Gap | `edge-resolver.ts:244` |
| 4 sequential DB stages; could reduce via JOINs/CTEs | Low | Efficiency | `edge-resolver.ts:46-125` |
| Redundant `onConflictDoNothing` writes for known edges | Low | Efficiency | `edge-resolver.ts:237` |
| Workspace filter missing on derived-ID queries | Non-issue | Safe by construction | `edge-resolver.ts:74-125` |

---

## Code References

- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — `resolveEdges` function signature
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:86` — `.limit(100)` without ORDER BY (Bug 1)
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:190-213` — rule evaluation producing bidirectional candidates (Bug 2)
- `api/console/src/inngest/workflow/neural/entity-graph.ts:27-29` — sole caller
- `packages/console-providers/src/types.ts:59-72` — `EdgeRule` interface
- `packages/console-providers/src/providers/github/index.ts:343-369` — GitHub edge rules
- `packages/console-providers/src/providers/vercel/index.ts:173-182` — Vercel edge rules (duplicate direction of Bug 2)
- `db/console/src/schema/tables/workspace-edges.ts:75-80` — `edge_unique_idx` (directed, not covering bidirectional)
- `db/console/src/schema/tables/workspace-entities.ts:133-137` — `entity_workspace_category_key_idx` (basis for "safe by construction" claim)
