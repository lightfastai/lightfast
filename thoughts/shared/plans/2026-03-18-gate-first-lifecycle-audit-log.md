---
date: 2026-03-18
topic: "Gate-first lifecycle reorder + gatewayLifecycleLog audit log"
tags: [plan, gateway, lifecycle, teardown, audit-log, trpc, upstash-workflow, drizzle, schema]
status: ready
depends_on: "Phase 0 DB schema (gatewayInstallations health columns + gatewayLifecycleLog table)"
---

# Gate-First Lifecycle Reorder + Lifecycle Audit Log

## Overview

Two tightly coupled changes to the gateway connection lifecycle:

1. **Gate-first reorder** — promote the `gatewayInstallations.status = 'revoked'` write from step 4 to step 1 of `connectionTeardownWorkflow`, closing the ingress gate within a single Upstash step (~100ms) of teardown detection. All subsequent cleanup steps become downstream of an already-closed gate.

2. **tRPC disconnect fix** — replace the direct DB `status = 'revoked'` writes in both `connections.disconnect` and `connections.vercel.disconnect` with calls to the gateway DELETE endpoint so every user-initiated disconnect goes through the durable workflow (and therefore through the gate-first step).

3. **Lifecycle audit log** — insert a `gatewayLifecycleLog` row at every status transition across the teardown workflow and from the gateway DELETE handler. Requires the `gatewayLifecycleLog` table delivered by Phase 0 DB schema.

**Dependency**: Phase 0 DB schema migration must be applied before Phase 3 (audit log writes) can run. Phases 1 and 2 are independent of Phase 0 and can be merged and deployed immediately.

---

## Current State Analysis

### Teardown workflow step order (current)

File: `apps/gateway/src/workflows/connection-teardown.ts`

| Step | Name | What it does | Gate state |
|------|------|-------------|------------|
| 1 | `cancel-backfill` | QStash publish to backfill `/trigger/cancel` | OPEN |
| 2 | `revoke-token` | Fetches token, calls provider OAuth revoke | OPEN |
| 3 | `cleanup-cache` | Redis `DEL` for all active resource keys | OPEN |
| 4 | `soft-delete` | `db.batch([status='revoked', resources='removed'])` | **CLOSES HERE** |

The gate is open for steps 1-3. Any in-flight token request, proxy call, or resource link will succeed during this window because all guards check `status === 'active'` (allowlist semantics).

### tRPC disconnect bypass

`api/console/src/router/org/connections.ts:119-145` — `connections.disconnect`
- Directly writes `status = 'revoked'` to DB via `ctx.db`
- Does NOT call the gateway DELETE endpoint
- Does NOT trigger the durable workflow
- Token revocation, backfill cancellation, and cache cleanup do not run

`api/console/src/router/org/connections.ts:453-473` — `connections.vercel.disconnect`
- Same pattern: direct DB update, no workflow trigger

The gateway DELETE handler comment at `apps/gateway/src/routes/connections.ts:998` says `Callers: console tRPC (org/connections.disconnect)` — this is aspirational documentation, not current reality.

### Gateway client in console

The console tRPC already uses `createGatewayClient` from `@repo/gateway-service-clients` (imported at `api/console/src/router/org/connections.ts:9`). The gateway client's base URL is `${gatewayUrl}/connections` where `gatewayUrl = ${consoleBase}/services/gateway`. The DELETE endpoint is at `${gatewayUrl}/connections/:provider/:id`.

The `createGatewayClient` function does not yet have a `deleteConnection` method. One must be added.

### Status guard semantics

All guards across gateway, backfill, relay, and console tRPC use allowlist semantics: `status === "active"` or `WHERE status = 'active'`. Promoting the `status = 'revoked'` write to step 1 does not break any existing guard — non-`"active"` values are automatically rejected without code changes.

### Relay gap during partial teardown (out of scope)

`apps/relay/src/routes/workflows.ts:80` — `resolve-connection` step only guards on `gatewayResources.status = 'active'`, not `gatewayInstallations.status`. After the gate-first reorder, there is still a window between step 1 (close gate) and step 5 (remove resources) where the relay can route webhooks for a revoked installation. Fixing this is a separate relay change and is explicitly out of scope.

---

## Desired End State

After this plan is complete:

1. The first thing `connectionTeardownWorkflow` does is write `gatewayInstallations.status = 'revoked'` in a dedicated `close-gate` step. All remaining steps run after the gate is closed.
2. `connections.disconnect` calls `gw.deleteConnection(provider, id)` instead of writing directly to DB.
3. `connections.vercel.disconnect` calls `gw.deleteConnection('vercel', id)` instead of writing directly to DB.
4. `createGatewayClient` has a `deleteConnection(provider, installationId)` method.
5. Every status transition in the teardown workflow writes a `gatewayLifecycleLog` row.
6. The gateway DELETE handler writes a `gate_close_initiated` audit log entry (`triggeredBy: 'user'`) before triggering the workflow.
7. Tests verify the `close-gate` step runs before `cancel-backfill`.

---

## What We Are NOT Doing

- Fixing the relay's `resolve-connection` installation status gap (separate change)
- Migrating to Inngest (that is the platform architecture redesign — a separate epic)
- Adding new status values like `disconnecting` or `suspended` — `'revoked'` is used immediately at step 1
- Changing the `gatewayInstallations.status` column to a DB enum
- Touching the health check cron, token refresh cron, or delivery recovery cron
- Adding `failReason` to `gatewayWebhookDeliveries` (Phase 0 DB schema concern)
- Changing the OAuth callback or install flows

---

## Implementation Approach

Three sequential phases, each independently shippable:

- **Phase 1**: Reorder teardown workflow (gate-first). No schema changes. Ships immediately.
- **Phase 2**: Fix tRPC disconnect bypass + add `deleteConnection` to gateway client. No schema changes. Ships immediately after Phase 1.
- **Phase 3**: Add audit log writes to workflow and DELETE handler. Gated on Phase 0 DB schema (`gatewayLifecycleLog` table must exist).

---

## Phase 1: Reorder Teardown Workflow — Gate First

### Overview

Add a new `close-gate` step at position 1 that writes `gatewayInstallations.status = 'revoked'`. Split the old `soft-delete` batch into a separate `remove-resources` step that only updates `gatewayResources.status = 'removed'`. The total step count goes from 4 to 5.

**Note on Upstash Workflow durability**: Upstash Workflow matches completed steps by name, not by index. Adding a new named step at position 1 is safe for new runs. Any workflow run already in-flight at deploy time will re-execute `close-gate` if it hasn't completed it yet — the update is idempotent (setting `status = 'revoked'` on an already-revoked installation is a no-op at the application level, and the DB update affects 0 rows without error).

### Changes Required

#### `apps/gateway/src/workflows/connection-teardown.ts`

New step order (5 steps):

| Step | Name | What it does |
|------|------|-------------|
| 1 | `close-gate` | `db.update(gatewayInstallations).set({ status: 'revoked' })` — gate closed |
| 2 | `cancel-backfill` | (unchanged) |
| 3 | `revoke-token` | (unchanged) |
| 4 | `cleanup-cache` | (unchanged) |
| 5 | `remove-resources` | `db.update(gatewayResources).set({ status: 'removed' })` |

Changes:
1. Add new step 1 `close-gate` before `cancel-backfill`.
2. Remove the `db.batch([...])` from the old `soft-delete` step.
3. Rename old step 4 `soft-delete` to `remove-resources` — it now only updates `gatewayResources`, not `gatewayInstallations`.
4. Update the JSDoc comment at the top of the workflow to describe the new 5-step order.

The `updatedAt` write on `gatewayInstallations` moves from the old `soft-delete` batch into the new `close-gate` step.

### Success Criteria

#### Automated Verification

- [ ] Type check passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] Updated unit tests pass: `pnpm --filter @apps/gateway test`
  - `ctx.run` is called 5 times (was 4)
  - The first `ctx.run` call has name `'close-gate'`
  - The `close-gate` step sets `{ status: 'revoked' }` on `gatewayInstallations`
  - The `remove-resources` step (step 5) sets `{ status: 'removed' }` on `gatewayResources`
  - `mockDbUpdate` is called 2 times total, not via `db.batch`
  - Existing assertions about `cancel-backfill`, `revoke-token`, `cleanup-cache` still pass

#### Manual Verification

- [ ] Trigger a test disconnect via the gateway DELETE endpoint in dev; confirm `gatewayInstallations.status` is `revoked` in DB (`pnpm db:studio`) before the Upstash Workflow dashboard shows `cancel-backfill` completed

---

## Phase 2: Fix tRPC Disconnect Bypass

### Overview

Replace the two direct DB update calls in the console tRPC connections router with calls to the gateway DELETE endpoint via `createGatewayClient`. Add a `deleteConnection` method to the gateway client in `@repo/gateway-service-clients`.

### Changes Required

#### 1. `packages/gateway-service-clients/src/gateway.ts` — add `deleteConnection`

Add a new method to the object returned by `createGatewayClient`:

```ts
async deleteConnection(provider: string, installationId: string): Promise<{ status: string; installationId: string }> {
  const response = await fetch(
    `${gatewayUrl}/connections/${provider}/${installationId}`,
    {
      method: "DELETE",
      headers: h,
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new HttpError(
      `Gateway deleteConnection failed: ${response.status} for ${provider}/${installationId}`,
      response.status
    );
  }
  return response.json();
},
```

The gateway DELETE route is at `DELETE /connections/:provider/:id` within the gateway Hono app. The gateway client base is `${gatewayUrl}` = `${consoleBase}/services/gateway`, so the full URL is `${gatewayUrl}/connections/:provider/:id`.

#### 2. `api/console/src/router/org/connections.ts` — `connections.disconnect`

Replace the direct DB update with a gateway DELETE call:

```ts
disconnect: orgScopedProcedure
  .input(z.object({ integrationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Fetch installation to get provider (required for gateway DELETE path)
    // and enforce org scoping before calling the gateway
    const rows = await ctx.db
      .select({ id: gatewayInstallations.id, provider: gatewayInstallations.provider })
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.id, input.integrationId),
          eq(gatewayInstallations.orgId, ctx.auth.orgId)
        )
      )
      .limit(1);

    const installation = rows[0];
    if (!installation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found or access denied" });
    }

    const gw = createGatewayClient({
      apiKey: env.GATEWAY_API_KEY,
      requestSource: "console-trpc",
      correlationId: crypto.randomUUID(),
    });
    await gw.deleteConnection(installation.provider, installation.id);

    return { success: true };
  }),
```

The `createGatewayClient` import is already present at line 9.

#### 3. `api/console/src/router/org/connections.ts` — `connections.vercel.disconnect`

Replace the direct DB update with a gateway DELETE call:

```ts
disconnect: orgScopedProcedure.mutation(async ({ ctx }) => {
  // Fetch Vercel installation to get id; enforce org scoping
  const rows = await ctx.db
    .select({ id: gatewayInstallations.id })
    .from(gatewayInstallations)
    .where(
      and(
        eq(gatewayInstallations.orgId, ctx.auth.orgId),
        eq(gatewayInstallations.provider, "vercel")
      )
    )
    .limit(1);

  const installation = rows[0];
  if (!installation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Vercel integration not found" });
  }

  const gw = createGatewayClient({
    apiKey: env.GATEWAY_API_KEY,
    requestSource: "console-trpc",
    correlationId: crypto.randomUUID(),
  });
  await gw.deleteConnection("vercel", installation.id);

  return { success: true };
}),
```

### Success Criteria

#### Automated Verification

- [ ] Type check passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] Unit tests for `connections.disconnect` confirm `gw.deleteConnection` is called and `ctx.db.update` is NOT called
- [ ] `deleteConnection` method is present on `GatewayClient` type

#### Manual Verification

- [ ] Disconnect via the console UI; verify in the Upstash Workflow dashboard that the `connection-teardown` workflow run is triggered
- [ ] Verify `gatewayInstallations.status = 'revoked'` in DB after workflow completes (not just from direct write)
- [ ] Verify backfill cancellation QStash message is published (check Upstash QStash dashboard)

---

## Phase 3: Lifecycle Audit Log Writes

### Overview

Insert a `gatewayLifecycleLog` row at every status transition. This phase requires the `gatewayLifecycleLog` table from Phase 0 DB schema.

**Gate dependency**: Do not implement or merge Phase 3 until the Phase 0 DB schema migration has been applied to the target environment.

### Audit log row shape (from Phase 0 schema)

```ts
{
  id: string;                  // nanoid PK
  installationId: string;      // FK to gatewayInstallations.id (no cascade — keep log on soft-delete)
  provider: string;            // e.g. 'github', 'vercel'
  reason: string;              // e.g. 'user_disconnect', 'teardown_complete', 'resources_removed'
  previousStatus: string;      // status before this transition
  newStatus: string;           // status after this transition
  triggeredBy: string;         // 'health_check' | 'user' | 'system'
  resourceIds: unknown | null; // jsonb — array of providerResourceIds affected, if relevant
  metadata: unknown | null;    // jsonb — extra context (workflow step, error, etc.)
  createdAt: string;           // defaultNow()
}
```

### Write locations

#### Location 1: `apps/gateway/src/routes/connections.ts` — DELETE handler (line 1000)

Write a log entry **before** triggering the workflow, capturing the intent:

```ts
await db.insert(gatewayLifecycleLog).values({
  installationId: id,
  provider: providerName,
  reason: 'user_disconnect',
  previousStatus: installation.status,
  newStatus: 'revoked',   // gate will be set to this by workflow step 1
  triggeredBy: 'user',
  resourceIds: null,
  metadata: { source: 'gateway_delete_handler' },
});
```

Import `gatewayLifecycleLog` from `@db/console/schema`.

#### Location 2: `apps/gateway/src/workflows/connection-teardown.ts` — `close-gate` step (step 1)

Write a log entry inside the `close-gate` step after the DB update:

```ts
await db.insert(gatewayLifecycleLog).values({
  installationId,
  provider: providerName,
  reason: 'gate_closed',
  previousStatus: 'active',   // gate is being closed from active
  newStatus: 'revoked',
  triggeredBy: 'system',      // workflow step is system-triggered
  resourceIds: null,
  metadata: { step: 'close-gate', workflowContext: 'connection-teardown' },
});
```

Note on `previousStatus`: the workflow does not currently read the installation's previous status before updating it. Since we are already inside an Upstash Workflow step, we can do a `SELECT ... RETURNING` or accept that `previousStatus` will be hardcoded to `'active'` (the only valid pre-condition for teardown). Use `'active'` as a constant — it is the correct pre-condition and avoids an extra DB round-trip in a durable step.

#### Location 3: `apps/gateway/src/workflows/connection-teardown.ts` — `remove-resources` step (step 5)

Write a log entry inside the `remove-resources` step after the DB update:

```ts
// Fetch resource IDs for audit log (reuse the list built in cleanup-cache if possible)
// Since cleanup-cache already queries active resources, pass resourceIds via the step payload
// or re-query inside remove-resources.

await db.insert(gatewayLifecycleLog).values({
  installationId,
  provider: providerName,
  reason: 'resources_removed',
  previousStatus: 'revoked',   // installation was already revoked by step 1
  newStatus: 'revoked',        // no status change on installation in this step
  triggeredBy: 'system',
  resourceIds: resourceIds,    // array of providerResourceIds from the query
  metadata: { step: 'remove-resources' },
});
```

**Implementation note on `resourceIds`**: The `cleanup-cache` step (step 4) already queries `gatewayResources` for active resources. To avoid a redundant query in `remove-resources`, move the resource query to a shared variable scoped outside the step callbacks, or query it inside `remove-resources` before the update. Since Upstash Workflow step callbacks must be pure (no cross-step shared mutable state), the cleanest approach is to re-query inside `remove-resources`.

### Changes Required

#### `db/console/src/schema/tables/gateway-lifecycle-log.ts` (new file — created by Phase 0)

Phase 0 creates this file. Phase 3 only consumes it.

#### `db/console/src/schema/tables/index.ts` — add export (done by Phase 0)

Phase 0 adds the export. Phase 3 only consumes it.

#### `apps/gateway/src/routes/connections.ts` — import and use `gatewayLifecycleLog`

Add import:
```ts
import { gatewayInstallations, gatewayLifecycleLog, gatewayResources, ... } from "@db/console/schema";
```

Add insert before `workflowClient.trigger(...)` in the DELETE handler.

#### `apps/gateway/src/workflows/connection-teardown.ts` — import and use `gatewayLifecycleLog`

Add import:
```ts
import { gatewayInstallations, gatewayLifecycleLog, gatewayResources, gatewayTokens } from "@db/console/schema";
```

Add inserts in `close-gate` and `remove-resources` steps.

### Success Criteria

#### Automated Verification

- [ ] Type check passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] Unit tests verify `db.insert` is called with correct values in `close-gate` step
- [ ] Unit tests verify `db.insert` is called with correct values in `remove-resources` step
- [ ] Unit tests verify `db.insert` is called in DELETE handler before `workflowClient.trigger`

#### Manual Verification

- [ ] After Phase 0 DB schema migration: `SELECT * FROM lightfast_gateway_lifecycle_log` returns rows after a test disconnect
- [ ] Each row has correct `installationId`, `provider`, `reason`, `triggeredBy` fields
- [ ] `previousStatus` and `newStatus` fields are accurate
- [ ] Rows appear in chronological order matching workflow step execution

---

## Testing Strategy

### Unit Tests — Phase 1 (`apps/gateway/src/workflows/connection-teardown.test.ts`)

The existing test file at `apps/gateway/src/workflows/connection-teardown.test.ts` uses a `makeContext` helper that captures step calls via `ctx.run` spy. Updates needed:

1. Update `"runs all 4 steps for a full teardown"` → expect 5 steps, first name is `'close-gate'`
2. Update `"soft-deletes installation and resources in DB"` → rename to `"close-gate sets installation status to revoked"` and add a separate test `"remove-resources sets resources status to removed"`
3. Add test: `"close-gate runs before cancel-backfill"` — assert step call order via `ctx.run.mock.calls[0][0] === 'close-gate'`
4. Remove assertion that `db.batch` is called — it is no longer used
5. Add assertion that `mockDbUpdate` is called once in `close-gate` step and once in `remove-resources` step (2 total, not batched)

### Unit Tests — Phase 2

Add tests for `connections.disconnect` and `connections.vercel.disconnect`:
- Mock `createGatewayClient` and assert `deleteConnection` is called with correct `provider` and `installationId`
- Assert `ctx.db.update` is NOT called
- Assert `NOT_FOUND` is thrown when the installation lookup returns no rows

### Unit Tests — Phase 3

Extend `connection-teardown.test.ts`:
- Mock `db.insert` (add `mockDbInsert` alongside existing `mockDbUpdate`)
- Assert `mockDbInsert` called in `close-gate` step with `reason: 'gate_closed'`, `triggeredBy: 'system'`
- Assert `mockDbInsert` called in `remove-resources` step with `reason: 'resources_removed'`
- Assert `mockDbInsert` called in DELETE handler test with `reason: 'user_disconnect'`, `triggeredBy: 'user'`

---

## Migration Notes

Phase 3 requires `gatewayLifecycleLog` table. Run from `db/console/`:
```bash
pnpm db:generate   # generates migration from Phase 0 schema changes
pnpm db:migrate    # applies migration
```

Never write custom `.sql` files — always use `pnpm db:generate`.

---

## References

- Research: `thoughts/shared/research/2026-03-18-gate-first-lifecycle-audit-log.md`
- Architecture plan (Inngest future state): `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md`
- Teardown workflow: `apps/gateway/src/workflows/connection-teardown.ts`
- Teardown tests: `apps/gateway/src/workflows/connection-teardown.test.ts`
- Gateway DELETE route: `apps/gateway/src/routes/connections.ts:1000-1033`
- tRPC disconnect: `api/console/src/router/org/connections.ts:119-145`
- tRPC vercel.disconnect: `api/console/src/router/org/connections.ts:453-473`
- Gateway client: `packages/gateway-service-clients/src/gateway.ts`
- Gateway client URLs: `packages/gateway-service-clients/src/urls.ts`
- DB table patterns: `db/console/src/schema/tables/gateway-backfill-runs.ts`, `gateway-webhook-deliveries.ts`
- DB tables index: `db/console/src/schema/tables/index.ts`
- DB relations: `db/console/src/schema/relations.ts`
