# Integration Call Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a minimal ledger of team integration routine calls, starting with Linear MCP calls from the connector runtime.

**Architecture:** Add one `lightfast_integration_calls` table and focused DB helpers for create-running, mark-succeeded, and mark-failed. Hook the existing connector runtime around `callLinearMcpTool` so every actual Linear provider call gets one ledger row. Keep day-1 redaction conservative and do not add graph, API, or UI surfaces.

**Tech Stack:** Drizzle MySQL schema in `@db/app`, Vitest tests, existing connector runtime in `api/app`, PlanetScale/Vitess migration generation through `pnpm db:generate`.

---

## File Structure

- Create `db/app/src/schema/tables/integration-calls.ts`
  - Owns the table, status/caller/provider types, public id prefix, and id factory.
- Modify `db/app/src/schema/tables/index.ts`
  - Re-export the integration call table/types/id factory.
- Modify `db/app/src/schema/index.ts`
  - Re-export via `./tables` automatically if needed after table index update.
- Modify `db/app/src/index.ts`
  - Re-export schema and helper APIs.
- Create `db/app/src/utils/integration-calls.ts`
  - Owns create-running, mark-succeeded, and mark-failed helper functions.
- Create `db/app/src/__tests__/integration-calls.test.ts`
  - Unit tests for schema shape and helpers using existing mock DB style.
- Modify `api/app/src/services/connectors/runtime.ts`
  - Insert and update ledger rows around actual Linear MCP calls.
- Modify `api/app/src/__tests__/connectors-runtime.test.ts`
  - Verify success/failure/preflight behavior.
- Generate a Drizzle migration with `pnpm db:generate`.

---

### Task 1: Add Integration Call Schema

**Files:**
- Create: `db/app/src/schema/tables/integration-calls.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/index.ts`
- Test: `db/app/src/__tests__/integration-calls.test.ts`

- [ ] **Step 1: Write the failing schema test**

Add `db/app/src/__tests__/integration-calls.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  createIntegrationCallId,
  INTEGRATION_CALL_ID_PREFIX,
  integrationCalls,
} from "../schema";

describe("integration call schema", () => {
  it("creates public ids with the integration call prefix", () => {
    const id = createIntegrationCallId();

    expect(id.startsWith(INTEGRATION_CALL_ID_PREFIX)).toBe(true);
    expect(id).toHaveLength(INTEGRATION_CALL_ID_PREFIX.length + 36);
  });

  it("exports the integration call table with nullable redacted payloads and error fields", () => {
    expect(integrationCalls.publicId.notNull).toBe(true);
    expect(integrationCalls.clerkOrgId.notNull).toBe(true);
    expect(integrationCalls.calledByKind.notNull).toBe(true);
    expect(integrationCalls.calledById.notNull).toBe(true);
    expect(integrationCalls.calledByUserId.notNull).toBe(false);
    expect(integrationCalls.inputRedacted.notNull).toBe(false);
    expect(integrationCalls.outputRedacted.notNull).toBe(false);
    expect(integrationCalls.errorCode.notNull).toBe(false);
    expect(integrationCalls.errorMessage.notNull).toBe(false);
    expect(integrationCalls.finishedAt.notNull).toBe(false);
  });
});
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run:

```bash
pnpm --filter @db/app test -- integration-calls.test.ts
```

Expected: FAIL because `integrationCalls`, `createIntegrationCallId`, and `INTEGRATION_CALL_ID_PREFIX` are not exported.

- [ ] **Step 3: Create the schema table**

Create `db/app/src/schema/tables/integration-calls.ts`:

```ts
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const INTEGRATION_CALL_ID_PREFIX = "integration_call_";

const PUBLIC_ID_LENGTH = 96;
const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const ROUTINE_NAME_LENGTH = 160;
const CODE_LENGTH = 32;
const ERROR_CODE_LENGTH = 64;

export type IntegrationCallCalledByKind = "automation" | "system" | "user";
export type IntegrationCallProvider = "linear";
export type IntegrationCallStatus = "failed" | "running" | "succeeded";
export type IntegrationCallRedactedPayload = Record<string, unknown>;

export function createIntegrationCallId() {
  return `${INTEGRATION_CALL_ID_PREFIX}${randomUUID()}`;
}

export const integrationCalls = mysqlTable(
  "lightfast_integration_calls",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createIntegrationCallId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    calledByKind: varchar("called_by_kind", { length: CODE_LENGTH })
      .$type<IntegrationCallCalledByKind>()
      .notNull(),

    calledById: varchar("called_by_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    calledByUserId: varchar("called_by_user_id", {
      length: CLERK_ID_LENGTH,
    }),

    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<IntegrationCallProvider>()
      .notNull(),

    routineName: varchar("routine_name", {
      length: ROUTINE_NAME_LENGTH,
    }).notNull(),

    providerToolName: varchar("provider_tool_name", {
      length: ROUTINE_NAME_LENGTH,
    }).notNull(),

    connectorConnectionId: bigint("connector_connection_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    providerWorkspaceId: varchar("provider_workspace_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    providerActorId: varchar("provider_actor_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<IntegrationCallStatus>()
      .notNull(),

    inputRedacted: json("input_redacted").$type<IntegrationCallRedactedPayload | null>(),

    outputRedacted: json("output_redacted").$type<IntegrationCallRedactedPayload | null>(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),

    finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // Match other Vitess-safe tables: keep update semantics in Drizzle runtime
    // because generated fractional timestamp ON UPDATE clauses can be invalid.
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("integration_calls_public_id_uq").on(
      table.publicId
    ),
    orgCreatedIdx: index("integration_calls_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    orgCallerCreatedIdx: index("integration_calls_org_caller_created_idx").on(
      table.clerkOrgId,
      table.calledByKind,
      table.calledById,
      table.createdAt,
      table.id
    ),
    providerRoutineCreatedIdx: index(
      "integration_calls_provider_routine_created_idx"
    ).on(table.provider, table.routineName, table.createdAt, table.id),
  })
);

export type IntegrationCall = typeof integrationCalls.$inferSelect;
export type InsertIntegrationCall = typeof integrationCalls.$inferInsert;
```

- [ ] **Step 4: Export the schema**

Update `db/app/src/schema/tables/index.ts`:

```ts
export {
  createIntegrationCallId,
  type InsertIntegrationCall,
  INTEGRATION_CALL_ID_PREFIX,
  type IntegrationCall,
  type IntegrationCallCalledByKind,
  type IntegrationCallProvider,
  type IntegrationCallRedactedPayload,
  type IntegrationCallStatus,
  integrationCalls,
} from "./integration-calls";
```

Add the export block near the other table exports.

Update `db/app/src/index.ts` inside the large schema re-export block:

```ts
  createIntegrationCallId,
  type InsertIntegrationCall,
  INTEGRATION_CALL_ID_PREFIX,
  type IntegrationCall,
  type IntegrationCallCalledByKind,
  type IntegrationCallProvider,
  type IntegrationCallRedactedPayload,
  type IntegrationCallStatus,
  integrationCalls,
```

- [ ] **Step 5: Run the schema test**

Run:

```bash
pnpm --filter @db/app test -- integration-calls.test.ts
```

Expected: PASS.

---

### Task 2: Add Integration Call DB Helpers

**Files:**
- Modify: `db/app/src/__tests__/integration-calls.test.ts`
- Create: `db/app/src/utils/integration-calls.ts`
- Modify: `db/app/src/index.ts`

- [ ] **Step 1: Add failing helper tests**

Append to `db/app/src/__tests__/integration-calls.test.ts`:

```ts
import type { Database } from "../client";
import type { IntegrationCall } from "../schema";
import {
  createIntegrationCall,
  markIntegrationCallFailed,
  markIntegrationCallSucceeded,
} from "../utils/integration-calls";

function integrationCall(
  overrides: Partial<IntegrationCall> = {}
): IntegrationCall {
  return {
    id: 1,
    publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_acme",
    calledByKind: "automation",
    calledById: "automation_run_123e4567-e89b-12d3-a456-426614174000",
    calledByUserId: null,
    provider: "linear",
    routineName: "linear__create_issue",
    providerToolName: "create_issue",
    connectorConnectionId: 42,
    providerWorkspaceId: "workspace_1",
    providerActorId: "actor_1",
    status: "running",
    inputRedacted: { present: true },
    outputRedacted: null,
    errorCode: null,
    errorMessage: null,
    startedAt: new Date("2026-06-02T00:00:00.000Z"),
    finishedAt: null,
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
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

describe("integration call helpers", () => {
  it("creates a running integration call", async () => {
    const inserted = integrationCall();
    const valuesMock = vi.fn(() => ({
      $returningId: () => Promise.resolve([{ id: inserted.id }]),
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => selectRows([inserted])),
    } as unknown as Database;

    await expect(
      createIntegrationCall(db, {
        calledById: inserted.calledById,
        calledByKind: "automation",
        calledByUserId: null,
        clerkOrgId: "org_acme",
        connectorConnectionId: 42,
        inputRedacted: { present: true },
        provider: "linear",
        providerActorId: "actor_1",
        providerToolName: "create_issue",
        providerWorkspaceId: "workspace_1",
        routineName: "linear__create_issue",
        startedAt: inserted.startedAt,
      })
    ).resolves.toMatchObject({
      publicId: inserted.publicId,
      status: "running",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calledByKind: "automation",
        calledById: inserted.calledById,
        status: "running",
      })
    );
  });

  it("marks a running integration call succeeded", async () => {
    const updateWhere = vi.fn(() => Promise.resolve({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where: updateWhere }));
    const db = { update: vi.fn(() => ({ set })) } as unknown as Database;
    const finishedAt = new Date("2026-06-02T00:00:01.000Z");

    await expect(
      markIntegrationCallSucceeded(db, {
        clerkOrgId: "org_acme",
        finishedAt,
        outputRedacted: { present: true },
        publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith({
      errorCode: null,
      errorMessage: null,
      finishedAt,
      outputRedacted: { present: true },
      status: "succeeded",
      updatedAt: finishedAt,
    });
  });

  it("marks a running integration call failed with a safe error", async () => {
    const updateWhere = vi.fn(() => Promise.resolve({ affectedRows: 1 }));
    const set = vi.fn(() => ({ where: updateWhere }));
    const db = { update: vi.fn(() => ({ set })) } as unknown as Database;
    const finishedAt = new Date("2026-06-02T00:00:01.000Z");

    await expect(
      markIntegrationCallFailed(db, {
        clerkOrgId: "org_acme",
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "Linear MCP tool call failed.",
        finishedAt,
        publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith({
      errorCode: "LINEAR_MCP_FAILED",
      errorMessage: "Linear MCP tool call failed.",
      finishedAt,
      status: "failed",
      updatedAt: finishedAt,
    });
  });
});
```

Also add `vi` to the existing import:

```ts
import { describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
pnpm --filter @db/app test -- integration-calls.test.ts
```

Expected: FAIL because `db/app/src/utils/integration-calls.ts` does not exist.

- [ ] **Step 3: Implement helper functions**

Create `db/app/src/utils/integration-calls.ts`:

```ts
import { and, eq } from "drizzle-orm";

import type { Database } from "../client";
import type {
  IntegrationCall,
  IntegrationCallCalledByKind,
  IntegrationCallProvider,
  IntegrationCallRedactedPayload,
} from "../schema";
import { integrationCalls } from "../schema";
import { getRowsAffected } from "./drizzle-results";

export interface CreateIntegrationCallInput {
  calledById: string;
  calledByKind: IntegrationCallCalledByKind;
  calledByUserId?: string | null;
  clerkOrgId: string;
  connectorConnectionId: number;
  inputRedacted?: IntegrationCallRedactedPayload | null;
  provider: IntegrationCallProvider;
  providerActorId?: string | null;
  providerToolName: string;
  providerWorkspaceId?: string | null;
  routineName: string;
  startedAt?: Date;
}

export async function createIntegrationCall(
  db: Database,
  input: CreateIntegrationCallInput
): Promise<IntegrationCall> {
  const startedAt = input.startedAt ?? new Date();
  const [row] = await db
    .insert(integrationCalls)
    .values({
      calledById: input.calledById,
      calledByKind: input.calledByKind,
      calledByUserId: input.calledByUserId ?? null,
      clerkOrgId: input.clerkOrgId,
      connectorConnectionId: input.connectorConnectionId,
      inputRedacted: input.inputRedacted ?? null,
      outputRedacted: null,
      provider: input.provider,
      providerActorId: input.providerActorId ?? null,
      providerToolName: input.providerToolName,
      providerWorkspaceId: input.providerWorkspaceId ?? null,
      routineName: input.routineName,
      startedAt,
      status: "running",
    })
    .$returningId();

  if (!row?.id) {
    throw new Error(
      `Failed to create integration call for org ${input.clerkOrgId}`
    );
  }

  const inserted = await getIntegrationCallById(db, row.id);
  if (!inserted) {
    throw new Error(
      `Failed to load integration call ${row.id} for org ${input.clerkOrgId}`
    );
  }
  return inserted;
}

export interface MarkIntegrationCallSucceededInput {
  clerkOrgId: string;
  finishedAt?: Date;
  outputRedacted?: IntegrationCallRedactedPayload | null;
  publicId: string;
}

export async function markIntegrationCallSucceeded(
  db: Database,
  input: MarkIntegrationCallSucceededInput
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(integrationCalls)
    .set({
      errorCode: null,
      errorMessage: null,
      finishedAt,
      outputRedacted: input.outputRedacted ?? null,
      status: "succeeded",
      updatedAt: finishedAt,
    })
    .where(runningIntegrationCallWhere(input));

  return getRowsAffected(result) > 0;
}

export interface MarkIntegrationCallFailedInput {
  clerkOrgId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  finishedAt?: Date;
  publicId: string;
}

export async function markIntegrationCallFailed(
  db: Database,
  input: MarkIntegrationCallFailedInput
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(integrationCalls)
    .set({
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      finishedAt,
      status: "failed",
      updatedAt: finishedAt,
    })
    .where(runningIntegrationCallWhere(input));

  return getRowsAffected(result) > 0;
}

async function getIntegrationCallById(
  db: Database,
  id: number
): Promise<IntegrationCall | undefined> {
  const [row] = await db
    .select()
    .from(integrationCalls)
    .where(eq(integrationCalls.id, id))
    .limit(1);
  return row;
}

function runningIntegrationCallWhere(input: {
  clerkOrgId: string;
  publicId: string;
}) {
  return and(
    eq(integrationCalls.clerkOrgId, input.clerkOrgId),
    eq(integrationCalls.publicId, input.publicId),
    eq(integrationCalls.status, "running")
  );
}
```

- [ ] **Step 4: Export helper functions**

Update `db/app/src/index.ts` after the org connector helper exports:

```ts
export {
  createIntegrationCall,
  type CreateIntegrationCallInput,
  markIntegrationCallFailed,
  type MarkIntegrationCallFailedInput,
  markIntegrationCallSucceeded,
  type MarkIntegrationCallSucceededInput,
} from "./utils/integration-calls";
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
pnpm --filter @db/app test -- integration-calls.test.ts
```

Expected: PASS.

---

### Task 3: Hook Linear Runtime Calls Into The Ledger

**Files:**
- Modify: `api/app/src/__tests__/connectors-runtime.test.ts`
- Modify: `api/app/src/services/connectors/runtime.ts`

- [ ] **Step 1: Add failing runtime ledger tests**

Update the `@db/app` mock in `api/app/src/__tests__/connectors-runtime.test.ts`:

```ts
const createIntegrationCallMock = vi.fn();
const markIntegrationCallSucceededMock = vi.fn();
const markIntegrationCallFailedMock = vi.fn();

vi.mock("@db/app", () => ({
  createIntegrationCall: createIntegrationCallMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
  markCurrentOrgConnectorConnectionError:
    markCurrentOrgConnectorConnectionErrorMock,
  markIntegrationCallFailed: markIntegrationCallFailedMock,
  markIntegrationCallSucceeded: markIntegrationCallSucceededMock,
}));
```

Add to `beforeEach`:

```ts
createIntegrationCallMock.mockReset();
createIntegrationCallMock.mockResolvedValue({
  publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
});
markIntegrationCallSucceededMock.mockReset();
markIntegrationCallSucceededMock.mockResolvedValue(true);
markIntegrationCallFailedMock.mockReset();
markIntegrationCallFailedMock.mockResolvedValue(true);
```

Extend the existing success test `"calls Linear MCP with a fresh token and logs redacted success data"` with these assertions:

```ts
expect(createIntegrationCallMock).toHaveBeenCalledWith(
  {},
  expect.objectContaining({
    calledById: "run_123",
    calledByKind: "automation",
    calledByUserId: null,
    clerkOrgId: "org_acme",
    connectorConnectionId: 1,
    inputRedacted: { present: true },
    provider: "linear",
    providerActorId: "actor_1",
    providerToolName: "create_issue",
    providerWorkspaceId: "workspace_1",
    routineName: "linear__create_issue",
  })
);
expect(markIntegrationCallSucceededMock).toHaveBeenCalledWith(
  {},
  {
    clerkOrgId: "org_acme",
    outputRedacted: { present: true },
    publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
  }
);
expect(markIntegrationCallFailedMock).not.toHaveBeenCalled();
```

Extend the existing Linear MCP failure test `"logs redacted failure data"` with:

```ts
expect(markIntegrationCallFailedMock).toHaveBeenCalledWith(
  {},
  {
    clerkOrgId: "org_acme",
    errorCode: "LINEAR_MCP_FAILED",
    errorMessage: "Linear MCP tool call failed.",
    publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
  }
);
expect(markIntegrationCallSucceededMock).not.toHaveBeenCalled();
```

Extend the existing preflight test `"re-checks current active and enabled state before every call"` with:

```ts
expect(createIntegrationCallMock).not.toHaveBeenCalled();
expect(markIntegrationCallSucceededMock).not.toHaveBeenCalled();
expect(markIntegrationCallFailedMock).not.toHaveBeenCalled();
```

Add a test that a failed ledger update is logged but does not change the
provider call result:

```ts
it("does not fail a successful Linear call when the ledger success update fails", async () => {
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
  getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
  callLinearMcpToolMock.mockResolvedValue({
    content: [{ text: "mcp_result" }],
  });
  markIntegrationCallSucceededMock.mockRejectedValueOnce(
    new Error("ledger write failed")
  );

  const [tool] = await loadConnectorRuntimeTools({
    automationPublicId: "aut_123",
    clerkOrgId: "org_acme",
    runPublicId: "run_123",
  });

  await expect(tool?.call({ title: "secret-title" })).resolves.toEqual({
    content: [{ text: "mcp_result" }],
  });
  expect(logWarnMock).toHaveBeenCalledWith(
    "[connectors] integration call ledger update failed",
    expect.objectContaining({
      clerkOrgId: "org_acme",
      provider: "linear",
      routineName: "linear__create_issue",
    })
  );
});
```

Add a test that a failed initial ledger create is logged but does not prevent the
provider call:

```ts
it("does not fail a Linear call when the initial ledger create fails", async () => {
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
  getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
  createIntegrationCallMock.mockRejectedValueOnce(
    new Error("ledger create failed")
  );
  callLinearMcpToolMock.mockResolvedValue({
    content: [{ text: "mcp_result" }],
  });

  const [tool] = await loadConnectorRuntimeTools({
    automationPublicId: "aut_123",
    clerkOrgId: "org_acme",
    runPublicId: "run_123",
  });

  await expect(tool?.call({ title: "secret-title" })).resolves.toEqual({
    content: [{ text: "mcp_result" }],
  });
  expect(callLinearMcpToolMock).toHaveBeenCalledOnce();
  expect(markIntegrationCallSucceededMock).not.toHaveBeenCalled();
  expect(markIntegrationCallFailedMock).not.toHaveBeenCalled();
  expect(logWarnMock).toHaveBeenCalledWith(
    "[connectors] integration call ledger create failed",
    expect.objectContaining({
      clerkOrgId: "org_acme",
      provider: "linear",
      routineName: "linear__create_issue",
    })
  );
});
```

Extend the existing token-refresh terminal failure test with:

```ts
expect(markIntegrationCallFailedMock).toHaveBeenCalledWith(
  {},
  {
    clerkOrgId: "org_acme",
    errorCode: "LINEAR_TOKEN_REFRESH_FAILED",
    errorMessage: "Linear OAuth token refresh failed.",
    publicId: "integration_call_123e4567-e89b-12d3-a456-426614174000",
  }
);
expect(callLinearMcpToolMock).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run runtime tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- connectors-runtime.test.ts
```

Expected: FAIL because `runtime.ts` does not create or update integration call rows.

- [ ] **Step 3: Implement runtime ledger calls**

Update imports in `api/app/src/services/connectors/runtime.ts`:

```ts
import {
  createIntegrationCall,
  getCurrentOrgConnectorConnection,
  listCurrentOrgConnectorConnections,
  markCurrentOrgConnectorConnectionError,
  markIntegrationCallFailed,
  markIntegrationCallSucceeded,
  type OrgConnectorConnection,
} from "@db/app";
```

Add helper functions near `normalizeMcpToolInput`:

```ts
async function safelyCreateIntegrationCall(
  input: Parameters<typeof createIntegrationCall>[1],
  context: RuntimeToolCallContext
) {
  try {
    return await createIntegrationCall(appDb, input);
  } catch (error) {
    log.warn("[connectors] integration call ledger create failed", {
      clerkOrgId: context.clerkOrgId,
      failure: safeErrorDetails(error),
      provider: "linear",
      providerToolName: context.providerToolName,
      routineName: context.runtimeToolName,
    });
    return null;
  }
}

async function safelyUpdateIntegrationCall(
  update: () => Promise<boolean>,
  context: RuntimeToolCallContext
) {
  try {
    await update();
  } catch (error) {
    log.warn("[connectors] integration call ledger update failed", {
      clerkOrgId: context.clerkOrgId,
      failure: safeErrorDetails(error),
      provider: "linear",
      providerToolName: context.providerToolName,
      routineName: context.runtimeToolName,
    });
  }
}

function calledByContext(context: RuntimeToolCallContext) {
  if (context.runPublicId) {
    return {
      calledById: context.runPublicId,
      calledByKind: "automation" as const,
      calledByUserId: null,
    };
  }

  return {
    calledById: "connector-runtime",
    calledByKind: "system" as const,
    calledByUserId: null,
  };
}

function redactedPresence(value: unknown) {
  return value === undefined ? null : { present: true };
}
```

In `callConnectorRuntimeTool`, after the active/current/tool validation and before
`getFreshLinearConnectorAccessToken`, create the ledger row through the safe
create wrapper:

```ts
    const integrationCall = await safelyCreateIntegrationCall({
      ...calledByContext(context),
      clerkOrgId: context.clerkOrgId,
      connectorConnectionId: connection.id,
      inputRedacted: redactedPresence(input),
      provider: "linear",
      providerActorId: connection.providerActorId,
      providerToolName: context.providerToolName,
      providerWorkspaceId: connection.providerWorkspaceId,
      routineName: context.runtimeToolName,
    }, context);
```

After `callLinearMcpTool` succeeds and before the success log, mark success
through the safe update wrapper:

```ts
    await safelyUpdateIntegrationCall(
      () =>
        markIntegrationCallSucceeded(appDb, {
          clerkOrgId: context.clerkOrgId,
          outputRedacted: redactedPresence(result),
          publicId: integrationCall.publicId,
        }),
      context
    );
```

Wrap the section after ledger creation so failed token refreshes or MCP calls mark the row failed. The final shape inside the `try` block should be:

```ts
    const integrationCall = await safelyCreateIntegrationCall({
      ...calledByContext(context),
      clerkOrgId: context.clerkOrgId,
      connectorConnectionId: connection.id,
      inputRedacted: redactedPresence(input),
      provider: "linear",
      providerActorId: connection.providerActorId,
      providerToolName: context.providerToolName,
      providerWorkspaceId: connection.providerWorkspaceId,
      routineName: context.runtimeToolName,
    }, context);

    try {
      const accessToken = await getFreshLinearConnectorAccessToken({
        connection,
        db: appDb,
      });
      const result = await callLinearMcpTool({
        accessToken,
        endpoint: connection.mcpEndpoint,
        input: normalizeMcpToolInput(input),
        name: context.providerToolName,
      });

      if (integrationCall) {
        await safelyUpdateIntegrationCall(
          () =>
            markIntegrationCallSucceeded(appDb, {
              clerkOrgId: context.clerkOrgId,
              outputRedacted: redactedPresence(result),
              publicId: integrationCall.publicId,
            }),
          context
        );
      }

      log.info("[connectors] runtime tool call completed", {
        ...logContext,
        success: true,
      });
      return result;
    } catch (error) {
      if (integrationCall) {
        await safelyUpdateIntegrationCall(
          () =>
            markIntegrationCallFailed(appDb, {
              clerkOrgId: context.clerkOrgId,
              errorCode: getErrorCode(error),
              errorMessage: isKnownLinearError(error)
                ? safeLinearErrorMessage(error)
                : undefined,
              publicId: integrationCall.publicId,
            }),
          context
        );
      }
      throw error;
    }
```

Keep the outer `catch` block as the existing terminal-token-error and redacted logging path.

- [ ] **Step 4: Run runtime tests**

Run:

```bash
pnpm --filter @api/app test -- connectors-runtime.test.ts
```

Expected: PASS.

---

### Task 4: Generate Migration And Run Focused Verification

**Files:**
- Create: generated Drizzle migration under `db/app/src/migrations/`
- Modify: generated Drizzle migration journal if Drizzle updates it

- [ ] **Step 1: Generate migration**

Run from repo root:

```bash
pnpm db:generate
```

Expected: Drizzle generates a migration for `lightfast_integration_calls`. Do not hand-write SQL.

- [ ] **Step 2: Inspect generated migration**

Run:

```bash
git diff -- db/app/src/migrations db/app/src/schema/tables/integration-calls.ts
```

Expected: migration only creates `lightfast_integration_calls` and its indexes. It should not change unrelated tables.

- [ ] **Step 3: Run focused package tests**

Run:

```bash
pnpm --filter @db/app test -- integration-calls.test.ts
pnpm --filter @api/app test -- connectors-runtime.test.ts
```

Expected: both commands PASS.

- [ ] **Step 4: Run focused typecheck**

Run:

```bash
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Review final diff**

Run:

```bash
git diff --stat
git diff -- db/app/src api/app/src docs/superpowers
```

Expected:
- one new design spec,
- one new implementation plan,
- one new integration call schema,
- one new integration call helper,
- exports,
- focused tests,
- generated migration,
- connector runtime hook.

No UI or tRPC route changes should appear.
