# Fix Backfill Deduplication Key

## Overview

The QStash `deduplicationId` for backfill triggers is too coarse — it only includes `provider`, `installationId`, and `orgId`, causing different parameterized backfills (varying `depth` or `entityTypes`) to be silently suppressed within QStash's dedup window.

## Current State Analysis

**File**: `apps/gateway/src/routes/backfill.ts:51`

```ts
deduplicationId: `backfill:${provider}:${installationId}:${orgId}`,
```

The request schema accepts five fields (line 11-17):
- `installationId` (required)
- `provider` (required)
- `orgId` (required)
- `depth` (optional positive int — narrowed to `7 | 30 | 90` downstream)
- `entityTypes` (optional string array)

Only the three required fields are included in the dedup key. The two optional parameters that differentiate backfill runs are ignored.

### Impact

Within QStash's deduplication window, a second backfill request for the same connection but with different `depth` or `entityTypes` is silently dropped — it never reaches the backfill service or Inngest.

Note: Inngest's own concurrency control (`limit: 1, key: "event.data.installationId"` at `backfill-orchestrator.ts:15`) serializes execution but does **not** drop events. The QStash dedup is the layer causing message loss.

## Desired End State

The `deduplicationId` uniquely identifies parameterized backfill runs, so that different combinations of `depth` and `entityTypes` for the same connection are queued independently.

**New key format**:
```
backfill:${provider}:${installationId}:${orgId}:d=${depth ?? ""}:e=${sortedEntities}
```

Where `sortedEntities` is `entityTypes` sorted alphabetically and joined with `,` (or empty string if undefined).

## What We're NOT Doing

- Not changing the Inngest concurrency key (it correctly serializes per installation)
- Not changing the cancellation dedup key at `apps/connections/src/lib/urls.ts:73` (it correctly operates on `installationId` only)
- Not changing the backfill trigger route schema or downstream defaults

## Phase 1: Update Deduplication Key

### Changes Required

**File**: `apps/gateway/src/routes/backfill.ts`

Replace line 51:
```ts
deduplicationId: `backfill:${provider}:${installationId}:${orgId}`,
```

With:
```ts
deduplicationId: `backfill:${provider}:${installationId}:${orgId}:d=${depth ?? ""}:e=${entityTypes ? [...entityTypes].sort().join(",") : ""}`,
```

This ensures:
- `depth=7` and `depth=90` produce different keys
- `entityTypes=["issue","pull_request"]` and `entityTypes=["pull_request","issue"]` produce the **same** key (sorted)
- Omitted `depth` or `entityTypes` produce a distinct key from any explicit value (via empty string)

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Gateway tests pass: `pnpm --filter @apps/gateway test`

#### Manual Verification:
- [ ] Trigger two backfills for the same connection with different `depth` values — both should be queued (not deduplicated)
- [ ] Trigger two backfills with the same parameters — second should be deduplicated as before
