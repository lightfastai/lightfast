# Developer Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build org-owned Developer Connections for PlanetScale, Upstash, Sentry, and Clerk, with admin-managed provider credentials and short actor-bound sandbox leases.

**Architecture:** Add a dedicated contract package, DB tables/helpers, API service/router, and workspace UI page separate from MCP Connectors. Store encrypted provider credentials in the current repo pattern, issue persisted lease records with no credential payload, and expose a materialization service boundary for the Lightfast-controlled sandbox runner.

**Tech Stack:** pnpm workspace packages, Zod, Drizzle MySQL/Vitess, `@repo/app-encryption`, tRPC, Next.js App Router, React Query, Vitest, existing `@repo/ui` components.

---

## File Structure

- Create `packages/developer-connection-contract/package.json`
  - New internal contract package for provider ids, catalog metadata, status enums, and tRPC input schemas.
- Create `packages/developer-connection-contract/tsconfig.json`
  - Standard package TypeScript config.
- Create `packages/developer-connection-contract/vitest.config.ts`
  - Standard package Vitest config.
- Create `packages/developer-connection-contract/src/index.ts`
  - Owns provider enum, catalog, connection status, credential kind, lease status, and input schemas.
- Create `packages/developer-connection-contract/src/__tests__/developer-connection-contract.test.ts`
  - Verifies the catalog and schemas.
- Modify `db/app/package.json`
  - Add `@repo/developer-connection-contract`.
- Create `db/app/src/schema/tables/developer-connections.ts`
  - Owns `lightfast_org_developer_connections`, `lightfast_developer_connection_leases`, id prefixes, and row types.
- Modify `db/app/src/schema/tables/index.ts`
  - Re-export new schema objects and types.
- Modify `db/app/src/index.ts`
  - Re-export new schema objects and DB helper APIs.
- Create `db/app/src/utils/developer-connections.ts`
  - Owns current connection helpers, replacement/revoke behavior, sandbox enablement, status transitions, and lease lifecycle helpers.
- Create `db/app/src/__tests__/developer-connections.test.ts`
  - DB schema/helper tests.
- Modify `api/app/package.json`
  - Add `@repo/developer-connection-contract`.
- Modify `api/app/src/env.ts`
  - Add optional Developer Auth Box origin/token env fields for Sentry device-code OAuth.
- Modify `apps/app/turbo.json`
  - Pass Developer Auth Box env fields through the app build task.
- Create `api/app/src/services/developer-connections/catalog.ts`
  - Shapes catalog rows for UI.
- Create `api/app/src/services/developer-connections/credentials.ts`
  - Encrypts/decrypts provider credential payloads and redacts secrets.
- Create `api/app/src/services/developer-connections/adapters.ts`
  - Provider adapter registry, manual credential normalization, and materialization payloads.
- Create `api/app/src/services/developer-connections/auth-box.ts`
  - Sentry device-code auth-box client interface plus the default HTTP client used by the API service.
- Create `api/app/src/services/developer-connections/leases.ts`
  - Issues/revokes leases and returns sandbox materialization payloads.
- Create `api/app/src/services/developer-connections/index.ts`
  - Service entrypoint for router calls.
- Create `api/app/src/router/(pending-not-allowed)/developer-connections.ts`
  - tRPC router under `org.workspace.developerConnections`.
- Modify `api/app/src/root.ts`
  - Mount developer connections router.
- Create `api/app/src/__tests__/developer-connections-service.test.ts`
  - Service tests for list/connect/enable/disconnect/lease behavior.
- Create `api/app/src/__tests__/developer-connections-router.test.ts`
  - Permission and router dispatch tests.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/page.tsx`
  - Server page that prefetches Developer Connections list.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connections-client.tsx`
  - Search/filter catalog UI, connected/available cards, dialogs, and mutations.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connection-detail-sheet.tsx`
  - Safe connection detail sheet.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connection-icons.tsx`
  - Provider icon mapping.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connections-model.ts`
  - UI model helpers for status labels and provider display names.
- Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/developer-connections-page.test.tsx`
  - Page/client behavior tests modeled after connectors page tests.
- Modify `apps/app/src/components/app-sidebar.tsx`
  - Add Developer Connections to workspace nav near Connectors.
- Modify `apps/app/src/__tests__/components/app-sidebar.test.tsx`
  - Cover nav item and active state.
- Generate Drizzle migration with `pnpm db:generate`
  - Do not write manual SQL.

---

### Task 1: Add Developer Connection Contract Package

**Files:**
- Create: `packages/developer-connection-contract/package.json`
- Create: `packages/developer-connection-contract/tsconfig.json`
- Create: `packages/developer-connection-contract/vitest.config.ts`
- Create: `packages/developer-connection-contract/src/index.ts`
- Create: `packages/developer-connection-contract/src/__tests__/developer-connection-contract.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `packages/developer-connection-contract/src/__tests__/developer-connection-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEVELOPER_CONNECTION_CATALOG,
  DEVELOPER_CONNECTION_PROVIDERS,
  developerConnectionCompleteAuthInputSchema,
  developerConnectionConnectInputSchema,
  developerConnectionIssueLeaseInputSchema,
  developerConnectionProviderInputSchema,
  developerConnectionStartAuthInputSchema,
  developerConnectionSetSandboxEnabledInputSchema,
} from "../index";

describe("@repo/developer-connection-contract", () => {
  it("defines the v1 provider catalog", () => {
    expect(DEVELOPER_CONNECTION_PROVIDERS).toEqual([
      "pscale",
      "upstash",
      "sentry",
      "clerk",
    ]);
    expect(DEVELOPER_CONNECTION_CATALOG.map((entry) => entry.provider)).toEqual(
      ["pscale", "upstash", "sentry", "clerk"]
    );
    expect(
      DEVELOPER_CONNECTION_CATALOG.every(
        (entry) => entry.builder === "Lightfast"
      )
    ).toBe(true);
  });

  it("validates provider input", () => {
    expect(
      developerConnectionProviderInputSchema.parse({ provider: "sentry" })
    ).toEqual({ provider: "sentry" });
    expect(() =>
      developerConnectionProviderInputSchema.parse({ provider: "vercel" })
    ).toThrow();
  });

  it("validates manual connect input per provider", () => {
    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "pscale",
        serviceTokenId: "token-id",
        serviceToken: "token-secret",
        providerAccountName: "lightfast/main",
      })
    ).toMatchObject({ provider: "pscale" });

    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "upstash",
        email: "dev@example.com",
        apiKey: "upstash-key",
        providerAccountName: "Lightfast Upstash",
      })
    ).toMatchObject({ provider: "upstash" });

    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "sentry",
        token: "sentry-token",
        providerAccountName: "lightfast/app",
      })
    ).toMatchObject({ provider: "sentry" });

    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "clerk",
        appId: "app_123",
        instanceId: "dev",
        secretKey: "sk_test_123",
        providerAccountName: "Lightfast dev",
      })
    ).toMatchObject({ provider: "clerk" });
  });

  it("validates Sentry device-code auth inputs", () => {
    expect(
      developerConnectionStartAuthInputSchema.parse({
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).toEqual({
      provider: "sentry",
      providerAccountName: "lightfast/app",
    });

    expect(
      developerConnectionCompleteAuthInputSchema.parse({
        provider: "sentry",
        attemptId: "auth_attempt_123",
      })
    ).toEqual({
      provider: "sentry",
      attemptId: "auth_attempt_123",
    });

    expect(() =>
      developerConnectionStartAuthInputSchema.parse({
        provider: "clerk",
        providerAccountName: "Lightfast dev",
      })
    ).toThrow();
  });

  it("validates sandbox enablement input", () => {
    expect(
      developerConnectionSetSandboxEnabledInputSchema.parse({
        provider: "pscale",
        enabled: false,
      })
    ).toEqual({ provider: "pscale", enabled: false });
  });

  it("validates lease requests with explicit providers and bounded ids", () => {
    expect(
      developerConnectionIssueLeaseInputSchema.parse({
        providers: ["pscale", "sentry"],
        sandboxRunId: "sandbox_run_123",
        workflowRunId: "workflow_run_123",
      })
    ).toEqual({
      providers: ["pscale", "sentry"],
      sandboxRunId: "sandbox_run_123",
      workflowRunId: "workflow_run_123",
    });

    expect(() =>
      developerConnectionIssueLeaseInputSchema.parse({
        providers: [],
        sandboxRunId: "sandbox_run_123",
        workflowRunId: "workflow_run_123",
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
pnpm --filter @repo/developer-connection-contract test
```

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Create package metadata**

Create `packages/developer-connection-contract/package.json`:

```json
{
  "name": "@repo/developer-connection-contract",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Create `packages/developer-connection-contract/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/developer-connection-contract/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 4: Implement the contract exports**

Create `packages/developer-connection-contract/src/index.ts`:

```ts
import { z } from "zod";

export const DEVELOPER_CONNECTION_PROVIDERS = [
  "pscale",
  "upstash",
  "sentry",
  "clerk",
] as const;
export const developerConnectionProviderSchema = z.enum(
  DEVELOPER_CONNECTION_PROVIDERS
);
export type DeveloperConnectionProvider = z.infer<
  typeof developerConnectionProviderSchema
>;

export const developerConnectionStatusSchema = z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "replaced",
]);
export type DeveloperConnectionStatus = z.infer<
  typeof developerConnectionStatusSchema
>;

export const developerConnectionCredentialKindSchema = z.enum([
  "pscale_service_token",
  "upstash_management_key",
  "sentry_token",
  "sentry_oauth_token",
  "clerk_instance_secret",
]);
export type DeveloperConnectionCredentialKind = z.infer<
  typeof developerConnectionCredentialKindSchema
>;

export const developerConnectionLeaseStatusSchema = z.enum([
  "issued",
  "materialized",
  "revoked",
  "expired",
  "failed",
]);
export type DeveloperConnectionLeaseStatus = z.infer<
  typeof developerConnectionLeaseStatusSchema
>;

export const developerConnectionCatalogStatusSchema = z.enum([
  "available",
  "coming_soon",
]);
export type DeveloperConnectionCatalogStatus = z.infer<
  typeof developerConnectionCatalogStatusSchema
>;

export const developerConnectionUnavailableReasonSchema = z.enum([
  "coming_soon",
  "permission_required",
]);
export type DeveloperConnectionUnavailableReason = z.infer<
  typeof developerConnectionUnavailableReasonSchema
>;

export const DEVELOPER_CONNECTION_CATALOG = [
  {
    provider: "pscale",
    displayName: "PlanetScale",
    description: "Provision and inspect PlanetScale development databases.",
    builder: "Lightfast",
    category: "Database",
    catalogStatus: "available",
  },
  {
    provider: "upstash",
    displayName: "Upstash",
    description: "Provision and inspect Upstash Redis development resources.",
    builder: "Lightfast",
    category: "Infrastructure",
    catalogStatus: "available",
  },
  {
    provider: "sentry",
    displayName: "Sentry",
    description: "Inspect Sentry issues and manage release artifacts.",
    builder: "Lightfast",
    category: "Observability",
    catalogStatus: "available",
  },
  {
    provider: "clerk",
    displayName: "Clerk",
    description: "Inspect and manage a connected Clerk instance.",
    builder: "Lightfast",
    category: "Authentication",
    catalogStatus: "available",
  },
] as const satisfies ReadonlyArray<{
  provider: DeveloperConnectionProvider;
  displayName: string;
  description: string;
  builder: "Lightfast";
  category: string;
  catalogStatus: DeveloperConnectionCatalogStatus;
}>;

export const developerConnectionProviderInputSchema = z.object({
  provider: developerConnectionProviderSchema,
});

const providerAccountNameSchema = z.string().trim().min(1).max(128);

export const developerConnectionConnectInputSchema = z.discriminatedUnion(
  "provider",
  [
    z.object({
      provider: z.literal("pscale"),
      providerAccountName: providerAccountNameSchema,
      serviceTokenId: z.string().trim().min(1),
      serviceToken: z.string().trim().min(1),
    }),
    z.object({
      provider: z.literal("upstash"),
      providerAccountName: providerAccountNameSchema,
      email: z.string().trim().email(),
      apiKey: z.string().trim().min(1),
    }),
    z.object({
      provider: z.literal("sentry"),
      providerAccountName: providerAccountNameSchema,
      token: z.string().trim().min(1),
    }),
    z.object({
      provider: z.literal("clerk"),
      providerAccountName: providerAccountNameSchema,
      appId: z.string().trim().min(1),
      instanceId: z.string().trim().min(1),
      secretKey: z.string().trim().min(1),
    }),
  ]
);
export type DeveloperConnectionConnectInput = z.infer<
  typeof developerConnectionConnectInputSchema
>;

export const developerConnectionStartAuthInputSchema = z.object({
  provider: z.literal("sentry"),
  providerAccountName: providerAccountNameSchema,
});
export type DeveloperConnectionStartAuthInput = z.infer<
  typeof developerConnectionStartAuthInputSchema
>;

export const developerConnectionCompleteAuthInputSchema = z.object({
  provider: z.literal("sentry"),
  attemptId: z.string().trim().min(1).max(128),
});
export type DeveloperConnectionCompleteAuthInput = z.infer<
  typeof developerConnectionCompleteAuthInputSchema
>;

export const developerConnectionSetSandboxEnabledInputSchema = z.object({
  provider: developerConnectionProviderSchema,
  enabled: z.boolean(),
});
export type DeveloperConnectionSetSandboxEnabledInput = z.infer<
  typeof developerConnectionSetSandboxEnabledInputSchema
>;

export const developerConnectionIssueLeaseInputSchema = z.object({
  providers: z.array(developerConnectionProviderSchema).min(1),
  sandboxRunId: z.string().trim().min(1).max(128),
  workflowRunId: z.string().trim().min(1).max(128),
});
export type DeveloperConnectionIssueLeaseInput = z.infer<
  typeof developerConnectionIssueLeaseInputSchema
>;
```

- [ ] **Step 5: Install workspace links and run the contract test**

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @repo/developer-connection-contract test
pnpm --filter @repo/developer-connection-contract typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml packages/developer-connection-contract
git commit -m "feat: add developer connection contract"
```

---

### Task 2: Add Developer Connection DB Schema

**Files:**
- Modify: `db/app/package.json`
- Create: `db/app/src/schema/tables/developer-connections.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/index.ts`
- Test: `db/app/src/__tests__/developer-connections.test.ts`

- [ ] **Step 1: Add the DB package dependency**

Update `db/app/package.json` dependencies:

```json
"@repo/developer-connection-contract": "workspace:*"
```

- [ ] **Step 2: Write the failing schema test**

Create `db/app/src/__tests__/developer-connections.test.ts` with the schema tests first:

```ts
import { describe, expect, it } from "vitest";
import {
  createDeveloperConnectionId,
  createDeveloperConnectionLeaseId,
  DEVELOPER_CONNECTION_ID_PREFIX,
  DEVELOPER_CONNECTION_LEASE_ID_PREFIX,
  developerConnectionLeases,
  developerConnections,
} from "../schema";

describe("developer connection schema", () => {
  it("creates public ids with stable prefixes", () => {
    expect(createDeveloperConnectionId()).toMatch(
      /^developer_connection_[0-9a-f-]{36}$/
    );
    expect(createDeveloperConnectionLeaseId()).toMatch(
      /^developer_connection_lease_[0-9a-f-]{36}$/
    );
    expect(DEVELOPER_CONNECTION_ID_PREFIX).toBe("developer_connection_");
    expect(DEVELOPER_CONNECTION_LEASE_ID_PREFIX).toBe(
      "developer_connection_lease_"
    );
  });

  it("exports the current connection fields required by the service", () => {
    expect(developerConnections.clerkOrgId.notNull).toBe(true);
    expect(developerConnections.currentOrgProviderKey.notNull).toBe(false);
    expect(developerConnections.provider.notNull).toBe(true);
    expect(developerConnections.status.notNull).toBe(true);
    expect(developerConnections.enabledForSandboxes.notNull).toBe(true);
    expect(developerConnections.encryptedCredential.notNull).toBe(false);
    expect(developerConnections.lastUsedAt.notNull).toBe(false);
    expect(developerConnections.lastUsedByUserId.notNull).toBe(false);
    expect(developerConnections.revokedAt.notNull).toBe(false);
  });

  it("exports lease rows without credential payload fields", () => {
    expect(developerConnectionLeases.clerkOrgId.notNull).toBe(true);
    expect(developerConnectionLeases.actorUserId.notNull).toBe(true);
    expect(developerConnectionLeases.provider.notNull).toBe(true);
    expect(developerConnectionLeases.status.notNull).toBe(true);
    expect(developerConnectionLeases.expiresAt.notNull).toBe(true);
    expect("encryptedCredential" in developerConnectionLeases).toBe(false);
  });
});
```

- [ ] **Step 3: Run the schema test to verify it fails**

Run:

```bash
pnpm --filter @db/app test -- developer-connections.test.ts
```

Expected: FAIL because the schema exports do not exist.

- [ ] **Step 4: Create the schema tables**

Create `db/app/src/schema/tables/developer-connections.ts`:

```ts
import { randomUUID } from "node:crypto";
import type {
  DeveloperConnectionCredentialKind,
  DeveloperConnectionLeaseStatus,
  DeveloperConnectionProvider,
  DeveloperConnectionStatus,
} from "@repo/developer-connection-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const DEVELOPER_CONNECTION_ID_PREFIX = "developer_connection_";
export const DEVELOPER_CONNECTION_LEASE_ID_PREFIX =
  "developer_connection_lease_";

const PUBLIC_ID_LENGTH = 96;
const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const CURRENT_KEY_LENGTH = CLERK_ID_LENGTH + 1 + CODE_LENGTH;

export function createDeveloperConnectionId() {
  return `${DEVELOPER_CONNECTION_ID_PREFIX}${randomUUID()}`;
}

export function createDeveloperConnectionLeaseId() {
  return `${DEVELOPER_CONNECTION_LEASE_ID_PREFIX}${randomUUID()}`;
}

export const developerConnections = mysqlTable(
  "lightfast_org_developer_connections",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperConnectionId),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    currentOrgProviderKey: varchar("current_org_provider_key", {
      length: CURRENT_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<DeveloperConnectionProvider>()
      .notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerAccountName: varchar("provider_account_name", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperConnectionStatus>()
      .notNull(),
    enabledForSandboxes: boolean("enabled_for_sandboxes")
      .default(true)
      .notNull(),
    credentialKind: varchar("credential_kind", { length: CODE_LENGTH })
      .$type<DeveloperConnectionCredentialKind>()
      .notNull(),
    credentialSchemaVersion: varchar("credential_schema_version", {
      length: CODE_LENGTH,
    }).notNull(),
    encryptedCredential: text("encrypted_credential"),
    scopes: json("scopes").$type<string[]>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }),
    lastVerifiedAt: timestamp("last_verified_at", { mode: "date", fsp: 3 }),
    lastUsedAt: timestamp("last_used_at", { mode: "date", fsp: 3 }),
    lastUsedByUserId: varchar("last_used_by_user_id", {
      length: CLERK_ID_LENGTH,
    }),
    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    updatedByUserId: varchar("updated_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("developer_connections_public_id_uq").on(
      table.publicId
    ),
    currentOrgProviderUq: uniqueIndex(
      "developer_connections_current_org_provider_uq"
    ).on(table.currentOrgProviderKey),
    orgProviderStatusIdx: index(
      "developer_connections_org_provider_status_idx"
    ).on(table.clerkOrgId, table.provider, table.status),
  })
);

export const developerConnectionLeases = mysqlTable(
  "lightfast_developer_connection_leases",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperConnectionLeaseId),
    connectionId: bigint("connection_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    actorUserId: varchar("actor_user_id", { length: CLERK_ID_LENGTH }).notNull(),
    sandboxRunId: varchar("sandbox_run_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    workflowRunId: varchar("workflow_run_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<DeveloperConnectionProvider>()
      .notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperConnectionLeaseStatus>()
      .notNull(),
    requestedAt: timestamp("requested_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    issuedAt: timestamp("issued_at", { mode: "date", fsp: 3 }).notNull(),
    materializedAt: timestamp("materialized_at", { mode: "date", fsp: 3 }),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),
    failureCode: varchar("failure_code", { length: CODE_LENGTH }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("developer_connection_leases_public_id_uq").on(
      table.publicId
    ),
    orgActorStatusIdx: index("developer_connection_leases_org_actor_idx").on(
      table.clerkOrgId,
      table.actorUserId,
      table.status
    ),
    workflowIdx: index("developer_connection_leases_workflow_idx").on(
      table.workflowRunId,
      table.provider
    ),
  })
);

export type DeveloperConnection = Omit<
  typeof developerConnections.$inferSelect,
  "currentOrgProviderKey"
>;
export type InsertDeveloperConnection =
  typeof developerConnections.$inferInsert;
export type DeveloperConnectionLease =
  typeof developerConnectionLeases.$inferSelect;
export type InsertDeveloperConnectionLease =
  typeof developerConnectionLeases.$inferInsert;
```

- [ ] **Step 5: Export schema symbols**

Add to `db/app/src/schema/tables/index.ts`:

```ts
export {
  createDeveloperConnectionId,
  createDeveloperConnectionLeaseId,
  type DeveloperConnection,
  type DeveloperConnectionLease,
  DEVELOPER_CONNECTION_ID_PREFIX,
  DEVELOPER_CONNECTION_LEASE_ID_PREFIX,
  developerConnectionLeases,
  developerConnections,
  type InsertDeveloperConnection,
  type InsertDeveloperConnectionLease,
} from "./developer-connections";
```

Add the same symbols to the schema re-export block in `db/app/src/index.ts`.

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
pnpm --filter @db/app test -- developer-connections.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/app/package.json db/app/src/schema/tables/developer-connections.ts db/app/src/schema/tables/index.ts db/app/src/index.ts db/app/src/__tests__/developer-connections.test.ts pnpm-lock.yaml
git commit -m "feat: add developer connection schema"
```

---

### Task 3: Add Developer Connection DB Helpers

**Files:**
- Modify: `db/app/src/__tests__/developer-connections.test.ts`
- Create: `db/app/src/utils/developer-connections.ts`
- Modify: `db/app/src/index.ts`

- [ ] **Step 1: Add failing helper tests**

Append to `db/app/src/__tests__/developer-connections.test.ts`:

```ts
import {
  currentDeveloperConnectionKey,
  issueDeveloperConnectionLease,
  markCurrentDeveloperConnectionNeedsReconnect,
  replaceCurrentDeveloperConnection,
  revokeDeveloperConnectionLease,
  setCurrentDeveloperConnectionSandboxEnabled,
} from "../utils/developer-connections";

describe("developer connection helpers", () => {
  it("creates current keys by org and provider", () => {
    expect(currentDeveloperConnectionKey("org_123", "pscale")).toBe(
      "org_123:pscale"
    );
  });

  it("exports helper functions used by services", () => {
    expect(typeof replaceCurrentDeveloperConnection).toBe("function");
    expect(typeof setCurrentDeveloperConnectionSandboxEnabled).toBe("function");
    expect(typeof markCurrentDeveloperConnectionNeedsReconnect).toBe("function");
    expect(typeof issueDeveloperConnectionLease).toBe("function");
    expect(typeof revokeDeveloperConnectionLease).toBe("function");
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
pnpm --filter @db/app test -- developer-connections.test.ts
```

Expected: FAIL because `../utils/developer-connections` does not exist.

- [ ] **Step 3: Implement helper module**

Create `db/app/src/utils/developer-connections.ts`:

```ts
import type {
  DeveloperConnectionCredentialKind,
  DeveloperConnectionProvider,
} from "@repo/developer-connection-contract";
import { and, eq, getTableColumns, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import type { DeveloperConnection, DeveloperConnectionLease } from "../schema";
import { developerConnectionLeases, developerConnections } from "../schema";
import { getRowsAffected } from "./drizzle-results";

const {
  currentOrgProviderKey: _currentOrgProviderKey,
  ...connectionSelection
} = getTableColumns(developerConnections);

const DEFAULT_LEASE_TTL_MS = 15 * 60 * 1000;
const MAX_LEASE_TTL_MS = 30 * 60 * 1000;

export function currentDeveloperConnectionKey(
  clerkOrgId: string,
  provider: DeveloperConnectionProvider
) {
  return `${clerkOrgId}:${provider}`;
}

export async function getCurrentDeveloperConnection(
  db: Database,
  input: { clerkOrgId: string; provider: DeveloperConnectionProvider }
): Promise<DeveloperConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(developerConnections)
    .where(
      eq(
        developerConnections.currentOrgProviderKey,
        currentDeveloperConnectionKey(input.clerkOrgId, input.provider)
      )
    )
    .limit(1);
  return row;
}

export async function listCurrentDeveloperConnections(
  db: Database,
  input: { clerkOrgId: string }
): Promise<DeveloperConnection[]> {
  return await db
    .select(connectionSelection)
    .from(developerConnections)
    .where(
      and(
        eq(developerConnections.clerkOrgId, input.clerkOrgId),
        isNotNull(developerConnections.currentOrgProviderKey)
      )
    );
}

export async function replaceCurrentDeveloperConnection(
  db: Database,
  input: {
    clerkOrgId: string;
    provider: DeveloperConnectionProvider;
    providerAccountId: string | null;
    providerAccountName: string;
    credentialKind: DeveloperConnectionCredentialKind;
    credentialSchemaVersion: string;
    encryptedCredential: string;
    scopes: string[];
    metadata: Record<string, unknown>;
    expiresAt: Date | null;
    actorUserId: string;
    verifiedAt: Date;
  }
): Promise<DeveloperConnection> {
  return await db.transaction(async (tx) => {
    const current = await getCurrentDeveloperConnection(tx, input);
    const now = new Date();

    if (current) {
      await tx
        .update(developerConnections)
        .set({
          currentOrgProviderKey: null,
          encryptedCredential: null,
          status: "replaced",
          revokedAt: now,
          updatedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(eq(developerConnections.id, current.id));
    }

    const [inserted] = await tx
      .insert(developerConnections)
      .values({
        clerkOrgId: input.clerkOrgId,
        currentOrgProviderKey: currentDeveloperConnectionKey(
          input.clerkOrgId,
          input.provider
        ),
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        providerAccountName: input.providerAccountName,
        status: "connected",
        enabledForSandboxes: true,
        credentialKind: input.credentialKind,
        credentialSchemaVersion: input.credentialSchemaVersion,
        encryptedCredential: input.encryptedCredential,
        scopes: input.scopes,
        metadata: input.metadata,
        expiresAt: input.expiresAt,
        lastVerifiedAt: input.verifiedAt,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      })
      .$returningId();

    if (!inserted?.id) {
      throw new Error("Failed to insert developer connection");
    }

    const row = await getDeveloperConnectionById(tx, inserted.id);
    if (!row) {
      throw new Error("Failed to load inserted developer connection");
    }
    return row;
  });
}

export async function getDeveloperConnectionById(
  db: Database,
  id: number
): Promise<DeveloperConnection | undefined> {
  const [row] = await db
    .select(connectionSelection)
    .from(developerConnections)
    .where(eq(developerConnections.id, id))
    .limit(1);
  return row;
}

export async function setCurrentDeveloperConnectionSandboxEnabled(
  db: Database,
  input: {
    clerkOrgId: string;
    provider: DeveloperConnectionProvider;
    enabled: boolean;
    actorUserId: string;
  }
): Promise<DeveloperConnection | undefined> {
  const current = await getCurrentDeveloperConnection(db, input);
  if (!current) {
    return undefined;
  }

  const result = await db
    .update(developerConnections)
    .set({
      enabledForSandboxes: input.enabled,
      updatedAt: new Date(),
      updatedByUserId: input.actorUserId,
    })
    .where(eq(developerConnections.id, current.id));

  if (getRowsAffected(result) === 0) {
    return undefined;
  }
  return await getDeveloperConnectionById(db, current.id);
}

export async function markCurrentDeveloperConnectionNeedsReconnect(
  db: Database,
  input: { clerkOrgId: string; provider: DeveloperConnectionProvider }
): Promise<DeveloperConnection | undefined> {
  const current = await getCurrentDeveloperConnection(db, input);
  if (!current) {
    return undefined;
  }

  const result = await db
    .update(developerConnections)
    .set({ status: "needs_reconnect", updatedAt: new Date() })
    .where(eq(developerConnections.id, current.id));

  if (getRowsAffected(result) === 0) {
    return undefined;
  }
  return await getDeveloperConnectionById(db, current.id);
}

export async function revokeCurrentDeveloperConnection(
  db: Database,
  input: {
    clerkOrgId: string;
    provider: DeveloperConnectionProvider;
    actorUserId: string;
  }
): Promise<DeveloperConnection | undefined> {
  const current = await getCurrentDeveloperConnection(db, input);
  if (!current) {
    return undefined;
  }

  const now = new Date();
  const result = await db
    .update(developerConnections)
    .set({
      currentOrgProviderKey: null,
      encryptedCredential: null,
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
      updatedByUserId: input.actorUserId,
    })
    .where(eq(developerConnections.id, current.id));

  if (getRowsAffected(result) === 0) {
    return undefined;
  }
  return await getDeveloperConnectionById(db, current.id);
}

export function developerConnectionLeaseExpiresAt(
  now: Date,
  requestedTtlMs = DEFAULT_LEASE_TTL_MS
) {
  const ttlMs = Math.min(requestedTtlMs, MAX_LEASE_TTL_MS);
  return new Date(now.getTime() + ttlMs);
}

export async function issueDeveloperConnectionLease(
  db: Database,
  input: {
    connectionId: number;
    clerkOrgId: string;
    actorUserId: string;
    sandboxRunId: string;
    workflowRunId: string;
    provider: DeveloperConnectionProvider;
    issuedAt: Date;
    requestedTtlMs?: number;
  }
): Promise<DeveloperConnectionLease> {
  const [inserted] = await db
    .insert(developerConnectionLeases)
    .values({
      connectionId: input.connectionId,
      clerkOrgId: input.clerkOrgId,
      actorUserId: input.actorUserId,
      sandboxRunId: input.sandboxRunId,
      workflowRunId: input.workflowRunId,
      provider: input.provider,
      status: "issued",
      issuedAt: input.issuedAt,
      expiresAt: developerConnectionLeaseExpiresAt(
        input.issuedAt,
        input.requestedTtlMs
      ),
    })
    .$returningId();

  if (!inserted?.id) {
    throw new Error("Failed to insert developer connection lease");
  }

  const lease = await getDeveloperConnectionLeaseById(db, inserted.id);
  if (!lease) {
    throw new Error("Failed to load inserted developer connection lease");
  }
  return lease;
}

export async function getDeveloperConnectionLeaseById(
  db: Database,
  id: number
): Promise<DeveloperConnectionLease | undefined> {
  const [row] = await db
    .select()
    .from(developerConnectionLeases)
    .where(eq(developerConnectionLeases.id, id))
    .limit(1);
  return row;
}

export async function revokeDeveloperConnectionLease(
  db: Database,
  input: { leaseId: number; revokedAt: Date }
): Promise<DeveloperConnectionLease | undefined> {
  const result = await db
    .update(developerConnectionLeases)
    .set({
      status: "revoked",
      revokedAt: input.revokedAt,
      updatedAt: input.revokedAt,
    })
    .where(eq(developerConnectionLeases.id, input.leaseId));

  if (getRowsAffected(result) === 0) {
    return undefined;
  }
  return await getDeveloperConnectionLeaseById(db, input.leaseId);
}
```

- [ ] **Step 4: Export helper APIs from DB package**

Add to `db/app/src/index.ts`:

```ts
export {
  currentDeveloperConnectionKey,
  developerConnectionLeaseExpiresAt,
  getCurrentDeveloperConnection,
  getDeveloperConnectionById,
  getDeveloperConnectionLeaseById,
  issueDeveloperConnectionLease,
  listCurrentDeveloperConnections,
  markCurrentDeveloperConnectionNeedsReconnect,
  replaceCurrentDeveloperConnection,
  revokeCurrentDeveloperConnection,
  revokeDeveloperConnectionLease,
  setCurrentDeveloperConnectionSandboxEnabled,
} from "./utils/developer-connections";
```

- [ ] **Step 5: Run DB tests and typecheck**

Run:

```bash
pnpm --filter @db/app test -- developer-connections.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/__tests__/developer-connections.test.ts db/app/src/utils/developer-connections.ts db/app/src/index.ts
git commit -m "feat: add developer connection db helpers"
```

---

### Task 4: Add API Service Layer

**Files:**
- Modify: `api/app/package.json`
- Modify: `api/app/src/env.ts`
- Modify: `apps/app/turbo.json`
- Create: `api/app/src/services/developer-connections/catalog.ts`
- Create: `api/app/src/services/developer-connections/credentials.ts`
- Create: `api/app/src/services/developer-connections/adapters.ts`
- Create: `api/app/src/services/developer-connections/auth-box.ts`
- Create: `api/app/src/services/developer-connections/leases.ts`
- Create: `api/app/src/services/developer-connections/index.ts`
- Test: `api/app/src/__tests__/developer-connections-service.test.ts`

- [ ] **Step 1: Add API dependency**

Update `api/app/package.json` dependencies:

```json
"@repo/developer-connection-contract": "workspace:*"
```

- [ ] **Step 2: Add auth-box env fields**

Add optional auth-box configuration to `api/app/src/env.ts`:

```ts
DEVELOPER_AUTH_BOX_ORIGIN: z.string().url().optional(),
DEVELOPER_AUTH_BOX_TOKEN: z.string().min(1).optional(),
```

Add the matching runtime env bindings:

```ts
DEVELOPER_AUTH_BOX_ORIGIN: process.env.DEVELOPER_AUTH_BOX_ORIGIN,
DEVELOPER_AUTH_BOX_TOKEN: process.env.DEVELOPER_AUTH_BOX_TOKEN,
```

Add both values to `apps/app/turbo.json` `tasks.build.passThroughEnv`:

```json
"DEVELOPER_AUTH_BOX_ORIGIN",
"DEVELOPER_AUTH_BOX_TOKEN"
```

- [ ] **Step 3: Write failing service tests**

Create `api/app/src/__tests__/developer-connections-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const encryptMock = vi.fn(async (value: string) => `encrypted:${value}`);
const decryptMock = vi.fn(async (value: string) =>
  value.startsWith("encrypted:") ? value.slice("encrypted:".length) : value
);
const listCurrentDeveloperConnectionsMock = vi.fn();
const replaceCurrentDeveloperConnectionMock = vi.fn();
const setCurrentDeveloperConnectionSandboxEnabledMock = vi.fn();
const revokeCurrentDeveloperConnectionMock = vi.fn();
const issueDeveloperConnectionLeaseMock = vi.fn();
const sentryAuthBoxStartMock = vi.fn();
const sentryAuthBoxCompleteMock = vi.fn();

vi.mock("@repo/app-encryption", () => ({
  encrypt: encryptMock,
  decrypt: decryptMock,
}));

vi.mock("@db/app", async () => {
  const actual = await vi.importActual<typeof import("@db/app")>("@db/app");
  return {
    ...actual,
    listCurrentDeveloperConnections: listCurrentDeveloperConnectionsMock,
    replaceCurrentDeveloperConnection: replaceCurrentDeveloperConnectionMock,
    setCurrentDeveloperConnectionSandboxEnabled:
      setCurrentDeveloperConnectionSandboxEnabledMock,
    revokeCurrentDeveloperConnection: revokeCurrentDeveloperConnectionMock,
  issueDeveloperConnectionLease: issueDeveloperConnectionLeaseMock,
  };
});

vi.mock("../services/developer-connections/auth-box", () => ({
  sentryAuthBoxClient: {
    start: sentryAuthBoxStartMock,
    complete: sentryAuthBoxCompleteMock,
  },
}));

const {
  connectDeveloperConnection,
  completeSentryDeveloperConnectionAuth,
  issueDeveloperConnectionLeases,
  listDeveloperConnectionsForOrg,
  setDeveloperConnectionSandboxEnabled,
  disconnectDeveloperConnection,
  startSentryDeveloperConnectionAuth,
} = await import("../services/developer-connections");

function ctx() {
  return {
    auth: {
      access: {
        kind: "clerk-session" as const,
        userId: "user_admin",
        orgId: "org_acme",
        has: ({ role }: { role?: string }) => role === "org:admin",
      },
      identity: {
        type: "active" as const,
        userId: "user_admin",
        orgId: "org_acme",
        orgGate: { bindingStatus: "bound" as const, nextSetupRequirement: null },
      },
    },
    db: {},
    headers: new Headers(),
  };
}

describe("developer connection services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCurrentDeveloperConnectionsMock.mockResolvedValue([]);
    replaceCurrentDeveloperConnectionMock.mockImplementation(
      async (_db, input) => ({
        id: 1,
        publicId: "developer_connection_1",
        clerkOrgId: input.clerkOrgId,
        provider: input.provider,
        providerAccountName: input.providerAccountName,
        providerAccountId: input.providerAccountId,
        status: "connected",
        enabledForSandboxes: true,
        credentialKind: input.credentialKind,
        credentialSchemaVersion: input.credentialSchemaVersion,
        encryptedCredential: input.encryptedCredential,
        scopes: input.scopes,
        metadata: input.metadata,
        expiresAt: input.expiresAt,
        lastVerifiedAt: input.verifiedAt,
        lastUsedAt: null,
        lastUsedByUserId: null,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        createdAt: input.verifiedAt,
        updatedAt: input.verifiedAt,
        revokedAt: null,
      })
    );
    issueDeveloperConnectionLeaseMock.mockResolvedValue({
      id: 10,
      publicId: "developer_connection_lease_1",
      connectionId: 1,
      clerkOrgId: "org_acme",
      actorUserId: "user_admin",
      provider: "sentry",
      status: "issued",
      sandboxRunId: "sandbox_run_1",
      workflowRunId: "workflow_run_1",
      issuedAt: new Date("2026-06-03T00:00:00.000Z"),
      expiresAt: new Date("2026-06-03T00:15:00.000Z"),
    });
    sentryAuthBoxStartMock.mockResolvedValue({
      attemptId: "auth_attempt_1",
      expiresAt: new Date("2026-06-03T00:05:00.000Z"),
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/account/settings/auth-tokens/",
    });
    sentryAuthBoxCompleteMock.mockResolvedValue({
      providerAccountId: "org:lightfast",
      providerAccountName: "lightfast/app",
      scopes: ["org:read", "project:read", "event:read"],
      token: "sentry-oauth-token",
      expiresAt: null,
    });
  });

  it("lists the four provider catalog rows with admin manage state", async () => {
    await expect(listDeveloperConnectionsForOrg(ctx())).resolves.toEqual([
      expect.objectContaining({ provider: "pscale", canManage: true }),
      expect.objectContaining({ provider: "upstash", canManage: true }),
      expect.objectContaining({ provider: "sentry", canManage: true }),
      expect.objectContaining({ provider: "clerk", canManage: true }),
    ]);
  });

  it("encrypts manual PlanetScale credentials and stores a current org connection", async () => {
    await connectDeveloperConnection(ctx(), {
      provider: "pscale",
      providerAccountName: "lightfast/main",
      serviceTokenId: "token-id",
      serviceToken: "token-secret",
    });

    expect(encryptMock).toHaveBeenCalledWith(
      JSON.stringify({
        serviceTokenId: "token-id",
        serviceToken: "token-secret",
      }),
      expect.any(String)
    );
    expect(replaceCurrentDeveloperConnectionMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkOrgId: "org_acme",
        provider: "pscale",
        providerAccountName: "lightfast/main",
        credentialKind: "pscale_service_token",
        actorUserId: "user_admin",
      })
    );
  });

  it("starts and completes Sentry auth through the auth-box client", async () => {
    await expect(
      startSentryDeveloperConnectionAuth(ctx(), {
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).resolves.toMatchObject({
      attemptId: "auth_attempt_1",
      userCode: "ABCD-EFGH",
    });

    await expect(
      completeSentryDeveloperConnectionAuth(ctx(), {
        provider: "sentry",
        attemptId: "auth_attempt_1",
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });

    expect(encryptMock).toHaveBeenCalledWith(
      JSON.stringify({ token: "sentry-oauth-token" }),
      expect.any(String)
    );
    expect(replaceCurrentDeveloperConnectionMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        credentialKind: "sentry_oauth_token",
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    );
  });

  it("toggles sandbox enablement through the db helper", async () => {
    setCurrentDeveloperConnectionSandboxEnabledMock.mockResolvedValue({
      provider: "sentry",
      enabledForSandboxes: false,
    });

    await expect(
      setDeveloperConnectionSandboxEnabled(ctx(), {
        provider: "sentry",
        enabled: false,
      })
    ).resolves.toEqual({ enabled: false });
  });

  it("disconnects through the db helper", async () => {
    revokeCurrentDeveloperConnectionMock.mockResolvedValue({
      provider: "sentry",
      status: "revoked",
    });

    await expect(
      disconnectDeveloperConnection(ctx(), { provider: "sentry" })
    ).resolves.toEqual({ disconnected: true });
  });

  it("issues leases only for requested enabled providers", async () => {
    listCurrentDeveloperConnectionsMock.mockResolvedValue([
      {
        id: 1,
        provider: "sentry",
        status: "connected",
        enabledForSandboxes: true,
        encryptedCredential: "encrypted:{}",
        credentialKind: "sentry_token",
      },
    ]);

    await expect(
      issueDeveloperConnectionLeases(ctx(), {
        providers: ["sentry"],
        sandboxRunId: "sandbox_run_1",
        workflowRunId: "workflow_run_1",
      })
    ).resolves.toEqual({
      leases: [
        expect.objectContaining({
          provider: "sentry",
          status: "issued",
        }),
      ],
      materialization: [
        expect.objectContaining({
          provider: "sentry",
        }),
      ],
    });
  });
});
```

- [ ] **Step 4: Run the service tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- developer-connections-service.test.ts
```

Expected: FAIL because the service modules do not exist.

- [ ] **Step 5: Implement credential helpers**

Create `api/app/src/services/developer-connections/credentials.ts`:

```ts
import { decrypt, encrypt } from "@repo/app-encryption";
import { env } from "../../env";

export async function encryptDeveloperCredential(payload: unknown) {
  return await encrypt(JSON.stringify(payload), env.ENCRYPTION_KEY);
}

export async function decryptDeveloperCredential<T>(ciphertext: string): Promise<T> {
  return JSON.parse(await decrypt(ciphertext, env.ENCRYPTION_KEY)) as T;
}

export function redactDeveloperCredential(value: string) {
  if (value.length <= 8) {
    return "[redacted]";
  }
  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}
```

- [ ] **Step 6: Implement provider adapters and Sentry auth-box client**

Create `api/app/src/services/developer-connections/adapters.ts`:

```ts
import type {
  DeveloperConnectionConnectInput,
  DeveloperConnectionCredentialKind,
  DeveloperConnectionProvider,
} from "@repo/developer-connection-contract";

export interface VerifiedDeveloperCredential {
  credentialKind: DeveloperConnectionCredentialKind;
  credentialSchemaVersion: "1";
  credentialPayload: Record<string, unknown>;
  providerAccountId: string | null;
  providerAccountName: string;
  scopes: string[];
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
}

export interface DeveloperConnectionMaterialization {
  provider: DeveloperConnectionProvider;
  env: Record<string, string>;
  files: Array<{ path: string; contents: string; mode: "0600" }>;
}

export async function verifyDeveloperConnectionInput(
  input: DeveloperConnectionConnectInput
): Promise<VerifiedDeveloperCredential> {
  switch (input.provider) {
    case "pscale":
      return {
        credentialKind: "pscale_service_token",
        credentialSchemaVersion: "1",
        credentialPayload: {
          serviceTokenId: input.serviceTokenId,
          serviceToken: input.serviceToken,
        },
        providerAccountId: input.serviceTokenId,
        providerAccountName: input.providerAccountName,
        scopes: ["pscale:service-token"],
        metadata: {},
        expiresAt: null,
      };
    case "upstash":
      return {
        credentialKind: "upstash_management_key",
        credentialSchemaVersion: "1",
        credentialPayload: {
          email: input.email,
          apiKey: input.apiKey,
        },
        providerAccountId: input.email,
        providerAccountName: input.providerAccountName,
        scopes: ["upstash:management"],
        metadata: { email: input.email },
        expiresAt: null,
      };
    case "sentry":
      return {
        credentialKind: "sentry_token",
        credentialSchemaVersion: "1",
        credentialPayload: { token: input.token },
        providerAccountId: input.providerAccountName,
        providerAccountName: input.providerAccountName,
        scopes: ["sentry:token"],
        metadata: {},
        expiresAt: null,
      };
    case "clerk":
      return {
        credentialKind: "clerk_instance_secret",
        credentialSchemaVersion: "1",
        credentialPayload: {
          appId: input.appId,
          instanceId: input.instanceId,
          secretKey: input.secretKey,
        },
        providerAccountId: `${input.appId}:${input.instanceId}`,
        providerAccountName: input.providerAccountName,
        scopes: ["clerk:instance"],
        metadata: {
          appId: input.appId,
          instanceId: input.instanceId,
        },
        expiresAt: null,
      };
  }
}

export function materializeDeveloperCredential(input: {
  provider: DeveloperConnectionProvider;
  credentialPayload: Record<string, unknown>;
}): DeveloperConnectionMaterialization {
  switch (input.provider) {
    case "pscale":
      return {
        provider: "pscale",
        env: {
          PLANETSCALE_SERVICE_TOKEN_ID: String(
            input.credentialPayload.serviceTokenId
          ),
          PLANETSCALE_SERVICE_TOKEN: String(
            input.credentialPayload.serviceToken
          ),
        },
        files: [],
      };
    case "upstash": {
      const email = String(input.credentialPayload.email);
      const apiKey = String(input.credentialPayload.apiKey);
      return {
        provider: "upstash",
        env: {
          UPSTASH_EMAIL: email,
          UPSTASH_API_KEY: apiKey,
        },
        files: [
          {
            path: ".upstash.json",
            mode: "0600",
            contents: JSON.stringify({ email, apiKey }),
          },
        ],
      };
    }
    case "sentry":
      return {
        provider: "sentry",
        env: {
          SENTRY_AUTH_TOKEN: String(input.credentialPayload.token),
        },
        files: [],
      };
    case "clerk":
      return {
        provider: "clerk",
        env: {
          CLERK_SECRET_KEY: String(input.credentialPayload.secretKey),
        },
        files: [],
      };
  }
}
```

Create `api/app/src/services/developer-connections/auth-box.ts`:

```ts
import { TRPCError } from "@trpc/server";
import { env } from "../../env";

export interface SentryAuthBoxStartResult {
  attemptId: string;
  expiresAt: Date;
  userCode: string;
  verificationUri: string;
}

export interface SentryAuthBoxCompleteResult {
  expiresAt: Date | null;
  providerAccountId: string;
  providerAccountName: string;
  scopes: string[];
  token: string;
}

export interface SentryAuthBoxClient {
  start(input: {
    clerkOrgId: string;
    actorUserId: string;
    providerAccountName: string;
  }): Promise<SentryAuthBoxStartResult>;
  complete(input: {
    attemptId: string;
    clerkOrgId: string;
    actorUserId: string;
  }): Promise<SentryAuthBoxCompleteResult>;
}

function authBoxConfig() {
  if (!env.DEVELOPER_AUTH_BOX_ORIGIN || !env.DEVELOPER_AUTH_BOX_TOKEN) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Developer auth box is not configured.",
    });
  }
  return {
    origin: env.DEVELOPER_AUTH_BOX_ORIGIN.replace(/\/$/, ""),
    token: env.DEVELOPER_AUTH_BOX_TOKEN,
  };
}

async function authBoxRequest<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const config = authBoxConfig();
  const response = await fetch(`${config.origin}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Developer auth box request failed with ${response.status}.`,
    });
  }

  return (await response.json()) as T;
}

function parseDate(value: string | null) {
  return value ? new Date(value) : null;
}

export const sentryAuthBoxClient: SentryAuthBoxClient = {
  async start(input) {
    const result = await authBoxRequest<{
      attemptId: string;
      expiresAt: string;
      userCode: string;
      verificationUri: string;
    }>("/v1/sentry/device-code/start", input);
    return { ...result, expiresAt: new Date(result.expiresAt) };
  },
  async complete(input) {
    const result = await authBoxRequest<{
      expiresAt: string | null;
      providerAccountId: string;
      providerAccountName: string;
      scopes: string[];
      token: string;
    }>("/v1/sentry/device-code/complete", input);
    return { ...result, expiresAt: parseDate(result.expiresAt) };
  },
};
```

- [ ] **Step 7: Implement catalog service**

Create `api/app/src/services/developer-connections/catalog.ts`:

```ts
import type { Database, DeveloperConnection } from "@db/app";
import { listCurrentDeveloperConnections } from "@db/app";
import {
  DEVELOPER_CONNECTION_CATALOG,
  type DeveloperConnectionProvider,
} from "@repo/developer-connection-contract";
import type { AuthContext } from "../../trpc";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
}

type ConnectAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: "coming_soon" | "permission_required" };

export interface DeveloperConnectionCatalogRow {
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: ConnectAvailability;
  connection: {
    connectedAt: Date;
    enabledForSandboxes: boolean;
    lastUsedAt: Date | null;
    lastUsedByUserId: string | null;
    lastVerifiedAt: Date | null;
    providerAccountName: string;
    status: "connected" | "needs_reconnect" | "revoked" | "replaced";
  } | null;
  description: string;
  displayName: string;
  provider: DeveloperConnectionProvider;
}

export function canManageDeveloperConnections(
  ctx: DeveloperConnectionServiceContext
) {
  const identity = ctx.auth.identity;
  const access = ctx.auth.access;
  return (
    identity.type === "active" &&
    access?.kind === "clerk-session" &&
    access.userId === identity.userId &&
    access.orgId === identity.orgId &&
    access.has({ role: "org:admin" })
  );
}

function availabilityFor(canManage: boolean): ConnectAvailability {
  if (!canManage) {
    return { status: "unavailable", reason: "permission_required" };
  }
  return { status: "available" };
}

function shapeConnection(connection: DeveloperConnection | undefined) {
  if (!connection) {
    return null;
  }
  return {
    connectedAt: connection.createdAt,
    enabledForSandboxes: connection.enabledForSandboxes,
    lastUsedAt: connection.lastUsedAt,
    lastUsedByUserId: connection.lastUsedByUserId,
    lastVerifiedAt: connection.lastVerifiedAt,
    providerAccountName: connection.providerAccountName,
    status: connection.status,
  };
}

export async function listDeveloperConnectionsForOrg(
  ctx: DeveloperConnectionServiceContext
): Promise<DeveloperConnectionCatalogRow[]> {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    return [];
  }

  const connections = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const byProvider = new Map<DeveloperConnectionProvider, DeveloperConnection>(
    connections.map((connection) => [connection.provider, connection])
  );
  const canManage = canManageDeveloperConnections(ctx);

  return DEVELOPER_CONNECTION_CATALOG.map((catalogItem) => ({
    ...catalogItem,
    canManage,
    connectAvailability: availabilityFor(canManage),
    connection: shapeConnection(byProvider.get(catalogItem.provider)),
  }));
}
```

- [ ] **Step 8: Implement service entrypoints and leases**

Create `api/app/src/services/developer-connections/leases.ts`:

```ts
import type { Database } from "@db/app";
import {
  issueDeveloperConnectionLease,
  listCurrentDeveloperConnections,
} from "@db/app";
import type { DeveloperConnectionIssueLeaseInput } from "@repo/developer-connection-contract";
import { TRPCError } from "@trpc/server";
import type { AuthContext } from "../../trpc";
import { decryptDeveloperCredential } from "./credentials";
import { materializeDeveloperCredential } from "./adapters";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
}

export async function issueDeveloperConnectionLeases(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionIssueLeaseInput
) {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const requested = new Set(input.providers);
  const current = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const byProvider = new Map(current.map((connection) => [connection.provider, connection]));
  const issuedAt = new Date();
  const leases = [];
  const materialization = [];

  for (const provider of requested) {
    const connection = byProvider.get(provider);
    if (!connection || connection.status !== "connected") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} needs reconnect`,
      });
    }
    if (!connection.enabledForSandboxes) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} is disabled for sandboxes`,
      });
    }
    if (!connection.encryptedCredential) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${provider} has no credential material`,
      });
    }

    const lease = await issueDeveloperConnectionLease(ctx.db, {
      connectionId: connection.id,
      clerkOrgId: identity.orgId,
      actorUserId: identity.userId,
      sandboxRunId: input.sandboxRunId,
      workflowRunId: input.workflowRunId,
      provider,
      issuedAt,
    });
    leases.push(lease);

    const credentialPayload = await decryptDeveloperCredential<Record<string, unknown>>(
      connection.encryptedCredential
    );
    materialization.push(
      materializeDeveloperCredential({ provider, credentialPayload })
    );
  }

  return { leases, materialization };
}
```

Create `api/app/src/services/developer-connections/index.ts`:

```ts
import type { Database } from "@db/app";
import {
  replaceCurrentDeveloperConnection,
  revokeCurrentDeveloperConnection,
  setCurrentDeveloperConnectionSandboxEnabled,
} from "@db/app";
import type {
  DeveloperConnectionCompleteAuthInput,
  DeveloperConnectionConnectInput,
  DeveloperConnectionProvider,
  DeveloperConnectionSetSandboxEnabledInput,
  DeveloperConnectionStartAuthInput,
} from "@repo/developer-connection-contract";
import { TRPCError } from "@trpc/server";
import type { AuthContext } from "../../trpc";
import { verifyDeveloperConnectionInput } from "./adapters";
import { sentryAuthBoxClient } from "./auth-box";
import { listDeveloperConnectionsForOrg } from "./catalog";
import { encryptDeveloperCredential } from "./credentials";
import { issueDeveloperConnectionLeases } from "./leases";

interface DeveloperConnectionServiceContext {
  auth: AuthContext;
  db: Database;
  headers: Headers;
}

export { issueDeveloperConnectionLeases, listDeveloperConnectionsForOrg };

function activeAdmin(ctx: DeveloperConnectionServiceContext) {
  const identity = ctx.auth.identity;
  const access = ctx.auth.access;
  if (
    identity.type !== "active" ||
    access?.kind !== "clerk-session" ||
    access.userId !== identity.userId ||
    access.orgId !== identity.orgId ||
    !access.has({ role: "org:admin" })
  ) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return identity;
}

export async function connectDeveloperConnection(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionConnectInput
) {
  const identity = activeAdmin(ctx);
  const verified = await verifyDeveloperConnectionInput(input);
  const encryptedCredential = await encryptDeveloperCredential(
    verified.credentialPayload
  );
  const connection = await replaceCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: input.provider,
    providerAccountId: verified.providerAccountId,
    providerAccountName: verified.providerAccountName,
    credentialKind: verified.credentialKind,
    credentialSchemaVersion: verified.credentialSchemaVersion,
    encryptedCredential,
    scopes: verified.scopes,
    metadata: verified.metadata,
    expiresAt: verified.expiresAt,
    actorUserId: identity.userId,
    verifiedAt: new Date(),
  });
  return { provider: connection.provider, status: connection.status };
}

export async function startSentryDeveloperConnectionAuth(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionStartAuthInput
) {
  const identity = activeAdmin(ctx);
  return await sentryAuthBoxClient.start({
    actorUserId: identity.userId,
    clerkOrgId: identity.orgId,
    providerAccountName: input.providerAccountName,
  });
}

export async function completeSentryDeveloperConnectionAuth(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionCompleteAuthInput
) {
  const identity = activeAdmin(ctx);
  const verified = await sentryAuthBoxClient.complete({
    actorUserId: identity.userId,
    attemptId: input.attemptId,
    clerkOrgId: identity.orgId,
  });
  const encryptedCredential = await encryptDeveloperCredential({
    token: verified.token,
  });
  const connection = await replaceCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: "sentry",
    providerAccountId: verified.providerAccountId,
    providerAccountName: verified.providerAccountName,
    credentialKind: "sentry_oauth_token",
    credentialSchemaVersion: "1",
    encryptedCredential,
    scopes: verified.scopes,
    metadata: { authType: "device_code" },
    expiresAt: verified.expiresAt,
    actorUserId: identity.userId,
    verifiedAt: new Date(),
  });
  return { provider: connection.provider, status: connection.status };
}

export async function setDeveloperConnectionSandboxEnabled(
  ctx: DeveloperConnectionServiceContext,
  input: DeveloperConnectionSetSandboxEnabledInput
) {
  const identity = activeAdmin(ctx);
  await setCurrentDeveloperConnectionSandboxEnabled(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: input.provider,
    enabled: input.enabled,
    actorUserId: identity.userId,
  });
  return { enabled: input.enabled };
}

export async function disconnectDeveloperConnection(
  ctx: DeveloperConnectionServiceContext,
  input: { provider: DeveloperConnectionProvider }
) {
  const identity = activeAdmin(ctx);
  await revokeCurrentDeveloperConnection(ctx.db, {
    clerkOrgId: identity.orgId,
    provider: input.provider,
    actorUserId: identity.userId,
  });
  return { disconnected: true };
}
```

- [ ] **Step 9: Run service tests**

Run:

```bash
pnpm --filter @api/app test -- developer-connections-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add api/app/package.json api/app/src/env.ts apps/app/turbo.json api/app/src/services/developer-connections api/app/src/__tests__/developer-connections-service.test.ts pnpm-lock.yaml
git commit -m "feat: add developer connection services"
```

---

### Task 5: Add tRPC Router

**Files:**
- Create: `api/app/src/router/(pending-not-allowed)/developer-connections.ts`
- Modify: `api/app/src/root.ts`
- Test: `api/app/src/__tests__/developer-connections-router.test.ts`

- [ ] **Step 1: Write failing router tests**

Create `api/app/src/__tests__/developer-connections-router.test.ts`:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listDeveloperConnectionsForOrgMock = vi.fn();
const connectDeveloperConnectionMock = vi.fn();
const completeSentryDeveloperConnectionAuthMock = vi.fn();
const setDeveloperConnectionSandboxEnabledMock = vi.fn();
const disconnectDeveloperConnectionMock = vi.fn();
const issueDeveloperConnectionLeasesMock = vi.fn();
const startSentryDeveloperConnectionAuthMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));
vi.mock("../services/developer-connections", () => ({
  connectDeveloperConnection: connectDeveloperConnectionMock,
  completeSentryDeveloperConnectionAuth:
    completeSentryDeveloperConnectionAuthMock,
  disconnectDeveloperConnection: disconnectDeveloperConnectionMock,
  issueDeveloperConnectionLeases: issueDeveloperConnectionLeasesMock,
  listDeveloperConnectionsForOrg: listDeveloperConnectionsForOrgMock,
  setDeveloperConnectionSandboxEnabled:
    setDeveloperConnectionSandboxEnabledMock,
  startSentryDeveloperConnectionAuth: startSentryDeveloperConnectionAuthMock,
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { developerConnectionsRouter } = await import(
  "../router/(pending-not-allowed)/developer-connections"
);

const testRouter = createTRPCRouter({
  developerConnections: developerConnectionsRouter,
});
const createCaller = createCallerFactory(testRouter);

const activeIdentity = {
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
  orgId: "org_acme",
  type: "active",
  userId: "user_current",
} satisfies AuthIdentity;

function adminAccess() {
  return {
    has: ({ role }: { role?: string }) => role === "org:admin",
    kind: "clerk-session" as const,
    orgId: "org_acme",
    userId: "user_current",
  };
}

function nonAdminAccess() {
  return { ...adminAccess(), has: () => false };
}

function caller(access = adminAccess()) {
  return createCaller({
    auth: { access, identity: activeIdentity },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("developerConnectionsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDeveloperConnectionsForOrgMock.mockResolvedValue([
      { provider: "sentry", canManage: false, connection: null },
    ]);
    connectDeveloperConnectionMock.mockResolvedValue({
      provider: "sentry",
      status: "connected",
    });
    startSentryDeveloperConnectionAuthMock.mockResolvedValue({
      attemptId: "auth_attempt_1",
      expiresAt: new Date("2026-06-03T00:05:00.000Z"),
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/account/settings/auth-tokens/",
    });
    completeSentryDeveloperConnectionAuthMock.mockResolvedValue({
      provider: "sentry",
      status: "connected",
    });
    setDeveloperConnectionSandboxEnabledMock.mockResolvedValue({
      enabled: false,
    });
    disconnectDeveloperConnectionMock.mockResolvedValue({ disconnected: true });
    issueDeveloperConnectionLeasesMock.mockResolvedValue({
      leases: [],
      materialization: [],
    });
  });

  it("allows non-admin members to list and issue leases", async () => {
    await expect(
      caller(nonAdminAccess()).developerConnections.list()
    ).resolves.toEqual([expect.objectContaining({ provider: "sentry" })]);

    await expect(
      caller(nonAdminAccess()).developerConnections.issueLease({
        providers: ["sentry"],
        sandboxRunId: "sandbox_run_1",
        workflowRunId: "workflow_run_1",
      })
    ).resolves.toEqual({ leases: [], materialization: [] });
  });

  it("rejects management mutations for non-admin members", async () => {
    await expect(
      caller(nonAdminAccess()).developerConnections.connect({
        provider: "sentry",
        providerAccountName: "lightfast/app",
        token: "token",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.setSandboxEnabled({
        provider: "sentry",
        enabled: false,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.disconnect({
        provider: "sentry",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      caller(nonAdminAccess()).developerConnections.startSentryAuth({
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("routes admin mutations to services", async () => {
    await expect(
      caller().developerConnections.connect({
        provider: "sentry",
        providerAccountName: "lightfast/app",
        token: "token",
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });

    await expect(
      caller().developerConnections.setSandboxEnabled({
        provider: "sentry",
        enabled: false,
      })
    ).resolves.toEqual({ enabled: false });

    await expect(
      caller().developerConnections.disconnect({ provider: "sentry" })
    ).resolves.toEqual({ disconnected: true });

    await expect(
      caller().developerConnections.startSentryAuth({
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).resolves.toMatchObject({ attemptId: "auth_attempt_1" });

    await expect(
      caller().developerConnections.completeSentryAuth({
        provider: "sentry",
        attemptId: "auth_attempt_1",
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });
  });
});
```

- [ ] **Step 2: Run router tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- developer-connections-router.test.ts
```

Expected: FAIL because the router does not exist.

- [ ] **Step 3: Implement router**

Create `api/app/src/router/(pending-not-allowed)/developer-connections.ts`:

```ts
import {
  developerConnectionCompleteAuthInputSchema,
  developerConnectionConnectInputSchema,
  developerConnectionIssueLeaseInputSchema,
  developerConnectionProviderInputSchema,
  developerConnectionStartAuthInputSchema,
  developerConnectionSetSandboxEnabledInputSchema,
} from "@repo/developer-connection-contract";
import {
  connectDeveloperConnection,
  completeSentryDeveloperConnectionAuth,
  disconnectDeveloperConnection,
  issueDeveloperConnectionLeases,
  listDeveloperConnectionsForOrg,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} from "../../services/developer-connections";
import {
  boundOrgAdminProcedure,
  boundOrgProcedure,
  createTRPCRouter,
} from "../../trpc";

export const developerConnectionsRouter = createTRPCRouter({
  list: boundOrgProcedure.query(async ({ ctx }) =>
    listDeveloperConnectionsForOrg(ctx)
  ),
  connect: boundOrgAdminProcedure
    .input(developerConnectionConnectInputSchema)
    .mutation(async ({ ctx, input }) => connectDeveloperConnection(ctx, input)),
  startSentryAuth: boundOrgAdminProcedure
    .input(developerConnectionStartAuthInputSchema)
    .mutation(async ({ ctx, input }) =>
      startSentryDeveloperConnectionAuth(ctx, input)
    ),
  completeSentryAuth: boundOrgAdminProcedure
    .input(developerConnectionCompleteAuthInputSchema)
    .mutation(async ({ ctx, input }) =>
      completeSentryDeveloperConnectionAuth(ctx, input)
    ),
  setSandboxEnabled: boundOrgAdminProcedure
    .input(developerConnectionSetSandboxEnabledInputSchema)
    .mutation(async ({ ctx, input }) =>
      setDeveloperConnectionSandboxEnabled(ctx, input)
    ),
  disconnect: boundOrgAdminProcedure
    .input(developerConnectionProviderInputSchema)
    .mutation(async ({ ctx, input }) =>
      disconnectDeveloperConnection(ctx, input)
    ),
  issueLease: boundOrgProcedure
    .input(developerConnectionIssueLeaseInputSchema)
    .mutation(async ({ ctx, input }) =>
      issueDeveloperConnectionLeases(ctx, input)
    ),
});
```

- [ ] **Step 4: Mount router in root**

Modify `api/app/src/root.ts`:

```ts
import { developerConnectionsRouter } from "./router/(pending-not-allowed)/developer-connections";
```

Add under `org.workspace`:

```ts
developerConnections: developerConnectionsRouter,
```

- [ ] **Step 5: Run API tests and typecheck**

Run:

```bash
pnpm --filter @api/app test -- developer-connections-router.test.ts developer-connections-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "api/app/src/router/(pending-not-allowed)/developer-connections.ts" api/app/src/root.ts api/app/src/__tests__/developer-connections-router.test.ts
git commit -m "feat: add developer connections router"
```

---

### Task 6: Add Developer Connections UI

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connections-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connection-detail-sheet.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connection-icons.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connections-model.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/developer-connections-page.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/developer-connections-page.test.tsx`. Use the same mock boundaries that the existing connectors page test already proves: `~/trpc/server`, `~/trpc/react`, `@tanstack/react-query`, and `nuqs`. Define `renderClient`, `connectedSentry`, `availableSentry`, and `availablePscale` helpers in this file, then add these tests:

```ts
it("fetches developer connections before rendering hydrated client UI", async () => {
  fetchQueryMock.mockResolvedValue([connectedSentry()]);
  useSuspenseQueryMock.mockReturnValue({ data: [connectedSentry()] });

  const element = await DeveloperConnectionsPage({
    searchParams: Promise.resolve({ connection: "sentry" }),
  });
  render(element);

  expect(listQueryOptionsMock).toHaveBeenCalled();
  expect(fetchQueryMock).toHaveBeenCalledWith(listQueryOptions);
  expect(screen.getByTestId("hydrated-developer-connections")).toHaveTextContent(
    "Developer Connections"
  );
});

it("renders connected cards with sandbox toggle and no MCP tool copy", () => {
  renderClient([connectedSentry()]);

  expect(
    screen.getByRole("heading", { name: "Developer Connections" })
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Sentry" })).toBeVisible();
  expect(screen.getByText("Connected", { selector: "span" })).toBeVisible();
  expect(screen.getByText("Use in sandboxes")).toBeVisible();
  expect(screen.queryByText("Tools")).toBeNull();
  expect(screen.queryByText("Use in automations")).toBeNull();
  expect(screen.queryByText("Use in agents")).toBeNull();
});

it("renders available provider cards and opens the connect dialog", () => {
  renderClient([availablePscale()]);

  fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText(/service token id/i)).toBeVisible();
  expect(screen.getByLabelText(/^service token$/i)).toBeVisible();
});

it("submits manual Sentry token credentials", () => {
  renderClient([availableSentry()]);

  fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
  fireEvent.change(screen.getByLabelText(/provider account name/i), {
    target: { value: "lightfast/app" },
  });
  fireEvent.change(screen.getByLabelText(/sentry token/i), {
    target: { value: "sentry-token" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

  expect(connectMutateMock).toHaveBeenCalledWith({
    provider: "sentry",
    providerAccountName: "lightfast/app",
    token: "sentry-token",
  });
});

it("starts and completes Sentry browser OAuth from the connect dialog", () => {
  startSentryAuthMutateMock.mockImplementation((_input, options) => {
    options?.onSuccess?.({
      attemptId: "auth_attempt_1",
      expiresAt: new Date("2026-06-03T00:05:00.000Z"),
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/account/settings/auth-tokens/",
    });
  });
  renderClient([availableSentry()]);

  fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
  fireEvent.change(screen.getByLabelText(/provider account name/i), {
    target: { value: "lightfast/app" },
  });
  fireEvent.click(screen.getByRole("button", { name: /browser oauth/i }));

  expect(startSentryAuthMutateMock).toHaveBeenCalledWith({
    provider: "sentry",
    providerAccountName: "lightfast/app",
  });
  expect(screen.getByText("ABCD-EFGH")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: /complete connection/i }));

  expect(completeSentryAuthMutateMock).toHaveBeenCalledWith({
    provider: "sentry",
    attemptId: "auth_attempt_1",
  });
});

it("disables management controls for non-admin members", () => {
  renderClient([
    {
      ...connectedSentry(),
      canManage: false,
      connectAvailability: {
        status: "unavailable",
        reason: "permission_required",
      },
    },
  ]);

  expect(
    screen.getByRole("switch", { name: /use in sandboxes/i })
  ).toBeDisabled();
  expect(screen.getByText(/admin access required/i)).toBeVisible();
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test -- developer-connections-page.test.tsx
```

Expected: FAIL because the page and client components do not exist.

- [ ] **Step 3: Implement the server page**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/page.tsx`:

```tsx
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { DeveloperConnectionsClient } from "./_components/developer-connections-client";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DeveloperConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connection?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;

  await getQueryClient().fetchQuery(
    trpc.org.workspace.developerConnections.list.queryOptions()
  );

  return (
    <HydrateClient>
      <DeveloperConnectionsClient
        callbackError={firstParam(params.error)}
        callbackProvider={firstParam(params.connection)}
      />
    </HydrateClient>
  );
}
```

- [ ] **Step 4: Implement UI model helpers**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connections-model.ts`:

```ts
import type { AppRouterOutputs } from "@api/app";

export type DeveloperConnectionCatalogRow =
  AppRouterOutputs["org"]["workspace"]["developerConnections"]["list"][number];
export type DeveloperConnectionProvider =
  DeveloperConnectionCatalogRow["provider"];
export type DeveloperConnection = NonNullable<
  DeveloperConnectionCatalogRow["connection"]
>;

export function displayDeveloperConnectionProvider(provider: string | undefined) {
  if (!provider) {
    return "Developer connection";
  }
  if (provider === "pscale") {
    return "PlanetScale";
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function developerConnectionStatus(row: DeveloperConnectionCatalogRow): {
  dotClass: string;
  label: "Available" | "Connected" | "Disabled" | "Needs reconnect";
} {
  if (!row.connection) {
    return { dotClass: "bg-muted-foreground", label: "Available" };
  }
  if (row.connection.status === "needs_reconnect") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (!row.connection.enabledForSandboxes) {
    return { dotClass: "bg-muted-foreground", label: "Disabled" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}
```

- [ ] **Step 5: Implement icons and detail sheet**

Create `developer-connection-icons.tsx`:

```tsx
import { Database, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import type { DeveloperConnectionProvider } from "./developer-connections-model";

export function DeveloperConnectionIcon({
  provider,
}: {
  provider: DeveloperConnectionProvider;
}) {
  const Icon =
    provider === "pscale"
      ? Database
      : provider === "upstash"
        ? TriangleAlert
        : provider === "sentry"
          ? ShieldCheck
          : KeyRound;

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-muted/35">
      <Icon className="size-4 text-muted-foreground" />
    </div>
  );
}
```

Create `developer-connection-detail-sheet.tsx`:

```tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import type { DeveloperConnectionCatalogRow } from "./developer-connections-model";
import {
  developerConnectionStatus,
  displayDeveloperConnectionProvider,
} from "./developer-connections-model";

export function DeveloperConnectionDetailSheet({
  onOpenChange,
  row,
}: {
  onOpenChange: (open: boolean) => void;
  row?: DeveloperConnectionCatalogRow;
}) {
  if (!row?.connection) {
    return null;
  }

  const status = developerConnectionStatus(row);

  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{row.displayName}</SheetTitle>
          <SheetDescription>
            {displayDeveloperConnectionProvider(row.provider)} sandbox
            credential status.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="mt-1 text-foreground">{status.label}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Connected account</p>
            <p className="mt-1 text-foreground">
              {row.connection.providerAccountName}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Materializes</p>
            <p className="mt-1 text-foreground">Temporary env/config only</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 6: Implement the client page**

Create `developer-connections-client.tsx` by copying the existing `ConnectorsClient` structure and replacing domain-specific sections:

```tsx
"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, PanelRight, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Switch } from "@repo/ui/components/ui/switch";
import { cn } from "@repo/ui/lib/utils";
import { useTRPC } from "~/trpc/react";
import { LfSelect } from "../../_components/lf-select";
import { DeveloperConnectionDetailSheet } from "./developer-connection-detail-sheet";
import { DeveloperConnectionIcon } from "./developer-connection-icons";
import {
  developerConnectionStatus,
  displayDeveloperConnectionProvider,
  type DeveloperConnectionCatalogRow,
} from "./developer-connections-model";

type StatusFilter = "all" | "available" | "connected" | "disabled" | "needs_reconnect";

interface DeveloperConnectionsClientProps {
  callbackError?: string;
  callbackProvider?: string;
}

export function DeveloperConnectionsClient({
  callbackError,
  callbackProvider,
}: DeveloperConnectionsClientProps = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useQueryState("connection");
  const [, setErrorParam] = useQueryState("error");
  const listQueryOptions =
    trpc.org.workspace.developerConnections.list.queryOptions();
  const { data: connections } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 30_000,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [connectRow, setConnectRow] =
    useState<DeveloperConnectionCatalogRow | null>(null);
  const [sentryAuthAttempt, setSentryAuthAttempt] = useState<{
    attemptId: string;
    userCode: string;
    verificationUri: string;
  } | null>(null);

  const invalidateList = () =>
    queryClient.invalidateQueries(
      trpc.org.workspace.developerConnections.list.queryFilter()
    );

  const connectMutation = useMutation(
    trpc.org.workspace.developerConnections.connect.mutationOptions({
      onSuccess: () => {
        setConnectRow(null);
        invalidateList();
      },
    })
  );
  const startSentryAuthMutation = useMutation(
    trpc.org.workspace.developerConnections.startSentryAuth.mutationOptions({
      onSuccess: (result) => {
        setSentryAuthAttempt({
          attemptId: result.attemptId,
          userCode: result.userCode,
          verificationUri: result.verificationUri,
        });
      },
    })
  );
  const completeSentryAuthMutation = useMutation(
    trpc.org.workspace.developerConnections.completeSentryAuth.mutationOptions({
      onSuccess: () => {
        setConnectRow(null);
        setSentryAuthAttempt(null);
        invalidateList();
      },
    })
  );
  const setSandboxEnabledMutation = useMutation(
    trpc.org.workspace.developerConnections.setSandboxEnabled.mutationOptions({
      onSuccess: invalidateList,
    })
  );
  const disconnectMutation = useMutation(
    trpc.org.workspace.developerConnections.disconnect.mutationOptions({
      onSuccess: invalidateList,
    })
  );

  useEffect(() => {
    if (!callbackError) {
      return;
    }
    void setSelectedProvider(null);
    void setErrorParam(null);
  }, [callbackError, setErrorParam, setSelectedProvider]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredConnections = useMemo(
    () =>
      connections.filter((row) => {
        const status = developerConnectionStatus(row).label
          .toLowerCase()
          .replace(" ", "_");
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [row.displayName, row.description, row.category, row.provider].some(
            (value) => value.toLowerCase().includes(normalizedQuery)
          );
        return matchesQuery && matchesStatus;
      }),
    [connections, normalizedQuery, statusFilter]
  );

  const sheetRow = selectedProvider
    ? connections.find((row) => row.provider === selectedProvider && row.connection)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header>
        <h1 className="font-semibold text-2xl text-foreground tracking-[-0.02em]">
          Developer Connections
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground text-sm">
          Connect provider CLIs for Lightfast-controlled sandbox workflows.
        </p>
      </header>

      {callbackError && (
        <div className="mt-6 rounded-[9px] border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">
            {displayDeveloperConnectionProvider(callbackProvider)} connection failed
          </p>
          <p className="mt-1 text-destructive/85">{callbackError}</p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search developer connections"
            className="pl-8"
            onChange={(event) => setQuery(event.currentTarget.value)}
            size="lf"
            value={query}
            variant="lf"
          />
        </div>
        <LfSelect
          align="end"
          aria-label="Status"
          className="shrink-0 sm:w-44"
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            { label: "All statuses", value: "all" },
            { label: "Connected", value: "connected" },
            { label: "Disabled", value: "disabled" },
            { label: "Needs reconnect", value: "needs_reconnect" },
            { label: "Available", value: "available" },
          ]}
          value={statusFilter}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {filteredConnections.map((row) => (
          <DeveloperConnectionCard
            key={row.provider}
            onConnect={setConnectRow}
            onDisconnect={(provider) =>
              disconnectMutation.mutate({ provider })
            }
            onSetSandboxEnabled={(provider, enabled) =>
              setSandboxEnabledMutation.mutate({ provider, enabled })
            }
            onViewDetails={(provider) => void setSelectedProvider(provider)}
            pending={
              connectMutation.isPending ||
              setSandboxEnabledMutation.isPending ||
              disconnectMutation.isPending
            }
            row={row}
          />
        ))}
      </div>

      {connectRow ? (
        <DeveloperConnectionConnectDialog
          onCompleteSentryAuth={(attemptId) =>
            completeSentryAuthMutation.mutate({
              provider: "sentry",
              attemptId,
            })
          }
          onClose={() => setConnectRow(null)}
          onStartSentryAuth={(providerAccountName) =>
            startSentryAuthMutation.mutate({
              provider: "sentry",
              providerAccountName,
            })
          }
          onSubmit={(input) => connectMutation.mutate(input)}
          row={connectRow}
          sentryAuthAttempt={sentryAuthAttempt}
        />
      ) : null}

      <DeveloperConnectionDetailSheet
        onOpenChange={(open) => {
          if (!open) {
            void setSelectedProvider(null);
          }
        }}
        row={sheetRow}
      />
    </div>
  );
}
```

Add these focused components to the bottom of `developer-connections-client.tsx`:

```tsx
type DeveloperConnectionConnectInput =
  | {
      provider: "pscale";
      providerAccountName: string;
      serviceTokenId: string;
      serviceToken: string;
    }
  | {
      provider: "upstash";
      providerAccountName: string;
      email: string;
      apiKey: string;
    }
  | {
      provider: "sentry";
      providerAccountName: string;
      token: string;
    }
  | {
      provider: "clerk";
      providerAccountName: string;
      appId: string;
      instanceId: string;
      secretKey: string;
    };

function DeveloperConnectionCard({
  onConnect,
  onDisconnect,
  onSetSandboxEnabled,
  onViewDetails,
  pending,
  row,
}: {
  onConnect: (row: DeveloperConnectionCatalogRow) => void;
  onDisconnect: (provider: DeveloperConnectionCatalogRow["provider"]) => void;
  onSetSandboxEnabled: (
    provider: DeveloperConnectionCatalogRow["provider"],
    enabled: boolean
  ) => void;
  onViewDetails: (provider: DeveloperConnectionCatalogRow["provider"]) => void;
  pending: boolean;
  row: DeveloperConnectionCatalogRow;
}) {
  const status = developerConnectionStatus(row);
  const connected = Boolean(row.connection);
  const canManage = row.canManage && row.connectAvailability.status === "available";

  return (
    <article className="rounded-[12px] border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <DeveloperConnectionIcon provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-foreground text-sm">
                {row.displayName}
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {row.description}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-muted-foreground text-xs">
              <span className={cn("size-1.5 rounded-full", status.dotClass)} />
              {status.label}
            </span>
          </div>

          {connected ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-foreground text-sm">
                  {row.connection?.providerAccountName}
                </p>
                {!canManage ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    Admin access required to manage this connection.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-[8px] border border-border px-2.5 py-1.5 text-sm">
                  <Switch
                    aria-label="Use in sandboxes"
                    checked={row.connection?.enabledForSandboxes ?? false}
                    disabled={!canManage || pending}
                    onCheckedChange={(enabled) =>
                      onSetSandboxEnabled(row.provider, enabled)
                    }
                  />
                  Use in sandboxes
                </label>
                <Button
                  disabled={pending}
                  onClick={() => onViewDetails(row.provider)}
                  size="sm"
                  variant="outline"
                >
                  <PanelRight className="mr-1.5 size-3.5" />
                  Details
                </Button>
                <Button
                  disabled={!canManage || pending}
                  onClick={() => onDisconnect(row.provider)}
                  size="sm"
                  variant="outline"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {canManage
                  ? "Not connected"
                  : "Admin access required to connect."}
              </p>
              <Button
                disabled={!canManage || pending}
                onClick={() => onConnect(row)}
                size="sm"
              >
                Connect
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DeveloperConnectionConnectDialog({
  onClose,
  onCompleteSentryAuth,
  onStartSentryAuth,
  onSubmit,
  row,
  sentryAuthAttempt,
}: {
  onClose: () => void;
  onCompleteSentryAuth: (attemptId: string) => void;
  onStartSentryAuth: (providerAccountName: string) => void;
  onSubmit: (input: DeveloperConnectionConnectInput) => void;
  row: DeveloperConnectionCatalogRow;
  sentryAuthAttempt: {
    attemptId: string;
    userCode: string;
    verificationUri: string;
  } | null;
}) {
  const [providerAccountName, setProviderAccountName] = useState("");
  const [serviceTokenId, setServiceTokenId] = useState("");
  const [serviceToken, setServiceToken] = useState("");
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sentryToken, setSentryToken] = useState("");
  const [appId, setAppId] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [secretKey, setSecretKey] = useState("");

  function submitManual() {
    if (row.provider === "pscale") {
      onSubmit({
        provider: "pscale",
        providerAccountName,
        serviceTokenId,
        serviceToken,
      });
      return;
    }
    if (row.provider === "upstash") {
      onSubmit({
        provider: "upstash",
        providerAccountName,
        email,
        apiKey,
      });
      return;
    }
    if (row.provider === "sentry") {
      onSubmit({
        provider: "sentry",
        providerAccountName,
        token: sentryToken,
      });
      return;
    }
    onSubmit({
      provider: "clerk",
      providerAccountName,
      appId,
      instanceId,
      secretKey,
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {row.displayName}</DialogTitle>
          <DialogDescription>
            Credentials are stored encrypted and only materialized inside
            Lightfast-controlled sandbox workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-account-name">
              Provider account name
            </Label>
            <Input
              id="provider-account-name"
              onChange={(event) =>
                setProviderAccountName(event.currentTarget.value)
              }
              value={providerAccountName}
            />
          </div>

          {row.provider === "pscale" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="pscale-service-token-id">
                  Service token id
                </Label>
                <Input
                  id="pscale-service-token-id"
                  onChange={(event) =>
                    setServiceTokenId(event.currentTarget.value)
                  }
                  value={serviceTokenId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pscale-service-token">Service token</Label>
                <Input
                  id="pscale-service-token"
                  onChange={(event) =>
                    setServiceToken(event.currentTarget.value)
                  }
                  type="password"
                  value={serviceToken}
                />
              </div>
            </>
          ) : null}

          {row.provider === "upstash" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="upstash-email">Email</Label>
                <Input
                  id="upstash-email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  type="email"
                  value={email}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upstash-api-key">Management API key</Label>
                <Input
                  id="upstash-api-key"
                  onChange={(event) => setApiKey(event.currentTarget.value)}
                  type="password"
                  value={apiKey}
                />
              </div>
            </>
          ) : null}

          {row.provider === "sentry" ? (
            <>
              <div className="rounded-[9px] border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">Browser OAuth</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Preferred Sentry auth path for admin setup.
                    </p>
                  </div>
                  <Button
                    onClick={() => onStartSentryAuth(providerAccountName)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ArrowUpRight className="mr-1.5 size-3.5" />
                    Browser OAuth
                  </Button>
                </div>
                {sentryAuthAttempt ? (
                  <div className="mt-3 rounded-[8px] bg-muted p-3">
                    <p className="text-muted-foreground text-xs">User code</p>
                    <p className="mt-1 font-mono text-foreground text-sm">
                      {sentryAuthAttempt.userCode}
                    </p>
                    <a
                      className="mt-2 inline-flex text-primary text-xs underline"
                      href={sentryAuthAttempt.verificationUri}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Sentry authorization
                    </a>
                    <Button
                      className="mt-3"
                      onClick={() =>
                        onCompleteSentryAuth(sentryAuthAttempt.attemptId)
                      }
                      size="sm"
                      type="button"
                    >
                      Complete connection
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sentry-token">Sentry token</Label>
                <Input
                  id="sentry-token"
                  onChange={(event) =>
                    setSentryToken(event.currentTarget.value)
                  }
                  type="password"
                  value={sentryToken}
                />
              </div>
            </>
          ) : null}

          {row.provider === "clerk" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="clerk-app-id">App id</Label>
                <Input
                  id="clerk-app-id"
                  onChange={(event) => setAppId(event.currentTarget.value)}
                  value={appId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clerk-instance-id">Instance id</Label>
                <Input
                  id="clerk-instance-id"
                  onChange={(event) =>
                    setInstanceId(event.currentTarget.value)
                  }
                  value={instanceId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clerk-secret-key">Instance secret key</Label>
                <Input
                  id="clerk-secret-key"
                  onChange={(event) => setSecretKey(event.currentTarget.value)}
                  type="password"
                  value={secretKey}
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button onClick={submitManual} type="button">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
pnpm --filter @lightfast/app test -- developer-connections-page.test.tsx
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/developer-connections-page.test.tsx"
git commit -m "feat: add developer connections page"
```

---

### Task 7: Add Sidebar Navigation

**Files:**
- Modify: `apps/app/src/components/app-sidebar.tsx`
- Modify: `apps/app/src/__tests__/components/app-sidebar.test.tsx`

- [ ] **Step 1: Add failing sidebar tests**

Add to `apps/app/src/__tests__/components/app-sidebar.test.tsx`:

```ts
it("renders developer connections in workspace navigation", () => {
  render(<AppSidebar />);

  expect(
    screen.getByRole("link", { name: /developer connections/i })
  ).toHaveAttribute("href", "/acme/developer-connections");
});

it("marks developer connections active by route section", () => {
  pathname = "/acme/developer-connections";

  render(<AppSidebar />);

  const link = screen.getByRole("link", {
    name: /developer connections/i,
  });
  expect(link.closest("[data-active]")).toHaveAttribute("data-active", "true");
});
```

- [ ] **Step 2: Run sidebar tests to verify they fail**

Run:

```bash
pnpm --filter @lightfast/app test -- app-sidebar.test.tsx
```

Expected: FAIL because the nav item does not exist.

- [ ] **Step 3: Add the nav item**

Modify `apps/app/src/components/app-sidebar.tsx` imports:

```ts
import {
  Aperture,
  Blocks,
  BookOpen,
  HelpCircle,
  KeyRound,
  Mail,
  MessageCircle,
  Network,
  Scroll,
  Settings,
  Workflow,
  X,
} from "lucide-react";
```

Add after Connectors in `getOrgStandaloneItems`:

```ts
{
  title: "Developer Connections",
  href: `/${orgSlug}/developer-connections`,
  icon: KeyRound,
},
```

- [ ] **Step 4: Run sidebar tests**

Run:

```bash
pnpm --filter @lightfast/app test -- app-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/app-sidebar.tsx apps/app/src/__tests__/components/app-sidebar.test.tsx
git commit -m "feat: add developer connections navigation"
```

---

### Task 8: Generate Migration and Run Focused Verification

**Files:**
- Generate: `db/app/src/migrations/*`
- Modify: `db/app/src/migrations/meta/_journal.json`

- [ ] **Step 1: Generate migration**

Run from the repository root:

```bash
pnpm db:generate
```

Expected: Drizzle generates a migration for `lightfast_org_developer_connections` and `lightfast_developer_connection_leases`. Do not hand-write SQL.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @repo/developer-connection-contract test
pnpm --filter @db/app test -- developer-connections.test.ts
pnpm --filter @api/app test -- developer-connections-service.test.ts developer-connections-router.test.ts
pnpm --filter @lightfast/app test -- developer-connections-page.test.tsx app-sidebar.test.tsx
```

Expected: all PASS.

- [ ] **Step 3: Run focused typechecks**

Run:

```bash
pnpm --filter @repo/developer-connection-contract typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: all PASS.

- [ ] **Step 4: Run repo-level checks if focused checks pass**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit migration and verification fixes**

```bash
git add db/app/src/migrations db/app/src/migrations/meta/_journal.json
git commit -m "feat: add developer connection migrations"
```

---

## Self-Review Checklist

- Spec coverage:
  - Org-owned connections: Tasks 2-5.
  - Dedicated Developer Connections UI: Tasks 6-7.
  - One current connection per provider per org: Tasks 2-3.
  - Encrypted credential columns behind service boundary: Tasks 2 and 4.
  - Persistent actor-bound leases: Tasks 2-5.
  - 15 minute default and 30 minute max TTL: Task 3.
  - Lightfast-controlled sandbox runner materialization boundary: Task 4.
  - Sentry OAuth preferred path: Tasks 1, 4, 5, and 6 implement start/complete device-code auth through the auth-box service, with manual token fallback kept in the same dialog.
- Red-flag scan: run `rg -n 'T[B]D|TO[D]O|FIX[M]E|impleme[n]t later|fill in detai[l]s|appropriate error handlin[g]|handle edge case[s]|[Ss]imilar to|ma[y]be|uncle[a]r' docs/superpowers/plans/2026-06-03-developer-connections.md` before execution.
- Type consistency:
  - Router path is `org.workspace.developerConnections`.
  - UI route is `/{orgSlug}/developer-connections`.
  - Query param is `connection`.
  - DB current key helper is `currentDeveloperConnectionKey`.
