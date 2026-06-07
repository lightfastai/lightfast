# User And Team Connectors With Granola Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-owned Granola MCP connector that appears under `Your connectors` on the workspace Connectors page and is available only to the owning user in interactive workspace chats.

**Architecture:** Keep existing org connectors intact and add a parallel user connector model for Granola. The workspace Connectors page reads a new sectioned catalog containing `Team connectors` and `Your connectors`. Chat receives two generic user-connector tools, `findUserConnectorTools` and `callUserConnectorTool`, so Granola MCP tools stay private and do not become org provider routines.

**Tech Stack:** Next.js App Router, tRPC, Drizzle/MySQL, Vitest, Testing Library, AI SDK, MCP TypeScript SDK via `@vendor/mcp`, Granola remote MCP at `https://mcp.granola.ai/mcp`.

---

## Source References

- Granola MCP endpoint and auth model: https://docs.granola.ai/help-center/sharing/integrations/mcp
- MCP TypeScript SDK OAuth client guide: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md
- MCP `OAuthClientProvider` interface: https://ts.sdk.modelcontextprotocol.io/v2/interfaces/_modelcontextprotocol_client.client_auth.OAuthClientProvider.html

## File Structure

### Connector Contracts

- Modify `packages/connector-contract/src/index.ts`
  - Add `USER_CONNECTOR_PROVIDERS = ["granola"]`.
  - Add owner and section schemas used by API/UI.
  - Keep existing org provider ids and runtime helpers stable.
- Modify `packages/connector-contract/src/__tests__/connector-contract.test.ts`
  - Cover Granola provider ids, owner type parsing, and section input schemas.

### User Connector Chat Contract

- Create `packages/user-connector-contract/package.json`
- Create `packages/user-connector-contract/tsconfig.json`
- Create `packages/user-connector-contract/vitest.config.ts`
- Create `packages/user-connector-contract/src/index.ts`
- Create `packages/user-connector-contract/src/__tests__/user-connector-contract.test.ts`
  - Define generic chat tool inputs/outputs for user connectors.
  - Keep these separate from `provider-routine-contract` because Granola is not an org provider routine.

### Database

- Create `db/app/src/schema/tables/user-connectors.ts`
- Modify `db/app/src/schema/tables/index.ts`
- Modify `db/app/src/schema/index.ts`
- Create `db/app/src/utils/user-connector-connections.ts`
- Modify `db/app/src/index.ts`
- Create `db/app/src/__tests__/user-connector-connections.test.ts`
  - Store one current user connector per user/provider.
  - Preserve revoked row history and clear encrypted tokens on revoke.
  - Add helper functions parallel to org connector helpers.

### Granola MCP Package

- Modify `vendor/mcp/src/index.ts`
  - Export OAuth client types and `UnauthorizedError` needed by an outbound MCP OAuth client.
- Create `packages/granola-app-node/package.json`
- Create `packages/granola-app-node/tsconfig.json`
- Create `packages/granola-app-node/vitest.config.ts`
- Create `packages/granola-app-node/src/index.ts`
- Create `packages/granola-app-node/src/config.ts`
- Create `packages/granola-app-node/src/errors.ts`
- Create `packages/granola-app-node/src/oauth-provider.ts`
- Create `packages/granola-app-node/src/mcp.ts`
- Create `packages/granola-app-node/src/__tests__/oauth-provider.test.ts`
- Create `packages/granola-app-node/src/__tests__/mcp.test.ts`
  - Implement Streamable HTTP MCP listing/calling against Granola.
  - Implement a persisted-session OAuth provider for DCR/browser OAuth.

### API Services And Routes

- Create `api/app/src/services/user-connectors/catalog.ts`
- Create `api/app/src/services/user-connectors/attempts.ts`
- Create `api/app/src/services/user-connectors/granola-flow.ts`
- Create `api/app/src/services/user-connectors/runtime.ts`
- Create `api/app/src/services/user-connectors/index.ts`
- Create `api/app/src/router/(pending-not-allowed)/user-connectors.ts`
- Modify `api/app/src/router/(pending-not-allowed)/connectors.ts`
- Modify `api/app/src/root.ts`
- Create `apps/app/src/app/(app)/(connectors)/api/connectors/granola/oauth/callback/route.ts`
- Modify `apps/app/src/proxy.ts`
- Create `api/app/src/__tests__/user-connectors-router.test.ts`
- Create `api/app/src/__tests__/user-connectors-flow.test.ts`
- Create `api/app/src/__tests__/user-connectors-runtime.test.ts`
  - Add user connector list/start/complete/disconnect/refresh services.
  - Add sectioned workspace catalog.
  - Keep user connector mutations signed-in-user scoped.

### Workspace Connectors UI

- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page.tsx`
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-model.ts`
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.tsx`
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-icons.tsx`
- Modify `packages/ui/src/components/integration-icons.tsx`
- Modify connector page tests under `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
- Modify connector component tests under `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/`
  - Render `Team connectors` and `Your connectors`.
  - Add `Team` and `Only you` badges.
  - Hide automations/admin controls from user connector cards.

### Chat Runtime And UI

- Modify `ai/src/workspace-assistant/message-schema.ts`
- Modify `ai/src/__tests__/workspace-assistant/message-schema.test.ts`
- Modify `apps/app/src/app/(chat)/api/chat/route.ts`
- Modify chat route tests under `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx`
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/message-part.tsx`
- Modify `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx`
  - Add generic user connector tools.
  - Make Granola private to the acting chat user.
  - Render `Used Granola` for successful Granola tool output.

## Task 1: Extend Connector Contracts For Ownership

**Files:**

- Modify: `packages/connector-contract/src/index.ts`
- Modify: `packages/connector-contract/src/__tests__/connector-contract.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests that prove org providers stay stable and Granola is a user provider:

```ts
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  USER_CONNECTOR_PROVIDERS,
  connectorOwnerTypeSchema,
  userConnectorProviderSchema,
  userConnectorStartConnectInputSchema,
} from "../index";

describe("connector ownership", () => {
  it("keeps existing org connector providers stable", () => {
    expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
  });

  it("adds Granola as a user connector provider", () => {
    expect(USER_CONNECTOR_PROVIDERS).toEqual(["granola"]);
    expect(userConnectorProviderSchema.parse("granola")).toBe("granola");
    expect(userConnectorProviderSchema.safeParse("linear").success).toBe(false);
  });

  it("parses connector owner types and user start inputs", () => {
    expect(connectorOwnerTypeSchema.parse("org")).toBe("org");
    expect(connectorOwnerTypeSchema.parse("user")).toBe("user");
    expect(
      userConnectorStartConnectInputSchema.parse({ provider: "granola" })
    ).toEqual({ provider: "granola" });
  });
});
```

- [ ] **Step 2: Run the contract test and verify failure**

Run:

```bash
pnpm --filter @repo/connector-contract test -- --runInBand
```

Expected: fail because the user connector exports do not exist.

- [ ] **Step 3: Add user connector contract exports**

Add this near the existing provider declarations in `packages/connector-contract/src/index.ts`:

```ts
export const USER_CONNECTOR_PROVIDERS = ["granola"] as const;
export const userConnectorProviderSchema = z.enum(USER_CONNECTOR_PROVIDERS);
export type UserConnectorProvider = z.infer<
  typeof userConnectorProviderSchema
>;

export const connectorOwnerTypeSchema = z.enum(["org", "user"]);
export type ConnectorOwnerType = z.infer<typeof connectorOwnerTypeSchema>;

export const userConnectorConnectionStatusSchema =
  connectorConnectionStatusSchema;
export type UserConnectorConnectionStatus = ConnectorConnectionStatus;

export const userConnectorStartConnectInputSchema = z.object({
  provider: userConnectorProviderSchema,
});

export const userConnectorProviderInputSchema = z.object({
  provider: userConnectorProviderSchema,
});
```

Add Granola catalog metadata:

```ts
export const USER_CONNECTOR_CATALOG = [
  {
    provider: "granola",
    displayName: "Granola",
    description:
      "Search and reference your private Granola meeting notes in Lightfast chats.",
    builder: "Granola",
    category: "Meeting notes",
    catalogStatus: "available",
  },
] as const satisfies ReadonlyArray<{
  provider: UserConnectorProvider;
  displayName: string;
  description: string;
  builder: "Granola";
  category: string;
  catalogStatus: ConnectorCatalogStatus;
}>;
```

- [ ] **Step 4: Run the contract test and verify pass**

Run:

```bash
pnpm --filter @repo/connector-contract test -- --runInBand
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/connector-contract/src/index.ts packages/connector-contract/src/__tests__/connector-contract.test.ts
git commit -m "feat: add user connector contract"
```

## Task 2: Add User Connector Chat Tool Contract

**Files:**

- Create: `packages/user-connector-contract/package.json`
- Create: `packages/user-connector-contract/tsconfig.json`
- Create: `packages/user-connector-contract/vitest.config.ts`
- Create: `packages/user-connector-contract/src/index.ts`
- Create: `packages/user-connector-contract/src/__tests__/user-connector-contract.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add package metadata**

Create `packages/user-connector-contract/package.json`:

```json
{
  "name": "@repo/user-connector-contract",
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
    "@repo/connector-contract": "workspace:*",
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

Create `packages/user-connector-contract/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "vitest.config.ts"]
}
```

Create `packages/user-connector-contract/vitest.config.ts`:

```ts
import { defineConfig } from "@repo/vitest-config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

No root workspace edit is required if `pnpm-workspace.yaml` already includes `packages/*`. If it does not, add `packages/*` there before running install.

- [ ] **Step 2: Write failing tests for the tool contract**

Create `packages/user-connector-contract/src/__tests__/user-connector-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  userConnectorCallInputSchema,
  userConnectorFindInputSchema,
  userConnectorRoutineId,
  userConnectorRoutineIdSchema,
} from "../index";

describe("user connector contract", () => {
  it("formats Granola routine ids", () => {
    expect(userConnectorRoutineId("granola", "search_notes")).toBe(
      "granola__search_notes"
    );
    expect(userConnectorRoutineIdSchema.parse("granola__search_notes")).toBe(
      "granola__search_notes"
    );
    expect(userConnectorRoutineIdSchema.safeParse("linear__viewer").success).toBe(
      false
    );
  });

  it("parses find and call inputs", () => {
    expect(
      userConnectorFindInputSchema.parse({
        includeSchema: true,
        provider: "granola",
        query: "actions",
      })
    ).toEqual({
      includeSchema: true,
      provider: "granola",
      query: "actions",
    });

    expect(
      userConnectorCallInputSchema.parse({
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).toEqual({
      input: { query: "SOC2" },
      routineId: "granola__search_notes",
    });
  });
});
```

- [ ] **Step 3: Run the new package test and verify failure**

Run:

```bash
pnpm --filter @repo/user-connector-contract test -- --runInBand
```

Expected: fail because `src/index.ts` does not exist.

- [ ] **Step 4: Implement the contract**

Create `packages/user-connector-contract/src/index.ts`:

```ts
import {
  type UserConnectorProvider,
  userConnectorProviderSchema,
} from "@repo/connector-contract";
import { z } from "zod";

export const userConnectorToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+$/, "Unsupported user connector tool name");
export type UserConnectorToolName = z.infer<
  typeof userConnectorToolNameSchema
>;

export const userConnectorRoutineIdSchema = z.string().refine((routineId) => {
  const separatorIndex = routineId.indexOf("__");
  if (separatorIndex <= 0) {
    return false;
  }

  const provider = routineId.slice(0, separatorIndex);
  const providerToolName = routineId.slice(separatorIndex + 2);

  return (
    userConnectorProviderSchema.safeParse(provider).success &&
    userConnectorToolNameSchema.safeParse(providerToolName).success
  );
}, "Unsupported user connector routine id");
export type UserConnectorRoutineId = z.infer<
  typeof userConnectorRoutineIdSchema
>;

export function userConnectorRoutineId(
  provider: UserConnectorProvider,
  providerToolName: string
): UserConnectorRoutineId {
  const parsedProvider = userConnectorProviderSchema.parse(provider);
  const parsedToolName = userConnectorToolNameSchema.parse(providerToolName);
  return userConnectorRoutineIdSchema.parse(
    `${parsedProvider}__${parsedToolName}`
  );
}

export function parseUserConnectorRoutineId(routineId: string): {
  provider: UserConnectorProvider;
  providerToolName: UserConnectorToolName;
} {
  const parsed = userConnectorRoutineIdSchema.parse(routineId);
  const separatorIndex = parsed.indexOf("__");
  const provider = parsed.slice(0, separatorIndex);
  const providerToolName = parsed.slice(separatorIndex + 2);
  return {
    provider: userConnectorProviderSchema.parse(provider),
    providerToolName: userConnectorToolNameSchema.parse(providerToolName),
  };
}

export const userConnectorRoutineSummarySchema = z.object({
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
  inputSummary: z.string().optional(),
  provider: userConnectorProviderSchema,
  providerToolName: userConnectorToolNameSchema,
  routineId: userConnectorRoutineIdSchema,
  title: z.string(),
});
export type UserConnectorRoutineSummary = z.infer<
  typeof userConnectorRoutineSummarySchema
>;

export const userConnectorFindInputSchema = z
  .object({
    includeSchema: z.boolean().optional(),
    limit: z.number().int().min(1).max(20).optional(),
    provider: userConnectorProviderSchema.optional(),
    query: z.string().min(1).max(200).optional(),
    routineId: userConnectorRoutineIdSchema.optional(),
  })
  .strict();
export type UserConnectorFindInput = z.infer<
  typeof userConnectorFindInputSchema
>;

export const userConnectorFindOutputSchema = z.object({
  reason: z.enum(["no_connected_user_connectors", "no_matching_tools"]).optional(),
  routines: z.array(userConnectorRoutineSummarySchema),
});
export type UserConnectorFindOutput = z.infer<
  typeof userConnectorFindOutputSchema
>;

export const userConnectorCallInputSchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
    routineId: userConnectorRoutineIdSchema,
  })
  .strict();
export type UserConnectorCallInput = z.infer<
  typeof userConnectorCallInputSchema
>;

export const userConnectorCallSuccessSchema = z.object({
  provider: userConnectorProviderSchema,
  providerToolName: userConnectorToolNameSchema,
  result: z.unknown(),
  routineId: userConnectorRoutineIdSchema,
  status: z.literal("succeeded"),
});
export type UserConnectorCallSuccess = z.infer<
  typeof userConnectorCallSuccessSchema
>;
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @repo/user-connector-contract test -- --runInBand
pnpm --filter @repo/user-connector-contract typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/user-connector-contract package.json pnpm-lock.yaml
git commit -m "feat: add user connector chat contract"
```

## Task 3: Add User Connector Database Table And Helpers

**Files:**

- Create: `db/app/src/schema/tables/user-connectors.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Create: `db/app/src/utils/user-connector-connections.ts`
- Modify: `db/app/src/index.ts`
- Create: `db/app/src/__tests__/user-connector-connections.test.ts`

- [ ] **Step 1: Write failing DB helper tests**

Create `db/app/src/__tests__/user-connector-connections.test.ts` with tests parallel to `org-connector-connections.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import type { UserConnectorConnection } from "../schema";
import {
  currentUserProviderKey,
  finalizeCurrentUserConnectorConnection,
  markCurrentUserConnectorConnectionError,
  markCurrentUserConnectorConnectionRevoked,
} from "../utils/user-connector-connections";

const toolManifest = [
  {
    name: "search_notes",
    description: "Search Granola notes",
    inputSchema: { type: "object" },
  },
];

function connection(
  overrides: Partial<UserConnectorConnection> = {}
): UserConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    clerkUserId: "user_123",
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    id: 1,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    mcpEndpoint: "https://mcp.granola.ai/mcp",
    metadata: {},
    provider: "granola",
    providerAccountId: null,
    providerAccountName: null,
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
    scopes: [],
    status: "active",
    toolManifest,
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function selectRows<T>(rows: T[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

describe("user connector connection helpers", () => {
  it("builds current user/provider uniqueness keys", () => {
    expect(currentUserProviderKey("user_123", "granola")).toBe(
      "user_123:granola"
    );
  });

  it("exports a table with nullable encrypted tokens for revoked rows", async () => {
    const { userConnectorConnections } = await import("../schema");
    expect(userConnectorConnections.encryptedAccessToken.notNull).toBe(false);
    expect(userConnectorConnections.encryptedRefreshToken.notNull).toBe(false);
    expect(userConnectorConnections.toolManifest.notNull).toBe(true);
  });

  it("finalizes current user connector connections by revoking prior rows and inserting replacement rows", async () => {
    const previous = connection({ id: 1 });
    const inserted = connection({
      id: 2,
      encryptedAccessToken: "encrypted_access_next",
      encryptedRefreshToken: "encrypted_refresh_next",
    });
    const revokeWhereMock = vi.fn(() => Promise.resolve({ affectedRows: 1 }));
    const revokeSetMock = vi.fn(() => ({ where: revokeWhereMock }));
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: 2 }]),
    }));
    const tx = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi
        .fn()
        .mockReturnValueOnce(selectRows([previous]))
        .mockReturnValueOnce(selectRows([inserted])),
      update: vi.fn(() => ({ set: revokeSetMock })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      finalizeCurrentUserConnectorConnection(db, {
        accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
        clerkUserId: "user_123",
        encryptedAccessToken: "encrypted_access_next",
        encryptedRefreshToken: "encrypted_refresh_next",
        mcpEndpoint: "https://mcp.granola.ai/mcp",
        metadata: {},
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "granola",
        providerAccountId: null,
        providerAccountName: null,
        refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
        scopes: [],
        toolManifest,
      })
    ).resolves.toMatchObject({
      id: 2,
      encryptedAccessToken: "encrypted_access_next",
    });

    expect(revokeSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserProviderKey: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        revokedAt: expect.any(Date),
        status: "revoked",
        toolManifest: [],
        updatedAt: expect.any(Date),
      })
    );
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_123",
        currentUserProviderKey: "user_123:granola",
        provider: "granola",
        status: "active",
      })
    );
  });

  it("marks only the current user's connector row revoked or errored", async () => {
    const current = connection();
    const updateWhereMock = vi.fn(() => Promise.resolve({ affectedRows: 1 }));
    const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectRows([current]))
        .mockReturnValueOnce(selectRows([{ ...current, status: "revoked" }]))
        .mockReturnValueOnce(selectRows([current]))
        .mockReturnValueOnce(selectRows([{ ...current, status: "error" }])),
      update: vi.fn(() => ({ set: updateSetMock })),
    } as unknown as Database;

    await expect(
      markCurrentUserConnectorConnectionRevoked(db, {
        clerkUserId: "user_123",
        provider: "granola",
      })
    ).resolves.toMatchObject({ status: "revoked" });
    await expect(
      markCurrentUserConnectorConnectionError(db, {
        clerkUserId: "user_123",
        provider: "granola",
      })
    ).resolves.toMatchObject({ status: "error" });

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "revoked" })
    );
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" })
    );
  });
});
```

- [ ] **Step 2: Run DB tests and verify failure**

Run:

```bash
pnpm --filter @db/app test -- --runInBand user-connector-connections
```

Expected: fail because the table and helpers do not exist.

- [ ] **Step 3: Add the user connector table**

Create `db/app/src/schema/tables/user-connectors.ts`:

```ts
import type {
  FullConnectorToolManifest,
  UserConnectorConnectionStatus,
  UserConnectorProvider,
} from "@repo/connector-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const CURRENT_KEY_LENGTH = CLERK_ID_LENGTH + 1 + CODE_LENGTH;
const URL_LENGTH = 512;

export const userConnectorConnections = mysqlTable(
  "lightfast_user_connector_connections",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    currentUserProviderKey: varchar("current_user_provider_key", {
      length: CURRENT_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<UserConnectorProvider>()
      .notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<UserConnectorConnectionStatus>()
      .notNull(),
    connectedAt: datetime("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    providerAccountId: varchar("provider_account_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerAccountName: varchar("provider_account_name", {
      length: PROVIDER_REF_LENGTH,
    }),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    accessTokenExpiresAt: datetime("access_token_expires_at", {
      mode: "date",
      fsp: 3,
    }),
    refreshTokenExpiresAt: datetime("refresh_token_expires_at", {
      mode: "date",
      fsp: 3,
    }),
    scopes: json("scopes").$type<string[]>().notNull(),
    mcpEndpoint: varchar("mcp_endpoint", { length: URL_LENGTH }).notNull(),
    toolManifest: json("tool_manifest")
      .$type<FullConnectorToolManifest>()
      .notNull(),
    lastToolRefreshAt: datetime("last_tool_refresh_at", {
      mode: "date",
      fsp: 3,
    }),
    lastToolRefreshErrorAt: datetime("last_tool_refresh_error_at", {
      mode: "date",
      fsp: 3,
    }),
    lastToolRefreshErrorCode: varchar("last_tool_refresh_error_code", {
      length: CODE_LENGTH,
    }),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    currentUserProviderUq: uniqueIndex(
      "user_connector_connections_current_user_provider_uq"
    ).on(table.currentUserProviderKey),
    userProviderStatusIdx: index(
      "user_connector_connections_user_provider_status_idx"
    ).on(table.clerkUserId, table.provider, table.status),
  })
);

type UserConnectorConnectionRow =
  typeof userConnectorConnections.$inferSelect;
export type UserConnectorConnection = Omit<
  UserConnectorConnectionRow,
  "currentUserProviderKey"
>;
export type InsertUserConnectorConnection =
  typeof userConnectorConnections.$inferInsert;
```

Update `db/app/src/schema/tables/index.ts` and `db/app/src/schema/index.ts` to export:

```ts
export {
  type InsertUserConnectorConnection,
  type UserConnectorConnection,
  userConnectorConnections,
} from "./user-connectors";
```

- [ ] **Step 4: Add DB helpers**

Create `db/app/src/utils/user-connector-connections.ts` using the org helper shape. Include these exports:

```ts
export function currentUserProviderKey(
  clerkUserId: string,
  provider: UserConnectorProvider
) {
  return `${clerkUserId}:${provider}`;
}

export async function getCurrentUserConnectorConnection(
  db: Database,
  input: { clerkUserId: string; provider: UserConnectorProvider }
): Promise<UserConnectorConnection | undefined>;

export async function listCurrentUserConnectorConnections(
  db: Database,
  input: { clerkUserId: string }
): Promise<UserConnectorConnection[]>;

export async function finalizeCurrentUserConnectorConnection(
  db: Database,
  input: FinalizeCurrentUserConnectorConnectionInput
): Promise<UserConnectorConnection>;

export async function markCurrentUserConnectorConnectionRevoked(
  db: Database,
  input: ObservedCurrentUserConnectorConnectionInput
): Promise<UserConnectorConnection | undefined>;

export async function markCurrentUserConnectorConnectionError(
  db: Database,
  input: { clerkUserId: string; provider: UserConnectorProvider }
): Promise<UserConnectorConnection | undefined>;

export async function updateUserConnectorToolManifest(
  db: Database,
  input: {
    clerkUserId: string;
    lastToolRefreshAt: Date;
    provider: UserConnectorProvider;
    toolManifest: FullConnectorToolManifest;
  }
): Promise<boolean>;
```

Use the same observed-current guard pattern as `db/app/src/utils/org-connector-connections.ts`. The revoke values must set:

```ts
{
  accessTokenExpiresAt: null,
  currentUserProviderKey: null,
  encryptedAccessToken: null,
  encryptedRefreshToken: null,
  refreshTokenExpiresAt: null,
  revokedAt: now,
  status: "revoked" as const,
  toolManifest: [],
  updatedAt: now,
}
```

Update `db/app/src/index.ts` to export all helpers from `./utils/user-connector-connections`.

- [ ] **Step 5: Run DB tests and typecheck**

Run:

```bash
pnpm --filter @db/app test -- --runInBand user-connector-connections
pnpm --filter @db/app typecheck
```

Expected: both pass.

- [ ] **Step 6: Generate database migration**

Run:

```bash
pnpm db:generate
```

Expected: Drizzle generates the migration for `lightfast_user_connector_connections`. Do not hand-write SQL.

- [ ] **Step 7: Commit**

Run:

```bash
git add db/app drizzle package.json pnpm-lock.yaml
git commit -m "feat: add user connector persistence"
```

## Task 4: Add Granola MCP Client Package

**Files:**

- Modify: `vendor/mcp/src/index.ts`
- Create: `packages/granola-app-node/package.json`
- Create: `packages/granola-app-node/tsconfig.json`
- Create: `packages/granola-app-node/vitest.config.ts`
- Create: `packages/granola-app-node/src/index.ts`
- Create: `packages/granola-app-node/src/config.ts`
- Create: `packages/granola-app-node/src/errors.ts`
- Create: `packages/granola-app-node/src/oauth-provider.ts`
- Create: `packages/granola-app-node/src/mcp.ts`
- Create: `packages/granola-app-node/src/__tests__/oauth-provider.test.ts`
- Create: `packages/granola-app-node/src/__tests__/mcp.test.ts`

- [ ] **Step 1: Export MCP OAuth client types**

Modify `vendor/mcp/src/index.ts`:

```ts
export type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/client/auth.js";
export { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
```

Run:

```bash
pnpm --filter @vendor/mcp typecheck
```

Expected: pass. If the SDK path has moved, inspect the installed SDK type exports and use the path that exports the same five symbols.

- [ ] **Step 2: Create package metadata**

Create `packages/granola-app-node/package.json`:

```json
{
  "name": "@repo/granola-app-node",
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
    "@repo/connector-contract": "workspace:*",
    "@vendor/mcp": "workspace:*",
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

Create matching `tsconfig.json` and `vitest.config.ts` using the same structure as `packages/x-app-node`.

- [ ] **Step 3: Write OAuth provider tests**

Create `packages/granola-app-node/src/__tests__/oauth-provider.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { GranolaOAuthClientProvider } from "../oauth-provider";

describe("GranolaOAuthClientProvider", () => {
  it("captures the authorization redirect instead of opening a browser", async () => {
    const onAuthorizationUrl = vi.fn();
    const provider = new GranolaOAuthClientProvider({
      clientInformation: undefined,
      clientMetadata: {
        client_name: "Lightfast",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: [
          "https://app.lightfast.localhost/api/connectors/granola/oauth/callback",
        ],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
      },
      codeVerifier: undefined,
      redirectUrl:
        "https://app.lightfast.localhost/api/connectors/granola/oauth/callback",
      tokens: undefined,
      onAuthorizationUrl,
    });

    await provider.redirectToAuthorization(
      new URL("https://granola.test/oauth/authorize?state=abc")
    );
    expect(onAuthorizationUrl).toHaveBeenCalledWith(
      new URL("https://granola.test/oauth/authorize?state=abc")
    );
  });

  it("stores client information, verifier, and tokens in memory for the current session", async () => {
    const provider = new GranolaOAuthClientProvider({
      clientInformation: undefined,
      clientMetadata: {
        client_name: "Lightfast",
        redirect_uris: ["https://app.test/callback"],
      },
      codeVerifier: undefined,
      redirectUrl: "https://app.test/callback",
      tokens: undefined,
      onAuthorizationUrl: () => undefined,
    });

    await provider.saveClientInformation({
      client_id: "client_123",
      client_secret: "secret_123",
    });
    await provider.saveCodeVerifier("verifier_123");
    await provider.saveTokens({
      access_token: "access_123",
      refresh_token: "refresh_123",
      token_type: "Bearer",
    });

    expect(await provider.clientInformation()).toEqual({
      client_id: "client_123",
      client_secret: "secret_123",
    });
    expect(await provider.codeVerifier()).toBe("verifier_123");
    expect(await provider.tokens()).toEqual({
      access_token: "access_123",
      refresh_token: "refresh_123",
      token_type: "Bearer",
    });
  });
});
```

- [ ] **Step 4: Implement OAuth provider and errors**

Create `packages/granola-app-node/src/errors.ts`:

```ts
export type GranolaAppNodeErrorCode =
  | "GRANOLA_MCP_AUTH_REQUIRED"
  | "GRANOLA_MCP_FAILED"
  | "GRANOLA_TOKEN_REFRESH_FAILED";

export class GranolaAppNodeError extends Error {
  constructor(
    readonly code: GranolaAppNodeErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "GranolaAppNodeError";
  }
}
```

Create `packages/granola-app-node/src/oauth-provider.ts`:

```ts
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@vendor/mcp";

export interface GranolaOAuthClientProviderInput {
  clientInformation: OAuthClientInformationMixed | undefined;
  clientMetadata: OAuthClientMetadata;
  codeVerifier: string | undefined;
  onAuthorizationUrl: (authorizationUrl: URL) => void | Promise<void>;
  redirectUrl: string;
  tokens: OAuthTokens | undefined;
}

export class GranolaOAuthClientProvider implements OAuthClientProvider {
  private currentClientInformation:
    | OAuthClientInformationMixed
    | undefined;
  private currentCodeVerifier: string | undefined;
  private currentTokens: OAuthTokens | undefined;

  constructor(private readonly input: GranolaOAuthClientProviderInput) {
    this.currentClientInformation = input.clientInformation;
    this.currentCodeVerifier = input.codeVerifier;
    this.currentTokens = input.tokens;
  }

  get clientMetadata() {
    return this.input.clientMetadata;
  }

  get redirectUrl() {
    return this.input.redirectUrl;
  }

  clientInformation() {
    return this.currentClientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed) {
    this.currentClientInformation = clientInformation;
  }

  tokens() {
    return this.currentTokens;
  }

  saveTokens(tokens: OAuthTokens) {
    this.currentTokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL) {
    return this.input.onAuthorizationUrl(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string) {
    this.currentCodeVerifier = codeVerifier;
  }

  codeVerifier() {
    if (!this.currentCodeVerifier) {
      throw new Error("Granola OAuth code verifier is missing.");
    }
    return this.currentCodeVerifier;
  }

  snapshot() {
    return {
      clientInformation: this.currentClientInformation,
      codeVerifier: this.currentCodeVerifier,
      tokens: this.currentTokens,
    };
  }
}
```

- [ ] **Step 5: Implement config and MCP helpers**

Create `packages/granola-app-node/src/config.ts`:

```ts
export const DEFAULT_GRANOLA_MCP_ENDPOINT = "https://mcp.granola.ai/mcp";

export function granolaClientMetadata(input: { redirectUrl: string }) {
  return {
    client_name: "Lightfast",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [input.redirectUrl],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  } as const;
}
```

Create `packages/granola-app-node/src/mcp.ts` by adapting the Linear MCP helper and accepting `authProvider` instead of raw bearer headers:

```ts
import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@repo/connector-contract";
import {
  McpClient,
  StreamableHTTPClientTransport,
  type Tool,
  UnauthorizedError,
  type OAuthClientProvider,
} from "@vendor/mcp";
import { GranolaAppNodeError } from "./errors";

const DEFAULT_GRANOLA_MCP_TIMEOUT_MS = 10_000;
const DEFAULT_GRANOLA_MCP_CLOSE_TIMEOUT_MS = 1000;

export async function listGranolaMcpTools(input: {
  authProvider: OAuthClientProvider;
  endpoint: string;
  timeoutMs?: number;
}): Promise<FullConnectorToolManifest> {
  const { client } = await connectGranolaClient(input);
  try {
    const { tools } = await withAbort(
      client.listTools(),
      AbortSignal.timeout(input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS)
    );
    return fullConnectorToolManifestSchema.parse(tools.map(toManifestItem));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new GranolaAppNodeError(
        "GRANOLA_MCP_AUTH_REQUIRED",
        "Granola authorization is required.",
        error
      );
    }
    throw new GranolaAppNodeError(
      "GRANOLA_MCP_FAILED",
      "Granola MCP tool listing failed.",
      error
    );
  } finally {
    await closeMcpClient(client).catch(() => undefined);
  }
}

export async function callGranolaMcpTool(input: {
  authProvider: OAuthClientProvider;
  endpoint: string;
  input?: Record<string, unknown>;
  name: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const { client } = await connectGranolaClient(input);
  try {
    return await withAbort(
      client.callTool({ arguments: input.input, name: input.name }),
      AbortSignal.timeout(input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS)
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw new GranolaAppNodeError(
        "GRANOLA_MCP_AUTH_REQUIRED",
        "Granola authorization is required.",
        error
      );
    }
    throw new GranolaAppNodeError(
      "GRANOLA_MCP_FAILED",
      "Granola MCP tool call failed.",
      error
    );
  } finally {
    await closeMcpClient(client).catch(() => undefined);
  }
}

async function connectGranolaClient(input: {
  authProvider: OAuthClientProvider;
  endpoint: string;
  timeoutMs?: number;
}) {
  const client = new McpClient({
    name: "lightfast-granola-app-node",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    authProvider: input.authProvider,
  });
  try {
    await withAbort(
      client.connect(transport),
      AbortSignal.timeout(input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS)
    );
    return { client, transport };
  } catch (error) {
    await closeMcpClient(client).catch(() => undefined);
    throw error;
  }
}

async function closeMcpClient(client: { close(): Promise<void> }) {
  await Promise.race([
    client.close(),
    delay(DEFAULT_GRANOLA_MCP_CLOSE_TIMEOUT_MS),
  ]);
}

async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) {
    throw abortError();
  }
  return await Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(abortError()), {
        once: true,
      });
    }),
  ]);
}

function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function toManifestItem(tool: Tool) {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    name: tool.name,
  };
}
```

Create `packages/granola-app-node/src/index.ts`:

```ts
export {
  DEFAULT_GRANOLA_MCP_ENDPOINT,
  granolaClientMetadata,
} from "./config";
export { GranolaAppNodeError } from "./errors";
export { callGranolaMcpTool, listGranolaMcpTools } from "./mcp";
export { GranolaOAuthClientProvider } from "./oauth-provider";
```

- [ ] **Step 6: Write MCP helper tests**

Create `packages/granola-app-node/src/__tests__/mcp.test.ts` by mocking `@vendor/mcp` like `packages/x-app-node/src/__tests__/mcp.test.ts`. Cover:

```ts
it("passes the OAuth provider to StreamableHTTPClientTransport", async () => {
  const authProvider = { token: async () => "access" };
  await listGranolaMcpTools({
    authProvider: authProvider as never,
    endpoint: "https://mcp.granola.ai/mcp",
  });
  expect(transportOptions[0]).toMatchObject({ authProvider });
});

it("maps tools/list results to connector manifests", async () => {
  listToolsMock.mockResolvedValue({
    tools: [{ description: "Search notes", inputSchema: {}, name: "search" }],
  });
  await expect(
    listGranolaMcpTools({
      authProvider: authProvider as never,
      endpoint: "https://mcp.granola.ai/mcp",
    })
  ).resolves.toEqual([
    { description: "Search notes", inputSchema: {}, name: "search" },
  ]);
});
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
pnpm --filter @repo/granola-app-node test -- --runInBand
pnpm --filter @repo/granola-app-node typecheck
```

Expected: both pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add vendor/mcp/src/index.ts packages/granola-app-node package.json pnpm-lock.yaml
git commit -m "feat: add granola mcp client package"
```

## Task 5: Add User Connector API Services And OAuth Flow

**Files:**

- Create: `api/app/src/services/user-connectors/attempts.ts`
- Create: `api/app/src/services/user-connectors/catalog.ts`
- Create: `api/app/src/services/user-connectors/granola-flow.ts`
- Create: `api/app/src/services/user-connectors/index.ts`
- Create: `api/app/src/router/(pending-not-allowed)/user-connectors.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/connectors.ts`
- Modify: `api/app/src/root.ts`
- Create: `apps/app/src/app/(app)/(connectors)/api/connectors/granola/oauth/callback/route.ts`
- Modify: `apps/app/src/proxy.ts`
- Create: `api/app/src/__tests__/user-connectors-flow.test.ts`
- Create: `api/app/src/__tests__/user-connectors-router.test.ts`

- [ ] **Step 1: Write failing service tests for user connector catalog**

Create `api/app/src/__tests__/user-connectors-flow.test.ts` with mocks for `@db/app`, `@repo/granola-app-node`, `@repo/app-encryption`, and `@vendor/upstash`. Include:

```ts
it("lists Granola as a private user connector", async () => {
  listCurrentUserConnectorConnectionsMock.mockResolvedValue([]);

  await expect(listUserConnectorsForViewer(ctx())).resolves.toEqual([
    expect.objectContaining({
      canManage: true,
      catalogStatus: "available",
      connection: null,
      displayName: "Granola",
      ownerType: "user",
      provider: "granola",
    }),
  ]);
});

it("shapes an active Granola connection without team automation controls", async () => {
  listCurrentUserConnectorConnectionsMock.mockResolvedValue([
    userConnection({ providerAccountName: "Granola" }),
  ]);

  await expect(listUserConnectorsForViewer(ctx())).resolves.toEqual([
    expect.objectContaining({
      connection: expect.objectContaining({
        availableForInteractiveChats: true,
        providerAccountName: "Granola",
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "search_notes" }),
        ]),
      }),
      ownerType: "user",
    }),
  ]);
});
```

- [ ] **Step 2: Implement catalog service**

Create `api/app/src/services/user-connectors/catalog.ts`:

```ts
import type { Database } from "@db/app";
import {
  listCurrentUserConnectorConnections,
  type UserConnectorConnection,
} from "@db/app";
import { USER_CONNECTOR_CATALOG } from "@repo/connector-contract";
import type { AuthContext } from "../../trpc";

interface UserConnectorServiceContext {
  auth: AuthContext;
  db: Database;
}

export interface UserConnectorCatalogRow {
  builder: "Granola";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: { status: "available" };
  connection: {
    availableForInteractiveChats: boolean;
    connectedAt: Date;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerAccountName: string | null;
    status: "active" | "error" | "revoked";
    tools: Array<{
      description?: string;
      name: string;
      availableForInteractiveChats: boolean;
    }>;
  } | null;
  description: string;
  displayName: string;
  ownerType: "user";
  provider: "granola";
}

export async function listUserConnectorsForViewer(
  ctx: UserConnectorServiceContext
): Promise<UserConnectorCatalogRow[]> {
  const identity = ctx.auth.identity;
  if (identity.type === "unauthenticated") {
    return [];
  }

  const connections = await listCurrentUserConnectorConnections(ctx.db, {
    clerkUserId: identity.userId,
  });
  const byProvider = new Map(connections.map((row) => [row.provider, row]));

  return USER_CONNECTOR_CATALOG.map((catalogItem) => {
    const connection = byProvider.get(catalogItem.provider);
    return {
      ...catalogItem,
      canManage: true,
      connectAvailability: { status: "available" as const },
      connection: shapeConnection(connection),
      ownerType: "user" as const,
    };
  });
}

function shapeConnection(
  connection: UserConnectorConnection | undefined
): UserConnectorCatalogRow["connection"] {
  if (!connection) {
    return null;
  }
  return {
    availableForInteractiveChats: connection.status === "active",
    connectedAt: connection.connectedAt,
    lastToolRefreshAt: connection.lastToolRefreshAt,
    lastToolRefreshErrorAt: connection.lastToolRefreshErrorAt,
    lastToolRefreshErrorCode: connection.lastToolRefreshErrorCode,
    providerAccountName: connection.providerAccountName,
    status: connection.status,
    tools: connection.toolManifest.map((tool) => ({
      ...(tool.description ? { description: tool.description } : {}),
      availableForInteractiveChats: connection.status === "active",
      name: tool.name,
    })),
  };
}
```

- [ ] **Step 3: Add OAuth attempts and Granola flow**

Create `api/app/src/services/user-connectors/attempts.ts` using the existing Redis pattern in `api/app/src/services/connectors/attempts.ts`, with prefix `user-connector-oauth-attempt:` and a zod schema containing:

```ts
{
  attemptId: string;
  clerkUserId: string;
  codeVerifier?: string;
  clientInformation?: unknown;
  createdAt: string;
  provider: "granola";
  redirectUrl: string;
  returnTo: string;
}
```

Create `api/app/src/services/user-connectors/granola-flow.ts` with exports:

```ts
export async function startGranolaUserConnectorOAuth(ctx: UserConnectorServiceContext): Promise<{
  authorizationUrl: string;
  mode: "connect";
}>;

export async function completeGranolaUserConnectorOAuth(input: {
  code: string;
  requestUrl: string;
  state: string;
}): Promise<{ redirectUrl: string }>;

export async function disconnectGranolaUserConnector(ctx: UserConnectorServiceContext): Promise<{
  disconnected: boolean;
}>;
```

Implementation details:

- `startGranolaUserConnectorOAuth` builds redirect URL from `NEXT_PUBLIC_APP_URL` and `/api/connectors/granola/oauth/callback`.
- Instantiate `GranolaOAuthClientProvider` with undefined tokens and `granolaClientMetadata({ redirectUrl })`.
- Construct `StreamableHTTPClientTransport` through `listGranolaMcpTools`; the first unauthenticated connect triggers `redirectToAuthorization`.
- The provider's `onAuthorizationUrl` captures the authorization URL.
- Store the attempt with the captured provider snapshot: `clientInformation` and `codeVerifier`.
- Append `state=<attemptId>` when the SDK did not include state. If the SDK includes its own state, preserve it and store Lightfast attempt id in Redis keyed by that state.
- `completeGranolaUserConnectorOAuth` consumes the attempt, reconstructs the provider with stored client info and code verifier, creates a transport, calls `finishAuth(code)` through a helper in `@repo/granola-app-node`, lists tools, encrypts access/refresh tokens, and finalizes the user connector row.
- Use `providerAccountId: null` and `providerAccountName: "Granola"` because Granola MCP does not document a stable account metadata endpoint.

- [ ] **Step 4: Add router procedures**

Create `api/app/src/router/(pending-not-allowed)/user-connectors.ts`:

```ts
import {
  userConnectorProviderInputSchema,
  userConnectorStartConnectInputSchema,
} from "@repo/connector-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import {
  disconnectUserConnector,
  listUserConnectorsForViewer,
  startUserConnectorOAuth,
} from "../../services/user-connectors";
import { viewerProcedure } from "../../trpc";

export const userConnectorsRouter = {
  list: viewerProcedure.query(({ ctx }) => listUserConnectorsForViewer(ctx)),
  startConnect: viewerProcedure
    .input(userConnectorStartConnectInputSchema)
    .mutation(({ ctx, input }) => startUserConnectorOAuth(ctx, input)),
  disconnect: viewerProcedure
    .input(userConnectorProviderInputSchema)
    .mutation(({ ctx, input }) => disconnectUserConnector(ctx, input)),
} satisfies TRPCRouterRecord;
```

Modify `api/app/src/root.ts`:

```ts
import { userConnectorsRouter } from "./router/(pending-not-allowed)/user-connectors";

// inside viewer.account
userConnectors: userConnectorsRouter,
```

Modify `api/app/src/router/(pending-not-allowed)/connectors.ts` to add:

```ts
import { listUserConnectorsForViewer } from "../../services/user-connectors";

listSections: setupProcedure.query(async ({ ctx }) => ({
  teamConnectors: await listConnectorsForOrg(ctx),
  yourConnectors: await listUserConnectorsForViewer(ctx),
})),
```

Keep existing `list` unchanged for setup-task compatibility.

- [ ] **Step 5: Add app callback route and proxy allowlist**

Create `apps/app/src/app/(app)/(connectors)/api/connectors/granola/oauth/callback/route.ts`:

```ts
import { completeGranolaUserConnectorOAuth } from "@api/app/services/user-connectors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(
      new URL(`/account/settings?connector=granola&error=${encodeURIComponent(error)}`, url)
    );
  }
  if (!(code && state)) {
    return Response.redirect(
      new URL("/account/settings?connector=granola&error=missing_oauth_code", url)
    );
  }

  const result = await completeGranolaUserConnectorOAuth({
    code,
    requestUrl: request.url,
    state,
  });
  return Response.redirect(result.redirectUrl);
}
```

Modify `apps/app/src/proxy.ts` so `/api/connectors/granola/oauth/callback` is treated like Linear and X connector callbacks.

- [ ] **Step 6: Run API tests**

Run:

```bash
pnpm --filter @api/app test -- --runInBand user-connectors-flow user-connectors-router connectors-router
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app test -- --runInBand proxy
```

Expected: pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add api/app/src/services/user-connectors api/app/src/router api/app/src/root.ts apps/app/src/app/(app)/(connectors)/api/connectors/granola apps/app/src/proxy.ts api/app/src/__tests__ apps/app/src/__tests__/proxy.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add user connector api"
```

## Task 6: Build Workspace Connector Sections UI

**Files:**

- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-model.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-icons.tsx`
- Modify: `packages/ui/src/components/integration-icons.tsx`
- Modify tests under `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
- Modify tests under `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/`

- [ ] **Step 1: Update page prefetch test first**

Change the connectors page test so it expects `listSections` to be prefetched:

```ts
const connectorsListSectionsQueryOptionsMock = vi.fn(() => ({
  queryKey: [["org", "workspace", "connectors", "listSections"]],
}));
```

Expected render assertions:

```ts
expect(connectorsListSectionsQueryOptionsMock).toHaveBeenCalled();
expect(screen.getByText("Connectors")).toBeInTheDocument();
```

Run:

```bash
pnpm --filter @lightfast/app test -- --runInBand connectors-page
```

Expected: fail because the page still prefetches `list`.

- [ ] **Step 2: Switch page and client to sectioned data**

Modify `connectors/page.tsx` to prefetch:

```ts
trpc.org.workspace.connectors.listSections.queryOptions()
```

Modify `connectors-client.tsx` to read:

```ts
const listQueryOptions =
  trpc.org.workspace.connectors.listSections.queryOptions();
const { data: connectorSections } = useSuspenseQuery({
  ...listQueryOptions,
  staleTime: 30_000,
});
const teamConnectors = connectorSections.teamConnectors;
const yourConnectors = connectorSections.yourConnectors;
```

- [ ] **Step 3: Add UI model types**

Modify `connectors-model.ts`:

```ts
export type ConnectorSections =
  AppRouterOutputs["org"]["workspace"]["connectors"]["listSections"];
export type TeamConnectorCatalogRow = ConnectorSections["teamConnectors"][number];
export type UserConnectorCatalogRow = ConnectorSections["yourConnectors"][number];
export type ConnectorCatalogRow =
  | TeamConnectorCatalogRow
  | UserConnectorCatalogRow;
```

Keep existing status helper for team connection rows and add:

```ts
export function userConnectionStatus(connection: NonNullable<UserConnectorCatalogRow["connection"]>) {
  if (connection.status === "error") {
    return { dotClass: "bg-destructive", label: "Needs reconnect" };
  }
  if (connection.lastToolRefreshErrorAt) {
    return { dotClass: "bg-amber-500", label: "Tools stale" };
  }
  return { dotClass: "bg-emerald-500", label: "Connected" };
}
```

- [ ] **Step 4: Render the two sections**

In `connectors-client.tsx`, replace the single list block with:

```tsx
<ConnectorSection
  description="Shared workspace connectors managed by admins."
  rows={filteredTeamConnectors}
  title="Team connectors"
>
  {filteredTeamConnectors.map((row) =>
    row.connection ? (
      <ConnectedTeamConnectorCard ... />
    ) : (
      <AvailableTeamConnectorCard ... />
    )
  )}
</ConnectorSection>

<ConnectorSection
  description="Private connectors only you can use in chats."
  rows={filteredUserConnectors}
  title="Your connectors"
>
  {filteredUserConnectors.map((row) =>
    row.connection ? (
      <ConnectedUserConnectorCard ... />
    ) : (
      <AvailableUserConnectorCard ... />
    )
  )}
</ConnectorSection>
```

User connector cards must include:

```tsx
<Badge variant="secondary">Only you</Badge>
<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
  Available in your chats. Not visible to teammates.
</p>
```

Team connector cards must include:

```tsx
<Badge variant="outline">Team</Badge>
```

Do not render `Use in automations`, `Use in agents`, or admin-required copy in user connector cards.

- [ ] **Step 5: Add Granola icon support**

Add a Granola icon entry to `packages/ui/src/components/integration-icons.tsx` and map `granola` in `connector-icons.tsx`. Use a simple text mark or existing integration icon style with `G` on a neutral background until a brand asset is available.

- [ ] **Step 6: Add UI tests**

Add assertions:

```ts
expect(screen.getByRole("heading", { name: "Team connectors" })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "Your connectors" })).toBeInTheDocument();
expect(screen.getByText("Only you")).toBeInTheDocument();
expect(screen.getByText("Available in your chats. Not visible to teammates.")).toBeInTheDocument();
expect(screen.queryByLabelText("Use in automations", { selector: "[data-owner='user'] *" })).not.toBeInTheDocument();
```

- [ ] **Step 7: Run frontend tests**

Run:

```bash
pnpm --filter @lightfast/app test -- --runInBand connectors
pnpm --filter @lightfast/app typecheck
```

Expected: pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx packages/ui/src/components/integration-icons.tsx
git commit -m "feat: show user and team connectors"
```

## Task 7: Add User Connector Runtime For Chat

**Files:**

- Create: `api/app/src/services/user-connectors/runtime.ts`
- Create: `api/app/src/__tests__/user-connectors-runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Create tests covering private ownership:

```ts
it("finds active Granola tools for the owning user's chat", async () => {
  listCurrentUserConnectorConnectionsMock.mockResolvedValue([
    userConnection({
      clerkUserId: "user_current",
      toolManifest: [
        { description: "Search notes", inputSchema: {}, name: "search_notes" },
      ],
    }),
  ]);

  await expect(
    findUserConnectorTools(userConnectorChatContext(), {
      provider: "granola",
      query: "search",
    })
  ).resolves.toEqual({
    routines: [
      expect.objectContaining({
        provider: "granola",
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
      }),
    ],
  });
});

it("does not find another user's Granola tools", async () => {
  listCurrentUserConnectorConnectionsMock.mockResolvedValue([]);

  await expect(
    findUserConnectorTools(userConnectorChatContext({ userId: "user_other" }), {})
  ).resolves.toEqual({
    reason: "no_connected_user_connectors",
    routines: [],
  });
});

it("calls Granola MCP through the current user's connection", async () => {
  getCurrentUserConnectorConnectionMock.mockResolvedValue(
    userConnection({ clerkUserId: "user_current" })
  );
  decryptMock.mockResolvedValue("access_token");
  callGranolaMcpToolMock.mockResolvedValue({
    content: [{ type: "text", text: "meeting result" }],
  });

  await expect(
    callUserConnectorTool(userConnectorChatContext(), {
      input: { query: "SOC2" },
      routineId: "granola__search_notes",
    })
  ).resolves.toEqual(
    expect.objectContaining({
      provider: "granola",
      providerToolName: "search_notes",
      status: "succeeded",
    })
  );
});
```

- [ ] **Step 2: Implement runtime service**

Create `api/app/src/services/user-connectors/runtime.ts`:

```ts
import {
  getCurrentUserConnectorConnection,
  listCurrentUserConnectorConnections,
  markCurrentUserConnectorConnectionError,
  type UserConnectorConnection,
} from "@db/app";
import { decrypt } from "@repo/app-encryption";
import {
  callGranolaMcpTool,
  GranolaAppNodeError,
  GranolaOAuthClientProvider,
  granolaClientMetadata,
} from "@repo/granola-app-node";
import {
  type UserConnectorCallInput,
  type UserConnectorCallSuccess,
  type UserConnectorFindInput,
  type UserConnectorFindOutput,
  parseUserConnectorRoutineId,
  userConnectorCallInputSchema,
  userConnectorFindInputSchema,
  userConnectorRoutineId,
} from "@repo/user-connector-contract";
import type { Database } from "@db/app";

export interface UserConnectorChatContext {
  actor: {
    orgId: string;
    userId: string;
  };
  db: Database;
  now: () => Date;
  source: {
    conversationId: string;
    surface: "interactive_chat";
  };
}

export async function findUserConnectorTools(
  context: UserConnectorChatContext,
  input: UserConnectorFindInput
): Promise<UserConnectorFindOutput> {
  const parsed = userConnectorFindInputSchema.parse(input);
  const connections = await listCurrentUserConnectorConnections(context.db, {
    clerkUserId: context.actor.userId,
  });
  const activeConnections = connections.filter(
    (connection) => connection.status === "active"
  );
  if (activeConnections.length === 0) {
    return { reason: "no_connected_user_connectors", routines: [] };
  }

  const routines = activeConnections
    .flatMap((connection) => summarizeConnectionTools(connection, parsed))
    .filter((routine) => {
      if (parsed.provider && routine.provider !== parsed.provider) {
        return false;
      }
      if (parsed.routineId && routine.routineId !== parsed.routineId) {
        return false;
      }
      if (!parsed.query) {
        return true;
      }
      const query = parsed.query.toLowerCase();
      return [
        routine.description,
        routine.provider,
        routine.providerToolName,
        routine.routineId,
        routine.title,
      ]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(query));
    })
    .slice(0, parsed.limit ?? 10);

  return routines.length > 0
    ? { routines }
    : { reason: "no_matching_tools", routines: [] };
}

export async function callUserConnectorTool(
  context: UserConnectorChatContext,
  input: UserConnectorCallInput
): Promise<UserConnectorCallSuccess> {
  const parsed = userConnectorCallInputSchema.parse(input);
  const { provider, providerToolName } = parseUserConnectorRoutineId(
    parsed.routineId
  );
  const connection = await getCurrentUserConnectorConnection(context.db, {
    clerkUserId: context.actor.userId,
    provider,
  });
  if (!(connection && connection.status === "active")) {
    throw new Error(`${provider} connector is not connected for this user.`);
  }
  if (!connection.toolManifest.some((tool) => tool.name === providerToolName)) {
    throw new Error(`User connector routine ${parsed.routineId} was not found.`);
  }

  try {
    const result = await callGranolaMcpTool({
      authProvider: await authProviderForConnection(connection),
      endpoint: connection.mcpEndpoint,
      input: parsed.input,
      name: providerToolName,
    });
    return {
      provider,
      providerToolName,
      result,
      routineId: parsed.routineId,
      status: "succeeded",
    };
  } catch (error) {
    if (
      error instanceof GranolaAppNodeError &&
      error.code === "GRANOLA_MCP_AUTH_REQUIRED"
    ) {
      await markCurrentUserConnectorConnectionError(context.db, {
        clerkUserId: context.actor.userId,
        provider,
      });
    }
    throw error;
  }
}

function summarizeConnectionTools(
  connection: UserConnectorConnection,
  input: ReturnType<typeof userConnectorFindInputSchema.parse>
) {
  return connection.toolManifest.flatMap((tool) => {
    try {
      const routineId = userConnectorRoutineId(connection.provider, tool.name);
      return [
        {
          ...(tool.description ? { description: tool.description } : {}),
          ...(input.includeSchema && tool.inputSchema !== undefined
            ? { inputSchema: tool.inputSchema }
            : {}),
          provider: connection.provider,
          providerToolName: tool.name,
          routineId,
          title: titleFromToolName(tool.name),
        },
      ];
    } catch {
      return [];
    }
  });
}

async function authProviderForConnection(connection: UserConnectorConnection) {
  const accessToken = connection.encryptedAccessToken
    ? await decrypt(connection.encryptedAccessToken)
    : undefined;
  const refreshToken = connection.encryptedRefreshToken
    ? await decrypt(connection.encryptedRefreshToken)
    : undefined;
  return new GranolaOAuthClientProvider({
    clientInformation: undefined,
    clientMetadata: granolaClientMetadata({
      redirectUrl: "https://app.lightfast.localhost/api/connectors/granola/oauth/callback",
    }),
    codeVerifier: undefined,
    onAuthorizationUrl: () => undefined,
    redirectUrl: "https://app.lightfast.localhost/api/connectors/granola/oauth/callback",
    tokens: accessToken
      ? {
          access_token: accessToken,
          ...(refreshToken ? { refresh_token: refreshToken } : {}),
          token_type: "Bearer",
        }
      : undefined,
  });
}

function titleFromToolName(providerToolName: string) {
  return providerToolName
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
```

- [ ] **Step 3: Run runtime tests**

Run:

```bash
pnpm --filter @api/app test -- --runInBand user-connectors-runtime
pnpm --filter @api/app typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add api/app/src/services/user-connectors/runtime.ts api/app/src/__tests__/user-connectors-runtime.test.ts
git commit -m "feat: add user connector chat runtime"
```

## Task 8: Wire User Connector Tools Into Workspace Chat

**Files:**

- Modify: `ai/src/workspace-assistant/message-schema.ts`
- Modify: `ai/src/__tests__/workspace-assistant/message-schema.test.ts`
- Modify: `apps/app/src/app/(chat)/api/chat/route.ts`

- [ ] **Step 1: Write failing message schema tests**

Update `ai/src/__tests__/workspace-assistant/message-schema.test.ts`:

```ts
it("accepts user connector tool parts", async () => {
  await expect(
    safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_1",
          role: "assistant",
          parts: [
            {
              type: "tool-callUserConnectorTool",
              state: "output-available",
              toolCallId: "tool_1",
              input: {
                input: { query: "SOC2" },
                routineId: "granola__search_notes",
              },
              output: {
                provider: "granola",
                providerToolName: "search_notes",
                result: { content: [{ type: "text", text: "result" }] },
                routineId: "granola__search_notes",
                status: "succeeded",
              },
            },
          ],
        },
      ],
    })
  ).resolves.toMatchObject({ success: true });
});
```

- [ ] **Step 2: Add user connector tools to the AI message schema**

Modify `ai/src/workspace-assistant/message-schema.ts`:

```ts
import {
  userConnectorCallInputSchema,
  userConnectorCallSuccessSchema,
  userConnectorFindInputSchema,
  userConnectorFindOutputSchema,
} from "@repo/user-connector-contract";
```

Add to `lightfastWorkspaceAssistantTools`:

```ts
findUserConnectorTools: tool({
  description:
    "Find private user connector tools available to the current user, such as Granola meeting note tools.",
  inputSchema: userConnectorFindInputSchema,
  outputSchema: userConnectorFindOutputSchema,
}),
callUserConnectorTool: tool({
  description:
    "Call one private user connector tool by routineId for the current user.",
  inputSchema: userConnectorCallInputSchema,
  outputSchema: userConnectorCallSuccessSchema,
}),
```

- [ ] **Step 3: Wire chat route tools**

Modify `apps/app/src/app/(chat)/api/chat/route.ts` imports:

```ts
import {
  callUserConnectorTool,
  findUserConnectorTools,
  type UserConnectorChatContext,
} from "@api/app/services/user-connectors/runtime";
import {
  userConnectorCallInputSchema,
  userConnectorCallSuccessSchema,
  userConnectorFindInputSchema,
  userConnectorFindOutputSchema,
} from "@repo/user-connector-contract";
```

Update `baseSystemPrompt` with private context language:

```ts
"When private user connectors such as Granola are useful, first find user connector tools, then call the selected routine by routineId.",
"Granola is private meeting context for the current user. Never describe Granola results as workspace or team knowledge.",
```

Replace `tools: createWorkspaceAssistantProviderRoutineTools(...)` with:

```ts
tools: createWorkspaceAssistantTools({
  conversation,
  orgId: identity.orgId,
  userId: identity.userId,
}),
```

Rename the helper and add user tools:

```ts
function createWorkspaceAssistantTools(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
}) {
  return {
    ...createWorkspaceAssistantProviderRoutineTools(input),
    callUserConnectorTool: tool({
      description:
        "Call one private user connector tool by routineId for the current user. Use routineIds returned by findUserConnectorTools.",
      inputSchema: userConnectorCallInputSchema,
      outputSchema: userConnectorCallSuccessSchema,
      execute: async (toolInput) =>
        callUserConnectorTool(userConnectorContext(input), toolInput),
    }),
    findUserConnectorTools: tool({
      description:
        "Find private user connector tools available to the current user, such as Granola meeting note tools. Use this before calling callUserConnectorTool.",
      inputSchema: userConnectorFindInputSchema,
      outputSchema: userConnectorFindOutputSchema,
      execute: async (toolInput) =>
        findUserConnectorTools(userConnectorContext(input), toolInput),
    }),
  };
}

function userConnectorContext(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
}): UserConnectorChatContext {
  return {
    actor: {
      orgId: input.orgId,
      userId: input.userId,
    },
    db,
    now: () => new Date(),
    source: {
      conversationId: input.conversation.publicId,
      surface: "interactive_chat",
    },
  };
}
```

- [ ] **Step 4: Run schema and chat route tests**

Run:

```bash
pnpm --filter @repo/ai test -- --runInBand workspace-assistant
pnpm --filter @lightfast/app test -- --runInBand chat
pnpm --filter @lightfast/app typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add ai/src/workspace-assistant ai/src/__tests__/workspace-assistant apps/app/src/app/(chat)/api/chat/route.ts
git commit -m "feat: add private user connector tools to chat"
```

## Task 9: Render Granola Usage In Chat UI

**Files:**

- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/message-part.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx`

- [ ] **Step 1: Write failing UI test**

Add a test that renders an assistant message with `tool-callUserConnectorTool` output:

```tsx
it("renders a quiet Granola usage indicator for user connector tool output", () => {
  render(
    <ChatMessage
      isStreaming={false}
      message={{
        id: "msg_1",
        role: "assistant",
        parts: [
          {
            type: "tool-callUserConnectorTool",
            state: "output-available",
            toolCallId: "tool_1",
            input: {
              input: { query: "SOC2" },
              routineId: "granola__search_notes",
            },
            output: {
              provider: "granola",
              providerToolName: "search_notes",
              result: { content: [{ type: "text", text: "result" }] },
              routineId: "granola__search_notes",
              status: "succeeded",
            },
          },
        ],
      }}
    />
  );

  expect(screen.getByText("Used Granola")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a special case before generic tool rendering**

In `message-part.tsx`, before the `isToolPart(part)` generic block:

```tsx
if (isGranolaUserConnectorToolPart(part)) {
  return (
    <div className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground text-xs">
      Used Granola
    </div>
  );
}
```

Add helper:

```ts
function isGranolaUserConnectorToolPart(part: UIMessage["parts"][number]) {
  if (
    !("state" in part) ||
    part.type !== "tool-callUserConnectorTool" ||
    part.state !== "output-available"
  ) {
    return false;
  }
  const output = (part as { output?: unknown }).output;
  return (
    output &&
    typeof output === "object" &&
    "provider" in output &&
    (output as { provider?: unknown }).provider === "granola"
  );
}
```

- [ ] **Step 3: Run chat UI tests**

Run:

```bash
pnpm --filter @lightfast/app test -- --runInBand chat-message workspace-assistant-client
pnpm --filter @lightfast/app typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/message-part.tsx apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-message.test.tsx
git commit -m "feat: show granola usage in chat"
```

## Task 10: Add Audit Ledger For User Connector Tool Calls

**Files:**

- Create: `db/app/src/schema/tables/user-connector-tool-calls.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Create: `db/app/src/utils/user-connector-tool-calls.ts`
- Modify: `db/app/src/index.ts`
- Modify: `api/app/src/services/user-connectors/runtime.ts`
- Create: `db/app/src/__tests__/user-connector-tool-calls.test.ts`
- Modify: `api/app/src/__tests__/user-connectors-runtime.test.ts`

- [ ] **Step 1: Write failing audit DB tests**

Create a test that inserts a running row and marks it succeeded/failed:

```ts
it("creates and completes user connector tool call rows", async () => {
  const valuesMock = vi.fn(() => ({
    $returningId: () => Promise.resolve([{ id: 1 }]),
  }));
  const selectMock = vi.fn(() => selectRows([toolCall({ id: 1 })]));
  const db = {
    insert: vi.fn(() => ({ values: valuesMock })),
    select: selectMock,
  } as unknown as Database;

  await expect(
    createUserConnectorToolCall(db, {
      calledByUserId: "user_123",
      clerkOrgId: "org_123",
      inputRedacted: { present: true },
      provider: "granola",
      providerConnectionId: 1,
      providerToolName: "search_notes",
      routineId: "granola__search_notes",
      sourceRef: "conv_123",
      sourceSurface: "interactive_chat",
      startedAt: new Date("2026-06-01T00:00:00.000Z"),
    })
  ).resolves.toMatchObject({ publicId: expect.stringMatching(/^user_connector_tool_call_/) });
});
```

- [ ] **Step 2: Add audit table**

Create `db/app/src/schema/tables/user-connector-tool-calls.ts` mirroring the provider routine call table, with these fields:

```text
publicId
calledByUserId
clerkOrgId nullable
provider
routineId
providerToolName
providerConnectionId
providerAttempted
sourceSurface = "interactive_chat"
sourceRef
status
inputRedacted
outputRedacted
errorCode
errorMessage
startedAt
finishedAt
createdAt
updatedAt
```

Use prefix:

```ts
export const USER_CONNECTOR_TOOL_CALL_ID_PREFIX =
  "user_connector_tool_call_";
```

- [ ] **Step 3: Add audit helpers**

Create `db/app/src/utils/user-connector-tool-calls.ts` with:

```ts
createUserConnectorToolCall
markUserConnectorToolCallProviderAttempted
markUserConnectorToolCallSucceeded
markUserConnectorToolCallFailed
```

Use the same redacted payload type as provider routine calls:

```ts
export type UserConnectorToolCallRedactedPayload =
  Record<string, unknown> | null;
```

- [ ] **Step 4: Wire audit into runtime**

In `api/app/src/services/user-connectors/runtime.ts`:

- create a call row after validating connection and tool
- mark provider attempted immediately before `callGranolaMcpTool`
- mark succeeded with redacted output presence
- mark failed with safe public error code/message
- include `clerkOrgId: context.actor.orgId`
- include `calledByUserId: context.actor.userId`
- include `sourceSurface: "interactive_chat"`
- include `sourceRef: context.source.conversationId`

- [ ] **Step 5: Generate migration and run tests**

Run:

```bash
pnpm --filter @db/app test -- --runInBand user-connector-tool-calls user-connector-connections
pnpm --filter @api/app test -- --runInBand user-connectors-runtime
pnpm db:generate
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add db/app/src/schema db/app/src/utils db/app/src/index.ts db/app/src/__tests__ api/app/src/services/user-connectors/runtime.ts api/app/src/__tests__/user-connectors-runtime.test.ts drizzle
git commit -m "feat: audit user connector tool calls"
```

## Task 11: End-To-End Validation

**Files:**

- No planned source edits.
- Use focused validation commands.

- [ ] **Step 1: Run package-level checks**

Run:

```bash
pnpm --filter @repo/connector-contract test
pnpm --filter @repo/user-connector-contract test
pnpm --filter @repo/granola-app-node test
pnpm --filter @db/app test
pnpm --filter @api/app test
pnpm --filter @repo/ai test
pnpm --filter @lightfast/app test
```

Expected: all pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: pass.

- [ ] **Step 3: Run full app build checks**

Run:

```bash
pnpm build:app
```

Expected: pass.

- [ ] **Step 4: Run local browser verification**

Start the dev server:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open the workspace Connectors page at the current worktree Portless URL and verify:

- `Team connectors` appears above Linear and X.
- `Your connectors` appears with Granola.
- Granola card has `Only you`.
- Granola card has no automations toggle.
- Non-admin member copy does not appear on Granola.

Stop the dev server with Ctrl-C after verification.

- [ ] **Step 5: Commit final validation fixes**

If validation required source changes, return to the task that owns the changed
files, repeat that task's focused test command, and commit with that task's
commit command. If validation required no source changes, do not create an empty
commit.

```bash
git status --short
```

Expected: clean worktree after any task-owned fix commit.

## Self-Review Checklist

- Spec coverage:
  - User/team ownership is covered by Tasks 1, 5, and 6.
  - Separate user connector storage is covered by Task 3.
  - Granola MCP client and OAuth are covered by Tasks 4 and 5.
  - Interactive chat-only runtime is covered by Tasks 7 and 8.
  - `Used Granola` UI is covered by Task 9.
  - Audit and privacy attribution are covered by Task 10.
  - Final validation is covered by Task 11.
- Placeholder scan: no incomplete markers or ambiguous "add tests" steps remain.
- Type consistency:
  - User provider id is `granola`.
  - User routine ids use `<provider>__<toolName>`, for example `granola__search_notes`.
  - Chat tool names are `findUserConnectorTools` and `callUserConnectorTool`.
  - Source surface for user connector runtime is `interactive_chat`.
