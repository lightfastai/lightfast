# Fix Backfill resolveSource Dead Branch

## Overview

Remove the redundant `X-API-Key` conditional in `apps/backfill/src/middleware/lifecycle.ts:resolveSource`. Both the `X-API-Key` branch and the fallback return `"service"`, making the check dead code.

## Current State Analysis

In `apps/backfill/src/middleware/lifecycle.ts:20-27`:

```ts
function resolveSource(c: {
  req: { header(name: string): string | undefined };
}): string {
  const explicit = c.req.header("X-Request-Source");
  if (explicit) {return explicit;}
  if (c.req.header("X-API-Key")) {return "service";}  // ← dead branch
  return "service";                                     // ← same value
}
```

The sibling services (`gateway`, `connections`) have distinct fallbacks (`"external"`, `"browser"`), so their `X-API-Key` checks are meaningful. Only backfill has this issue because it exclusively receives internal calls.

## Desired End State

`resolveSource` in backfill returns the explicit `X-Request-Source` header if present, otherwise `"service"`. No dead branches. The JSDoc comment is updated to reflect the simplified logic.

## What We're NOT Doing

- Changing `gateway` or `connections` `resolveSource` — they're correct
- Modifying how `resolveSource` is called or any other part of the lifecycle middleware
- Adding tests — this is a trivial dead-code removal with no behavioral change

## Implementation

### Phase 1: Remove dead branch

**File**: `apps/backfill/src/middleware/lifecycle.ts`

Replace lines 12-27 with:

```ts
/**
 * Derive request source from headers.
 *
 * Priority:
 * 1. Explicit X-Request-Source header (set by callers, like x-trpc-source)
 * 2. Fallback "service" — backfill only receives internal calls
 */
function resolveSource(c: {
  req: { header(name: string): string | undefined };
}): string {
  return c.req.header("X-Request-Source") ?? "service";
}
```

Changes:
- Remove the dead `X-API-Key` branch
- Simplify to a single-expression return using `??`
- Update JSDoc to remove the now-deleted priority item

### Success Criteria

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Backfill builds: `pnpm --filter @apps/backfill build`

#### Manual Verification:
- [ ] Confirm lifecycle logs still show correct `source` field in dev
