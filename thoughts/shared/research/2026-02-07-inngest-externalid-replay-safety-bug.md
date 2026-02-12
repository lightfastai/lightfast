---
date: 2026-02-07T18:30:00+11:00
researcher: Claude
git_commit: 73e84dd09edc34ba3daeeec46d82a7a7c994d23b
branch: feat/memory-connector-backfill
repository: lightfast-product-demo
topic: "Pinecone-DB externalId mismatch caused by Inngest replay-unsafe nanoid() generation"
tags: [research, inngest, replay-safety, pinecone, neural-observations, externalId, memoization, bug]
status: complete
last_updated: 2026-02-07
last_updated_by: Claude
---

# Research: Pinecone-DB externalId Mismatch - Inngest Replay-Safety Bug

**Date**: 2026-02-07T18:30:00+11:00
**Researcher**: Claude
**Git Commit**: 73e84dd09edc34ba3daeeec46d82a7a7c994d23b
**Branch**: feat/memory-connector-backfill
**Repository**: lightfast-product-demo

## Research Question

Investigate the Pinecone-DB ID mismatch bug in the observation capture Inngest workflow. When using "Find Similar" after searching, it fails with `Content not found: <id>` because the `observationId` stored in Pinecone vector metadata does NOT match the `externalId` stored in the database for the same observation - even after clearing both Pinecone and DB and re-injecting fresh data through the Inngest workflow.

## Summary

The root cause is a **replay-safety violation** in `api/console/src/inngest/workflow/neural/observation-capture.ts`. The `externalId = nanoid()` call at line 397 is generated **outside** any `step.run()` block. In Inngest's execution model, code outside steps re-executes on every retry/replay, while completed steps return memoized values. If the Pinecone upsert step (step 6) succeeds but the DB store step (step 7) fails, the retry generates a **new** `externalId` via `nanoid()`, but the Pinecone step is already memoized with the **old** value. This creates a permanent mismatch between Pinecone's `observationId` metadata and the database's `externalId` column.

The same pattern exists (with lower severity) in 3 other workflows using `Date.now()` outside steps, and in 2 helper functions using `nanoid()` outside steps.

## Detailed Findings

### 1. The Core Bug: `externalId` Generation Outside `step.run()`

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts:397`

```typescript
async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, sourceEvent } = event.data;
    const startTime = Date.now();                    // Line 391 - OUTSIDE step
    // Pre-generate externalId at workflow start (Phase 3 optimization)
    const externalId = nanoid();                     // Line 397 - OUTSIDE step ← BUG
```

The `externalId` is then consumed by **three separate steps**:

| Step | Name | Line | Usage |
|------|------|------|-------|
| Step 6 | `upsert-multi-view-vectors` | 867 | `observationId: externalId` in Pinecone metadata |
| Step 7 | `store-observation` | 933 | `externalId` column in DB insert |
| Step 8 | `emit-events` | 1060, 1079, 1103 | `observationId` in downstream event payloads |

### 2. Failure Scenario Timeline

| Attempt | externalId | Steps 1-5 | Step 6 (Pinecone) | Step 7 (DB) |
|---------|-----------|----------|-------------------|-------------|
| 1st | `abc123` | Execute & succeed | Stores `observationId: "abc123"` in metadata, **succeeds** | **FAILS** (e.g. DB timeout) |
| Retry | `xyz789` | Return **memoized** values | **Skipped** (already succeeded, returns memoized) | Inserts `externalId: "xyz789"`, succeeds |

**Result**: Pinecone has `observationId: "abc123"` but DB has `externalId: "xyz789"`. They permanently disagree.

### 3. Complete Step Dependency Chain

```
create-job (417)
  ↓
update-job-running (436)
  ↓
check-duplicate (441) → [exit if duplicate]
  ↓
check-event-allowed (496) → [exit if not allowed]
  ↓
evaluate-significance (582) → [exit if below threshold]
  ↓
fetch-context (635)
  ↓
classify-observation (655) ← step.ai.wrap
  ↓
[PARALLEL BLOCK - line 711]
├─ generate-multi-view-embeddings (713)
├─ extract-entities (757)
└─ resolve-actor (780)
  ↓
assign-cluster (815)
  ↓
upsert-multi-view-vectors (852) ← Uses externalId in Pinecone metadata
  ↓
store-observation (922) ← Uses externalId in DB insert
  ↓
detect-relationships (1004)
  ↓
reconcile-vercel-actors (1024) [conditional]
  ↓
emit-events (1053) ← Uses externalId in event payloads
  ↓
complete-job-success (1112)
```

### 4. All Replay-Unsafe Values in observation-capture.ts

| Line | Code | Impact |
|------|------|--------|
| 391 | `const startTime = Date.now()` | Incorrect duration metrics on replay |
| 397 | `const externalId = nanoid()` | **CRITICAL**: Pinecone/DB ID mismatch |
| 416 | `event.id ?? \`neural-obs-...-${Date.now()}\`` | Incorrect inngestRunId if event.id missing |

### 5. How the Read Path Fails

#### Search Pipeline (`four-path-search.ts:82-210`)

`normalizeVectorIds()` resolves Pinecone vector IDs to observation IDs:

- **Phase 3 path** (lines 94-124): Extracts `metadata.observationId` directly from Pinecone - returns `"abc123"` (the stale value)
- **Phase 2 path** (lines 126-180): Falls back to DB lookup by embedding column IDs

`enrichSearchResults()` (lines 553-657) then queries the DB by `externalId`:
- DB has `externalId: "xyz789"` but search sends `"abc123"`
- Lookup fails silently - returns result with `source: "unknown"`, `type: "unknown"`

#### FindSimilar Pipeline (`findsimilar.ts:152-300`)

`fetchSourceContent()` (lines 152-208) calls `resolveObservationById()`:
- Tries `externalId` lookup first (lines 79-96 of id-resolver.ts)
- Falls back to vector ID column lookup (lines 113-153)
- Returns `null` when neither matches
- Caller throws: `throw new Error(\`Content not found: ${sourceId}\`)` at line 299

#### ID Resolver (`id-resolver.ts:62-156`)

`resolveObservationById()` attempts resolution in order:
1. Query by `externalId` column (nanoid match)
2. If ID looks like a vector ID (`obs_title_*` etc.), query by embedding columns
3. Return `null` if no match

### 6. Other Workflows With Similar Patterns

**Confirmed violations** (non-deterministic values outside `step.run()`):

| Workflow | File | Line | Code | Severity |
|----------|------|------|------|----------|
| observation-capture | `neural/observation-capture.ts` | 397 | `nanoid()` | **CRITICAL** |
| observation-capture | `neural/observation-capture.ts` | 391 | `Date.now()` | Low (metrics only) |
| backfill-orchestrator | `backfill/backfill-orchestrator.ts` | 89 | `Date.now()` | Low (metrics only) |
| files-batch-processor | `processing/files-batch-processor.ts` | 77 | `Date.now()` | Low (metrics only) |
| profile-update | `neural/profile-update.ts` | 98 | Fallback `Date.now()` | Low (fallback only) |
| cluster-summary | `neural/cluster-summary.ts` | 121 | Fallback `Date.now()` | Low (fallback only) |
| llm-entity-extraction | `neural/llm-entity-extraction-workflow.ts` | 90 | Fallback `Date.now()` | Low (fallback only) |

**Helper functions** (called from within steps, so indirectly safe if the calling step is memoized):

| Helper | File | Line | Code |
|--------|------|------|------|
| relationship-detection | `neural/relationship-detection.ts` | 255 | `nanoid()` in map |
| cluster-assignment | `neural/cluster-assignment.ts` | 222 | `nanoid()` in cluster ID |

**Clean workflows** (no violations):
- `processing/process-documents.ts`
- `processing/delete-documents.ts`
- `sources/github-sync-orchestrator.ts`
- `orchestration/sync-orchestrator.ts`
- `infrastructure/record-activity.ts`
- `notifications/dispatch.ts`

### 7. Inngest Step Memoization Behavior

Based on Inngest's execution model and confirmed by code patterns in this codebase:

1. **Code outside `step.run()` re-executes on every retry** - This is the fundamental issue. The workflow function body runs from the top on each attempt.
2. **Completed steps return memoized values** - If `step.run("foo", fn)` previously succeeded, it returns the cached result without re-executing `fn`.
3. **Steps are the unit of atomicity** - Inngest tracks which steps completed. On retry, it replays the function, skipping completed steps.
4. **Wrapping in `step.run()` makes values replay-safe** - `const id = await step.run("gen-id", () => nanoid())` generates the ID once and returns the same value on every replay.

## Code References

- `api/console/src/inngest/workflow/neural/observation-capture.ts:397` - The `nanoid()` call outside `step.run()`
- `api/console/src/inngest/workflow/neural/observation-capture.ts:867` - `externalId` used in Pinecone metadata
- `api/console/src/inngest/workflow/neural/observation-capture.ts:933` - `externalId` used in DB insert
- `api/console/src/inngest/workflow/neural/observation-capture.ts:391` - `Date.now()` outside steps
- `apps/console/src/lib/neural/four-path-search.ts:82-210` - `normalizeVectorIds()` resolution logic
- `apps/console/src/lib/neural/four-path-search.ts:553-657` - `enrichSearchResults()` DB lookup
- `apps/console/src/lib/v1/findsimilar.ts:152-208` - `fetchSourceContent()` resolution
- `apps/console/src/lib/v1/findsimilar.ts:297-300` - "Content not found" error throw
- `apps/console/src/lib/neural/id-resolver.ts:62-156` - `resolveObservationById()` lookup strategies
- `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts:89` - `Date.now()` outside steps
- `api/console/src/inngest/workflow/processing/files-batch-processor.ts:77` - `Date.now()` outside steps

## Architecture Documentation

### Write Path (observation-capture.ts)

```
Webhook Event
  → Inngest function invocation
    → externalId = nanoid()          ← OUTSIDE steps (replay-unsafe)
    → step.run("create-job")
    → step.run("check-duplicate")
    → step.run("check-event-allowed")
    → step.run("evaluate-significance")
    → step.run("fetch-context")
    → step.ai.wrap("classify-observation")
    → Promise.all([
        step.run("generate-multi-view-embeddings"),
        step.run("extract-entities"),
        step.run("resolve-actor")
      ])
    → step.run("assign-cluster")
    → step.run("upsert-multi-view-vectors")  ← Stores externalId in Pinecone metadata
    → step.run("store-observation")           ← Stores externalId in DB
    → step.run("emit-events")                 ← Propagates externalId to downstream
```

### Read Path (search → findsimilar)

```
/v1/search query
  → Pinecone vector search
    → Returns vectors with metadata.observationId
  → normalizeVectorIds()
    → Phase 3: Trust metadata.observationId directly (no DB validation)
    → Phase 2: DB lookup by vector ID columns
  → enrichSearchResults()
    → DB query by externalId
    → If not found: return {source: "unknown", type: "unknown"}

/v1/findsimilar {id}
  → fetchSourceContent(id)
    → resolveObservationById(id)
      → Try externalId column
      → Fallback to vector ID columns
      → Return null if not found
    → If null: throw Error("Content not found: {id}")
```

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-07-neural-observation-classification-reasoning-validation-error.md` - Recent investigation into observation capture classification errors
- `thoughts/shared/research/2025-12-16-neural-observation-workflow-tracking-analysis.md` - Architecture analysis of the neural observation pipeline
- `thoughts/shared/research/2025-12-15-neural-memory-database-design-analysis.md` - Database design including the dual ID system (BIGINT + nanoid)
- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow-analysis.md` - Recent analysis of the findSimilar API flow
- `thoughts/shared/research/2026-02-07-v1-search-zero-results-investigation.md` - Recent investigation of search returning zero results
- `thoughts/shared/plans/2025-12-17-neural-workflow-metrics-enhancement.md` - Plans for workflow metrics (related to startTime issue)

## Related Research

- `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow-analysis.md` - Companion analysis of the read path
- `thoughts/shared/research/2026-02-07-v1-findsimilar-contents-route-analysis.md` - Contents route analysis

## Open Questions

1. **How often do retries actually occur?** - Need to check Inngest dashboard for retry rates on the observation-capture function to understand how frequently this bug manifests
2. **Are there orphaned vectors in Pinecone?** - Each retry that generates a new externalId leaves behind vectors with the old ID that will never resolve
3. **Does `step.ai.wrap()` have the same memoization guarantees as `step.run()`?** - The classify-observation step uses this wrapper
4. **Performance impact of wrapping `nanoid()` in a step** - Adding a step has overhead (state persistence, API call to Inngest). Is there a lighter-weight mechanism for deterministic value generation?
