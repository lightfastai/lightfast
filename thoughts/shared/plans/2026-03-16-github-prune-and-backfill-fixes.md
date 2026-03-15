# GitHub Prune + Backfill Bug Fixes

## Overview

Two goals:
1. **Prune GitHub to PRs + Issues only** — remove push, releases, and discussions from the provider definition, backfill, and schemas.
2. **Fix three remaining backfill bugs** — gap-filter per-resource (Bug 1), eventsProduced counting (Bug 4), null resourceName skip (Bug 5), and `merged: null` schema (Edge Case 7).

## Current State

- GitHub `backfill.entityTypes` supports `pull_request`, `issue`, `release`
- GitHub `events` map has 5 handlers: `push`, `pull_request`, `issues`, `release`, `discussion`
- Gap filter at `backfill-orchestrator.ts:116-125` keys only on `entityType`, not `(resourceId, entityType)`
- `backfillRunRecord` schema has no `providerResourceId` field
- `entity-worker.ts:137` uses `rawCount` (pre-filter) for `eventsProduced` stat
- `githubPullRequestSchema.merged` is `z.boolean().optional()` — list API may return `merged: null`, which would fail Zod parse
- Null `resourceName` is coerced to `""` and silently fails with HTTP 404

## Desired End State

- GitHub backfill supports only `pull_request` and `issue`
- GitHub event handlers are only `pull_request` and `issues`
- `githubWebhookEventTypeSchema` only contains `"pull_request"` and `"issues"`
- Gap filter keys on `(entityType, providerResourceId)` — new resources added to existing connections are properly backfilled
- `gatewayBackfillRuns` unique index is `(installationId, providerResourceId, entityType)`
- `eventsProduced` in run records reflects filtered event count, not raw API item count
- Resources with null/empty `resourceName` are skipped with a warning
- `merged` field in PR schema accepts `null` from the list API; adapter derives it from `merged_at` if absent

### Verification:
- `pnpm check && pnpm typecheck` pass
- `pnpm --filter @repo/console-providers test` passes
- `pnpm --filter apps-backfill test` passes
- Adding a new repo to an existing GitHub connection and re-triggering backfill results in that repo being included (not skipped by gap filter)

## What We're NOT Doing

- **Not removing transformer functions** for push/release/discussion — they remain as dead code for now (separate cleanup)
- **Not removing pre-transform Zod schemas** for push/release/discussion (same — separate cleanup)
- **Not migrating existing `sync.events` configs** in the DB — old connections may reference removed event types, but the console transformer layer will simply find no handler and ignore them
- **Not adding explicit relay-level rejection** for push/release/discussion webhooks from GitHub — the existing no-handler path is acceptable

---

## Phase 1: Prune GitHub to PRs + Issues

### Overview

Remove push, release, discussion from the GitHub provider definition. Drop release from the backfill definition. Update the webhook event type enum.

### Changes Required

#### 1. Provider definition — `packages/console-providers/src/providers/github/index.ts`

**Remove from `categories`** (lines 86-112): delete `push`, `release`, `discussion` entries.

```ts
categories: {
  pull_request: {
    label: "Pull Requests",
    description: "Capture PR opens, merges, closes, and reopens",
    type: "observation",
  },
  issues: {
    label: "Issues",
    description: "Capture issue opens, closes, and reopens",
    type: "observation",
  },
},
```

**Remove from `events`** (lines 114-165): delete `push`, `release`, `discussion` handlers. Keep `pull_request` and `issues`.

**Update `defaultSyncEvents`** (lines 304-310):
```ts
defaultSyncEvents: ["pull_request", "issues"],
```

**Update `processCallback` events list** (line 295):
```ts
events: ["pull_request", "issues"],
```

**Remove unused imports** at top of file:
- `preTransformGitHubDiscussionEventSchema`
- `preTransformGitHubPushEventSchema`
- `preTransformGitHubReleaseEventSchema`
- `transformGitHubDiscussion`
- `transformGitHubPush`
- `transformGitHubRelease`

#### 2. Webhook event type schema — `packages/console-providers/src/providers/github/schemas.ts`

Update `githubWebhookEventTypeSchema` (line 190):
```ts
export const githubWebhookEventTypeSchema = z.enum([
  "pull_request",
  "issues",
]);
```

#### 3. Backfill definition — `packages/console-providers/src/providers/github/backfill.ts`

Remove `release` handler and associated imports:
```ts
export const githubBackfill: BackfillDef = {
  supportedEntityTypes: ["pull_request", "issue"],
  defaultEntityTypes: ["pull_request", "issue"],
  entityTypes: {
    pull_request: typedEntityHandler<{ page: number }>({ ... }),  // unchanged
    issue: typedEntityHandler<{ page: number }>({ ... }),          // unchanged
  },
};
```

Remove:
- `adaptGitHubReleaseForTransformer` function (lines 49-59)
- Import of `githubReleaseSchema` from `./api`
- Import of `PreTransformGitHubReleaseEvent` from `./schemas`

#### 4. API endpoints — `packages/console-providers/src/providers/github/api.ts`

Remove `list-releases` endpoint (lines 181-186) and `githubReleaseSchema` (lines 51-64).

#### 5. Backfill tests — `packages/console-providers/src/providers/github/backfill.test.ts`

Remove describe block for `adaptGitHubReleaseForTransformer` and its import.

#### 6. Round-trip tests — `packages/console-providers/src/providers/github/backfill-round-trip.test.ts`

Remove any release round-trip test cases (if present).

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/console-providers test` passes
- [x] `pnpm check` passes (no unused imports, no lint errors)
- [x] `pnpm typecheck` passes

#### Manual Verification:
- [ ] GitHub provider definition has only `pull_request` and `issues` categories in console UI

---

## Phase 2: Fix Gap-Filter Per-Resource (Bug 1)

### Overview

Add `providerResourceId` to `gatewayBackfillRuns`, change the unique index, update the gateway route, add `providerResourceId` to the backfill run schema, and update the orchestrator to persist and filter per-(resource, entityType).

### Changes Required

#### 1. DB schema — `db/console/src/schema/tables/gateway-backfill-runs.ts`

Add `providerResourceId` column, update unique index:
```ts
providerResourceId: varchar("provider_resource_id", { length: 191 })
  .notNull()
  .default(""),
```

Change unique index:
```ts
// Replace existing installationEntityIdx with:
installationResourceEntityIdx: uniqueIndex(
  "gateway_br_installation_resource_entity_idx"
).on(table.installationId, table.providerResourceId, table.entityType),
```

Drop old `gateway_br_installation_entity_idx` index.

**After editing, run**: `cd db/console && pnpm db:generate && pnpm db:migrate`

#### 2. Backfill run schemas — `packages/console-providers/src/gateway.ts`

Add `providerResourceId` to both schemas:
```ts
export const backfillRunRecord = z.object({
  entityType: z.string().min(1),
  providerResourceId: z.string().default(""),  // ← add this
  since: z.string().min(1),
  depth: backfillDepthSchema,
  status: backfillRunStatusSchema,
  pagesProcessed: z.number().int().nonnegative().default(0),
  eventsProduced: z.number().int().nonnegative().default(0),
  eventsDispatched: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
});
```

`backfillRunReadRecord` extends `backfillRunRecord` so it inherits `providerResourceId` automatically.

#### 3. Gateway route — `apps/gateway/src/routes/connections.ts`

**GET `/:id/backfill-runs`** (line 1118): add `providerResourceId` to the select:
```ts
const runs = await db
  .select({
    entityType: gatewayBackfillRuns.entityType,
    providerResourceId: gatewayBackfillRuns.providerResourceId,  // ← add
    since: gatewayBackfillRuns.since,
    // ... rest unchanged
  })
```

**POST `/:id/backfill-runs`** (line 1144): update insert and conflict target:
```ts
await db
  .insert(gatewayBackfillRuns)
  .values({
    installationId,
    entityType: data.entityType,
    providerResourceId: data.providerResourceId,  // ← add
    ...sharedFields,
    startedAt: data.status === "running" ? now : null,
  })
  .onConflictDoUpdate({
    target: [
      gatewayBackfillRuns.installationId,
      gatewayBackfillRuns.providerResourceId,  // ← add
      gatewayBackfillRuns.entityType,
    ],
    set: sharedFields,
  });
```

#### 4. Orchestrator — `apps/backfill/src/workflows/backfill-orchestrator.ts`

**Gap filter** (lines 116-125): change lookup to include `providerResourceId`:
```ts
const filteredWorkUnits = workUnits.filter((wu) => {
  const priorRun = backfillHistory.find(
    (h) =>
      h.entityType === wu.entityType &&
      h.providerResourceId === wu.resource.providerResourceId
  );
  if (!priorRun) return true;
  return new Date(priorRun.since) > new Date(since);
});
```

**Persist run records** (lines 188-216): change from per-entityType aggregation to per-(resource, entityType) — one upsert per completion result:
```ts
await step.run("persist-run-records", async () => {
  for (const r of completionResults) {
    await gw.upsertBackfillRun(installationId, {
      entityType: r.entityType,
      providerResourceId: r.resourceId,
      since,
      depth,
      status: r.success ? "completed" : "failed",
      pagesProcessed: r.pagesProcessed,
      eventsProduced: r.eventsProduced,
      eventsDispatched: r.eventsDispatched,
      error: r.success ? undefined : r.error,
    });
  }
});
```

This removes the `byEntityType` Map aggregation entirely — each work unit already maps 1:1 to a (resource, entityType) result.

### Success Criteria

#### Automated Verification:
- [x] `cd db/console && pnpm db:generate` produces new migration
- [x] `cd db/console && pnpm db:migrate` applies cleanly
- [x] `pnpm --filter apps-backfill test` passes
- [x] `pnpm typecheck` passes

#### Manual Verification:
- [ ] Backfill run triggered for a 2-repo connection creates 2 rows per entityType in `lightfast_gateway_backfill_runs`
- [ ] Adding repo C after prior backfill of repos A+B: re-trigger includes repo C in the work units (gap filter does not skip it)

---

## Phase 3: Small Bug Fixes

### Overview

Three targeted fixes: correct `eventsProduced` stat, skip null-resourceName resources with a warning, and fix PR schema to handle `merged: null` from the list API.

### Changes Required

#### 1. Fix eventsProduced counting — `apps/backfill/src/workflows/entity-worker.ts`

**Line 137**: change from raw count to filtered event count:
```ts
// Before:
eventsProduced += fetchResult.rawCount;

// After:
eventsProduced += fetchResult.events.length;
```

`rawCount` is only needed internally for the pagination sentinel in `processResponse`; it's no longer needed in the entity worker.

#### 2. Skip null resourceName — `apps/backfill/src/workflows/backfill-orchestrator.ts`

**Lines 99-110**: add a guard before building work units:
```ts
const workUnits = connection.resources.flatMap((resource) => {
  if (!resource.resourceName) {
    console.warn("[backfill] skipping resource with null/empty resourceName", {
      installationId,
      providerResourceId: resource.providerResourceId,
    });
    return [];
  }
  return resolvedEntityTypes.map((entityType: string) => ({
    entityType,
    resource: {
      providerResourceId: resource.providerResourceId,
      resourceName: resource.resourceName,
    },
    workUnitId: `${resource.providerResourceId}-${entityType}`,
  }));
});
```

Remove the `?? ""` coercion that was masking the null — if `resourceName` is null we skip, so the handler will always receive a non-empty string.

#### 3. Fix merged schema — `packages/console-providers/src/providers/github/api.ts`

**Line 28**: make `merged` accept null from the list API:
```ts
merged: z.boolean().nullable().optional(),
```

#### 4. Derive merged from merged_at in adapter — `packages/console-providers/src/providers/github/backfill.ts`

Update `adaptGitHubPRForTransformer` to guarantee `merged` is always a boolean on the object passed to the transformer:
```ts
export function adaptGitHubPRForTransformer(
  pr: Record<string, unknown>,
  repo: Record<string, unknown>
): PreTransformGitHubPullRequestEvent {
  const state = pr.state as string;
  const action = state === "open" ? "opened" : "closed";
  // List API may omit `merged` or return null — derive from merged_at instead
  const merged = (pr.merged as boolean | null | undefined) ?? (pr.merged_at != null);
  return {
    action,
    pull_request: { ...pr, merged },
    repository: repo,
    sender: pr.user,
  } as unknown as PreTransformGitHubPullRequestEvent;
}
```

Add test to `backfill.test.ts`:
```ts
it("derives merged=true from merged_at when merged field is absent", () => {
  const pr = {
    state: "closed",
    number: 7,
    user: { login: "alice" },
    merged_at: "2024-01-01T00:00:00Z",
    // merged field intentionally absent — simulates list API omitting it
  };
  const result = adaptGitHubPRForTransformer(pr, repo);
  expect((result.pull_request as Record<string, unknown>).merged).toBe(true);
});

it("derives merged=false when merged_at is null and merged is absent", () => {
  const pr = {
    state: "closed",
    number: 8,
    user: { login: "alice" },
    merged_at: null,
    // merged field intentionally absent
  };
  const result = adaptGitHubPRForTransformer(pr, repo);
  expect((result.pull_request as Record<string, unknown>).merged).toBe(false);
});
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/console-providers test` passes (including new merged tests)
- [x] `pnpm --filter apps-backfill test` passes
- [x] `pnpm check && pnpm typecheck` passes

#### Manual Verification:
- [ ] Backfill run records show `eventsProduced ≤ eventsDispatched` (or equal) for PR backfills
- [ ] A connection with a resource that has `resourceName = null` in DB shows a warning in backfill logs instead of a 404 error

---

## Testing Strategy

### Key edge cases to cover:
- **Gap filter with new resource**: orchestrator test where `backfillHistory` has a completed run for resource A, but work units include resource B (new) — resource B must NOT be filtered out
- **merged absent from list API**: `adaptGitHubPRForTransformer` with no `merged` field but `merged_at` set
- **merged: null from list API**: `githubPullRequestSchema.parse({ ..., merged: null })` must not throw

## References

- Research: `thoughts/shared/research/2026-03-15-github-backfill-bugs-edge-cases.md`
- Orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
- GitHub backfill: `packages/console-providers/src/providers/github/backfill.ts`
- GitHub API schemas: `packages/console-providers/src/providers/github/api.ts`
- Gateway schemas: `packages/console-providers/src/gateway.ts`
- Gateway route: `apps/gateway/src/routes/connections.ts`
- DB schema: `db/console/src/schema/tables/gateway-backfill-runs.ts`
