# Gateway-Console DB Consolidation: Comprehensive Implementation Plan

## Overview

Consolidate the Gateway's Turso (libSQL) database into Console's PlanetScale database, eliminating the entire cross-service sync layer. This plan also absorbs the remaining connection-manager phases (7-10): client-side refactor, route cleanup, admin completion, and deployment.

**Why**: The separate Turso database creates massive accidental complexity — QStash sync endpoints, an HTTP gateway client, dual-path token code, and a fundamentally broken user-scoped linking model (`userSources` can't map 1:N to `gw_installations` across orgs). Consolidating into PlanetScale gives us real FKs, transactional guarantees, and eliminates ~6 infrastructure artifacts.

**Research**: `thoughts/shared/research/2026-02-25-console-db-architecture-gateway-integration.md`
**Prior Plan**: `thoughts/shared/plans/2026-02-25-connection-manager-implementation.md` (Phases 1-6 complete, this plan supersedes 7-10)

## Current State Analysis

### What's Built (Phases 1-6)

- Gateway: Hono edge service with Turso DB (`gw_installations`, `gw_tokens`, `gw_resources`, `gw_webhook_deliveries`)
- Console: `userSources` (user-scoped OAuth) + `workspaceIntegrations` (resource subscriptions) in PlanetScale
- QStash sync layer: Gateway → `notifyConsoleSync()` → Console `/api/connections/sync` → upserts `userSources`
- HTTP client: `@repo/console-gateway-client` → `getToken()`, `linkResource()`, etc.
- Dual-path token: 3 locations check `gatewayInstallationId ? HTTP : decrypt()`
- `workspaceIntegrations.gatewayInstallationId` column exists but is never written

### Key Architecture Problems

1. **User-level linking is broken**: `userSources` is scoped per-user, but `gw_installations` is per-org. A user in 5 orgs has 1 `userSource` but 5 `gw_installations` — the FK can't hold N values.
2. **6 artifacts exist solely to bridge two databases**: sync endpoints, HTTP client, QStash notifications, dual-path token code, gateway-client package, sentinel access tokens.
3. **`sourceConfig` is a monolithic JSONB** mixing Console-owned sync config, backfill state, and provider metadata — all stuffed into one column with untyped runtime access.

### Key Discoveries

- `db/console/src/client.ts:10` — Console uses `postgres-js` with PlanetScale's Postgres-compatible endpoint (port 6432)
- `vendor/db/src/planetscale.ts` — `@vendor/db` has a `@planetscale/database` HTTP driver but it targets PlanetScale's MySQL endpoint, incompatible with `pgTable` schemas
- `db/gateway/src/client.ts:1` — Gateway uses `@libsql/client/web` (edge-compatible Turso driver)
- Gateway has no `onConflictDoUpdate` calls — standard INSERT/UPDATE/SELECT queries only
- `apps/gateway/src/env.ts:7` — Gateway extends `@db/gateway/env` (Turso env vars)
- 17+ locations read `userSources`, 20+ locations read `workspaceIntegrations.sourceConfig`
- `@vendor/db/env.ts` validates PlanetScale credentials with format checks

## Desired End State

```
PlanetScale (single database, Postgres-compatible endpoint)
├── lightfast_gw_installations (org-scoped, Gateway-owned)
│   ├── id, provider, external_id, account_login
│   ├── connected_by, org_id, status
│   ├── webhook_secret, metadata
│   ├── provider_account_info (JSONB — typed: GitHub installations array or Vercel team info)
│   └── unique index: (provider, external_id)
│
├── lightfast_gw_tokens (Gateway-owned, AES-256 encrypted)
│   └── installation_id → gw_installations.id (CASCADE)
│
├── lightfast_gw_resources (Gateway-owned, webhook routing)
│   └── installation_id → gw_installations.id (CASCADE)
│
├── lightfast_gw_webhook_deliveries (Gateway-owned)
│
├── lightfast_workspace_integrations (Console-owned, restructured)
│   ├── workspaceId → orgWorkspaces.id (CASCADE)
│   ├── installationId → gw_installations.id (REAL FK)
│   ├── provider (denormalized), providerResourceId
│   ├── syncConfig (JSONB — events, branches, paths, autoSync)
│   ├── backfillState (JSONB — status, checkpoint, progress)
│   └── isActive, sync status, documentCount
│
└── ... (other Console tables unchanged, userSources DELETED)

Gateway (Hono, Node.js Fluid Compute) ──→ PlanetScale (gw_* tables via postgres-js)
Console (Next.js)                      ──→ PlanetScale (all tables, joins across gw_* and lightfast_*)
```

### Verification

- `pnpm build:console && pnpm build:gateway` compiles
- `pnpm typecheck && pnpm lint` passes
- Gateway OAuth flow writes directly to PlanetScale (no QStash)
- Console reads `gw_installations` + `gw_tokens` directly (no HTTP client)
- Token access is a single DB query + decrypt (no dual-path)
- `workspaceIntegrations` uses real FK to `gw_installations`
- `sourceConfig` is replaced by `syncConfig` + `backfillState`
- Zero imports from `@db/gateway`, `@repo/console-gateway-client`
- No `/api/connections/sync` or `/api/connections/removed` endpoints
- Client-side connect flow works for all 4 providers

## What We're NOT Doing

- **No data migration script** — pre-production with negligible data; clean schema cut
- **No shadow mode** — big-bang cutover after thorough testing
- **No changes to Inngest workflow internal logic** — only their data sources change
- **No changes to `@repo/console-webhooks` transformers** — payload transformation stays in Console
- **No changes to Redis routing cache** — Gateway's webhook-receipt workflow still uses Redis for fast resource→installation lookup
- **No `gw_resources` + `workspaceIntegrations` merge** — they serve different purposes (webhook routing vs workspace subscription); keep separate

## Implementation Approach

The plan is ordered by dependency chain: schema first, then Gateway swap, then consumer rewire, then cleanup. Each phase produces a working (if incomplete) system.

**Runtime change**: Gateway switches from Vercel Edge to Node.js Fluid Compute. This allows it to use `postgres-js` (same driver as Console) instead of requiring an edge-compatible Postgres driver. Cold start increases from ~50ms to ~115ms — acceptable for webhook and OAuth endpoints.

---

## Phase 1: PlanetScale Schema for Gateway Tables

### Overview

Define `gw_*` tables as `pgTable` in `@db/console/schema`, matching the current Turso schema but adapted for PostgreSQL. Add `provider_account_info` column to `gw_installations`. Generate Drizzle migration.

### Changes Required

#### 1.1. Gateway Installations Table

**File**: `db/console/src/schema/tables/gw-installations.ts` (NEW)

```typescript
import { pgTable, varchar, timestamp, text, boolean, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import type { ClerkUserId } from "@repo/console-validation";
import { PROVIDER_NAMES, INSTALLATION_STATUSES } from "@repo/gateway-types";

export const gwInstallations = pgTable(
  "lightfast_gw_installations",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull(),
    externalId: varchar("external_id", { length: 191 }).notNull(),
    accountLogin: varchar("account_login", { length: 191 }),
    connectedBy: varchar("connected_by", { length: 191 }).notNull().$type<ClerkUserId>(),
    orgId: varchar("org_id", { length: 191 }).notNull(),

    status: varchar("status", { length: 50 }).notNull(), // active|pending|error|revoked

    webhookSecret: text("webhook_secret"),
    metadata: jsonb("metadata"),

    // Strongly-typed provider account info (replaces userSources.providerMetadata)
    providerAccountInfo: jsonb("provider_account_info").$type<
      | {
          version: 1;
          sourceType: "github";
          installations?: {
            id: string;
            accountId: string;
            accountLogin: string;
            accountType: "User" | "Organization";
            avatarUrl: string;
            permissions: Record<string, string>;
            installedAt: string;
            lastValidatedAt: string;
          }[];
        }
      | {
          version: 1;
          sourceType: "vercel";
          teamId?: string;
          teamSlug?: string;
          userId: string;
          configurationId: string;
        }
      | {
          version: 1;
          sourceType: "linear" | "sentry";
        }
    >(),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    providerExternalIdx: uniqueIndex("gw_inst_provider_external_idx").on(
      table.provider,
      table.externalId,
    ),
    orgIdIdx: index("gw_inst_org_id_idx").on(table.orgId),
    orgProviderIdx: index("gw_inst_org_provider_idx").on(table.orgId, table.provider),
    connectedByIdx: index("gw_inst_connected_by_idx").on(table.connectedBy),
  }),
);

export type GwInstallation = typeof gwInstallations.$inferSelect;
export type InsertGwInstallation = typeof gwInstallations.$inferInsert;
```

#### 1.2. Gateway Tokens Table

**File**: `db/console/src/schema/tables/gw-tokens.ts` (NEW)

```typescript
import { pgTable, varchar, timestamp, text, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import { gwInstallations } from "./gw-installations";

export const gwTokens = pgTable(
  "lightfast_gw_tokens",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gwInstallations.id, { onDelete: "cascade" }),

    accessToken: text("access_token").notNull(), // AES-256-GCM encrypted
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
    tokenType: varchar("token_type", { length: 50 }),
    scope: text("scope"),

    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    installationIdIdx: index("gw_tok_installation_id_idx").on(table.installationId),
  }),
);

export type GwToken = typeof gwTokens.$inferSelect;
export type InsertGwToken = typeof gwTokens.$inferInsert;
```

#### 1.3. Gateway Resources Table

**File**: `db/console/src/schema/tables/gw-resources.ts` (NEW)

```typescript
import { pgTable, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { nanoid } from "@repo/lib";
import { gwInstallations } from "./gw-installations";

export const gwResources = pgTable(
  "lightfast_gw_resources",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    installationId: varchar("installation_id", { length: 191 })
      .notNull()
      .references(() => gwInstallations.id, { onDelete: "cascade" }),

    providerResourceId: varchar("provider_resource_id", { length: 191 }).notNull(),
    resourceName: varchar("resource_name", { length: 500 }),

    status: varchar("status", { length: 50 }).notNull(), // active|removed

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    installationIdIdx: index("gw_res_installation_id_idx").on(table.installationId),
    providerResourceIdx: index("gw_res_provider_resource_idx").on(
      table.installationId,
      table.providerResourceId,
    ),
  }),
);

export type GwResource = typeof gwResources.$inferSelect;
export type InsertGwResource = typeof gwResources.$inferInsert;
```

#### 1.4. Gateway Webhook Deliveries Table

**File**: `db/console/src/schema/tables/gw-webhook-deliveries.ts` (NEW)

```typescript
import { pgTable, varchar, timestamp, index, text } from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";

export const gwWebhookDeliveries = pgTable(
  "lightfast_gw_webhook_deliveries",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    provider: varchar("provider", { length: 50 }).notNull(),
    deliveryId: varchar("delivery_id", { length: 191 }).notNull(),
    eventType: varchar("event_type", { length: 191 }).notNull(),
    installationId: varchar("installation_id", { length: 191 }),

    status: varchar("status", { length: 50 }).notNull(), // received|delivered|dlq

    // For DLQ replay — store raw payload on failed deliveries
    payload: text("payload"),

    receivedAt: timestamp("received_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (table) => ({
    providerDeliveryIdx: index("gw_wd_provider_delivery_idx").on(
      table.provider,
      table.deliveryId,
    ),
    statusIdx: index("gw_wd_status_idx").on(table.status),
  }),
);

export type GwWebhookDelivery = typeof gwWebhookDeliveries.$inferSelect;
export type InsertGwWebhookDelivery = typeof gwWebhookDeliveries.$inferInsert;
```

#### 1.5. Relations

**File**: `db/console/src/schema/relations.ts`

Add Gateway table relations alongside existing Console relations:

```typescript
// Gateway relations
export const gwInstallationsRelations = relations(gwInstallations, ({ many }) => ({
  tokens: many(gwTokens),
  resources: many(gwResources),
  workspaceIntegrations: many(workspaceIntegrations),
}));

export const gwTokensRelations = relations(gwTokens, ({ one }) => ({
  installation: one(gwInstallations, {
    fields: [gwTokens.installationId],
    references: [gwInstallations.id],
  }),
}));

export const gwResourcesRelations = relations(gwResources, ({ one }) => ({
  installation: one(gwInstallations, {
    fields: [gwResources.installationId],
    references: [gwInstallations.id],
  }),
}));
```

#### 1.6. Schema Barrel Exports

**File**: `db/console/src/schema/tables/index.ts`

Add exports for all 4 new tables.

**File**: `db/console/src/schema/index.ts`

Ensure new tables and relations are re-exported.

#### 1.7. Generate Migration

```bash
cd db/console && pnpm db:generate
```

This generates the additive migration (4 new tables). Do NOT manually write SQL.

### Success Criteria

#### Automated Verification:
- [ ] `cd db/console && pnpm db:generate` produces a clean migration with 4 new tables
- [x] `pnpm build:console` compiles
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

#### Manual Verification:
- [ ] `cd db/console && pnpm db:migrate` applies cleanly
- [ ] `cd db/console && pnpm db:studio` shows the 4 new `lightfast_gw_*` tables

**Implementation Note**: This phase is purely additive — no existing code is modified.

---

## Phase 2: Gateway Runtime & Database Swap

### Overview

Switch the Gateway from Vercel Edge + Turso to Node.js Fluid Compute + PlanetScale. The Gateway app continues to own `gw_*` tables but now reads/writes them in PlanetScale through `postgres-js`.

### Changes Required

#### 2.1. Gateway DB Client

**File**: `apps/gateway/src/lib/db.ts`

Replace Turso import with PlanetScale connection:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
// Import only the gw_* schema tables that Gateway needs
import * as schema from "@db/console/schema";

const connectionString = `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}:6432/postgres?sslmode=verify-full`;

const client = postgres(connectionString, {
  ssl: "require",
  max: 10,            // Gateway has lower connection needs than Console
  prepare: false,     // Required for PgBouncer transaction mode
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
```

#### 2.2. Gateway Environment

**File**: `apps/gateway/src/env.ts`

Replace `@db/gateway/env` with `@vendor/db/env` (PlanetScale credentials):

```typescript
import { dbEnv } from "@vendor/db/env";
// Remove: import { env as dbEnv } from "@db/gateway/env";

export const env = createEnv({
  extends: [vercel(), upstashEnv, qstashEnv, dbEnv],
  // ... rest unchanged
});
```

#### 2.3. Update All Gateway Schema Imports

The Gateway code currently imports from `@db/gateway/schema`. All imports must change to `@db/console/schema`, and table names must use the new PG table objects.

**Files to update** (6 files in `apps/gateway/src/`):

| File | Current Import | New Import |
|------|---------------|------------|
| `routes/connections.ts` | `import { installations, resources, tokens } from "@db/gateway/schema"` | `import { gwInstallations, gwResources, gwTokens } from "@db/console/schema"` |
| `routes/admin.ts` | `import { installations, resources, webhookDeliveries } from "@db/gateway/schema"` | `import { gwInstallations, gwResources, gwWebhookDeliveries } from "@db/console/schema"` |
| `workflows/webhook-receipt.ts` | `import { installations, resources } from "@db/gateway/schema"` | `import { gwInstallations, gwResources } from "@db/console/schema"` |
| `lib/secrets.ts` | `import { installations } from "@db/gateway/schema"` | `import { gwInstallations } from "@db/console/schema"` |
| `lib/db.ts` | `import { db } from "@db/gateway/client"` | Self-contained (see 2.1) |

For each file, rename all references: `installations` → `gwInstallations`, `tokens` → `gwTokens`, `resources` → `gwResources`, `webhookDeliveries` → `gwWebhookDeliveries`.

Also update all column references from SQLite-style to PG-style:
- `installations.id` → `gwInstallations.id`
- `installations.provider` → `gwInstallations.provider`
- etc.

#### 2.4. Update Gateway Drizzle Queries

The Drizzle query builder API is mostly dialect-agnostic, but verify:
- No raw SQL strings with SQLite-specific syntax
- No `integer({ mode: "timestamp" })` patterns (replaced by `timestamp()` in PG schema)
- Timestamp comparisons now use ISO strings (PG `timestamptz`) instead of Unix integers

Key areas to audit in `apps/gateway/src/routes/connections.ts`:
- Installation INSERT (after OAuth callback)
- Token INSERT/UPDATE (encrypted token storage)
- Resource INSERT (link resource)
- Installation UPDATE (status changes)
- Token SELECT + lazy refresh logic

#### 2.5. Gateway Runtime Configuration

Switch from `@hono/vercel-edge` to `@hono/vercel-node` (or equivalent) to enable TCP connections for postgres-js:

**File**: `apps/gateway/package.json`

Update dependencies:
- Remove: `@libsql/client`
- Add: `postgres` (should already be in catalog from Console)
- Add: `@db/console` as workspace dependency

**File**: `apps/gateway/vercel.json` (if exists, or project settings)

Ensure functions use Node.js runtime, not Edge.

#### 2.6. Add `@db/console` and `@vendor/db` as Gateway Dependencies

**File**: `apps/gateway/package.json`

```json
{
  "dependencies": {
    "@db/console": "workspace:*",
    "@vendor/db": "workspace:*",
    "postgres": "catalog:"
  }
}
```

Remove:
```json
{
  "dependencies": {
    "@db/gateway": "workspace:*",
    "@libsql/client": "..."
  }
}
```

#### 2.7. Populate `providerAccountInfo` on OAuth Callback

**File**: `apps/gateway/src/routes/connections.ts`

After creating/updating an installation in the OAuth callback, also write `providerAccountInfo`:

For GitHub:
```typescript
await db.update(gwInstallations)
  .set({
    providerAccountInfo: {
      version: 1,
      sourceType: "github",
      installations: [{
        id: String(installationId),
        accountId: String(accountId),
        accountLogin: accountLogin ?? "unknown",
        accountType: "Organization",
        avatarUrl: "",
        permissions: {},
        installedAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
      }],
    },
  })
  .where(eq(gwInstallations.id, installation.id));
```

For Vercel:
```typescript
providerAccountInfo: {
  version: 1,
  sourceType: "vercel",
  userId: stateData.connectedBy,
  teamId: teamId ?? undefined,
  teamSlug: teamSlug ?? undefined,
  configurationId: externalId,
}
```

For Linear/Sentry:
```typescript
providerAccountInfo: { version: 1, sourceType: provider.name }
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm build:gateway` compiles with zero `@db/gateway` imports
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `grep -r "@db/gateway" apps/gateway/` returns no results

#### Manual Verification:
- [ ] Gateway health endpoint (`GET /admin/health`) returns healthy (PlanetScale connection works)
- [ ] GitHub OAuth flow works end-to-end: authorize → provider → callback → installation created in PlanetScale
- [ ] Token vault endpoint (`GET /connections/:id/token`) returns decrypted token from PlanetScale
- [ ] Webhook receipt pipeline processes a GitHub push through to QStash publish
- [ ] `cd db/console && pnpm db:studio` shows `gw_installations` rows after OAuth test

**Implementation Note**: After this phase, Gateway reads/writes PlanetScale. Console still uses `userSources` + sync layer. The sync endpoint will fail (Gateway no longer calls it) but that's expected — Phase 3 removes it.

---

## Phase 3: Sync Layer Elimination

### Overview

Remove the QStash-based sync/notification layer between Gateway and Console. Since both services now share PlanetScale, Console can query `gw_installations` directly. Also remove the `@repo/console-gateway-client` HTTP client — Console accesses `gw_tokens` directly.

### Changes Required

#### 3.1. Remove Gateway QStash Notifications

**File**: `apps/gateway/src/routes/connections.ts`

Delete `notifyConsoleSync()` function (lines ~669-686) and all calls to it:
- Line ~113-119 (GitHub existing installation)
- Line ~144-150 (GitHub new installation)
- Line ~268-274 (Standard OAuth providers)

Delete `notifyConsoleRemoved()` function (lines ~692-706) and its call:
- Line ~531-535 (DELETE teardown handler)

Remove `consoleUrl` and related-projects imports if no longer used by other code.

#### 3.2. Delete Console Sync Endpoint

**Delete file**: `apps/console/src/app/api/connections/sync/route.ts`

This was the only consumer of QStash sync notifications.

#### 3.3. Delete Console Removed Endpoint

**Delete file**: `apps/console/src/app/api/connections/removed/route.ts`

This was the only consumer of QStash removal notifications.

#### 3.4. Delete Gateway Client Package

**Delete directory**: `packages/console-gateway-client/`

Remove `@repo/console-gateway-client` from:
- `apps/console/package.json`
- `api/console/package.json`
- Any `pnpm-workspace.yaml` references

#### 3.5. Delete Gateway Client Singleton

**Delete file**: `api/console/src/lib/gateway.ts`

Remove all imports of `gatewayClient` from:
- `api/console/src/router/user/user-sources.ts:~line 10`
- `api/console/src/router/org/workspace.ts:~line 34`
- `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts:~line 10`

(These files will be updated in Phase 4 to use direct DB queries instead.)

#### 3.6. Replace Dual-Path Token with Direct DB Decrypt

Create a new utility for direct token access:

**File**: `api/console/src/lib/token-vault.ts` (NEW)

```typescript
import { db, eq } from "@db/console";
import { gwTokens, gwInstallations } from "@db/console/schema";
import { decrypt } from "@repo/lib";
import { env } from "../env";

/**
 * Get a decrypted access token for an installation.
 * Reads directly from gw_tokens in PlanetScale (no HTTP call).
 */
export async function getInstallationToken(installationId: string): Promise<string> {
  const token = await db.query.gwTokens.findFirst({
    where: eq(gwTokens.installationId, installationId),
  });

  if (!token) {
    throw new Error(`No token found for installation: ${installationId}`);
  }

  return decrypt(token.accessToken, env.ENCRYPTION_KEY);
}

/**
 * Check if a token needs refresh and return the decrypted access token.
 * For providers with refresh tokens, refreshes inline if expired.
 */
export async function getInstallationTokenWithRefresh(
  installationId: string,
): Promise<{ accessToken: string; provider: string }> {
  const result = await db
    .select({
      token: gwTokens,
      provider: gwInstallations.provider,
    })
    .from(gwTokens)
    .innerJoin(gwInstallations, eq(gwTokens.installationId, gwInstallations.id))
    .where(eq(gwTokens.installationId, installationId))
    .limit(1);

  const row = result[0];
  if (!row) {
    throw new Error(`No token found for installation: ${installationId}`);
  }

  // TODO: Implement lazy refresh for expired tokens (port from Gateway's token vault logic)
  // For now, decrypt and return directly
  const accessToken = decrypt(row.token.accessToken, env.ENCRYPTION_KEY);
  return { accessToken, provider: row.provider };
}
```

**Note**: The `ENCRYPTION_KEY` env var must be added to Console's environment. It's currently only in Gateway's env. Add to `api/console/src/env.ts`.

### Success Criteria

#### Automated Verification:
- [x] `pnpm build:console` compiles (will have temporary errors in files that imported `gatewayClient` — expected, fixed in Phase 4)
- [x] `pnpm build:gateway` compiles
- [x] `grep -r "notifyConsoleSync\|notifyConsoleRemoved" apps/gateway/` returns no results
- [x] `grep -r "console-gateway-client" .` returns no results (outside node_modules)
- [x] `grep -r "/api/connections/sync\|/api/connections/removed" apps/console/src/app/api/` returns no route files

#### Manual Verification:
- [ ] Gateway OAuth flow creates installation in PlanetScale without attempting QStash notification
- [ ] Console can query `gw_installations` directly via Drizzle

**Implementation Note**: After this phase, the 3 locations that used `gatewayClient.getToken()` will have compile errors. Phase 4 fixes them.

---

## Phase 4: Console Consumer Rewire (userSources → gw_installations)

### Overview

The largest phase. Rewire all 17+ locations that read `userSources` to use `gw_installations` instead. Replace the `userSourceId` FK on `workspaceIntegrations` with `installationId` FK to `gw_installations`. Delete the `userSources` table.

### Changes Required

#### 4.1. Schema: Add `installationId` and `provider` to `workspaceIntegrations`

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

Add new columns:

```typescript
// New: Real FK to Gateway installation
installationId: varchar("installation_id", { length: 191 })
  .notNull()
  .references(() => gwInstallations.id),

// New: Denormalized provider for fast filtering
provider: varchar("provider", { length: 50 }).notNull(),
```

Keep `userSourceId` temporarily (will be dropped in Phase 7 cleanup after all consumers are migrated).

Generate migration: `cd db/console && pnpm db:generate`

#### 4.2. Update Relations

**File**: `db/console/src/schema/relations.ts`

Update `workspaceIntegrations` relation:

```typescript
export const workspaceIntegrationsRelations = relations(workspaceIntegrations, ({ one }) => ({
  workspace: one(orgWorkspaces, {
    fields: [workspaceIntegrations.workspaceId],
    references: [orgWorkspaces.id],
  }),
  installation: one(gwInstallations, {
    fields: [workspaceIntegrations.installationId],
    references: [gwInstallations.id],
  }),
}));
```

Remove the old `userSources` relation from `workspaceIntegrations`.

#### 4.3. tRPC User Sources Router — Replace Core Procedures

**File**: `api/console/src/router/user/user-sources.ts`

This router has the most changes. The existing procedures are user-scoped and query `userSources`. Post-consolidation, they query `gw_installations` (which is org-scoped). Access pattern changes from "my connections" to "my org's connections that I can see".

**`list`** (line 48-71):
- Change from: `db.query.userSources.findMany({ where: eq(userId) })`
- Change to: `db.query.gwInstallations.findMany({ where: and(eq(orgId, ctx.auth.orgId), eq(status, 'active')) })`
- Return shape changes: map `gwInstallations` to match existing client expectations

**`disconnect`** (line 76-109):
- Change from: soft-delete `userSources`
- Change to: call Gateway's delete connection logic (mark `gwInstallations` as `revoked`, cascade to related `workspaceIntegrations`)

**`github.get`** (line 121-157):
- Change from: `userSources` query for `providerMetadata.installations`
- Change to: `gwInstallations` query with `provider = 'github'` and `orgId`, read `providerAccountInfo.installations`

**`github.validate`** (line 167-272):
- Replace dual-path token (line 192-194) with:
  ```typescript
  const accessToken = await getInstallationToken(installation.id);
  ```
- Replace `providerMetadata` update with `providerAccountInfo` update on `gwInstallations`
- Query: `gwInstallations WHERE provider = 'github' AND orgId = ctx.auth.orgId AND status = 'active'`

**`github.storeOAuthResult`** (line 282-386):
- **DELETE this procedure**. The Gateway handles OAuth result storage directly in PlanetScale. No Console callback needed.

**`github.repositories`** (line 394-482):
- Change `userSources` query to `gwInstallations` query
- Read `providerAccountInfo.installations` instead of `providerMetadata.installations`

**`github.detectConfig`** (line 490-667):
- Change `userSources` query to `gwInstallations` query
- Read `providerAccountInfo.installations` instead of `providerMetadata.installations`

**`vercel.get`** (line 680-717):
- Change to `gwInstallations` query with `provider = 'vercel'` and `orgId`
- Read `providerAccountInfo.teamId`, `.userId`, `.configurationId`

**`vercel.storeOAuthResult`** (line 723-808):
- **DELETE this procedure**. Gateway handles Vercel OAuth directly.

**`vercel.listProjects`** (line 816-920):
- Replace dual-path token (line 843-845) with `getInstallationToken(installation.id)`
- Read `providerAccountInfo.teamId` instead of `providerMetadata.teamId`
- Change ownership check from `userId` to `orgId`

**`vercel.disconnect`** (line 925-945):
- Change to mark `gwInstallations` as `revoked`

#### 4.4. tRPC Org Workspace Router — Replace `userSourceId` Joins

**File**: `api/console/src/router/org/workspace.ts`

**`resolveFromGithubOrgSlug`** (line 111-167):
- Currently: raw SQL `EXISTS` on `userSources.providerMetadata` JSONB
- Change to: query `gwInstallations WHERE provider = 'github' AND providerAccountInfo->>'installations' LIKE '%accountLogin%'`
- Or: query `gwInstallations.accountLogin` column directly (it stores the GitHub org login)

**`sources.list`** (line 566-631):
- Currently: `INNER JOIN userSources ON userSourceId` to get `sourceType`
- Change to: read `workspaceIntegrations.provider` directly (denormalized column from 4.1)
- Remove the join entirely

**`integrations.linkVercelProject`** (line 913-1020):
- Currently: reads `userSources.providerMetadata.teamId/.teamSlug/.configurationId`
- Change to: reads `gwInstallations.providerAccountInfo` via `installationId` join
- Write `installationId` and `provider` to new `workspaceIntegrations` columns

**`integrations.bulkLinkGitHubRepositories`** (line 1117-~1300):
- Currently: reads `userSources.providerMetadata.installations`, reads `source.gatewayInstallationId`
- Change to: reads `gwInstallations.providerAccountInfo.installations`, uses `installation.id` directly
- Write `installationId` and `provider` to new `workspaceIntegrations` columns
- Remove `gatewayClient.linkResource()` calls (line 1261-1271) — resource linking is now a direct DB write to `gw_resources`

**`integrations.bulkLinkVercelProjects`** (line 1309-~1450):
- Same pattern as GitHub: replace `userSources` query with `gwInstallations` query
- Remove `gatewayClient.linkResource()` calls (line 1443-1453) — direct DB write instead

#### 4.5. Inngest Backfill Orchestrator — Replace Token Access

**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

**Step `"decrypt-token"`** (line 124-147):
- Currently: fetches `userSources` row, dual-path check
- Change to:
  ```typescript
  const accessToken = await getInstallationToken(installationId);
  ```
- The `installationId` comes from the Inngest event payload (previously `userSourceId` — update the event payload shape)

**Step `"validate-integration"`** (line 102-119):
- Currently reads `sourceConfig` — handled in Phase 5

#### 4.6. Auth Middleware — Replace Ownership Checks

**File**: `packages/console-auth-middleware/src/resources.ts`

**`verifyIntegrationOwnership`** (line 60-96):
- Currently: checks `userSource.userId === userId`
- Change to: check that the user belongs to the org that owns the `gwInstallation` (via Clerk org membership)

**`verifyRepositoryOwnership`** (line 159-210):
- Currently: reads `workspaceIntegrations` → `userSources` via `userSourceId`
- Change to: reads `workspaceIntegrations` → `gwInstallations` via `installationId`, verify user has org access

**`verifyUserSourceOwnership`** (line 223-259):
- **DELETE or rename**. This function verified ownership of a `userSources` row.
- Replace with `verifyInstallationAccess`: verify user's Clerk org matches `gwInstallations.orgId`

#### 4.7. Vercel Webhooks Route

**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

**`findWorkspaceForVercelProject`** (line 97-137):
- Currently: 3-way join `workspaceIntegrations ← userSources → orgWorkspaces`
- Change to: 2-way join `workspaceIntegrations ← orgWorkspaces` (use `workspaceIntegrations.provider` filter instead of `userSources.sourceType`)
- Or: `workspaceIntegrations ← gwInstallations → orgWorkspaces` if needed

#### 4.8. User Workspace Router

**File**: `api/console/src/router/user/workspace.ts`

**`workspaceAccess.create`** (line 95-314):
- Line 180-189: ownership check on `userSources`
- Change to: verify user has access to the `gwInstallation` via org membership
- Line 242: writes `userSourceId` into new `workspaceIntegrations`
- Change to: write `installationId` and `provider`

#### 4.9. Integration Router

**File**: `api/console/src/router/org/integration.ts`

**`verifyUserSourceOwnership`** (line 27-55):
- Currently suppressed (`void verifyUserSourceOwnership` at line 55)
- **DELETE** the function entirely

#### 4.10. Test Data Seeder

**File**: `packages/console-test-data/src/cli/seed-integrations.ts`

- Replace `userSources` INSERT with `gwInstallations` + `gwTokens` INSERT
- Update `workspaceIntegrations` seed to use `installationId` and `provider`

#### 4.11. Backfill Event Payload Change

The Inngest `backfill.requested` event currently carries `userSourceId`. Change to `installationId`.

**File**: Search for `backfill.requested` event definition and all send sites:
- `api/console/src/router/org/workspace.ts:~1278` (bulkLink sends event)
- `api/console/src/router/org/backfill.ts:~147` (backfill.start sends event)
- Inngest event type definitions

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build:console` compiles with zero `userSources` imports in non-schema files
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `grep -r "gatewayClient\|gatewayInstallationId" api/console/src/` returns no results
- [ ] `grep -r "userSourceId" api/console/src/router/` returns no results (except possibly schema file)

#### Manual Verification:
- [ ] Connection list page shows org's connections from `gw_installations`
- [ ] GitHub validate flow works: fetches token → calls GitHub API → updates `providerAccountInfo`
- [ ] Vercel list projects works: fetches token → calls Vercel API → returns projects
- [ ] Bulk link repositories works: creates `workspaceIntegrations` with `installationId` FK
- [ ] Backfill workflow runs: reads token from `gw_tokens`, processes pages
- [ ] Webhook ingress observation capture correctly checks allow-list via `workspaceIntegrations`

**Implementation Note**: This is the largest phase and most likely to surface unexpected dependencies. Implement subsystem by subsystem (tRPC routers → Inngest workflows → middleware → webhook routes). Pause for testing after each subsystem.

---

## Phase 5: sourceConfig Split (syncConfig + backfillState)

### Overview

Split the monolithic `sourceConfig` JSONB into three concerns:
1. `syncConfig` — Console-owned: events, branches, paths, autoSync
2. `backfillState` — Console-owned: status, checkpoint, progress
3. Provider resource metadata — moved to `gw_resources` or denormalized on `workspaceIntegrations`

### Changes Required

#### 5.1. Schema: New Columns

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

Add new columns:

```typescript
// Console-owned sync configuration
syncConfig: jsonb("sync_config").$type<{
  events?: string[];       // ["push", "pull_request"]
  branches?: string[];     // ["main", "develop"]
  paths?: string[];        // ["**/*"]
  autoSync: boolean;       // auto-sync on changes
  // Config detection status (GitHub only)
  configStatus?: "configured" | "awaiting_config";
  configPath?: string;
  lastConfigCheck?: string;
}>(),

// Console-owned backfill state
backfillState: jsonb("backfill_state").$type<{
  status: "idle" | "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  checkpoint?: Record<string, unknown>;
  progress?: { processed: number; total?: number };
  error?: string;
}>(),

// Denormalized provider resource metadata (read-heavy, join-avoidance)
resourceName: varchar("resource_name", { length: 500 }),     // "acme/frontend" or "my-nextjs-app"
resourceMeta: jsonb("resource_meta").$type<
  | {
      sourceType: "github";
      installationId: string;    // GitHub App installation ID (numeric string)
      repoId: string;
      repoName: string;
      repoFullName: string;
      defaultBranch: string;
      isPrivate: boolean;
      isArchived: boolean;
    }
  | {
      sourceType: "vercel";
      projectId: string;
      projectName: string;
      teamId?: string;
      teamSlug?: string;
      configurationId: string;
    }
>(),
```

Generate migration: `cd db/console && pnpm db:generate`

#### 5.2. Update Bulk Link Mutations (Write Path)

**File**: `api/console/src/router/org/workspace.ts`

**`bulkLinkGitHubRepositories`**:
Instead of writing `sourceConfig`:
```typescript
// Before:
sourceConfig: { version: 1, sourceType: "github", type: "repository", installationId, repoId, ... }

// After:
syncConfig: { events: ["push", "pull_request", ...], branches: ["main"], paths: ["**/*"], autoSync: true },
backfillState: null,
resourceMeta: { sourceType: "github", installationId, repoId, repoName, repoFullName, defaultBranch: "main", isPrivate: false, isArchived: false },
resourceName: repoFullName,
```

**`linkVercelProject`**:
```typescript
syncConfig: { events: [...], autoSync: true },
backfillState: null,
resourceMeta: { sourceType: "vercel", projectId, projectName, teamId, teamSlug, configurationId },
resourceName: projectName,
```

#### 5.3. Update Observation Capture (Read Path)

**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**Step `"check-event-allowed"`** (line 522-587):
- Change from: `integration.sourceConfig.sync.events`
- Change to: `integration.syncConfig?.events`

#### 5.4. Update Push Handler (Read Path)

**File**: `api/console/src/inngest/workflow/providers/github/push-handler.ts`

**Step `"source.validate"`** (line 85-107):
- Change from: `src.sourceConfig.sourceType`
- Change to: `src.provider` (denormalized column)

**Step `"check-push-allowed"`** (line 110-127):
- Change from: `source.sourceConfig.sync.events`
- Change to: `source.syncConfig?.events`

**Step `"config.check-changed"`** (line 139-218):
- Change from: spread `sourceConfig` + add `status` sub-object
- Change to: update `syncConfig.configStatus`, `syncConfig.configPath`, `syncConfig.lastConfigCheck`

#### 5.5. Update Sync Orchestrator (Read Path)

**File**: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts`

**Step `"fetch-metadata"`** (line 115-130):
- Change from: `source.sourceConfig` passed through
- Change to: construct metadata from `syncConfig` + `resourceMeta` + `provider`

#### 5.6. Update Backfill State Helpers

**File**: `api/console/src/inngest/workflow/backfill/backfill-state.ts`

**`updateBackfillState`** (line 32-46):
- Change from: `jsonb_set(sourceConfig, '{backfill}', ...)`
- Change to: `db.update(workspaceIntegrations).set({ backfillState: { ... } })`
- Direct column update instead of JSONB path manipulation

**`updateBackfillCheckpoint`** (line 52-66):
- Same: direct column update on `backfillState`
- Read current `backfillState`, merge checkpoint, write back

#### 5.7. Update Backfill Orchestrator

**File**: `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`

**`onFailure` handler** (line 48-60):
- Change from: `integration.sourceConfig.backfill`
- Change to: `integration.backfillState`

**Step `"validate-integration"`** (line 102-119):
- Change from: `result.sourceConfig`
- Change to: construct config from `syncConfig` + `resourceMeta` + `backfillState`

#### 5.8. Update Backfill Router

**File**: `api/console/src/router/org/backfill.ts`

**`backfill.start`** (line 57-157):
- Change from: `sourceConfig.backfill`, `sourceConfig.sourceType`
- Change to: `backfillState`, `provider`

**`backfill.status`** (line 165-218):
- Change from: `sourceConfig.backfill`
- Change to: `backfillState` directly

**`backfill.cancel`** (line 226-297):
- Change from: `jsonb_set` on `sourceConfig.backfill`
- Change to: direct `backfillState` update

#### 5.9. Update Backfill Connectors

**File**: `packages/console-backfill/src/connectors/github.ts` (line 43-45)
- Change from: `sourceConfig.installationId`, `sourceConfig.repoFullName`
- Change to: `resourceMeta.installationId`, `resourceMeta.repoFullName`

**File**: `packages/console-backfill/src/connectors/vercel.ts` (line 34-36, 71-73)
- Change from: `sourceConfig.projectId`, `sourceConfig.teamId`, `sourceConfig.projectName`
- Change to: `resourceMeta.projectId`, `resourceMeta.teamId`, `resourceMeta.projectName`

**File**: `packages/console-backfill/src/types.ts`
- Update `BackfillConfig.sourceConfig` type to `BackfillConfig.resourceMeta` with proper typing

#### 5.10. Update M2M Sources Router

**File**: `api/console/src/router/m2m/sources.ts`

All 7 procedures need updating:

| Procedure | sourceConfig Change |
|-----------|-------------------|
| `findByGithubRepoId` | `.sourceConfig.sourceType` → `.provider` |
| `getSourceIdByGithubRepoId` | `.sourceConfig.sourceType` → `.provider` |
| `updateGithubSyncStatus` | No change (doesn't read sourceConfig) |
| `updateGithubConfigStatus` | Spread `sourceConfig` + `status` → update `syncConfig` directly |
| `markGithubInstallationInactive` | `.sourceConfig.installationId` → `.resourceMeta.installationId` |
| `markGithubDeleted` | Spread config + `isArchived` → update `resourceMeta` directly |
| `updateGithubMetadata` | Merge provider fields → update `resourceMeta` directly |

#### 5.11. Update Workspace Sources List

**File**: `api/console/src/router/org/workspace.ts`

**`sources.list`** (line 566-631):
- Change from: `sourceConfig.sourceType`, `sourceConfig.repoFullName`
- Change to: `provider`, `resourceName`

#### 5.12. Update Events Mutation

**File**: `api/console/src/router/org/workspace.ts`

**`integrations.updateEvents`** (line 1063-1109):
- Change from: spread `sourceConfig`, replace `sync.events`
- Change to: update `syncConfig.events` directly

#### 5.13. Update Jobs Router

**File**: `api/console/src/router/org/jobs.ts`

**`jobs.restart`** (line 445-471):
- Change from: `source.sourceConfig.sourceType`
- Change to: `source.provider`

#### 5.14. Update User Workspace Router

**File**: `api/console/src/router/user/workspace.ts`

**`workspaceAccess.create`** (line 199-260):
- Idempotency check: change from `sourceConfig.sourceType === "github"` to `provider === "github"`
- Write path: use `syncConfig` + `resourceMeta` instead of `sourceConfig`

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build:console` compiles with zero `sourceConfig` references in non-schema files
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `grep -r "sourceConfig" api/console/src/` returns no results (except possibly types/validation that haven't been cleaned up)

#### Manual Verification:
- [ ] Observation capture correctly filters events via `syncConfig.events`
- [ ] Backfill workflow reads/writes `backfillState` correctly (start → running → checkpoint → completed)
- [ ] Push handler reads `syncConfig.events` and `syncConfig.configStatus`
- [ ] M2M sources router updates `resourceMeta` fields correctly on GitHub metadata changes
- [ ] Sources list page shows correct provider and resource names from denormalized columns

**Implementation Note**: This phase touches the most files. Implement in order: write paths first (bulk link mutations), then Inngest workflows, then M2M router, then read-only queries. Test each subsystem individually.

---

## Phase 6: Client-Side Refactor

### Overview

Update the Console UI to use Gateway OAuth URLs and query `gw_installations` directly for connection status. Replace provider-specific connectors with a unified flow. This corresponds to the original plan's Phase 7 but is simplified by the DB consolidation.

### Changes Required

#### 6.1. New tRPC Connections Router

**File**: `api/console/src/router/user/connections.ts` (NEW)

```typescript
export const connectionsRouter = router({
  // Get Gateway authorize URL for a provider
  getAuthorizeUrl: orgScopedProcedure
    .input(z.object({ provider: z.enum(["github", "vercel", "linear", "sentry"]) }))
    .query(async ({ ctx, input }) => {
      // Build Gateway authorize URL with org context
      const params = new URLSearchParams({
        orgId: ctx.auth.orgId!,
        connectedBy: ctx.auth.userId,
      });
      return {
        url: `${gatewayUrl}/connections/${input.provider}/authorize?${params}`,
      };
    }),

  // List all connections for the current org
  list: orgScopedProcedure
    .query(async ({ ctx }) => {
      return db.query.gwInstallations.findMany({
        where: and(
          eq(gwInstallations.orgId, ctx.auth.orgId!),
          eq(gwInstallations.status, "active"),
        ),
      });
    }),

  // Get connection details for a specific provider
  getByProvider: orgScopedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.query.gwInstallations.findFirst({
        where: and(
          eq(gwInstallations.orgId, ctx.auth.orgId!),
          eq(gwInstallations.provider, input.provider),
          eq(gwInstallations.status, "active"),
        ),
        with: { resources: true },
      });
    }),

  // Disconnect a provider
  disconnect: orgScopedProcedure
    .input(z.object({ installationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Mark installation as revoked
      await db.update(gwInstallations)
        .set({ status: "revoked", updatedAt: new Date().toISOString() })
        .where(and(
          eq(gwInstallations.id, input.installationId),
          eq(gwInstallations.orgId, ctx.auth.orgId!),
        ));

      // Cascade: deactivate all workspace integrations
      await db.update(workspaceIntegrations)
        .set({ isActive: false })
        .where(eq(workspaceIntegrations.installationId, input.installationId));
    }),
});
```

#### 6.2. `useConnection` Hook

**File**: `apps/console/src/hooks/use-connection.ts` (NEW)

```typescript
function useConnection(provider: ProviderName) {
  const { data: connection } = trpc.connections.getByProvider.useQuery({ provider });
  const { data: authorizeUrl } = trpc.connections.getAuthorizeUrl.useQuery({ provider });
  const disconnect = trpc.connections.disconnect.useMutation();
  const utils = trpc.useUtils();

  const connect = useCallback(() => {
    if (!authorizeUrl?.url) return;
    const popup = window.open(authorizeUrl.url, "_blank", "width=600,height=700");

    // Poll for popup close
    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval);
        utils.connections.getByProvider.invalidate({ provider });
        utils.connections.list.invalidate();
      }
    }, 500);
  }, [authorizeUrl?.url, provider]);

  return {
    status: connection ? "connected" : "disconnected",
    connection,
    connect,
    disconnect: () => disconnect.mutate({ installationId: connection!.id }),
  };
}
```

#### 6.3. Gateway Callback Redirect

**File**: `apps/gateway/src/routes/connections.ts`

After OAuth callback creates the installation, redirect to Console connected page instead of returning JSON:

For GitHub:
```typescript
return c.redirect(`${consoleUrl}/connected?provider=github&installationId=${installation.id}`);
```

For other providers:
```typescript
return c.redirect(`${consoleUrl}/connected?provider=${provider.name}&installationId=${installation.id}`);
```

#### 6.4. Generic Connected Page

**File**: `apps/console/src/app/(app)/connected/page.tsx` (NEW)

```tsx
export default function ConnectedPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    window.opener?.postMessage({
      type: "connection_complete",
      provider: params.get("provider"),
      installationId: params.get("installationId"),
    });
    setTimeout(() => window.close(), 1500);
  }, []);

  return <div>Connected! This window will close automatically.</div>;
}
```

#### 6.5. Simplified Connect Page

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/connect/page.tsx`

Replace `ConnectFormProvider` + provider-specific connectors with a generic `ProviderConnector` that uses `useConnection`:

- Remove `ConnectFormProvider` wrapper
- Replace `GitHubConnector` / `VercelConnector` with generic connectors using `useConnection(provider)`
- Add real Linear and Sentry connector UIs (replace "coming soon" placeholders)

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build:console` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] GitHub connect flow: click Connect → popup → GitHub auth → popup closes → connection visible
- [ ] Vercel connect flow: click Connect → popup → Vercel auth → popup closes → connection visible
- [ ] Linear connect flow works (new provider)
- [ ] Sentry connect flow works (new provider)
- [ ] Resource selection and linking works for all providers
- [ ] Disconnect flow works: click Disconnect → connection removed → integrations deactivated
- [ ] InstalledSources page shows connections from all providers

**Implementation Note**: Test each provider end-to-end before moving to the next. Pause for comprehensive UI testing.

---

## Phase 7: Route & Package Cleanup

### Overview

Remove old OAuth routes, webhook routes, and packages that are now handled by the Gateway or replaced by direct DB access. Delete the `userSources` table and `sourceConfig` column.

### Changes Required

#### 7.1. Remove Old Webhook Routes

**Delete files**:
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` (~609 lines)
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` (~223 lines)

#### 7.2. Remove Old OAuth Routes

**Delete files**:
- `apps/console/src/app/(github)/api/github/install-app/route.ts`
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts`
- `apps/console/src/app/(github)/api/github/app-installed/route.ts`
- `apps/console/src/app/(github)/api/github/user-authorized/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/callback/route.ts`

#### 7.3. Remove Old Connected Pages

**Delete files** (replaced by generic `/connected` page from Phase 6.4):
- `apps/console/src/app/(github)/github/connected/page.tsx`
- `apps/console/src/app/(vercel)/vercel/connected/page.tsx`

If `(github)` and `(vercel)` route groups are empty, delete the directories.

#### 7.4. Remove/Simplify Packages

- **`@repo/console-oauth`**: Delete entirely. State management, token encryption, and PKCE are now handled by Gateway.
- **`@repo/console-webhooks`**: Remove verification modules (`common.ts:safeCompareSignatures/computeHmac*`, `github.ts:verifyGitHubWebhook*`, `vercel.ts:verifyVercelWebhook*`). Keep transformers and storage.

#### 7.5. Delete `@db/gateway` Package

**Delete directory**: `db/gateway/`

Remove from:
- `pnpm-workspace.yaml` (if explicitly listed)
- Root `turbo.json` build pipeline (if any gateway-specific entries)

#### 7.6. Drop Deprecated Schema Columns

**File**: `db/console/src/schema/tables/workspace-integrations.ts`

Remove columns:
- `userSourceId` (replaced by `installationId`)
- `gatewayInstallationId` (replaced by `installationId`)
- `sourceConfig` (replaced by `syncConfig` + `backfillState` + `resourceMeta`)

Remove the old `userSources` import and FK reference.

**File**: `db/console/src/schema/tables/user-sources.ts`

**DELETE this entire file**. The `userSources` table is no longer needed.

Update barrel exports in `db/console/src/schema/tables/index.ts` to remove `userSources`.

Generate migration: `cd db/console && pnpm db:generate`

This migration will DROP the `lightfast_user_sources` table and DROP the old columns from `lightfast_workspace_integrations`.

#### 7.7. Simplify tRPC Routers

**File**: `api/console/src/root.ts`

- Replace or merge `userSourcesRouter` with `connectionsRouter` (from Phase 6.1)
- Remove `storeOAuthResult` procedures (already deleted in Phase 4.3)
- Clean up any remaining references to `userSources`

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build:console` compiles
- [ ] `pnpm build:gateway` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `grep -r "userSources\|user-sources\|user_sources" db/console/src/schema/` returns no results
- [ ] `grep -r "@db/gateway" .` returns no results (outside node_modules)
- [ ] `grep -r "console-oauth" .` returns no results (outside node_modules)
- [ ] `grep -r "sourceConfig" api/console/src/` returns no results

#### Manual Verification:
- [ ] Console app starts and all existing pages load correctly
- [ ] No 404s on any Console routes
- [ ] Sources page shows connected integrations (from `gw_installations`)
- [ ] Connect page works for all providers
- [ ] `cd db/console && pnpm db:studio` confirms `userSources` table is gone

**Implementation Note**: This cleanup should be a separate deployment AFTER Phases 1-6 are confirmed stable. Keep old routes as rollback safety net until confidence is established. Only delete after confirming everything works end-to-end.

---

## Phase 8: Admin Completion & Deployment

### Overview

Complete the remaining Gateway admin features (DLQ replay, delivery status callback) and handle deployment. Corresponds to the original plan's Phases 9 + 10.

### Changes Required

#### 8.1. DLQ Replay Implementation

**File**: `apps/gateway/src/routes/admin.ts` — `POST /admin/dlq/replay`

```typescript
// 1. Query gw_webhook_deliveries by provided deliveryIds WHERE status = 'dlq'
// 2. For each DLQ entry, re-publish to Console ingress via QStash
// 3. Update delivery status to "delivered" on success
// 4. Return { replayed: count, failed: count }
```

Note: Phase 1.4 added a `payload` column to `gwWebhookDeliveries` for storing raw payloads on DLQ entries. The webhook-receipt workflow should be updated to store the payload when moving to DLQ.

#### 8.2. Delivery Status Callback

**File**: `apps/gateway/src/routes/admin.ts` — `POST /admin/delivery-status`

Parse QStash callback body, upsert into `gwWebhookDeliveries` with delivery outcome.

#### 8.3. Deploy Gateway with PlanetScale

- Update Gateway's Vercel project environment variables:
  - Add: `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` (PlanetScale)
  - Remove: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- Verify Node.js Fluid Compute runtime (not Edge)
- Deploy and verify health: `GET /admin/health`

#### 8.4. Run Cache Rebuild

After deployment:
```
POST /admin/cache/rebuild
```
Rebuilds Redis routing cache from PlanetScale `gw_resources`.

#### 8.5. Update Provider Webhook URLs

- **GitHub**: Update GitHub App webhook URL to `gateway.lightfast.ai/webhooks/github`
- **Vercel**: Update Vercel integration webhook URL to `gateway.lightfast.ai/webhooks/vercel`
- **Linear**: Registered automatically during Gateway OAuth (new connections)
- **Sentry**: Registered automatically during Gateway OAuth (new connections)

#### 8.6. Update OAuth Redirect URLs

- **GitHub**: Update GitHub App callback URL to `gateway.lightfast.ai/connections/github/callback`
- **Vercel**: Update Vercel integration redirect URI to `gateway.lightfast.ai/connections/vercel/callback`
- **Linear**: Register `gateway.lightfast.ai/connections/linear/callback` in Linear app settings
- **Sentry**: Register `gateway.lightfast.ai/connections/sentry/callback` in Sentry integration settings

#### 8.7. End-to-End Verification

- Push a commit to a connected GitHub repository → verify observation appears in Console
- Deploy on Vercel → verify deployment event appears in Console
- Run a backfill → verify it uses direct DB token access
- Disconnect and reconnect a source → verify full lifecycle
- Connect Linear (new) → verify observation capture works
- Connect Sentry (new) → verify observation capture works

### Rollback Plan

If Gateway fails in production:
1. Revert Gateway to Turso + edge runtime (redeploy from git history)
2. Restore old Console webhook/OAuth routes from Phase 7 cleanup commit
3. Phase 7 cleanup should be a **separate deployment** after Gateway is confirmed stable

### Success Criteria

#### Automated Verification:
- [ ] `pnpm build:console` compiles
- [ ] `pnpm build:gateway` compiles
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Gateway health endpoint returns healthy with PlanetScale connection
- [ ] All 4 provider OAuth flows work end-to-end
- [ ] Webhook receipt pipeline works for all providers
- [ ] Backfill works with direct DB token access
- [ ] DLQ replay works
- [ ] Full lifecycle: connect → link resources → receive webhooks → observe → disconnect

---

## Testing Strategy

### Unit Tests

- `api/console/src/lib/token-vault.ts` — test decrypt with mock DB
- Schema validation — verify `syncConfig`, `backfillState`, `resourceMeta` types
- New `connectionsRouter` procedures — test authorization and DB queries

### Integration Tests

- Gateway OAuth callback → PlanetScale `gw_installations` row created
- Token vault endpoint → reads from PlanetScale `gw_tokens`
- Console reads `gw_installations` directly (no HTTP client)
- Backfill workflow → reads token from `gw_tokens`, not `userSources`
- Observation capture → checks `syncConfig.events` from `workspaceIntegrations`
- Webhook ingress → uses `providerResourceId` + `gw_resources` for resolution

### Manual Testing Steps

1. Connect GitHub via new OAuth popup flow
2. Verify `gw_installations` row in DB Studio
3. Link a repository to a workspace
4. Verify `workspaceIntegrations` row with `installationId` FK
5. Push to the linked repository
6. Verify observation appears in Console
7. Run a backfill, verify it completes
8. Disconnect the connection
9. Verify integrations are deactivated
10. Repeat for Vercel, Linear, Sentry

## Performance Considerations

- **Token access**: Was HTTP round-trip (~100ms), now single DB query + decrypt (~5ms). Significant improvement.
- **Connection status**: Was QStash notification + sync endpoint (~2-5s), now immediate (same DB). Popup closing is faster.
- **Joins**: `workspaceIntegrations → gwInstallations` is a real FK join in PlanetScale. Index on `installationId` ensures fast lookups.
- **Gateway cold starts**: Edge ~50ms → Node.js Fluid Compute ~115ms. Acceptable for webhook/OAuth endpoints.
- **Redis routing cache**: Unchanged. Still used for webhook-receipt → resource → installation resolution for sub-50ms webhook ACK.

## Migration Notes

- **Pre-production**: No user data migration needed. Clean schema cut.
- **Environment variables**: Gateway needs PlanetScale credentials (`DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`) + `ENCRYPTION_KEY` shared between Gateway and Console
- **Console needs `ENCRYPTION_KEY`**: For `token-vault.ts` to decrypt tokens from `gw_tokens`. This env var currently only exists in Gateway's environment.
- **Turso cleanup**: After successful deployment, decommission the Turso database (delete from Turso dashboard)

## References

- Research: `thoughts/shared/research/2026-02-25-console-db-architecture-gateway-integration.md`
- Prior plan: `thoughts/shared/plans/2026-02-25-connection-manager-implementation.md`
- Gateway Turso plan: `thoughts/shared/plans/2026-02-25-gateway-turso-connections.md`
- Console DB schema: `db/console/src/schema/tables/`
- Gateway DB schema: `db/gateway/src/schema/tables/`
- Gateway routes: `apps/gateway/src/routes/connections.ts`
- Token consumers: `api/console/src/router/user/user-sources.ts`, `api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts`
- M2M sources: `api/console/src/router/m2m/sources.ts`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- Push handler: `api/console/src/inngest/workflow/providers/github/push-handler.ts`
- Backfill state: `api/console/src/inngest/workflow/backfill/backfill-state.ts`
- Auth middleware: `packages/console-auth-middleware/src/resources.ts`
