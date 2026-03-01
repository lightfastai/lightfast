# Fix Backfill Test Failure

## Overview

The `backfill.test.ts` test "forwards to QStash and returns queued status" is failing because the `backfill.ts` implementation was updated to include `depth` (default 30), `entityTypes`, `X-Correlation-Id` header, and a richer deduplication key — but the test wasn't updated to match.

## Current State Analysis

**Implementation** (`apps/gateway/src/routes/backfill.ts`):
- Schema has `depth: z.number().int().positive().default(30)` and `entityTypes: z.array(z.string()).optional()`
- QStash body always includes `depth` and `entityTypes` (line 49)
- Headers include `X-Correlation-Id: c.get("correlationId")` (line 47)
- Deduplication key format: `backfill:${provider}:${installationId}:${orgId}:d=${depth}:e=${entityTypes?.sort().join(",") || ""}` (line 51)

**Test** (`apps/gateway/src/routes/backfill.test.ts:115-139`):
- Sends minimal body (no `depth` or `entityTypes`)
- Expects body without `depth`/`entityTypes`
- Expects headers without `X-Correlation-Id`
- Expects old deduplication key format `backfill:github:inst-1:org-1`

## Desired End State

The test at line 115-139 matches the actual implementation behavior when called with a minimal body (no `depth`/`entityTypes`):
- Body includes `depth: 30` (zod default) and `entityTypes: undefined`
- Headers include `X-Correlation-Id: undefined` (no lifecycle middleware in test)
- Deduplication key is `backfill:github:inst-1:org-1:d=30:e=`

All tests pass: `pnpm test`

## What We're NOT Doing

- Changing the implementation logic
- Adding new tests
- Modifying the lifecycle middleware or test harness

## Implementation Approach

Single change: update the expected values in the failing test assertion to match the current implementation.

## Phase 1: Update Test Assertion

### Overview
Fix the test expectation to match the updated implementation.

### Changes Required:

#### 1. Update test assertion
**File**: `apps/gateway/src/routes/backfill.test.ts`
**Changes**: Update the `toHaveBeenCalledWith` block at lines 128-138

```typescript
expect(mockPublishJSON).toHaveBeenCalledWith({
  url: "https://backfill.test/api/trigger",
  headers: {
    "X-API-Key": "test-api-key",
    "X-Correlation-Id": undefined,
  },
  body: {
    installationId: "inst-1",
    provider: "github",
    orgId: "org-1",
    depth: 30,
    entityTypes: undefined,
  },
  retries: 3,
  deduplicationId: "backfill:github:inst-1:org-1:d=30:e=",
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All gateway tests pass: `pnpm --filter @lightfast/gateway test`
- [ ] Full test suite passes: `pnpm test`

## References

- Implementation: `apps/gateway/src/routes/backfill.ts`
- Test file: `apps/gateway/src/routes/backfill.test.ts`
