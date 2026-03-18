# Phase 0 DB Schema Migration — Research Findings

**Date:** 2026-03-18
**Scope:** All findings needed to execute the 4-table schema migration without guessing.

---

## 1. Current Schema State

### `gatewayInstallations` — `db/console/src/schema/tables/gateway-installations.ts`

**Current columns:**
- `id` varchar(191) PK, `$defaultFn(() => nanoid())`
- `provider` varchar(50) `$type<SourceType>()`
- `externalId` varchar(191)
- `connectedBy` varchar(191) `$type<ClerkUserId>()`
- `orgId` varchar(191)
- `status` varchar(50) — active|pending|error|revoked
- `webhookSecret` text (nullable)
- `metadata` jsonb (nullable)
- `providerAccountInfo` jsonb `$type<ProviderAccountInfo>()` (nullable)
- `backfillConfig` jsonb `$type<GwInstallationBackfillConfig>()` (nullable)
- `createdAt` timestamp withTimezone `.notNull().defaultNow()`
- `updatedAt` timestamp withTimezone `.notNull().defaultNow().$onUpdateFn(() => sql\`CURRENT_TIMESTAMP\`)`

**Current indexes:**
- `providerExternalIdx` — `uniqueIndex("gateway_inst_provider_external_idx").on(table.provider, table.externalId)`
- `orgIdIdx` — `index("gateway_inst_org_id_idx").on(table.orgId)`
- `orgProviderIdx` — `index("gateway_inst_org_provider_idx").on(table.orgId, table.provider)`
- `connectedByIdx` — `index("gateway_inst_connected_by_idx").on(table.connectedBy)`

**Imports used:** `nanoid` from `@repo/lib`, `sql` from `drizzle-orm`, `index, jsonb, pgTable, text, timestamp, uniqueIndex, varchar` from `drizzle-orm/pg-core`

**4 columns to add:**
```ts
healthStatus: varchar("health_status", { length: 50 }).notNull().default("unknown"),
lastHealthCheckAt: timestamp("last_health_check_at", { mode: "string", withTimezone: true }),
healthCheckFailures: integer("health_check_failures").notNull().default(0),
configStatus: varchar("config_status", { length: 50 }).notNull().default("unknown"),
```
Need to add `integer` to the pg-core import.

---

### `workspaceIntegrations` — `db/console/src/schema/tables/workspace-integrations.ts`

**Current columns:**
- `id` varchar(191) PK, `$defaultFn(() => nanoid())`
- `workspaceId` varchar(191) FK → `orgWorkspaces.id` cascade
- `installationId` varchar(191) FK → `gatewayInstallations.id` cascade
- `provider` varchar(50) `$type<SourceType>()`
- `providerConfig` jsonb `$type<ProviderConfig>()` notNull
- `providerResourceId` varchar(191) `$type<SourceIdentifier>()`
- **`isActive` boolean notNull default(true)** ← column being migrated
- `lastSyncedAt` timestamp withTimezone (nullable)
- `lastSyncStatus` varchar(50) `$type<SyncStatus>()` (nullable)
- `lastSyncError` text (nullable)
- `documentCount` integer notNull default(0)
- `connectedAt` timestamp withTimezone notNull defaultNow()
- `createdAt` timestamp withTimezone notNull defaultNow()
- `updatedAt` timestamp withTimezone notNull `.default(sql\`CURRENT_TIMESTAMP\`)`

**Current indexes:**
- `workspaceIdIdx` — `index("workspace_source_workspace_id_idx").on(table.workspaceId)`
- `installationIdIdx` — `index("workspace_source_installation_id_idx").on(table.installationId)`
- `isActiveIdx` — `index("workspace_source_is_active_idx").on(table.isActive)` ← must be dropped/renamed
- `providerResourceIdIdx` — `index("workspace_source_provider_resource_id_idx").on(table.providerResourceId)`

**Imports used:** `nanoid` from `@repo/lib`, `sql` from `drizzle-orm`, `boolean, index, integer, jsonb, pgTable, text, timestamp, varchar` from `drizzle-orm/pg-core`

**Migration strategy:**
- Remove `isActive: boolean` column definition
- Remove `boolean` from pg-core imports (no longer needed)
- Add `status: varchar("status", { length: 50 }).notNull().default("active")`
- Add `statusReason: varchar("status_reason", { length: 100 })` (nullable — no `.notNull()`, no `.default()`)
- Rename index `isActiveIdx` → `statusIdx` using `index("workspace_source_status_idx").on(table.status)`

**CRITICAL — boolean-to-varchar migration:** Drizzle will generate a migration that does `DROP COLUMN "is_active"` + `ADD COLUMN "status"`. Data migration must be handled — either in a prior `pnpm db:push` with a custom SQL step, or accept data loss in dev (dev DB can be wiped). For production the generated SQL will need a manual data-fill step inserted: `UPDATE lightfast_workspace_integrations SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END;` run before the drop column. The CLAUDE.md for db explicitly says NEVER write manual SQL files — the migration file generated will be the output of `pnpm db:generate`, and the data-fill can be prepended to that generated file if needed.

---

### `gatewayWebhookDeliveries` — `db/console/src/schema/tables/gateway-webhook-deliveries.ts`

**Current columns:**
- `id` varchar(191) PK, `$defaultFn(() => nanoid())`
- `provider` varchar(50) notNull
- `deliveryId` varchar(191) notNull
- `eventType` varchar(191) notNull
- `installationId` varchar(191) (nullable)
- `status` varchar(50) notNull — received|enqueued|delivered|dlq
- `payload` text (nullable)
- `receivedAt` timestamp withTimezone notNull

**Current indexes:**
- `providerDeliveryIdx` — `uniqueIndex("gateway_wd_provider_delivery_idx").on(table.provider, table.deliveryId)`
- `statusIdx` — `index("gateway_wd_status_idx").on(table.status)`

**Imports used:** `nanoid` from `@repo/lib`, `index, pgTable, text, timestamp, uniqueIndex, varchar` from `drizzle-orm/pg-core`

**2 changes needed:**
1. Add `failReason: varchar("fail_reason", { length: 100 })` (nullable)
2. Add a partial/filtered index for DLQ recovery

**Partial index syntax (Drizzle 0.45.1 confirmed):**
```ts
import { sql } from "drizzle-orm";
import { index } from "drizzle-orm/pg-core";

// In the table's index factory:
recoveryIdx: index("gateway_wd_recovery_idx")
  .on(table.status, table.receivedAt)
  .where(sql`${table.status} = 'received'`),
```

Need to add `sql` import from `drizzle-orm` (currently no drizzle-orm import in this file).

The generated SQL will look like:
```sql
CREATE INDEX "gateway_wd_recovery_idx" ON "lightfast_gateway_webhook_deliveries"
  USING btree ("status","received_at")
  WHERE (status = 'received');
```

---

## 2. Schema Export / Assembly — How New Tables Get Wired In

### The chain (4 files to update for a new table):

1. **`db/console/src/schema/tables/gateway-lifecycle-log.ts`** — new table file (create)
2. **`db/console/src/schema/tables/index.ts`** — add export for the new table + types
3. **`db/console/src/schema/index.ts`** — re-export the new table + types from `./tables`
4. **`db/console/src/index.ts`** — re-export the new table + types from `./schema`

### Pattern from `tables/index.ts`:
```ts
export {
  type GatewayLifecycleLog,
  gatewayLifecycleLogs,
  type InsertGatewayLifecycleLog,
} from "./gateway-lifecycle-log";
```

### Pattern from `schema/index.ts`:
```ts
// In the table export block:
type GatewayLifecycleLog,
gatewayLifecycleLogs,
type InsertGatewayLifecycleLog,
```

### Pattern from `src/index.ts`:
```ts
// In the export block (alphabetically near other gateway types):
type GatewayLifecycleLog,
gatewayLifecycleLogs,
type InsertGatewayLifecycleLog,
```

---

## 3. Drizzle Config — `db:generate` Flow

**Config file:** `db/console/src/drizzle.config.ts`

```ts
export default defineConfig({
  schema: "./src/schema/index.ts",  // ← single entry point
  out: "./src/migrations",
  dialect: "postgresql",
  ...
});
```

**Key findings:**
- Drizzle reads ONE entry file (`./src/schema/index.ts`) and follows all re-exports to discover tables
- Adding a new table to `schema/tables/index.ts` → `schema/index.ts` is sufficient for `db:generate` to pick it up
- No config file changes needed
- Command: `cd db/console && pnpm db:generate` (uses `dotenv -e ../../apps/console/.vercel/.env.development.local` via `with-env`)
- Migration files land in `db/console/src/migrations/` with sequential numbering (currently at 0058)
- Meta journal is at `db/console/src/migrations/meta/_journal.json`

**Naming convention:** Migrations are named by drizzle-kit: `{NNNN}_{adjective}_{marvel-character}.sql` — auto-assigned, not manually named.

---

## 4. Migration File Conventions

**SQL syntax patterns from existing migrations:**

Add column:
```sql
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "health_status" varchar(50) DEFAULT 'unknown' NOT NULL;
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "last_health_check_at" timestamp with time zone;
ALTER TABLE "lightfast_gateway_installations" ADD COLUMN "health_check_failures" integer DEFAULT 0 NOT NULL;
```

Drop column + add column (boolean → varchar):
```sql
DROP INDEX "workspace_source_is_active_idx";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "status" varchar(50) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "status_reason" varchar(100);--> statement-breakpoint
CREATE INDEX "workspace_source_status_idx" ON "lightfast_workspace_integrations" USING btree ("status");
```

Partial index (new, never used before in this codebase):
```sql
CREATE INDEX "gateway_wd_recovery_idx" ON "lightfast_gateway_webhook_deliveries"
  USING btree ("status","received_at")
  WHERE (status = 'received');
```

Create new table:
```sql
CREATE TABLE "lightfast_gateway_lifecycle_logs" (
    "id" varchar(191) PRIMARY KEY NOT NULL,
    ...
);
```

---

## 5. `nanoid` Import Pattern

All table files use the same pattern — no exceptions:

```ts
import { nanoid } from "@repo/lib";
```

Used as:
```ts
id: varchar("id", { length: 191 })
  .notNull()
  .primaryKey()
  .$defaultFn(() => nanoid()),
```

---

## 6. `jsonb` Field Patterns

Two usage patterns in the codebase:

**Untyped JSONB (generic object):**
```ts
metadata: jsonb("metadata"),
```

**Typed JSONB with `$type<T>()`:**
```ts
providerAccountInfo: jsonb("provider_account_info").$type<ProviderAccountInfo>(),
sourceEvent: jsonb("source_event").$type<PostTransformEvent>().notNull(),
sourceReferences: jsonb("source_references").$type<EntityRelation[]>(),
metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
```

For `gatewayLifecycleLog.resourceIds` (arbitrary string map) and `metadata` (arbitrary KV), use:
```ts
resourceIds: jsonb("resource_ids").$type<Record<string, string>>(),
metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
```

Import: `jsonb` from `drizzle-orm/pg-core`

---

## 7. `gatewayLifecycleLog` New Table — Design Constraints from Codebase Patterns

**Append-only audit trail — recommended schema following codebase conventions:**

```ts
import { nanoid } from "@repo/lib";
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { gatewayInstallations } from "./gateway-installations";

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

    event: varchar("event", { length: 50 }).notNull(),
    // e.g., "health_check_passed", "health_check_failed", "config_updated", "status_changed"

    fromStatus: varchar("from_status", { length: 50 }),
    toStatus: varchar("to_status", { length: 50 }),

    resourceIds: jsonb("resource_ids").$type<Record<string, string>>(),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),

    reason: text("reason"),

    occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    installationIdx: index("gateway_ll_installation_idx").on(table.installationId),
    installationOccurredIdx: index("gateway_ll_installation_occurred_idx").on(
      table.installationId,
      table.occurredAt
    ),
    eventIdx: index("gateway_ll_event_idx").on(table.event),
  })
);

export type GatewayLifecycleLog = typeof gatewayLifecycleLogs.$inferSelect;
export type InsertGatewayLifecycleLog = typeof gatewayLifecycleLogs.$inferInsert;
```

**Note on timestamp:** No `updatedAt` for append-only tables — consistent with `workspaceEvents` and `workspaceIngestLogs` which only have `createdAt`/`occurredAt`. No `$onUpdateFn` needed.

**Note on FK:** Using `onDelete: "cascade"` to follow the pattern of all other tables that FK to `gatewayInstallations`.

---

## 8. `relations.ts` — Does `gatewayLifecycleLog` Need a Relation?

File: `db/console/src/schema/relations.ts`

The `gatewayInstallationsRelations` currently declares `many(gatewayTokens)`, `many(gatewayResources)`, `many(workspaceIntegrations)`. To add lifecycle log relation:

```ts
// In gatewayInstallationsRelations:
lifecycleLogs: many(gatewayLifecycleLogs),
```

And add a corresponding inverse:
```ts
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

Then export `gatewayLifecycleLogsRelations` from `schema/index.ts` and `src/index.ts`.

---

## 9. Step-by-Step Execution Checklist

### Step 1 — Modify existing table files

**`gateway-installations.ts`:**
- Add `integer` to pg-core imports
- Add 4 new columns after `backfillConfig`

**`workspace-integrations.ts`:**
- Remove `boolean` from pg-core imports
- Replace `isActive: boolean(...)` with `status: varchar(...)` + `statusReason: varchar(...)`
- Rename `isActiveIdx` → `statusIdx` in index factory

**`gateway-webhook-deliveries.ts`:**
- Add `sql` import from `drizzle-orm`
- Add `failReason: varchar("fail_reason", { length: 100 })` (nullable)
- Add `recoveryIdx` partial index using `.where(sql\`${table.status} = 'received'\`)`

### Step 2 — Create new table file

Create `db/console/src/schema/tables/gateway-lifecycle-log.ts`

### Step 3 — Wire new table into schema exports (3 files)

- `db/console/src/schema/tables/index.ts`
- `db/console/src/schema/index.ts`
- `db/console/src/index.ts`

### Step 4 — Update `relations.ts`

Add `gatewayLifecycleLogsRelations` and update `gatewayInstallationsRelations`.

### Step 5 — Run `pnpm db:generate`

```bash
cd /path/to/db/console && pnpm db:generate
```

This runs: `dotenv -e ../../apps/console/.vercel/.env.development.local -- drizzle-kit generate --config=./src/drizzle.config.ts`

Review the generated SQL before running `pnpm db:migrate`.

### Step 6 — Data migration concern for `workspaceIntegrations`

The generated migration will DROP `is_active` and ADD `status`. Any live rows will lose the boolean value. If there are rows to preserve, prepend this to the generated SQL (before the DROP):
```sql
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "status" varchar(50);
UPDATE "lightfast_workspace_integrations" SET "status" = CASE WHEN "is_active" = true THEN 'active' ELSE 'inactive' END;
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "status" SET DEFAULT 'active';
```
Then remove the generated `ADD COLUMN "status" varchar(50) DEFAULT 'active' NOT NULL` statement from Drizzle's output to avoid the duplicate. This is the only case where the generated SQL needs manual adjustment.

---

## 10. Key Technical Facts

| Fact | Value |
|------|-------|
| drizzle-orm version | 0.45.1 (catalog: `^0.45.1`) |
| drizzle-kit version | `^0.31.9` |
| `.where()` on indexes | Confirmed available in 0.45.1 — `where(condition: SQL): this` |
| Schema entry point | `db/console/src/schema/index.ts` |
| Migration output dir | `db/console/src/migrations/` |
| Current migration count | 0058 (next will be 0059) |
| Timestamp mode | Always `{ mode: "string", withTimezone: true }` |
| ID generation | `nanoid()` from `@repo/lib` via `$defaultFn` |
| Table name prefix | `lightfast_` |
| SQL expression indexes | Supported — `sql\`...\`` in `.on()` (see `workspace-ingest-logs.ts`) |
| Partial index syntax | `index("name").on(cols).where(sql\`condition\`)` |
| No partial index examples | Zero in existing schema — this will be the first |
| Boolean fields in schema | Only `isActive` on `workspaceIntegrations` — confirms it's safe to remove `boolean` import from that file |
