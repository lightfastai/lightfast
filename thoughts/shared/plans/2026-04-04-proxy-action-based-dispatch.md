# Proxy Redesign: Action-Based Dispatch with Resource-Aware Search

## Overview

Replace `proxy.search` + `proxy.execute` (installationId + endpointId + split params) with `proxy.search` + `proxy.call` (action strings + flat params + pre-computed resource params). The search response becomes resource-aware — agents get connected resources with ready-to-use params in a single call, resolved live from provider APIs.

## Current State Analysis

### Public API Surface

- `POST /v1/proxy/search` → returns connections with full endpoint catalogs: `installationId`, `provider`, `status`, `baseUrl`, `endpoints[{endpointId, method, path, description, pathParams?, timeout?}]`
- `POST /v1/proxy/execute` → takes `installationId` + `endpointId` + `pathParams` + `queryParams` + `body` → returns `status` + `data` + `headers`

### Problems

1. **Leaks internal IDs** — `installationId` is an internal concept exposed to agents
2. **Heavy token budget** — ~1,350 tokens for search + execute (baseUrl, HTTP method, path template, status all exposed)
3. **Leaky HTTP abstraction** — agents must understand `pathParams` vs `queryParams` vs `body` split
4. **No resource awareness** — agent must call `github.list-installation-repos` to discover repos, which returns ALL repos the GitHub App can access (10), not just the ones connected to Lightfast (5)
5. **No sync context** — agent doesn't know which event types are configured per resource

### Data Model

```
gatewayInstallations (1 per provider per org)
  └── orgIntegrations (1 per repo/project/team)
       ├── providerResourceId: "567890123" (opaque provider ID)
       ├── providerConfig: { sync: { events: ["pull_request", "issues"] } }
       └── status: "active"
```

Key constraints:
- 1:1 provider connection per org (users cannot add 2 GitHub orgs)
- Different resources under the same connection CAN have different sync events
- Display names are NOT stored — resolved live via provider APIs (`resolveResourceMeta`)
- `providerResourceId` is opaque (GitHub numeric ID, Linear UUID, Vercel project ID)

### Key Discoveries

- `packages/app-validation/src/schemas/api/proxy.ts:5-77` — 5 schemas + 5 types to replace
- `packages/app-api-contract/src/contract.ts:64-89` — contract proxy section (2 procedures)
- `apps/app/src/lib/proxy.ts:26-121` — server logic (`proxySearchLogic` + `proxyExecuteLogic`)
- `apps/app/src/app/(api)/lib/orpc-router.ts:30-81` — router handler bindings
- `core/lightfast/src/index.ts:27-49` — SDK type/schema re-exports
- `packages/app-providers/src/provider/resource-picker.ts:33-61` — `ResourcePickerDef` interface (reusable pattern)
- `api/platform/src/router/memory/proxy.ts:89-243` — platform execute (UNCHANGED — keeps `installationId`-based interface)
- Provider batch-list endpoints already exist: GitHub `list-installation-repos`, Linear GraphQL teams query, Sentry `list-projects`, Vercel `list-projects`

### Confirmed Unchanged (internal proxy layer)

These files use proxy types internally but are **not affected** by the public API redesign:

- `packages/app-providers/src/provider/api.ts:48-61` — Internal `proxyExecuteRequestSchema` / `ProxyExecuteRequest` / `proxyExecuteResponseSchema` / `ProxyExecuteResponse` used by `ResourcePickerExecuteApiFn`. Separate from the public schemas in `app-validation`.
- `packages/app-providers/src/index.ts:53-54, 86-87` — Barrel re-exports of the internal types above. Stay as-is.
- `api/app/src/router/org/connections.ts:220,319,354,667,731` — 5 call sites using `memory.proxy.execute` via `createMemoryCaller()`. These bypass the public API entirely and use `installationId` directly via the platform tRPC caller.

### Dead Code (QoL cleanup in Phase 5)

- `packages/app-providers/src/registry.ts:296-302` — `TypedProxyRequest` type extends `ProxyExecuteRequest`, re-exported via `index.ts:305` but **never imported anywhere**.
- `packages/app-providers/src/contracts/gateway.ts:61-76` — `proxyEndpointsResponseSchema` / `ProxyEndpointsResponse`. Remnant from old gateway microservice, never imported.

## Desired End State

### New Search Response

```json
{
  "connections": [
    {
      "id": "conn_V1StGXR8_Z5jdHi6B",
      "provider": "github",
      "resources": [
        { "name": "acme/web", "params": { "owner": "acme", "repo": "web" }, "syncing": ["pull_request", "issues"] },
        { "name": "acme/api", "params": { "owner": "acme", "repo": "api" }, "syncing": ["pull_request"] }
      ],
      "actions": [
        { "action": "github.list-pull-requests", "params": ["owner", "repo"], "description": "List pull requests for a repository" },
        { "action": "github.list-issues", "params": ["owner", "repo"], "description": "List issues for a repository" },
        { "action": "github.get-file-contents", "params": ["owner", "repo", "path"], "description": "Get file contents from a repository" },
        { "action": "github.get-repo", "params": ["owner", "repo"], "description": "Get repository metadata including default branch" },
        { "action": "github.get-app-installation", "params": ["installation_id"], "description": "Get a GitHub App installation by ID" },
        { "action": "github.list-installation-repos", "description": "List all repositories accessible to the GitHub App installation" }
      ]
    },
    {
      "id": "conn_abc123def456",
      "provider": "linear",
      "resources": [
        { "name": "Engineering", "params": { "teamId": "uuid-abc-123" }, "syncing": ["issue", "comment"] }
      ],
      "actions": [
        { "action": "linear.graphql", "params": ["query"], "description": "Execute a Linear GraphQL query" }
      ]
    },
    {
      "id": "conn_xyz789",
      "provider": "sentry",
      "resources": [
        { "name": "my-app", "params": { "organization_slug": "acme", "project_slug": "my-app" }, "syncing": ["issue", "event"] }
      ],
      "actions": [
        { "action": "sentry.list-org-issues", "params": ["organization_slug"], "description": "List issues for a Sentry organization" },
        { "action": "sentry.list-events", "params": ["organization_slug", "project_slug"], "description": "List events for a Sentry project" },
        { "action": "sentry.list-projects", "description": "List all Sentry projects" },
        { "action": "sentry.list-organizations", "description": "List Sentry organizations" }
      ]
    },
    {
      "id": "conn_vercel123",
      "provider": "vercel",
      "resources": [
        { "name": "my-nextjs-app", "params": { "projectId": "prj_abc" }, "syncing": ["deployment"] }
      ],
      "actions": [
        { "action": "vercel.list-deployments", "description": "List deployments" },
        { "action": "vercel.list-projects", "description": "List Vercel projects" },
        { "action": "vercel.get-team", "params": ["team_id"], "description": "Get Vercel team details" },
        { "action": "vercel.get-user", "description": "Get authenticated Vercel user" }
      ]
    },
    {
      "id": "conn_apollo456",
      "provider": "apollo",
      "resources": [
        { "name": "Apollo Workspace", "params": {} }
      ],
      "actions": [
        { "action": "apollo.search-people", "description": "Search people in Apollo" },
        { "action": "apollo.search-organizations", "description": "Search organizations in Apollo" },
        { "action": "apollo.get-account", "params": ["account_id"], "description": "Get Apollo account details" }
      ]
    }
  ]
}
```

### New Call Request

```ts
// Agent sees resource { name: "acme/web", params: { owner: "acme", repo: "web" } }
// Agent copies resource params + adds extras:
proxy.call({
  action: "github.list-pull-requests",
  params: { owner: "acme", repo: "web", state: "open" }
})
```

### How to Verify

1. `proxy.search` returns connections with live-resolved resource names, pre-computed params, and sync events
2. `proxy.call` accepts `action` + flat `params`, server routes params to path/query/body correctly
3. All 5 providers work: GitHub (repos), Linear (teams), Sentry (projects), Vercel (projects), Apollo (workspace)
4. MCP tools auto-update: `lightfast_proxy_execute` → `lightfast_proxy_call`
5. SDK surface: `lf.proxy.execute()` → `lf.proxy.call()`
6. Token budget: search response ~400-500 tokens (down from ~800)
7. Platform layer unchanged — `memory.proxy.execute` still uses `installationId` internally

## What We're NOT Doing

- **Multi-connection resolution** — 1:1 provider per org by design. No ambiguous connection handling.
- **Stored display names** — resolve live from provider APIs every search call. Accept the latency trade for correctness.
- **Admin/agent endpoint distinction** — all provider endpoints exposed in action catalog. This means agents see `github.get-app-installation` (requires App JWT, `installation_id` param) and `github.list-installation-repos` (lists all accessible repos). These are admin operations agents rarely need if resources are already resolved in search. A future enhancement could add an `internal: true` flag on `ApiEndpoint` to exclude admin-only endpoints from the proxy action catalog while keeping them available for internal use (resource picker, connection management).
- **Optional params in action schema** — only required params (from path template) listed. Optional params discoverable from action descriptions.
- **`proxy.batch`** — fan-out across multiple actions is a future enhancement. Design accommodates it but doesn't implement it.
- **Normalized response shapes** — `proxy.call` returns raw provider responses. No cross-provider normalization.

## Implementation Approach

5 phases, each independently testable. Schemas → Provider extensions → Contract → Server logic → Downstream consumers.

The key architectural decision: each provider defines a `resolveProxyResources` function that batch-lists all resources (1 API call) and returns `{providerResourceId, name, params}[]`. The server filters to connected resources (via `orgIntegrations`) and merges sync events. This reuses the same provider API calls as the existing resource picker.

---

## Phase 1: Schema Definition

### Overview
Replace all proxy Zod schemas with the new action-based shapes.

### Changes Required

#### 1. Proxy Schemas
**File**: `packages/app-validation/src/schemas/api/proxy.ts`
**Changes**: Replace all 5 schemas and 5 types with new definitions.

```typescript
import { z } from "zod";

// --- Proxy Search Response ---

export const ProxyActionSchema = z.object({
  action: z.string().describe("Action identifier (e.g. github.list-pull-requests)"),
  params: z
    .array(z.string())
    .optional()
    .describe("Required parameter names"),
  description: z.string().describe("What this action does"),
});

export const ProxyResourceSchema = z.object({
  name: z.string().describe("Human-readable resource name (e.g. acme/web)"),
  params: z
    .record(z.string(), z.string())
    .describe("Pre-computed params for action calls"),
  syncing: z
    .array(z.string())
    .optional()
    .describe("Event types being synced to Lightfast"),
});

export const ProxyConnectionSchema = z.object({
  id: z.string().describe("Connection ID"),
  provider: z
    .string()
    .describe("Provider name (e.g. github, linear, vercel)"),
  resources: z
    .array(ProxyResourceSchema)
    .describe("Connected resources with pre-computed action params"),
  actions: z
    .array(ProxyActionSchema)
    .describe("Available actions for this provider"),
});

export const ProxySearchResponseSchema = z.object({
  connections: z
    .array(ProxyConnectionSchema)
    .describe("Connected providers with resources and available actions"),
});

// --- Proxy Call ---

export const ProxyCallSchema = z.object({
  action: z
    .string()
    .min(1)
    .describe("Action to execute (e.g. github.list-pull-requests)"),
  params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Action parameters — spread resource params and add extras"),
  connection: z
    .string()
    .optional()
    .describe("Connection ID (optional, for future multi-connection support)"),
});

export const ProxyCallResponseSchema = z.object({
  status: z.number().int().describe("HTTP status code from the provider API"),
  data: z.unknown().describe("Response body from the provider API"),
  headers: z
    .record(z.string(), z.string())
    .describe("Response headers from the provider API"),
});

// --- Types ---

export type ProxyAction = z.infer<typeof ProxyActionSchema>;
export type ProxyResource = z.infer<typeof ProxyResourceSchema>;
export type ProxyConnection = z.infer<typeof ProxyConnectionSchema>;
export type ProxySearchResponse = z.infer<typeof ProxySearchResponseSchema>;
export type ProxyCall = z.infer<typeof ProxyCallSchema>;
export type ProxyCallResponse = z.infer<typeof ProxyCallResponseSchema>;
```

#### 2. Barrel Export
**File**: `packages/app-validation/src/schemas/api/index.ts`
**Changes**: None — uses `export *` from `./proxy`, auto-picks up new exports.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (app-validation passes; downstream consumers break as expected — fixed in Phase 3 + Phase 5)
- [x] Linting passes: `pnpm check`

**Implementation Note**: After completing this phase, verify type checking passes before proceeding. Note: the internal proxy schemas in `packages/app-providers/src/provider/api.ts:48-61` (`proxyExecuteRequestSchema`, `ProxyExecuteRequest`, etc.) are a **separate set** of types used by `ResourcePickerExecuteApiFn` and the platform tRPC layer. Do NOT modify those — only the public API schemas in `app-validation` are being replaced.

---

## Phase 2: Provider Resource Resolver

### Overview
Add a `resolveProxyResources` function to each provider that batch-resolves connected resources with human-readable names and pre-computed action params in a single API call per provider.

### Changes Required

#### 1. Resource Resolver Interface
**File**: `packages/app-providers/src/provider/resource-picker.ts`
**Changes**: Add `ProxyResolvedResource` type and `resolveProxyResources` to `ResourcePickerDef`.

```typescript
// Add type
export interface ProxyResolvedResource {
  /** Provider's stable resource ID (matches orgIntegrations.providerResourceId) */
  providerResourceId: string;
  /** Human-readable display name (e.g. "acme/web", "Engineering") */
  name: string;
  /** Pre-computed params the agent can spread into action calls */
  params: Record<string, string>;
}

// Add to ResourcePickerDef interface
export interface ResourcePickerDef<TConfig = unknown> {
  // ... existing fields ...

  /**
   * Batch-resolve all resources for the proxy search response.
   * Returns providerResourceId + human name + pre-computed action params.
   * The server filters to connected resources (orgIntegrations) after resolution.
   */
  resolveProxyResources: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      id: string;
      externalId: string;
      providerAccountInfo: unknown;
    },
  ) => Promise<ProxyResolvedResource[]>;
}
```

#### 2. GitHub
**File**: `packages/app-providers/src/providers/github/index.ts`
**Changes**: Add `resolveProxyResources` to resourcePicker definition.

```typescript
resolveProxyResources: async (executeApi) => {
  const result = await executeApi({
    endpointId: "list-installation-repos",
    queryParams: { per_page: "100" },
  });
  const parsed = githubInstallationReposSchema.parse(result.data);
  return parsed.repositories.map((r) => {
    const [owner, repo] = (r.full_name ?? r.name).split("/");
    return {
      providerResourceId: String(r.id),
      name: r.full_name ?? r.name,
      params: { owner: owner ?? "", repo: repo ?? r.name },
    };
  });
},
```

#### 3. Linear
**File**: `packages/app-providers/src/providers/linear/index.ts`
**Changes**: Add `resolveProxyResources` to resourcePicker definition.

```typescript
resolveProxyResources: async (executeApi) => {
  const result = await executeApi({
    endpointId: "graphql",
    body: { query: "{ teams { nodes { id name } } }" },
  });
  const parsed = graphqlTeamsResponseSchema.parse(result.data);
  return (parsed.data?.teams?.nodes ?? []).map((t) => ({
    providerResourceId: t.id,
    name: t.name,
    params: { teamId: t.id },
  }));
},
```

#### 4. Sentry
**File**: `packages/app-providers/src/providers/sentry/index.ts`
**Changes**: Add `resolveProxyResources` to resourcePicker definition.

```typescript
resolveProxyResources: async (executeApi) => {
  const orgResult = await executeApi({ endpointId: "list-organizations" });
  const orgs = z.array(sentryOrganizationSchema).parse(orgResult.data);
  const orgSlug = orgs[0]?.slug ?? "";

  const projResult = await executeApi({ endpointId: "list-projects" });
  const projects = z.array(sentryProjectSchema).parse(projResult.data);

  return projects.map((p) => ({
    providerResourceId: p.id,
    name: p.name,
    params: { organization_slug: orgSlug, project_slug: p.slug },
  }));
},
```

#### 5. Vercel
**File**: `packages/app-providers/src/providers/vercel/index.ts`
**Changes**: Add `resolveProxyResources` to resourcePicker definition. Needs installation context to read `team_id` from `providerAccountInfo`.

```typescript
resolveProxyResources: async (executeApi, installation) => {
  const info = installation.providerAccountInfo as
    | { raw?: { team_id?: string } }
    | null;
  const queryParams: Record<string, string> = { limit: "100" };
  if (info?.raw?.team_id) {
    queryParams.teamId = info.raw.team_id;
  }

  const result = await executeApi({
    endpointId: "list-projects",
    queryParams,
  });
  const parsed = vercelProjectsListSchema.parse(result.data);

  return parsed.projects.map((p) => ({
    providerResourceId: String(p.id),
    name: p.name,
    params: { projectId: String(p.id) },
  }));
},
```

#### 6. Apollo
**File**: `packages/app-providers/src/providers/apollo/index.ts`
**Changes**: Add `resolveProxyResources` to resourcePicker definition. Static — no API call needed.

```typescript
resolveProxyResources: async () => [
  {
    providerResourceId: "workspace",
    name: "Apollo Workspace",
    params: {},
  },
],
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] All 5 providers implement `resolveProxyResources` without type errors

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 3: Contract Update

### Overview
Replace `proxy.execute` with `proxy.call` in the oRPC contract. Update input/output schemas and improve descriptions for MCP tool auto-generation.

### Changes Required

#### 1. Contract
**File**: `packages/app-api-contract/src/contract.ts`
**Changes**: Update imports and replace `proxy.execute` with `proxy.call`. Improve descriptions.

```typescript
import {
  ProxyCallSchema,
  ProxyCallResponseSchema,
  ProxySearchResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/app-validation/api";
```

Replace `proxy` section (lines 64-89):

```typescript
proxy: {
  search: oc
    .route({
      method: "POST",
      path: "/v1/proxy/search",
      tags: ["Proxy"],
      summary: "Discover connections and actions",
      description:
        "Discover connected providers, their resources, and available actions. Returns connection IDs, resource names with pre-computed action params, and the full action catalog. Call this first to learn what you can do, then use proxy.call to execute actions.",
    })
    .errors(apiErrors)
    .output(ProxySearchResponseSchema),

  call: oc
    .route({
      method: "POST",
      path: "/v1/proxy/call",
      tags: ["Proxy"],
      summary: "Execute a provider action",
      description:
        "Execute a provider API action. Use action strings from proxy.search (e.g. 'github.list-pull-requests'). Pass a flat params object — resource params from the search response can be spread directly into the call. Auth is handled automatically.",
    })
    .errors(apiErrors)
    .input(ProxyCallSchema)
    .output(ProxyCallResponseSchema),
},
```

#### 2. OpenAPI Spec Regeneration
**File**: `packages/app-api-contract/openapi.json`
**Changes**: Auto-regenerated. Run:

```bash
pnpm --filter @repo/app-api-contract exec tsx scripts/generate.ts
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] OpenAPI spec regenerates cleanly
- [x] `openapi.json` contains `/v1/proxy/call` (not `/v1/proxy/execute`)

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding.

---

## Phase 4: Server Implementation

### Overview
Rewrite `proxySearchLogic` with live resource resolution and pre-computed params. Replace `proxyExecuteLogic` with `proxyCallLogic` that parses action strings and routes flat params. Update router bindings.

### Changes Required

#### 1. Proxy Logic
**File**: `apps/app/src/lib/proxy.ts`
**Changes**: Full rewrite of both functions.

**`proxySearchLogic`** — new flow:
1. Query `gatewayInstallations` (active, for org)
2. Query `orgIntegrations` for each installation (connected resources)
3. For each installation (parallelized):
   a. Get provider definition via `getProvider()`
   b. Create `executeApi` callback via `createMemoryCaller()` bound to the installation
   c. Call `provider.resourcePicker.resolveProxyResources(executeApi, installation)`
   d. Filter returned resources to connected ones (match `providerResourceId` against `orgIntegrations` rows)
   e. Merge `syncing` events from `orgIntegrations.providerConfig.sync.events`
   f. Build `params` on each resource (from resolver output)
   g. Build actions from `provider.api.endpoints` (extract required param names from path templates)
4. Return `{ connections }` with `id: "conn_" + installation.id` per connection

**`proxyCallLogic`** — new flow:
1. Parse `action` → `provider` + `endpointId` (split on first `.`)
2. If `connection` provided: strip `conn_` prefix, validate it belongs to the org
3. If no `connection`: query single active installation for the parsed provider in the org
4. Get provider definition, look up endpoint by `endpointId`
5. Extract path param names from endpoint path template
6. Route flat `params`:
   - Names matching path template → `pathParams`
   - For GET: remaining string values → `queryParams`
   - For POST: remaining values → `body`
7. Call `memory.proxy.execute` with resolved `installationId` + `endpointId` + routed params
8. Return `{ status, data, headers }`

```typescript
import { db } from "@db/app/client";
import { gatewayInstallations, orgIntegrations } from "@db/app/schema";
import { getProvider } from "@repo/app-providers";
import type {
  ProxyCall,
  ProxyCallResponse,
  ProxySearchResponse,
} from "@repo/app-validation/api";
import { createMemoryCaller } from "@repo/platform-trpc/caller";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import type { AuthContext } from "./types";

const CONN_PREFIX = "conn_";

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

export async function proxySearchLogic(
  auth: AuthContext,
  requestId: string,
): Promise<ProxySearchResponse> {
  const installations = await db
    .select()
    .from(gatewayInstallations)
    .where(
      and(
        eq(gatewayInstallations.orgId, auth.clerkOrgId),
        eq(gatewayInstallations.status, "active"),
      ),
    );

  const connections = await Promise.all(
    installations.map(async (inst) => {
      const providerDef = getProvider(inst.provider);
      if (!providerDef) return null;

      // Query connected resources for this installation
      const integrations = await db
        .select()
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.installationId, inst.id),
            eq(orgIntegrations.status, "active"),
          ),
        );

      // Build executeApi callback for this installation
      const memory = await createMemoryCaller();
      const executeApi = async (req: {
        endpointId: string;
        pathParams?: Record<string, string>;
        queryParams?: Record<string, string>;
        body?: unknown;
      }) =>
        memory.proxy.execute({
          installationId: inst.id,
          endpointId: req.endpointId,
          pathParams: req.pathParams,
          queryParams: req.queryParams,
          body: req.body,
        });

      // Resolve all resources (1 batch API call per provider)
      // On failure, fall back to using providerResourceId as the display name
      // so connected resources still appear (with opaque IDs instead of names).
      let resolvedResources: Awaited<
        ReturnType<typeof providerDef.resourcePicker.resolveProxyResources>
      > = [];
      try {
        resolvedResources =
          await providerDef.resourcePicker.resolveProxyResources(executeApi, {
            id: inst.id,
            externalId: inst.externalId,
            providerAccountInfo: inst.providerAccountInfo,
          });
      } catch (err) {
        log.warn("Failed to resolve proxy resources, falling back to IDs", {
          requestId,
          provider: inst.provider,
          error: err instanceof Error ? err.message : String(err),
        });
        // Degraded mode: use orgIntegrations data directly so resources
        // still appear with providerResourceId as name and empty params.
        resolvedResources = integrations.map((i) => ({
          providerResourceId: i.providerResourceId,
          name: i.providerResourceId,
          params: {},
        }));
      }

      // Build a lookup set of connected providerResourceIds
      const connectedSet = new Map(
        integrations.map((i) => [i.providerResourceId, i]),
      );

      // Filter to connected resources and merge sync events
      const resources = resolvedResources
        .filter((r) => connectedSet.has(r.providerResourceId))
        .map((r) => {
          const integration = connectedSet.get(r.providerResourceId);
          const config = integration?.providerConfig as
            | { sync?: { events?: string[] } }
            | null;
          return {
            name: r.name,
            params: r.params,
            ...(config?.sync?.events?.length
              ? { syncing: config.sync.events }
              : {}),
          };
        });

      // Build action catalog from endpoint definitions
      const actions = Object.entries(providerDef.api.endpoints).map(
        ([key, ep]) => {
          const params = extractPathParams(ep.path);
          return {
            action: `${inst.provider}.${key}`,
            ...(params.length > 0 ? { params } : {}),
            description: ep.description,
          };
        },
      );

      return {
        id: `${CONN_PREFIX}${inst.id}`,
        provider: inst.provider,
        resources,
        actions,
      };
    }),
  );

  const filtered = connections.filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  log.info("Proxy search complete", {
    requestId,
    connectionCount: filtered.length,
  });

  return { connections: filtered };
}

export async function proxyCallLogic(
  auth: AuthContext,
  request: ProxyCall,
  requestId: string,
): Promise<ProxyCallResponse> {
  // Parse action → provider + endpointId
  const dotIndex = request.action.indexOf(".");
  if (dotIndex === -1) {
    throw new Error(
      `Invalid action format: "${request.action}". Expected "provider.endpointId"`,
    );
  }
  const providerName = request.action.slice(0, dotIndex);
  const endpointId = request.action.slice(dotIndex + 1);

  // Resolve installation
  let installationId: string;

  if (request.connection) {
    // Validate provided connection
    installationId = request.connection.startsWith(CONN_PREFIX)
      ? request.connection.slice(CONN_PREFIX.length)
      : request.connection;

    const installation = await db.query.gatewayInstallations.findFirst({
      where: and(
        eq(gatewayInstallations.id, installationId),
        eq(gatewayInstallations.orgId, auth.clerkOrgId),
      ),
    });

    if (!installation) {
      throw new Error("Connection not found or access denied");
    }
    if (installation.status !== "active") {
      throw new Error(
        `Connection not active (status: ${installation.status})`,
      );
    }
    if (installation.provider !== providerName) {
      throw new Error(
        `Connection provider mismatch: expected ${providerName}, got ${installation.provider}`,
      );
    }
  } else {
    // Auto-resolve: find single active installation for this provider
    const installations = await db
      .select()
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.orgId, auth.clerkOrgId),
          eq(gatewayInstallations.provider, providerName),
          eq(gatewayInstallations.status, "active"),
        ),
      );

    if (installations.length === 0) {
      throw new Error(`Provider "${providerName}" is not connected`);
    }
    installationId = installations[0]!.id;
  }

  // Validate endpoint exists
  const providerDef = getProvider(providerName);
  if (!providerDef) {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  const endpoint = providerDef.api.endpoints[endpointId];
  if (!endpoint) {
    throw new Error(
      `Unknown action: ${request.action}. Available: ${Object.keys(providerDef.api.endpoints).map((k) => `${providerName}.${k}`).join(", ")}`,
    );
  }

  // Route flat params → pathParams / queryParams / body
  const pathParamNames = new Set(extractPathParams(endpoint.path));
  const flatParams = (request.params ?? {}) as Record<string, unknown>;

  const pathParams: Record<string, string> = {};
  const remaining: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flatParams)) {
    if (pathParamNames.has(key)) {
      pathParams[key] = String(value);
    } else {
      remaining[key] = value;
    }
  }

  let queryParams: Record<string, string> | undefined;
  let body: unknown | undefined;

  if (endpoint.method === "GET") {
    // GET: remaining → query params
    if (Object.keys(remaining).length > 0) {
      queryParams = {};
      for (const [key, value] of Object.entries(remaining)) {
        queryParams[key] = String(value);
      }
    }
  } else {
    // POST: remaining → body
    if (Object.keys(remaining).length > 0) {
      body = remaining;
    }
  }

  // Execute via platform proxy
  const memory = await createMemoryCaller();
  const result = await memory.proxy.execute({
    installationId,
    endpointId,
    pathParams: Object.keys(pathParams).length > 0 ? pathParams : undefined,
    queryParams,
    body,
  });

  log.info("Proxy call complete", {
    requestId,
    action: request.action,
    installationId,
    status: result.status,
  });

  return {
    status: result.status,
    data: result.data,
    headers: result.headers,
  };
}
```

#### 2. Router Bindings
**File**: `apps/app/src/app/(api)/lib/orpc-router.ts`
**Changes**: Replace `proxy.execute` handler with `proxy.call`. Update imports.

```typescript
// Import change
import { proxyCallLogic, proxySearchLogic } from "~/lib/proxy";

// Replace proxy.execute handler (lines 47-80) with:
call: impl.proxy.call.handler(async ({ input, context }) => {
  log.info("Proxy call request (oRPC)", {
    requestId: context.requestId,
    action: input.action,
  });

  try {
    return await proxyCallLogic(
      {
        clerkOrgId: context.clerkOrgId,
        userId: context.userId,
        authType: context.authType,
        apiKeyId: context.apiKeyId,
      },
      input,
      context.requestId,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Proxy call failed";

    if (
      message.includes("not found") ||
      message.includes("access denied")
    ) {
      throw new ORPCError("NOT_FOUND", { message });
    }
    if (
      message.includes("not active") ||
      message.includes("not connected") ||
      message.includes("Invalid action") ||
      message.includes("Unknown") ||
      message.includes("mismatch")
    ) {
      throw new ORPCError("BAD_REQUEST", { message });
    }
    throw error;
  }
}),
```

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] Build succeeds: `pnpm build:app`

#### Manual Verification:
- [ ] `POST /v1/proxy/search` returns connections with live-resolved resource names and params
- [ ] `POST /v1/proxy/call` with `{ action: "github.list-pull-requests", params: { owner: "...", repo: "..." } }` returns PR data
- [ ] Resource params from search response work when spread directly into call params
- [ ] Invalid action returns clear error message
- [ ] Provider not connected returns clear error message

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that proxy.search and proxy.call work end-to-end. Verify that `api/app/src/router/org/connections.ts` (5 internal `memory.proxy.execute` call sites at lines 220, 319, 354, 667, 731) still compiles and works — these bypass the public API and should be unaffected, but confirm.

---

## Phase 5: SDK, OpenAPI, and Documentation

### Overview
Update SDK re-exports, code samples, and documentation to reflect the new API surface.

### Changes Required

#### 1. SDK Re-exports
**File**: `core/lightfast/src/index.ts`
**Changes**: Update type and schema re-exports (lines 27-49).

```typescript
export type {
  ProxyAction,
  ProxyCall,
  ProxyCallResponse,
  ProxyConnection,
  ProxyResource,
  ProxySearchResponse,
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchResult,
} from "@repo/app-validation/api";

export {
  ProxyActionSchema,
  ProxyCallResponseSchema,
  ProxyCallSchema,
  ProxyConnectionSchema,
  ProxyResourceSchema,
  ProxySearchResponseSchema,
  SearchModeSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  SearchResultSchema,
} from "@repo/app-validation/api";
```

#### 2. Code Samples
**File**: `apps/www/src/app/(app)/(content)/_lib/code-samples.ts`
**Changes**: Update `OperationId` union and SDK/MCP samples.

- Line 15: `"proxy.execute"` → `"proxy.call"`
- Lines 32-41: Update `proxy.search` sample to show new response shape (resources + params)
- Lines 43-55: Rewrite `proxy.execute` sample as `proxy.call` with action + flat params

```typescript
type OperationId = "search" | "proxy.search" | "proxy.call";

// proxy.search sample
"proxy.search": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const { connections } = await client.proxySearch();

for (const conn of connections) {
  console.log(conn.provider);    // e.g., "github"
  console.log(conn.resources);   // Connected repos/projects with params
  console.log(conn.actions);     // Available actions
}`,

// proxy.call sample
"proxy.call": `import { Lightfast } from "lightfast";

const client = new Lightfast({ apiKey: "sk-lf-..." });

const result = await client.proxyCall({
  action: "github.list-pull-requests",
  params: { owner: "acme", repo: "web", state: "open" },
});

console.log(result.data);    // Raw provider API response
console.log(result.status);  // HTTP status code`,
```

Add MCP sample:

```typescript
const mcpSamples: Partial<Record<OperationId, string>> = {
  search: `...`, // existing
  "proxy.call": `{
  "name": "lightfast_proxy_call",
  "arguments": {
    "action": "github.list-pull-requests",
    "params": { "owner": "acme", "repo": "web", "state": "open" }
  }
}`,
};
```

#### 3. SDK Reference Docs
**File**: `apps/www/src/content/api/sdks-tools/typescript-sdk.mdx`
**Changes**:
- Lines 96-113: Rewrite `proxySearch()` section with new response shape (connections with resources + actions)
- Lines 117-148: `proxyExecute()` → `proxyCall()` section with new input (action + params + connection?)
- Lines 177-197: Update type exports list

#### 4. SDK Tutorial Docs
**File**: `apps/www/src/content/docs/integrate/sdk.mdx`
**Changes**:
- Lines 169-181: Update type exports block — replace `ProxyExecuteInput`, `ProxyExecuteResponse` with `ProxyCall`, `ProxyCallResponse`, `ProxyAction`, `ProxyResource`
- **Note**: The existing docs reference `ProxyExecuteInput` which is a pre-existing bug — the actual TypeScript type is `ProxyExecuteRequest`. Fix this while rewriting.

#### 5. Dead Code Cleanup (QoL)
**File**: `packages/app-providers/src/registry.ts`
**Changes**: Delete `TypedProxyRequest` type (lines 296-302). Never imported anywhere.

**File**: `packages/app-providers/src/index.ts`
**Changes**: Remove re-export of `TypedProxyRequest` (line 305).

**File**: `packages/app-providers/src/contracts/gateway.ts`
**Changes**: Delete `proxyEndpointsResponseSchema` and `ProxyEndpointsResponse` (lines 61-76). Remnant from old gateway service, never imported.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] OpenAPI spec contains `/v1/proxy/call` path and new schemas
- [x] Build succeeds: `pnpm build:app`
- [x] No references to `TypedProxyRequest` or `ProxyEndpointsResponse` remain: `grep -r "TypedProxyRequest\|ProxyEndpointsResponse" packages/`

#### Manual Verification:
- [ ] SDK: `lf.proxy.call({ action: "github.list-pull-requests", params: { owner, repo } })` works
- [ ] MCP: `lightfast_proxy_call` tool registered with correct description and input schema
- [ ] API reference docs render correctly with new proxy sections
- [ ] Code samples in API reference show correct new syntax

---

## Testing Strategy

### Integration Tests
- `proxy.search` returns live-resolved resource names matching connected orgIntegrations
- `proxy.search` filters out resources not in orgIntegrations (e.g., returns 5 of 10 GitHub repos)
- `proxy.search` includes sync events per resource from providerConfig
- `proxy.call` with valid action + params returns provider data
- `proxy.call` with invalid action format returns 400
- `proxy.call` with unknown provider returns 400 "not connected"
- `proxy.call` with unknown endpoint returns 400 with available actions
- `proxy.call` routes path params correctly (extracted from path template)
- `proxy.call` routes remaining params to queryParams (GET) / body (POST)
- Connection prefix stripping: `conn_abc123` → looks up `abc123`

### Manual Testing Steps
1. Connect a GitHub App with access to N repos, add M < N as sources
2. Call `proxy.search` — verify only M repos appear with correct `owner/repo` params
3. Copy resource params from search response, spread into `proxy.call` — verify it works
4. Call `proxy.call` with an action for an unconnected provider — verify clear error
5. Test with Linear, Sentry, Vercel connections to verify cross-provider param shapes

## Performance Considerations

- **proxy.search latency**: 1 batch API call per provider connection (parallelized) + DB queries. For 4 providers: ~200-500ms total depending on provider API response times. Acceptable for a call made once per agent conversation. On failure, degraded mode returns resources with opaque IDs (no round-trip wasted).
- **proxy.call latency**: 1 DB query (installation lookup) + 1 platform proxy call. Same as current `proxy.execute` — no regression.
- **Token budget**: Search response ~400-500 tokens (down from ~800). Call request ~100-150 tokens (down from ~200). Total savings: ~50% reduction.
- **Pagination limitation**: GitHub resolver uses `per_page: 100`, Sentry and Vercel have similar defaults. Orgs with >100 repos/projects will see truncated resource lists. Acceptable for now (most orgs have <100 connected resources). If this becomes a problem, resolvers can paginate or the search response can include a `truncated: true` flag.

## Migration Notes

- **Breaking change**: `proxy.execute` → `proxy.call` with different input shape. SDK consumers must update.
- **MCP auto-migration**: `lightfast_proxy_execute` tool automatically becomes `lightfast_proxy_call` — MCP clients that discover tools dynamically will pick this up.
- **Platform layer unchanged**: `memory.proxy.execute` (internal tRPC) keeps its `installationId`-based interface. Only the public API surface changes.

## References

- Design document: `thoughts/shared/research/2026-04-04-proxy-schema-blast-radius.md`
- Implementation blast radius: `thoughts/shared/research/2026-04-04-proxy-call-implementation-blast-radius.md`
- Provider definitions: `packages/app-providers/src/providers/*/index.ts`
- Resource picker interface: `packages/app-providers/src/provider/resource-picker.ts:33-61`
- Platform proxy router: `api/platform/src/router/memory/proxy.ts:89-243` (unchanged)
- MCP contract walker: `vendor/mcp/src/index.ts:36-119` (unchanged, auto-propagates)

## Update Log

### 2026-04-04 — Verification pass: missing consumers, dead code cleanup, resilience fixes
- **Trigger**: Cross-referencing plan against full codebase grep for all proxy type consumers
- **Changes**:
  - Added "Confirmed Unchanged" section to Key Discoveries — documents 3 internal files (`app-providers/provider/api.ts`, `app-providers/index.ts`, `connections.ts`) that use proxy types but are unaffected by the redesign
  - Added "Dead Code" section to Key Discoveries — identifies `TypedProxyRequest` and `proxyEndpointsResponseSchema` as unused exports
  - Phase 1: Added implementation note clarifying the two-layer schema situation (public `app-validation` vs internal `app-providers/provider/api.ts`)
  - Phase 4: Added degraded-mode fallback in `proxySearchLogic` — when `resolveProxyResources` fails, falls back to `providerResourceId` as display name instead of silently dropping all resources
  - Phase 4: Added note to verify `connections.ts` internal consumers still compile after changes
  - Phase 5: Added QoL cleanup sub-section — delete dead `TypedProxyRequest`, `proxyEndpointsResponseSchema`/`ProxyEndpointsResponse`; fix pre-existing `ProxyExecuteInput` doc bug (should be `ProxyExecuteRequest`)
  - "What We're NOT Doing": Expanded admin/agent endpoint distinction with concrete examples and future enhancement path
  - Performance Considerations: Added pagination limitation note for resolvers with >100 resources
- **Impact on remaining work**: No new phases. Phase 5 gains ~15min of dead code cleanup. Phase 4 gains a small fallback code block. All other phases unchanged.
