---
date: 2026-03-17T00:00:00+00:00
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: main
repository: lightfast
topic: "Drop all Redis cache layers from apps/relay"
tags: [relay, redis, cache, simplification, webhooks]
status: complete
last_updated: 2026-03-17
---

# Drop Redis Cache Layers from `apps/relay`

## Overview

Remove all Redis caching from `apps/relay` — both the resource→connection lookup cache and the webhook dedup cache — leaving only direct DB queries. During early development, stale production state in Redis causes hard-to-debug routing failures. Secondary dedup mechanisms (DB `onConflictDoNothing` + QStash `deduplicationId`) provide correctness guarantees without Redis.

## Current State Analysis

Two independent Redis cache layers exist in relay:

### Layer 1: Resource Cache (`gw:resource:*`)
Maps `(provider, resourceId)` → `{ connectionId, orgId }` to avoid a DB lookup per webhook.
- **Key**: `gw:resource:${provider}:${resourceId}` — TTL 86400s
- **Read**: `workflows.ts:97-101` — `redis.hgetall()` before DB query in `resolve-connection` step
- **Write**: `workflows.ts:129-136` — `redis.pipeline().hset().expire()` after DB miss
- **Rebuild**: `admin.ts:66-108` — `POST /admin/cache/rebuild` batch-repopulates from DB
- A working DB fallthrough already exists at `workflows.ts:104-121`

### Layer 2: Dedup Cache (`gw:webhook:seen:*`)
Prevents duplicate webhook processing at the first step.
- **Key**: `gw:webhook:seen:${provider}:${deliveryId}` — TTL 86400s
- **Standard path**: `workflows.ts:51-58` — `redis.set(..., { nx: true, ex: 86400 })` as Step 1
- **Service auth path**: `webhooks.ts:80-84` — same NX set in the handler directly
- **Dev flush**: `admin.ts:324-331` — `POST /admin/dev/flush-dedup` (non-production only)
- Secondary dedup exists: `onConflictDoNothing()` at `workflows.ts:84` + QStash `deduplicationId` at `workflows.ts:228`

### Health Check
- `admin.ts:33` — `redis.ping()` in `GET /admin/health`

All key definitions live in `src/lib/cache.ts` which will be deleted entirely.

## Desired End State

- `src/lib/cache.ts` is deleted
- `workflows.ts` imports no Redis; `resolve-connection` step is a pure DB query; no dedup step
- `webhooks.ts` imports no Redis; no dedup block in service auth path
- `admin.ts` imports no Redis; `GET /admin/health` checks only DB; no `cache/rebuild` or `dev/flush-dedup` endpoints
- All tests updated to reflect the simplified model
- `pnpm check && pnpm typecheck` pass with zero errors

### Key Discoveries
- `src/lib/cache.ts:9-17` — only two exports (`resourceKey`, `webhookSeenKey`); file becomes empty after removal
- `workflows.ts:88-140` — `resolve-connection` step already has complete DB fallthrough logic; cache removal is purely subtractive
- `relay-ttl-expiry.test.ts` — entire file tests Redis dedup TTL; deleted wholesale
- `relay-scenario-matrix.test.ts:248` — `72 = 4×3×3×2` scenarios; drops to `16 = 4×2×2` after removing dedup and cache-hit dimensions
- `admin.test.ts:173-177` — mocks `../lib/cache` directly; that mock is removed

## What We're NOT Doing

- Not changing QStash dedup (`deduplicationId`) — it stays in `workflows.ts:228`
- Not changing `onConflictDoNothing()` on the DB insert — it stays as secondary dedup
- Not removing the Upstash Workflow client (`@vendor/upstash-workflow`) — unrelated to cache
- Not removing QStash client (`@vendor/qstash`) — unrelated
- Not touching `apps/gateway` — separate service
- Not removing the `@vendor/upstash` package dependency — may be used elsewhere in the monorepo

## Implementation Approach

Remove cache layer-by-layer: resource cache first (larger blast radius, easier to reason about), dedup cache second, then clean up imports and health check, then update tests. Source and tests are kept in sync within each phase — never leave a broken test file between commits.

---

## Phase 1: Drop Resource Cache

### Overview
Remove the Redis-backed resource→connection lookup. The `resolve-connection` step becomes a pure DB query.

### Changes Required

#### 1. `src/routes/workflows.ts`
**Remove**: `redis` import from `@vendor/upstash`
**Remove**: `RESOURCE_CACHE_TTL` and `resourceKey` from `../lib/cache.js` imports
**Rewrite** Step 3 `resolve-connection` — replace the `hgetall` + pipeline block with direct DB query:

```ts
// Before (lines 89-140):
const connectionInfo = await context.run<ConnectionInfo | null>(
  "resolve-connection",
  async () => {
    if (!data.resourceId) {
      return null;
    }

    // Try Redis cache first
    const cached = await redis.hgetall<Record<string, string>>(
      resourceKey(data.provider, data.resourceId)
    );
    if (cached?.connectionId && cached.orgId) {
      return { connectionId: cached.connectionId, orgId: cached.orgId };
    }

    // Fallthrough to PlanetScale
    const rows = await db
      .select({ ... })
      .from(gatewayResources)
      .innerJoin(...)
      .where(...)
      .limit(1);

    const row = rows[0];
    if (!row) { return null; }

    // Populate Redis cache for next time
    const key = resourceKey(data.provider, data.resourceId);
    const pipeline = redis.pipeline();
    pipeline.hset(key, { connectionId: row.installationId, orgId: row.orgId });
    pipeline.expire(key, RESOURCE_CACHE_TTL);
    await pipeline.exec();

    return { connectionId: row.installationId, orgId: row.orgId };
  }
);

// After:
const connectionInfo = await context.run<ConnectionInfo | null>(
  "resolve-connection",
  async () => {
    if (!data.resourceId) {
      return null;
    }

    const rows = await db
      .select({
        installationId: gatewayResources.installationId,
        orgId: gatewayInstallations.orgId,
      })
      .from(gatewayResources)
      .innerJoin(
        gatewayInstallations,
        eq(gatewayResources.installationId, gatewayInstallations.id)
      )
      .where(
        and(
          eq(gatewayResources.providerResourceId, data.resourceId),
          eq(gatewayResources.status, "active")
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return { connectionId: row.installationId, orgId: row.orgId };
  }
);
```

#### 2. `src/routes/admin.ts`
**Remove**: `redis` import from `@vendor/upstash` (will be re-added in Phase 3 cleanup — leave for now if health check still uses it; removing fully in Phase 3)
**Remove**: `RESOURCE_CACHE_TTL` and `resourceKey` imports from `../lib/cache.js`
**Delete** entire `POST /admin/cache/rebuild` route handler (`admin.ts:66-108`)

#### 3. `src/lib/cache.ts`
**Remove** lines 6-13 (`resourceKey` and `RESOURCE_CACHE_TTL`) — leave `webhookSeenKey` for now

#### 4. `src/routes/admin.test.ts`
**Remove** `vi.mock("../lib/cache", ...)` block (`admin.test.ts:173-177`)
**Delete** `describe("POST /api/admin/cache/rebuild", ...)` block (`admin.test.ts:485-569`)

#### 5. `src/routes/workflows.test.ts`
**Remove** `@vendor/upstash` mock and all `mockRedis*` declarations that relate to the resource cache (`mockRedisHgetall`, `mockRedisHset`, `mockRedisExpire`, `mockPipelineExec`)
**Delete** test: `publishes to Console when connection found in Redis cache` (lines 201-246)
**Delete** test: `falls through to DB when Redis cache misses, then populates cache` (lines 248-270)
**Delete** test: `falls through to DB when Redis cache has partial data` (lines 315-335)
**Delete** test: `falls through to DB when Redis cache returns empty object` (lines 337-353)
**Delete** test: `Redis hgetall throws during resolve → error propagates` (lines 368-376)
**Delete** test: `Redis pipeline exec (cache populate) throws` (lines 389-403)
**Update** remaining tests: remove `mockRedisHgetall` setup from `beforeEach` and any remaining tests that set it
**Update** comment in `publishes to Console...` replacement test — step count drops from 6 to 5 (dedup removed in Phase 2, but remove cache-related step assertions now)
**Update** `resolve-connection retry` tests to remove `mockRedisHgetall` assertions

#### 6. `src/routes/relay-fault-injection.test.ts`
**Remove** `@vendor/upstash` mock and `mockRedisHgetall`, `mockRedisHset`, `mockRedisExpire`, `mockPipelineExec` declarations
**Delete** `step 3 — resolve-connection fault injection` sub-tests:
  - `redis.hgetall throws → handler rejects after 2 steps`
  - `redis pipeline.exec throws during cache populate`
**Keep** (rewrite without Redis setup):
  - `DB query throws during fallthrough → handler rejects, no publish`
  - `on retry: resolve step re-executes, dedup uses cached result` (remove `mockRedisHgetall` assertion, keep the `mockRedisSet` not-called check — still valid for Phase 1)
**Update** `setHappyPath()` — remove `mockRedisHgetall` and `mockPipelineExec` setup

#### 7. `src/routes/relay-scenario-matrix.test.ts`
**Remove** `@vendor/upstash` mock and `mockRedisHgetall`, `mockRedisHset`, `mockRedisExpire`, `mockPipelineExec` declarations
**Remove** `"cache-hit"` from `resolutionPath` dimension (now `["db-hit", "not-found"]`)
**Update** `configureMocks()` — remove `mockRedisHgetall` setup for `cache-hit` and `db-hit` paths
**Remove** Invariant V check: `expect(mockRedisHset).toHaveBeenCalledWith(...)` for `db-hit` path
**Remove** cache-hit check: `expect(mockRedisHset).not.toHaveBeenCalled()` for `cache-hit` path
**Update** scenario count comment: `4 × 2 × 3 × 2 = 48` (cache-hit removed; dedup dimension stays for Phase 2)

#### 8. `src/routes/relay-post-teardown.test.ts`
**Remove** `mockRedisHgetall` from mock setup — the `hgetall` mock (lines 38-49)
**Update** test `partial teardown (only cache-cleanup, DB still active)` — this test concept no longer applies since there is no separate cache layer. The test verifies DB fallback works when `hgetall` returns null, which is now always the case. Delete this test.
**Keep** the main test about "after soft-delete, webhook goes to DLQ" — it already uses `mockDbRows = []` as the signal
**Update** the "active connection routes to Console" baseline test to remove `mockRedisHgetall` setup (it will now rely purely on DB rows)

### Success Criteria

#### Automated Verification:
- [x] `pnpm check` — no linting errors (relay passes; pre-existing errors in other apps)
- [x] `pnpm typecheck` — no TypeScript errors
- [x] `pnpm --filter relay test` — all tests pass (185/185)
- [x] No remaining references to `resourceKey` or `RESOURCE_CACHE_TTL`: `grep -r "resourceKey\|RESOURCE_CACHE_TTL" apps/relay/src`
- [x] No remaining `hgetall` calls in source (not tests): `grep -r "hgetall" apps/relay/src --include="*.ts" --exclude="*.test.ts"`

**Implementation Note**: After completing Phase 1 and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Drop Dedup Cache

### Overview
Remove the Redis SET NX dedup step from the workflow and the service auth handler. Dedup responsibility falls entirely to `onConflictDoNothing()` (DB) and QStash `deduplicationId`.

### Changes Required

#### 1. `src/routes/workflows.ts`
**Remove**: remaining `redis` import from `@vendor/upstash`
**Remove**: `webhookSeenKey` import from `../lib/cache.js` (file will now have no imports from `../lib/cache.js`)
**Delete** Step 1 `dedup` entirely (`workflows.ts:49-63`):
```ts
// Delete this entire block:
const isDuplicate = await context.run("dedup", async () => {
  const result = await redis.set(
    webhookSeenKey(data.provider, data.deliveryId),
    "1",
    { nx: true, ex: 86_400 }
  );
  return result === null;
});

if (isDuplicate) {
  return;
}

log.info("[webhook-delivery] dedup passed", { ... });
```

#### 2. `src/routes/webhooks.ts`
**Remove**: `redis` import from `@vendor/upstash`
**Remove**: `webhookSeenKey` import from `../lib/cache.js`
**Delete** the dedup block in the service auth path (`webhooks.ts:79-88`):
```ts
// Delete:
const dedupResult = await redis.set(
  webhookSeenKey(providerName, deliveryId),
  "1",
  { nx: true, ex: 86_400 }
);
if (dedupResult === null) {
  c.set("logFields", { ...c.get("logFields"), duplicate: true });
  return c.json({ status: "duplicate", deliveryId });
}
```

#### 3. `src/routes/admin.ts`
**Delete** the `POST /admin/dev/flush-dedup` endpoint (`admin.ts:324-331`)
**Delete** the `DELETE /admin/dev/backfill-runs/:installationId` endpoint is unrelated to Redis — **keep it**
**Remove**: `redis` import from `@vendor/upstash` (now fully unused)

#### 4. `src/lib/cache.ts`
**Delete** the file entirely. It has no remaining exports.

#### 5. `src/routes/relay-ttl-expiry.test.ts`
**Delete** the file entirely. It tests only the Redis dedup TTL window.

#### 6. `src/routes/workflows.test.ts`
**Remove** `mockRedisSet` declaration and all `@vendor/upstash` mock (now fully unused in this file)
**Delete** test: `stops on duplicate delivery` (lines 189-199)
**Delete** test: `Redis dedup (SET NX) throws → error propagates` (lines 356-366)
**Delete** `step-level retry semantics` sub-tests that reference `dedup` step caching:
  - `publish retry after resolve-connection failure uses cached dedup result`
  - `resolve-connection retry after failure uses cached dedup result`
  - `DLQ publish retry uses cached dedup and resolve results`
  - `duplicate detection is stable across retries when cached`
**Update** remaining tests: remove all `mockRedisSet` setup and assertions
**Update** step count in comments: happy path is now 5 steps (`persist-delivery`, `resolve-connection`, `route`, `publish-to-console`, `update-status-enqueued`); DLQ path is 4 steps
**Update** `state machine is exhaustive` — remove mention of duplicate path

#### 7. `src/routes/relay-fault-injection.test.ts`
**Remove** `mockRedisSet` declaration and `@vendor/upstash` mock (now fully unused)
**Delete** `describe("step 1 — dedup fault injection", ...)` block entirely (lines 177-199)
**Delete** remaining `setHappyPath()` Redis setup (`mockRedisSet.mockResolvedValue("OK")`)
**Update** `makeRetryContext` tests — remove `dedup: false` from all `cachedSteps` objects
**Update** comment header to remove "Step 1: dedup" from the step list
**Update** the retry-context tests in Steps 4, 5a, 5c that assert `expect(mockRedisSet).not.toHaveBeenCalled()`

#### 8. `src/routes/relay-scenario-matrix.test.ts`
**Remove** `mockRedisSet` declaration and `@vendor/upstash` mock (now fully unused)
**Remove** `deduplication` dimension entirely — remove from `dims` object
**Update** `configureMocks()` to remove all dedup setup (`mockRedisSet` usage)
**Remove** Invariant I check (`duplicate → 1 step, no side effects`)
**Remove** Invariant VII check (`redis-unavailable → throws`)
**Delete** duplicate-handling block in the invariant runner
**Update** scenario count: `4 × 2 × 2 = 16` (4 providers × 2 resolution paths × 2 QStash outcomes)
**Update** header comment describing scenario dimensions

#### 9. `src/routes/webhooks.test.ts`
**Remove** `mockRedisSet` from `vi.hoisted()` return value
**Remove** `vi.mock("@vendor/upstash", ...)` block (`webhooks.test.ts:52-54`)
**Remove** `mockRedisSet.mockResolvedValue("OK")` from `beforeEach`
**Delete** test: `returns 500 when Redis throws during service auth dedup` (lines 297-313)
**Delete** test: `returns duplicate when Redis dedup rejects` (lines 440-459)

#### 10. `src/routes/admin.test.ts`
**Remove** `mockRedisPing` and `mockRedisPipeline` from hoisted mocks
**Update** `@vendor/upstash` mock — remove entirely since `admin.ts` no longer imports redis
**Remove** `mockRedisPing.mockResolvedValue("PONG")` from `resetAllMocks()`
**Delete** `GET /admin/health` tests that reference Redis:
  - `returns 503 with status=degraded when Redis ping fails`
  - `returns 503 when both Redis and DB fail`
**Update** `returns 200 with status=ok when Redis and DB are healthy` — remove `redis: "connected"` assertion
**Update** `response always includes redis, database, and uptime_ms fields` — remove `redis` field check
**Update** `returns 503 when DB execute fails` — response no longer has `redis` field

### Success Criteria

#### Automated Verification:
- [x] `pnpm check` — no linting errors
- [x] `pnpm typecheck` — no TypeScript errors
- [x] `pnpm --filter relay test` — all tests pass (137/137)
- [x] `src/lib/cache.ts` file does not exist
- [x] `src/routes/relay-ttl-expiry.test.ts` file does not exist
- [x] No remaining `redis` import in `workflows.ts` or `webhooks.ts`: `grep -n "from.*upstash\"" apps/relay/src/routes/workflows.ts apps/relay/src/routes/webhooks.ts`
- [x] No remaining `webhookSeenKey` references: `grep -r "webhookSeenKey" apps/relay/src`

**Implementation Note**: After completing Phase 2 and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Simplify Health Check

### Overview
Simplify `GET /admin/health` to check only DB connectivity. The Redis check is meaningless now that relay has no Redis dependencies on its critical path.

### Changes Required

#### 1. `src/routes/admin.ts`
**Rewrite** `GET /admin/health` handler:

```ts
// Before:
admin.get("/health", async (c) => {
  let redisStatus = "unknown";
  let databaseStatus = "unknown";

  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    redisStatus = "error";
  }

  try {
    await db.execute(sql`SELECT 1`);
    databaseStatus = "connected";
  } catch {
    databaseStatus = "error";
  }

  const allHealthy =
    redisStatus === "connected" && databaseStatus === "connected";

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      redis: redisStatus,
      database: databaseStatus,
      uptime_ms: Date.now() - startTime,
    },
    allHealthy ? 200 : 503
  );
});

// After:
admin.get("/health", async (c) => {
  let databaseStatus = "unknown";

  try {
    await db.execute(sql`SELECT 1`);
    databaseStatus = "connected";
  } catch {
    databaseStatus = "error";
  }

  const allHealthy = databaseStatus === "connected";

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      database: databaseStatus,
      uptime_ms: Date.now() - startTime,
    },
    allHealthy ? 200 : 503
  );
});
```

#### 2. `src/routes/admin.test.ts`
**Update** `GET /admin/health` describe block:
- Remove `redis: "connected"` from the healthy response assertion
- Remove `uptime_ms` field check from the `response always includes` test (keep `database` and `uptime_ms`, remove `redis`)
- Delete `returns 503 with status=degraded when Redis ping fails` test (already deleted in Phase 2)
- Update `returns 200 with status=ok` to not check `redis` field

### Success Criteria

#### Automated Verification:
- [x] `pnpm check` — no linting errors
- [x] `pnpm typecheck` — no TypeScript errors
- [x] `pnpm --filter relay test` — all tests pass (137/137)
- [x] No remaining `redis` import anywhere in `apps/relay/src`: `grep -r "from.*upstash\"" apps/relay/src --include="*.ts" --exclude="*.test.ts"`
- [x] `GET /admin/health` response shape confirmed: `{ status, database, uptime_ms }` — no `redis` field

#### Manual Verification:
- [ ] Start `pnpm dev:relay` and hit `GET /admin/health` — returns `{ status: "ok", database: "connected", uptime_ms: N }`
- [ ] No Redis-related errors in relay logs

---

## Testing Strategy

### After All Phases Complete

| Test File | Outcome |
|-----------|---------|
| `relay-ttl-expiry.test.ts` | Deleted |
| `relay-fault-injection.test.ts` | Rewritten — Steps 2–6 only, no Redis |
| `relay-scenario-matrix.test.ts` | Rewritten — 16 scenarios (was 72) |
| `relay-post-teardown.test.ts` | Simplified — DB-only teardown |
| `workflows.test.ts` | Updated — no Redis mocks |
| `admin.test.ts` | Updated — no Redis mocks, simplified health tests |
| `webhooks.test.ts` | Updated — remove Redis mock, delete 2 dedup-specific tests |

### Remaining Test Coverage After Changes

Key invariants still tested:
- `onConflictDoNothing` prevents DB duplicate insert
- Null resourceId → DLQ
- DB miss → DLQ
- DB hit → Console publish with correct envelope shape
- QStash publish failure → error propagates
- Step-level retry semantics (without dedup step)
- Health check: DB up → 200, DB down → 503

## Performance Considerations

Every webhook going through the standard path now costs one additional DB query (the resource lookup that was previously cached). At development traffic levels this is negligible. If throughput becomes a concern post-launch, the resource cache can be reintroduced with a proper cache invalidation strategy wired to connection lifecycle events.

## Migration Notes

None — this is a pure deletion. No data migration required. Existing Redis keys (`gw:resource:*`, `gw:webhook:seen:*`) in production will expire naturally via their 24h TTL. No manual Redis flush is needed.

## References

- Research: `thoughts/shared/research/` (see session conversation for full analysis)
- `apps/relay/src/lib/cache.ts` — definitions being deleted
- `apps/relay/src/routes/workflows.ts` — primary workflow file
- `apps/relay/src/routes/webhooks.ts` — service auth dedup
- `apps/relay/src/routes/admin.ts` — cache rebuild + health check
