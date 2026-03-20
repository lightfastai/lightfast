# Phase 0: DB Schema Migration — Implementation Plan

## Overview

Phase 0 adds the database columns, indexes, and tables required by the platform architecture redesign. Every subsequent phase (health-check cron, gate-first lifecycle, delivery recovery, config drift) depends on these schema changes existing first. No application logic changes are included — this is pure schema + export wiring + consumer fixups.

## Current State Analysis

### `gatewayInstallations` (`db/console/src/schema/tables/gateway-installations.ts`)
- 12 columns, 4 indexes
- `status` is `varchar(50)` with values `active|pending|error|revoked`
- No health or config tracking columns exist

### `workspaceIntegrations` (`db/console/src/schema/tables/workspace-integrations.ts`)
- 13 columns, 4 indexes
- Uses `isActive: boolean` with index `workspace_source_is_active_idx`
- `boolean` import from `drizzle-orm/pg-core` is used only for this column
- **7 consumer files** reference `workspaceIntegrations.isActive`:
  - `api/console/src/router/m2m/sources.ts` — 4 query filters + 2 `.set({ isActive: false })` + 1 `.set({ isActive: true })`
  - `api/console/src/router/org/workspace.ts` — 1 select field + 1 query filter + 1 UI mapping + 1 reactivation check + 1 `.set({ isActive: true })`
  - `packages/console-test-data/src/cli/seed-integrations.ts` — 1 insert with `isActive: true`
  - `packages/console-validation/src/schemas/activities.ts` — `integrationStatusUpdatedMetadataSchema` has `isActive: z.boolean()`

### `gatewayWebhookDeliveries` (`db/console/src/schema/tables/gateway-webhook-deliveries.ts`)
- 7 columns, 2 indexes
- `status` comment says `received|enqueued|delivered|dlq` but new design uses `received|routed|failed`
- No `failReason` column, no recovery index
- No `sql` import from `drizzle-orm` (needed for partial index)

### `gatewayLifecycleLog` — does not exist yet
- New append-only audit table
- Requires new table file + 3 export chain files + relations update

### Key Discoveries:
- `orgApiKeys.isActive` also exists (`db/console/src/schema/tables/org-api-keys.ts`) — completely separate column, NOT affected by this migration
- `packages/integration-tests/src/harness.ts:465` — `isActive` reference is for `orgApiKeys`, not `workspaceIntegrations`
- `packages/console-test-db/src/fixtures.ts` — only has `installation`, `token`, `resource` fixtures. No `workspaceIntegration` fixture exists, so no fixture update needed
- The architecture plan uses column names `previousStatus`/`newStatus`/`triggeredBy`/`createdAt` for the lifecycle log (not the research doc's `fromStatus`/`toStatus`/`event`/`occurredAt`)
- Drizzle config at `db/console/src/drizzle.config.ts` reads `./src/schema/index.ts` — wiring a new table export into that file is sufficient for `db:generate`

## Desired End State

After this plan is complete:

1. `gatewayInstallations` has 4 new columns: `healthStatus`, `lastHealthCheckAt`, `healthCheckFailures`, `configStatus`
2. `workspaceIntegrations.isActive` is replaced by `status` (varchar) + `statusReason` (varchar, nullable)
3. All 7 consumer files compile and use the new `status` column instead of `isActive`
4. `gatewayWebhookDeliveries` has `failReason` column + `gateway_wd_recovery_idx` partial index
5. `gatewayLifecycleLogs` table exists with proper FK, indexes, relations, and exports
6. `pnpm typecheck` passes across the entire monorepo
7. Migration generated via `pnpm db:generate` and applied via `pnpm db:migrate`

### Verification:
- `pnpm typecheck` — zero errors
- `pnpm check` — zero lint errors
- `pnpm db:generate` produces a single migration file
- `pnpm db:migrate` applies cleanly
- The generated migration SQL contains: 4 ADD COLUMN for installations, DROP+ADD for integrations, 1 ADD COLUMN + 1 CREATE INDEX for deliveries, 1 CREATE TABLE for lifecycle log

## What We're NOT Doing

- **No application logic changes** — health check cron, lifecycle functions, delivery recovery, config drift detection are all later phases
- **No status value validation at DB level** — Drizzle varchar columns don't enforce enums; validation lives in application code (Zod schemas in future phases)
- **No Zod validators for new columns yet** — The `integrationStatusUpdatedMetadataSchema` already has `isActive: z.boolean()` which will be updated to match, but new Zod schemas for health status / config status / lifecycle log events are deferred to the phases that consume them
- **No UI changes** — The `isActive` → `status` mapping in the workspace router will maintain backward-compatible shape for the UI
- **No production data migration script** — Dev DB can be wiped. The generated migration handles clean deploys. Production data-fill will be addressed in a deploy runbook if needed.

## Implementation Approach

Single phase, 5 steps executed sequentially. Each step is a discrete file change or set of related file changes. The ordering ensures that schema changes come first, then export wiring, then consumer fixups, and finally migration generation.

---

## Phase 1: Schema Changes + Export Wiring + Consumer Fixups + Migration

### Overview

All schema changes, export wiring, consumer updates, and migration generation in one phase. These changes are tightly coupled — the schema changes break consumers, and the consumer fixups can't be verified until the schema changes exist.

### Changes Required:

#### 1. Add health columns to `gatewayInstallations`

**File**: `db/console/src/schema/tables/gateway-installations.ts`

**Changes**:
- Add `integer` to the `drizzle-orm/pg-core` import
- Add 4 new columns after `backfillConfig`

```ts
// Add `integer` to the import:
import {
  index,
  integer,  // ← add
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// Add after backfillConfig and before createdAt:

    /** Health check status: healthy | degraded | unreachable | unknown */
    healthStatus: varchar("health_status", { length: 50 })
      .notNull()
      .default("unknown"),

    /** When the last health check probe ran */
    lastHealthCheckAt: timestamp("last_health_check_at", {
      mode: "string",
      withTimezone: true,
    }),

    /** Consecutive health check probe failures (reset to 0 on success) */
    healthCheckFailures: integer("health_check_failures").notNull().default(0),

    /** Configuration drift status: current | drift | unknown */
    configStatus: varchar("config_status", { length: 50 })
      .notNull()
      .default("unknown"),
```

No index changes needed — health columns are queried by installation ID, which is already the PK.

---

#### 2. Migrate `workspaceIntegrations.isActive` to `status` + `statusReason`

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

**Changes**:
- Remove `boolean` from `drizzle-orm/pg-core` import
- Replace `isActive` column with `status` + `statusReason`
- Replace `isActiveIdx` with `statusIdx`

```ts
// Remove `boolean` from the import:
import {
  // boolean,  ← remove
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Replace the isActive column definition:
// REMOVE:
//   isActive: boolean("is_active").notNull().default(true),

// ADD (in the same position):
    /** Integration status: active | disconnected | revoked | suspended | removed | deleted | error */
    status: varchar("status", { length: 50 }).notNull().default("active"),

    /** Reason for current status (e.g., "health_check_auth_failure", "user_disconnected") */
    statusReason: varchar("status_reason", { length: 100 }),

// Replace the index:
// REMOVE:
//   isActiveIdx: index("workspace_source_is_active_idx").on(table.isActive),

// ADD:
    statusIdx: index("workspace_source_status_idx").on(table.status),
```

---

#### 3. Add `failReason` + recovery index to `gatewayWebhookDeliveries`

**File**: `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

**Changes**:
- Add `sql` import from `drizzle-orm`
- Add `failReason` column after `status`
- Add `recoveryIdx` partial index
- Update status comment

```ts
// Add sql import:
import { sql } from "drizzle-orm";

// Add after status column:
    /** Reason for failure (set when status = 'failed'): no_connection | inactive_connection | ... */
    failReason: varchar("fail_reason", { length: 100 }),

// Update status comment:
    status: varchar("status", { length: 50 }).notNull(), // received|routed|failed

// Add to index factory:
    recoveryIdx: index("gateway_wd_recovery_idx")
      .on(table.status, table.receivedAt)
      .where(sql`${table.status} = 'received'`),
```

This is the first partial index in the codebase.

---

#### 4. Create `gatewayLifecycleLogs` table

**File**: `db/console/src/schema/tables/gateway-lifecycle-log.ts` (new file)

```ts
import { nanoid } from "@repo/lib";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

/**
 * Gateway Lifecycle Log
 *
 * Append-only audit trail for every gatewayInstallations status transition.
 * Primary debugging tool: "why did this connection go inactive?"
 *
 * Every row records a single status change with who/what triggered it and why.
 * No updatedAt — immutable by design.
 */
export const gatewayLifecycleLogs = pgTable(
  "lightfast_gateway_lifecycle_logs",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gatewayInstallations.id, { onDelete: "cascade" }),

    /** Provider slug for fast filtering without JOIN */
    provider: varchar("provider", { length: 50 }).notNull(),

    /** Human-readable reason for the transition */
    reason: varchar("reason", { length: 100 }).notNull(),

    /** Status before the transition */
    previousStatus: varchar("previous_status", { length: 50 }).notNull(),

    /** Status after the transition */
    newStatus: varchar("new_status", { length: 50 }).notNull(),

    /** What triggered the transition: "health_check" | "user" | "system" */
    triggeredBy: varchar("triggered_by", { length: 50 }).notNull(),

    /** Affected resource IDs (e.g., { workspaceIntegrationId: "wi_xxx" }) */
    resourceIds: jsonb("resource_ids").$type<Record<string, string>>(),

    /** Arbitrary context (e.g., { errorCode: "401", attempt: 3 }) */
    metadata: jsonb("metadata").$type<
      Record<string, string | number | boolean | null>
    >(),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    installationIdx: index("gateway_ll_installation_idx").on(
      table.installationId
    ),
    createdAtIdx: index("gateway_ll_created_at_idx").on(table.createdAt),
  })
);

export type GatewayLifecycleLog = typeof gatewayLifecycleLogs.$inferSelect;
export type InsertGatewayLifecycleLog =
  typeof gatewayLifecycleLogs.$inferInsert;
```

---

#### 5. Wire new table into schema exports (3 files)

**File**: `db/console/src/schema/tables/index.ts`

Add after the `gateway-installations` export block (alphabetically, near other gateway exports):

```ts
export {
  type GatewayLifecycleLog,
  gatewayLifecycleLogs,
  type InsertGatewayLifecycleLog,
} from "./gateway-lifecycle-log";
```

**File**: `db/console/src/schema/index.ts`

Add to the `./tables` re-export block (alphabetically near other Gateway types):

```ts
  type GatewayLifecycleLog,
  gatewayLifecycleLogs,
  type InsertGatewayLifecycleLog,
```

Also add to the relations re-export:

```ts
  gatewayLifecycleLogsRelations,
```

**File**: `db/console/src/index.ts`

Add to the `./schema` re-export block (alphabetically near other Gateway types):

```ts
  type GatewayLifecycleLog,
  gatewayLifecycleLogs,
  gatewayLifecycleLogsRelations,
  type InsertGatewayLifecycleLog,
```

---

#### 6. Update `relations.ts`

**File**: `db/console/src/schema/relations.ts`

**Changes**:
- Import `gatewayLifecycleLogs`
- Add `lifecycleLogs: many(gatewayLifecycleLogs)` to `gatewayInstallationsRelations`
- Add inverse relation `gatewayLifecycleLogsRelations`

```ts
// Add import:
import { gatewayLifecycleLogs } from "./tables/gateway-lifecycle-log";

// Update gatewayInstallationsRelations — add to the many() list:
export const gatewayInstallationsRelations = relations(
  gatewayInstallations,
  ({ many }) => ({
    tokens: many(gatewayTokens),
    resources: many(gatewayResources),
    workspaceIntegrations: many(workspaceIntegrations),
    lifecycleLogs: many(gatewayLifecycleLogs),
  })
);

// Add new relation block (after gatewayResourcesRelations):
export const gatewayLifecycleLogsRelations = relations(
  gatewayLifecycleLogs,
  ({ one }) => ({
    installation: one(gatewayInstallations, {
      fields: [gatewayLifecycleLogs.installationId],
      references: [gatewayInstallations.id],
    }),
  })
);
```

---

#### 7. Fix all `isActive` consumers

These changes convert every `workspaceIntegrations.isActive` reference to the new `status` column.

**File**: `api/console/src/router/m2m/sources.ts`

4 query filters — replace `eq(workspaceIntegrations.isActive, true)` with `eq(workspaceIntegrations.status, "active")`:
- Line 72
- Line 108
- Line 137
- Line 211

2 deactivation writes — replace `{ isActive: false, ... }` with `{ status: "disconnected", ... }`:
- Line 150: `isActive: false` → `status: "disconnected"`
- Line 302 (markGithubDeleted): `isActive: false` → `status: "deleted"`

Also in `markGithubInstallationInactive` (line ~229):
- `isActive: false` → `status: "suspended"` (installation-level deactivation)

**File**: `api/console/src/router/org/workspace.ts`

- Line 350: `isActive: workspaceIntegrations.isActive` → `status: workspaceIntegrations.status`
- Line 367: `eq(workspaceIntegrations.isActive, true)` → `eq(workspaceIntegrations.status, "active")`
- Line 390: `isActive: s.isActive` → `isActive: s.status === "active"` (UI backward compat mapping)
- Line 553: `if (!existing.isActive)` → `if (existing.status !== "active")`
- Line 556: `{ isActive: true, updatedAt: ... }` → `{ status: "active", statusReason: null, updatedAt: ... }`
- Line 805: `existingIntegration.isActive` → `existingIntegration.status === "active"`  (in select, this field name changes)
- Line 833: `.set({ isActive: true, updatedAt: now })` → `.set({ status: "active", statusReason: null, updatedAt: now })`

Note: The select on line 350 changes the field name from `isActive` to `status`, so the downstream check on line 805 also changes from `existingIntegration.isActive` to `existingIntegration.status === "active"`.

**File**: `packages/console-test-data/src/cli/seed-integrations.ts`

- Line 180: `isActive: true` → `status: "active" as const`

**File**: `packages/console-validation/src/schemas/activities.ts`

The `integrationStatusUpdatedMetadataSchema` (line 151-158) currently has `isActive: z.boolean()`. Update to:

```ts
export const integrationStatusUpdatedMetadataSchema = z
  .object({
    provider: z.string(),
    status: z.string(),
    statusReason: z.string().optional(),
    githubRepoId: z.string(),
  })
  .passthrough();
```

Also update the corresponding type export name — `IntegrationStatusUpdatedMetadata` will reflect the new shape automatically via inference.

---

#### 8. Generate and review migration

Run from `db/console/`:

```bash
cd db/console && pnpm db:generate
```

**Expected generated SQL** (review before applying):

1. `ALTER TABLE "lightfast_gateway_installations"` — 4 ADD COLUMN statements
2. `DROP INDEX "workspace_source_is_active_idx"` + `ALTER TABLE "lightfast_workspace_integrations" DROP COLUMN "is_active"` + 2 ADD COLUMN + `CREATE INDEX "workspace_source_status_idx"`
3. `ALTER TABLE "lightfast_gateway_webhook_deliveries" ADD COLUMN "fail_reason"` + `CREATE INDEX "gateway_wd_recovery_idx" ... WHERE ...`
4. `CREATE TABLE "lightfast_gateway_lifecycle_logs"` with all columns and indexes

**Data migration concern**: The generated migration will DROP `is_active` before `status` exists. For dev, this is fine (wipe DB). For production, prepend this to the generated SQL before the DROP:

```sql
-- Data migration: preserve is_active values before column swap
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "status" varchar(50);
UPDATE "lightfast_workspace_integrations" SET "status" = CASE WHEN "is_active" = true THEN 'active' ELSE 'disconnected' END;
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "status" SET DEFAULT 'active';
```

Then remove the duplicate `ADD COLUMN "status"` from Drizzle's generated output.

#### 9. Apply migration

```bash
cd db/console && pnpm db:migrate
```

---

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Migration generates cleanly: `cd db/console && pnpm db:generate`
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [ ] Generated migration SQL contains exactly: 4 ADD COLUMN on installations, DROP INDEX + DROP COLUMN + 2 ADD COLUMN + CREATE INDEX on integrations, 1 ADD COLUMN + 1 CREATE INDEX (partial) on deliveries, 1 CREATE TABLE on lifecycle logs
- [ ] No references to `workspaceIntegrations.isActive` remain: `grep -r "isActive" --include="*.ts" api/ packages/console-test-data/ packages/console-validation/src/schemas/activities.ts db/console/src/schema/tables/workspace-integrations.ts` returns zero matches on workspace-related files (note: `orgApiKeys.isActive` references are expected and should NOT be changed)

#### Manual Verification:
- [ ] Review the generated migration SQL file in `db/console/src/migrations/` — confirm it matches expected SQL patterns from Section 4 of the research doc
- [ ] Confirm the partial index `gateway_wd_recovery_idx` has the `WHERE` clause in the generated SQL
- [ ] Run `pnpm db:studio` and verify all 4 tables show the correct columns
- [ ] Verify `gatewayLifecycleLogs` appears in the Drizzle Studio table list with correct FK to `gatewayInstallations`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase (Phase 1 of the platform architecture redesign: health-check cron).

---

## Testing Strategy

### Automated Tests:
- **Type safety**: `pnpm typecheck` validates all consumer files compile with the new column names. This is the primary guard — every `.isActive` → `.status` change is caught by the compiler.
- **Lint**: `pnpm check` validates no unused imports (`boolean` removed from workspace-integrations).
- **Migration integrity**: `pnpm db:generate` + `pnpm db:migrate` validates Drizzle can introspect the schema and produce valid SQL.

### Manual Verification Steps:
1. Open the generated migration SQL and confirm it contains all expected statements
2. Run `pnpm db:studio` to visually inspect the schema
3. Insert a test row into `gatewayLifecycleLogs` via Drizzle Studio and verify FK constraint works
4. Query `workspaceIntegrations` and confirm `status` column exists with default `'active'`

### Edge Cases:
- `orgApiKeys.isActive` must NOT be affected — verify with grep that `org-api-keys.ts` is untouched
- The `integrationStatusUpdatedMetadataSchema` Zod change is backward-incompatible for existing activity records that stored `isActive: boolean`. This is acceptable because activity records are read-only audit data and the `.passthrough()` on the schema means old records won't fail validation.

## Performance Considerations

- **New columns are all nullable or have defaults** — no table rewrite needed, Postgres handles these as metadata-only changes
- **Partial index `gateway_wd_recovery_idx`** — only indexes rows where `status = 'received'`, keeping the index small for the recovery cron's query pattern
- **`statusIdx` replaces `isActiveIdx`** — varchar index on low-cardinality column is comparable to boolean index performance for `WHERE status = 'active'` queries

## Migration Notes

- **Dev environment**: Wipe DB and re-seed. The generated Drizzle migration handles clean deploys.
- **Production**: If `workspaceIntegrations` has live rows, prepend the data-fill SQL (see Step 8) to the generated migration before applying. This is the ONLY manual SQL edit needed.
- **Rollback**: Drizzle does not generate down migrations. To rollback, restore from DB snapshot or manually reverse the column additions. The lifecycle log table can be dropped without data loss impact.

## Dependency Graph

```
Phase 0 (this plan)
  ├── Phase 1: Health-Check Cron (reads healthStatus, healthCheckFailures, configStatus, writes lifecycle log)
  ├── Phase 2: Gate-First Lifecycle (reads/writes gatewayInstallations.status, workspaceIntegrations.status, writes lifecycle log)
  ├── Phase 3: Delivery Recovery (reads failReason, queries recovery index)
  └── Phase 4: Config Drift Detection (reads/writes configStatus)
```

All downstream phases import from `@db/app/schema` — once Phase 0 lands, the types are available to all consumers.

## References

- Research doc: `thoughts/shared/research/2026-03-18-phase0-db-schema-migration.md`
- Architecture plan: `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md` (DB Schema Rework section)
- Schema tables: `db/console/src/schema/tables/`
- Export chain: `tables/index.ts` → `schema/index.ts` → `src/index.ts`
- Relations: `db/console/src/schema/relations.ts`
