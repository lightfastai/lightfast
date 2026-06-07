# X Connector Social Read/Write Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the X connector from read-only routines to broad social/account read-write routines for agent and automation surfaces.

**Architecture:** Keep X as a Lightfast-hosted MCP bridge. Add a data-driven X operation registry in `@repo/x-app-node`, filter exposed tools by granted OAuth scopes, and route agent calls through the existing connector runtime with source attribution. `enabledForAgents` and `enabledForAutomations` are the full read/write boundaries for now.

**Tech Stack:** pnpm workspace, Turborepo, TypeScript ESM, Vitest, Next.js App Router route handlers, tRPC, Drizzle ORM, X OAuth2 PKCE, MCP Streamable HTTP via `@vendor/mcp`, `@repo/provider-routines`, `@repo/x-app-node`, `@repo/x-emulator`.

**Design doc:** `docs/superpowers/specs/2026-06-06-x-connector-social-write-support-design.md`

**Official X references checked:** `https://api.x.com/2/openapi.json`, `https://docs.x.com/x-api/users/blocks/introduction`, `https://docs.x.com/x-api/users/blocks/integrate`.

---

## File Structure

Create:

- `packages/x-app-node/src/operations.ts` - X operation registry, scope constants, tool-definition filtering, URL/body/query builders, connected actor injection metadata.
- `packages/x-app-node/src/__tests__/operations.test.ts` - operation registry and scope filtering tests.
- `emulators/x/src/plugin/social-writes.ts` - deterministic social/account write endpoints for local tests.

Modify:

- `api/app/src/services/connectors/runtime.ts` - load tools for either agents or automations and record source attribution for chat/agent calls.
- `api/app/src/__tests__/connectors-runtime.test.ts`
- `packages/provider-routines/src/policy.ts` - classify explicit X read/write routine names and default unknown X tools to `unknown_write_default`.
- `packages/provider-routines/src/context.ts` - add connector runtime adapter types.
- `packages/provider-routines/src/find.ts` - discover routines through the connector adapter when supplied.
- `packages/provider-routines/src/call.ts` - call routines through the connector adapter when supplied.
- `packages/provider-routines/src/__tests__/policy.test.ts`
- `packages/provider-routines/src/__tests__/find.test.ts`
- `packages/provider-routines/src/__tests__/call.test.ts`
- `apps/app/src/app/(chat)/api/chat/route.ts` - grant chat provider routines write scope and inject connector runtime adapter.
- `apps/app/src/__tests__/app/api/chat/route.test.ts`
- `packages/x-app-node/src/oauth.ts` - request the full social/account scope list.
- `packages/x-app-node/src/tools.ts` - execute registry operations instead of the read-only switch.
- `packages/x-app-node/src/index.ts` - export scope and operation helpers.
- `packages/x-app-node/src/__tests__/oauth.test.ts`
- `packages/x-app-node/src/__tests__/tools.test.ts`
- `api/app/src/services/connectors/x-mcp-bridge.ts` - scope-filter X MCP tools, enforce current manifest on calls, pass connected actor id.
- `api/app/src/services/connectors/x-flow.ts` - discover tools through stored scopes and keep partial-scope reconnect behavior.
- `api/app/src/services/connectors/catalog.ts` - surface X scope reconnect status.
- `api/app/src/__tests__/connectors-x-mcp-bridge.test.ts`
- `api/app/src/__tests__/connectors-flow.test.ts`
- `api/app/src/__tests__/connectors-router.test.ts`
- `packages/connector-contract/src/index.ts` - update X connector description.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx` - make toggle copy explicit about read/write.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.tsx` - show X reconnect warning for missing requested scopes.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx`
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
- `emulators/x/src/fixtures.ts`
- `emulators/x/src/plugin/failures.ts`
- `emulators/x/src/plugin/index.ts`
- `emulators/x/src/__tests__/server.test.ts`

Do not modify:

- Database schema or manual SQL files.
- X developer-platform/admin operations: webhooks, stream rules, compliance jobs, activity subscriptions, connection termination.
- Raw provider payload persistence rules.
- Binary or multipart media upload execution. The registry must not expose `mediaUpload`, `initializeMediaUpload`, `appendMediaUpload`, `finalizeMediaUpload`, `chatMediaUploadInitialize`, `chatMediaUploadAppend`, or `chatMediaUploadFinalize` in this pass.

---

## Task 1: Make Connector Runtime Support Agent Calls

**Files:**
- Modify: `api/app/src/services/connectors/runtime.ts`
- Test: `api/app/src/__tests__/connectors-runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Add tests under `describe("loadConnectorRuntimeTools", ...)` for these behaviors:

```ts
it("loads active agent-enabled connector tools when enabledFor is agents", async () => {
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
    connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      id: 8,
      provider: "x",
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      providerActorId: "x_user_1",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      toolManifest: [{ description: "Create post", name: "createPost" }],
    }),
  ]);

  await expect(
    loadConnectorRuntimeTools({
      clerkOrgId: "org_acme",
      enabledFor: "agents",
      sourceSurface: "chat",
    })
  ).resolves.toEqual([
    expect.objectContaining({
      provider: "x",
      providerToolName: "createPost",
      runtimeToolName: "x__createPost",
    }),
  ]);
});

it("records chat connector calls with chat source attribution", async () => {
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
    connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      id: 8,
      provider: "x",
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      providerActorId: "x_user_1",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      toolManifest: [{ description: "Create post", name: "createPost" }],
    }),
  ]);
  getCurrentOrgConnectorConnectionMock.mockResolvedValue(
    connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      id: 8,
      provider: "x",
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      providerActorId: "x_user_1",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      toolManifest: [{ description: "Create post", name: "createPost" }],
    })
  );

  const [tool] = await loadConnectorRuntimeTools({
    calledByUserId: "user_agent",
    clerkOrgId: "org_acme",
    enabledFor: "agents",
    sourceClientId: null,
    sourceRef: "conv_123",
    sourceSurface: "chat",
  });

  await tool?.call({ text: "ship it" });

  expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      calledById: "conv_123",
      calledByKind: "user",
      calledByUserId: "user_agent",
      provider: "x",
      providerConnectionId: 8,
      providerToolName: "createPost",
      routineId: "x__createPost",
      sourceClientId: null,
      sourceRef: "conv_123",
      sourceSurface: "chat",
    })
  );
});

it("does not load agent tools from connectors disabled for agents", async () => {
  listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
    connection({
      enabledForAgents: false,
      enabledForAutomations: true,
      provider: "x",
      toolManifest: [{ name: "createPost" }],
    }),
  ]);

  await expect(
    loadConnectorRuntimeTools({
      clerkOrgId: "org_acme",
      enabledFor: "agents",
      sourceSurface: "chat",
    })
  ).resolves.toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts
```

Expected: FAIL because `loadConnectorRuntimeTools` only supports automation-enabled connections and system/automation attribution.

- [ ] **Step 3: Add runtime input and source types**

In `api/app/src/services/connectors/runtime.ts`, add exported types:

```ts
export type ConnectorRuntimeEnabledFor = "agents" | "automations";

export type ConnectorRuntimeSourceSurface =
  | "automation"
  | "chat"
  | "hosted_mcp"
  | "native_cli"
  | "system";

export interface LoadConnectorRuntimeToolsInput {
  automationPublicId?: string;
  calledByUserId?: string | null;
  clerkOrgId: string;
  enabledFor?: ConnectorRuntimeEnabledFor;
  runPublicId?: string;
  sourceClientId?: string | null;
  sourceRef?: string | null;
  sourceSurface?: ConnectorRuntimeSourceSurface;
}
```

Update `loadConnectorRuntimeTools` to accept `LoadConnectorRuntimeToolsInput`. Add `enabledFor`, `sourceClientId`, `sourceRef`, and `sourceSurface` to `RuntimeToolCallContext`.

- [ ] **Step 4: Replace automation-only filtering**

Use this helper and remove `isActiveAutomationConnection` after all references are gone:

```ts
function isActiveEnabledConnection(
  connection: OrgConnectorConnection,
  enabledFor: ConnectorRuntimeEnabledFor
) {
  if (connection.status !== "active") {
    return false;
  }
  return enabledFor === "agents"
    ? connection.enabledForAgents
    : connection.enabledForAutomations;
}
```

In `loadConnectorRuntimeTools`, derive `const enabledFor = input.enabledFor ?? "automations";`, filter with `isActiveEnabledConnection(connection, enabledFor)`, and pass the source fields into `callConnectorRuntimeTool`.

- [ ] **Step 5: Record caller attribution from source context**

Replace `calledByContext` with:

```ts
function calledByContext(context: RuntimeToolCallContext) {
  if (context.sourceSurface === "automation" && context.runPublicId) {
    return {
      calledById: context.runPublicId,
      calledByKind: "automation" as const,
      calledByUserId: context.calledByUserId ?? null,
    };
  }

  if (context.calledByUserId) {
    return {
      calledById: context.sourceRef ?? context.calledByUserId,
      calledByKind: "user" as const,
      calledByUserId: context.calledByUserId,
    };
  }

  return {
    calledById: context.sourceRef ?? "connector-runtime",
    calledByKind: "system" as const,
    calledByUserId: null,
  };
}
```

When creating the provider routine call row, set `sourceClientId`, `sourceRef`, and `sourceSurface` from context instead of deriving them from `calledByKind`.

Also replace the current automation-only ledger failure check with a non-system source check:

```ts
if (!providerRoutineCall && context.sourceSurface !== "system") {
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

This keeps the existing system-call fallback while enforcing that every chat/agent and automation connector call is recorded before provider execution.

- [ ] **Step 6: Re-run focused tests**

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/app/src/services/connectors/runtime.ts api/app/src/__tests__/connectors-runtime.test.ts
git commit -m "feat(connectors): support agent runtime calls"
```

---

## Task 2: Classify X Provider Routines Safely

**Files:**
- Modify: `packages/provider-routines/src/policy.ts`
- Test: `packages/provider-routines/src/__tests__/policy.test.ts`

- [ ] **Step 1: Write the failing policy test**

Replace the X policy test with:

```ts
it("classifies known X reads, known X writes, and unknown X names", () => {
  expect(classifyXRoutine("getUsersMe")).toBe("read");
  expect(classifyXRoutine("searchPostsRecent")).toBe("read");
  expect(classifyXRoutine("createPost")).toBe("write");
  expect(classifyXRoutine("deletePost")).toBe("write");
  expect(classifyXRoutine("followUser")).toBe("write");
  expect(classifyXRoutine("sendDmByConversation")).toBe("write");
  expect(classifyXRoutine("createCommunityNote")).toBe("write");
  expect(classifyXRoutine("someFutureXTool")).toBe("unknown_write_default");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

```bash
pnpm --filter @repo/provider-routines test -- src/__tests__/policy.test.ts
```

Expected: FAIL because unknown X routines currently default to `read`.

- [ ] **Step 3: Replace X prefix heuristics with explicit sets**

In `packages/provider-routines/src/policy.ts`, define:

```ts
const X_READ_ROUTINES = new Set([
  "getUsersMe",
  "getUsersByUsername",
  "getUsersByUsernames",
  "getUsersById",
  "getUsersByIds",
  "getPostsById",
  "getPostsByIds",
  "searchPostsRecent",
  "getPostsCountsRecent",
]);

const X_WRITE_ROUTINES = new Set([
  "createPost",
  "deletePost",
  "repostPost",
  "unrepostPost",
  "hideReply",
  "likePost",
  "unlikePost",
  "createBookmark",
  "deleteBookmark",
  "followUser",
  "unfollowUser",
  "muteUser",
  "unmuteUser",
  "blockUser",
  "unblockUser",
  "blockDms",
  "unblockDms",
  "createList",
  "updateList",
  "deleteList",
  "addListMember",
  "removeListMember",
  "followList",
  "unfollowList",
  "pinList",
  "unpinList",
  "createDmConversation",
  "sendDmByParticipant",
  "sendDmByConversation",
  "deleteDmEvent",
  "createChatConversation",
  "initializeChatGroup",
  "initializeChatConversationKeys",
  "addChatGroupMembers",
  "sendChatMessage",
  "markChatConversationRead",
  "sendChatTypingIndicator",
  "addUserPublicKey",
  "createMediaMetadata",
  "createMediaSubtitles",
  "deleteMediaSubtitles",
  "createCommunityNote",
  "deleteCommunityNote",
  "evaluateCommunityNote",
]);
```

Implement:

```ts
export function classifyXRoutine(
  providerToolName: string
): ProviderRoutineClassification {
  if (X_READ_ROUTINES.has(providerToolName)) {
    return "read";
  }
  if (X_WRITE_ROUTINES.has(providerToolName)) {
    return "write";
  }
  return "unknown_write_default";
}
```

Remove `providerToolNameIs` when unused.

- [ ] **Step 4: Re-run focused test**

```bash
pnpm --filter @repo/provider-routines test -- src/__tests__/policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/provider-routines/src/policy.ts packages/provider-routines/src/__tests__/policy.test.ts
git commit -m "feat(provider-routines): classify x social writes"
```

---

## Task 3: Let Provider Routines Use Connector Runtime Adapters

**Files:**
- Modify: `packages/provider-routines/src/context.ts`
- Modify: `packages/provider-routines/src/find.ts`
- Modify: `packages/provider-routines/src/call.ts`
- Test: `packages/provider-routines/src/__tests__/find.test.ts`
- Test: `packages/provider-routines/src/__tests__/call.test.ts`

- [ ] **Step 1: Write failing find tests for connector adapters**

In `find.test.ts`, add a context with `adapters.connectors.loadTools` returning:

```ts
[
  {
    callWithMetadata: vi.fn(),
    description: "Create an X post",
    inputSchema: {
      properties: { text: { type: "string" } },
      required: ["text"],
      type: "object",
    },
    provider: "x",
    providerToolName: "createPost",
    runtimeToolName: "x__createPost",
  },
]
```

Assert:

```ts
await expect(
  findProviderRoutines(
    context({
      adapters: { connectors: { loadTools: loadConnectorToolsMock } },
      scopes: { providerRoutineRead: true, providerRoutineWrite: true },
    }),
    { query: "post", includeSchema: true }
  )
).resolves.toMatchObject({
  routines: [
    {
      classification: "write",
      inputSchema: {
        properties: { text: { type: "string" } },
        required: ["text"],
        type: "object",
      },
      provider: "x",
      providerToolName: "createPost",
      routineId: "x__createPost",
    },
  ],
});
expect(listCurrentOrgConnectorConnectionsMock).not.toHaveBeenCalled();
```

Also assert read-only scopes filter this write routine:

```ts
await expect(
  findProviderRoutines(
    context({
      adapters: { connectors: { loadTools: loadConnectorToolsMock } },
      scopes: { providerRoutineRead: true, providerRoutineWrite: false },
    }),
    {}
  )
).resolves.toEqual({ reason: "no_matching_routines", routines: [] });
```

- [ ] **Step 2: Write failing call tests for connector adapters**

In `call.test.ts`, add:

```ts
const callWithMetadataMock = vi.fn();
const loadConnectorToolsMock = vi.fn(async () => [
  {
    callWithMetadata: callWithMetadataMock,
    description: "Create an X post",
    inputSchema: {
      properties: { text: { type: "string" } },
      required: ["text"],
      type: "object",
    },
    provider: "x",
    providerToolName: "createPost",
    runtimeToolName: "x__createPost",
  },
]);
callWithMetadataMock.mockResolvedValue({
  provider: "x",
  providerRoutineCallId: "provider_routine_call_x",
  providerToolName: "createPost",
  result: { data: { id: "post_1" } },
  routineId: "x__createPost",
  runtimeToolName: "x__createPost",
});

await expect(
  callProviderRoutine(
    context({
      adapters: { connectors: { loadTools: loadConnectorToolsMock } },
    }),
    { input: { text: "ship it" }, routineId: "x__createPost" }
  )
).resolves.toEqual({
  provider: "x",
  providerRoutineCallId: "provider_routine_call_x",
  providerToolName: "createPost",
  result: { data: { id: "post_1" } },
  routineId: "x__createPost",
  status: "succeeded",
});
expect(getCurrentOrgConnectorConnectionMock).not.toHaveBeenCalled();
expect(createProviderRoutineCallMock).not.toHaveBeenCalled();
expect(callWithMetadataMock).toHaveBeenCalledWith({ text: "ship it" });
```

Add a second test asserting invalid adapter input rejects with `PROVIDER_ROUTINE_INVALID_INPUT` before `callWithMetadata`.

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
pnpm --filter @repo/provider-routines test -- src/__tests__/find.test.ts src/__tests__/call.test.ts
```

Expected: FAIL because connector adapter types and routing do not exist.

- [ ] **Step 4: Add connector adapter types**

In `context.ts`, add:

```ts
export interface ConnectorProviderRoutineTool {
  callWithMetadata(input: unknown): Promise<{
    provider: import("@repo/connector-contract").ConnectableConnectorProvider;
    providerRoutineCallId: string | null;
    providerToolName: string;
    result: unknown;
    routineId: string;
    runtimeToolName: string;
  }>;
  description?: string;
  inputSchema?: unknown;
  provider: import("@repo/connector-contract").ConnectableConnectorProvider;
  providerToolName: string;
  runtimeToolName: string;
}

export interface ConnectorProviderRoutineAdapter {
  loadTools(): Promise<ConnectorProviderRoutineTool[]>;
}
```

Add `connectors?: ConnectorProviderRoutineAdapter;` to `ProviderRoutineServiceAdapters`.

- [ ] **Step 5: Use adapter tools in `findProviderRoutines`**

When `context.adapters?.connectors` is present, call `loadTools()` and summarize those tools. Keep the existing DB-backed Linear discovery path for contexts without the connector adapter. Use the same `classifyRoutine`, `hasRoutineScope`, query, `readOnly`, limit, and schema summary rules for both sources.

- [ ] **Step 6: Use adapter tools in `callProviderRoutine`**

At the start of `callProviderRoutine`, after parsing `routineId`, branch when `context.adapters?.connectors` exists:

1. Load tools from the adapter.
2. Find a tool with matching `provider` and `providerToolName`.
3. Enforce classification and `hasRoutineScope`.
4. Validate input with the existing `isValidToolInput`.
5. Call `tool.callWithMetadata(parsed.input)`.
6. Return `provider`, `providerRoutineCallId`, `providerToolName`, `result`, `routineId`, and `status: "succeeded"`.

Map missing adapter tools to `PROVIDER_ROUTINE_NOT_FOUND`, insufficient scope to `PROVIDER_ROUTINE_INSUFFICIENT_SCOPE`, invalid input to `PROVIDER_ROUTINE_INVALID_INPUT`, and adapter call failures to `PROVIDER_ROUTINE_PROVIDER_FAILED`.

- [ ] **Step 7: Re-run focused tests**

```bash
pnpm --filter @repo/provider-routines test -- src/__tests__/find.test.ts src/__tests__/call.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/provider-routines/src/context.ts packages/provider-routines/src/find.ts packages/provider-routines/src/call.ts packages/provider-routines/src/__tests__/find.test.ts packages/provider-routines/src/__tests__/call.test.ts
git commit -m "feat(provider-routines): route connector routines through runtime"
```

---

## Task 4: Enable Chat Provider Routine Writes

**Files:**
- Modify: `apps/app/src/app/(chat)/api/chat/route.ts`
- Test: `apps/app/src/__tests__/app/api/chat/route.test.ts`

- [ ] **Step 1: Write the failing chat route test**

In `route.test.ts`, add:

```ts
const loadConnectorRuntimeToolsMock = vi.fn();
```

Add a mock:

```ts
vi.mock("@api/app/services/connectors/runtime", () => ({
  loadConnectorRuntimeTools: loadConnectorRuntimeToolsMock,
}));
```

Rename the test to:

```ts
it("exposes read-write connector provider routines to the workspace assistant as server tools", async () => {
```

Change assertions in that test:

```ts
expect(streamOptions.system).not.toContain("read-only");
expect(streamOptions.tools.callProviderRoutine.description).toContain(
  "Call one connected provider routine"
);
expect(streamOptions.tools.findProviderRoutines.description).toContain(
  "agent-enabled connectors"
);
```

For `findProviderRoutinesMock`, expect no forced `readOnly: true`:

```ts
expect(findProviderRoutinesMock).toHaveBeenCalledWith(
  expect.objectContaining({
    adapters: {
      connectors: { loadTools: expect.any(Function) },
    },
    scopes: {
      providerRoutineRead: true,
      providerRoutineWrite: true,
    },
  }),
  {
    includeSchema: true,
    query: "issue",
  }
);
```

Invoke the adapter from the captured context:

```ts
const findContext = findProviderRoutinesMock.mock.calls[0]?.[0];
await findContext.adapters.connectors.loadTools();
expect(loadConnectorRuntimeToolsMock).toHaveBeenCalledWith({
  calledByUserId: "user_123",
  clerkOrgId: "org_123",
  enabledFor: "agents",
  sourceClientId: null,
  sourceRef: "conv_123",
  sourceSurface: "chat",
});
```

Expect the same write scopes and adapter shape in the `callProviderRoutineMock` context.

- [ ] **Step 2: Run focused chat test and confirm failure**

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/chat/route.test.ts
```

Expected: FAIL because chat still says read-only, forces `readOnly: true`, and grants `providerRoutineWrite: false`.

- [ ] **Step 3: Wire connector runtime into the chat route**

In `apps/app/src/app/(chat)/api/chat/route.ts`, import:

```ts
import { loadConnectorRuntimeTools } from "@api/app/services/connectors/runtime";
```

Replace the read-only system prompt sentence with:

```ts
"Connected provider routines may read and write when their connector is enabled for agents. Only call routines that are useful for the user's request, and summarize any external action you took.",
```

Update tool descriptions:

```ts
"Call one connected provider routine by routineId using this workspace's agent-enabled connector. Use routineIds returned by findProviderRoutines."
```

```ts
"Find connected provider routines available to this workspace through agent-enabled connectors. Use this before calling callProviderRoutine."
```

Remove the `readOnly: true` wrapper from the `findProviderRoutines` execute call.

- [ ] **Step 4: Grant write scope and inject adapter in `providerRoutineContext`**

Set:

```ts
adapters: {
  connectors: {
    loadTools: async () =>
      loadConnectorRuntimeTools({
        calledByUserId: input.userId,
        clerkOrgId: input.orgId,
        enabledFor: "agents",
        sourceClientId: null,
        sourceRef: input.conversation.publicId,
        sourceSurface: "chat",
      }),
  },
},
scopes: {
  providerRoutineRead: true,
  providerRoutineWrite: true,
},
```

- [ ] **Step 5: Re-run focused test**

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/api/chat/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'apps/app/src/app/(chat)/api/chat/route.ts' apps/app/src/__tests__/app/api/chat/route.test.ts
git commit -m "feat(chat): allow agent connector writes"
```

---

## Task 5: Expand X OAuth Scopes

**Files:**
- Modify: `packages/x-app-node/src/oauth.ts`
- Modify: `packages/x-app-node/src/index.ts`
- Modify: `emulators/x/src/fixtures.ts`
- Test: `packages/x-app-node/src/__tests__/oauth.test.ts`

- [ ] **Step 1: Write failing OAuth tests**

Import `X_OAUTH_SCOPES`. Update the authorize URL test name to mention social/account scopes and add:

```ts
const expectedScopes = [
  "tweet.read",
  "users.read",
  "offline.access",
  "tweet.write",
  "tweet.moderate.write",
  "follows.read",
  "follows.write",
  "mute.read",
  "mute.write",
  "like.read",
  "like.write",
  "list.read",
  "list.write",
  "block.read",
  "block.write",
  "bookmark.read",
  "bookmark.write",
  "dm.read",
  "dm.write",
  "media.write",
];

expect(X_OAUTH_SCOPES).toEqual(expectedScopes);
expect(url.searchParams.get("scope")).toBe(expectedScopes.join(" "));
```

Update exchange and refresh tests to expect `scopes: expectedScopes`.

- [ ] **Step 2: Run focused test and confirm failure**

```bash
pnpm --filter @repo/x-app-node test -- src/__tests__/oauth.test.ts
```

Expected: FAIL because only read scopes are exported/requested.

- [ ] **Step 3: Export the ordered scope list**

In `oauth.ts`, replace the fixed string with:

```ts
export const X_OAUTH_SCOPES = [
  "tweet.read",
  "users.read",
  "offline.access",
  "tweet.write",
  "tweet.moderate.write",
  "follows.read",
  "follows.write",
  "mute.read",
  "mute.write",
  "like.read",
  "like.write",
  "list.read",
  "list.write",
  "block.read",
  "block.write",
  "bookmark.read",
  "bookmark.write",
  "dm.read",
  "dm.write",
  "media.write",
] as const;

export const X_OAUTH_SCOPE = X_OAUTH_SCOPES.join(" ");
```

Export `X_OAUTH_SCOPES` from `index.ts`. Set `X_EMULATOR_SCOPE` in `emulators/x/src/fixtures.ts` to the same joined string.

- [ ] **Step 4: Re-run focused tests**

```bash
pnpm --filter @repo/x-app-node test -- src/__tests__/oauth.test.ts
pnpm --filter @repo/x-emulator test -- src/__tests__/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/x-app-node/src/oauth.ts packages/x-app-node/src/index.ts packages/x-app-node/src/__tests__/oauth.test.ts emulators/x/src/fixtures.ts
git commit -m "feat(x): request social account scopes"
```

---

## Task 6: Add X Operation Registry And Tool Execution

**Files:**
- Create: `packages/x-app-node/src/operations.ts`
- Create: `packages/x-app-node/src/__tests__/operations.test.ts`
- Modify: `packages/x-app-node/src/tools.ts`
- Modify: `packages/x-app-node/src/__tests__/tools.test.ts`
- Modify: `packages/x-app-node/src/index.ts`

- [ ] **Step 1: Write failing operation registry tests**

Create `operations.test.ts` and assert:

```ts
expect(X_SOCIAL_WRITE_TOOL_NAMES).toEqual([
  "createPost",
  "deletePost",
  "repostPost",
  "unrepostPost",
  "hideReply",
  "likePost",
  "unlikePost",
  "createBookmark",
  "deleteBookmark",
  "followUser",
  "unfollowUser",
  "muteUser",
  "unmuteUser",
  "blockUser",
  "unblockUser",
  "blockDms",
  "unblockDms",
  "createList",
  "updateList",
  "deleteList",
  "addListMember",
  "removeListMember",
  "followList",
  "unfollowList",
  "pinList",
  "unpinList",
  "createDmConversation",
  "sendDmByParticipant",
  "sendDmByConversation",
  "deleteDmEvent",
  "createChatConversation",
  "initializeChatGroup",
  "initializeChatConversationKeys",
  "addChatGroupMembers",
  "sendChatMessage",
  "markChatConversationRead",
  "sendChatTypingIndicator",
  "addUserPublicKey",
  "createMediaMetadata",
  "createMediaSubtitles",
  "deleteMediaSubtitles",
  "createCommunityNote",
  "deleteCommunityNote",
  "evaluateCommunityNote",
]);
```

Assert read-only scopes return only the existing read tools, full scopes include `createPost`, `likePost`, `sendDmByConversation`, and `createCommunityNote`, and source-user operations have `sourceUserId: "connected_actor"`.

- [ ] **Step 2: Write failing tool execution tests**

In `tools.test.ts`, update the tool list test to expect reads and writes. Replace the "rejects write-capable" test with:

```ts
it("executes JSON write operations with connected actor path injection", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({ data: { liked: true } })
  );

  await executeXApiTool({
    accessToken: "x_access",
    apiOrigin: "https://api.x.test",
    connectedActorId: "x_user_1",
    fetch: fetchMock,
    input: { tweet_id: "tweet_123" },
    name: "likePost",
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.x.test/2/users/x_user_1/likes",
    expect.objectContaining({
      body: JSON.stringify({ tweet_id: "tweet_123" }),
      headers: expect.objectContaining({
        "content-type": "application/json",
        authorization: "Bearer x_access",
      }),
      method: "POST",
    })
  );
});
```

Add tests for `deletePost`, `searchPostsRecent`, missing connected actor id, and unknown tools.

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
pnpm --filter @repo/x-app-node test -- src/__tests__/operations.test.ts src/__tests__/tools.test.ts
```

Expected: FAIL because `operations.ts` does not exist and `executeXApiTool` still uses the read-only switch.

- [ ] **Step 4: Create operation registry types**

In `operations.ts`, define:

```ts
export type XOperationMethod = "DELETE" | "GET" | "POST" | "PUT";
export type XOperationClassification = "read" | "write";

export interface XOperationDefinition {
  body?: (input: Record<string, unknown>) => unknown;
  classification: XOperationClassification;
  description: string;
  inputSchema: Record<string, unknown>;
  method: XOperationMethod;
  name: string;
  path: string;
  query?: (input: Record<string, unknown>) => Record<string, string | undefined>;
  requiredScopes: string[];
  sourceUserId?: "connected_actor";
}
```

Add helpers for required string/list/number args, path encoding, query building, path templating, and omitting path-only keys from JSON bodies.

- [ ] **Step 5: Add registry entries exactly from this table**

| Tool | Method | Path | Required scopes | Source user | Input/body handling |
| --- | --- | --- | --- | --- | --- |
| `getUsersMe` | GET | `/2/users/me` | `users.read` | none | no body |
| `getUsersByUsername` | GET | `/2/users/by/username/{username}` | `users.read` | none | path `username` |
| `getUsersByUsernames` | GET | `/2/users/by` | `users.read` | none | query `usernames` joined by comma |
| `getUsersById` | GET | `/2/users/{id}` | `users.read` | none | path `id` |
| `getUsersByIds` | GET | `/2/users` | `users.read` | none | query `ids` joined by comma |
| `getPostsById` | GET | `/2/tweets/{id}` | `tweet.read`, `users.read` | none | path `id` |
| `getPostsByIds` | GET | `/2/tweets` | `tweet.read`, `users.read` | none | query `ids` joined by comma |
| `searchPostsRecent` | GET | `/2/tweets/search/recent` | `tweet.read`, `users.read` | none | query `query`, optional `max_results` |
| `getPostsCountsRecent` | GET | `/2/tweets/counts/recent` | `tweet.read`, `users.read` | none | query `query` |
| `createPost` | POST | `/2/tweets` | `tweet.read`, `tweet.write`, `users.read` | none | JSON body is input |
| `deletePost` | DELETE | `/2/tweets/{id}` | `tweet.read`, `tweet.write`, `users.read` | none | path `id` |
| `repostPost` | POST | `/2/users/{source_user_id}/retweets` | `tweet.read`, `tweet.write`, `users.read` | connected actor | body `{ tweet_id }` |
| `unrepostPost` | DELETE | `/2/users/{source_user_id}/retweets/{source_tweet_id}` | `tweet.read`, `tweet.write`, `users.read` | connected actor | map input `tweet_id` to path `source_tweet_id` |
| `hideReply` | PUT | `/2/tweets/{tweet_id}/hidden` | `tweet.moderate.write`, `tweet.read`, `users.read` | none | body `{ hidden }`; default hidden to `true` |
| `likePost` | POST | `/2/users/{source_user_id}/likes` | `like.write`, `tweet.read`, `users.read` | connected actor | body `{ tweet_id }` |
| `unlikePost` | DELETE | `/2/users/{source_user_id}/likes/{tweet_id}` | `like.write`, `tweet.read`, `users.read` | connected actor | path `tweet_id` |
| `createBookmark` | POST | `/2/users/{source_user_id}/bookmarks` | `bookmark.write`, `tweet.read`, `users.read` | connected actor | body `{ tweet_id }` |
| `deleteBookmark` | DELETE | `/2/users/{source_user_id}/bookmarks/{tweet_id}` | `bookmark.write`, `tweet.read`, `users.read` | connected actor | path `tweet_id` |
| `followUser` | POST | `/2/users/{source_user_id}/following` | `follows.write`, `tweet.read`, `users.read` | connected actor | body `{ target_user_id }` |
| `unfollowUser` | DELETE | `/2/users/{source_user_id}/following/{target_user_id}` | `follows.write`, `tweet.read`, `users.read` | connected actor | path `target_user_id` |
| `muteUser` | POST | `/2/users/{source_user_id}/muting` | `mute.write`, `tweet.read`, `users.read` | connected actor | body `{ target_user_id }` |
| `unmuteUser` | DELETE | `/2/users/{source_user_id}/muting/{target_user_id}` | `mute.write`, `tweet.read`, `users.read` | connected actor | path `target_user_id` |
| `blockUser` | POST | `/2/users/{source_user_id}/blocking` | `block.write`, `users.read` | connected actor | body `{ target_user_id }` |
| `unblockUser` | DELETE | `/2/users/{source_user_id}/blocking/{target_user_id}` | `block.write`, `users.read` | connected actor | path `target_user_id` |
| `blockDms` | POST | `/2/users/{user_id}/dm/block` | `dm.write`, `tweet.read`, `users.read` | none | path `user_id` |
| `unblockDms` | POST | `/2/users/{user_id}/dm/unblock` | `dm.write`, `tweet.read`, `users.read` | none | path `user_id` |
| `createList` | POST | `/2/lists` | `list.read`, `list.write`, `tweet.read`, `users.read` | none | JSON body is input |
| `updateList` | PUT | `/2/lists/{id}` | `list.write`, `tweet.read`, `users.read` | none | path `id`; JSON body omits `id` |
| `deleteList` | DELETE | `/2/lists/{id}` | `list.write`, `tweet.read`, `users.read` | none | path `id` |
| `addListMember` | POST | `/2/lists/{id}/members` | `list.write`, `tweet.read`, `users.read` | none | path `id`; body `{ user_id }` |
| `removeListMember` | DELETE | `/2/lists/{id}/members/{user_id}` | `list.write`, `tweet.read`, `users.read` | none | path `id`, `user_id` |
| `followList` | POST | `/2/users/{source_user_id}/followed_lists` | `list.write`, `tweet.read`, `users.read` | connected actor | body `{ list_id }` |
| `unfollowList` | DELETE | `/2/users/{source_user_id}/followed_lists/{list_id}` | `list.write`, `tweet.read`, `users.read` | connected actor | path `list_id` |
| `pinList` | POST | `/2/users/{source_user_id}/pinned_lists` | `list.write`, `tweet.read`, `users.read` | connected actor | body `{ list_id }` |
| `unpinList` | DELETE | `/2/users/{source_user_id}/pinned_lists/{list_id}` | `list.write`, `tweet.read`, `users.read` | connected actor | path `list_id` |
| `createDmConversation` | POST | `/2/dm_conversations` | `dm.write`, `tweet.read`, `users.read` | none | JSON body is input |
| `sendDmByParticipant` | POST | `/2/dm_conversations/with/{participant_id}/messages` | `dm.write`, `tweet.read`, `users.read` | none | path `participant_id`; body omits `participant_id` |
| `sendDmByConversation` | POST | `/2/dm_conversations/{dm_conversation_id}/messages` | `dm.write`, `tweet.read`, `users.read` | none | path `dm_conversation_id`; body omits it |
| `deleteDmEvent` | DELETE | `/2/dm_events/{event_id}` | `dm.read`, `dm.write` | none | path `event_id` |
| `createChatConversation` | POST | `/2/chat/conversations/group` | `dm.write`, `tweet.read`, `users.read` | none | JSON body is input |
| `initializeChatGroup` | POST | `/2/chat/conversations/group/initialize` | `dm.write` | none | JSON body is input |
| `initializeChatConversationKeys` | POST | `/2/chat/conversations/{id}/keys` | `dm.write`, `tweet.read`, `users.read` | none | path `id`; body omits `id` |
| `addChatGroupMembers` | POST | `/2/chat/conversations/{id}/members` | `dm.write`, `tweet.read`, `users.read` | none | path `id`; body omits `id` |
| `sendChatMessage` | POST | `/2/chat/conversations/{id}/messages` | `dm.write`, `tweet.read`, `users.read` | none | path `id`; body omits `id` |
| `markChatConversationRead` | POST | `/2/chat/conversations/{id}/read` | `dm.write`, `tweet.read`, `users.read` | none | path `id`; body omits `id` |
| `sendChatTypingIndicator` | POST | `/2/chat/conversations/{id}/typing` | `dm.write`, `tweet.read`, `users.read` | none | path `id`; body omits `id` |
| `addUserPublicKey` | POST | `/2/users/{source_user_id}/public_keys` | `dm.write`, `tweet.read`, `users.read` | connected actor | JSON body is input |
| `createMediaMetadata` | POST | `/2/media/metadata` | `media.write` | none | JSON body is input |
| `createMediaSubtitles` | POST | `/2/media/subtitles` | `media.write` | none | JSON body is input |
| `deleteMediaSubtitles` | DELETE | `/2/media/subtitles` | `media.write` | none | JSON body is input |
| `createCommunityNote` | POST | `/2/notes` | `tweet.write` | none | JSON body is input |
| `deleteCommunityNote` | DELETE | `/2/notes/{id}` | `tweet.write` | none | path `id` |
| `evaluateCommunityNote` | POST | `/2/evaluate_note` | `tweet.write` | none | JSON body is input |

- [ ] **Step 6: Export registry helpers**

Export:

```ts
export const X_SOCIAL_WRITE_TOOL_NAMES: string[];
export function getXOperationDefinitions(): XOperationDefinition[];
export function getXOperationDefinition(name: string): XOperationDefinition | undefined;
export function getXToolDefinitionsForScopes(scopes: readonly string[]): XToolDefinition[];
export function hasScopesForXOperation(operation: XOperationDefinition, scopes: readonly string[]): boolean;
export function buildXOperationRequest(input: {
  apiOrigin: string;
  connectedActorId?: string | null;
  operation: XOperationDefinition;
  toolInput: Record<string, unknown>;
}): { body?: string; headers: Record<string, string>; method: XOperationMethod; url: string };
```

`getXToolDefinitions()` should keep its existing no-argument export and return all registry tool definitions for internal callers. `getXToolDefinitionsForScopes(scopes)` should return only tools whose required scopes are all present.

- [ ] **Step 7: Rewrite `executeXApiTool` to use the registry**

Add `connectedActorId?: string | null` to `ExecuteXApiToolInput`. Build the request with `buildXOperationRequest`, set bearer auth, set `content-type: application/json` for JSON bodies, return `structuredContent`, and keep sanitized `X_TOOL_CALL_FAILED` behavior for provider failures and unknown tools.

- [ ] **Step 8: Re-run focused tests**

```bash
pnpm --filter @repo/x-app-node test -- src/__tests__/operations.test.ts src/__tests__/tools.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/x-app-node/src/operations.ts packages/x-app-node/src/tools.ts packages/x-app-node/src/index.ts packages/x-app-node/src/__tests__/operations.test.ts packages/x-app-node/src/__tests__/tools.test.ts
git commit -m "feat(x): add social operation registry"
```

---

## Task 7: Filter X Bridge, Flow, And Catalog By Granted Scopes

**Files:**
- Modify: `api/app/src/services/connectors/x-mcp-bridge.ts`
- Modify: `api/app/src/services/connectors/x-flow.ts`
- Modify: `api/app/src/services/connectors/catalog.ts`
- Test: `api/app/src/__tests__/connectors-x-mcp-bridge.test.ts`
- Test: `api/app/src/__tests__/connectors-flow.test.ts`
- Test: `api/app/src/__tests__/connectors-router.test.ts`

- [ ] **Step 1: Write failing X bridge tests**

In `connectors-x-mcp-bridge.test.ts`, add tests that assert:

```ts
// Read-only stored scopes list only read tools.
getCurrentOrgConnectorConnectionMock.mockResolvedValue(
  connection({ scopes: ["tweet.read", "users.read", "offline.access"] })
);
// tools/list result includes getUsersMe and excludes createPost.

// Full stored scopes list write tools.
getCurrentOrgConnectorConnectionMock.mockResolvedValue(
  connection({ scopes: X_OAUTH_SCOPES })
);
// tools/list result includes createPost.

// Write call without granted scope is rejected before executeXApiTool.
// Write call not present in current toolManifest is rejected before executeXApiTool.
// Write call with granted scope and manifest passes connectedActorId.
expect(executeXApiToolMock).toHaveBeenCalledWith(
  expect.objectContaining({
    connectedActorId: "x_user_1",
    name: "likePost",
  })
);
```

- [ ] **Step 2: Write failing flow/catalog tests**

In `connectors-flow.test.ts`, add assertions that discovery on a read-only X connection stores only read tools and that reconnect with full returned scopes stores write tools.

In `connectors-router.test.ts`, set the mocked connector list row for X to:

```ts
connection: {
  scopeStatus: "missing_requested_scopes",
  missingScopes: ["tweet.write"],
}
```

Assert `connectors.list()` preserves these fields.

- [ ] **Step 3: Run focused API tests and confirm failure**

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-x-mcp-bridge.test.ts src/__tests__/connectors-flow.test.ts src/__tests__/connectors-router.test.ts
```

Expected: FAIL because bridge tools are not scope-filtered and catalog does not expose scope status.

- [ ] **Step 4: Scope-filter the bridge**

In `x-mcp-bridge.ts`, import `getXToolDefinitionsForScopes`. Register tools from:

```ts
const definitions = input.connection
  ? getXToolDefinitionsForScopes(input.connection.scopes)
  : [];
```

Before executing a tool call, require:

```ts
input.connection.toolManifest.some((tool) => tool.name === definition.name)
```

and pass:

```ts
connectedActorId: input.connection.providerActorId
```

to `executeXApiTool`.

- [ ] **Step 5: Preserve partial scopes in flow discovery**

In `x-flow.ts`, keep persisting `token.scopes` as returned by X. After OAuth finalize, discovery should call the bridge with the newly persisted connection. Because the bridge now filters by `connection.scopes`, `toolManifest` naturally reflects partial grants.

Update tests to assert `enabledForAutomations` is true when at least one runtime-safe tool remains and false when no runtime-safe tool remains.

- [ ] **Step 6: Add catalog X scope status**

In `catalog.ts`, import `X_OAUTH_SCOPES`. Add to `ConnectorCatalogRow["connection"]`:

```ts
scopeStatus: "complete" | "missing_requested_scopes";
missingScopes: string[];
```

In `shapeConnection`, compute for X:

```ts
const missingScopes =
  connection.provider === "x"
    ? X_OAUTH_SCOPES.filter((scope) => !connection.scopes.includes(scope))
    : [];
const scopeStatus =
  missingScopes.length > 0 ? "missing_requested_scopes" : "complete";
```

For non-X connectors, return `scopeStatus: "complete"` and `missingScopes: []`.

- [ ] **Step 7: Re-run focused API tests**

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-x-mcp-bridge.test.ts src/__tests__/connectors-flow.test.ts src/__tests__/connectors-router.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/app/src/services/connectors/x-mcp-bridge.ts api/app/src/services/connectors/x-flow.ts api/app/src/services/connectors/catalog.ts api/app/src/__tests__/connectors-x-mcp-bridge.test.ts api/app/src/__tests__/connectors-flow.test.ts api/app/src/__tests__/connectors-router.test.ts
git commit -m "feat(connectors): filter x tools by granted scopes"
```

---

## Task 8: Extend The X Emulator For Social Writes

**Files:**
- Create: `emulators/x/src/plugin/social-writes.ts`
- Modify: `emulators/x/src/plugin/failures.ts`
- Modify: `emulators/x/src/plugin/index.ts`
- Modify: `emulators/x/src/fixtures.ts`
- Test: `emulators/x/src/__tests__/server.test.ts`

- [ ] **Step 1: Write failing emulator tests**

In `server.test.ts`, add tests for:

```ts
POST /2/tweets -> returns { data: { id, text } }
DELETE /2/tweets/:id -> returns { data: { deleted: true } }
POST /2/users/:id/likes -> returns { data: { liked: true } }
DELETE /2/users/:id/likes/:tweet_id -> returns { data: { liked: false } }
POST /2/users/:id/following -> returns { data: { following: true } }
POST /2/lists -> returns { data: { id, name } }
POST /2/dm_conversations/with/:participant_id/messages -> returns { data: { dm_event_id } }
POST /2/notes -> returns { data: { id } }
```

For one endpoint, assert missing bearer auth returns 401. For one endpoint, seed `socialWrite` failure and assert 500.

- [ ] **Step 2: Run focused emulator test and confirm failure**

```bash
pnpm --filter @repo/x-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because social write routes do not exist.

- [ ] **Step 3: Add social write failure switch**

In `failures.ts`, add `"socialWrite"` to `X_FAILURE_NAMES`.

- [ ] **Step 4: Create `social-writes.ts`**

Register deterministic JSON handlers for every write path from Task 6. Each handler must:

1. Require `isValidBearer(c, store)`.
2. Return 500 when `getFailures(store).socialWrite` is true.
3. Parse JSON bodies with `await c.req.json().catch(() => ({}))`.
4. Return deterministic ids using existing store inserts or stable strings.
5. Avoid modeling provider plan restrictions; plan/access failures are covered by the failure switch.

The emulator responses can be small, for example `{ data: { liked: true } }`, `{ data: { following: false } }`, `{ data: { pinned: true } }`, and `{ data: { deleted: true } }`.

- [ ] **Step 5: Register the plugin**

In `plugin/index.ts`, import and call `registerSocialWrites(app, store)` after `registerPosts(app, store)`.

- [ ] **Step 6: Re-run emulator tests**

```bash
pnpm --filter @repo/x-emulator test -- src/__tests__/server.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add emulators/x/src/plugin/social-writes.ts emulators/x/src/plugin/failures.ts emulators/x/src/plugin/index.ts emulators/x/src/fixtures.ts emulators/x/src/__tests__/server.test.ts
git commit -m "feat(x-emulator): add social write endpoints"
```

---

## Task 9: Update Connector UI Copy And Reconnect Warning

**Files:**
- Modify: `packages/connector-contract/src/index.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.tsx`
- Test: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`

- [ ] **Step 1: Write failing UI tests**

In `connector-detail-content.test.tsx`, add:

```ts
it("shows an X reconnect warning when requested scopes are missing", () => {
  render(
    <ConnectorDetailContent
      onCopyLink={vi.fn()}
      row={{
        ...connectedRow({
          missingScopes: ["tweet.write", "dm.write"],
          scopeStatus: "missing_requested_scopes",
        }),
        displayName: "X",
        provider: "x",
      }}
    />
  );

  expect(screen.getByText(/Reconnect X/i)).toBeInTheDocument();
  expect(screen.getByText(/tweet.write, dm.write/i)).toBeInTheDocument();
});
```

In `connectors-page.test.tsx`, update the local `ConnectorRow` type to include:

```ts
scopeStatus: "complete" | "missing_requested_scopes";
missingScopes: string[];
```

Add an assertion that the automations toggle copy includes `read and write` and the agents toggle copy includes `read and write`.

- [ ] **Step 2: Run focused UI tests and confirm failure**

```bash
pnpm --filter @lightfast/app test -- 'src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx'
```

Expected: FAIL because the scope warning and read/write copy do not exist.

- [ ] **Step 3: Update connector description**

In `packages/connector-contract/src/index.ts`, replace the X description with:

```ts
"Search posts, manage engagement, send messages, and publish through X from Lightfast agents and automations."
```

- [ ] **Step 4: Update toggle copy**

In `connectors-client.tsx`, replace the automations helper text with:

```tsx
Allow automations to read and write through {row.displayName} tools.
```

Replace the agents helper text with:

```tsx
Allow agent surfaces to discover and call read/write tools from {row.displayName}.
```

- [ ] **Step 5: Show reconnect warning**

In `connector-detail-content.tsx`, render an amber warning block above the tools list when:

```ts
row.provider === "x" &&
connection.scopeStatus === "missing_requested_scopes" &&
connection.missingScopes.length > 0
```

Use this copy:

```text
Reconnect X to grant the newly requested social write scopes: tweet.write, dm.write.
```

Use `connection.missingScopes.join(", ")` for the scope list.

- [ ] **Step 6: Re-run focused UI tests**

```bash
pnpm --filter @lightfast/app test -- 'src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/connector-contract/src/index.ts 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx' 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.tsx' 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx' 'apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx'
git commit -m "feat(connectors): clarify x read write access"
```

---

## Task 10: Final Verification And Deferred Security Issue

**Files:**
- No source file modifications expected.
- Create GitHub issue for deferred security upgrades.

- [ ] **Step 1: Run focused package tests**

```bash
pnpm --filter @repo/provider-routines test
pnpm --filter @repo/x-app-node test
pnpm --filter @repo/x-emulator test
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts src/__tests__/connectors-x-mcp-bridge.test.ts src/__tests__/connectors-flow.test.ts src/__tests__/connectors-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/api/chat/route.test.ts 'src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-content.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx'
```

Expected: PASS.

- [ ] **Step 2: Run focused typechecks**

```bash
pnpm --filter @repo/provider-routines typecheck
pnpm --filter @repo/x-app-node typecheck
pnpm --filter @repo/x-emulator typecheck
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Create deferred security issue**

Run:

```bash
gh issue create --title "Add fine-grained connector write safeguards" --body "Follow-up to X social/account writes. Current policy intentionally treats Use in agents and Use in automations as full read/write connector grants. Add later safeguards: per-tool toggles, optional read-only mode, high-risk write warnings, approval gates for selected social/account actions, and clearer audit views for provider routine calls. Do not block the current X connector read/write rollout on this issue."
```

Expected: GitHub issue URL printed.

- [ ] **Step 4: Inspect git status**

```bash
git status --short
```

Expected: clean working tree after all task commits.
