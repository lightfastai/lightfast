# Provider Routine Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-scoped provider routine proxy for hosted MCP and native CLI, using org-level provider credentials and a durable provider routine call ledger.

**Architecture:** Add a pure `@repo/provider-routine-contract` package and a server-only `@repo/provider-routines` service package. Hosted MCP and native CLI app routes adapt their auth contexts into the same service functions; the service uses cached provider MCP manifests, org provider connections, Lightfast-owned policy classification, and the provider routine call ledger.

**Tech Stack:** TypeScript, Zod, Drizzle MySQL, Vitest, Next.js route handlers, hosted MCP SDK, Commander CLI, existing Linear MCP adapter.

---

## Preconditions

Start from a branch that contains the hosted MCP work and the provider call
ledger work:

```bash
git switch feat/remote-mcp
git merge feat/integration-call-ledger
git switch -c feat/provider-routine-proxy
```

If the ledger branch has not been merged cleanly, resolve the ledger schema and
runtime conflicts first. This plan assumes `apps/mcp` exists and the ledger
helpers from `feat/integration-call-ledger` are available to rename.

## File Structure

- Create `packages/provider-routine-contract/package.json`
  - Pure schemas, types, and routine id helpers.
- Create `packages/provider-routine-contract/src/index.ts`
  - Owns `providerRoutineId`, `parseProviderRoutineId`, proxy find/call schemas,
    classifications, source surfaces, and result envelopes.
- Create `packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts`
  - Tests routine id parsing and schema behavior.
- Keep `packages/connector-contract/src/index.ts`
  - Existing runtime tool name helpers stay local to avoid a package cycle.
- Keep `packages/connector-contract/src/__tests__/connector-contract.test.ts`
  - Existing compatibility behavior must keep passing.
- Rename `db/app/src/schema/tables/integration-calls.ts` to
  `db/app/src/schema/tables/provider-routine-calls.ts`
  - Durable call ledger in provider-routine language.
- Rename `db/app/src/utils/integration-calls.ts` to
  `db/app/src/utils/provider-routine-calls.ts`
  - Create-running, mark-succeeded, mark-failed helpers.
- Rename `db/app/src/__tests__/integration-calls.test.ts` to
  `db/app/src/__tests__/provider-routine-calls.test.ts`
  - DB helper and schema tests.
- Modify `db/app/src/schema/tables/org-connector-connections.ts`
  - Add `enabledForAgents`, default false.
- Modify `db/app/src/utils/org-connector-connections.ts`
  - Add helper for toggling agent enablement.
- Modify `packages/connector-contract/src/index.ts`
  - Add `connectorSetAgentEnabledInputSchema`.
- Modify `api/app/src/router/(pending-not-allowed)/connectors.ts`
  - Add admin mutation for `enabledForAgents`.
- Modify Connectors UI files under
  `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components`
  - Add an admin-only agent access toggle near automation access.
- Create `packages/provider-routines/package.json`
  - Server-only package.
- Create `packages/provider-routines/src/index.ts`
  - Export service functions and errors.
- Create `packages/provider-routines/src/context.ts`
  - Service context and source actor types.
- Create `packages/provider-routines/src/find.ts`
  - `findProviderRoutines`.
- Create `packages/provider-routines/src/call.ts`
  - `callProviderRoutine`.
- Create `packages/provider-routines/src/policy.ts`
  - Read/write/unknown classification and scope helpers.
- Create `packages/provider-routines/src/linear.ts`
  - Linear adapter using existing Linear MCP call path.
- Create `packages/provider-routines/src/errors.ts`
  - Stable error class and error codes.
- Create `packages/provider-routines/src/__tests__/*.test.ts`
  - Find/call/policy lifecycle tests.
- Modify `apps/mcp/src/context.ts`
  - Add provider-routine MCP scopes.
- Modify `apps/mcp/src/tools/execute.ts`
  - Register `proxy_find` and `proxy_call` and execute them via the service.
- Modify `apps/mcp/src/__tests__/tools.test.ts`
  - Hosted MCP proxy tool tests.
- Modify `apps/mcp/src/__tests__/audit.test.ts`
  - Ensure `proxy_call` audit links to `providerRoutineCallId`.
- Create `apps/app/src/app/(app)/(native-proxy)/api/native/proxy/routines/route.ts`
  - Native OAuth `GET /api/native/proxy/routines`.
- Create `apps/app/src/app/(app)/(native-proxy)/api/native/proxy/call/route.ts`
  - Native OAuth `POST /api/native/proxy/call`.
- Modify `apps/app/src/proxy.ts`
  - Let `/api/native/proxy/*` reach route handlers.
- Create `apps/app/src/__tests__/app/api/native-proxy/native-proxy-routes.test.ts`
  - Native route auth and service wiring tests.
- Modify `core/cli/src/program.ts`
  - Add `proxy find` and `proxy call` commands.
- Create `core/cli/src/proxy/client.ts`
  - Native proxy HTTP client.
- Create `core/cli/src/proxy/commands.ts`
  - Commander command registration.
- Create `core/cli/src/proxy/__tests__/commands.test.ts`
  - CLI command tests.

---

### Task 1: Add Provider Routine Contract

**Files:**
- Create: `packages/provider-routine-contract/package.json`
- Create: `packages/provider-routine-contract/tsconfig.json`
- Create: `packages/provider-routine-contract/vitest.config.ts`
- Create: `packages/provider-routine-contract/src/index.ts`
- Create: `packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Create `packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  providerRoutineFindInputSchema,
  providerRoutineId,
  providerRoutineIdSchema,
} from "../index";

describe("provider routine ids", () => {
  it("formats and parses provider routine ids", () => {
    const routineId = providerRoutineId("linear", "create_issue");

    expect(routineId).toBe("linear__create_issue");
    expect(parseProviderRoutineId(routineId)).toEqual({
      provider: "linear",
      providerToolName: "create_issue",
    });
    expect(providerRoutineIdSchema.parse(routineId)).toBe(routineId);
  });

  it("preserves provider tool names containing double underscores", () => {
    expect(parseProviderRoutineId("linear__foo__bar")).toEqual({
      provider: "linear",
      providerToolName: "foo__bar",
    });
  });

  it("rejects unsupported routine ids", () => {
    expect(() => providerRoutineIdSchema.parse("foo__create_issue")).toThrow();
    expect(() => providerRoutineId("linear", "Create Issue")).toThrow();
    expect(() => parseProviderRoutineId("linear_create_issue")).toThrow();
  });
});

describe("proxy schemas", () => {
  it("parses compact find input", () => {
    expect(
      providerRoutineFindInputSchema.parse({
        includeSchema: true,
        limit: 5,
        provider: "linear",
        query: "create issue",
      })
    ).toEqual({
      includeSchema: true,
      limit: 5,
      provider: "linear",
      query: "create issue",
    });
  });

  it("requires proxy call input to be a JSON object", () => {
    expect(
      providerRoutineCallInputSchema.parse({
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).toEqual({
      input: { title: "Bug" },
      routineId: "linear__create_issue",
    });

    expect(() =>
      providerRoutineCallInputSchema.parse({
        input: ["not", "an", "object"],
        routineId: "linear__create_issue",
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the contract tests and verify failure**

Run:

```bash
pnpm --filter @repo/provider-routine-contract test -- provider-routine-contract.test.ts
```

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Create the package manifest**

Create `packages/provider-routine-contract/package.json`:

```json
{
  "name": "@repo/provider-routine-contract",
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

Create `packages/provider-routine-contract/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/provider-routine-contract/vitest.config.ts`:

```ts
import { baseConfig } from "@repo/vitest-config/base";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
});
```

- [ ] **Step 4: Implement the contract**

Create `packages/provider-routine-contract/src/index.ts`:

```ts
import {
  connectableConnectorProviderSchema,
  type ConnectableConnectorProvider,
} from "@repo/connector-contract";
import { z } from "zod";

export const providerToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_.-]+$/, "Unsupported provider tool name");
export type ProviderToolName = z.infer<typeof providerToolNameSchema>;

export const providerRoutineIdSchema = z
  .string()
  .refine((routineId) => {
    const separatorIndex = routineId.indexOf("__");
    if (separatorIndex <= 0) {
      return false;
    }

    const provider = routineId.slice(0, separatorIndex);
    const providerToolName = routineId.slice(separatorIndex + 2);

    return (
      connectableConnectorProviderSchema.safeParse(provider).success &&
      providerToolNameSchema.safeParse(providerToolName).success
    );
  }, "Unsupported provider routine id");
export type ProviderRoutineId = z.infer<typeof providerRoutineIdSchema>;

export function providerRoutineId(
  provider: ConnectableConnectorProvider,
  providerToolName: string
): ProviderRoutineId {
  const parsedProvider = connectableConnectorProviderSchema.parse(provider);
  const parsedToolName = providerToolNameSchema.parse(providerToolName);
  return providerRoutineIdSchema.parse(`${parsedProvider}__${parsedToolName}`);
}

export function parseProviderRoutineId(routineId: string): {
  provider: ConnectableConnectorProvider;
  providerToolName: ProviderToolName;
} {
  const parsed = providerRoutineIdSchema.parse(routineId);
  const separatorIndex = parsed.indexOf("__");
  const provider = parsed.slice(0, separatorIndex);
  const providerToolName = parsed.slice(separatorIndex + 2);
  return {
    provider: connectableConnectorProviderSchema.parse(provider),
    providerToolName: providerToolNameSchema.parse(providerToolName),
  };
}

export const providerRoutineClassificationSchema = z.enum([
  "read",
  "write",
  "unknown_write_default",
]);
export type ProviderRoutineClassification = z.infer<
  typeof providerRoutineClassificationSchema
>;

export const providerRoutineSourceSurfaceSchema = z.enum([
  "hosted_mcp",
  "native_cli",
  "automation",
  "system",
]);
export type ProviderRoutineSourceSurface = z.infer<
  typeof providerRoutineSourceSurfaceSchema
>;

export const providerRoutineFindInputSchema = z
  .object({
    includeSchema: z.boolean().optional(),
    limit: z.number().int().min(1).max(20).optional(),
    provider: connectableConnectorProviderSchema.optional(),
    query: z.string().min(1).max(200).optional(),
    readOnly: z.boolean().optional(),
    routineId: providerRoutineIdSchema.optional(),
  })
  .strict();
export type ProviderRoutineFindInput = z.infer<
  typeof providerRoutineFindInputSchema
>;

export const providerRoutineSearchReasonSchema = z.enum([
  "no_enabled_providers",
  "no_matching_routines",
]);
export type ProviderRoutineSearchReason = z.infer<
  typeof providerRoutineSearchReasonSchema
>;

export const providerRoutineSummarySchema = z.object({
  classification: providerRoutineClassificationSchema,
  description: z.string().optional(),
  examples: z
    .array(
      z.object({
        input: z.record(z.string(), z.unknown()),
        label: z.string(),
      })
    )
    .optional(),
  inputSchema: z.unknown().optional(),
  inputSummary: z.string().optional(),
  provider: connectableConnectorProviderSchema,
  providerToolName: providerToolNameSchema,
  routineId: providerRoutineIdSchema,
  title: z.string(),
});
export type ProviderRoutineSummary = z.infer<
  typeof providerRoutineSummarySchema
>;

export const providerRoutineFindOutputSchema = z.object({
  reason: providerRoutineSearchReasonSchema.optional(),
  routines: z.array(providerRoutineSummarySchema),
});
export type ProviderRoutineFindOutput = z.infer<
  typeof providerRoutineFindOutputSchema
>;

export const providerRoutineCallInputSchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
    routineId: providerRoutineIdSchema,
  })
  .strict();
export type ProviderRoutineCallInput = z.infer<
  typeof providerRoutineCallInputSchema
>;

export const providerRoutineCallStatusSchema = z.enum([
  "succeeded",
  "failed",
]);
export type ProviderRoutineCallStatus = z.infer<
  typeof providerRoutineCallStatusSchema
>;

export const providerRoutineErrorCodeSchema = z.enum([
  "PROVIDER_ROUTINE_NOT_FOUND",
  "PROVIDER_ROUTINE_NOT_ENABLED",
  "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
  "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
  "PROVIDER_ROUTINE_INVALID_INPUT",
  "PROVIDER_ROUTINE_AUTH_REQUIRED",
  "PROVIDER_ROUTINE_PROVIDER_FAILED",
  "PROVIDER_ROUTINE_TIMEOUT",
]);
export type ProviderRoutineErrorCode = z.infer<
  typeof providerRoutineErrorCodeSchema
>;

export const providerRoutineCallSuccessSchema = z.object({
  provider: connectableConnectorProviderSchema,
  providerRoutineCallId: z.string().min(1),
  providerToolName: providerToolNameSchema,
  result: z.unknown(),
  routineId: providerRoutineIdSchema,
  status: z.literal("succeeded"),
});
export type ProviderRoutineCallSuccess = z.infer<
  typeof providerRoutineCallSuccessSchema
>;

export const providerRoutineCallFailureSchema = z.object({
  error: z.object({
    code: providerRoutineErrorCodeSchema,
    message: z.string(),
  }),
  providerRoutineCallId: z.string().min(1),
  routineId: providerRoutineIdSchema,
  status: z.literal("failed"),
});
export type ProviderRoutineCallFailure = z.infer<
  typeof providerRoutineCallFailureSchema
>;
```

- [ ] **Step 5: Run contract tests**

Run:

```bash
pnpm --filter @repo/provider-routine-contract test -- provider-routine-contract.test.ts
pnpm --filter @repo/provider-routine-contract typecheck
```

Expected: PASS.

---

### Task 2: Preserve Runtime Tool Naming Compatibility

**Files:**
- Modify: `packages/connector-contract/src/index.ts`
- Modify: `packages/connector-contract/src/__tests__/connector-contract.test.ts`

- [ ] **Step 1: Update connector-contract tests**

Add this assertion to the existing runtime tool names test in
`packages/connector-contract/src/__tests__/connector-contract.test.ts`:

```ts
expect(connectorRuntimeToolName("linear", "create_issue")).toBe(
  "linear__create_issue"
);
```

Keep the existing tests that prove `linear__foo__bar` is parsed correctly.

- [ ] **Step 2: Keep connector helper implementation local**

Do not import `@repo/provider-routine-contract` into
`@repo/connector-contract`. The new provider-routine contract imports provider
ids from connector-contract, so importing back would create a workspace package
cycle.

Keep the existing connector helper implementation in
`packages/connector-contract/src/index.ts`:

```ts
export const connectorRuntimeToolNameSchema = z
  .string()
  .refine((runtimeToolName) => {
    const separatorIndex = runtimeToolName.indexOf("__");
    if (separatorIndex <= 0) {
      return false;
    }

    const provider = runtimeToolName.slice(0, separatorIndex);
    const providerToolName = runtimeToolName.slice(separatorIndex + 2);

    return (
      connectableConnectorProviderSchema.safeParse(provider).success &&
      connectorToolNameSchema.safeParse(providerToolName).success
    );
  }, "Unsupported connector runtime tool name");
```

This is temporary duplication. Remove it only after provider ids move out of
`connector-contract` into a shared provider taxonomy package.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @repo/connector-contract test
pnpm --filter @repo/connector-contract typecheck
```

Expected: PASS.

---

### Task 3: Rename The Ledger To Provider Routine Calls

**Files:**
- Rename: `db/app/src/schema/tables/integration-calls.ts` to `db/app/src/schema/tables/provider-routine-calls.ts`
- Rename: `db/app/src/utils/integration-calls.ts` to `db/app/src/utils/provider-routine-calls.ts`
- Rename: `db/app/src/__tests__/integration-calls.test.ts` to `db/app/src/__tests__/provider-routine-calls.test.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/index.ts`
- Generate: Drizzle migration through `pnpm db:generate`

- [ ] **Step 1: Rename tests first**

Rename the ledger test and update imports/expectations:

```ts
import { describe, expect, it } from "vitest";
import {
  createProviderRoutineCallId,
  PROVIDER_ROUTINE_CALL_ID_PREFIX,
  providerRoutineCalls,
} from "../schema";

describe("provider routine call schema", () => {
  it("creates public ids with the provider routine call prefix", () => {
    const id = createProviderRoutineCallId();

    expect(id.startsWith(PROVIDER_ROUTINE_CALL_ID_PREFIX)).toBe(true);
    expect(id).toHaveLength(PROVIDER_ROUTINE_CALL_ID_PREFIX.length + 36);
  });

  it("exports provider routine call fields", () => {
    expect(providerRoutineCalls.publicId.notNull).toBe(true);
    expect(providerRoutineCalls.clerkOrgId.notNull).toBe(true);
    expect(providerRoutineCalls.routineId.notNull).toBe(true);
    expect(providerRoutineCalls.providerToolName.notNull).toBe(true);
    expect(providerRoutineCalls.providerConnectionId.notNull).toBe(true);
    expect(providerRoutineCalls.providerAttempted.notNull).toBe(true);
    expect(providerRoutineCalls.sourceSurface.notNull).toBe(true);
    expect(providerRoutineCalls.sourceRef.notNull).toBe(false);
    expect(providerRoutineCalls.sourceClientId.notNull).toBe(false);
  });
});
```

- [ ] **Step 2: Run the renamed test and verify failure**

Run:

```bash
pnpm --filter @db/app test -- provider-routine-calls.test.ts
```

Expected: FAIL because the renamed exports are not implemented.

- [ ] **Step 3: Rename and reshape the schema**

In `db/app/src/schema/tables/provider-routine-calls.ts`, use these public names:

```ts
export const PROVIDER_ROUTINE_CALL_ID_PREFIX = "provider_routine_call_";

export type ProviderRoutineCallCalledByKind = "automation" | "system" | "user";
export type ProviderRoutineCallProvider = "linear";
export type ProviderRoutineCallSourceSurface =
  | "automation"
  | "hosted_mcp"
  | "native_cli"
  | "system";
export type ProviderRoutineCallStatus = "failed" | "running" | "succeeded";
export type ProviderRoutineCallRedactedPayload = Record<string, unknown>;

export function createProviderRoutineCallId() {
  return `${PROVIDER_ROUTINE_CALL_ID_PREFIX}${randomUUID()}`;
}
```

Use the table name:

```ts
export const providerRoutineCalls = mysqlTable(
  "lightfast_provider_routine_calls",
  {
    // keep id/publicId/clerkOrgId/caller/status/timestamps from the ledger branch
    routineId: varchar("routine_id", { length: 160 }).notNull(),
    providerConnectionId: bigint("provider_connection_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    sourceSurface: varchar("source_surface", { length: 32 })
      .$type<ProviderRoutineCallSourceSurface>()
      .notNull(),
    sourceRef: varchar("source_ref", { length: 128 }),
    sourceClientId: varchar("source_client_id", { length: 128 }),
    providerAttempted: boolean("provider_attempted").default(false).notNull(),
  }
);
```

Keep redacted input/output and safe error fields from the ledger branch.

- [ ] **Step 4: Rename DB helpers**

Rename helper functions:

```ts
createIntegrationCall       -> createProviderRoutineCall
markIntegrationCallSucceeded -> markProviderRoutineCallSucceeded
markIntegrationCallFailed    -> markProviderRoutineCallFailed
```

Helper inputs must use:

```ts
routineId: string;
providerConnectionId: number;
providerAttempted?: boolean;
sourceSurface: ProviderRoutineCallSourceSurface;
sourceRef?: string | null;
sourceClientId?: string | null;
```

Add a helper:

```ts
markProviderRoutineCallProviderAttempted(db, {
  clerkOrgId,
  publicId,
})
```

This sets `providerAttempted = true`.

- [ ] **Step 5: Update exports**

Update `db/app/src/schema/tables/index.ts` and `db/app/src/index.ts` to export
the provider-routine names and remove integration-call names.

- [ ] **Step 6: Generate migration**

Run:

```bash
pnpm db:generate
pnpm --filter @db/app test -- provider-routine-calls.test.ts
pnpm --filter @db/app typecheck
```

Expected: migration generated, tests PASS, typecheck PASS.

---

### Task 4: Add Agent Enablement On Provider Connections

**Files:**
- Modify: `db/app/src/schema/tables/org-connector-connections.ts`
- Modify: `db/app/src/utils/org-connector-connections.ts`
- Modify: `db/app/src/__tests__/org-connector-connections.test.ts`
- Modify: `packages/connector-contract/src/index.ts`
- Modify: `api/app/src/services/connectors/linear-flow.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/connectors.ts`
- Modify: Connectors page components/tests under `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components`

- [ ] **Step 1: Add failing DB test**

Add a test that a newly finalized Linear connection has:

```ts
expect(connection.enabledForAgents).toBe(false);
```

Add a test for the toggle helper:

```ts
await setConnectorAgentEnabled(db, {
  clerkOrgId: "org_123",
  enabled: true,
  provider: "linear",
});
```

Expected selected current connection has `enabledForAgents = true`.

- [ ] **Step 2: Add schema field**

In `org-connector-connections.ts`, add:

```ts
enabledForAgents: boolean("enabled_for_agents").default(false).notNull(),
```

- [ ] **Step 3: Add DB helper**

In `org-connector-connections.ts` utils, add:

```ts
export async function setConnectorAgentEnabled(
  db: Database,
  input: {
    clerkOrgId: string;
    enabled: boolean;
    provider: ConnectableConnectorProvider;
  }
) {
  await db
    .update(orgConnectorConnections)
    .set({ enabledForAgents: input.enabled, updatedAt: new Date() })
    .where(
      and(
        eq(orgConnectorConnections.clerkOrgId, input.clerkOrgId),
        eq(orgConnectorConnections.provider, input.provider),
        eq(orgConnectorConnections.isCurrent, true)
      )
    );
}
```

- [ ] **Step 4: Add contract input**

In `packages/connector-contract/src/index.ts`:

```ts
export const connectorSetAgentEnabledInputSchema = z.object({
  enabled: z.boolean(),
  provider: connectableConnectorProviderSchema,
});
```

- [ ] **Step 5: Add admin mutation**

In `api/app/src/router/(pending-not-allowed)/connectors.ts`, add a mutation
named `setAgentEnabled` that uses the existing connector admin gate and calls
`setConnectorAgentEnabled`.

- [ ] **Step 6: Add UI toggle**

In `connector-detail-content.tsx`, add a separate admin-only switch labeled
`Use in agents` near `Use in automations`. Copy should state:

```text
Allow user MCP clients and the Lightfast CLI to call this provider through Lightfast.
```

Do not reuse the automation toggle state.

- [ ] **Step 7: Generate migration and test**

Run:

```bash
pnpm db:generate
pnpm --filter @db/app test -- org-connector-connections.test.ts
pnpm --filter @repo/connector-contract test
pnpm --filter @api/app test -- connectors-router.test.ts
pnpm --filter @lightfast/app test -- connectors-page.test.tsx
```

Expected: PASS.

---

### Task 5: Add Server Provider Routine Service

**Files:**
- Create: `packages/provider-routines/package.json`
- Create: `packages/provider-routines/src/context.ts`
- Create: `packages/provider-routines/src/errors.ts`
- Create: `packages/provider-routines/src/policy.ts`
- Create: `packages/provider-routines/src/find.ts`
- Create: `packages/provider-routines/src/call.ts`
- Create: `packages/provider-routines/src/linear.ts`
- Create: `packages/provider-routines/src/index.ts`
- Create: `packages/provider-routines/src/__tests__/find.test.ts`
- Create: `packages/provider-routines/src/__tests__/call.test.ts`
- Create: `packages/provider-routines/src/__tests__/policy.test.ts`

- [ ] **Step 1: Create failing policy tests**

`policy.test.ts` should prove:

```ts
expect(hasRoutineScope({ classification: "read", scopes: ["read"] })).toBe(
  true
);
expect(hasRoutineScope({ classification: "read", scopes: ["write"] })).toBe(
  true
);
expect(hasRoutineScope({ classification: "write", scopes: ["read"] })).toBe(
  false
);
expect(
  hasRoutineScope({
    classification: "unknown_write_default",
    scopes: ["read"],
  })
).toBe(false);
```

- [ ] **Step 2: Create failing find tests**

`find.test.ts` should cover:

- no current enabled provider returns `reason: "no_enabled_providers"`;
- disabled `enabledForAgents = false` providers are not revealed by name;
- read-scope hosted MCP does not see `write` or `unknown_write_default`;
- `includeSchema = false` omits `inputSchema`;
- `includeSchema = true` includes the cached manifest schema.

- [ ] **Step 3: Create failing call tests**

`call.test.ts` should cover:

- unknown routine creates no provider routine call row;
- disabled provider creates no provider routine call row;
- invalid input creates no provider routine call row;
- token refresh failure creates a row with `providerAttempted = false`;
- provider failure creates a row with `providerAttempted = true`;
- success creates and completes a row and returns `providerRoutineCallId`.

- [ ] **Step 4: Create package manifest**

Create `packages/provider-routines/package.json`:

```json
{
  "name": "@repo/provider-routines",
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
    "@db/app": "workspace:*",
    "@repo/connector-contract": "workspace:*",
    "@repo/provider-routine-contract": "workspace:*",
    "@repo/linear-app-node": "workspace:*",
    "@vendor/observability": "workspace:*",
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

- [ ] **Step 5: Implement service context**

Create `packages/provider-routines/src/context.ts`:

```ts
import type { Database } from "@db/app";
import type { ProviderRoutineSourceSurface } from "@repo/provider-routine-contract";

export interface ProviderRoutineServiceLog {
  error(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export interface ProviderRoutineActor {
  orgId: string;
  userId: string;
}

export interface ProviderRoutineSource {
  clientId?: string | null;
  ref?: string | null;
  surface: ProviderRoutineSourceSurface;
}

export interface ProviderRoutineServiceContext {
  actor: ProviderRoutineActor;
  db: Database;
  log: ProviderRoutineServiceLog;
  now: () => Date;
  scopes: {
    providerRoutineRead: boolean;
    providerRoutineWrite: boolean;
  };
  source: ProviderRoutineSource;
}
```

- [ ] **Step 6: Implement errors**

Create `packages/provider-routines/src/errors.ts` with a `ProviderRoutineError`
class carrying one of the contract error codes and a safe public message.

- [ ] **Step 7: Implement policy**

Create `packages/provider-routines/src/policy.ts` with:

```ts
export function hasRoutineScope(input: {
  classification: ProviderRoutineClassification;
  scopes: { providerRoutineRead: boolean; providerRoutineWrite: boolean };
}) {
  if (input.classification === "read") {
    return (
      input.scopes.providerRoutineRead || input.scopes.providerRoutineWrite
    );
  }
  return input.scopes.providerRoutineWrite;
}
```

Add a Linear policy overlay that classifies known read routines as read and
known write routines as write. Unknown routines return
`unknown_write_default`.

- [ ] **Step 8: Implement find**

`findProviderRoutines(context, input)` should:

1. Parse `providerRoutineFindInputSchema`.
2. Load current org connector connections.
3. Keep only current `active` connections with `enabledForAgents = true`.
4. Return `reason: "no_enabled_providers"` if none remain.
5. Convert cached manifest entries into routine summaries.
6. Filter by provider, routineId, query, readOnly, and source scopes.
7. Return `reason: "no_matching_routines"` when enabled providers exist but no
   routines match.

- [ ] **Step 9: Implement call**

`callProviderRoutine(context, input)` should:

1. Parse `providerRoutineCallInputSchema`.
2. Resolve provider and provider tool name from `routineId`.
3. Load the current provider connection for `context.actor.orgId`.
4. Reject if missing, not active, or `enabledForAgents = false`.
5. Reject if the cached manifest does not contain the provider tool name.
6. Classify the routine and enforce source scopes.
7. Validate object input against the provider tool input schema when available.
8. Create a provider routine call row.
9. Refresh provider credentials.
10. Mark `providerAttempted = true`.
11. Call the provider adapter once.
12. Mark the row succeeded or failed.
13. Return the provider result and `providerRoutineCallId`.

- [ ] **Step 10: Run service tests**

Run:

```bash
pnpm --filter @repo/provider-routines test
pnpm --filter @repo/provider-routines typecheck
```

Expected: PASS.

---

### Task 6: Wire Hosted MCP proxy_find And proxy_call

**Files:**
- Modify: `packages/api-contract/src/mcp.ts`
- Modify: `apps/mcp/src/context.ts`
- Modify: `apps/mcp/src/tools/execute.ts`
- Modify: `apps/mcp/src/__tests__/tools.test.ts`
- Modify: `apps/mcp/src/__tests__/audit.test.ts`
- Modify: `apps/mcp/src/__tests__/auth.test.ts`

- [ ] **Step 1: Add MCP scopes**

In `packages/api-contract/src/mcp.ts`, extend the scope enum with:

```ts
"mcp:provider_routines:read"
"mcp:provider_routines:write"
```

Update `apps/mcp/src/context.ts` so `isMcpScope` accepts both new scopes.

- [ ] **Step 2: Add failing hosted MCP tests**

Add tests that:

- `listHostedMcpTools()` includes `proxy_find` and `proxy_call`;
- read scope can call `proxy_find`;
- read scope can call `proxy_call` for read-classified routines;
- read scope cannot call write routines;
- write scope can call read and write routines;
- `proxy_call` audit records include `providerRoutineCallId` when returned by
  the service.

- [ ] **Step 3: Register proxy tools**

In `apps/mcp/src/tools/execute.ts`, add two hosted tools:

```ts
proxy_find
proxy_call
```

Use `providerRoutineFindInputSchema` and `providerRoutineCallInputSchema` as
their input schemas. Do not dynamically register provider routine tools.

- [ ] **Step 4: Execute through the shared service**

For hosted MCP:

```ts
const providerRoutineContext = {
  actor: {
    orgId: context.orgId,
    userId: context.userId,
  },
  db: dependencies.db,
  log,
  now: dependencies.now,
  scopes: {
    providerRoutineRead:
      context.scopes.includes("mcp:provider_routines:read") ||
      context.scopes.includes("mcp:provider_routines:write"),
    providerRoutineWrite: context.scopes.includes(
      "mcp:provider_routines:write"
    ),
  },
  source: {
    clientId: context.clientId,
    ref: context.grantId,
    surface: "hosted_mcp",
  },
};
```

Call `findProviderRoutines` or `callProviderRoutine` directly.

- [ ] **Step 5: Link MCP audit**

When `proxy_call` returns or throws with `providerRoutineCallId`, pass that id
into the MCP audit input. If the current audit schema cannot store it, add a
nullable `providerRoutineCallPublicId` column and regenerate the DB migration.

- [ ] **Step 6: Run MCP tests**

Run:

```bash
pnpm --filter @repo/api-contract test -- mcp.test.ts
pnpm --filter @lightfast/mcp test -- tools.test.ts audit.test.ts auth.test.ts
pnpm --filter @lightfast/mcp typecheck
```

Expected: PASS.

---

### Task 7: Add Native Proxy Routes

**Files:**
- Create: `apps/app/src/app/(app)/(native-proxy)/api/native/proxy/routines/route.ts`
- Create: `apps/app/src/app/(app)/(native-proxy)/api/native/proxy/call/route.ts`
- Create: `apps/app/src/__tests__/app/api/native-proxy/native-proxy-routes.test.ts`
- Modify: `apps/app/src/proxy.ts`
- Modify: `api/app/package.json`

- [ ] **Step 1: Add failing route tests**

Tests should verify:

- missing native OAuth bearer returns `401`;
- missing org header returns `403`;
- non-member org header returns `401` or `403` according to existing native auth
  identity behavior;
- `GET /api/native/proxy/routines?query=create` calls `findProviderRoutines`;
- `POST /api/native/proxy/call` calls `callProviderRoutine`;
- route responses parse through provider-routine contract schemas.

- [ ] **Step 2: Allow native proxy route handlers**

In `apps/app/src/proxy.ts`, add:

```ts
"/api/native/proxy/(.*)"
```

to public/app-owned API routing so the route handler owns bearer auth and
OPTIONS behavior.

- [ ] **Step 3: Implement identity adapter**

Use `resolveAuthContextFromClerk` from `@api/app/auth/identity` with
`@db/app/client`. Require:

```ts
identity.type === "active"
access.kind === "clerk-oauth"
access.client === "cli"
```

Build service scopes for CLI as:

```ts
{
  providerRoutineRead: true,
  providerRoutineWrite: true,
}
```

- [ ] **Step 4: Implement `GET /api/native/proxy/routines`**

Parse query params into:

```ts
providerRoutineFindInputSchema.parse({
  includeSchema: searchParams.get("includeSchema") === "true" || undefined,
  limit: searchParams.get("limit")
    ? Number(searchParams.get("limit"))
    : undefined,
  provider: searchParams.get("provider") ?? undefined,
  query: searchParams.get("query") ?? undefined,
  readOnly: searchParams.get("readOnly") === "true" || undefined,
  routineId: searchParams.get("routineId") ?? undefined,
})
```

Call `findProviderRoutines` and return JSON.

- [ ] **Step 5: Implement `POST /api/native/proxy/call`**

Parse JSON with `providerRoutineCallInputSchema`, call
`callProviderRoutine`, and return JSON.

- [ ] **Step 6: Run route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- native-proxy-routes.test.ts
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

---

### Task 8: Add CLI Proxy Commands

**Files:**
- Create: `core/cli/src/proxy/client.ts`
- Create: `core/cli/src/proxy/commands.ts`
- Create: `core/cli/src/proxy/__tests__/commands.test.ts`
- Modify: `core/cli/src/program.ts`
- Modify: `core/cli/package.json`

- [ ] **Step 1: Add failing CLI tests**

Tests should verify:

- `lightfast proxy find create issue` sends native auth headers and query;
- `lightfast proxy find --provider linear --include-schema create issue` sets
  provider and includeSchema;
- `lightfast proxy call linear__create_issue --json '{"title":"Bug"}'` sends
  the routine id and JSON-object input;
- non-object `--json '[]'` fails locally before request;
- JSON output includes `providerRoutineCallId` when returned by the route.

- [ ] **Step 2: Implement proxy HTTP client**

Create `core/cli/src/proxy/client.ts` with:

```ts
import {
  providerRoutineCallInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";
import type { NativeSession } from "@repo/native-auth-contract";
import { buildNativeAuthHeaders } from "../auth/session";

export async function findProxyRoutines(input: {
  appUrl: string;
  includeSchema?: boolean;
  limit?: number;
  provider?: string;
  query?: string;
  session: NativeSession;
}) {
  const url = new URL("/api/native/proxy/routines", input.appUrl);
  if (input.query) url.searchParams.set("query", input.query);
  if (input.provider) url.searchParams.set("provider", input.provider);
  if (input.includeSchema) url.searchParams.set("includeSchema", "true");
  if (input.limit) url.searchParams.set("limit", String(input.limit));

  const response = await fetch(url, {
    headers: buildNativeAuthHeaders(input.session),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(String(json.error?.message ?? "Proxy find failed."));
  }
  return providerRoutineFindOutputSchema.parse(json);
}

export async function callProxyRoutine(input: {
  appUrl: string;
  routineId: string;
  routineInput: Record<string, unknown>;
  session: NativeSession;
}) {
  const body = providerRoutineCallInputSchema.parse({
    input: input.routineInput,
    routineId: input.routineId,
  });
  const response = await fetch(new URL("/api/native/proxy/call", input.appUrl), {
    body: JSON.stringify(body),
    headers: {
      ...buildNativeAuthHeaders(input.session),
      "content-type": "application/json",
    },
    method: "POST",
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(String(json.error?.message ?? "Proxy call failed."));
  }
  return json;
}
```

- [ ] **Step 3: Register commands**

In `core/cli/src/proxy/commands.ts`, add a `proxy` command with `find` and
`call` subcommands. `find` prints compact JSON by default. `call` requires
`--json` and parses it as an object.

- [ ] **Step 4: Wire program**

Import and register the proxy command in `core/cli/src/program.ts`.

- [ ] **Step 5: Run CLI tests**

Run:

```bash
pnpm --filter @lightfastai/cli test -- commands.test.ts
pnpm --filter @lightfastai/cli typecheck
```

Expected: PASS.

---

### Task 9: Verification And Follow-Up Issues

**Files:**
- Modify: `docs/superpowers/specs/2026-06-02-proxy-call-infra-upgrade-design.md` if implementation diverges.
- Create or update GitHub issues for deferred work.

- [ ] **Step 1: Run focused package verification**

Run:

```bash
pnpm --filter @repo/provider-routine-contract test
pnpm --filter @repo/provider-routine-contract typecheck
pnpm --filter @repo/provider-routines test
pnpm --filter @repo/provider-routines typecheck
pnpm --filter @db/app test -- provider-routine-calls.test.ts org-connector-connections.test.ts
pnpm --filter @api/app test -- connectors-router.test.ts
pnpm --filter @lightfast/mcp test -- tools.test.ts audit.test.ts auth.test.ts
pnpm --filter @lightfast/app test -- native-proxy-routes.test.ts connectors-page.test.tsx
pnpm --filter @lightfastai/cli test -- commands.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader verification**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Create deferred GitHub issues**

Create issues for:

- refresh and retry stale provider manifests;
- per-routine admin allowlists;
- automation runtime migration onto `callProviderRoutine`;
- rate limits by user/org/source/client;
- first-class duplicate write protection or confirmation model;
- optional direct MCP routine-tool mode;
- product-wide connector/integration terminology migration.

- [ ] **Step 4: Final manual smoke test**

With `pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color`
running, verify:

```bash
lightfast login
lightfast proxy find "create issue" --provider linear
lightfast proxy call linear__create_issue --json '{"title":"Proxy smoke test"}'
```

Expected:

- find returns `linear__create_issue` only when Linear is connected and
  `enabledForAgents` is on;
- call returns `providerRoutineCallId`;
- provider routine call row exists with `sourceSurface = native_cli`;
- hosted MCP `proxy_find` returns the same routine for an authorized grant.
