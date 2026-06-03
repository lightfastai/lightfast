# X MCP Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add X as an org-level read-only MCP connector using a reusable Lightfast-hosted MCP bridge with Lightfast MCP bearer auth.

**Architecture:** Linear remains a provider-hosted MCP integration. X uses X OAuth2 PKCE for provider tokens, stores those tokens in the existing connector table, and exposes `/api/connectors/x/mcp` as an app-hosted Streamable HTTP MCP endpoint. Runtime callers mint short-lived Lightfast MCP tokens; the bridge validates those tokens, loads the current connector row, decrypts and refreshes X tokens server-side, and calls X API v2.

**Tech Stack:** pnpm workspace, Turborepo, TypeScript ESM, Next.js App Router route handlers, tRPC, Drizzle ORM on PlanetScale/Vitess, Upstash Redis, Clerk org admin sessions, X OAuth2 PKCE, MCP Streamable HTTP via `@vendor/mcp`, `@repo/app-encryption`, `@repo/x-emulator`, Portless, Vitest, React 19.

**Design doc:** `docs/superpowers/specs/2026-06-02-x-mcp-connector-design.md`

**Adapter decision:** Do not add `mcp-handler` in this implementation pass. As of 2026-06-02, `mcp-handler@1.1.0` peers on `@modelcontextprotocol/sdk@1.26.0`, while `@vendor/mcp` uses `^1.29.0`. Use direct `@vendor/mcp` exports for the bridge route and revisit `mcp-handler` when its peer range matches the workspace MCP SDK.

---

## File Structure

Create:

- `packages/x-app-node/package.json` - X provider helper package manifest.
- `packages/x-app-node/tsconfig.json` and `packages/x-app-node/vitest.config.ts` - TypeScript and test config.
- `packages/x-app-node/src/config.ts` - default X endpoints and endpoint override guard.
- `packages/x-app-node/src/errors.ts` - sanitized X error class.
- `packages/x-app-node/src/oauth.ts` - PKCE, authorize URL, token exchange, refresh, revoke.
- `packages/x-app-node/src/metadata.ts` - `/2/users/me` metadata lookup.
- `packages/x-app-node/src/tools.ts` - curated read-only X MCP tool definitions and X API execution helpers.
- `packages/x-app-node/src/mcp.ts` - MCP client helpers for Lightfast-hosted X bridge.
- `packages/x-app-node/src/index.ts` - public exports.
- `packages/x-app-node/src/__tests__/config.test.ts`
- `packages/x-app-node/src/__tests__/oauth.test.ts`
- `packages/x-app-node/src/__tests__/metadata.test.ts`
- `packages/x-app-node/src/__tests__/tools.test.ts`
- `packages/x-app-node/src/__tests__/mcp.test.ts`
- `api/app/src/services/connectors/mcp-auth.ts` - Lightfast MCP bearer issue/verify helpers.
- `api/app/src/services/connectors/x-mcp-bridge.ts` - app-hosted X MCP bridge service.
- `api/app/src/services/connectors/x-flow.ts` - X connect/reconnect/callback/refresh/disconnect orchestration.
- `api/app/src/__tests__/connectors-mcp-auth.test.ts`
- `api/app/src/__tests__/connectors-x-mcp-bridge.test.ts`
- `apps/app/src/app/(app)/(connectors)/api/connectors/x/oauth/callback/route.ts`
- `apps/app/src/app/(app)/(connectors)/api/connectors/x/mcp/route.ts`
- `apps/app/src/__tests__/app/api/connectors/x-mcp-route.test.ts`

Modify:

- `vendor/mcp/src/index.ts` - export `WebStandardStreamableHTTPServerTransport`.
- `packages/connector-contract/src/index.ts` and tests - add X and allow camelCase tool names.
- `db/app/src/utils/org-connector-connections.ts` and tests - allow manifest update plus automation state in one helper.
- `api/app/package.json` - depend on `@repo/x-app-node` and `@vendor/mcp`.
- `api/app/src/env.ts` - add X env and `CONNECTOR_MCP_AUTH_SECRET`.
- `api/app/src/services/connectors/attempts.ts` - make OAuth attempts provider-scoped.
- `api/app/src/services/connectors/config.ts` - add X config helpers.
- `api/app/src/services/connectors/catalog.ts` - make provider availability include X config.
- `api/app/src/services/connectors/linear-flow.ts` - import renamed provider-scoped OAuth attempt helpers.
- `api/app/src/services/connectors/index.ts` - dispatch X operations.
- `api/app/src/services/connectors/runtime.ts` - load and call X runtime tools.
- `api/app/src/__tests__/connectors-flow.test.ts`
- `api/app/src/__tests__/connectors-runtime.test.ts`
- `api/app/src/__tests__/connectors-router.test.ts`
- `apps/app/src/proxy.ts` and `apps/app/src/__tests__/proxy.test.ts` - expose X callback and MCP route to route-level auth.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-icons.tsx` - add X mark.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx` - remove Linear-only connectable guard and make missing-config copy provider-aware.
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
- `emulators/x/src/fixtures.ts` - add deterministic users/posts/search fixtures.
- `emulators/x/src/plugin/failures.ts` - add X API failure switches.
- `emulators/x/src/plugin/users.ts` - add user lookup endpoints.
- `emulators/x/src/plugin/index.ts` - register new X API plugin routes.
- `emulators/x/src/manifest.ts` - emit app-hosted `X_MCP_ENDPOINT`.
- `emulators/x/src/__tests__/server.test.ts`
- `pnpm-lock.yaml` - update after new package dependencies.

Do not modify:

- Linear's provider-hosted MCP behavior except shared provider dispatch plumbing.
- The connector database schema.
- Public third-party MCP client flows.
- X write tools or write scopes.

---

## Task 1: Add X To The Connector Contract

**Files:**
- Modify: `packages/connector-contract/src/index.ts`
- Test: `packages/connector-contract/src/__tests__/connector-contract.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Add these assertions to `packages/connector-contract/src/__tests__/connector-contract.test.ts`:

```ts
it("includes X as a connectable provider", () => {
  expect(CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
  expect(CONNECTABLE_CONNECTOR_PROVIDERS).toEqual(["linear", "x"]);
  expect(CONNECTOR_CATALOG.map((item) => item.provider)).toContain("x");
});

it("accepts case-preserving X tool names", () => {
  expect(connectorToolNameSchema.parse("getUsersByUsername")).toBe(
    "getUsersByUsername"
  );
  expect(connectorRuntimeToolName("x", "getUsersByUsername")).toBe(
    "x__getUsersByUsername"
  );
  expect(
    parseConnectorRuntimeToolName("x__getUsersByUsername")
  ).toMatchObject({
    provider: "x",
    providerToolName: "getUsersByUsername",
  });
});

it("continues rejecting unsafe connector tool names", () => {
  expect(connectorToolNameSchema.safeParse("get users").success).toBe(false);
  expect(connectorToolNameSchema.safeParse("get/users").success).toBe(false);
  expect(connectorToolNameSchema.safeParse("getUsers!").success).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm --filter @repo/connector-contract test
```

Expected: FAIL because provider `x` is not in the contract and camelCase tool names are rejected.

- [ ] **Step 3: Update the connector contract**

In `packages/connector-contract/src/index.ts`, make these changes:

```ts
export const CONNECTOR_PROVIDERS = ["linear", "x"] as const;
export const CONNECTABLE_CONNECTOR_PROVIDERS = ["linear", "x"] as const;

export const connectorToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+$/, "Unsupported connector tool name");
```

Add this catalog item after Linear:

```ts
{
  provider: "x",
  displayName: "X",
  description:
    "Search posts and look up X accounts from Lightfast automations.",
  builder: "Lightfast",
  category: "Social",
  catalogStatus: "available",
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
pnpm --filter @repo/connector-contract test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connector-contract/src/index.ts packages/connector-contract/src/__tests__/connector-contract.test.ts
git commit -m "feat(connectors): add x connector contract"
```

---

## Task 2: Add Generic Manifest And Automation Persistence Helpers

**Files:**
- Modify: `db/app/src/utils/org-connector-connections.ts`
- Test: `db/app/src/__tests__/org-connector-connections.test.ts`

- [ ] **Step 1: Write the failing DB utility tests**

In `db/app/src/__tests__/org-connector-connections.test.ts`, add coverage for a helper named `updateConnectorToolManifestAndAutomationState`:

```ts
it("updates connector tools and default automation state together", async () => {
  await insertCurrentConnection({
    enabledForAutomations: false,
    provider: "x",
    toolManifest: [],
  });

  const updated = await updateConnectorToolManifestAndAutomationState(db, {
    clerkOrgId: "org_acme",
    enabledForAutomations: true,
    lastToolRefreshAt: new Date("2026-06-02T10:00:00.000Z"),
    provider: "x",
    toolManifest: [{ name: "getUsersByUsername" }],
  });

  expect(updated).toBe(true);
  const current = await getCurrentOrgConnectorConnection(db, {
    clerkOrgId: "org_acme",
    provider: "x",
  });
  expect(current?.enabledForAutomations).toBe(true);
  expect(current?.lastToolRefreshAt).toEqual(
    new Date("2026-06-02T10:00:00.000Z")
  );
  expect(current?.lastToolRefreshErrorAt).toBeNull();
  expect(current?.lastToolRefreshErrorCode).toBeNull();
  expect(current?.toolManifest).toEqual([{ name: "getUsersByUsername" }]);
});

it("can finalize a connector row with an initial empty manifest", async () => {
  const row = await finalizeCurrentOrgConnectorConnection(db, {
    accessTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    clerkOrgId: "org_acme",
    connectedByUserId: "user_1",
    encryptedAccessToken: "encrypted_x_access",
    encryptedRefreshToken: "encrypted_x_refresh",
    enabledForAutomations: false,
    mcpEndpoint: "https://app.test/api/connectors/x/mcp",
    metadata: { mode: "connect", name: "Test User", username: "lightfast" },
    provider: "x",
    providerActorId: "x_user_1",
    providerActorName: "@lightfast",
    providerWorkspaceId: null,
    providerWorkspaceName: "X",
    refreshTokenExpiresAt: null,
    scopes: ["tweet.read", "users.read", "offline.access"],
    toolManifest: [],
  });

  expect(row.provider).toBe("x");
  expect(row.enabledForAutomations).toBe(false);
  expect(row.toolManifest).toEqual([]);
});
```

- [ ] **Step 2: Run the focused DB test and confirm it fails**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/org-connector-connections.test.ts
```

Expected: FAIL because the helper and optional finalize input do not exist.

- [ ] **Step 3: Extend the finalize input**

In `db/app/src/utils/org-connector-connections.ts`, add optional fields to `FinalizeCurrentOrgConnectorConnectionInput`:

```ts
  enabledForAutomations?: boolean;
  lastToolRefreshAt?: Date | null;
  lastToolRefreshErrorAt?: Date | null;
  lastToolRefreshErrorCode?: string | null;
```

In the insert values, set:

```ts
enabledForAutomations: input.enabledForAutomations ?? false,
lastToolRefreshAt: input.lastToolRefreshAt ?? null,
lastToolRefreshErrorAt: input.lastToolRefreshErrorAt ?? null,
lastToolRefreshErrorCode: input.lastToolRefreshErrorCode ?? null,
```

- [ ] **Step 4: Add the generic manifest plus automation helper**

Add this helper near `updateConnectorToolManifest`:

```ts
export interface UpdateConnectorToolManifestAndAutomationStateInput
  extends GetCurrentOrgConnectorConnectionInput {
  enabledForAutomations: boolean;
  lastToolRefreshAt: Date;
  toolManifest: FullConnectorToolManifest;
}

export async function updateConnectorToolManifestAndAutomationState(
  db: Database,
  input: UpdateConnectorToolManifestAndAutomationStateInput
): Promise<boolean> {
  const result = await db
    .update(orgConnectorConnections)
    .set({
      enabledForAutomations: input.enabledForAutomations,
      lastToolRefreshAt: input.lastToolRefreshAt,
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      toolManifest: input.toolManifest,
      updatedAt: input.lastToolRefreshAt,
    })
    .where(activeCurrentConnectorWhere(input));

  return getRowsAffected(result) > 0;
}
```

- [ ] **Step 5: Run the focused DB test and confirm it passes**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/org-connector-connections.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/org-connector-connections.ts db/app/src/__tests__/org-connector-connections.test.ts
git commit -m "feat(connectors): persist tool manifest automation state"
```

---

## Task 3: Create `@repo/x-app-node`

**Files:**
- Create: `packages/x-app-node/package.json`
- Create: `packages/x-app-node/tsconfig.json`
- Create: `packages/x-app-node/vitest.config.ts`
- Create: `packages/x-app-node/src/config.ts`
- Create: `packages/x-app-node/src/errors.ts`
- Create: `packages/x-app-node/src/oauth.ts`
- Create: `packages/x-app-node/src/metadata.ts`
- Create: `packages/x-app-node/src/tools.ts`
- Create: `packages/x-app-node/src/mcp.ts`
- Create: `packages/x-app-node/src/index.ts`
- Test: `packages/x-app-node/src/__tests__/*.test.ts`
- Modify: `api/app/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Scaffold the package**

Create `packages/x-app-node/package.json`:

```json
{
  "name": "@repo/x-app-node",
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

Create `packages/x-app-node/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules"]
}
```

Create `packages/x-app-node/vitest.config.ts`:

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

- [ ] **Step 2: Add the API package dependency**

In `api/app/package.json`, add:

```json
"@repo/x-app-node": "workspace:*",
"@vendor/mcp": "workspace:*"
```

Run:

```bash
pnpm install
```

Expected: completes and updates `pnpm-lock.yaml`.

- [ ] **Step 3: Write config and error tests**

Create `packages/x-app-node/src/__tests__/config.test.ts` with assertions for:

```ts
expect(DEFAULT_X_ENDPOINTS.apiOrigin).toBe("https://api.x.com");
expect(DEFAULT_X_ENDPOINTS.oauthAuthorizeUrl).toBe(
  "https://x.com/i/oauth2/authorize"
);
expect(DEFAULT_X_ENDPOINTS.oauthTokenUrl).toBe(
  "https://api.x.com/2/oauth2/token"
);
expect(DEFAULT_X_ENDPOINTS.oauthRevokeUrl).toBe(
  "https://api.x.com/2/oauth2/revoke"
);
expect(DEFAULT_X_ENDPOINTS.viewerUrl).toBe("https://api.x.com/2/users/me");
expect(DEFAULT_X_ENDPOINTS.mcpEndpoint).toBe(
  "https://app.invalid/api/connectors/x/mcp"
);
```

Also assert that production custom endpoint overrides throw `X_CUSTOM_ENDPOINT_FORBIDDEN`.

- [ ] **Step 4: Implement config and errors**

Create `packages/x-app-node/src/errors.ts`:

```ts
export type XAppNodeErrorCode =
  | "X_CUSTOM_ENDPOINT_FORBIDDEN"
  | "X_METADATA_FAILED"
  | "X_MCP_FAILED"
  | "X_OAUTH_EXCHANGE_FAILED"
  | "X_REVOKE_FAILED"
  | "X_TOKEN_REFRESH_FAILED"
  | "X_TOOL_CALL_FAILED";

export class XAppNodeError extends Error {
  constructor(
    readonly code: XAppNodeErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "XAppNodeError";
  }
}
```

Create `packages/x-app-node/src/config.ts` with:

```ts
import { XAppNodeError } from "./errors";

export interface XEndpoints {
  apiOrigin: string;
  mcpEndpoint: string;
  oauthAuthorizeUrl: string;
  oauthRevokeUrl: string;
  oauthTokenUrl: string;
  viewerUrl: string;
}

export const DEFAULT_X_ENDPOINTS: XEndpoints = {
  apiOrigin: "https://api.x.com",
  mcpEndpoint: "https://app.invalid/api/connectors/x/mcp",
  oauthAuthorizeUrl: "https://x.com/i/oauth2/authorize",
  oauthRevokeUrl: "https://api.x.com/2/oauth2/revoke",
  oauthTokenUrl: "https://api.x.com/2/oauth2/token",
  viewerUrl: "https://api.x.com/2/users/me",
};

export function assertXEndpointAllowed(input: {
  defaultValue: string;
  nodeEnv?: string;
  value: string;
}) {
  if (input.value === input.defaultValue) {
    return;
  }
  if (input.nodeEnv === "development" || input.nodeEnv === "test") {
    return;
  }
  throw new XAppNodeError(
    "X_CUSTOM_ENDPOINT_FORBIDDEN",
    "Custom X endpoints are only allowed in development and test."
  );
}

export function resolveXEndpoints(input: {
  appOrigin?: string;
  endpointOverrides?: Partial<XEndpoints> & {
    oauthOrigin?: string;
  };
  nodeEnv?: string;
} = {}): XEndpoints {
  const appOrigin = input.appOrigin ?? "https://app.invalid";
  const overrides = input.endpointOverrides ?? {};
  const apiOrigin = overrides.apiOrigin ?? DEFAULT_X_ENDPOINTS.apiOrigin;
  const oauthOrigin = overrides.oauthOrigin ?? "https://x.com";
  const endpoints: XEndpoints = {
    apiOrigin,
    mcpEndpoint:
      overrides.mcpEndpoint ?? `${appOrigin}/api/connectors/x/mcp`,
    oauthAuthorizeUrl:
      overrides.oauthAuthorizeUrl ?? `${oauthOrigin}/i/oauth2/authorize`,
    oauthRevokeUrl:
      overrides.oauthRevokeUrl ?? `${apiOrigin}/2/oauth2/revoke`,
    oauthTokenUrl:
      overrides.oauthTokenUrl ?? `${apiOrigin}/2/oauth2/token`,
    viewerUrl: overrides.viewerUrl ?? `${apiOrigin}/2/users/me`,
  };

  for (const [key, value] of Object.entries(endpoints)) {
    const defaultValue =
      key === "mcpEndpoint"
        ? `${appOrigin}/api/connectors/x/mcp`
        : DEFAULT_X_ENDPOINTS[key as keyof XEndpoints];
    assertXEndpointAllowed({
      defaultValue,
      nodeEnv: input.nodeEnv,
      value,
    });
  }

  return endpoints;
}
```

- [ ] **Step 5: Write OAuth, metadata, tool, and MCP client tests**

Add tests that verify:

- authorize URLs include `response_type=code`, `client_id`, `redirect_uri`, `scope=tweet.read users.read offline.access`, `state`, `code_challenge`, and `code_challenge_method=S256`.
- token exchange sends Basic auth for `clientId:clientSecret`, sends `grant_type=authorization_code`, `code`, `redirect_uri`, and `code_verifier`.
- refresh sends `grant_type=refresh_token`.
- revoke sends `token`.
- metadata calls `/2/users/me` with `Authorization: Bearer x_access` and returns `{ actorId, actorName, name, username }`.
- `X_TOOL_DEFINITIONS.map((tool) => tool.name)` equals:

```ts
[
  "getUsersMe",
  "getUsersByUsername",
  "getUsersByUsernames",
  "getUsersById",
  "getUsersByIds",
  "getPostsById",
  "getPostsByIds",
  "searchPostsRecent",
  "getPostsCountsRecent",
]
```

- `listXBridgeMcpTools` and `callXBridgeMcpTool` send `Authorization: Bearer lfmcp_v1.test.payload.signature` to the configured MCP endpoint.

- [ ] **Step 6: Implement OAuth, metadata, tools, and MCP helpers**

Implement:

```ts
export const X_OAUTH_SCOPE = "tweet.read users.read offline.access";
```

Implement tool definitions in `tools.ts` with these endpoint mappings:

```ts
getUsersMe -> GET /2/users/me
getUsersByUsername -> GET /2/users/by/username/:username
getUsersByUsernames -> GET /2/users/by?usernames=a,b
getUsersById -> GET /2/users/:id
getUsersByIds -> GET /2/users?ids=1,2
getPostsById -> GET /2/tweets/:id
getPostsByIds -> GET /2/tweets?ids=1,2
searchPostsRecent -> GET /2/tweets/search/recent?query=lightfast&max_results=10
getPostsCountsRecent -> GET /2/tweets/counts/recent?query=lightfast
```

Every X API request must set `Authorization: Bearer ${accessToken}`. Return parsed JSON as `structuredContent` and include a short text fallback in bridge handlers.

Implement `mcp.ts` like Linear's MCP helper, except the bearer input is named `mcpToken`:

```ts
export async function listXBridgeMcpTools(input: {
  endpoint: string;
  mcpToken: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<FullConnectorToolManifest>;

export async function callXBridgeMcpTool(input: {
  endpoint: string;
  input?: Record<string, unknown>;
  mcpToken: string;
  name: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<unknown>;
```

- [ ] **Step 7: Export package API**

Create `packages/x-app-node/src/index.ts`:

```ts
export * from "./config";
export * from "./errors";
export * from "./mcp";
export * from "./metadata";
export * from "./oauth";
export * from "./tools";
```

- [ ] **Step 8: Run package tests and typecheck**

Run:

```bash
pnpm --filter @repo/x-app-node test
pnpm --filter @repo/x-app-node typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/x-app-node api/app/package.json pnpm-lock.yaml
git commit -m "feat(connectors): add x provider node package"
```

---

## Task 4: Extend The X Emulator For Read-Only X API Calls

**Files:**
- Modify: `emulators/x/src/fixtures.ts`
- Modify: `emulators/x/src/plugin/failures.ts`
- Modify: `emulators/x/src/plugin/users.ts`
- Create: `emulators/x/src/plugin/posts.ts`
- Modify: `emulators/x/src/plugin/index.ts`
- Modify: `emulators/x/src/manifest.ts`
- Test: `emulators/x/src/__tests__/server.test.ts`

- [ ] **Step 1: Write failing emulator tests**

Add tests that verify:

```ts
GET /2/users/by/username/lightfast -> 200 with data.username === "lightfast"
GET /2/users/by?usernames=lightfast,agent -> 200 with two users
GET /2/users/x_user_1 -> 200 with data.id === "x_user_1"
GET /2/users?ids=x_user_1,x_user_2 -> 200 with two users
GET /2/tweets/tweet_1 -> 200 with data.id === "tweet_1"
GET /2/tweets?ids=tweet_1,tweet_2 -> 200 with two tweets
GET /2/tweets/search/recent?query=lightfast -> 200 with matching data
GET /2/tweets/counts/recent?query=lightfast -> 200 with data[0].tweet_count
```

Also assert every route returns 401 without a valid bearer token.

Assert `xManifest.env(appOrigin, emulatorOrigin).X_MCP_ENDPOINT` equals:

```ts
`${appOrigin}/api/connectors/x/mcp`
```

- [ ] **Step 2: Run the focused emulator test and confirm it fails**

Run:

```bash
pnpm --filter @repo/x-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because the new X API routes and manifest value do not exist.

- [ ] **Step 3: Add deterministic fixtures**

In `emulators/x/src/fixtures.ts`, add users and posts:

```ts
users: [
  { id: "x_user_1", name: "Lightfast", username: "lightfast" },
  { id: "x_user_2", name: "Agent", username: "agent" }
],
posts: [
  { id: "tweet_1", text: "Lightfast connector test post", author_id: "x_user_1" },
  { id: "tweet_2", text: "Agent runtime test post", author_id: "x_user_2" }
]
```

- [ ] **Step 4: Implement user and post routes**

Extend `registerUsers` and create `registerPosts`. Every route must call `isValidBearer(c, store)` first and return:

```ts
return c.json({ title: "Unauthorized", status: 401 }, 401);
```

for invalid bearer tokens.

Register the new post routes in `emulators/x/src/plugin/index.ts`.

- [ ] **Step 5: Update the manifest**

In `emulators/x/src/manifest.ts`, return:

```ts
X_MCP_ENDPOINT: `${appOrigin}/api/connectors/x/mcp`,
```

Keep:

```ts
X_API_ORIGIN: emulatorOrigin,
X_OAUTH_ORIGIN: emulatorOrigin,
```

- [ ] **Step 6: Run emulator tests and typecheck**

Run:

```bash
pnpm --filter @repo/x-emulator test
pnpm --filter @repo/x-emulator typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add emulators/x
git commit -m "feat(x-emulator): add read api fixtures"
```

---

## Task 5: Add X Connector Config And Provider-Scoped OAuth Attempts

**Files:**
- Modify: `api/app/src/env.ts`
- Modify: `api/app/src/services/connectors/config.ts`
- Modify: `api/app/src/services/connectors/attempts.ts`
- Modify: `api/app/src/services/connectors/catalog.ts`
- Test: `api/app/src/__tests__/connectors-flow.test.ts`

- [ ] **Step 1: Write failing API service tests**

In `api/app/src/__tests__/connectors-flow.test.ts`, add coverage for:

```ts
getXConnectorConfig({ env: {} }).status === "missing_config"
getXConnectorConfig({ env: { X_CLIENT_ID: "id", X_CLIENT_SECRET: "secret" } }).status === "configured"
issueConnectorOAuthAttempt({ provider: "x", ... }) stores a key prefixed with "connector-oauth-attempt:x:"
consumeConnectorOAuthAttempt({ provider: "x", state }) rejects a Linear attempt state
listConnectorsForOrg returns X with missing_config when X credentials are absent
listConnectorsForOrg returns X available when X credentials are present
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts
```

Expected: FAIL because X config and provider-scoped attempts do not exist.

- [ ] **Step 3: Add env variables**

In `api/app/src/env.ts`, add server schema keys:

```ts
CONNECTOR_MCP_AUTH_SECRET: z.string().min(32).optional(),
X_API_ORIGIN: z.string().url().optional(),
X_OAUTH_ORIGIN: z.string().url().optional(),
X_CLIENT_ID: z.string().min(1).optional(),
X_CLIENT_SECRET: z.string().min(1).optional(),
X_MCP_ENDPOINT: z.string().url().optional(),
```

Add each matching `process.env` key to `experimental__runtimeEnv`.

- [ ] **Step 4: Add X config helpers**

In `api/app/src/services/connectors/config.ts`, add:

```ts
export const X_OAUTH_CALLBACK_PATH = "/api/connectors/x/oauth/callback";
```

Add `getXConnectorConfig` and `requireXConnectorConfig` using `resolveXEndpoints`. Missing config is exactly:

```ts
Array<"X_CLIENT_ID" | "X_CLIENT_SECRET">
```

Use `runtimeEnv.X_API_ORIGIN`, `runtimeEnv.X_OAUTH_ORIGIN`, and `runtimeEnv.X_MCP_ENDPOINT` as endpoint overrides.

- [ ] **Step 5: Replace Linear-only OAuth attempts**

Rename the public attempt functions in `attempts.ts` to:

```ts
issueConnectorOAuthAttempt
lookupConnectorOAuthAttempt
consumeConnectorOAuthAttempt
```

Use keys:

```ts
connector-oauth-attempt:${provider}:${attemptId}
```

Record shape:

```ts
export interface ConnectorOAuthAttemptRecord {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  mode: "connect" | "reconnect";
  orgSlug: string;
  provider: ConnectableConnectorProvider;
  stateHash: string;
}
```

Update `api/app/src/services/connectors/linear-flow.ts` imports and types to use the renamed helpers directly:

```ts
import {
  consumeConnectorOAuthAttempt,
  issueConnectorOAuthAttempt,
  type ConnectorOAuthAttemptRecord,
} from "./attempts";
```

Pass `provider: "linear"` when issuing and consuming Linear attempts.

- [ ] **Step 6: Update catalog availability**

In `catalog.ts`, import `getXConnectorConfig` and add:

```ts
if (input.provider === "x") {
  const config = getXConnectorConfig({ appOrigin: "https://app.invalid" });
  if (config.status === "missing_config") {
    return {
      status: "unavailable",
      reason: "missing_config",
      missing: config.missing,
    };
  }
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/app/src/env.ts api/app/src/services/connectors/config.ts api/app/src/services/connectors/attempts.ts api/app/src/services/connectors/catalog.ts api/app/src/__tests__/connectors-flow.test.ts
git commit -m "feat(connectors): add x config and oauth attempts"
```

---

## Task 6: Add Lightfast MCP Auth And The X Bridge Service

**Files:**
- Modify: `vendor/mcp/src/index.ts`
- Create: `api/app/src/services/connectors/mcp-auth.ts`
- Create: `api/app/src/services/connectors/x-mcp-bridge.ts`
- Test: `api/app/src/__tests__/connectors-mcp-auth.test.ts`
- Test: `api/app/src/__tests__/connectors-x-mcp-bridge.test.ts`

- [ ] **Step 1: Export the web-standard MCP server transport**

In `vendor/mcp/src/index.ts`, add:

```ts
export { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
```

- [ ] **Step 2: Write failing MCP auth tests**

Create `api/app/src/__tests__/connectors-mcp-auth.test.ts` with tests for:

```ts
issueConnectorMcpToken(...) returns a token starting with "lfmcp_v1."
verifyConnectorMcpToken(...) returns the claims for a valid token
verifyConnectorMcpToken rejects an expired token
verifyConnectorMcpToken rejects wrong audience
verifyConnectorMcpToken rejects wrong provider
verifyConnectorMcpToken rejects wrong purpose
verifyConnectorMcpToken rejects a call token with a mismatched tool name
verifyConnectorMcpToken rejects a modified signature
```

- [ ] **Step 3: Implement MCP auth**

Create `api/app/src/services/connectors/mcp-auth.ts` with:

```ts
export type ConnectorMcpTokenPurpose = "call" | "list";

export interface ConnectorMcpTokenClaims {
  aud: `connector-mcp:${ConnectableConnectorProvider}`;
  clerkOrgId: string;
  connectionId: number;
  exp: number;
  iat: number;
  iss: "lightfast-connectors";
  nonce: string;
  provider: ConnectableConnectorProvider;
  purpose: ConnectorMcpTokenPurpose;
  toolName?: string;
}
```

Implement token format:

```ts
lfmcp_v1.{base64url-json-payload}.{base64url-hmac-sha256-signature}
```

Use `CONNECTOR_MCP_AUTH_SECRET` when present. In `development` and `test`, allow fallback to `ENCRYPTION_KEY`. Verification must use `timingSafeEqual`.

- [ ] **Step 4: Write failing bridge service tests**

Create `api/app/src/__tests__/connectors-x-mcp-bridge.test.ts` with service-level tests:

```ts
handleXConnectorMcpRequest without Authorization -> 401
handleXConnectorMcpRequest with invalid lfmcp token -> 401
handleXConnectorMcpRequest initialize + tools/list with purpose=list token -> 200 and includes getUsersByUsername
handleXConnectorMcpRequest initialize + tools/call with purpose=call token and toolName=getUsersMe -> 200
handleXConnectorMcpRequest tools/call with token toolName=getUsersMe and request tool getUsersByUsername -> 401 or MCP auth error
```

Mock DB and token decrypt/refresh so the test never uses real X tokens.

- [ ] **Step 5: Implement the X bridge service**

Create `api/app/src/services/connectors/x-mcp-bridge.ts` exporting:

```ts
export async function handleXConnectorMcpRequest(input: {
  request: Request;
}): Promise<Response>;
```

Implementation requirements:

- Parse `Authorization: Bearer lfmcp_v1...`.
- Parse a cloned request body to derive requested MCP method and tool name.
- Allow `initialize` and `notifications/initialized` for either `purpose`.
- Require `purpose: "list"` for `tools/list`.
- Require `purpose: "call"` and matching `toolName` for `tools/call`.
- Load current connection by `clerkOrgId` and provider `x`.
- Require `connection.id === claims.connectionId`.
- For `tools/list`, register curated X tools without decrypting X tokens.
- For `tools/call`, decrypt and refresh X access tokens server-side, then execute the matching X tool.
- Return `401` for missing or invalid Lightfast MCP bearer tokens.
- Return provider auth failures as MCP tool errors and mark the connector `error` only for terminal X token refresh/auth errors.

Use `@vendor/mcp`:

```ts
const server = new McpServer({
  name: "lightfast-x-connector",
  version: "0.1.0",
});
const transport = new WebStandardStreamableHTTPServerTransport({
  enableJsonResponse: true,
  sessionIdGenerator: undefined,
});
await server.connect(transport);
const response = await transport.handleRequest(input.request, {
  parsedBody,
});
await server.close();
return response;
```

- [ ] **Step 6: Run focused auth and bridge tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-mcp-auth.test.ts
pnpm --filter @api/app test -- src/__tests__/connectors-x-mcp-bridge.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add vendor/mcp/src/index.ts api/app/src/services/connectors/mcp-auth.ts api/app/src/services/connectors/x-mcp-bridge.ts api/app/src/__tests__/connectors-mcp-auth.test.ts api/app/src/__tests__/connectors-x-mcp-bridge.test.ts
git commit -m "feat(connectors): add lightfast mcp bridge auth"
```

---

## Task 7: Implement The X Connector Flow

**Files:**
- Create: `api/app/src/services/connectors/x-flow.ts`
- Modify: `api/app/src/services/connectors/index.ts`
- Test: `api/app/src/__tests__/connectors-flow.test.ts`
- Test: `api/app/src/__tests__/connectors-router.test.ts`

- [ ] **Step 1: Write failing X flow tests**

Add tests for:

```ts
startConnectorOAuth(ctx, { provider: "x" }) returns an X authorize URL
completeXConnectorOAuth exchanges the code, fetches metadata, finalizes an active row with toolManifest []
completeXConnectorOAuth mints a purpose=list MCP token and calls listXBridgeMcpTools
successful discovery updates the manifest and enables automations when at least one runtime-supported tool exists
discovery failure records lastToolRefreshErrorAt and lastToolRefreshErrorCode, keeps status active, keeps automations disabled
metadata failure revokes newly issued tokens and does not persist a connection
refreshXConnectorTools preserves the old manifest on non-auth MCP failure
disconnectXConnector revokes upstream when possible and marks the local row revoked
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts src/__tests__/connectors-router.test.ts
```

Expected: FAIL because `x-flow.ts` and dispatch do not exist.

- [ ] **Step 3: Implement `x-flow.ts`**

Create functions:

```ts
export async function startXConnectorOAuth(ctx: ConnectorServiceContext): Promise<{
  authorizationUrl: string;
  mode: "connect" | "reconnect";
}>;

export async function completeXConnectorOAuth(input: {
  requestUrl: string;
}): Promise<{ redirectUrl: string }>;

export async function refreshXConnectorTools(ctx: ConnectorServiceContext): Promise<{
  refreshed: boolean;
  status: "missing_connection" | "ok";
  toolManifest?: FullConnectorToolManifest;
}>;

export async function setXConnectorAutomationEnabled(
  ctx: ConnectorServiceContext,
  input: { enabled: boolean }
): Promise<{ enabled: boolean }>;

export async function disconnectXConnector(ctx: ConnectorServiceContext): Promise<{
  disconnected: boolean;
}>;

export async function getFreshXConnectorAccessToken(input: {
  connection: OrgConnectorConnection;
  db: Database;
}): Promise<string>;
```

Use the Linear flow as the lifecycle model, with these X-specific differences:

- `X_OAUTH_CALLBACK_PATH`.
- Provider `"x"`.
- Metadata from `getXViewerMetadata`.
- Initial persisted `toolManifest` is `[]` for first connect and the previous manifest for reconnect.
- Initial `enabledForAutomations` is `false`.
- After persistence, mint a purpose-list MCP token and call `listXBridgeMcpTools`.
- On discovery success, call `updateConnectorToolManifestAndAutomationState` with `enabledForAutomations: toolManifest.some(canUseToolForAutomation)`.
- On discovery failure, call `recordConnectorToolRefreshError` with code `X_MCP_FAILED` and redirect with `error=x_tool_discovery_failed`.
- Revoke newly issued tokens only when token exchange or metadata finalization fails before persistence.

- [ ] **Step 4: Update service dispatch**

In `api/app/src/services/connectors/index.ts`, export X flow functions and add switch cases for provider `"x"` in:

```ts
startConnectorOAuth
refreshConnectorTools
setConnectorAutomationEnabled
disconnectConnector
```

- [ ] **Step 5: Run focused API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts src/__tests__/connectors-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/services/connectors/x-flow.ts api/app/src/services/connectors/index.ts api/app/src/__tests__/connectors-flow.test.ts api/app/src/__tests__/connectors-router.test.ts
git commit -m "feat(connectors): add x connector flow"
```

---

## Task 8: Add X Runtime Tool Dispatch

**Files:**
- Modify: `api/app/src/services/connectors/runtime.ts`
- Test: `api/app/src/__tests__/connectors-runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Add tests for:

```ts
loadConnectorRuntimeTools returns Linear and X tools for active automation-enabled connections
loadConnectorRuntimeTools preserves X camelCase runtime names such as x__getUsersByUsername
X runtime calls mint a purpose=call MCP token
X runtime calls callXBridgeMcpTool with the Lightfast MCP token and never pass decrypted X tokens
X runtime calls re-check current connection before calling
X runtime calls reject when the tool is no longer in the current manifest
terminal X auth failures returned by the bridge mark the connector error
```

- [ ] **Step 2: Run focused runtime tests and confirm they fail**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts
```

Expected: FAIL because runtime is Linear-only.

- [ ] **Step 3: Refactor runtime provider dispatch**

In `runtime.ts`:

- Change `ConnectorRuntimeToolSource.provider` to `ConnectableConnectorProvider`.
- Replace `isActiveAutomationLinearConnection` with `isActiveAutomationConnection`.
- Change `safeRuntimeToolName(provider, providerToolName)` to use the connection provider.
- Pass provider into `RuntimeToolCallContext`.
- For Linear, keep `getFreshLinearConnectorAccessToken` and `callLinearMcpTool`.
- For X, mint a purpose-call token:

```ts
const mcpToken = await issueConnectorMcpToken({
  clerkOrgId: context.clerkOrgId,
  connectionId: connection.id,
  provider: "x",
  purpose: "call",
  toolName: context.providerToolName,
});
```

Then call:

```ts
await callXBridgeMcpTool({
  endpoint: connection.mcpEndpoint,
  input: normalizeMcpToolInput(input),
  mcpToken,
  name: context.providerToolName,
});
```

- [ ] **Step 4: Run focused runtime tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/services/connectors/runtime.ts api/app/src/__tests__/connectors-runtime.test.ts
git commit -m "feat(connectors): add x runtime tools"
```

---

## Task 9: Add App Routes, Proxy Rules, And Connectors UI Support

**Files:**
- Create: `apps/app/src/app/(app)/(connectors)/api/connectors/x/oauth/callback/route.ts`
- Create: `apps/app/src/app/(app)/(connectors)/api/connectors/x/mcp/route.ts`
- Modify: `apps/app/src/proxy.ts`
- Test: `apps/app/src/__tests__/proxy.test.ts`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-icons.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`

- [ ] **Step 1: Write failing route and UI tests**

Add tests for:

```ts
GET /api/connectors/x/oauth/callback delegates to completeXConnectorOAuth and redirects
POST /api/connectors/x/mcp delegates to handleXConnectorMcpRequest
proxy treats /api/connectors/x/oauth/callback as public
proxy lets /api/connectors/x/mcp reach the route handler without Clerk browser-session auth
Connectors page renders X card
X Connect button starts startConnect with provider x
missing config copy names X credentials instead of Linear OAuth
X detail sheet opens for ?connector=x
```

- [ ] **Step 2: Run focused app tests and confirm they fail**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/api/connectors/x-mcp-route.test.ts src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/connectors-page.test.tsx
```

Expected: FAIL because routes, proxy rules, and UI support do not exist.

- [ ] **Step 3: Add the X OAuth callback route**

Create `apps/app/src/app/(app)/(connectors)/api/connectors/x/oauth/callback/route.ts`:

```ts
import { completeXConnectorOAuth } from "@api/app/services/connectors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeXConnectorOAuth({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
```

- [ ] **Step 4: Add the X MCP route**

Create `apps/app/src/app/(app)/(connectors)/api/connectors/x/mcp/route.ts`:

```ts
import { handleXConnectorMcpRequest } from "@api/app/services/connectors";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return await handleXConnectorMcpRequest({ request: req });
}

export async function POST(req: Request) {
  return await handleXConnectorMcpRequest({ request: req });
}

export async function DELETE(req: Request) {
  return await handleXConnectorMcpRequest({ request: req });
}
```

- [ ] **Step 5: Update proxy route matching**

In `apps/app/src/proxy.ts`:

- Add `/api/connectors/x/oauth/callback` to `PUBLIC_ROUTE_PATTERNS`.
- Add `/api/connectors/x/mcp(.*)` to the app-owned API route matcher or public route matcher so Clerk does not redirect MCP clients before the route-level bearer auth runs.

- [ ] **Step 6: Update connector icon and connectable provider UI**

In `connector-icons.tsx`, add an `XMark` component and:

```ts
const marks: Record<ConnectorProvider, FC<{ className?: string }>> = {
  linear: LinearMark,
  x: XMark,
};
```

In `connectors-client.tsx`, replace the Linear-only guard with:

```ts
const CONNECTABLE_PROVIDERS = new Set<ConnectorProvider>(["linear", "x"]);

function isConnectableProvider(provider: ConnectorProvider) {
  return CONNECTABLE_PROVIDERS.has(provider);
}
```

Make missing-config text provider-aware:

```ts
function missingConfigMessage(row: ConnectorCatalogRow) {
  if (row.provider === "x") {
    return "X OAuth credentials are not configured.";
  }
  return "Linear OAuth credentials are not configured.";
}
```

- [ ] **Step 7: Run focused app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/api/connectors/x-mcp-route.test.ts src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/connectors-page.test.tsx
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/app/\\(app\\)/\\(connectors\\)/api/connectors/x apps/app/src/proxy.ts apps/app/src/__tests__/proxy.test.ts apps/app/src/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/\\(workspace\\)/connectors/_components apps/app/src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/connectors-page.test.tsx
git commit -m "feat(connectors): add x app routes and ui"
```

---

## Task 10: End-To-End Verification

**Files:**
- No new files unless verification exposes focused fixes.

- [ ] **Step 1: Run provider and emulator tests**

Run:

```bash
pnpm --filter @repo/connector-contract test
pnpm --filter @repo/x-app-node test
pnpm --filter @repo/x-emulator test
```

Expected: PASS.

- [ ] **Step 2: Run API connector tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts src/__tests__/connectors-runtime.test.ts src/__tests__/connectors-mcp-auth.test.ts src/__tests__/connectors-x-mcp-bridge.test.ts src/__tests__/connectors-router.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run app route and UI tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/api/connectors/x-mcp-route.test.ts src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/connectors-page.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run workspace checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Run local dev smoke test**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Expected:

- `@repo/x-emulator` starts.
- `@lightfast/app` receives `X_API_ORIGIN`, `X_OAUTH_ORIGIN`, and app-hosted `X_MCP_ENDPOINT`.
- `https://lightfast.localhost` loads.
- The Connectors page shows X.
- Starting X connect redirects to the emulator OAuth page.
- Completing OAuth returns to `/{slug}/connectors?connector=x`.
- The X connector detail shows read-only tools after bridge discovery.

Stop the dev server before finishing the task.

- [ ] **Step 6: Commit verification fixes**

If verification required fixes, commit them with explicit pathspecs for the files changed and message:

```bash
git commit -m "fix(connectors): verify x mcp connector flow"
```

If no fixes were required, do not create an empty commit.
