# Chat Connector Write Mode And X Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let workspace chat use agent-enabled X read routines and opt-in Linear write routines when the current turn enables write mode and the stored Linear connection has `write` scope.

**Architecture:** Move chat off the Linear-only `@repo/provider-routines` service and onto an `@api/app` chat routine service backed by current connector rows. Add a chat-specific runtime entry point that reuses the existing Linear and X provider call helpers while recording provider routine calls with `sourceSurface: "chat"`. Keep write mode request-scoped, default it off, and surface reconnect-required warnings through the provider routine contract.

**Tech Stack:** TypeScript, pnpm workspace, Next.js App Router, AI SDK tools, Zod, Drizzle DB utilities, Vitest, React 19, Radix Toggle via `@repo/ui`, existing connector runtime, existing Linear and X MCP helpers.

**Design doc:** `docs/superpowers/specs/2026-06-06-chat-connector-write-mode-and-x-read-design.md`

---

## File Structure

Create:

- `api/app/src/services/connectors/chat-routines.ts` - Chat-facing provider routine discovery and call authorization for Linear and X.
- `api/app/src/__tests__/connectors-chat-routines.test.ts` - Unit tests for chat discovery, scope warnings, call gates, runtime handoff, and redacted logs.

Modify:

- `packages/provider-routine-contract/src/index.ts` - Add reconnect-required error code and non-fatal find warnings.
- `packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts` - Contract coverage for find warnings and reconnect-required errors.
- `api/app/src/services/connectors/runtime.ts` - Add `loadChatConnectorRuntimeTools`, generalize call source metadata, and allow `sourceSurface: "chat"` in ledger creation.
- `api/app/src/__tests__/connectors-runtime.test.ts` - Coverage for chat runtime loading and chat ledger metadata.
- `api/app/src/services/connectors/index.ts` - Export chat routine service.
- `apps/app/src/app/(chat)/api/chat/route.ts` - Add request write mode, import chat service, update system/tool descriptions, and pass chat context.
- `apps/app/src/__tests__/app/api/chat/route.test.ts` - Update mocks and add write-mode routing coverage.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-composer.tsx` - Add compact per-turn write toggle.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-composer.test.tsx` - Toggle rendering and interaction coverage.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx` - Store write mode for one submitted message and reset it.
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx` - Request body and reset coverage for write mode.

Do not modify:

- X OAuth scopes. X remains read-only in chat.
- Automation routine selection behavior, except shared runtime internals needed for the chat entry point.
- Provider routine risk tiers. All Linear write routines are allowed when write mode and stored `write` scope are present.
- Database schema or migrations. The provider routine call table already supports `sourceSurface: "chat"`.

---

### Task 1: Extend Provider Routine Contract

**Files:**
- Modify: `packages/provider-routine-contract/src/index.ts`
- Test: `packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Update the import block in `packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts`:

```ts
import {
  mcpProviderRoutineCallCommandInputSchema,
  mcpProviderRoutineFindCommandInputSchema,
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  providerRoutineErrorCodeSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
  providerRoutineId,
  providerRoutineIdSchema,
  providerRoutineSourceSurfaceSchema,
} from "../index";
```

Add these tests inside `describe("proxy schemas", () => { ... })`:

```ts
it("parses reconnect-required find warnings", () => {
  expect(
    providerRoutineFindOutputSchema.parse({
      routines: [],
      warnings: [
        {
          code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
          provider: "linear",
          requiredScopes: ["write"],
          message: "Reconnect Linear to enable write access.",
        },
      ],
    })
  ).toEqual({
    routines: [],
    warnings: [
      {
        code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
        provider: "linear",
        requiredScopes: ["write"],
        message: "Reconnect Linear to enable write access.",
      },
    ],
  });
});

it("includes reconnect-required as a provider routine error code", () => {
  expect(
    providerRoutineErrorCodeSchema.parse(
      "PROVIDER_ROUTINE_RECONNECT_REQUIRED"
    )
  ).toBe("PROVIDER_ROUTINE_RECONNECT_REQUIRED");
});
```

- [ ] **Step 2: Run the focused contract test and confirm failure**

Run:

```bash
pnpm --filter @repo/provider-routine-contract test -- provider-routine-contract.test.ts
```

Expected: FAIL because `providerRoutineFindOutputSchema` does not accept `warnings` and the error code enum does not include `PROVIDER_ROUTINE_RECONNECT_REQUIRED`.

- [ ] **Step 3: Add find warning schemas and reconnect error code**

In `packages/provider-routine-contract/src/index.ts`, add these schemas after `providerRoutineSearchReasonSchema`:

```ts
export const providerRoutineFindWarningCodeSchema = z.enum([
  "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
]);
export type ProviderRoutineFindWarningCode = z.infer<
  typeof providerRoutineFindWarningCodeSchema
>;

export const providerRoutineFindWarningSchema = z.object({
  code: providerRoutineFindWarningCodeSchema,
  message: z.string().min(1),
  provider: connectableConnectorProviderSchema,
  requiredScopes: z.array(z.string().min(1)),
});
export type ProviderRoutineFindWarning = z.infer<
  typeof providerRoutineFindWarningSchema
>;
```

Update `providerRoutineFindOutputSchema`:

```ts
export const providerRoutineFindOutputSchema = z.object({
  reason: providerRoutineSearchReasonSchema.optional(),
  routines: z.array(providerRoutineSummarySchema),
  warnings: z.array(providerRoutineFindWarningSchema).optional(),
});
```

Add the reconnect code to `providerRoutineErrorCodeSchema`:

```ts
export const providerRoutineErrorCodeSchema = z.enum([
  "PROVIDER_ROUTINE_NOT_FOUND",
  "PROVIDER_ROUTINE_NOT_ENABLED",
  "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
  "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
  "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
  "PROVIDER_ROUTINE_INVALID_INPUT",
  "PROVIDER_ROUTINE_AUTH_REQUIRED",
  "PROVIDER_ROUTINE_PROVIDER_FAILED",
  "PROVIDER_ROUTINE_TIMEOUT",
]);
```

- [ ] **Step 4: Run the focused contract test and confirm pass**

Run:

```bash
pnpm --filter @repo/provider-routine-contract test -- provider-routine-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the contract slice**

```bash
git add packages/provider-routine-contract/src/index.ts packages/provider-routine-contract/src/__tests__/provider-routine-contract.test.ts
git commit -m "feat(provider-routines): add reconnect warnings"
```

---

### Task 2: Add Chat Connector Runtime Entry Point

**Files:**
- Modify: `api/app/src/services/connectors/runtime.ts`
- Test: `api/app/src/__tests__/connectors-runtime.test.ts`

- [ ] **Step 1: Write failing chat runtime tests**

Update the dynamic import in `api/app/src/__tests__/connectors-runtime.test.ts`:

```ts
const {
  ConnectorRuntimeToolCallError,
  loadChatConnectorRuntimeTools,
  loadConnectorRuntimeTools,
} = await import("../services/connectors/runtime");
```

Add these tests near the existing `loadConnectorRuntimeTools` tests:

```ts
it("loads active agent-enabled tools for chat without requiring automation access", async () => {
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
    connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      toolManifest: [{ description: "List issues", name: "list_issues" }],
    }),
    connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      id: 42,
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      provider: "x",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      scopes: ["tweet.read", "users.read", "offline.access"],
      toolManifest: [
        { description: "Look up account", name: "getUsersByUsername" },
      ],
    }),
  ]);

  const tools = await loadChatConnectorRuntimeTools({
    calledByUserId: "user_current",
    clerkOrgId: "org_acme",
    conversationId: "conv_123",
  });

  expect(tools).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        provider: "linear",
        providerToolName: "list_issues",
        runtimeToolName: "linear__list_issues",
      }),
      expect.objectContaining({
        provider: "x",
        providerToolName: "getUsersByUsername",
        runtimeToolName: "x__getUsersByUsername",
      }),
    ])
  );
});

it("records chat runtime calls with user caller and chat source metadata", async () => {
  const chatConnection = connection({
    enabledForAgents: true,
    enabledForAutomations: false,
    toolManifest: [{ name: "list_issues" }],
  });
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([chatConnection]);
  getCurrentOrgConnectorConnectionMock.mockResolvedValue(chatConnection);
  callLinearMcpToolMock.mockResolvedValue({
    content: [{ text: "issue list" }],
  });

  const [tool] = await loadChatConnectorRuntimeTools({
    calledByUserId: "user_current",
    clerkOrgId: "org_acme",
    conversationId: "conv_123",
  });

  await expect(tool?.callWithMetadata({ query: "bug" })).resolves.toEqual({
    provider: "linear",
    providerRoutineCallId: "provider_routine_call_123",
    providerToolName: "list_issues",
    result: { content: [{ text: "issue list" }] },
    routineId: "linear__list_issues",
    runtimeToolName: "linear__list_issues",
  });

  expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      calledById: "user_current",
      calledByKind: "user",
      calledByUserId: "user_current",
      clerkOrgId: "org_acme",
      provider: "linear",
      providerConnectionId: 1,
      providerToolName: "list_issues",
      routineId: "linear__list_issues",
      sourceClientId: null,
      sourceRef: "conv_123",
      sourceSurface: "chat",
    })
  );
});
```

- [ ] **Step 2: Run the focused runtime test and confirm failure**

Run:

```bash
pnpm --filter @api/app test -- connectors-runtime.test.ts
```

Expected: FAIL because `loadChatConnectorRuntimeTools` is not exported.

- [ ] **Step 3: Generalize runtime source metadata**

In `api/app/src/services/connectors/runtime.ts`, import the DB source surface type:

```ts
import {
  createProviderRoutineCall,
  getCurrentOrgConnectorConnection,
  listCurrentOrgConnectorConnections,
  markCurrentOrgConnectorConnectionError,
  markProviderRoutineCallFailed,
  markProviderRoutineCallProviderAttempted,
  markProviderRoutineCallSucceeded,
  type OrgConnectorConnection,
  type ProviderRoutineCall,
  type ProviderRoutineCallRedactedPayload,
  type ProviderRoutineCallSourceSurface,
} from "@db/app";
```

Replace `RuntimeToolCallContext` and `calledByContext` with explicit source metadata:

```ts
type RuntimeConnectionAccess = "agents" | "automations";

interface RuntimeToolCallSource {
  calledById: string;
  calledByKind: "automation" | "system" | "user";
  calledByUserId: string | null;
  requireLedger: boolean;
  sourceRef: string | null;
  sourceSurface: ProviderRoutineCallSourceSurface;
}

interface RuntimeToolCallContext {
  automationPublicId?: string;
  clerkOrgId: string;
  connectionAccess: RuntimeConnectionAccess;
  provider: ConnectableConnectorProvider;
  providerToolName: string;
  runPublicId?: string;
  runtimeToolName: string;
  source: RuntimeToolCallSource;
}
```

Add these source helpers:

```ts
function automationRuntimeSource(input: {
  calledByUserId?: string | null;
  runPublicId?: string;
}): RuntimeToolCallSource {
  if (input.runPublicId) {
    return {
      calledById: input.runPublicId,
      calledByKind: "automation",
      calledByUserId: input.calledByUserId ?? null,
      requireLedger: true,
      sourceRef: input.runPublicId,
      sourceSurface: "automation",
    };
  }

  return {
    calledById: "connector-runtime",
    calledByKind: "system",
    calledByUserId: null,
    requireLedger: false,
    sourceRef: "connector-runtime",
    sourceSurface: "system",
  };
}

function chatRuntimeSource(input: {
  calledByUserId: string;
  conversationId: string;
}): RuntimeToolCallSource {
  return {
    calledById: input.calledByUserId,
    calledByKind: "user",
    calledByUserId: input.calledByUserId,
    requireLedger: true,
    sourceRef: input.conversationId,
    sourceSurface: "chat",
  };
}
```

- [ ] **Step 4: Add `loadChatConnectorRuntimeTools` and keep automation behavior**

Add this exported function after `loadConnectorRuntimeTools`:

```ts
export async function loadChatConnectorRuntimeTools(input: {
  calledByUserId: string;
  clerkOrgId: string;
  conversationId: string;
}): Promise<ConnectorRuntimeToolSource[]> {
  return await loadConnectorRuntimeToolsForConnections({
    clerkOrgId: input.clerkOrgId,
    connectionAccess: "agents",
    source: chatRuntimeSource(input),
  });
}
```

Change `loadConnectorRuntimeTools` so it delegates to a shared loader:

```ts
export async function loadConnectorRuntimeTools(input: {
  clerkOrgId: string;
  automationPublicId?: string;
  calledByUserId?: string | null;
  runPublicId?: string;
}): Promise<ConnectorRuntimeToolSource[]> {
  return await loadConnectorRuntimeToolsForConnections({
    automationPublicId: input.automationPublicId,
    clerkOrgId: input.clerkOrgId,
    connectionAccess: "automations",
    runPublicId: input.runPublicId,
    source: automationRuntimeSource(input),
  });
}

async function loadConnectorRuntimeToolsForConnections(input: {
  automationPublicId?: string;
  clerkOrgId: string;
  connectionAccess: RuntimeConnectionAccess;
  runPublicId?: string;
  source: RuntimeToolCallSource;
}): Promise<ConnectorRuntimeToolSource[]> {
  const connections = await listCurrentOrgConnectorConnections(appDb, {
    clerkOrgId: input.clerkOrgId,
  });

  return connections.flatMap((connection) => {
    if (!isActiveRuntimeConnection(connection, input.connectionAccess)) {
      return [];
    }

    return connection.toolManifest.flatMap((tool) => {
      const runtimeToolName = safeRuntimeToolName(
        connection.provider,
        tool.name
      );
      if (!runtimeToolName) {
        return [];
      }

      const callWithMetadata = (toolInput: unknown) =>
        callConnectorRuntimeTool(toolInput, {
          automationPublicId: input.automationPublicId,
          clerkOrgId: input.clerkOrgId,
          connectionAccess: input.connectionAccess,
          provider: connection.provider,
          providerToolName: tool.name,
          runPublicId: input.runPublicId,
          runtimeToolName,
          source: input.source,
        });

      return [
        {
          call: async (toolInput: unknown) =>
            (await callWithMetadata(toolInput)).result,
          callWithMetadata,
          description: tool.description,
          inputSchema: tool.inputSchema,
          provider: connection.provider,
          providerToolName: tool.name,
          runtimeToolName,
        },
      ];
    });
  });
}
```

Update the current-connection check inside `callConnectorRuntimeTool`:

```ts
if (
  !(
    connection &&
    isActiveRuntimeConnection(connection, context.connectionAccess) &&
    hasValidCurrentTool(connection, context.providerToolName)
  )
) {
  throw new Error(
    `${connectorDisplayName(context.provider)} connector is not active for ${context.connectionAccess}.`
  );
}
```

Use `context.source` when creating the ledger row:

```ts
providerRoutineCall = await safelyCreateProviderRoutineCall({
  calledById: context.source.calledById,
  calledByKind: context.source.calledByKind,
  calledByUserId: context.source.calledByUserId,
  clerkOrgId: context.clerkOrgId,
  providerConnectionId: connection.id,
  inputRedacted: redactedPresence(input),
  provider: context.provider,
  providerActorId: connection.providerActorId,
  providerToolName: context.providerToolName,
  providerWorkspaceId: connection.providerWorkspaceId,
  routineId: context.runtimeToolName,
  sourceClientId: null,
  sourceRef: context.source.sourceRef,
  sourceSurface: context.source.sourceSurface,
});

if (!providerRoutineCall && context.source.requireLedger) {
  throw new ConnectorRuntimeToolCallError({
    cause: new Error("Provider routine call ledger row was not created."),
    code: "PROVIDER_ROUTINE_LEDGER_FAILED",
    message: "Provider routine call could not be recorded.",
    provider: context.provider,
    providerRoutineCallId: null,
    providerToolName: context.providerToolName,
    routineId: context.runtimeToolName,
    runtimeToolName: context.runtimeToolName,
  });
}
```

Replace `isActiveAutomationConnection` with:

```ts
function isActiveRuntimeConnection(
  connection: OrgConnectorConnection,
  access: RuntimeConnectionAccess
) {
  if (connection.status !== "active") {
    return false;
  }
  return access === "agents"
    ? connection.enabledForAgents
    : connection.enabledForAutomations;
}
```

Update `safelyCreateProviderRoutineCall` input typing:

```ts
sourceSurface: ProviderRoutineCallSourceSurface;
```

- [ ] **Step 5: Run runtime tests**

Run:

```bash
pnpm --filter @api/app test -- connectors-runtime.test.ts
```

Expected: PASS, including all existing automation runtime tests.

- [ ] **Step 6: Commit the runtime slice**

```bash
git add api/app/src/services/connectors/runtime.ts api/app/src/__tests__/connectors-runtime.test.ts
git commit -m "feat(connectors): add chat runtime tools"
```

---

### Task 3: Add Chat Routine Service

**Files:**
- Create: `api/app/src/services/connectors/chat-routines.ts`
- Create: `api/app/src/__tests__/connectors-chat-routines.test.ts`

- [ ] **Step 1: Write failing chat routine tests**

Create `api/app/src/__tests__/connectors-chat-routines.test.ts`:

```ts
import type { OrgConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentOrgConnectorConnectionMock = vi.fn();
const listCurrentOrgConnectorConnectionsMock = vi.fn();
const loadChatConnectorRuntimeToolsMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

class TestConnectorRuntimeToolCallError extends Error {
  readonly code: string | undefined;
  readonly providerRoutineCallId: string | null;

  constructor(input: {
    code?: string;
    message: string;
    providerRoutineCallId: string | null;
  }) {
    super(input.message);
    this.name = "ConnectorRuntimeToolCallError";
    this.code = input.code;
    this.providerRoutineCallId = input.providerRoutineCallId;
  }
}

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
}));

vi.mock("../services/connectors/runtime", () => ({
  ConnectorRuntimeToolCallError: TestConnectorRuntimeToolCallError,
  loadChatConnectorRuntimeTools: loadChatConnectorRuntimeToolsMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

const {
  ChatProviderRoutineError,
  callChatProviderRoutine,
  findChatProviderRoutines,
} = await import("../services/connectors/chat-routines");

function context(overrides: Partial<Parameters<typeof findChatProviderRoutines>[0]> = {}) {
  return {
    clerkOrgId: "org_acme",
    conversationId: "conv_123",
    userId: "user_current",
    writeMode: false,
    ...overrides,
  };
}

function connection(
  overrides: Partial<OrgConnectorConnection> = {}
): OrgConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    clerkOrgId: "org_acme",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    connectedByUserId: "user_current",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    enabledForAgents: true,
    enabledForAutomations: false,
    id: 1,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    mcpEndpoint: "https://linear.test/mcp",
    metadata: {},
    provider: "linear",
    providerActorId: "actor_1",
    providerActorName: "Jeevan",
    providerWorkspaceId: "workspace_1",
    providerWorkspaceName: "Acme",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
    scopes: ["read", "write"],
    status: "active",
    toolManifest: [
      {
        description: "List issues",
        inputSchema: { type: "object" },
        name: "list_issues",
      },
      {
        description: "Create issue",
        inputSchema: {
          properties: { title: { type: "string" } },
          required: ["title"],
          type: "object",
        },
        name: "create_issue",
      },
    ],
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function runtimeTool(overrides: Record<string, unknown> = {}) {
  return {
    callWithMetadata: vi.fn().mockResolvedValue({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      runtimeToolName: "linear__list_issues",
    }),
    provider: "linear",
    providerToolName: "list_issues",
    runtimeToolName: "linear__list_issues",
    ...overrides,
  };
}

describe("chat provider routines", () => {
  beforeEach(() => {
    getCurrentOrgConnectorConnectionMock.mockReset();
    listCurrentOrgConnectorConnectionsMock.mockReset();
    loadChatConnectorRuntimeToolsMock.mockReset();
    logInfoMock.mockReset();
    logWarnMock.mockReset();
  });

  it("discovers X read routines and hides X write routines", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        id: 2,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [
          { description: "Find user", name: "getUsersByUsername" },
          { description: "Post tweet", name: "postTweet" },
        ],
      }),
    ]);

    await expect(findChatProviderRoutines(context(), {})).resolves.toEqual({
      routines: [
        expect.objectContaining({
          classification: "read",
          provider: "x",
          providerToolName: "getUsersByUsername",
          routineId: "x__getUsersByUsername",
        }),
      ],
    });
  });

  it("hides Linear write routines until write mode is enabled", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    await expect(findChatProviderRoutines(context(), {})).resolves.toEqual({
      routines: [
        expect.objectContaining({
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
        }),
      ],
    });
  });

  it("includes Linear write routines when write mode and stored write scope are present", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    const result = await findChatProviderRoutines(
      context({ writeMode: true }),
      { query: "create" }
    );

    expect(result).toEqual({
      routines: [
        expect.objectContaining({
          classification: "write",
          provider: "linear",
          providerToolName: "create_issue",
          routineId: "linear__create_issue",
        }),
      ],
    });
  });

  it("returns reconnect-required warnings when Linear write scope is missing", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ scopes: ["read"] }),
    ]);

    await expect(
      findChatProviderRoutines(context({ writeMode: true }), {})
    ).resolves.toEqual({
      routines: [
        expect.objectContaining({
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
        }),
      ],
      warnings: [
        {
          code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
          message: "Reconnect Linear to enable write access.",
          provider: "linear",
          requiredScopes: ["write"],
        },
      ],
    });
  });

  it("rejects direct Linear write calls when write mode is off", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    await expect(
      callChatProviderRoutine(context(), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      routineId: "linear__create_issue",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("rejects direct Linear write calls with reconnect-required when stored write scope is missing", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ scopes: ["read"] })
    );

    await expect(
      callChatProviderRoutine(context({ writeMode: true }), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
      message: "Reconnect Linear to enable write access.",
      routineId: "linear__create_issue",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("calls X read routines through the chat runtime", async () => {
    const xConnection = connection({
      id: 2,
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      provider: "x",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      scopes: ["tweet.read", "users.read", "offline.access"],
      toolManifest: [{ name: "getUsersByUsername" }],
    });
    const xTool = runtimeTool({
      callWithMetadata: vi.fn().mockResolvedValue({
        provider: "x",
        providerRoutineCallId: "provider_routine_call_x",
        providerToolName: "getUsersByUsername",
        result: { content: [{ text: "Lightfast" }] },
        routineId: "x__getUsersByUsername",
        runtimeToolName: "x__getUsersByUsername",
      }),
      provider: "x",
      providerToolName: "getUsersByUsername",
      runtimeToolName: "x__getUsersByUsername",
    });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(xConnection);
    loadChatConnectorRuntimeToolsMock.mockResolvedValue([xTool]);

    await expect(
      callChatProviderRoutine(context(), {
        input: { username: "lightfast" },
        routineId: "x__getUsersByUsername",
      })
    ).resolves.toEqual({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_x",
      providerToolName: "getUsersByUsername",
      result: { content: [{ text: "Lightfast" }] },
      routineId: "x__getUsersByUsername",
      status: "succeeded",
    });
    expect(loadChatConnectorRuntimeToolsMock).toHaveBeenCalledWith({
      calledByUserId: "user_current",
      clerkOrgId: "org_acme",
      conversationId: "conv_123",
    });
  });

  it("rejects X write routines in chat", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        provider: "x",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [{ name: "postTweet" }],
      })
    );

    await expect(
      callChatProviderRoutine(context({ writeMode: true }), {
        input: { text: "hello" },
        routineId: "x__postTweet",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      routineId: "x__postTweet",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("logs redacted routine call decisions", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    await expect(
      callChatProviderRoutine(context(), {
        input: { title: "Secret issue title" },
        routineId: "linear__create_issue",
      })
    ).rejects.toBeInstanceOf(ChatProviderRoutineError);

    expect(logWarnMock).toHaveBeenCalledWith(
      "[workspace-assistant] provider routine call denied",
      expect.objectContaining({
        classification: "write",
        denialReason: "write_mode_disabled",
        provider: "linear",
        providerToolName: "create_issue",
        routineId: "linear__create_issue",
        sourceSurface: "chat",
        writeMode: false,
      })
    );
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain(
      "Secret issue title"
    );
  });
});
```

- [ ] **Step 2: Run the new test and confirm failure**

Run:

```bash
pnpm --filter @api/app test -- connectors-chat-routines.test.ts
```

Expected: FAIL because `api/app/src/services/connectors/chat-routines.ts` does not exist.

- [ ] **Step 3: Create the chat routine service**

Create `api/app/src/services/connectors/chat-routines.ts` with this structure:

```ts
import {
  getCurrentOrgConnectorConnection,
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import type {
  ConnectableConnectorProvider,
  FullConnectorToolManifestItem,
} from "@repo/connector-contract";
import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineErrorCode,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  type ProviderRoutineFindWarning,
  type ProviderRoutineId,
  type ProviderRoutineSummary,
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  providerRoutineFindInputSchema,
  providerRoutineId,
} from "@repo/provider-routine-contract";
import { classifyRoutine } from "@repo/provider-routines";
import { log } from "@vendor/observability/log/next";
import {
  ConnectorRuntimeToolCallError,
  loadChatConnectorRuntimeTools,
} from "./runtime";

const DEFAULT_FIND_LIMIT = 10;
const LINEAR_RECONNECT_WARNING: ProviderRoutineFindWarning = {
  code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
  message: "Reconnect Linear to enable write access.",
  provider: "linear",
  requiredScopes: ["write"],
};

export interface ChatProviderRoutineContext {
  clerkOrgId: string;
  conversationId: string;
  userId: string;
  writeMode: boolean;
}

export class ChatProviderRoutineError extends Error {
  readonly code: ProviderRoutineErrorCode;
  readonly providerRoutineCallId: string | undefined;
  readonly routineId: string;

  constructor(input: {
    code: ProviderRoutineErrorCode;
    message: string;
    providerRoutineCallId?: string;
    routineId: string;
  }) {
    super(input.message);
    this.name = "ChatProviderRoutineError";
    this.code = input.code;
    this.providerRoutineCallId = input.providerRoutineCallId;
    this.routineId = input.routineId;
  }
}

export async function findChatProviderRoutines(
  context: ChatProviderRoutineContext,
  input: ProviderRoutineFindInput
): Promise<ProviderRoutineFindOutput> {
  const parsed = providerRoutineFindInputSchema.parse(input);
  const connections = await listCurrentOrgConnectorConnections(appDb, {
    clerkOrgId: context.clerkOrgId,
  });
  const enabledConnections = connections.filter(isActiveAgentConnection);
  const warnings = reconnectWarnings(enabledConnections, context);

  if (enabledConnections.length === 0) {
    return withWarnings({ reason: "no_enabled_providers", routines: [] }, warnings);
  }

  const routines = enabledConnections
    .flatMap((connection) =>
      connection.toolManifest.flatMap((tool) =>
        summarizeTool({
          connection,
          includeSchema: parsed.includeSchema === true,
          tool,
        })
      )
    )
    .filter((routine) => isVisibleInChat(routine, enabledConnections, context))
    .filter((routine) => matchesFindFilters(routine, parsed))
    .slice(0, parsed.limit ?? DEFAULT_FIND_LIMIT);

  log.info("[workspace-assistant] provider routine discovery completed", {
    clerkOrgId: context.clerkOrgId,
    conversationId: context.conversationId,
    routineCount: routines.length,
    sourceSurface: "chat",
    warningCodes: warnings.map((warning) => warning.code),
    writeMode: context.writeMode,
  });

  if (routines.length === 0) {
    return withWarnings({ reason: "no_matching_routines", routines: [] }, warnings);
  }

  return withWarnings({ routines }, warnings);
}

export async function callChatProviderRoutine(
  context: ChatProviderRoutineContext,
  input: ProviderRoutineCallInput
): Promise<ProviderRoutineCallSuccess> {
  const parsed = providerRoutineCallInputSchema.parse(input);
  const { provider, providerToolName } = parseProviderRoutineId(parsed.routineId);
  const connection = await getCurrentOrgConnectorConnection(appDb, {
    clerkOrgId: context.clerkOrgId,
    provider,
  });

  if (!connection) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
      message: `${provider} connector is not connected.`,
      routineId: parsed.routineId,
    });
  }
  if (!isActiveAgentConnection(connection)) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_ENABLED",
      message: `${provider} connector is not enabled for agents.`,
      routineId: parsed.routineId,
    });
  }

  const tool = connection.toolManifest.find(
    (manifestTool) => manifestTool.name === providerToolName
  );
  if (!tool) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  const classification = classifyRoutine({ provider, providerToolName });
  const decision = chatRoutineDecision({
    classification,
    connection,
    context,
    provider,
  });

  if (!decision.allowed) {
    log.warn("[workspace-assistant] provider routine call denied", {
      classification,
      clerkOrgId: context.clerkOrgId,
      conversationId: context.conversationId,
      denialReason: decision.denialReason,
      provider,
      providerToolName,
      requiredScopes: decision.requiredScopes,
      routineId: parsed.routineId,
      scopeDecision: decision.scopeDecision,
      sourceSurface: "chat",
      storedScopes: storedScopeSummary(connection),
      writeMode: context.writeMode,
    });
    throw chatProviderRoutineError({
      code: decision.code,
      message: decision.message,
      routineId: parsed.routineId,
    });
  }

  if (!validateJsonSchema(tool.inputSchema, parsed.input)) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      message: `Invalid input for provider routine ${parsed.routineId}.`,
      routineId: parsed.routineId,
    });
  }

  const runtimeTools = await loadChatConnectorRuntimeTools({
    calledByUserId: context.userId,
    clerkOrgId: context.clerkOrgId,
    conversationId: context.conversationId,
  });
  const runtimeTool = runtimeTools.find(
    (candidate) =>
      candidate.provider === provider &&
      candidate.providerToolName === providerToolName
  );

  if (!runtimeTool) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  try {
    const result = await runtimeTool.callWithMetadata(parsed.input);
    log.info("[workspace-assistant] provider routine call completed", {
      classification,
      clerkOrgId: context.clerkOrgId,
      conversationId: context.conversationId,
      provider,
      providerRoutineCallId: result.providerRoutineCallId,
      providerToolName,
      routineId: parsed.routineId,
      scopeDecision: decision.scopeDecision,
      sourceSurface: "chat",
      writeMode: context.writeMode,
    });
    return {
      provider,
      providerRoutineCallId: result.providerRoutineCallId ?? "",
      providerToolName,
      result: result.result,
      routineId: parsed.routineId,
      status: "succeeded",
    };
  } catch (error) {
    if (error instanceof ConnectorRuntimeToolCallError) {
      const code = mapRuntimeErrorCode(error.code);
      throw chatProviderRoutineError({
        code,
        message: publicMessageFor(code),
        providerRoutineCallId: error.providerRoutineCallId ?? undefined,
        routineId: parsed.routineId,
      });
    }
    throw error;
  }
}

function chatProviderRoutineError(input: {
  code: ProviderRoutineErrorCode;
  message: string;
  providerRoutineCallId?: string;
  routineId: ProviderRoutineId | string;
}) {
  return new ChatProviderRoutineError({
    code: input.code,
    message: input.message,
    providerRoutineCallId: input.providerRoutineCallId,
    routineId: input.routineId,
  });
}
```

Add the helper functions in the same file:

```ts
function isActiveAgentConnection(connection: OrgConnectorConnection) {
  return connection.status === "active" && connection.enabledForAgents;
}

function hasLinearWriteScope(connection: OrgConnectorConnection) {
  return connection.scopes.includes("write");
}

function isWriteClassification(classification: string) {
  return classification !== "read";
}

function reconnectWarnings(
  connections: OrgConnectorConnection[],
  context: ChatProviderRoutineContext
): ProviderRoutineFindWarning[] {
  if (!context.writeMode) {
    return [];
  }
  const linearConnection = connections.find(
    (connection) => connection.provider === "linear"
  );
  if (!linearConnection || hasLinearWriteScope(linearConnection)) {
    return [];
  }
  const hasWriteRoutine = linearConnection.toolManifest.some((tool) =>
    isWriteClassification(
      classifyRoutine({ provider: "linear", providerToolName: tool.name })
    )
  );
  return hasWriteRoutine ? [LINEAR_RECONNECT_WARNING] : [];
}

function withWarnings<T extends ProviderRoutineFindOutput>(
  output: T,
  warnings: ProviderRoutineFindWarning[]
): T {
  return warnings.length > 0 ? ({ ...output, warnings } as T) : output;
}

function summarizeTool(input: {
  connection: OrgConnectorConnection;
  includeSchema: boolean;
  tool: FullConnectorToolManifestItem;
}): ProviderRoutineSummary[] {
  try {
    const routineId = providerRoutineId(
      input.connection.provider,
      input.tool.name
    );
    const classification = classifyRoutine({
      provider: input.connection.provider,
      providerToolName: input.tool.name,
    });
    return [
      {
        classification,
        ...(input.tool.description
          ? { description: input.tool.description }
          : {}),
        ...(input.includeSchema && input.tool.inputSchema !== undefined
          ? { inputSchema: input.tool.inputSchema }
          : {}),
        ...(input.tool.inputSchema === undefined
          ? {}
          : { inputSummary: summarizeInputSchema(input.tool.inputSchema) }),
        provider: input.connection.provider,
        providerToolName: input.tool.name,
        routineId,
        title: titleFromToolName(input.tool.name),
      },
    ];
  } catch {
    return [];
  }
}

function isVisibleInChat(
  routine: ProviderRoutineSummary,
  connections: OrgConnectorConnection[],
  context: ChatProviderRoutineContext
) {
  const connection = connections.find(
    (candidate) => candidate.provider === routine.provider
  );
  if (!connection) {
    return false;
  }
  if (routine.provider === "x") {
    return routine.classification === "read";
  }
  if (routine.provider === "linear") {
    if (routine.classification === "read") {
      return true;
    }
    return context.writeMode && hasLinearWriteScope(connection);
  }
  return false;
}

function matchesFindFilters(
  routine: ProviderRoutineSummary,
  input: ReturnType<typeof providerRoutineFindInputSchema.parse>
) {
  if (input.provider && routine.provider !== input.provider) {
    return false;
  }
  if (input.routineId && routine.routineId !== input.routineId) {
    return false;
  }
  if (input.readOnly && routine.classification !== "read") {
    return false;
  }
  if (!input.query) {
    return true;
  }

  const query = input.query.toLowerCase();
  return [
    routine.description,
    routine.provider,
    routine.providerToolName,
    routine.routineId,
    routine.title,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(query));
}

function chatRoutineDecision(input: {
  classification: string;
  connection: OrgConnectorConnection;
  context: ChatProviderRoutineContext;
  provider: ConnectableConnectorProvider;
}):
  | { allowed: true; scopeDecision: string }
  | {
      allowed: false;
      code: ProviderRoutineErrorCode;
      denialReason: string;
      message: string;
      requiredScopes?: string[];
      scopeDecision: string;
    } {
  if (input.provider === "x") {
    if (input.classification === "read") {
      return { allowed: true, scopeDecision: "x_read_allowed" };
    }
    return {
      allowed: false,
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      denialReason: "x_write_unsupported",
      message: "X write routines are not available in chat.",
      scopeDecision: "x_write_blocked",
    };
  }

  if (input.provider === "linear" && isWriteClassification(input.classification)) {
    if (!input.context.writeMode) {
      return {
        allowed: false,
        code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
        denialReason: "write_mode_disabled",
        message: "Enable write mode before calling Linear write routines.",
        scopeDecision: "write_mode_disabled",
      };
    }
    if (!hasLinearWriteScope(input.connection)) {
      return {
        allowed: false,
        code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
        denialReason: "linear_write_scope_missing",
        message: "Reconnect Linear to enable write access.",
        requiredScopes: ["write"],
        scopeDecision: "linear_write_scope_missing",
      };
    }
    return { allowed: true, scopeDecision: "linear_write_scope_present" };
  }

  return { allowed: true, scopeDecision: "read_allowed" };
}
```

Add schema, naming, scope summary, runtime error mapping, and public messages:

```ts
function titleFromToolName(providerToolName: string) {
  return providerToolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeInputSchema(inputSchema: unknown) {
  if (!inputSchema || typeof inputSchema !== "object") {
    return "JSON object";
  }
  const schema = inputSchema as { required?: unknown };
  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  return required.length > 0
    ? `Required: ${required.join(", ")}`
    : "JSON object";
}

function storedScopeSummary(connection: OrgConnectorConnection) {
  if (connection.provider === "linear") {
    return {
      read: connection.scopes.includes("read"),
      write: connection.scopes.includes("write"),
    };
  }
  return {
    read: connection.scopes.some((scope) => scope.endsWith(".read")),
    write: false,
  };
}

function validateJsonSchema(schema: unknown, value: unknown): boolean {
  if (!isJsonSchemaObject(schema)) {
    return true;
  }

  if (schema.type !== undefined && !matchesJsonSchemaType(value, schema.type)) {
    return false;
  }

  if (!matchesNumericBounds(value, schema)) {
    return false;
  }

  if (Array.isArray(value) && schema.items !== undefined) {
    return value.every((item) => validateJsonSchema(schema.items, item));
  }

  if (!hasObjectValidation(schema)) {
    return true;
  }

  if (!isJsonObject(value)) {
    return false;
  }

  for (const field of requiredFields(schema.required)) {
    if (!(field in value)) {
      return false;
    }
  }

  if (!isJsonObject(schema.properties)) {
    return true;
  }

  for (const [field, propertySchema] of Object.entries(schema.properties)) {
    if (!(field in value)) {
      continue;
    }
    if (!validateJsonSchema(propertySchema, value[field])) {
      return false;
    }
  }

  return true;
}

function isJsonSchemaObject(value: unknown): value is {
  items?: unknown;
  maximum?: unknown;
  minimum?: unknown;
  properties?: unknown;
  required?: unknown;
  type?: unknown;
} {
  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasObjectValidation(schema: {
  properties?: unknown;
  required?: unknown;
}) {
  return schema.properties !== undefined || schema.required !== undefined;
}

function requiredFields(required: unknown) {
  return Array.isArray(required)
    ? required.filter((value): value is string => typeof value === "string")
    : [];
}

function matchesJsonSchemaType(value: unknown, type: unknown) {
  const allowedTypes = Array.isArray(type) ? type : [type];
  return allowedTypes.some((allowedType) => {
    switch (allowedType) {
      case "array":
        return Array.isArray(value);
      case "boolean":
        return typeof value === "boolean";
      case "integer":
        return Number.isInteger(value);
      case "number":
        return typeof value === "number" && Number.isFinite(value);
      case "object":
        return (
          value !== null && typeof value === "object" && !Array.isArray(value)
        );
      case "string":
        return typeof value === "string";
      case "null":
        return value === null;
      default:
        return true;
    }
  });
}

function matchesNumericBounds(
  value: unknown,
  schema: { maximum?: unknown; minimum?: unknown }
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return true;
  }
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    return false;
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    return false;
  }
  return true;
}

function mapRuntimeErrorCode(
  code: string | undefined
): ProviderRoutineErrorCode {
  switch (code) {
    case "LINEAR_TOKEN_REFRESH_FAILED":
    case "X_TOKEN_REFRESH_FAILED":
      return "PROVIDER_ROUTINE_AUTH_REQUIRED";
    case "LINEAR_MCP_TIMEOUT":
    case "X_MCP_TIMEOUT":
      return "PROVIDER_ROUTINE_TIMEOUT";
    default:
      return "PROVIDER_ROUTINE_PROVIDER_FAILED";
  }
}

function publicMessageFor(code: ProviderRoutineErrorCode) {
  switch (code) {
    case "PROVIDER_ROUTINE_AUTH_REQUIRED":
      return "Provider authorization is required.";
    case "PROVIDER_ROUTINE_TIMEOUT":
      return "Provider routine timed out.";
    case "PROVIDER_ROUTINE_RECONNECT_REQUIRED":
      return "Reconnect Linear to enable write access.";
    default:
      return "Provider routine failed.";
  }
}
```

- [ ] **Step 4: Run the chat routine tests**

Run:

```bash
pnpm --filter @api/app test -- connectors-chat-routines.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the chat service slice**

```bash
git add api/app/src/services/connectors/chat-routines.ts api/app/src/__tests__/connectors-chat-routines.test.ts
git commit -m "feat(connectors): add chat provider routines"
```

---

### Task 4: Export Service And Wire Chat Route

**Files:**
- Modify: `api/app/src/services/connectors/index.ts`
- Modify: `apps/app/src/app/(chat)/api/chat/route.ts`
- Test: `apps/app/src/__tests__/app/api/chat/route.test.ts`

- [ ] **Step 1: Update route test mocks**

In `apps/app/src/__tests__/app/api/chat/route.test.ts`, replace the provider-routines mock with connector service mocks:

```ts
const callChatProviderRoutineMock = vi.fn();
const findChatProviderRoutinesMock = vi.fn();
```

Replace:

```ts
vi.mock("@repo/provider-routines", () => ({
  callProviderRoutine: callProviderRoutineMock,
  findProviderRoutines: findProviderRoutinesMock,
}));
```

With:

```ts
vi.mock("@api/app/services/connectors", () => ({
  callChatProviderRoutine: callChatProviderRoutineMock,
  findChatProviderRoutines: findChatProviderRoutinesMock,
}));
```

Update `beforeEach`:

```ts
callChatProviderRoutineMock.mockReset();
findChatProviderRoutinesMock.mockReset();
callChatProviderRoutineMock.mockResolvedValue({
  provider: "linear",
  providerRoutineCallId: "prc_123",
  providerToolName: "get_issue",
  result: { content: [{ text: "Issue" }] },
  routineId: "linear__get_issue",
  status: "succeeded",
});
findChatProviderRoutinesMock.mockResolvedValue({ routines: [] });
```

- [ ] **Step 2: Update the existing connector tool route test**

In the test named `exposes read-only connector provider routines to the workspace assistant as server tools`, update expectations:

```ts
expect(streamOptions).toEqual(
  expect.objectContaining({
    stopWhen: { count: 5, kind: "step-count" },
    tools: {
      callProviderRoutine: expect.objectContaining({
        description: expect.stringContaining(
          "Call one connected provider routine"
        ),
        execute: expect.any(Function),
      }),
      findProviderRoutines: expect.objectContaining({
        description: expect.stringContaining("Find connected provider routines"),
        execute: expect.any(Function),
      }),
    },
  })
);
```

Update the find assertion:

```ts
expect(findChatProviderRoutinesMock).toHaveBeenCalledWith(
  {
    clerkOrgId: "org_123",
    conversationId: "conv_123",
    userId: "user_123",
    writeMode: false,
  },
  {
    includeSchema: true,
    query: "issue",
  }
);
```

Update the call assertion:

```ts
expect(callChatProviderRoutineMock).toHaveBeenCalledWith(
  {
    clerkOrgId: "org_123",
    conversationId: "conv_123",
    userId: "user_123",
    writeMode: false,
  },
  {
    input: { id: "issue_123" },
    routineId: "linear__get_issue",
  }
);
```

Add a new route test:

```ts
it("passes provider routine write mode into chat routine tools", async () => {
  const uiMessages = [
    {
      id: "client-message-1",
      parts: [{ text: "Create a Linear issue", type: "text" }],
      role: "user",
    },
  ];
  const streamResponse = new Response("stream");

  convertToModelMessagesMock.mockResolvedValue([
    { content: "Create a Linear issue", role: "user" },
  ]);
  gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
  streamTextMock.mockReturnValue({
    toUIMessageStreamResponse: toUIMessageStreamResponseMock,
  });
  toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

  await POST(
    createJsonRequest({
      idempotencyKey: "idem_user_1",
      messages: uiMessages,
      conversationId: "conv_123",
      providerRoutineWriteMode: true,
    })
  );

  const streamOptions = streamTextMock.mock.calls[0]?.[0];
  await streamOptions.tools.findProviderRoutines.execute({
    query: "create",
  });
  expect(findChatProviderRoutinesMock).toHaveBeenCalledWith(
    expect.objectContaining({
      conversationId: "conv_123",
      writeMode: true,
    }),
    { query: "create" }
  );
});
```

- [ ] **Step 3: Run the route test and confirm failure**

Run:

```bash
pnpm --filter @lightfast/app test -- app/api/chat/route.test.ts
```

Expected: FAIL because the chat route still imports `@repo/provider-routines` and has no `providerRoutineWriteMode` request field.

- [ ] **Step 4: Export chat routine service from `@api/app`**

In `api/app/src/services/connectors/index.ts`, add:

```ts
export {
  ChatProviderRoutineError,
  callChatProviderRoutine,
  findChatProviderRoutines,
  type ChatProviderRoutineContext,
} from "./chat-routines";
```

- [ ] **Step 5: Update chat route imports and request schema**

In `apps/app/src/app/(chat)/api/chat/route.ts`, replace:

```ts
import {
  callProviderRoutine,
  findProviderRoutines,
  type ProviderRoutineServiceContext,
} from "@repo/provider-routines";
```

With:

```ts
import {
  callChatProviderRoutine,
  findChatProviderRoutines,
  type ChatProviderRoutineContext,
} from "@api/app/services/connectors";
```

Add the new request field:

```ts
providerRoutineWriteMode: z.boolean().optional(),
```

Update the system prompt connector sentence:

```ts
"Connected provider routines in chat can read from enabled Linear and X connectors. Linear write routines are available only for a turn where write mode is enabled. If Linear write access is unavailable, tell the user to reconnect Linear to enable write access. X write routines are not available.",
```

After request parsing, derive the flag:

```ts
const providerRoutineWriteMode =
  parsed.data.providerRoutineWriteMode === true;
```

Add it to generation metadata:

```ts
const generationLogMetadata = {
  clerkOrgId: identity.orgId,
  generationId: generation.publicId,
  model: WORKSPACE_ASSISTANT_MODEL,
  streamId,
  conversationId: conversation.publicId,
  providerRoutineWriteMode,
  userId: identity.userId,
};
```

Pass it into tool creation:

```ts
tools: createWorkspaceAssistantProviderRoutineTools({
  conversation,
  orgId: identity.orgId,
  userId: identity.userId,
  writeMode: providerRoutineWriteMode,
}),
```

- [ ] **Step 6: Replace chat route tool context**

Update `createWorkspaceAssistantProviderRoutineTools`:

```ts
function createWorkspaceAssistantProviderRoutineTools(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
  writeMode: boolean;
}) {
  return {
    callProviderRoutine: tool({
      description:
        "Call one connected provider routine by routineId using this workspace's enabled connector. Linear write routines require write mode for this turn. X write routines are unavailable.",
      inputSchema: providerRoutineCallInputSchema,
      outputSchema: providerRoutineCallSuccessSchema,
      execute: async (toolInput) =>
        callChatProviderRoutine(providerRoutineContext(input), toolInput),
    }),
    findProviderRoutines: tool({
      description:
        "Find connected provider routines available to this workspace through enabled connectors. Returns Linear and X read routines, and Linear write routines only when write mode is enabled for this turn.",
      inputSchema: providerRoutineFindInputSchema,
      outputSchema: providerRoutineFindOutputSchema,
      execute: async (toolInput) =>
        findChatProviderRoutines(providerRoutineContext(input), toolInput),
    }),
  };
}
```

Replace `providerRoutineContext`:

```ts
function providerRoutineContext(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
  writeMode: boolean;
}): ChatProviderRoutineContext {
  return {
    clerkOrgId: input.orgId,
    conversationId: input.conversation.publicId,
    userId: input.userId,
    writeMode: input.writeMode,
  };
}
```

- [ ] **Step 7: Run route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- app/api/chat/route.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the route wiring slice**

```bash
git add api/app/src/services/connectors/index.ts apps/app/src/app/'(chat)'/api/chat/route.ts apps/app/src/__tests__/app/api/chat/route.test.ts
git commit -m "feat(chat): use connector routines with write mode"
```

---

### Task 5: Add Per-Turn Write Toggle In Chat UI

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-composer.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-composer.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx`

- [ ] **Step 1: Write failing composer tests**

In `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/chat-composer.test.tsx`, update each existing `<ChatComposer />` render to pass:

```tsx
onWriteModeChange={vi.fn()}
writeModeEnabled={false}
```

Add this test:

```tsx
it("renders a write mode toggle and reports changes", () => {
  const onWriteModeChange = vi.fn();

  render(
    <ChatComposer
      compact={false}
      error={undefined}
      onSubmit={onSubmit}
      onTextChange={vi.fn()}
      onWriteModeChange={onWriteModeChange}
      status="ready"
      stop={stop}
      text=""
      writeModeEnabled={false}
    />
  );

  const toggle = screen.getByRole("button", { name: "Write mode" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(toggle);

  expect(onWriteModeChange).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Write failing workspace client tests**

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/chat/workspace-assistant-client.test.tsx`, add this test after the existing first-message request body tests:

```tsx
it("sends write mode for one submitted turn and resets it", async () => {
  render(
    <WorkspaceAssistantClient
      conversationId="conv_existing"
      initialConversation={{
        messages: [
          makeWorkspaceAssistantMessage({
            parts: [{ text: "Previous", type: "text" }],
            publicId: "msg_user",
            role: "user",
          }),
        ],
        conversation: makeWorkspaceAssistantConversation(),
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Write mode" }));
  fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
    target: { value: "Create a Linear issue" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));

  await waitFor(() => {
    expect(sendMessageMock).toHaveBeenCalledWith(
      { text: "Create a Linear issue" },
      {
        body: {
          idempotencyKey: expect.stringMatching(/^idem_/),
          conversationId: "conv_existing",
          providerRoutineWriteMode: true,
        },
      }
    );
  });

  expect(screen.getByRole("button", { name: "Write mode" })).toHaveAttribute(
    "aria-pressed",
    "false"
  );

  fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
    target: { value: "List my Linear issues" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));

  await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(2));
  expect(sendMessageMock.mock.calls[1]?.[1]).toEqual({
    body: {
      idempotencyKey: expect.stringMatching(/^idem_/),
      conversationId: "conv_existing",
    },
  });
});
```

- [ ] **Step 3: Run the UI tests and confirm failure**

Run:

```bash
pnpm --filter @lightfast/app test -- chat-composer.test.tsx workspace-assistant-client.test.tsx
```

Expected: FAIL because the composer props and write-mode state do not exist.

- [ ] **Step 4: Add the composer toggle**

In `chat-composer.tsx`, add imports:

```ts
import { Toggle } from "@repo/ui/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { ArrowUp, PencilLine } from "lucide-react";
```

Update props:

```ts
onWriteModeChange,
writeModeEnabled,
}: {
  compact: boolean;
  error: Error | undefined;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onTextChange: (text: string) => void;
  onWriteModeChange: (enabled: boolean) => void;
  status: ChatStatus;
  stop: () => void;
  text: string;
  writeModeEnabled: boolean;
}) {
```

Add this toggle near `const submit = (`:

```tsx
const writeModeToggle = (
  <Tooltip>
    <TooltipTrigger asChild>
      <Toggle
        aria-label="Write mode"
        className="h-8 gap-1.5 rounded-full px-2 text-muted-foreground text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        disabled={isBusy}
        onPressedChange={onWriteModeChange}
        pressed={writeModeEnabled}
        size="sm"
        type="button"
      >
        <PencilLine className="size-3.5" />
        <span>Write mode</span>
      </Toggle>
    </TooltipTrigger>
    <TooltipContent>Allow Linear writes for this turn</TooltipContent>
  </Tooltip>
);
```

Replace the compact/non-compact footer branch with one footer for both modes:

```tsx
<PromptInputFooter className={cn("px-2.5 pb-2.5", compact && "pt-1")}>
  <PromptInputTools>{writeModeToggle}</PromptInputTools>
  {submit}
</PromptInputFooter>
```

Keep the submit button class stable:

```tsx
className="size-8 rounded-full shrink-0"
```

- [ ] **Step 5: Store one-turn write mode in the workspace client**

In `workspace-assistant-client.tsx`, add state:

```ts
const [providerRoutineWriteMode, setProviderRoutineWriteMode] =
  useState(false);
```

Before `sendMessage`, capture the value:

```ts
const writeModeForTurn = providerRoutineWriteMode;
```

Update the request body:

```ts
await sendMessage(
  { text: nextText },
  {
    body: {
      idempotencyKey: createWorkspaceAssistantIdempotencyKey(),
      conversationId,
      ...(writeModeForTurn ? { providerRoutineWriteMode: true } : {}),
    },
  }
);
```

Reset after a send attempt:

```ts
} finally {
  setOptimisticFirstMessage(null);
  setProviderRoutineWriteMode(false);
}
```

Pass props to `ChatComposer`:

```tsx
<ChatComposer
  compact={compact}
  error={displayError}
  onSubmit={handleSubmit}
  onTextChange={setText}
  onWriteModeChange={setProviderRoutineWriteMode}
  status={composerStatus}
  stop={stop}
  text={text}
  writeModeEnabled={providerRoutineWriteMode}
/>
```

Add `providerRoutineWriteMode` to the `handleSubmit` dependency array.

- [ ] **Step 6: Run the UI tests**

Run:

```bash
pnpm --filter @lightfast/app test -- chat-composer.test.tsx workspace-assistant-client.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the UI slice**

```bash
git add apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/_components/chat-composer.tsx apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/_components/chat-composer.test.tsx apps/app/src/app/'(app)'/'(pending-not-allowed)'/'[slug]'/'(workspace)'/_components/workspace-assistant-client.tsx apps/app/src/__tests__/app/'(app)'/'(pending-not-allowed)'/'[slug]'/chat/workspace-assistant-client.test.tsx
git commit -m "feat(chat): add provider write mode toggle"
```

---

### Task 6: Verification And Integration Sweep

**Files:**
- Verify only. No source edits unless a command fails.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/provider-routine-contract test -- provider-routine-contract.test.ts
pnpm --filter @api/app test -- connectors-runtime.test.ts connectors-chat-routines.test.ts
pnpm --filter @lightfast/app test -- app/api/chat/route.test.ts chat-composer.test.tsx workspace-assistant-client.test.tsx
```

Expected: PASS for all focused tests.

- [ ] **Step 2: Run targeted typechecks**

Run:

```bash
pnpm --filter @repo/provider-routine-contract typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Inspect changed files for accidental raw payload logging**

Run:

```bash
rg "Secret issue title|secret-title|parsed\\.input|toolInput" api/app/src/services/connectors apps/app/src/app/'(chat)'/api/chat/route.ts
```

Expected: No log call includes raw user/provider tool input. It is acceptable for tests to contain sentinel strings that assert logs do not leak them.

- [ ] **Step 4: Run status and commit any verification fixes**

Run:

```bash
git status --short
```

If verification required source fixes, commit only those files:

```bash
git add <fixed-files>
git commit -m "fix(chat): stabilize connector routine write mode"
```

Expected: working tree contains only intentional committed changes.

---

## Acceptance Checklist

- [ ] Chat discovery includes X read routines for active, agent-enabled X connections.
- [ ] Chat discovery never exposes X write routines.
- [ ] Chat discovery hides Linear write routines when write mode is false.
- [ ] Chat discovery exposes Linear write routines when write mode is true and stored Linear scopes include `write`.
- [ ] Chat discovery returns `PROVIDER_ROUTINE_RECONNECT_REQUIRED` warning with `Reconnect Linear to enable write access.` when write mode is true and stored Linear scopes lack `write`.
- [ ] Direct Linear write calls fail without write mode.
- [ ] Direct Linear write calls fail with reconnect-required semantics when stored Linear scopes lack `write`.
- [ ] Direct Linear write calls are allowed when write mode and stored `write` scope are present.
- [ ] Direct X read calls are allowed.
- [ ] Direct X write calls fail.
- [ ] Chat route request schema accepts `providerRoutineWriteMode?: boolean` and defaults to false.
- [ ] UI write mode applies only to the next submitted message and resets after the send attempt.
- [ ] Logs include provider, provider tool name, routine ID, classification, source surface, write mode, scope decision, denial reason, and provider routine call ID when available.
- [ ] Logs do not include raw tool inputs, provider outputs, access tokens, MCP tokens, or user prompt text.

## Self-Review Notes

- Spec coverage: The tasks cover contract warnings, stored Linear scope checks, chat-specific runtime source metadata, X read discovery/calls, X write rejection, Linear write mode, UI toggle reset, and observability metadata.
- Placeholder scan: This plan uses concrete file paths, commands, tests, and code snippets. There are no deferred implementation markers.
- Type consistency: The plan uses `ChatProviderRoutineContext`, `findChatProviderRoutines`, `callChatProviderRoutine`, `providerRoutineWriteMode`, and `loadChatConnectorRuntimeTools` consistently across service, route, and UI tasks.

## Execution Options

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, and commit each completed slice.
2. **Inline Execution** - Execute tasks in this session using executing-plans, with checkpoints after each task.
