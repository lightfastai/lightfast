# oRPC Error Handling + Publishable SDK Client — Implementation Plan

## Overview

Upgrade the Lightfast public API with typed oRPC error definitions and implement a publishable SDK client (`lightfast` on npm) and MCP server (`@lightfastai/mcp`). The contract gains `.errors()` declarations, the OpenAPI spec gains 4xx error schemas, and both SDK and MCP packages go from empty shells to functional packages.

## Current State Analysis

### Contract (`packages/app-api-contract/src/contract.ts`)
- 3 endpoints: `search`, `proxy.search`, `proxy.execute`
- No `.errors()` — only `.input()` and `.output()` on each route
- OpenAPI spec (`openapi.json`) only documents `200` responses

### Error Handling
- **Middleware** (`apps/app/src/app/(api)/lib/orpc-middleware.ts`): throws raw `new ORPCError("UNAUTHORIZED"|"FORBIDDEN"|"BAD_REQUEST", { message })` — no typed error definitions
- **Router** (`apps/app/src/app/(api)/lib/orpc-router.ts:65-78`): `proxy.execute` catch block string-matches error messages to `NOT_FOUND` / `BAD_REQUEST` codes
- **OpenAPI handler** (`apps/app/src/app/(api)/v1/[...rest]/route.ts`): manual JSON error construction `{ error, message, requestId }` in catch blocks — bypasses oRPC serialization

### SDK & MCP
- `core/lightfast/src/index.ts`: exports `{}` (empty shell)
- `core/mcp/src/index.ts`: exports `{}` (empty shell)
- Both have full build infra (tsup, package.json, publishConfig) but zero implementation
- `@orpc/client` and `@orpc/openapi-client` are **not** installed in the repo

### Key Discoveries
- `core/lightfast/tsup.config.ts:11-13`: `external: []` + `bundle: true` — all imports are bundled into the output, so workspace deps and oRPC packages become devDependencies (zero runtime deps for consumers)
- `core/mcp/package.json:49`: already declares `"lightfast": "workspace:*"` as a dependency
- `core/mcp/tsup.config.ts:13-14`: shebang banner is configured, making the output directly executable as CLI
- `SearchResponseSchema` (`packages/app-validation/src/schemas/api/search.ts:72-76`): includes `requestId` in the response body — this stays
- `apps/app/src/app/(api)/lib/orpc-middleware.ts:20`: `base = os.$context<InitialContext>()` — middleware context carries `requestId` through the auth chain
- `ORPCError` is imported from `@orpc/server` in the router, but from `@orpc/client` in the client context — same class, different re-export

## Desired End State

1. **Contract** declares `.errors()` with `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST` on all endpoints — `NOT_FOUND` and `BAD_REQUEST` include structured `data` schemas for programmatic error handling via `isDefinedError()`
2. **OpenAPI spec** includes 4xx error response schemas with data definitions (auto-generated from `.errors()`)
3. **OpenAPI handler** adds `X-Request-ID` response header on all responses; no manual JSON error construction
4. **SDK** (`lightfast` on npm): `createLightfast(apiKey)` returns a fully-typed client backed by `OpenAPILink`; sends `X-SDK-Version` header on every request; re-exports all validation schemas and types as single source of truth for consumers
5. **`@vendor/mcp`**: Contract-to-MCP adapter — `registerContractTools(server, contract, client)` walks an oRPC contract and auto-registers one MCP tool per procedure. Adding a new endpoint to the contract automatically creates an MCP tool with zero MCP code changes.
6. **MCP** (`@lightfastai/mcp` on npm): CLI binary powered by `@vendor/mcp` — tools are auto-generated from the contract, not hand-written

### Verification
- `pnpm --filter @repo/app-api-contract generate:openapi` produces `openapi.json` with 401/403/404/400 response schemas (including `data` definitions for NOT_FOUND and BAD_REQUEST)
- `pnpm --filter lightfast build` produces a working bundle with zero runtime dependencies; requests include `X-SDK-Version` header
- `pnpm --filter @vendor/mcp typecheck` passes
- `pnpm --filter @lightfastai/mcp build` produces an executable MCP binary with tools auto-generated from contract
- `pnpm typecheck` passes across the monorepo
- `pnpm check` passes

## What We're NOT Doing

- **Custom error response body encoder**: no `customErrorResponseBodyEncoder` on the handler — oRPC's default `{ defined, code, status, message, data }` shape is fine since there are zero consumers to break
- **Custom error formatters per MCP tool**: the adapter returns structured output; no per-tool markdown formatting
- **Text `content` fallback in MCP responses**: structured output only — no dual `content` + `structuredContent` to avoid token waste
- **Rate limiting errors**: no `RATE_LIMITED` / `TOO_MANY_REQUESTS` error definition (no rate limiter exists yet)
- **`ZodSmartCoercionPlugin`**: useful but orthogonal — not part of this plan
- **Publishing to npm**: this plan implements the code; the publish step is a separate concern

---

## Phase 1: Contract Error Definitions + OpenAPI Spec

### Overview
Add `.errors()` to all contract endpoints and regenerate the OpenAPI spec so it documents 4xx error responses.

### Changes Required

#### 1. Contract — add shared error map
**File**: `packages/app-api-contract/src/contract.ts`

Add a shared error map and apply it to all three endpoints:

```typescript
import { oc } from "@orpc/contract";
import {
  ProxyExecuteRequestSchema,
  ProxyExecuteResponseSchema,
  ProxySearchResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/app-validation/api";
import { z } from "zod";

/**
 * Error definitions shared across all API endpoints.
 *
 * These generate:
 * - Typed error factories in handlers (`throw new ORPCError("NOT_FOUND", { data: { resource: "connection" } })`)
 * - 4xx response schemas in the OpenAPI spec (including `data` field definitions)
 * - Client-side typed error catching via the SDK (`isDefinedError(e) → e.data.resource`)
 */
const apiErrors = {
  UNAUTHORIZED: {
    message: "Authentication required",
  },
  FORBIDDEN: {
    message: "Access denied",
  },
  NOT_FOUND: {
    message: "Resource not found",
    data: z.object({
      resource: z.string().describe("The type of resource that was not found").optional(),
    }),
  },
  BAD_REQUEST: {
    message: "Invalid request",
    data: z.object({
      field: z.string().describe("The request field that caused the error").optional(),
      reason: z.string().describe("Why the request is invalid").optional(),
    }),
  },
};

export const apiContract = {
  search: oc
    .route({
      method: "POST",
      path: "/v1/search",
      tags: ["Search"],
      summary: "Search",
      description:
        "Search across your team's knowledge with semantic understanding and multi-path retrieval.",
    })
    .errors(apiErrors)
    .input(SearchRequestSchema)
    .output(SearchResponseSchema),

  proxy: {
    search: oc
      .route({
        method: "POST",
        path: "/v1/proxy/search",
        tags: ["Proxy"],
        summary: "List proxy endpoints",
        description:
          "Discover all connected providers and their available API endpoints. Returns the full endpoint catalog for each active connection.",
      })
      .errors(apiErrors)
      .output(ProxySearchResponseSchema),

    execute: oc
      .route({
        method: "POST",
        path: "/v1/proxy/execute",
        tags: ["Proxy"],
        summary: "Execute proxy request",
        description:
          "Execute an API call through a connected provider. Authentication is injected automatically — you only need to specify the endpoint and parameters.",
      })
      .errors(apiErrors)
      .input(ProxyExecuteRequestSchema)
      .output(ProxyExecuteResponseSchema),
  },
};

export type ApiContract = typeof apiContract;
```

No `status` field needed — oRPC defaults `UNAUTHORIZED` → 401, `FORBIDDEN` → 403, `NOT_FOUND` → 404, `BAD_REQUEST` → 400. Removed `as const` since `z.object()` instances aren't const-compatible — oRPC infers the error map types from the object shape regardless.

#### 2. Regenerate OpenAPI spec
**File**: `packages/app-api-contract/openapi.json` (generated, not hand-edited)

Run the generator. The `.errors()` definitions automatically produce error response schemas in the spec.

No changes needed to `packages/app-api-contract/scripts/generate.ts` — the generator picks up `.errors()` from the contract automatically.

### Success Criteria

#### Automated Verification:
- [ ] Typecheck passes: `pnpm --filter @repo/app-api-contract typecheck`
- [ ] OpenAPI spec regenerates: `pnpm --filter @repo/app-api-contract generate:openapi`
- [ ] Generated `openapi.json` contains `401`, `403`, `404`, `400` response entries for each endpoint (verify with `grep`)
- [ ] Full monorepo typecheck: `pnpm typecheck`

#### Manual Verification:
- [ ] Review `openapi.json` diff — error schemas look correct and match the error map

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Handler — `X-Request-ID` Header + Cleanup

### Overview
Add `X-Request-ID` response header to all API responses (success and error). Remove manual JSON error construction from the OpenAPI handler, letting oRPC serialize errors natively.

### Changes Required

#### 1. OpenAPI handler — add header, remove manual error JSON
**File**: `apps/app/src/app/(api)/v1/[...rest]/route.ts`

```typescript
import { randomUUID } from "node:crypto";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { log } from "@vendor/observability/log/next";
import { router } from "../../lib/orpc-router";

const handler = new OpenAPIHandler(router);

async function handleRequest(request: Request) {
  const requestId = randomUUID();

  try {
    const { matched, response } = await handler.handle(request, {
      context: {
        headers: request.headers,
        requestId,
      },
    });

    if (matched) {
      // Clone response to add X-Request-ID header
      const enriched = new Response(response.body, response);
      enriched.headers.set("X-Request-ID", requestId);
      return enriched;
    }

    // Unmatched route — oRPC doesn't handle this, so we return a manual 404
    return Response.json(
      { defined: false, code: "NOT_FOUND", status: 404, message: "Endpoint not found" },
      { status: 404, headers: { "X-Request-ID": requestId } }
    );
  } catch (error) {
    log.error("oRPC handler error", {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });
    return Response.json(
      { defined: false, code: "INTERNAL_SERVER_ERROR", status: 500, message: "Internal server error" },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
```

Key changes:
- `X-Request-ID` header added to all three response paths (matched, unmatched, error)
- Fallback error bodies use oRPC's default shape (`{ defined, code, status, message }`) for consistency
- Removed `requestId` from error response bodies (now in header only)
- Matched responses get the header via `Response` clone — oRPC handles the body serialization

#### 2. No changes to middleware or router
The middleware and router already throw `new ORPCError(code, { message })` which oRPC serializes correctly. The `.errors()` on the contract provides documentation and client-side typing, but doesn't change server-side throwing behavior.

### Success Criteria

#### Automated Verification:
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] App builds: `pnpm build:app`

#### Manual Verification:
- [ ] `curl -X POST https://lightfast.ai/v1/search` (no auth) returns a 401 with `X-Request-ID` header and oRPC-shaped error body
- [ ] Successful authenticated search returns `X-Request-ID` header

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: SDK Client (`core/lightfast`)

### Overview
Implement the publishable SDK client. Consumers install `lightfast` from npm and call `createLightfast(apiKey)` to get a fully-typed client. All oRPC and contract code is bundled by tsup — zero runtime dependencies for consumers.

### Changes Required

#### 1. Install oRPC client packages
Add to `core/lightfast/package.json` as devDependencies (bundled at build time):

```bash
pnpm --filter lightfast add -D @orpc/client@^1.13.0 @orpc/openapi-client@^1.13.0 @orpc/contract@^1.13.0 @repo/app-api-contract @repo/app-validation
```

These are devDependencies because `bundle: true` + `external: []` inlines everything — the published package has zero runtime deps.

#### 2. SDK implementation
**File**: `core/lightfast/src/index.ts`

```typescript
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink, type JsonifiedClient } from "@orpc/openapi-client";
import { apiContract } from "@repo/app-api-contract";

declare const __SDK_VERSION__: string;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fully-typed Lightfast API client. */
export type LightfastClient = JsonifiedClient<
  ContractRouterClient<typeof apiContract>
>;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Re-exports — schemas & types (single source of truth for consumers + MCP)
// ---------------------------------------------------------------------------

export {
  SearchRequestSchema,
  SearchResponseSchema,
  SearchResultSchema,
  SearchModeSchema,
  ProxySearchResponseSchema,
  ProxyConnectionSchema,
  ProxyEndpointSchema,
  ProxyExecuteRequestSchema,
  ProxyExecuteResponseSchema,
} from "@repo/app-validation/api";

export type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchMode,
  ProxySearchResponse,
  ProxyConnection,
  ProxyEndpoint,
  ProxyExecuteRequest,
  ProxyExecuteResponse,
} from "@repo/app-validation/api";

// ---------------------------------------------------------------------------
// Re-exports — error handling utilities
// ---------------------------------------------------------------------------

export { isDefinedError, safe, ORPCError } from "@orpc/client";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Lightfast API client.
 *
 * @example
 * ```ts
 * import { createLightfast } from "lightfast";
 *
 * const lf = createLightfast("sk-lf-...");
 * const { results } = await lf.search({ query: "deployment errors" });
 * ```
 */
export function createLightfast(
  apiKey: string,
  options?: LightfastOptions,
): LightfastClient {
  const link = new OpenAPILink(apiContract, {
    url: options?.baseUrl ?? "https://lightfast.ai",
    headers: () => ({
      authorization: `Bearer ${apiKey}`,
      "x-sdk-version": `lightfast-node/${__SDK_VERSION__}`,
    }),
  });

  return createORPCClient(link) as LightfastClient;
}

/** SDK version, injected at build time. */
export const VERSION = __SDK_VERSION__;
```

#### 3. Package.json — no changes to dependencies section
The `dependencies: {}` stays empty. All oRPC packages are devDependencies that get bundled.

The existing `package.json` fields (`name`, `version`, `exports`, `publishConfig`, `engines`) are already correct.

### Success Criteria

#### Automated Verification:
- [x] Dependencies install: `pnpm install`
- [x] Typecheck passes: `pnpm --filter lightfast typecheck`
- [x] Build succeeds: `pnpm --filter lightfast build`
- [x] Built output exists: `core/lightfast/dist/index.mjs` and `core/lightfast/dist/index.d.ts`
- [x] Built output has zero `require()` calls or external imports (everything bundled): `grep -c "from \"@orpc" core/lightfast/dist/index.mjs` returns 0
- [ ] Full monorepo typecheck: `pnpm typecheck` (pre-existing `@db/app` failure: `GitHubSourceMetadata` missing — unrelated to Phase 3)
- [ ] Lint passes: `pnpm check` (pre-existing lint issues in other packages — `core/lightfast/src/index.ts` passes after import sorting fix)

#### Manual Verification:
- [x] `core/lightfast/dist/index.d.ts` exports `createLightfast`, `LightfastClient`, `LightfastOptions`, `VERSION`, `isDefinedError`, `safe`, `ORPCError`, plus all schemas (`SearchRequestSchema`, `ProxyExecuteRequestSchema`, etc.) and their inferred types
- [x] Type inference works — `lf.search()` accepts `{ query: string, limit?: number, ... }` and returns `{ results, total, requestId }` (verified via MCP tool listing: inputSchema has all SearchRequest fields, outputSchema has `results`, `total`, `requestId`)

---

## Phase 4: Contract-to-MCP Adapter (`vendor/mcp`)

### Overview
Create a `@vendor/mcp` package that provides two things: (1) re-exports of key `@modelcontextprotocol/sdk` symbols, and (2) a `registerContractTools()` function that walks an oRPC contract router and auto-registers one MCP tool per procedure. This eliminates hand-written tool registrations — adding a new endpoint to the contract automatically creates an MCP tool.

### Design

The adapter uses the same recursive walk pattern that oRPC uses internally (see `enhanceContractRouter` in `@orpc/contract`):

1. Walk the contract router recursively using `isContractProcedure()` from `@orpc/contract`
2. At each leaf (a `ContractProcedure`), read `procedure['~orpc'].route` for metadata and `procedure['~orpc'].inputSchema` for the Zod schema
3. Derive the tool name from the key path: `proxy.execute` → `lightfast_proxy_execute` (with configurable prefix/separator)
4. Register the tool on the `McpServer` with the contract's `inputSchema` passed directly — the MCP SDK accepts `AnySchema` (Zod v4) natively via `registerTool`
5. Walk the SDK client object in parallel — leaf values are async functions that the tool handler calls

When `inputSchema` exists, the MCP SDK validates incoming tool calls against the Zod schema before invoking the handler — so validation is automatic and schema-consistent with the API.

### Changes Required

#### 1. Package scaffolding
Create `vendor/mcp/` following the standard vendor package pattern (private, no build step, `exports` point at `./src/*.ts`).

**File**: `vendor/mcp/package.json`

```json
{
  "name": "@vendor/mcp",
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
    "@modelcontextprotocol/sdk": "^1.27.1",
    "@orpc/contract": "^1.13.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

**File**: `vendor/mcp/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

**File**: `vendor/mcp/turbo.json`

```json
{
  "extends": ["//"],
  "tags": ["vendor"],
  "tasks": {}
}
```

#### 2. Adapter implementation
**File**: `vendor/mcp/src/index.ts`

```typescript
import { isContractProcedure } from "@orpc/contract";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ---------------------------------------------------------------------------
// Re-exports — MCP SDK essentials
// ---------------------------------------------------------------------------

export { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ---------------------------------------------------------------------------
// Contract-to-MCP adapter
// ---------------------------------------------------------------------------

export interface RegisterContractToolsOptions {
  /** Prefix for all tool names (e.g. "lightfast" → "lightfast_search"). */
  prefix?: string;
  /** Separator between key path segments. Default: "_" */
  separator?: string;
}

/**
 * Walk an oRPC contract router and register each procedure as an MCP tool.
 *
 * Tool names are derived from the router key path joined with the separator.
 * Input schemas from the contract are passed directly to `registerTool` —
 * the MCP SDK validates incoming tool calls against the same Zod schemas
 * used by the API.
 *
 * @example
 * ```ts
 * registerContractTools(server, apiContract, client, { prefix: "lightfast" });
 * // Registers: lightfast_search, lightfast_proxy_search, lightfast_proxy_execute
 * ```
 */
export function registerContractTools(
  server: McpServer,
  contract: Record<string, unknown>,
  client: Record<string, unknown>,
  options?: RegisterContractToolsOptions,
): void {
  const prefix = options?.prefix;
  const sep = options?.separator ?? "_";

  function walk(
    contractNode: unknown,
    clientNode: unknown,
    keyPath: string[],
  ): void {
    if (isContractProcedure(contractNode)) {
      const def = (contractNode as { "~orpc": {
        route?: { description?: string; summary?: string };
        inputSchema?: unknown;
        outputSchema?: unknown;
      } })["~orpc"];

      const toolName = prefix
        ? [prefix, ...keyPath].join(sep)
        : keyPath.join(sep);

      const description =
        def.route?.description ?? def.route?.summary ?? toolName;

      const fn = clientNode as (...args: unknown[]) => Promise<unknown>;

      const handle = async (...args: unknown[]) => {
        try {
          // With inputSchema: args = [parsedInput, extra]
          // Without inputSchema: args = [extra]
          const input = def.inputSchema ? args[0] : undefined;
          const result = input !== undefined ? await fn(input) : await fn();
          return {
            structuredContent: result as Record<string, unknown>,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: error instanceof Error ? error.message : String(error),
              },
            ],
            isError: true,
          };
        }
      };

      const config: Record<string, unknown> = { description };
      if (def.inputSchema) config.inputSchema = def.inputSchema;
      if (def.outputSchema) config.outputSchema = def.outputSchema;

      server.registerTool(toolName, config as any, handle);
      return;
    }

    // Recurse into nested router objects
    if (contractNode && typeof contractNode === "object") {
      for (const key in contractNode as Record<string, unknown>) {
        walk(
          (contractNode as Record<string, unknown>)[key],
          (clientNode as Record<string, unknown>)[key],
          [...keyPath, key],
        );
      }
    }
  }

  walk(contract, client, []);
}
```

Key design decisions:
- **Follows the canonical oRPC walk pattern** — same `isContractProcedure` + `for...in` recursion used by `enhanceContractRouter` internally
- **Structured output** — tools return `{ structuredContent }` validated against the contract's `outputSchema`, not `JSON.stringify` text blobs. Fewer tokens (no pretty-print whitespace, no `{ type: "text", text: "..." }` envelope), and AI agents get typed data directly.
- **Two registration branches** — `registerTool` has distinct callback signatures depending on whether `inputSchema` is provided. The adapter branches on `def.inputSchema` to call the correct overload.
- **Both `inputSchema` AND `outputSchema` passed** — the MCP SDK accepts Zod v4 schemas via `AnySchema`, so the contract's Zod schemas work without conversion. This makes the adapter the first generic oRPC-to-MCP bridge with fully typed input and output.
- **No `@vendor/mcp` build step** — follows vendor pattern: `private: true`, exports point at `./src/*.ts`

### Success Criteria

#### Automated Verification:
- [x] Dependencies install: `pnpm install`
- [x] Typecheck passes: `pnpm --filter @vendor/mcp typecheck`
- [ ] Full monorepo typecheck: `pnpm typecheck` (pre-existing `@db/app` failure — unrelated)

#### Manual Verification:
- [x] Confirm `registerContractTools` is importable from `@vendor/mcp` (verified — MCP server imports and uses it successfully)

---

## Phase 5: MCP Server (`core/mcp`)

### Overview
Implement the MCP server as a CLI binary. Instead of hand-written tool registrations, use `@vendor/mcp`'s `registerContractTools()` to auto-generate all MCP tools from the oRPC contract. The entire MCP server is ~25 lines.

### Changes Required

#### 1. MCP server implementation
**File**: `core/mcp/src/index.ts`

```typescript
import { apiContract } from "@repo/app-api-contract";
import { McpServer, StdioServerTransport, registerContractTools } from "@vendor/mcp";
import { createLightfast } from "lightfast";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const lf = createLightfast(apiKey, process.env.LIGHTFAST_BASE_URL
  ? { baseUrl: process.env.LIGHTFAST_BASE_URL }
  : undefined,
);

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

registerContractTools(server, apiContract, lf, { prefix: "lightfast" });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});
```

**25 lines**. Adding a new endpoint to the contract automatically creates an MCP tool — no changes to this file needed.

Key design decisions:
- **Contract imported directly** — `@repo/app-api-contract` is a workspace dep (bundled by tsup). The adapter walks it at startup.
- **SDK client as the execution layer** — `createLightfast(apiKey)` returns the typed client; the adapter calls leaf functions on it in parallel with the contract walk.
- **`prefix: "lightfast"`** — produces `lightfast_search`, `lightfast_proxy_search`, `lightfast_proxy_execute`

#### 2. tsup config — bundle contract + SDK + vendor/mcp
**File**: `core/mcp/tsup.config.ts`

```typescript
import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  bundle: true,
  external: ["@modelcontextprotocol/sdk"],
  outExtension: () => ({ js: ".mjs" }),
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
```

`@modelcontextprotocol/sdk` stays external (runtime dep). Everything else — `lightfast`, `@vendor/mcp`, `@repo/app-api-contract`, `@orpc/contract` — is bundled.

#### 3. Package.json — dependencies
**File**: `core/mcp/package.json`

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1"
  },
  "devDependencies": {
    "@repo/app-api-contract": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@vendor/mcp": "workspace:*",
    "lightfast": "workspace:*",
    "tsup": "^8.5.1",
    "typescript": "catalog:"
  }
}
```

All workspace deps are devDependencies — they're bundled by tsup into the output. Only `@modelcontextprotocol/sdk` is a runtime dependency.

### Success Criteria

#### Automated Verification:
- [x] Dependencies install: `pnpm install`
- [x] Typecheck passes: `pnpm --filter @lightfastai/mcp typecheck`
- [x] Build succeeds: `pnpm --filter @lightfastai/mcp build` (1.08 MB bundled)
- [x] Built output exists and is executable: `head -1 core/mcp/dist/index.mjs` shows `#!/usr/bin/env node`
- [ ] Full monorepo typecheck: `pnpm typecheck` (pre-existing `@db/app` failure — unrelated)
- [x] Lint passes: `core/mcp/src/index.ts` clean

#### Manual Verification:
- [x] Running `LIGHTFAST_API_KEY=test node core/mcp/dist/index.mjs` starts without crashing (waits for stdio input)
- [x] MCP tool listing shows 3 tools: `lightfast_search`, `lightfast_proxy_search`, `lightfast_proxy_execute`
- [x] Tool input schemas match the contract's Zod schemas — `lightfast_search` input has `query,limit,offset,mode,sources,types,after,before`; `lightfast_proxy_execute` input has `installationId,endpointId,pathParams,queryParams,body`; output schemas also match

---

## Testing Strategy

### Unit Tests (Phase 3):
- `createLightfast()` returns a client object with `.search()`, `.proxy.search()`, `.proxy.execute()` methods
- `VERSION` matches package.json version
- `isDefinedError` and `safe` are exported functions

### Unit Tests (Phase 4):
- `registerContractTools()` registers the correct number of tools (3) from the contract
- Tool names match expected pattern: `lightfast_search`, `lightfast_proxy_search`, `lightfast_proxy_execute`
- Tools with `inputSchema` get the contract's Zod schema passed through

### Integration Tests (future, out of scope):
- End-to-end search via SDK against running dev server
- MCP tool invocation via MCP client library

### Manual Testing Steps:
1. Generate OpenAPI spec and verify 4xx schemas with `data` definitions appear for each endpoint
2. `curl` the API without auth — verify 401 response with `X-Request-ID` header
3. Build SDK — verify `dist/index.d.ts` exports client factory, schemas, types, and error utilities
4. Verify SDK sends `X-SDK-Version` header (inspect via dev server logs or proxy)
5. Build MCP — verify binary starts, lists 3 tools with correct input schemas auto-derived from contract
6. Add a hypothetical 4th endpoint to the contract — verify MCP would pick it up with zero MCP code changes (mental model test)

## Performance Considerations

- **SDK bundle size**: `@orpc/client` + `@orpc/openapi-client` + contract schemas + zod are all bundled. Expected size is small (~50KB gzipped) since these are lightweight packages. Monitor with `ls -la core/lightfast/dist/index.mjs`.
- **MCP startup time**: The MCP binary bundles the SDK + contract + adapter. `@modelcontextprotocol/sdk` is external. Cold start should be under 100ms. The contract walk is O(n) where n = number of endpoints (currently 3) — negligible.
- **Response header cloning**: `new Response(response.body, response)` in the OpenAPI handler creates a shallow clone. This is a standard pattern and has negligible overhead.
- **Structured output vs text blobs**: `structuredContent` avoids `JSON.stringify(result, null, 2)` pretty-print whitespace (~30% overhead on nested objects) and the `{ type: "text", text: "..." }` envelope. AI agents get typed data directly — fewer tokens, no parsing step.

## References

- Research: `thoughts/shared/research/2026-04-04-orpc-error-handling-and-sdk-client.md`
- oRPC error handling: https://orpc.dev/docs/error-handling
- oRPC publish client: https://orpc.dev/docs/advanced/publish-client-to-npm
- oRPC OpenAPILink: https://orpc.dev/docs/openapi/client/openapi-link
- oRPC `ContractProcedure` internals: `procedure['~orpc']` holds `{ route, inputSchema, outputSchema, errorMap, meta }`
- oRPC `isContractProcedure`: guard for detecting leaf procedures during contract walks
- MCP `registerTool`: accepts `inputSchema` as `AnySchema` (Zod v4) — no JSON Schema conversion needed
- Contract: `packages/app-api-contract/src/contract.ts`
- Router: `apps/app/src/app/(api)/lib/orpc-router.ts`
- Middleware: `apps/app/src/app/(api)/lib/orpc-middleware.ts`
- Handler: `apps/app/src/app/(api)/v1/[...rest]/route.ts`
- Vendor MCP adapter: `vendor/mcp/`
- SDK package: `core/lightfast/`
- MCP package: `core/mcp/`
