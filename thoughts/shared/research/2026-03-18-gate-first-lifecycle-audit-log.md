---
date: 2026-03-18T00:00:00+00:00
researcher: claude
git_commit: 6a51a4821a7252e51f44d650534e620e469e5faf
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "Gate-first lifecycle reorder and gatewayLifecycleLog audit table"
tags: [research, codebase, gateway, teardown, lifecycle, audit-log, schema, drizzle]
status: complete
last_updated: 2026-03-18
---

# Research: Gate-first lifecycle reorder and gatewayLifecycleLog audit table

**Date**: 2026-03-18
**Git Commit**: 6a51a4821a7252e51f44d650534e620e469e5faf
**Branch**: refactor/define-ts-provider-redesign

## Research Question

Research everything needed to implement:
1. **Gate-first lifecycle reorder** — reorder `connectionTeardownWorkflow` so it closes the ingress gate FIRST (step 1: set `gatewayInstallations.status = 'revoked'`) before cancel-backfill, revoke-token, cleanup-cache, soft-delete-resources.
2. **`gatewayLifecycleLog` table** — new append-only audit trail table; write entries from both the teardown workflow and the console tRPC disconnect handler.

---

## Summary

The gateway teardown workflow currently runs in order: cancel-backfill → revoke-token → cleanup-cache → soft-delete (which sets `status = 'revoked'`). The gate is only closed at step 4. All status read guards across the system check `status !== "active"` or `status === "active"`, so promoting the `status = 'revoked'` write to step 1 would immediately block all read guards from issuing new tokens or accepting new proxy calls.

The `gatewayInstallations.status` column is a plain `varchar(50)` with no DB-level enum — current comment in the schema lists `active|pending|error|revoked`. Adding new values like `disconnected`, `suspended` does not require a migration as long as application code is updated to handle them. Existing guards all test for `=== "active"` (allowlist), not deny-list, so new values are automatically rejected without code changes in guards.

The console tRPC `disconnect` mutation at `api/console/src/router/org/connections.ts:119-145` currently sets `status = 'revoked'` directly in the DB without calling the gateway DELETE endpoint — it does not trigger the durable teardown workflow at all. The gateway DELETE endpoint (`DELETE /connections/:provider/:id`) is what triggers the Upstash Workflow.

Two separate schema table patterns exist for the new `gatewayLifecycleLog` table. The closest match is `gatewayWebhookDeliveries` (append-only, no updatedAt, uses `receivedAt` instead of `createdAt/updatedAt`). `gatewayBackfillRuns` uses a `references()` FK to `gatewayInstallations` with `onDelete: "cascade"`.

---

## Detailed Findings

### 1. `connectionTeardownWorkflow` — current step order

**File**: `apps/gateway/src/workflows/connection-teardown.ts`

The workflow has 4 steps in this order:

| Step name | What it does |
|---|---|
| `cancel-backfill` (step 1) | Publishes to QStash `${backfillUrl}/trigger/cancel` — best-effort, swallows errors |
| `revoke-token` (step 2) | Fetches token from `gatewayTokens`, calls `auth.revokeToken()` at provider — best-effort |
| `cleanup-cache` (step 3) | Deletes Redis keys for all active `gatewayResources` linked to the installation |
| `soft-delete` (step 4) | `db.batch([update gatewayInstallations set status='revoked', update gatewayResources set status='removed'])` |

The gate (status write) is in step 4. The payload type is `{ installationId, orgId, provider }`. The `orgId` field is in the payload but is not currently used by any step.

### 2. DELETE connection route — how teardown is triggered

**File**: `apps/gateway/src/routes/connections.ts:1000-1033`

```
DELETE /connections/:provider/:id
```

- Auth: `apiKeyAuth` (X-API-Key, internal only)
- Fetches installation from DB (WHERE `id = :id AND provider = :provider`)
- Calls `workflowClient.trigger({ url: '${gatewayBaseUrl}/gateway/workflows/connection-teardown', body: { installationId, provider, orgId } })`
- Returns `{ status: 'teardown_initiated', installationId }` immediately

The trigger is a fire-and-forget Upstash Workflow call. No status change is made in the DELETE handler itself before firing the workflow.

### 3. Console tRPC disconnect handler — current behavior

**File**: `api/console/src/router/org/connections.ts:119-145` (procedure `connections.disconnect`)

The `disconnect` mutation does NOT call the gateway DELETE endpoint. Instead it:
1. Runs `db.update(gatewayInstallations).set({ status: 'revoked' }).where(id = input.integrationId AND orgId = ctx.auth.orgId)`
2. Returns `{ success: true }`

There is no workflow trigger from the tRPC layer. This means token revocation, backfill cancellation, and cache cleanup are **not performed** when disconnect is called via tRPC — only the DB status is set.

**File**: `api/console/src/router/org/connections.ts:453-473` — `connections.vercel.disconnect` does the same pattern: direct DB update to `status = 'revoked'`, no gateway DELETE call.

### 4. `gatewayInstallations.status` — current enum values

**File**: `db/console/src/schema/tables/gateway-installations.ts:31`

```ts
status: varchar("status", { length: 50 }).notNull(), // active|pending|error|revoked
```

The column is a plain `varchar(50)` with a comment enumerating values. There is no `pgEnum` or DB-level constraint. The four documented values are:
- `active` — normal connected state
- `pending` — (mentioned in comment, but not observed being written in current code)
- `error` — written by `connections.generic.listResources` on 401 from provider (`api/console/src/router/org/connections.ts:584`)
- `revoked` — written by teardown workflow step 4 and tRPC disconnect

Adding new values (`disconnected`, `suspended`) requires no DB migration — only application code changes.

### 5. All places that read `gatewayInstallations.status` — guards across the system

#### Gateway service (`apps/gateway/src/routes/connections.ts`)

| Line | Guard | Context |
|---|---|---|
| 696 | `installation.status !== "active"` → 400 | `GET /:id/token` — token vault endpoint |
| 823 | `installation.status !== "active"` → 400 | `POST /:id/proxy/execute` — proxy endpoint |
| 1058 | `installation.status !== "active"` → 400 | `POST /:id/resources` — link resource |

All three return `{ error: 'installation_not_active', status: installation.status }`.

#### Backfill orchestrator (`apps/backfill/src/workflows/backfill-orchestrator.ts:69`)

```ts
if (conn.status !== "active") {
  throw new NonRetriableError(`Connection is not active: ...`);
}
```

The orchestrator calls `gw.getConnection(installationId)` in step 1 (`get-connection`), which hits gateway `GET /connections/:id`. The gateway returns `status` in the response body. The orchestrator throws a `NonRetriableError` if not active.

#### Console tRPC (`api/console/src/router/org/connections.ts`)

| Line | Guard | Context |
|---|---|---|
| 91 | `.where(eq(gatewayInstallations.status, "active"))` | `connections.list` — only returns active |
| 202 | `.where(eq(gatewayInstallations.status, "active"))` | `connections.github.validate` — lookup |
| 497 | `.where(eq(gatewayInstallations.status, "active"))` | `connections.generic.listInstallations` |
| 560 | `.where(eq(gatewayInstallations.status, "active"))` | `connections.generic.listResources` |

#### Console tRPC workspace router (`api/console/src/router/org/workspace.ts:224`)

```ts
eq(gatewayInstallations.status, "active")
```

Used when notifying backfill after workspace creation — only triggers backfill for active installations.

#### Relay webhook delivery workflow (`apps/relay/src/routes/workflows.ts:80`)

```ts
eq(gatewayResources.status, "active")
```

This guards on `gatewayResources.status`, not `gatewayInstallations.status`. The webhook delivery step 2 (`resolve-connection`) joins `gatewayResources` ⟶ `gatewayInstallations` but only filters on resource status (active). It does **not** check `gatewayInstallations.status` at resolution time. A webhook arriving for a revoked installation would still resolve the connection if the resource hasn't been marked removed yet.

### 6. `db/console/src/schema/` — table definition patterns

**Directory**: `db/console/src/schema/tables/`

All tables follow this file structure:
1. Import `nanoid` from `@repo/lib` for PK default
2. Import column types from `drizzle-orm/pg-core`
3. Import referenced table objects if using `.references()`
4. Export `const tableName = pgTable("lightfast_table_name", { ... }, (table) => ({ indexes }))`
5. Export `type TableName = typeof table.$inferSelect`
6. Export `type InsertTableName = typeof table.$inferInsert`

**Append-only table pattern** (closest to `gatewayLifecycleLog`):

`gateway-webhook-deliveries.ts` — no `updatedAt`, uses `receivedAt` as its timestamp, has `status` but is insert-heavy. Index on `status`.

**Table with FK to gatewayInstallations**:

`gateway-backfill-runs.ts:22-23` — uses `.references(() => gatewayInstallations.id, { onDelete: "cascade" })`.

**Timestamp pattern** used in gateway tables:
```ts
// Mutable tables (installations, resources, tokens):
createdAt: timestamp(...).notNull().defaultNow(),
updatedAt: timestamp(...).notNull().defaultNow().$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),

// Append-only tables (webhook-deliveries):
receivedAt: timestamp(...).notNull(),  // caller sets this, no default
```

**PK pattern**: `varchar("id", { length: 191 }).notNull().primaryKey().$defaultFn(() => nanoid())`

**Index naming convention**: `lightfast_gateway_<abbrev>_<description>_idx` — e.g., `gateway_wd_provider_delivery_idx`, `gateway_br_installation_idx`.

### 7. `db/console` package — how new tables get exported

The chain is:
1. New file: `db/console/src/schema/tables/gateway-lifecycle-log.ts`
2. Add export to: `db/console/src/schema/tables/index.ts`
3. Add export to: `db/console/src/schema/index.ts` (re-exports from `./tables`)
4. Add export to: `db/console/src/index.ts` (re-exports from `./schema`)

The `db/console` package has two export paths used by consumers:
- `@db/app` — main entry, exports `db` (client) + all schemas + relations
- `@db/app/schema` — schema-only entry

Relations are defined separately in `db/console/src/schema/relations.ts`. If `gatewayLifecycleLog` has a FK to `gatewayInstallations`, a new relation entry (`gatewayLifecycleLogRelations`) would be added to `relations.ts` and exported from `schema/index.ts`.

After adding the schema, run `pnpm db:generate` from `db/console/` to generate the migration.

### 8. Relay webhook resolution — installation status not checked

**File**: `apps/relay/src/routes/workflows.ts` — the `resolve-connection` step (lines 60-92) only filters on:
```ts
eq(gatewayResources.status, "active")
```

It does NOT filter on `gatewayInstallations.status`. This means if step 1 of the reordered teardown sets `gatewayInstallations.status = 'revoked'` but the `gatewayResources.status` is still `'active'` (cleanup-cache is step 3, soft-delete of resources is step 4), the relay can still resolve a connection and route webhooks to a revoked installation during the window between step 1 and step 4.

---

## Code References

- `apps/gateway/src/workflows/connection-teardown.ts:39-150` — Full teardown workflow (4 steps)
- `apps/gateway/src/workflows/connection-teardown.ts:127-138` — Step 4: the current gate-close (soft-delete batch)
- `apps/gateway/src/routes/connections.ts:1000-1033` — DELETE route that triggers the workflow
- `api/console/src/router/org/connections.ts:119-145` — tRPC `disconnect` mutation (no workflow trigger)
- `api/console/src/router/org/connections.ts:453-473` — tRPC `vercel.disconnect` (same pattern)
- `db/console/src/schema/tables/gateway-installations.ts:31` — `status` column definition (varchar, no enum)
- `db/console/src/schema/tables/gateway-backfill-runs.ts:22-23` — FK to installations with cascade
- `db/console/src/schema/tables/gateway-webhook-deliveries.ts` — append-only table pattern
- `db/console/src/schema/tables/index.ts` — barrel for table exports
- `db/console/src/schema/index.ts` — barrel re-exporting tables + relations
- `db/console/src/index.ts` — package entry point
- `db/console/src/schema/relations.ts` — all Drizzle relation definitions
- `apps/backfill/src/workflows/backfill-orchestrator.ts:67-81` — `conn.status !== "active"` guard
- `apps/relay/src/routes/workflows.ts:60-92` — resolve-connection step (only checks resource status)
- `api/console/src/router/org/workspace.ts:215-226` — status guard in workspace creation
- `apps/gateway/src/routes/connections.ts:696-701` — token vault status guard
- `apps/gateway/src/routes/connections.ts:823-834` — proxy execute status guard
- `apps/gateway/src/routes/connections.ts:1058-1063` — link resource status guard

---

## Architecture Documentation

### Teardown trigger path

```
User clicks "Disconnect" in UI
  → tRPC connections.disconnect (api/console)
      → direct DB update: status = 'revoked'
      [no workflow triggered from here]

Internal: DELETE /connections/:provider/:id (gateway)
  → workflowClient.trigger(connection-teardown)
      → Step 1: cancel-backfill (QStash → backfill /trigger/cancel)
      → Step 2: revoke-token (provider OAuth revoke)
      → Step 3: cleanup-cache (Redis del resource keys)
      → Step 4: soft-delete (DB batch: status='revoked', resources='removed')
```

**Gap**: The tRPC disconnect path and the gateway DELETE path are currently independent. The tRPC path sets `status = 'revoked'` but does not run the 4 workflow steps. The gateway DELETE triggers the workflow but the initial DELETE handler does not set the status before firing.

### Status read-guard pattern

All guards use allowlist semantics: `status === "active"` (or `WHERE status = 'active'`). Any value that is not `"active"` is rejected. This means:
- Adding a new status value (`disconnected`, `revoked`, `error`, `suspended`) to the column does not require changing any existing guard — they all naturally reject non-active values.
- Expanding the documented enum comment is the only change needed in the schema file.

### Relay gap during partial teardown

The relay's `resolve-connection` step joins `gatewayResources` ⟶ `gatewayInstallations` but only conditions on `gatewayResources.status = 'active'`. Even after `gatewayInstallations.status` is set to `'revoked'` at teardown step 1, incoming webhooks will still route to the connection until step 4 marks the resources as `'removed'`. The relay does not check `gatewayInstallations.status`.

---

## Schema Blueprint for `gatewayLifecycleLog`

Based on the observed patterns in this codebase, the new table would follow this structure:

**Table name**: `lightfast_gateway_lifecycle_log`
**File location**: `db/console/src/schema/tables/gateway-lifecycle-log.ts`

Columns needed to cover the audit use cases:
- `id` — varchar(191) PK, nanoid default
- `installationId` — varchar(191), FK to `gatewayInstallations.id` (no cascade — keep log even after soft-delete)
- `orgId` — varchar(191) (denormalized for query efficiency without join)
- `provider` — varchar(50)
- `event` — varchar(50) — the lifecycle event name (e.g., `gate_closed`, `token_revoked`, `backfill_cancelled`, `cache_cleared`, `resources_removed`, `disconnect_requested`)
- `actor` — varchar(191) — who triggered it: `workflow:connection-teardown`, `trpc:connections.disconnect`, `trpc:connections.vercel.disconnect`
- `metadata` — jsonb optional — extra context (workflow step names, error messages)
- `occurredAt` — timestamp with timezone, not-null (caller sets this)

Index suggestions (matching codebase naming convention `gateway_ll_*`):
- `gateway_ll_installation_idx` on `installationId`
- `gateway_ll_org_provider_idx` on `(orgId, provider)`
- `gateway_ll_event_idx` on `event`

Export chain:
1. `db/console/src/schema/tables/gateway-lifecycle-log.ts` (new file)
2. Add to `db/console/src/schema/tables/index.ts`
3. Add to `db/console/src/schema/index.ts`
4. Add to `db/console/src/index.ts`
5. Optionally add relation in `db/console/src/schema/relations.ts`

---

## Open Questions

1. **Should `gatewayLifecycleLog.installationId` use `onDelete: 'cascade'` or `onDelete: 'set null'`?** `gatewayBackfillRuns` uses cascade. For an audit log, `set null` or no FK constraint at all would preserve log entries after an installation is hard-deleted. Currently the system uses soft-delete (status=revoked), so this may not matter in practice.

2. **Should the relay's `resolve-connection` step be updated to also filter on `gatewayInstallations.status = 'active'`?** With a gate-first reorder, there is a window where `gatewayInstallations.status = 'revoked'` but `gatewayResources.status` is still `'active'`. Adding the installation status check to the relay would close this window.

3. **Should the tRPC `disconnect` mutation call the gateway DELETE endpoint instead of (or in addition to) the direct DB update?** Currently it bypasses the workflow entirely, meaning token revocation, backfill cancellation, and cache cleanup do not run on tRPC-initiated disconnects.

4. **What value should `gatewayInstallations.status` be set to in the new step 1 — `'revoked'` or a new value like `'disconnecting'`?** Using `'revoked'` immediately closes all guards; a transitional `'disconnecting'` value would require updating all guard expressions.
