# Inngest Replay-Safety Fix - Implementation Plan

## Overview

Fix replay-safety violations across all Inngest workflows where non-deterministic values (`nanoid()`, `Date.now()`) are generated outside `step.run()` blocks. On retry/replay, Inngest re-executes the workflow function body but returns memoized results for completed steps — so values generated outside steps change on each attempt while step results remain frozen, causing data mismatches.

The **critical** bug is `nanoid()` at `observation-capture.ts:397` which causes permanent Pinecone/DB `externalId` mismatches. Secondary violations involve `Date.now()` across 5 workflows causing incorrect metrics, shifted time windows, and wrong conditional logic on replay.

## Current State Analysis

### Critical Bug: observation-capture.ts

`externalId = nanoid()` at line 397 is generated outside any `step.run()` block. It's consumed by:

- **Step 6** (`upsert-multi-view-vectors`, line 867): Stores `observationId: externalId` in Pinecone vector metadata
- **Step 7** (`store-observation`, line 933): Stores `externalId` column in DB insert
- **Step 8** (`emit-events`, lines 1060/1079/1103): Propagates `observationId` to downstream events

If Step 6 succeeds but Step 7 fails, the retry generates a **new** `nanoid()` but Step 6 is memoized with the **old** value. Pinecone and DB permanently disagree.

### Secondary Violations

| File | Line | Code | Impact |
|------|------|------|--------|
| `observation-capture.ts` | 391 | `Date.now()` | Wrong duration metrics on replay |
| `observation-capture.ts` | 416 | `Date.now()` fallback in inngestRunId | Wrong job ID if event.id missing (rare) |
| `backfill-orchestrator.ts` | 89 | `Date.now()` | Wrong duration calculations |
| `backfill-orchestrator.ts` | 140 | `Date.now()` | Backfill time window shifts on replay |
| `backfill-orchestrator.ts` | 306 | `Date.now()` | Rate limit sleep recalculated |
| `files-batch-processor.ts` | 77 | `Date.now()` | Wrong batch duration metrics |
| `profile-update.ts` | 98 | `Date.now()` fallback in inngestRunId | Wrong job ID if event.id missing (rare) |
| `cluster-summary.ts` | 121 | `Date.now()` fallback in inngestRunId | Wrong job ID if event.id missing (rare) |
| `llm-entity-extraction-workflow.ts` | 90 | `Date.now()` fallback in inngestRunId | Wrong job ID if event.id missing (rare) |

### Safe Patterns (No Changes Needed)

- `relationship-detection.ts:255` - `nanoid()` inside helper called FROM `step.run("detect-relationships")` → memoized by parent step
- `cluster-assignment.ts:222` - `nanoid()` inside helper called FROM `step.run("assign-cluster")` → memoized by parent step
- `cluster-summary.ts:170` - `Date.now()` inside `step.run("check-threshold")` → re-executes only if step itself retries, which is correct behavior
- `backfill-orchestrator.ts:349` - `Date.now()` inside `step.run("set-backfill-completed")` → same reasoning

### Key Discoveries

- **`observation-capture.ts:397`**: Comment says "Phase 3 optimization" — the nanoid was intentionally placed outside steps for performance, not realizing the replay-safety implications
- **`backfill-orchestrator.ts:306`**: `Date.now()` is between steps (used to calculate `step.sleep()` duration) — on replay this recalculates but the named sleep step is already memoized, so it's actually safe. However, wrapping it is still best practice.
- **`backfill-orchestrator.ts:140`**: `since` calculation is critical — it determines the backfill time window. On replay after partial completion, the time window shifts, potentially re-fetching or missing data.
- **All `inngestRunId` fallbacks**: These use `event.id ?? ...Date.now()...`. Since `event.id` is always present in production (Inngest provides it), the `Date.now()` fallback is defense-in-depth. Still worth fixing for correctness.

## Desired End State

All non-deterministic values consumed across multiple steps are generated inside `step.run()` blocks, ensuring replay-safe behavior. Existing mismatched data in Pinecone is reconciled with the database.

### Verification

1. All `nanoid()` calls consumed across steps are wrapped in `step.run()`
2. All `Date.now()` calls consumed across steps are wrapped in `step.run()`
3. `grep -n "nanoid()" api/console/src/inngest/workflow/` shows no top-level nanoid calls outside steps
4. Existing Pinecone vectors with stale `metadata.observationId` are updated to match DB `externalId`
5. Search and FindSimilar work correctly for previously-mismatched observations

## What We're NOT Doing

- **Not changing the dual ID system** (BIGINT + nanoid) — that's a separate architectural decision
- **Not adding validation to the read path** — Phase 3's trust of `metadata.observationId` is correct once the write path is fixed
- **Not changing Inngest retry configuration** — the fix is in value generation, not retry behavior
- **Not wrapping Date.now() inside step.run() blocks** — those are already memoized by the parent step
- **Not adding a generic replay-safety utility** — each workflow has different needs; individual fixes are clearer

## Implementation Approach

Wrap non-deterministic values in lightweight `step.run()` blocks that generate and return the value. This adds minimal overhead (one extra step state per value) but guarantees the same value on every replay.

For data reconciliation, we'll write a script that queries all observations from the DB, checks their Pinecone vectors, and updates any mismatched `metadata.observationId` values.

---

## Phase 1: Fix Critical `externalId` Bug in observation-capture.ts

### Overview

Wrap `nanoid()` and `Date.now()` in `step.run()` blocks so they're memoized on replay. Also fix the `inngestRunId` fallback.

### Changes Required

#### 1. observation-capture.ts — Wrap externalId and startTime

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Current code** (lines 389-397):
```typescript
async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, sourceEvent } = event.data;
    const startTime = Date.now();

    // Pre-generate externalId at workflow start (Phase 3 optimization)
    // This nanoid is stored in Pinecone metadata for direct lookup, eliminating
    // the need for database queries during search ID normalization.
    // The internal BIGINT id is auto-generated by the database.
    const externalId = nanoid();
```

**New code**:
```typescript
async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, sourceEvent } = event.data;

    // Generate replay-safe values inside steps so they're memoized across retries.
    // Without this, Inngest re-executes the function body on retry, generating new
    // values while completed steps return their memoized results — causing mismatches.
    const { externalId, startTime } = await step.run("generate-replay-safe-ids", () => ({
      externalId: nanoid(),
      startTime: Date.now(),
    }));
```

This combines both values into a single step to minimize overhead. The step name makes the intent clear.

#### 2. observation-capture.ts — Fix inngestRunId fallback

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Current code** (line 416):
```typescript
const inngestRunId = event.id ?? `neural-obs-${sourceEvent.sourceId}-${Date.now()}`;
```

**New code**:
```typescript
const inngestRunId = event.id ?? `neural-obs-${sourceEvent.sourceId}-${startTime}`;
```

Since `startTime` is now replay-safe (memoized in the step above), we can use it as the fallback timestamp. No need for a separate step.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @api/console build`
- [x] Lint passes: `pnpm lint` (no new lint errors in changed files; pre-existing errors across monorepo)
- [x] Type check passes: `pnpm typecheck` (no new errors; pre-existing error in unrelated `@lightfastai/ai-sdk`)

#### Manual Verification:
- [ ] Trigger an observation capture via webhook and verify it completes successfully in Inngest dashboard
- [ ] Verify the observation's `externalId` in the DB matches `metadata.observationId` in Pinecone
- [ ] Verify search returns the new observation with correct `source` and `type` (not "unknown")
- [ ] Verify FindSimilar works for the new observation (no "Content not found" error)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Fix All Date.now() Violations Across Workflows

### Overview

Fix replay-safety violations in `backfill-orchestrator.ts`, `files-batch-processor.ts`, `profile-update.ts`, `cluster-summary.ts`, and `llm-entity-extraction-workflow.ts`.

### Changes Required

#### 1. backfill-orchestrator.ts — Wrap startTime and since

**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

**Current code** (lines 89, 140):
```typescript
const startTime = Date.now();
// ... (50 lines of steps later)
const since = new Date(Date.now() - depth * 24 * 60 * 60 * 1000).toISOString();
```

**New code** (replace line 89):
```typescript
const { startTime, since } = await step.run("generate-replay-safe-timestamps", () => {
  const now = Date.now();
  return {
    startTime: now,
    since: new Date(now - depth * 24 * 60 * 60 * 1000).toISOString(),
  };
});
```

Then remove the `since` calculation at line 140 (it's now computed in the step above).

**Note**: This step must be the **first** step in the workflow (before `validate-integration`). The `depth` variable comes from `event.data` which is available immediately.

**Note on line 306** (`Date.now()` for rate limit sleep): This is used to calculate `sleepMs` for `step.sleep()`. On replay, if the sleep step already completed, it returns immediately regardless of the calculated duration. If it hasn't completed, recalculating is actually correct (we want current time vs reset time). **No change needed** — this is safe as-is.

**Note on line 349** (`Date.now()` for nextAllowedAt): This is inside `step.run("set-backfill-completed")`, so it's already memoized. **No change needed.**

#### 2. backfill-orchestrator.ts — Fix inngestRunId fallback

**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

**Current code** (line 177):
```typescript
inngestRunId: event.id ?? `backfill-${integrationId}-${Date.now()}`,
```

**New code**:
```typescript
inngestRunId: event.id ?? `backfill-${integrationId}-${startTime}`,
```

Uses the memoized `startTime` from the step above.

#### 3. files-batch-processor.ts — Wrap startTime

**File**: `api/console/src/inngest/workflow/processing/files-batch-processor.ts`

**Current code** (line 77):
```typescript
const startTime = Date.now();
```

**New code**:
```typescript
const startTime = await step.run("capture-start-time", () => Date.now());
```

#### 4. profile-update.ts — Fix inngestRunId fallback

**File**: `api/console/src/inngest/workflow/neural/profile-update.ts`

**Current code** (line 98):
```typescript
const inngestRunId = event.id ?? `neural-profile-${actorId}-${Date.now()}`;
```

**New code**:
```typescript
const inngestRunId = event.id ?? `neural-profile-${actorId}-${Date.now()}`;
```

**Actually — no change needed.** The `inngestRunId` is only consumed by a single step (`create-job`). If that step succeeds, the value is memoized. If it fails, re-generating the fallback with a new timestamp is acceptable since the job record wasn't created. The same applies to `cluster-summary.ts:121` and `llm-entity-extraction-workflow.ts:90`.

**Revised approach for all inngestRunId fallbacks**: These are safe because:
1. `event.id` is always present in production (Inngest provides it)
2. The fallback value is only consumed by the immediately following `step.run("create-job")` — if that step succeeds, the value is memoized; if it fails, a new fallback is fine since no job was created

**No changes needed for** `profile-update.ts:98`, `cluster-summary.ts:121`, or `llm-entity-extraction-workflow.ts:90`.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @api/console build`
- [x] Lint passes: `pnpm lint` (no new lint errors in changed files)
- [x] Type check passes: `pnpm typecheck` (no new errors)

#### Manual Verification:
- [ ] Trigger a backfill and verify it completes with correct `durationMs` and `since` values in the job output
- [ ] Trigger file batch processing and verify correct duration in completion event
- [ ] Verify Inngest dashboard shows all steps executing correctly with no errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Reconcile Existing Mismatched Pinecone Data

### Overview

Write a CLI script that detects and fixes Pinecone vectors where `metadata.observationId` doesn't match the DB's `externalId`. This handles data corruption from past replay-safety bugs.

### Changes Required

#### 1. Reconciliation Script

**File**: `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts`

**Logic**:
1. Query all observations from DB (with `externalId`, `embeddingTitleId`, `embeddingContentId`, `embeddingSummaryId`)
2. For each observation, fetch the corresponding Pinecone vectors by vector ID
3. Check if `metadata.observationId` matches `externalId`
4. If mismatched, update the Pinecone vector metadata with the correct `externalId`
5. Log all mismatches found and fixed

```typescript
import { db } from "@db/console";
import { workspaceNeuralObservations } from "@db/console/schema";
import { consolePineconeClient } from "@repo/console-pinecone";
import { eq } from "drizzle-orm";

interface MismatchRecord {
  observationId: number;
  externalId: string;
  vectorId: string;
  pineconeObservationId: string;
  view: "title" | "content" | "summary";
}

async function reconcile(workspaceId: string, indexName: string, namespace: string) {
  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      externalId: workspaceNeuralObservations.externalId,
      embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
      embeddingContentId: workspaceNeuralObservations.embeddingContentId,
      embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
    })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  console.log(`Found ${observations.length} observations to check`);

  const mismatches: MismatchRecord[] = [];
  const batchSize = 100;

  for (let i = 0; i < observations.length; i += batchSize) {
    const batch = observations.slice(i, i + batchSize);
    const vectorIds = batch.flatMap(obs => [
      obs.embeddingTitleId,
      obs.embeddingContentId,
      obs.embeddingSummaryId,
    ].filter(Boolean) as string[]);

    if (vectorIds.length === 0) continue;

    // Fetch vectors from Pinecone
    const vectors = await consolePineconeClient.fetchVectors(indexName, vectorIds, namespace);

    for (const obs of batch) {
      const views = [
        { id: obs.embeddingTitleId, view: "title" as const },
        { id: obs.embeddingContentId, view: "content" as const },
        { id: obs.embeddingSummaryId, view: "summary" as const },
      ];

      for (const { id: vectorId, view } of views) {
        if (!vectorId) continue;
        const vector = vectors[vectorId];
        if (!vector?.metadata) continue;

        const pineconeObsId = (vector.metadata as Record<string, unknown>).observationId as string;
        if (pineconeObsId && pineconeObsId !== obs.externalId) {
          mismatches.push({
            observationId: obs.id,
            externalId: obs.externalId,
            vectorId,
            pineconeObservationId: pineconeObsId,
            view,
          });
        }
      }
    }

    console.log(`Checked ${Math.min(i + batchSize, observations.length)}/${observations.length} observations, found ${mismatches.length} mismatches`);
  }

  if (mismatches.length === 0) {
    console.log("No mismatches found!");
    return;
  }

  console.log(`\nFound ${mismatches.length} mismatches. Fixing...`);

  // Fix mismatches by updating Pinecone metadata
  for (const mismatch of mismatches) {
    const vector = await consolePineconeClient.fetchVectors(
      indexName,
      [mismatch.vectorId],
      namespace,
    );

    const existing = vector[mismatch.vectorId];
    if (!existing) continue;

    const updatedMetadata = {
      ...(existing.metadata as Record<string, unknown>),
      observationId: mismatch.externalId,
    };

    await consolePineconeClient.updateVector(
      indexName,
      mismatch.vectorId,
      { metadata: updatedMetadata },
      namespace,
    );

    console.log(`Fixed: ${mismatch.vectorId} (${mismatch.view}) ${mismatch.pineconeObservationId} → ${mismatch.externalId}`);
  }

  console.log(`\nReconciliation complete. Fixed ${mismatches.length} vectors.`);
}
```

**Note**: The exact Pinecone client API methods (`fetchVectors`, `updateVector`) need to be verified against our `@repo/console-pinecone` package. The script structure above shows the logical flow — adapt method names to match the actual client.

#### 2. Script runner

Add a script entry to `packages/console-test-data/package.json` or run via `tsx`:

```bash
cd packages/console-test-data && pnpm with-env tsx src/cli/reconcile-pinecone-external-ids.ts
```

### Success Criteria

#### Automated Verification:
- [x] Script compiles: `pnpm --filter @repo/console-test-data typecheck` passes cleanly
- [x] Pinecone client methods build: `pnpm --filter @vendor/pinecone build` and `pnpm --filter @repo/console-pinecone build` pass
- [x] API console builds with new methods: `pnpm --filter @api/console build` passes

#### Manual Verification:
- [x] Run reconciliation script against dev/staging workspace (dry-run first)
  - Ran against workspace `oemyoigddw5hiddimdq07` (lightfast-debug-env)
  - Result: 0 mismatches found - all observationIds match correctly
- [x] Script executes successfully and reports results clearly
- [ ] Verify previously-broken search results now return correct `source` and `type` (no mismatches to test)
- [ ] Verify previously-broken FindSimilar calls now succeed (no mismatches to test)
- [x] Reconciliation tooling is ready for production use if mismatches occur

**Implementation Note**: After completing this phase and all verification passes, the fix is complete.

---

## Testing Strategy

### Unit Tests
- No new unit tests required — the fix is a structural change (moving code inside `step.run()`) not a logic change
- Existing tests should continue to pass

### Integration Tests
- Verify via Inngest dashboard that workflows execute correctly after changes
- The replay-safety fix is inherently difficult to test without simulating Inngest retries

### Manual Testing Steps
1. Clear test data (Pinecone + DB) for a test workspace
2. Trigger observation capture via webhook
3. Verify `externalId` consistency between Pinecone metadata and DB
4. Run search → verify results have correct `source`/`type` fields
5. Run FindSimilar on a search result → verify no "Content not found" error
6. Trigger a backfill → verify correct `since` window and duration in job output

## Performance Considerations

- **Phase 1**: Adds 1 extra Inngest step (`generate-replay-safe-ids`) to observation-capture. This is a lightweight step (no I/O, just `nanoid()` + `Date.now()`) but adds one round-trip to Inngest's step state store. Negligible compared to the 15+ existing steps.
- **Phase 2**: Adds 1 extra step to backfill-orchestrator and 1 to files-batch-processor. Same negligible overhead.
- **Phase 3**: Reconciliation script does batch Pinecone fetches (100 vectors at a time) and individual updates for mismatches. Should be run during low-traffic periods.

## Migration Notes

- **No database migrations required** — all changes are to workflow code
- **Backwards compatible** — existing memoized step results in Inngest are not affected. New step names don't conflict with existing ones.
- **Phase 3 (reconciliation) is idempotent** — can be run multiple times safely. It only updates vectors that are actually mismatched.

## References

- Research: `thoughts/shared/research/2026-02-07-inngest-externalid-replay-safety-bug.md`
- Read path analysis: `thoughts/shared/research/2026-02-07-v1-findsimilar-api-flow-analysis.md`
- Search investigation: `thoughts/shared/research/2026-02-07-v1-search-zero-results-investigation.md`
- Critical file: `api/console/src/inngest/workflow/neural/observation-capture.ts:397`
- ID resolver: `apps/console/src/lib/neural/id-resolver.ts:62-156`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts:82-210`
