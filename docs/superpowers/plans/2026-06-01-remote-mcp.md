# Remote MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Lightfast hosted MCP as a user-connected, organization-bound, OAuth/DCR-backed Vercel service while keeping local MCP API-key compatibility.

**Architecture:** `apps/mcp` is a dedicated MCP resource server and `apps/app` owns the OAuth authorization-server facade, DCR, consent UI, token endpoint, and revocation. `@repo/api-contract` remains the canonical public capability contract, `@repo/mcp-tools` maps API contract procedures to MCP tools through explicit policy, and tRPC/oRPC/MCP share domain services below transport handlers.

**Tech Stack:** Next.js 16 App Router, Vercel Functions, MCP SDK, `mcp-handler` 1.1.0, Clerk, Drizzle/PlanetScale MySQL, `jose`, Zod, Vitest, pnpm/Turborepo, Portless.

---

## Execution Notes

- Run tasks in order. Each task should be a separate commit.
- For schema tasks, load the `planetscale-drizzle` skill during implementation and use `pnpm db:generate`; never hand-write SQL migrations.
- For Next.js route/UI tasks, load `vercel:nextjs` during implementation.
- Keep code changes scoped to the files listed in each task. If a new helper is needed, create it in the same package as the responsibility described here.
- Do not implement deferred follow-ups from the design spec: rate-limit provider, kill switches, introspection, custom URI schemes, SSE, resumable sessions, confidential clients, or full DCR update/delete.

## File Map

### Public Contract and MCP Tooling

- `packages/api-contract/src/mcp.ts`: MCP exposure policy typed against `apiContract`.
- `packages/api-contract/src/index.ts`: export MCP policy and types.
- `packages/api-contract/src/__tests__/mcp.test.ts`: coverage and policy invariants.
- `packages/mcp-tools/package.json`: new first-party MCP tools package.
- `packages/mcp-tools/src/index.ts`: public exports.
- `packages/mcp-tools/src/policy.ts`: policy validation and contract path walking.
- `packages/mcp-tools/src/register.ts`: MCP tool registration from contract + policy.
- `packages/mcp-tools/src/results.ts`: shared result and error formatting.
- `packages/mcp-tools/src/__tests__/*.test.ts`: policy, registration, formatting tests.
- `vendor/mcp/src/index.ts`: pure MCP SDK re-exports only.

### Local MCP

- `core/mcp/src/index.ts`: use `@repo/mcp-tools` registration and API-key executor.
- `core/mcp/src/__tests__/registration.test.ts`: update expectations for policy-derived registration.
- `core/mcp/package.json`: add `@repo/mcp-tools`, keep `@vendor/mcp`.

### Database and App Services

- `db/app/src/schema/tables/mcp-oauth.ts`: MCP OAuth client/grant/token/audit tables.
- `db/app/src/schema/tables/signals.ts`: MCP attribution columns.
- `db/app/src/schema/index.ts`: export new tables and types.
- `db/app/src/utils/mcp-oauth.ts`: repository helpers for OAuth/DCR/grants/tokens/audit.
- `db/app/src/utils/signals.ts`: accept MCP attribution fields where signal writes happen.
- `db/app/src/__tests__/mcp-oauth.test.ts`: DB helper tests.
- `db/app/src/__tests__/signals-list.test.ts` and signal tests: confirm attribution does not break visibility behavior.
- `api/app/src/signals/service.ts`: shared signal operations accepting actor attribution.
- `api/app/src/signals/create-signal.ts`: thin compatibility wrapper or migrated implementation.
- `api/app/src/orpc/router/signals.ts`: call shared signal service with API-key actor.
- `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`: call shared signal service with web actor.

### OAuth Authorization Server

- `api/app/src/mcp-oauth/types.ts`: typed OAuth request/client/grant models.
- `api/app/src/mcp-oauth/clients.ts`: DCR validation and registration service.
- `api/app/src/mcp-oauth/authorization.ts`: authorize request validation, consent decision, authorization code issuance.
- `api/app/src/mcp-oauth/tokens.ts`: JWT signing, JWKS, refresh rotation, revocation.
- `api/app/src/mcp-oauth/grants.ts`: grant lookup/reuse/revocation.
- `api/app/src/mcp-oauth/__tests__/*.test.ts`: service tests.
- `api/app/package.json`: add `jose` if not already present.
- `apps/app/src/app/(app)/(oauth)/oauth/authorize/page.tsx`: consent page.
- `apps/app/src/app/(app)/(oauth)/oauth/authorize/actions.ts`: POST approve/deny actions.
- `apps/app/src/app/(app)/(oauth)/oauth/register/route.ts`: DCR registration route.
- `apps/app/src/app/(app)/(oauth)/oauth/register/[clientId]/route.ts`: DCR read route.
- `apps/app/src/app/(app)/(oauth)/oauth/token/route.ts`: token endpoint.
- `apps/app/src/app/(app)/(oauth)/oauth/jwks/route.ts`: JWKS endpoint.
- `apps/app/src/app/(app)/(oauth)/oauth/revoke/route.ts`: revocation endpoint.
- `apps/app/src/app/(app)/(oauth)/.well-known/oauth-authorization-server/route.ts`: metadata endpoint, or route under the app's existing metadata convention if Next route groups require a different path.

### Hosted MCP App

- `apps/mcp/package.json`: new Next.js app package.
- `apps/mcp/portless.json`: direct `mcp.lightfast` service.
- `apps/mcp/next.config.ts`: shared Next config.
- `apps/mcp/tsconfig.json`: app tsconfig.
- `apps/mcp/src/env.ts`: typed env for MCP resource URL and auth issuer.
- `apps/mcp/src/auth/verify-token.ts`: JWKS/JWT verification.
- `apps/mcp/src/context.ts`: request-scoped MCP context creation.
- `apps/mcp/src/app/mcp/route.ts`: Streamable HTTP MCP route.
- `apps/mcp/src/app/.well-known/oauth-protected-resource/route.ts`: resource metadata.
- `apps/mcp/src/app/api/health/route.ts`: minimal health endpoint.
- `apps/mcp/src/__tests__/*.test.ts`: metadata, auth, route, and tool-call tests.
- `package.json`: include `@lightfast/mcp#dev:next` in root dev command.
- `pnpm-workspace.yaml`: add `mcp-handler` to catalog.

### Settings UI

- `api/app/src/router/(pending-not-allowed)/mcp-connections.ts`: user/org list and revoke procedures.
- `api/app/src/root.ts`: add router.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/mcp/page.tsx`: org admin MCP settings page.
- `apps/app/src/app/(app)/(pending-allowed)/account/mcp/page.tsx`: user MCP settings page, using the app's existing account route conventions.
- Settings components under each page's `_components` folder.

## Task 1: Add MCP Policy to `@repo/api-contract`

**Files:**
- Create: `packages/api-contract/src/mcp.ts`
- Modify: `packages/api-contract/src/index.ts`
- Test: `packages/api-contract/src/__tests__/mcp.test.ts`

- [ ] **Step 1: Write failing policy coverage tests**

Create `packages/api-contract/src/__tests__/mcp.test.ts`:

```ts
import { isContractProcedure } from "@orpc/contract";
import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";
import {
  getContractProcedurePaths,
  lightfastMcpToolPolicy,
  type McpToolPolicyEntry,
} from "../mcp";

describe("lightfastMcpToolPolicy", () => {
  it("declares an MCP policy decision for every public API procedure", () => {
    expect(getContractProcedurePaths(apiContract)).toEqual([
      "signals.create",
      "signals.get",
      "system.health",
    ]);
    expect(Object.keys(lightfastMcpToolPolicy).sort()).toEqual([
      "signals.create",
      "signals.get",
      "system.health",
    ]);
  });

  it("keeps existing MCP tool names stable", () => {
    expect(lightfastMcpToolPolicy["system.health"]).toMatchObject({
      expose: true,
      toolName: "lightfast_system_health",
      scope: "mcp:system:read",
      kind: "read",
      requiresBoundOrg: false,
    } satisfies Partial<McpToolPolicyEntry>);
    expect(lightfastMcpToolPolicy["signals.create"]).toMatchObject({
      expose: true,
      toolName: "lightfast_signals_create",
      scope: "mcp:signals:write",
      kind: "write",
      requiresBoundOrg: true,
    } satisfies Partial<McpToolPolicyEntry>);
    expect(lightfastMcpToolPolicy["signals.get"]).toMatchObject({
      expose: true,
      toolName: "lightfast_signals_get",
      scope: "mcp:signals:read",
      kind: "read",
      requiresBoundOrg: true,
    } satisfies Partial<McpToolPolicyEntry>);
  });

  it("only counts oRPC contract procedures", () => {
    expect(isContractProcedure(apiContract.signals.create)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/mcp.test.ts
```

Expected: FAIL because `../mcp` does not exist.

- [ ] **Step 3: Implement MCP policy sidecar**

Create `packages/api-contract/src/mcp.ts`:

```ts
import { isContractProcedure } from "@orpc/contract";

import type { Contract } from "./contract";

export type McpScope =
  | "mcp:system:read"
  | "mcp:signals:read"
  | "mcp:signals:write";

export interface ExposedMcpToolPolicyEntry {
  auditEventName: string;
  description: string;
  expose: true;
  kind: "read" | "write";
  requiresBoundOrg: boolean;
  scope: McpScope;
  toolName: string;
}

export interface HiddenMcpToolPolicyEntry {
  expose: false;
  reason: string;
}

export type McpToolPolicyEntry =
  | ExposedMcpToolPolicyEntry
  | HiddenMcpToolPolicyEntry;

export type McpToolPolicy = Record<string, McpToolPolicyEntry>;

export function getContractProcedurePaths(
  contract: Record<string, unknown>
): string[] {
  const paths: string[] = [];

  function walk(node: unknown, keyPath: string[]): void {
    if (isContractProcedure(node)) {
      paths.push(keyPath.join("."));
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    for (const key of Object.keys(node as Record<string, unknown>).sort()) {
      walk((node as Record<string, unknown>)[key], [...keyPath, key]);
    }
  }

  walk(contract, []);
  return paths.sort();
}

export const lightfastMcpToolPolicy = {
  "signals.create": {
    auditEventName: "mcp.signals.create",
    description:
      "Create a new Lightfast signal from user-provided text in the selected organization. Use this when the user wants Lightfast to remember, classify, or route a new signal.",
    expose: true,
    kind: "write",
    requiresBoundOrg: true,
    scope: "mcp:signals:write",
    toolName: "lightfast_signals_create",
  },
  "signals.get": {
    auditEventName: "mcp.signals.get",
    description:
      "Get one visible Lightfast signal by id from the selected organization, including current classification status when available.",
    expose: true,
    kind: "read",
    requiresBoundOrg: true,
    scope: "mcp:signals:read",
    toolName: "lightfast_signals_get",
  },
  "system.health": {
    auditEventName: "mcp.system.health",
    description:
      "Check whether the Lightfast MCP connection is authenticated and the service is reachable.",
    expose: true,
    kind: "read",
    requiresBoundOrg: false,
    scope: "mcp:system:read",
    toolName: "lightfast_system_health",
  },
} satisfies McpToolPolicy;

export type LightfastMcpToolPolicy = typeof lightfastMcpToolPolicy;
export type LightfastApiContract = Contract;
```

Modify `packages/api-contract/src/index.ts`:

```ts
export {
  getContractProcedurePaths,
  lightfastMcpToolPolicy,
  type ExposedMcpToolPolicyEntry,
  type HiddenMcpToolPolicyEntry,
  type LightfastMcpToolPolicy,
  type McpScope,
  type McpToolPolicy,
  type McpToolPolicyEntry,
} from "./mcp";
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/mcp.test.ts
pnpm --filter @repo/api-contract typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api-contract/src/mcp.ts packages/api-contract/src/index.ts packages/api-contract/src/__tests__/mcp.test.ts
git commit -m "feat: add mcp tool policy"
```

## Task 2: Create `@repo/mcp-tools` and Make `@vendor/mcp` Pure

**Files:**
- Create: `packages/mcp-tools/package.json`
- Create: `packages/mcp-tools/tsconfig.json`
- Create: `packages/mcp-tools/turbo.json`
- Create: `packages/mcp-tools/vitest.config.ts`
- Create: `packages/mcp-tools/src/index.ts`
- Create: `packages/mcp-tools/src/policy.ts`
- Create: `packages/mcp-tools/src/results.ts`
- Create: `packages/mcp-tools/src/register.ts`
- Create: `packages/mcp-tools/src/__tests__/policy.test.ts`
- Create: `packages/mcp-tools/src/__tests__/results.test.ts`
- Modify: `vendor/mcp/src/index.ts`
- Modify: `vendor/mcp/package.json`

- [ ] **Step 1: Write failing tests for tool policy and results**

Create `packages/mcp-tools/src/__tests__/policy.test.ts`:

```ts
import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { describe, expect, it } from "vitest";

import {
  createLightfastMcpToolDefinitions,
  validateMcpPolicyCoverage,
} from "../policy";

describe("createLightfastMcpToolDefinitions", () => {
  it("creates stable exposed tool definitions from contract policy", () => {
    expect(() =>
      validateMcpPolicyCoverage(apiContract, lightfastMcpToolPolicy)
    ).not.toThrow();

    const tools = createLightfastMcpToolDefinitions({
      contract: apiContract,
      policy: lightfastMcpToolPolicy,
    });

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "lightfast_signals_create",
      "lightfast_signals_get",
      "lightfast_system_health",
    ]);
    expect(tools.find((tool) => tool.name === "lightfast_signals_create"))
      .toMatchObject({
        contractPath: "signals.create",
        requiredScope: "mcp:signals:write",
        kind: "write",
        requiresBoundOrg: true,
      });
  });
});
```

Create `packages/mcp-tools/src/__tests__/results.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatMcpError, formatMcpSuccess } from "../results";

describe("MCP result formatting", () => {
  it("returns structured content for object results", () => {
    expect(formatMcpSuccess({ id: "signal_1", status: "queued" })).toEqual({
      content: [
        {
          text: '{\n  "id": "signal_1",\n  "status": "queued"\n}',
          type: "text",
        },
      ],
      structuredContent: { id: "signal_1", status: "queued" },
    });
  });

  it("wraps primitive results in structuredContent.result", () => {
    expect(formatMcpSuccess("ok")).toEqual({
      content: [{ text: '"ok"', type: "text" }],
      structuredContent: { result: "ok" },
    });
  });

  it("formats errors without leaking stack traces", () => {
    const result = formatMcpError(new Error("Nope"));
    expect(result).toEqual({
      content: [{ text: "Nope", type: "text" }],
      isError: true,
    });
  });
});
```

- [ ] **Step 2: Run the failing package test**

Run:

```bash
pnpm --filter @repo/mcp-tools test
```

Expected: FAIL because `@repo/mcp-tools` does not exist.

- [ ] **Step 3: Add package scaffolding**

Create `packages/mcp-tools/package.json`:

```json
{
  "name": "@repo/mcp-tools",
  "version": "0.1.0",
  "private": true,
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
    "@orpc/contract": "^1.14.2",
    "@repo/api-contract": "workspace:*",
    "@vendor/mcp": "workspace:*",
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

Create `packages/mcp-tools/tsconfig.json`, `turbo.json`, and `vitest.config.ts` by matching the structure used by `packages/api-contract`.

- [ ] **Step 4: Implement policy and result helpers**

Create `packages/mcp-tools/src/policy.ts` with these exported interfaces and functions:

```ts
import {
  type ExposedMcpToolPolicyEntry,
  getContractProcedurePaths,
  type McpToolPolicy,
} from "@repo/api-contract";

export interface LightfastMcpToolDefinition
  extends ExposedMcpToolPolicyEntry {
  contractPath: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  name: string;
}

function getNodeAtPath(root: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((node, segment) => {
    if (!node || typeof node !== "object") {
      return undefined;
    }
    return (node as Record<string, unknown>)[segment];
  }, root);
}

function getOrpcSchemas(node: unknown): {
  inputSchema?: unknown;
  outputSchema?: unknown;
} {
  const def = (
    node as {
      "~orpc"?: {
        inputSchema?: unknown;
        outputSchema?: unknown;
      };
    }
  )["~orpc"];

  return {
    inputSchema: def?.inputSchema,
    outputSchema: def?.outputSchema,
  };
}

export function validateMcpPolicyCoverage(
  contract: Record<string, unknown>,
  policy: McpToolPolicy
): void {
  const paths = getContractProcedurePaths(contract);
  const policyPaths = Object.keys(policy).sort();
  if (JSON.stringify(paths) !== JSON.stringify(policyPaths)) {
    throw new Error(
      `MCP policy coverage mismatch. contract=${paths.join(",")} policy=${policyPaths.join(",")}`
    );
  }
}

export function createLightfastMcpToolDefinitions(input: {
  contract: Record<string, unknown>;
  policy: McpToolPolicy;
}): LightfastMcpToolDefinition[] {
  validateMcpPolicyCoverage(input.contract, input.policy);

  return Object.entries(input.policy)
    .flatMap(([contractPath, entry]) => {
      if (!entry.expose) {
        return [];
      }
      const schemas = getOrpcSchemas(getNodeAtPath(input.contract, contractPath));
      return [
        {
          ...entry,
          ...schemas,
          contractPath,
          name: entry.toolName,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

Create `packages/mcp-tools/src/results.ts`:

```ts
import { parseError } from "@vendor/observability/error/next";

export interface LightfastMcpContent {
  text: string;
  type: "text";
}

export interface LightfastMcpSuccessResult {
  content: LightfastMcpContent[];
  structuredContent: Record<string, unknown>;
}

export interface LightfastMcpErrorResult {
  content: LightfastMcpContent[];
  isError: true;
}

function toStructuredContent(result: unknown): Record<string, unknown> {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}

function stringifyResult(result: unknown): string {
  const json = JSON.stringify(result, null, 2);
  return json ?? String(result);
}

export function formatMcpSuccess(result: unknown): LightfastMcpSuccessResult {
  return {
    content: [{ text: stringifyResult(result), type: "text" }],
    structuredContent: toStructuredContent(result),
  };
}

export function formatMcpError(error: unknown): LightfastMcpErrorResult {
  return {
    content: [{ text: parseError(error), type: "text" }],
    isError: true,
  };
}
```

Create `packages/mcp-tools/src/index.ts`:

```ts
export {
  createLightfastMcpToolDefinitions,
  validateMcpPolicyCoverage,
  type LightfastMcpToolDefinition,
} from "./policy";
export {
  formatMcpError,
  formatMcpSuccess,
  type LightfastMcpErrorResult,
  type LightfastMcpSuccessResult,
} from "./results";
```

- [ ] **Step 5: Move product logic out of `@vendor/mcp`**

Modify `vendor/mcp/src/index.ts` so it only re-exports MCP SDK primitives:

```ts
export { Client } from "@modelcontextprotocol/sdk/client/index.js";
export { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
export { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

Modify `vendor/mcp/package.json` and remove app-specific dependencies:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.29.0"
}
```

- [ ] **Step 6: Run package tests**

Run:

```bash
pnpm install
pnpm --filter @repo/mcp-tools test
pnpm --filter @repo/mcp-tools typecheck
pnpm --filter @vendor/mcp typecheck
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-tools vendor/mcp pnpm-lock.yaml
git commit -m "feat: add lightfast mcp tools package"
```

## Task 3: Register Policy-Derived Tools in Local `core/mcp`

**Files:**
- Modify: `packages/mcp-tools/src/register.ts`
- Modify: `packages/mcp-tools/src/index.ts`
- Modify: `packages/mcp-tools/src/__tests__/policy.test.ts`
- Modify: `core/mcp/src/index.ts`
- Modify: `core/mcp/src/__tests__/registration.test.ts`
- Modify: `core/mcp/package.json`

- [ ] **Step 1: Add registration helper tests**

Extend `packages/mcp-tools/src/__tests__/policy.test.ts`:

```ts
import { McpServer } from "@vendor/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerLightfastMcpTools } from "../register";

it("registers policy-derived tools on an MCP server", async () => {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerLightfastMcpTools(server, {
    contract: apiContract,
    execute: async ({ contractPath }) => ({ contractPath }),
    policy: lightfastMcpToolPolicy,
  });

  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "lightfast_signals_create",
    "lightfast_signals_get",
    "lightfast_system_health",
  ]);

  await client.close();
  await server.close();
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
pnpm --filter @repo/mcp-tools test -- src/__tests__/policy.test.ts
```

Expected: FAIL because `registerLightfastMcpTools` is not exported.

- [ ] **Step 3: Implement `registerLightfastMcpTools`**

Create `packages/mcp-tools/src/register.ts`:

```ts
import type { McpServer } from "@vendor/mcp";

import {
  createLightfastMcpToolDefinitions,
  type LightfastMcpToolDefinition,
} from "./policy";
import { formatMcpError, formatMcpSuccess } from "./results";

export interface LightfastMcpToolExecuteInput {
  contractPath: string;
  input: unknown;
  tool: LightfastMcpToolDefinition;
}

export type LightfastMcpToolExecute = (
  input: LightfastMcpToolExecuteInput
) => Promise<unknown>;

export function registerLightfastMcpTools(
  server: McpServer,
  input: {
    contract: Record<string, unknown>;
    execute: LightfastMcpToolExecute;
    policy: Record<string, { expose: boolean } & Record<string, unknown>>;
  }
): void {
  const tools = createLightfastMcpToolDefinitions({
    contract: input.contract,
    policy: input.policy as never,
  });

  for (const tool of tools) {
    const config: Record<string, unknown> = {
      description: tool.description,
    };
    if (tool.inputSchema) {
      config.inputSchema = tool.inputSchema;
    }
    if (tool.outputSchema) {
      config.outputSchema = tool.outputSchema;
    }

    server.registerTool(
      tool.name,
      config as never,
      (async (...args: unknown[]) => {
        try {
          const callInput = tool.inputSchema ? args[0] : undefined;
          const result = await input.execute({
            contractPath: tool.contractPath,
            input: callInput,
            tool,
          });
          return formatMcpSuccess(result);
        } catch (error) {
          return formatMcpError(error);
        }
      }) as never
    );
  }
}
```

Export it from `packages/mcp-tools/src/index.ts`:

```ts
export {
  registerLightfastMcpTools,
  type LightfastMcpToolExecute,
  type LightfastMcpToolExecuteInput,
} from "./register";
```

- [ ] **Step 4: Update local MCP entrypoint**

Modify `core/mcp/package.json`:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.29.0",
  "@repo/mcp-tools": "workspace:*"
}
```

Keep existing dev dependencies required for build/test.

Modify `core/mcp/src/index.ts`:

```ts
import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { registerLightfastMcpTools } from "@repo/mcp-tools";
import { McpServer, StdioServerTransport } from "@vendor/mcp";
import { createLightfast } from "lightfast";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const baseUrl = process.env.LIGHTFAST_API_URL;

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

const client = createLightfast(apiKey, baseUrl ? { baseUrl } : {});

function getClientProcedure(path: string): (input?: unknown) => Promise<unknown> {
  const procedure = path.split(".").reduce<unknown>((node, segment) => {
    if (!node || typeof node !== "object") {
      return undefined;
    }
    return (node as Record<string, unknown>)[segment];
  }, client);

  if (typeof procedure !== "function") {
    throw new Error(`Missing Lightfast SDK procedure for ${path}`);
  }

  return procedure as (input?: unknown) => Promise<unknown>;
}

registerLightfastMcpTools(server, {
  contract: apiContract,
  policy: lightfastMcpToolPolicy,
  execute: ({ contractPath, input }) => {
    const procedure = getClientProcedure(contractPath);
    return input === undefined ? procedure() : procedure(input);
  },
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});
```

- [ ] **Step 5: Update local MCP tests**

Update `core/mcp/src/__tests__/registration.test.ts` to import from `@repo/mcp-tools` through the entrypoint behavior and assert the same three stable tool names. Keep tests that call `lightfast_signals_create`, `lightfast_signals_get`, and error formatting.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm install
pnpm --filter @repo/mcp-tools test
pnpm --filter @lightfastai/mcp test
pnpm --filter @lightfastai/mcp typecheck
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-tools core/mcp pnpm-lock.yaml
git commit -m "feat: use policy-derived local mcp tools"
```

## Task 4: Add MCP OAuth, Audit, and Signal Attribution Schema

**Files:**
- Create: `db/app/src/schema/tables/mcp-oauth.ts`
- Modify: `db/app/src/schema/tables/signals.ts`
- Modify: `db/app/src/schema/index.ts`
- Create: `db/app/src/utils/mcp-oauth.ts`
- Test: `db/app/src/__tests__/mcp-oauth.test.ts`
- Test: existing signal DB tests

- [ ] **Step 1: Write failing DB helper tests**

Create `db/app/src/__tests__/mcp-oauth.test.ts` using the existing DB test style in `db/app/src/__tests__/signal-views.test.ts`. Cover:

```ts
describe("mcp oauth repositories", () => {
  it("creates and reads an oauth client by public client id", async () => {});
  it("stores redirect uris exactly", async () => {});
  it("creates an org-bound user grant", async () => {});
  it("stores only authorization code hashes", async () => {});
  it("rotates refresh token hashes and marks reuse detection", async () => {});
  it("records redacted audit events", async () => {});
});
```

Use concrete sample values:

```ts
const clientId = "mcp_client_test_123";
const grantId = "mcp_grant_test_123";
const userId = "user_test";
const orgId = "org_test";
const resource = "https://mcp.lightfast.localhost/mcp";
```

- [ ] **Step 2: Run failing DB tests**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/mcp-oauth.test.ts
```

Expected: FAIL because repository helpers and tables do not exist.

- [ ] **Step 3: Add schema tables**

Create `db/app/src/schema/tables/mcp-oauth.ts` with MySQL tables for:

- `mcpOauthClients`
- `mcpOauthClientRedirectUris`
- `mcpOauthRegistrationTokens`
- `mcpOauthAuthorizationCodes`
- `mcpOauthGrants`
- `mcpOauthRefreshTokens`
- `mcpAuditEvents`

Use table names prefixed with `lightfast_mcp_`. Use `bigint` autoincrement primary keys, public ID `varchar` columns, timestamp columns with `fsp: 3`, JSON metadata where needed, and indexes for:

- client public id
- redirect URI by client
- grant by `{ userId, orgId, clientId, resource }`
- active grants by org
- refresh token hash
- audit events by `{ orgId, createdAt }`

Modify `db/app/src/schema/tables/signals.ts`:

```ts
const MCP_CLIENT_ID_LENGTH = 128;
const MCP_GRANT_ID_LENGTH = 128;
```

Add nullable columns:

```ts
createdByMcpClientId: varchar("created_by_mcp_client_id", {
  length: MCP_CLIENT_ID_LENGTH,
}),

createdByMcpGrantId: varchar("created_by_mcp_grant_id", {
  length: MCP_GRANT_ID_LENGTH,
}),
```

Add an index:

```ts
mcpAttributionIdx: index("signals_mcp_attribution_idx").on(
  table.createdByMcpClientId,
  table.createdByMcpGrantId
),
```

- [ ] **Step 4: Export schema and helpers**

Modify `db/app/src/schema/index.ts` to export new tables and types.

Create `db/app/src/utils/mcp-oauth.ts` with repository functions:

```ts
export async function createMcpOauthClient(...)
export async function getMcpOauthClientByClientId(...)
export async function createMcpOauthGrant(...)
export async function getActiveMcpOauthGrant(...)
export async function revokeMcpOauthGrant(...)
export async function createMcpAuthorizationCode(...)
export async function consumeMcpAuthorizationCode(...)
export async function createMcpRefreshToken(...)
export async function rotateMcpRefreshToken(...)
export async function recordMcpAuditEvent(...)
```

Use explicit input/output interfaces in the file. Store hashes, not raw code or refresh token values.

- [ ] **Step 5: Generate migration**

Run:

```bash
pnpm --filter @db/app db:generate
```

Expected: a new generated SQL migration appears under `db/app/src/migrations/`.

- [ ] **Step 6: Run DB tests and typecheck**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/mcp-oauth.test.ts
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @db/app typecheck
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add db/app
git commit -m "feat: add mcp oauth schema"
```

## Task 5: Extract Shared Signal Service Actor Boundary

**Files:**
- Create: `api/app/src/signals/service.ts`
- Modify: `api/app/src/signals/create-signal.ts`
- Modify: `api/app/src/orpc/router/signals.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
- Test: `api/app/src/__tests__/signal-create-service.test.ts`
- Test: `api/app/src/__tests__/signal-orpc.test.ts`
- Test: `api/app/src/__tests__/workspace-signals-router.test.ts`

- [ ] **Step 1: Add failing attribution tests**

Extend `api/app/src/__tests__/signal-create-service.test.ts`:

```ts
it("preserves MCP attribution for MCP-created signals", async () => {
  createSignalMock.mockResolvedValue({
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  });

  await expect(
    createSignalForActor(db, {
      actor: {
        kind: "mcp",
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Create a signal from MCP",
    })
  ).resolves.toEqual({
    id: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "queued",
  });

  expect(createSignalMock).toHaveBeenCalledWith(db, {
    clerkOrgId: "org_test",
    createdByApiKeyId: null,
    createdByMcpClientId: "mcp_client_test",
    createdByMcpGrantId: "mcp_grant_test",
    createdByUserId: "user_test",
    input: "Create a signal from MCP",
    status: "queued",
  });
});
```

- [ ] **Step 2: Run failing service tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts
```

Expected: FAIL because `createSignalForActor` does not exist.

- [ ] **Step 3: Implement shared actor service**

Create `api/app/src/signals/service.ts`:

```ts
import type { Database } from "@db/app";

import {
  createAndQueueSignal,
  type SignalCreateResult,
} from "./create-signal";

export type SignalActor =
  | { kind: "web"; orgId: string; userId: string }
  | { apiKeyId: string; kind: "api_key"; orgId: string; userId: string }
  | {
      clientId: string;
      grantId: string;
      kind: "mcp";
      orgId: string;
      userId: string;
    };

function apiKeyIdForActor(actor: SignalActor): string | null {
  return actor.kind === "api_key" ? actor.apiKeyId : null;
}

function mcpClientIdForActor(actor: SignalActor): string | null {
  return actor.kind === "mcp" ? actor.clientId : null;
}

function mcpGrantIdForActor(actor: SignalActor): string | null {
  return actor.kind === "mcp" ? actor.grantId : null;
}

export async function createSignalForActor(
  db: Database,
  input: {
    actor: SignalActor;
    input: string;
  }
): Promise<SignalCreateResult> {
  return createAndQueueSignal(db, {
    clerkOrgId: input.actor.orgId,
    createdByApiKeyId: apiKeyIdForActor(input.actor),
    createdByMcpClientId: mcpClientIdForActor(input.actor),
    createdByMcpGrantId: mcpGrantIdForActor(input.actor),
    createdByUserId: input.actor.userId,
    input: input.input,
  });
}
```

Modify `api/app/src/signals/create-signal.ts` input type to accept:

```ts
createdByMcpClientId?: string | null;
createdByMcpGrantId?: string | null;
```

Pass those fields through to `createSignal`.

- [ ] **Step 4: Update transports to call shared service**

In `api/app/src/orpc/router/signals.ts`, replace direct `createAndQueueSignal` usage with:

```ts
return await createSignalForActor(db, {
  actor: {
    apiKeyId: context.apiKeyId,
    kind: "api_key",
    orgId: context.auth.identity.orgId,
    userId: context.auth.identity.userId,
  },
  input: createInput.input,
});
```

In `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`, replace direct `createAndQueueSignal` usage with:

```ts
return await createSignalForActor(ctx.db, {
  actor: {
    kind: "web",
    orgId: ctx.auth.identity.orgId,
    userId: ctx.auth.identity.userId,
  },
  input: input.input,
});
```

- [ ] **Step 5: Run API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts
pnpm --filter @api/app test -- src/__tests__/signal-orpc.test.ts
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app
git commit -m "feat: add shared signal actor service"
```

## Task 6: Implement OAuth/DCR Domain Services

**Files:**
- Create: `api/app/src/mcp-oauth/types.ts`
- Create: `api/app/src/mcp-oauth/ids.ts`
- Create: `api/app/src/mcp-oauth/hash.ts`
- Create: `api/app/src/mcp-oauth/clients.ts`
- Create: `api/app/src/mcp-oauth/authorization.ts`
- Create: `api/app/src/mcp-oauth/tokens.ts`
- Create: `api/app/src/mcp-oauth/grants.ts`
- Create: `api/app/src/mcp-oauth/index.ts`
- Create: `api/app/src/mcp-oauth/__tests__/clients.test.ts`
- Create: `api/app/src/mcp-oauth/__tests__/authorization.test.ts`
- Create: `api/app/src/mcp-oauth/__tests__/tokens.test.ts`
- Modify: `api/app/package.json`

- [ ] **Step 1: Add service tests**

Create tests covering these exact behaviors:

```ts
describe("registerMcpOAuthClient", () => {
  it("accepts public PKCE clients with exact https redirect uris", async () => {});
  it("rejects wildcard redirect uris", async () => {});
  it("rejects private metadata urls", async () => {});
});

describe("issueMcpAuthorizationCode", () => {
  it("stores only a code hash and expires in ten minutes", async () => {});
  it("requires a registered redirect uri", async () => {});
});

describe("exchangeMcpAuthorizationCode", () => {
  it("validates PKCE and consumes the code once", async () => {});
  it("rejects a reused code", async () => {});
});

describe("mcp access tokens", () => {
  it("signs an MCP-specific access JWT with audience and grant claims", async () => {});
  it("rejects tokens with the wrong token_use", async () => {});
});

describe("mcp refresh tokens", () => {
  it("rotates opaque refresh tokens", async () => {});
  it("revokes a token family on reuse", async () => {});
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @api/app test -- src/mcp-oauth/__tests__/clients.test.ts src/mcp-oauth/__tests__/authorization.test.ts src/mcp-oauth/__tests__/tokens.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Add `jose` dependency**

Modify `api/app/package.json`:

```json
"jose": "catalog:"
```

- [ ] **Step 4: Implement service modules**

Implement:

- `ids.ts`: `createMcpClientId()`, `createMcpGrantId()`, `createAuthorizationCodeSecret()`, `createRefreshTokenSecret()`, `createRegistrationAccessTokenSecret()`.
- `hash.ts`: SHA-256 base64url hashing for codes and opaque tokens.
- `clients.ts`: validate DCR metadata, create client, create redirect URI rows, create hashed registration token, read client by registration token.
- `authorization.ts`: validate authorize request, compute requested scopes, find reusable grant, issue authorization code, handle deny redirect.
- `grants.ts`: create/reuse grant, revoke grant, list user/org grants for settings.
- `tokens.ts`: sign access JWT with `jose`, publish JWKS, exchange code, rotate refresh token, revoke token.

Use `zod` schemas for external request parsing. Use explicit safe error classes with OAuth error codes:

```ts
export class McpOAuthError extends Error {
  constructor(
    public readonly error: "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client" | "unsupported_grant_type" | "access_denied",
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}
```

- [ ] **Step 5: Run service tests**

Run:

```bash
pnpm install
pnpm --filter @api/app test -- src/mcp-oauth
pnpm --filter @api/app typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app pnpm-lock.yaml
git commit -m "feat: add mcp oauth services"
```

## Task 7: Add OAuth Routes and Consent UI in `apps/app`

**Files:**
- Create route files listed under "OAuth Authorization Server" in the file map.
- Create consent components under `apps/app/src/app/(app)/(oauth)/oauth/authorize/_components/`.
- Test: `apps/app/src/__tests__/app/(app)/(oauth)/mcp-oauth-routes.test.ts`
- Test: `apps/app/src/__tests__/app/(app)/(oauth)/mcp-consent-page.test.tsx`

- [ ] **Step 1: Write route and UI tests**

Route tests assert:

```ts
it("serves authorization server metadata", async () => {});
it("registers a public DCR client", async () => {});
it("returns DCR client metadata with a valid registration access token", async () => {});
it("exchanges an authorization code for MCP tokens", async () => {});
it("revokes a refresh token", async () => {});
```

UI tests assert:

```ts
it("renders client name, signed-in user, organization, redirect uri, and permissions", async () => {});
it("renders an organization selector when multiple organizations are eligible", async () => {});
it("opens a details sheet with raw scopes and client id", async () => {});
it("renders unverified and write warnings on the main screen", async () => {});
it("posts approve through a server action", async () => {});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/'(app)'/'(oauth)'/mcp-oauth-routes.test.ts src/__tests__/app/'(app)'/'(oauth)'/mcp-consent-page.test.tsx
```

Expected: FAIL because route and UI files do not exist.

- [ ] **Step 3: Implement route handlers**

Each route handler should:

- parse request with service schemas
- call `@api/app` MCP OAuth service functions
- return standards-shaped OAuth JSON or redirect responses
- never expose stack traces
- never redirect invalid authorize requests to untrusted redirect URIs

Use `Response.json(...)` and `NextResponse.redirect(...)` consistently with existing app route patterns.

- [ ] **Step 4: Implement consent UI**

Build a minimal standalone page with:

- client icon and Lightfast icon
- title
- signed-in user row
- secondary account switch/sign-out link
- organization selector or fixed row
- redirect URI on main screen
- verification status
- permission summary
- unverified/write warning
- Details sheet
- Cancel and Approve buttons posting through server actions

Keep styling consistent with existing app UI components. Do not add the full workspace shell.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/'(app)'/'(oauth)'/mcp-oauth-routes.test.ts src/__tests__/app/'(app)'/'(oauth)'/mcp-consent-page.test.tsx
pnpm --filter @lightfast/app typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/app api/app
git commit -m "feat: add mcp oauth consent flow"
```

## Task 8: Scaffold `apps/mcp` and Protected Resource Metadata

**Files:**
- Create all files listed under "Hosted MCP App" in the file map.
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Test: `apps/mcp/src/__tests__/metadata.test.ts`
- Test: `apps/mcp/src/__tests__/auth.test.ts`

- [x] **Step 1: Add failing metadata and auth tests**

Create tests asserting:

```ts
it("serves OAuth protected-resource metadata for the MCP resource", async () => {});
it("rejects missing bearer tokens", async () => {});
it("rejects JWTs with the wrong audience", async () => {});
it("rejects JWTs without token_use=mcp_access", async () => {});
it("accepts a valid MCP access JWT", async () => {});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @lightfast/mcp test
```

Expected: FAIL because app package does not exist.

- [x] **Step 3: Add app package and dependency catalog**

Add `mcp-handler` to `pnpm-workspace.yaml` catalog:

```yaml
mcp-handler: ^1.1.0
```

Create `apps/mcp/package.json`:

```json
{
  "name": "@lightfast/mcp",
  "license": "Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "portless": "mcp.lightfast",
  "scripts": {
    "build": "pnpm with-env next build",
    "clean": "git clean -xdf .cache .next .turbo .vercel node_modules",
    "dev:next": "portless run pnpm with-related-projects pnpm with-env next dev",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "with-env": "dotenv -e ./.vercel/.env.development.local --",
    "with-related-projects": "NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) MCP_RESOURCE_URL=$(portless get mcp.lightfast)/mcp MCP_AUTH_ISSUER=$(portless get app.lightfast)"
  },
  "dependencies": {
    "@api/app": "workspace:*",
    "@db/app": "workspace:*",
    "@repo/api-contract": "workspace:*",
    "@repo/mcp-tools": "workspace:*",
    "@sentry/nextjs": "catalog:",
    "@t3-oss/env-nextjs": "catalog:",
    "@vendor/mcp": "workspace:*",
    "@vendor/next": "workspace:*",
    "@vendor/observability": "workspace:*",
    "@vendor/security": "workspace:*",
    "@vercel/related-projects": "catalog:",
    "jose": "catalog:",
    "mcp-handler": "catalog:",
    "next": "catalog:next16",
    "react": "catalog:react19",
    "react-dom": "catalog:react19",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "dotenv-cli": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Create `apps/mcp/portless.json`:

```json
{ "name": "mcp.lightfast" }
```

- [x] **Step 4: Implement metadata and token verification**

Create `apps/mcp/src/app/.well-known/oauth-protected-resource/route.ts` returning:

```json
{
  "resource": "<MCP_RESOURCE_URL>",
  "authorization_servers": ["<MCP_AUTH_ISSUER>"]
}
```

Create `apps/mcp/src/auth/verify-token.ts` with `jose` remote JWKS verification and required claim checks.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm install
pnpm --filter @lightfast/mcp test -- src/__tests__/metadata.test.ts src/__tests__/auth.test.ts
pnpm --filter @lightfast/mcp typecheck
```

Expected: all PASS.

- [x] **Step 6: Commit**

```bash
git add apps/mcp package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: scaffold hosted mcp app"
```

## Task 9: Add Hosted MCP Tool Execution and Audit

**Files:**
- Modify: `apps/mcp/src/app/mcp/route.ts`
- Modify: `apps/mcp/src/context.ts`
- Create: `apps/mcp/src/tools/execute.ts`
- Modify: `api/app/src/mcp-oauth/index.ts`
- Modify: `db/app/src/utils/mcp-oauth.ts`
- Test: `apps/mcp/src/__tests__/tools.test.ts`
- Test: `apps/mcp/src/__tests__/audit.test.ts`

- [ ] **Step 1: Add failing hosted tool tests**

Tests assert:

```ts
it("lists policy-derived tools for an authenticated MCP request", async () => {});
it("creates a signal with MCP actor attribution", async () => {});
it("gets a visible signal for the token org and user", async () => {});
it("rejects signals.create without mcp:signals:write", async () => {});
it("records a redacted audit event for success and failure", async () => {});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @lightfast/mcp test -- src/__tests__/tools.test.ts src/__tests__/audit.test.ts
```

Expected: FAIL because execution code is not implemented.

- [ ] **Step 3: Implement request context**

`apps/mcp/src/context.ts` should return:

```ts
export interface HostedMcpContext {
  clientId: string;
  clientVerificationStatus: "verified" | "unverified" | "blocked";
  grantId: string;
  orgId: string;
  requestId: string;
  scopes: string[];
  userId: string;
}
```

Validate current membership and org gate for bound-org tools by calling exported `@api/app` auth/org helpers.

- [ ] **Step 4: Implement tool executor**

`apps/mcp/src/tools/execute.ts` maps contract paths:

```ts
switch (contractPath) {
  case "system.health":
    return { status: "ok", timestamp: new Date().toISOString(), version };
  case "signals.create":
    return createSignalForActor(db, {
      actor: {
        clientId: context.clientId,
        grantId: context.grantId,
        kind: "mcp",
        orgId: context.orgId,
        userId: context.userId,
      },
      input: parsed.input,
    });
  case "signals.get":
    return getSignalForMcpActor(...);
  default:
    throw new Error(`Unsupported MCP contract path: ${contractPath}`);
}
```

Use API contract schemas for parsing. Do not trust raw MCP inputs.

- [ ] **Step 5: Implement audit wrapper**

Record audit around every tool execution with:

- request id
- user id
- org id
- client id
- grant id
- client verification status
- tool name
- scopes
- success/failure
- latency
- safe error code/message

Do not store raw input/output.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @lightfast/mcp test -- src/__tests__/tools.test.ts src/__tests__/audit.test.ts
pnpm --filter @lightfast/mcp typecheck
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mcp api/app db/app
git commit -m "feat: execute hosted mcp tools"
```

## Task 10: Add MCP Connection Settings and Revocation UI

**Files:**
- Create: `api/app/src/router/(pending-not-allowed)/mcp-connections.ts`
- Modify: `api/app/src/root.ts`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/mcp/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/mcp/_components/mcp-connections-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/mcp/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-allowed)/account/mcp/_components/user-mcp-connections-client.tsx`
- Test: `api/app/src/__tests__/mcp-connections-router.test.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-mcp-page.test.tsx`

- [ ] **Step 1: Add failing router tests**

Tests assert:

```ts
it("lists current user's MCP grants", async () => {});
it("lists org grants for org admins", async () => {});
it("blocks org grant listing for non-admin members", async () => {});
it("revokes a user's own grant", async () => {});
it("allows org admins to revoke an org grant", async () => {});
```

- [ ] **Step 2: Add failing UI tests**

Tests assert:

```ts
it("renders MCP connection summary rows", async () => {});
it("opens technical details in a sheet", async () => {});
it("revokes a grant after confirmation", async () => {});
```

- [ ] **Step 3: Implement tRPC router**

Add procedures under a clear namespace such as:

```ts
account.mcpConnections.list
account.mcpConnections.revoke
org.settings.mcpConnections.list
org.settings.mcpConnections.revoke
```

Use existing user/org/admin procedure patterns. Return display-safe fields only.

- [ ] **Step 4: Implement settings pages**

Main rows show:

- client name
- verified/unverified
- connected user for org admin page
- permission summary
- created at
- best-effort last used at
- revoke action

Details sheet shows:

- client id
- grant id
- raw scopes
- resource
- redirect URI
- client URI/policy URI
- token status summary

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/mcp-connections-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/'(app)'/'(pending-not-allowed)'/'[slug]'/settings-mcp-page.test.tsx
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app apps/app
git commit -m "feat: add mcp connection settings"
```

## Task 11: Wire Dev, Build, and Documentation

**Files:**
- Modify: `package.json`
- Modify: `apps/app/package.json` if OAuth env URLs need MCP references.
- Modify: `apps/mcp/package.json`
- Modify: `AGENTS.md` if local architecture diagram needs `mcp`.
- Modify: `core/mcp/README.md`
- Create or modify docs under `apps/www/src/content` only if public docs already have an MCP page.

- [ ] **Step 1: Update root dev command**

Modify root `package.json` dev script to include `@lightfast/mcp`:

```json
"dev": "portless proxy start && turbo run dev:next @lightfast/app#mfe:proxy //#_inngest //#_qstash //#_github_emulator --concurrency=15 -F @lightfast/www -F @lightfast/app -F @lightfast/platform -F @lightfast/mcp --continue"
```

- [ ] **Step 2: Document local hosted MCP URL**

Update docs to mention:

```text
https://[<wt>.]mcp.lightfast.localhost/mcp
```

Do not add `apps/mcp` to `apps/app/microfrontends.json`.

- [ ] **Step 3: Update local MCP README**

Clarify:

- hosted OAuth MCP is recommended for users
- `@lightfastai/mcp` remains API-key stdio for local/CI/stdin clients
- local and hosted tools are policy-derived and should stay in parity

- [ ] **Step 4: Run workspace checks**

Run:

```bash
pnpm install
pnpm --filter @lightfast/mcp typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @repo/mcp-tools typecheck
pnpm --filter @lightfastai/mcp typecheck
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/mcp apps/app core/mcp docs AGENTS.md pnpm-lock.yaml
git commit -m "chore: wire hosted mcp dev workflow"
```

## Task 12: End-to-End Verification

**Files:**
- Create: `apps/mcp/src/__tests__/e2e-oauth-mcp.test.ts`
- Modify: no shared test setup files during the first pass; add imports and mocks locally inside `apps/mcp/src/__tests__/e2e-oauth-mcp.test.ts`.

- [ ] **Step 1: Add integration smoke tests**

Add a test that exercises:

1. DCR registration.
2. Authorization code creation through service helper.
3. Token exchange.
4. Hosted MCP tool call with access token.
5. Refresh rotation.
6. Revocation prevents refresh.

Use service-level helpers rather than a browser-driven Clerk login. Browser consent was tested in Task 7.

- [ ] **Step 2: Run integration tests**

Run:

```bash
pnpm --filter @lightfast/mcp test -- src/__tests__/e2e-oauth-mcp.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run focused package verification**

Run:

```bash
pnpm --filter @repo/api-contract test
pnpm --filter @repo/mcp-tools test
pnpm --filter @db/app test
pnpm --filter @api/app test
pnpm --filter @lightfast/app test
pnpm --filter @lightfast/mcp test
pnpm --filter @lightfastai/mcp test
```

Expected: all PASS.

- [ ] **Step 4: Run repo verification subset**

Run:

```bash
pnpm verify:orpc
pnpm check
pnpm typecheck
```

Expected: all PASS.

- [ ] **Step 5: Start dev server and smoke metadata**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

In another terminal:

```bash
curl -s "$(portless get mcp.lightfast)/.well-known/oauth-protected-resource"
curl -s "$(portless get mcp.lightfast)/api/health"
```

Expected: protected-resource JSON contains the local MCP resource URL and authorization server; health returns minimal OK JSON.

- [ ] **Step 6: Commit final verification test work**

```bash
git add apps/mcp
git commit -m "test: add hosted mcp integration coverage"
```

## Follow-Up Issue Creation After V1 Merge

Create GitHub issues from the design spec deferred list after the first implementation branch is ready for review. Use one issue per substantial track:

- Rate-limit provider decision and implementation, likely Unkey.
- Dedicated hosted MCP kill switches.
- Confidential OAuth clients.
- Custom URI scheme redirects.
- Full preview OAuth/DCR support.
- Token introspection.
- DCR update/delete.
- Org MCP policies.
- Immediate JWT revocation.
- Stateful/resumable sessions.
- SSE support.
- OAuth stdio bridge.
- Verified-client onboarding.
- MCP resources/prompts.
- Grant editing.

Do not block v1 implementation on those issues.

## Final Verification Checklist

- `apps/mcp` exists as a direct Portless app and is not in the MFE aggregate.
- `core/mcp` still works with `LIGHTFAST_API_KEY`.
- Local and hosted MCP expose the same policy-derived v1 tools.
- OAuth/DCR state is stored in SQL with opaque public IDs.
- Access JWTs are Lightfast-issued and MCP-specific.
- Refresh tokens are opaque, hashed, rotated, and revocable.
- Consent screen shows signed-in user, selected organization, redirect URI, verification status, permission summary, details sheet, and approve/cancel actions.
- User and org admin settings can revoke grants.
- MCP-created signals include user, client, and grant attribution.
- Audit records every MCP tool call without raw inputs or outputs.
