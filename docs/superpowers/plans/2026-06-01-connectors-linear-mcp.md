# Connectors Linear MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the org-level Connectors marketplace with a Linear MCP connector, local Linear emulator, and server-side connector runtime loader boundary.

**Architecture:** First split the MCP vendor boundary so connector code uses a pure MCP SDK wrapper. Then add a generic connector contract, generic org connector persistence, a Linear provider package, a Linear emulator, bound-org API services under `org.workspace.connectors`, and the single-page `/{slug}/connectors` marketplace UI. Runtime integration stops at a tested loader/call wrapper because automation AI execution is still scaffolded.

**Tech Stack:** pnpm workspace, Turborepo, Next.js App Router, tRPC, Drizzle ORM on PlanetScale MySQL/Vitess, Upstash Redis, Clerk org sessions, Linear OAuth with PKCE and `actor=app`, MCP Streamable HTTP, `@repo/app-encryption`, Portless, Vitest, React 19.

---

## File Structure

Create:

- `vendor/orpc-mcp-adapter/package.json` - renamed package for the existing oRPC contract to MCP adapter.
- `vendor/orpc-mcp-adapter/src/index.ts` - current `registerContractTools` implementation moved from `vendor/mcp`.
- `vendor/orpc-mcp-adapter/tsconfig.json` and `vendor/orpc-mcp-adapter/turbo.json` - vendor package config.
- `packages/connector-contract/package.json` - shared connector catalog and schema package.
- `packages/connector-contract/src/index.ts` - provider ids, catalog metadata, status schemas, display/full tool schemas, runtime tool name helpers, tRPC input/output schemas.
- `packages/connector-contract/src/__tests__/connector-contract.test.ts` - catalog, runtime tool id, and schema tests.
- `packages/connector-contract/tsconfig.json` and `packages/connector-contract/vitest.config.ts`.
- `packages/linear-app-node/package.json` - Linear protocol helper package.
- `packages/linear-app-node/src/oauth.ts` - PKCE, authorization URL, token exchange, refresh, revoke.
- `packages/linear-app-node/src/config.ts` - endpoint resolution and config errors.
- `packages/linear-app-node/src/metadata.ts` - Linear workspace/app actor metadata lookup.
- `packages/linear-app-node/src/mcp.ts` - MCP Streamable HTTP `listTools` and `callTool` helpers.
- `packages/linear-app-node/src/errors.ts` and `packages/linear-app-node/src/index.ts`.
- `packages/linear-app-node/src/__tests__/*.test.ts`.
- `db/app/src/schema/tables/org-connector-connections.ts` - Drizzle table and row types.
- `db/app/src/utils/org-connector-connections.ts` - repository helpers and lifecycle transitions.
- `db/app/src/__tests__/org-connector-connections.test.ts`.
- `emulators/linear/package.json`, `tsconfig.json`, `vitest.config.ts`.
- `emulators/linear/src/start.ts`, `env.ts`, `env-sh.ts`, `fixtures.ts`, `server.ts`, `README.md`.
- `emulators/linear/src/__tests__/server.test.ts`.
- `api/app/src/services/connectors/catalog.ts` - catalog response shaping and availability.
- `api/app/src/services/connectors/config.ts` - Linear connector config resolution.
- `api/app/src/services/connectors/auth.ts` - connector callback admin/session helper.
- `api/app/src/services/connectors/attempts.ts` - Redis-backed OAuth attempts.
- `api/app/src/services/connectors/linear-flow.ts` - connect/reconnect/callback/refresh/disconnect orchestration.
- `api/app/src/services/connectors/runtime.ts` - connector runtime loader and call wrapper.
- `api/app/src/services/connectors/index.ts`.
- `api/app/src/router/(pending-not-allowed)/connectors.ts` - `org.workspace.connectors` tRPC router.
- `apps/app/src/app/(app)/(connectors)/api/connectors/linear/oauth/callback/route.ts` - thin OAuth callback route.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page.tsx`.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-icons.tsx`.
- Focused tests under `api/app/src/__tests__/`, `apps/app/src/__tests__/`, package test folders, and emulator test folders named below.

Modify:

- `vendor/mcp/package.json` and `vendor/mcp/src/index.ts` - replace existing adapter with pure MCP SDK re-exports.
- `core/mcp/package.json`, `core/mcp/src/index.ts`, `core/mcp/src/__tests__/registration.test.ts` - import the adapter from `@vendor/orpc-mcp-adapter`.
- Root `package.json` and `turbo.json` - add Linear emulator dev task and verification filters.
- `apps/app/package.json` - inject Linear emulator env in `with-related-projects` and add connector contract dependency.
- `apps/app/src/proxy.ts` and `apps/app/src/__tests__/proxy.test.ts` - add connectors route policy and callback public route.
- `apps/app/src/components/app-sidebar.tsx` - add Connectors to Manage nav.
- `api/app/package.json` and `api/app/src/env.ts` - add connector/Linear dependencies and optional Linear env keys.
- `api/app/src/root.ts` - add `org.workspace.connectors`.
- `db/app/package.json`, `db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, and `db/app/src/index.ts` - export connector schema and repository helpers.
- `pnpm-lock.yaml` - updated by `pnpm install` after workspace package changes.

Do not modify:

- Existing GitHub source-control setup behavior or Clerk metadata mirrors.
- Existing automation executor scaffold beyond importing/testing the connector runtime boundary.
- Existing unrelated local changes in `CONTRIBUTING.md` or other docs unless the user explicitly asks.

## Task 1: Split MCP Vendor Packages

**Files:**
- Move: `vendor/mcp` to `vendor/orpc-mcp-adapter`
- Create: `vendor/mcp/src/index.ts`
- Modify: `core/mcp/package.json`
- Modify: `core/mcp/src/index.ts`
- Test: `core/mcp/src/__tests__/registration.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Move the existing adapter package**

Run:

```bash
mv vendor/mcp vendor/orpc-mcp-adapter
mkdir -p vendor/mcp/src
```

Expected: `vendor/orpc-mcp-adapter/src/index.ts` contains the current `registerContractTools` implementation.

- [ ] **Step 2: Rename the moved package**

In `vendor/orpc-mcp-adapter/package.json`, set:

```json
{
  "name": "@vendor/orpc-mcp-adapter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@orpc/contract": "^1.14.2",
    "@vendor/mcp": "workspace:*",
    "@vendor/observability": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 3: Update the adapter imports**

In `vendor/orpc-mcp-adapter/src/index.ts`, replace direct SDK imports with `@vendor/mcp` imports:

```ts
import type { McpServer } from "@vendor/mcp";
import { isContractProcedure } from "@orpc/contract";
import { parseError } from "@vendor/observability/error/next";

export type { McpServer } from "@vendor/mcp";
```

Keep the existing `RegisterContractToolsOptions` interface and `registerContractTools` implementation unchanged below those imports.

- [ ] **Step 4: Create the pure MCP SDK wrapper**

Create `vendor/mcp/package.json`:

```json
{
  "name": "@vendor/mcp",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

Create `vendor/mcp/src/index.ts`:

```ts
export { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
export { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
export { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
export type {
  CallToolResult,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
```

Create `vendor/mcp/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `vendor/mcp/turbo.json`:

```json
{
  "extends": ["//"],
  "tags": ["vendor"],
  "tasks": {}
}
```

- [ ] **Step 5: Update `core/mcp` imports**

In `core/mcp/package.json`, add the new adapter dependency:

```json
"@vendor/mcp": "workspace:*",
"@vendor/orpc-mcp-adapter": "workspace:*"
```

In `core/mcp/src/index.ts`, use:

```ts
import { McpServer, StdioServerTransport } from "@vendor/mcp";
import { registerContractTools } from "@vendor/orpc-mcp-adapter";
```

In `core/mcp/src/__tests__/registration.test.ts`, use:

```ts
import { McpClient as Client, InMemoryTransport, McpServer } from "@vendor/mcp";
import { registerContractTools } from "@vendor/orpc-mcp-adapter";
```

- [ ] **Step 6: Update root verification filter**

In root `package.json`, change `verify:orpc` to include both vendor packages:

```json
"verify:orpc": "SKIP_ENV_VALIDATION=true turbo run typecheck test --filter=@repo/api-contract --filter=@api/app --filter=lightfast --filter=@lightfastai/mcp --filter=@vendor/mcp --filter=@vendor/orpc-mcp-adapter --continue --summarize"
```

- [ ] **Step 7: Install and verify**

Run:

```bash
pnpm install
pnpm --filter @vendor/mcp typecheck
pnpm --filter @vendor/orpc-mcp-adapter typecheck
pnpm --filter @lightfastai/mcp test typecheck
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add vendor/mcp vendor/orpc-mcp-adapter core/mcp package.json pnpm-lock.yaml
git commit -m "refactor: split mcp vendor packages"
```

## Task 2: Add Connector Contract Package

**Files:**
- Create: `packages/connector-contract/package.json`
- Create: `packages/connector-contract/src/index.ts`
- Create: `packages/connector-contract/src/__tests__/connector-contract.test.ts`
- Create: `packages/connector-contract/tsconfig.json`
- Create: `packages/connector-contract/vitest.config.ts`

- [ ] **Step 1: Create failing contract tests**

Create `packages/connector-contract/src/__tests__/connector-contract.test.ts`:

```ts
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_CATALOG,
  connectorRuntimeToolName,
  connectorRuntimeToolNameSchema,
  connectorToolNameSchema,
  parseConnectorRuntimeToolName,
} from "../index";

describe("connector catalog", () => {
  it("keeps Linear connectable and coming-soon providers cataloged", () => {
    expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear"]);
    expect(CONNECTOR_CATALOG.map((entry) => entry.provider)).toContain(
      "linear"
    );
    expect(
      CONNECTOR_CATALOG.filter((entry) => entry.catalogStatus === "coming_soon")
        .length
    ).toBeGreaterThanOrEqual(3);
  });

  it("uses Lightfast as the v1 builder", () => {
    expect(CONNECTOR_CATALOG.every((entry) => entry.builder === "Lightfast")).toBe(
      true
    );
  });
});

describe("runtime tool names", () => {
  it("formats and parses provider-prefixed runtime tool names", () => {
    const runtimeName = connectorRuntimeToolName("linear", "create_issue");
    expect(runtimeName).toBe("linear__create_issue");
    expect(parseConnectorRuntimeToolName(runtimeName)).toEqual({
      provider: "linear",
      providerToolName: "create_issue",
    });
    expect(connectorRuntimeToolNameSchema.parse(runtimeName)).toBe(runtimeName);
  });

  it("rejects unsupported provider tool names", () => {
    expect(connectorToolNameSchema.parse("list_issues")).toBe("list_issues");
    expect(connectorToolNameSchema.parse("issue.search")).toBe("issue.search");
    expect(connectorToolNameSchema.parse("issue-search")).toBe("issue-search");
    expect(() => connectorToolNameSchema.parse("Create Issue")).toThrow();
  });
});
```

- [ ] **Step 2: Add package config**

Create `packages/connector-contract/package.json`:

```json
{
  "name": "@repo/connector-contract",
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

Create `packages/connector-contract/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/connector-contract/vitest.config.ts`:

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

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm --filter @repo/connector-contract test
```

Expected: FAIL because `src/index.ts` does not exist.

- [ ] **Step 4: Implement the contract**

Create `packages/connector-contract/src/index.ts`:

```ts
import { z } from "zod";

export const CONNECTOR_PROVIDERS = [
  "linear",
  "slack",
  "notion",
  "sentry",
] as const;
export const connectorProviderSchema = z.enum(CONNECTOR_PROVIDERS);
export type ConnectorProvider = z.infer<typeof connectorProviderSchema>;

export const CONNECTABLE_CONNECTOR_PROVIDERS = ["linear"] as const;
export const connectableConnectorProviderSchema = z.enum(
  CONNECTABLE_CONNECTOR_PROVIDERS
);
export type ConnectableConnectorProvider = z.infer<
  typeof connectableConnectorProviderSchema
>;

export const connectorConnectionStatusSchema = z.enum([
  "active",
  "error",
  "revoked",
]);
export type ConnectorConnectionStatus = z.infer<
  typeof connectorConnectionStatusSchema
>;

export const connectorCatalogStatusSchema = z.enum([
  "available",
  "coming_soon",
]);
export type ConnectorCatalogStatus = z.infer<
  typeof connectorCatalogStatusSchema
>;

export const connectorConnectUnavailableReasonSchema = z.enum([
  "missing_config",
  "permission_required",
  "coming_soon",
]);
export type ConnectorConnectUnavailableReason = z.infer<
  typeof connectorConnectUnavailableReasonSchema
>;

export const connectorToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_.-]+$/, "Unsupported connector tool name");
export type ConnectorToolName = z.infer<typeof connectorToolNameSchema>;

export const connectorRuntimeToolNameSchema = z
  .string()
  .regex(/^[a-z]+__[a-z0-9_.-]+$/, "Unsupported connector runtime tool name");
export type ConnectorRuntimeToolName = z.infer<
  typeof connectorRuntimeToolNameSchema
>;

export function connectorRuntimeToolName(
  provider: ConnectableConnectorProvider,
  providerToolName: string
): ConnectorRuntimeToolName {
  const parsedToolName = connectorToolNameSchema.parse(providerToolName);
  return connectorRuntimeToolNameSchema.parse(`${provider}__${parsedToolName}`);
}

export function parseConnectorRuntimeToolName(
  runtimeToolName: string
): {
  provider: ConnectableConnectorProvider;
  providerToolName: ConnectorToolName;
} {
  const parsed = connectorRuntimeToolNameSchema.parse(runtimeToolName);
  const [provider, providerToolName] = parsed.split("__");
  return {
    provider: connectableConnectorProviderSchema.parse(provider),
    providerToolName: connectorToolNameSchema.parse(providerToolName),
  };
}

export const fullConnectorToolManifestItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
});
export type FullConnectorToolManifestItem = z.infer<
  typeof fullConnectorToolManifestItemSchema
>;

export const fullConnectorToolManifestSchema = z.array(
  fullConnectorToolManifestItemSchema
);
export type FullConnectorToolManifest = z.infer<
  typeof fullConnectorToolManifestSchema
>;

export const displayConnectorToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  availableForAutomations: z.boolean(),
});
export type DisplayConnectorTool = z.infer<typeof displayConnectorToolSchema>;

export const CONNECTOR_CATALOG = [
  {
    provider: "linear",
    displayName: "Linear",
    description: "Find, create, and manage issues, projects, and comments in Linear.",
    builder: "Lightfast",
    category: "Project management",
    catalogStatus: "available",
  },
  {
    provider: "slack",
    displayName: "Slack",
    description: "Read and manage Slack conversations.",
    builder: "Lightfast",
    category: "Communication",
    catalogStatus: "coming_soon",
  },
  {
    provider: "notion",
    displayName: "Notion",
    description: "Reference Notion pages, specs, and research.",
    builder: "Lightfast",
    category: "Knowledge",
    catalogStatus: "coming_soon",
  },
  {
    provider: "sentry",
    displayName: "Sentry",
    description: "Investigate issues, releases, and events.",
    builder: "Lightfast",
    category: "Observability",
    catalogStatus: "coming_soon",
  },
] as const satisfies ReadonlyArray<{
  provider: ConnectorProvider;
  displayName: string;
  description: string;
  builder: "Lightfast";
  category: string;
  catalogStatus: ConnectorCatalogStatus;
}>;

export const connectorStartConnectInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
});

export const connectorProviderInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
});

export const connectorSetAutomationEnabledInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
  enabled: z.boolean(),
});
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm install
pnpm --filter @repo/connector-contract test typecheck
```

Expected: both commands exit 0.

Commit:

```bash
git add packages/connector-contract pnpm-lock.yaml
git commit -m "feat: add connector contract"
```

## Task 3: Add Connector Database Schema And Repository

**Files:**
- Create: `db/app/src/schema/tables/org-connector-connections.ts`
- Create: `db/app/src/utils/org-connector-connections.ts`
- Test: `db/app/src/__tests__/org-connector-connections.test.ts`
- Modify: `db/app/package.json`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Modify: `db/app/src/index.ts`

- [ ] **Step 1: Add dependency**

In `db/app/package.json`, add:

```json
"@repo/connector-contract": "workspace:*"
```

- [ ] **Step 2: Write failing repository tests**

Create `db/app/src/__tests__/org-connector-connections.test.ts` with tests covering:

```ts
import { describe, expect, it, vi } from "vitest";
import { currentOrgProviderKey } from "../utils/org-connector-connections";

describe("org connector connection helpers", () => {
  it("builds current org/provider uniqueness keys", () => {
    expect(currentOrgProviderKey("org_123", "linear")).toBe("org_123:linear");
  });

  it("exports a table with nullable encrypted tokens for revoked rows", async () => {
    const { orgConnectorConnections } = await import("../schema");
    expect(orgConnectorConnections.encryptedAccessToken.notNull).toBe(false);
    expect(orgConnectorConnections.toolManifest.notNull).toBe(true);
  });
});
```

Add helper tests with the mocked DB style used in `db/app/src/__tests__/user-source-control-account.test.ts` for:

- `finalizeCurrentOrgConnectorConnection` revokes a prior current row and inserts a new row.
- `markCurrentOrgConnectorConnectionRevoked` clears `currentOrgProviderKey`, token fields, `enabledForAutomations`, and `toolManifest`.
- `markCurrentOrgConnectorConnectionError` keeps token fields and forces `enabledForAutomations=false`.
- `updateConnectorToolManifest` overwrites manifest and clears refresh error fields on success.
- `recordConnectorToolRefreshError` preserves existing manifest.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/org-connector-connections.test.ts
```

Expected: FAIL because schema and helpers do not exist.

- [ ] **Step 4: Add Drizzle schema**

Create `db/app/src/schema/tables/org-connector-connections.ts` with:

```ts
import type {
  ConnectableConnectorProvider,
  ConnectorConnectionStatus,
  FullConnectorToolManifest,
} from "@repo/connector-contract";
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

const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const CURRENT_KEY_LENGTH = CLERK_ID_LENGTH + 1 + CODE_LENGTH;
const URL_LENGTH = 512;

export const orgConnectorConnections = mysqlTable(
  "lightfast_org_connector_connections",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    currentOrgProviderKey: varchar("current_org_provider_key", {
      length: CURRENT_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<ConnectableConnectorProvider>()
      .notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<ConnectorConnectionStatus>()
      .notNull(),
    connectedByUserId: varchar("connected_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    connectedAt: timestamp("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),
    providerWorkspaceId: varchar("provider_workspace_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerWorkspaceName: varchar("provider_workspace_name", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerActorId: varchar("provider_actor_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerActorName: varchar("provider_actor_name", {
      length: PROVIDER_REF_LENGTH,
    }),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      fsp: 3,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      fsp: 3,
    }),
    scopes: json("scopes").$type<string[]>().notNull(),
    mcpEndpoint: varchar("mcp_endpoint", { length: URL_LENGTH }).notNull(),
    toolManifest: json("tool_manifest")
      .$type<FullConnectorToolManifest>()
      .notNull(),
    lastToolRefreshAt: timestamp("last_tool_refresh_at", {
      mode: "date",
      fsp: 3,
    }),
    lastToolRefreshErrorAt: timestamp("last_tool_refresh_error_at", {
      mode: "date",
      fsp: 3,
    }),
    lastToolRefreshErrorCode: varchar("last_tool_refresh_error_code", {
      length: CODE_LENGTH,
    }),
    enabledForAutomations: boolean("enabled_for_automations")
      .default(false)
      .notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    currentOrgProviderUq: uniqueIndex(
      "org_connector_connections_current_org_provider_uq"
    ).on(table.currentOrgProviderKey),
    orgProviderStatusIdx: index(
      "org_connector_connections_org_provider_status_idx"
    ).on(table.clerkOrgId, table.provider, table.status),
    providerWorkspaceIdx: index(
      "org_connector_connections_provider_workspace_idx"
    ).on(table.provider, table.providerWorkspaceId),
  })
);

export type OrgConnectorConnection =
  typeof orgConnectorConnections.$inferSelect;
export type InsertOrgConnectorConnection =
  typeof orgConnectorConnections.$inferInsert;
```

- [ ] **Step 5: Add repository helpers**

Create `db/app/src/utils/org-connector-connections.ts` with exported helpers named:

- `currentOrgProviderKey(clerkOrgId, provider)`
- `getCurrentOrgConnectorConnection`
- `listCurrentOrgConnectorConnections`
- `finalizeCurrentOrgConnectorConnection`
- `markCurrentOrgConnectorConnectionRevoked`
- `markCurrentOrgConnectorConnectionError`
- `updateConnectorToolManifest`
- `recordConnectorToolRefreshError`
- `setConnectorAutomationEnabled`
- `updateObservedConnectorTokens`

Use the nullable mirror pattern from `db/app/src/utils/user-source-control-account.ts`: read the current row, update by id/status in a transaction where replacement is required, catch duplicate key races with `isDuplicateKeyError`, and return the selected row without exposing implementation mirror fields.

- [ ] **Step 6: Export schema and helpers**

Add exports to `db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, and `db/app/src/index.ts` matching existing table/helper export style.

- [ ] **Step 7: Generate migration and verify**

Run:

```bash
pnpm db:generate
pnpm --filter @db/app test -- src/__tests__/org-connector-connections.test.ts
pnpm --filter @db/app typecheck
```

Expected: all commands exit 0 and Drizzle creates migration artifacts under `db/app/src/migrations`.

- [ ] **Step 8: Commit**

```bash
git add db/app packages/connector-contract pnpm-lock.yaml
git commit -m "feat: add org connector persistence"
```

## Task 4: Add Linear Provider Package

**Files:**
- Create: `packages/linear-app-node/package.json`
- Create: `packages/linear-app-node/src/config.ts`
- Create: `packages/linear-app-node/src/oauth.ts`
- Create: `packages/linear-app-node/src/metadata.ts`
- Create: `packages/linear-app-node/src/mcp.ts`
- Create: `packages/linear-app-node/src/errors.ts`
- Create: `packages/linear-app-node/src/index.ts`
- Test: `packages/linear-app-node/src/__tests__/*.test.ts`

- [ ] **Step 1: Add package config**

Create `packages/linear-app-node/package.json` mirroring `packages/github-app-node/package.json`, with dependencies:

```json
"@repo/connector-contract": "workspace:*",
"@vendor/mcp": "workspace:*",
"zod": "catalog:"
```

Use `test` and `typecheck` scripts matching other package packages.

- [ ] **Step 2: Write failing tests**

Create tests for:

- `buildLinearOAuthAuthorizeUrl` includes `actor=app`, `scope=read,write`, state, PKCE challenge, and callback URL.
- `exchangeLinearOAuthCode` parses access token, optional refresh token, expiry fields, and exact scopes.
- `refreshLinearOAuthToken` keeps the old refresh token when Linear omits a replacement.
- `resolveLinearEndpoints` rejects custom endpoints outside development/test.
- `listLinearMcpTools` maps MCP tools to `FullConnectorToolManifest`.

- [ ] **Step 3: Implement config and errors**

`packages/linear-app-node/src/errors.ts`:

```ts
export class LinearAppNodeError extends Error {
  constructor(
    readonly code:
      | "LINEAR_CONFIG_INCOMPLETE"
      | "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN"
      | "LINEAR_OAUTH_EXCHANGE_FAILED"
      | "LINEAR_TOKEN_REFRESH_FAILED"
      | "LINEAR_REVOKE_FAILED"
      | "LINEAR_METADATA_FAILED"
      | "LINEAR_MCP_FAILED",
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "LinearAppNodeError";
  }
}
```

`packages/linear-app-node/src/config.ts` exports default endpoints and development-only custom endpoint resolution.

- [ ] **Step 4: Implement OAuth helpers**

`packages/linear-app-node/src/oauth.ts` exports:

- `createLinearPkcePair`
- `buildLinearOAuthAuthorizeUrl`
- `exchangeLinearOAuthCode`
- `refreshLinearOAuthToken`
- `revokeLinearOAuthToken`

Use Web Crypto or Node `crypto` following `packages/github-app-node/src/pkce.ts` and `oauth.ts` patterns.

- [ ] **Step 5: Implement metadata and MCP helpers**

`metadata.ts` exports `getLinearViewerMetadata`, returning:

```ts
export interface LinearConnectorMetadata {
  workspaceId: string;
  workspaceName: string;
  actorId?: string;
  actorName?: string;
}
```

`mcp.ts` uses `@vendor/mcp` `McpClient` and `StreamableHTTPClientTransport` to export:

```ts
export async function listLinearMcpTools(input: {
  accessToken: string;
  endpoint: string;
}): Promise<FullConnectorToolManifest>;
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm install
pnpm --filter @repo/linear-app-node test typecheck
```

Expected: both commands exit 0.

Commit:

```bash
git add packages/linear-app-node pnpm-lock.yaml
git commit -m "feat: add linear provider client"
```

## Task 5: Add Linear Emulator And Dev Wiring

**Files:**
- Create: `emulators/linear/*`
- Modify: root `package.json`
- Modify: root `turbo.json`
- Modify: `apps/app/package.json`

- [ ] **Step 1: Copy emulator structure**

Create `emulators/linear` using `emulators/github` as the file layout reference:

```bash
mkdir -p emulators/linear/src/__tests__
```

Package name is `@repo/linear-emulator`.

- [ ] **Step 2: Add deterministic fixtures**

Create `emulators/linear/src/fixtures.ts` exporting:

```ts
export const LINEAR_EMULATOR_FIXTURES = {
  oauthClientId: "linear_lightfast_local",
  oauthClientSecret: "linear-local-secret",
  workspaceId: "linear_workspace_lightfast_emulated",
  workspaceName: "lightfast-emulated",
  actorId: "linear_actor_lightfast_local",
  actorName: "Lightfast Local",
  accessToken: "linear_access_valid",
  refreshToken: "linear_refresh_valid",
};

export const LINEAR_EMULATOR_TOOLS = [
  "list_issues",
  "get_issue",
  "create_issue",
  "update_issue",
  "list_comments",
  "create_comment",
  "list_projects",
  "get_project",
  "list_teams",
  "get_team",
].map((name) => ({
  name,
  description: `Emulated Linear ${name}`,
  inputSchema: { type: "object", additionalProperties: true },
}));
```

- [ ] **Step 3: Implement env output**

`env-sh.ts` should print:

```sh
LINEAR_CLIENT_ID=linear_lightfast_local
LINEAR_CLIENT_SECRET=linear-local-secret
LINEAR_API_ORIGIN=<emulator-origin>
LINEAR_MCP_ENDPOINT=<emulator-origin>/mcp
```

Parse `--app-origin` and `--emulator-origin`, matching the GitHub emulator `env:sh` style.

- [ ] **Step 4: Implement OAuth/API/MCP routes**

`server.ts` should support:

- `GET /oauth/authorize` redirects back with `code` and `state`.
- `POST /oauth/token` exchanges code and refresh tokens.
- `POST /oauth/revoke` accepts valid tokens and returns 200.
- `GET /viewer` returns workspace and actor metadata.
- `POST /mcp` implements enough Streamable HTTP MCP behavior for the production client to list tools and call tools.
- `POST /reset` clears failure switches.
- Failure switches for expired access token, refresh failure, and MCP list-tools failure after token exchange.

- [ ] **Step 5: Write emulator tests**

In `emulators/linear/src/__tests__/server.test.ts`, cover:

- OAuth happy path.
- Invalid client credentials.
- Token refresh happy path and forced refresh failure.
- `/mcp` rejects missing/invalid bearer.
- `/mcp` lists deterministic tools for valid bearer.
- List-tools failure switch.
- Reset route.

- [ ] **Step 6: Wire root dev**

Root `package.json`:

```json
"_linear_emulator": "portless run --name linear.lightfast sh -c 'LIGHTFAST_APP_ORIGIN=\"$(portless get app.lightfast)\" LINEAR_EMULATOR_ORIGIN=\"$(portless get linear.lightfast)\" pnpm --filter @repo/linear-emulator dev'"
```

Add `//#_linear_emulator` to the `pnpm dev` turbo command.

Root `turbo.json`:

```json
"//#_linear_emulator": {
  "cache": false,
  "persistent": true
}
```

`apps/app/package.json` `with-related-projects` command should include:

```sh
$(pnpm --silent --filter @repo/linear-emulator env:sh -- --app-origin "$(portless get app.lightfast)" --emulator-origin "$(portless get linear.lightfast)")
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
pnpm install
pnpm --filter @repo/linear-emulator test typecheck
```

Expected: both commands exit 0.

Commit:

```bash
git add emulators/linear package.json turbo.json apps/app/package.json pnpm-lock.yaml
git commit -m "feat: add linear emulator"
```

## Task 6: Add Connector API Services And Router

**Files:**
- Create: `api/app/src/services/connectors/*`
- Create: `api/app/src/router/(pending-not-allowed)/connectors.ts`
- Modify: `api/app/package.json`
- Modify: `api/app/src/env.ts`
- Modify: `api/app/src/root.ts`
- Test: `api/app/src/__tests__/connectors-*.test.ts`

- [ ] **Step 1: Add dependencies and env**

In `api/app/package.json`, add:

```json
"@repo/connector-contract": "workspace:*",
"@repo/linear-app-node": "workspace:*"
```

In `api/app/src/env.ts`, add optional server env:

```ts
LINEAR_CLIENT_ID: z.string().min(1).optional(),
LINEAR_CLIENT_SECRET: z.string().min(1).optional(),
LINEAR_API_ORIGIN: z.string().url().optional(),
LINEAR_MCP_ENDPOINT: z.string().url().optional(),
```

Add them to `experimental__runtimeEnv`.

- [ ] **Step 2: Write failing service/router tests**

Add tests for:

- `list` returns `canManage`, catalog rows, coming-soon availability, and missing-config state.
- Non-admin members can list but cannot mutate.
- `startConnect` chooses `connect` or `reconnect` server-side.
- Missing Linear config returns a typed tRPC error.
- OAuth attempt issue/consume is one-time and hashed.
- Callback auth helper rejects unauthenticated, wrong user, wrong active org, and non-admin.
- Refresh tools leaves previous manifest on non-auth discovery failure.
- Disconnect wipes local tokens and manifest even when provider revoke fails.

- [ ] **Step 3: Implement connector config and catalog services**

`api/app/src/services/connectors/config.ts` should resolve optional Linear config and expose a typed missing-config result rather than throwing during list.

`catalog.ts` should shape `CONNECTOR_CATALOG` with connection state, `canManage`, `connectAvailability`, display-safe tools, and derived `availableForAutomations`.

- [ ] **Step 4: Implement attempts and auth helper**

`attempts.ts` should mirror `api/app/src/services/github/setup/attempts.ts` with prefix `linear-connect-oauth-attempt:` and 15 minute TTL.

`auth.ts` exports:

```ts
export async function assertCurrentSessionCanFinalizeConnectorOAuth(input: {
  clerkOrgId: string;
  expectedUserId: string;
}): Promise<{ userId: string }>;
```

Use `auth()` plus `findUserOrganizationMembership`, and require active session `orgId` to equal `input.clerkOrgId` when Clerk provides an active org.

- [ ] **Step 5: Implement Linear flow**

`linear-flow.ts` exports:

- `startLinearConnectorOAuth`
- `completeLinearConnectorOAuth`
- `refreshLinearConnectorTools`
- `setLinearConnectorAutomationEnabled`
- `disconnectLinearConnector`

Encrypt tokens with `@repo/app-encryption` and `env.ENCRYPTION_KEY`. Decrypt tokens only inside refresh/disconnect/MCP service calls.

- [ ] **Step 6: Implement router**

Create `api/app/src/router/(pending-not-allowed)/connectors.ts` using:

```ts
import {
  connectorProviderInputSchema,
  connectorSetAutomationEnabledInputSchema,
  connectorStartConnectInputSchema,
} from "@repo/connector-contract";
import { createTRPCRouter, boundOrgAdminProcedure, boundOrgProcedure } from "../../trpc";

export const connectorsRouter = createTRPCRouter({
  list: boundOrgProcedure.query(async ({ ctx }) => {
    return listConnectorsForOrg(ctx);
  }),
  startConnect: boundOrgAdminProcedure
    .input(connectorStartConnectInputSchema)
    .mutation(async ({ ctx, input }) => startConnectorOAuth(ctx, input)),
  refreshTools: boundOrgAdminProcedure
    .input(connectorProviderInputSchema)
    .mutation(async ({ ctx, input }) => refreshConnectorTools(ctx, input)),
  setAutomationEnabled: boundOrgAdminProcedure
    .input(connectorSetAutomationEnabledInputSchema)
    .mutation(async ({ ctx, input }) => setConnectorAutomationEnabled(ctx, input)),
  disconnect: boundOrgAdminProcedure
    .input(connectorProviderInputSchema)
    .mutation(async ({ ctx, input }) => disconnectConnector(ctx, input)),
});
```

Format imports to match the repo style and use service function names created in this task.

- [ ] **Step 7: Wire root router**

In `api/app/src/root.ts`, import and add:

```ts
import { connectorsRouter } from "./router/(pending-not-allowed)/connectors";

workspace: createTRPCRouter({
  automations: automationsRouter,
  connectors: connectorsRouter,
  people: workspacePeopleRouter,
  signals: workspaceSignalsRouter,
}),
```

- [ ] **Step 8: Verify and commit**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-router.test.ts src/__tests__/connectors-flow.test.ts
pnpm --filter @api/app typecheck
```

Expected: all commands exit 0.

Commit:

```bash
git add api/app pnpm-lock.yaml
git commit -m "feat: add connector api services"
```

## Task 7: Add OAuth Callback Route, Proxy Policy, And Runtime Loader

**Files:**
- Create: `apps/app/src/app/(app)/(connectors)/api/connectors/linear/oauth/callback/route.ts`
- Modify: `apps/app/src/proxy.ts`
- Modify: `apps/app/src/__tests__/proxy.test.ts`
- Create: `api/app/src/services/connectors/runtime.ts`
- Test: `api/app/src/__tests__/connectors-runtime.test.ts`
- Test: `apps/app/src/__tests__/app/api/connectors/connectors-routes.test.ts`

- [ ] **Step 1: Add callback route tests**

Create a route test matching `apps/app/src/__tests__/app/api/github/github-routes.test.ts`, asserting that the route delegates to `completeLinearConnectorOAuth({ requestUrl })` and redirects to its result.

- [ ] **Step 2: Add route handler**

Create `apps/app/src/app/(app)/(connectors)/api/connectors/linear/oauth/callback/route.ts`:

```ts
import { completeLinearConnectorOAuth } from "@api/app/services/connectors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeLinearConnectorOAuth({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
```

- [ ] **Step 3: Update proxy**

In `apps/app/src/proxy.ts`:

- Add `/api/connectors/linear/oauth/callback` to public route patterns.
- Add `{ clerkSync: true, pattern: "/:slug/connectors(.*)", setupExempt: false }` to `ORG_ROUTE_POLICIES`.

Update proxy tests to assert:

- Connectors is included in organization sync patterns.
- Unbound orgs are redirected from `/acme/connectors`.
- The callback route runs Clerk middleware but does not enforce signed-in routing.

- [ ] **Step 4: Write runtime loader tests**

Create `api/app/src/__tests__/connectors-runtime.test.ts` covering:

- Loads only `active` and `enabledForAutomations=true`.
- Excludes `error` rows with cached tools.
- Registers namespaced runtime ids.
- Excludes unsupported provider tool names.
- Re-checks current active/enabled state before call.
- Logs redacted tool-call data.

- [ ] **Step 5: Implement runtime loader**

`api/app/src/services/connectors/runtime.ts` exports:

```ts
export interface ConnectorRuntimeToolSource {
  provider: "linear";
  runtimeToolName: string;
  providerToolName: string;
  description?: string;
  call(input: unknown): Promise<unknown>;
}

export async function loadConnectorRuntimeTools(input: {
  clerkOrgId: string;
  automationPublicId?: string;
  runPublicId?: string;
}): Promise<ConnectorRuntimeToolSource[]>;
```

Use cached manifests for registration. The `call` closure loads the current row again, verifies `status="active"` and `enabledForAutomations=true`, refreshes tokens when needed, then calls the live Linear MCP endpoint.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/api/connectors/connectors-routes.test.ts
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: all commands exit 0.

Commit:

```bash
git add api/app apps/app
git commit -m "feat: add connector callback and runtime loader"
```

## Task 8: Build Connectors Page UI

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-icons.tsx`
- Modify: `apps/app/src/components/app-sidebar.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
- Test: `apps/app/src/__tests__/app-sidebar.test.tsx`

- [ ] **Step 1: Add sidebar tests**

Add a test asserting that `AppSidebar` renders a Manage item linking to `/${slug}/connectors` and marks it active for `/acme/connectors`.

- [ ] **Step 2: Update sidebar**

In `apps/app/src/components/app-sidebar.tsx`, import a lucide icon such as `PlugZap` and add:

```ts
{
  title: "Connectors",
  href: `/${orgSlug}/connectors`,
  icon: PlugZap,
},
```

Place it between Automations and Settings.

- [ ] **Step 3: Add page tests**

Create tests for:

- Page prefetches `trpc.org.workspace.connectors.list`.
- Catalog rows render.
- Connected Linear expands by default.
- Non-admin sees disabled mutation actions.
- Missing config disables Connect.
- `Tools stale` and `Needs reconnect` labels render from mocked data.
- Callback error query param renders inline and the client clears the URL.

- [ ] **Step 4: Add page server component**

Create `page.tsx`:

```tsx
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { ConnectorsClient } from "./_components/connectors-client";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connector?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  prefetch(trpc.org.workspace.connectors.list.queryOptions());

  return (
    <HydrateClient>
      <ConnectorsClient
        callbackConnector={
          Array.isArray(params.connector) ? params.connector[0] : params.connector
        }
        callbackError={Array.isArray(params.error) ? params.error[0] : params.error}
      />
    </HydrateClient>
  );
}
```

- [ ] **Step 5: Add icons**

`connector-icons.tsx` exports local React components for `linear`, `slack`, `notion`, and `sentry`. Use simple local markup/classes and no remote image URLs.

- [ ] **Step 6: Build client UI**

`connectors-client.tsx` should:

- Render centered `Connectors` header and description.
- Render search input, `Built by Lightfast` filter, and status filter.
- Render Linear featured hero using live state.
- Render catalog rows.
- Keep connected Linear expanded by default.
- Keep `See more` local-only.
- Use same-tab redirect for Connect/Reconnect from `startConnect`.
- Use explicit admin refresh/toggle/disconnect mutations.
- Confirm disconnect with an alert dialog.
- Clear callback query params with `router.replace(pathname)` after inline state is captured.

- [ ] **Step 7: Verify and commit**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app-sidebar.test.tsx src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/connectors-page.test.tsx
pnpm --filter @lightfast/app typecheck
```

Expected: all commands exit 0.

Commit:

```bash
git add apps/app
git commit -m "feat: add connectors marketplace ui"
```

## Task 9: Add Integration Coverage And Follow-Up Issue Notes

**Files:**
- Modify: `e2e` tests if the existing harness supports org workspace flows.
- Modify: `docs/superpowers/specs/2026-05-31-connectors-linear-mcp-design.md` only if implementation discoveries require spec corrections.
- Create or update: a short follow-up issue note in the project tracker for post-v1 warnings and stale-manifest retry.

- [ ] **Step 1: Add e2e coverage where the harness already has org auth**

Add a browser e2e that:

- Starts from `/{slug}/connectors`.
- Clicks Linear `Connect`.
- Completes the emulator OAuth redirect.
- Returns to `/{slug}/connectors`.
- Asserts Linear is connected, expanded, and shows deterministic tools.
- Toggles **Use in automations**.
- Disconnects and confirms the row collapses.

- [ ] **Step 2: Add reconnect stale-manifest e2e or integration test**

Use the emulator list-tools failure switch to verify:

- Initial connect stores tools.
- Reconnect OAuth succeeds.
- MCP discovery fails.
- New current row preserves the prior manifest.
- UI shows `Tools stale`.

- [ ] **Step 3: File follow-up issues**

Create follow-up GitHub issues or equivalent tracker items:

```md
Title: Warn when a Linear workspace is already connected to another Lightfast org
Body: V1 allows duplicate Linear workspace connections across Lightfast orgs. Add an admin warning after we define privacy-safe copy and cross-org lookup semantics.
```

```md
Title: Refresh and retry stale connector tool manifests
Body: V1 fails a connector tool call when the cached manifest contains a tool no longer supported by the live MCP server. Add a controlled refresh-and-retry path that does not surprise the automation runtime by changing tools mid-run.
```

- [ ] **Step 4: Run focused and broad verification**

Run:

```bash
pnpm --filter @vendor/mcp typecheck
pnpm --filter @vendor/orpc-mcp-adapter typecheck
pnpm --filter @lightfastai/mcp test typecheck
pnpm --filter @repo/connector-contract test typecheck
pnpm --filter @repo/linear-app-node test typecheck
pnpm --filter @repo/linear-emulator test typecheck
pnpm --filter @db/app test typecheck
pnpm --filter @api/app test typecheck
pnpm --filter @lightfast/app test typecheck
pnpm typecheck
```

Expected: every command exits 0.

- [ ] **Step 5: Run local dev verification**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open `https://lightfast.localhost`, navigate to `/{slug}/connectors`, and verify:

- Linear emulator is reachable through `https://linear.lightfast.localhost`.
- Linear connect redirects through the emulator and returns to the Connectors page.
- Connected row matches the approved UI direction.
- No browser console errors appear in the dev logs.

- [ ] **Step 6: Commit final verification support**

```bash
git add e2e docs/superpowers/specs/2026-05-31-connectors-linear-mcp-design.md
git commit -m "test: cover linear connector flow"
```

## Self-Review Checklist

- Spec coverage: Tasks cover vendor split, connector contract, DB lifecycle, Linear provider, Linear emulator, API/router/callback, runtime loader, UI, proxy, dev wiring, e2e, logging, and follow-up issue creation.
- Red-flag scan: Clear.
- Type consistency: The plan consistently uses `org.workspace.connectors`, `currentOrgProviderKey`, `enabledForAutomations`, `lastToolRefreshAt`, `lastToolRefreshErrorAt`, `lastToolRefreshErrorCode`, `connectAvailability`, `canManage`, and `connectorRuntimeToolName`.
- Commit shape: Each task has a focused commit so review can stop after any failed checkpoint without mixing unrelated subsystems.
