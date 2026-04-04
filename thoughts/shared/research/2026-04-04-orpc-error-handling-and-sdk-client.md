---
date: 2026-04-04T15:00:00+10:00
researcher: claude
git_commit: 3eb07cd5e1e61b92bbdb27a79a9c317872a28e35
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "oRPC Error Handling Integration + Publishable SDK Client"
tags: [research, codebase, orpc, error-handling, sdk, openapi, lightfast, mcp]
status: complete
last_updated: 2026-04-04
---

# Research: oRPC Error Handling Integration + Publishable SDK Client

**Date**: 2026-04-04T15:00:00+10:00
**Git Commit**: 3eb07cd5e1e61b92bbdb27a79a9c317872a28e35
**Branch**: refactor/drop-workspace-abstraction

## Research Question

How to upgrade `@repo/app-api-contract` with proper oRPC error handling based on the existing handler patterns, and how to create a publishable SDK client in `core/lightfast` (and subsequently `core/mcp`) using oRPC's contract-driven client pattern.

## Summary

The codebase has a working oRPC setup with a contract, router, auth middleware, and OpenAPI handler — but errors are ad-hoc (`ORPCError` thrown directly) with no type-safe error definitions on the contract or documented error schemas in the OpenAPI spec. The SDK packages (`lightfast`, `@lightfastai/mcp`) are empty shells ready to be wired up.

oRPC provides clean primitives for both gaps:
1. `.errors()` on the contract/server for typed error definitions that auto-generate OpenAPI error schemas
2. `createORPCClient` + `OpenAPILink` for a publishable client that's fully typed from the contract

---

## Detailed Findings

### 1. Current Error Handling

#### Contract (`packages/app-api-contract/src/contract.ts`)
- No error definitions — only `.input()` and `.output()` on each route
- The contract uses `oc` from `@orpc/contract` (v1.13.13)

#### Auth Middleware (`apps/app/src/app/(api)/lib/orpc-middleware.ts:38-81`)
- Throws raw `ORPCError` instances with codes: `UNAUTHORIZED`, `BAD_REQUEST`, `FORBIDDEN`
- Each error includes a `message` string but no typed `data` schema
- Pattern: `throw new ORPCError("UNAUTHORIZED", { message: "..." })`

#### Router (`apps/app/src/app/(api)/lib/orpc-router.ts:54-79`)
- `proxy.execute` handler catches errors and maps string-matched messages to oRPC codes:
  - `"not found"` or `"access denied"` → `NOT_FOUND`
  - `"not active"` → `BAD_REQUEST`
  - Everything else → re-throw (becomes 500)

#### OpenAPI Handler (`apps/app/src/app/(api)/v1/[...rest]/route.ts:6-36`)
- `new OpenAPIHandler(router)` — no plugins, no custom error encoder
- Manual catch block returns `{ error: "INTERNAL_ERROR", requestId }` with status 500
- Manual 404 returns `{ error: "NOT_FOUND", message: "Endpoint not found", requestId }`

#### Generated OpenAPI Spec (`packages/app-api-contract/openapi.json`)
- Only `200` responses are documented — no `4xx`/`5xx` error schemas
- Consumers (SDK users, docs readers) have no visibility into error shapes

#### Error Response Shape (current, ad-hoc)
```json
{ "error": "UNAUTHORIZED", "message": "...", "requestId": "..." }
```
This shape is manually constructed in the catch blocks, NOT from oRPC's built-in serialization.

### 2. oRPC Error Handling Upgrade Path

#### Step A: Define errors on the contract

oRPC supports `.errors()` on both contracts and server instances:

```typescript
import { oc } from "@orpc/contract";
import { z } from "zod";

// Shared error definitions for all API endpoints
const apiErrors = {
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication required",
  },
  FORBIDDEN: {
    status: 403,
    message: "Access denied",
  },
  NOT_FOUND: {
    status: 404,
    message: "Resource not found",
  },
  BAD_REQUEST: {
    status: 400,
    message: "Invalid request",
  },
  RATE_LIMITED: {
    status: 429,
    message: "Too many requests",
    data: z.object({
      retryAfter: z.number(),
    }),
  },
} as const;

export const apiContract = {
  search: oc
    .route({ method: "POST", path: "/v1/search", ... })
    .errors(apiErrors)
    .input(SearchRequestSchema)
    .output(SearchResponseSchema),
  // ...
};
```

This gives:
- Type-safe `errors.UNAUTHORIZED()` in handlers (instead of `new ORPCError(...)`)
- Auto-generated error schemas in OpenAPI spec (401, 403, 404, etc.)
- Client-side typed error catching

#### Step B: Use typed errors in the router

```typescript
const impl = implement(apiContract)
  .$context<InitialContext>()
  .use(authMiddleware);

impl.search.handler(async ({ input, context, errors }) => {
  // errors.NOT_FOUND() is typed, replaces new ORPCError("NOT_FOUND", ...)
  throw errors.NOT_FOUND({ message: "No results" });
});
```

#### Step C: Custom error response shape (optional)

The current ad-hoc shape `{ error, message, requestId }` can be formalized via `customErrorResponseBodyEncoder`:

```typescript
const handler = new OpenAPIHandler(router, {
  plugins: [new ZodSmartCoercionPlugin()],
  customErrorResponseBodyEncoder(error) {
    // Preserve current shape for backward compat
    return {
      error: error.code,
      message: error.message,
      data: error.data,
      // requestId comes from context, not error — needs interceptor
    };
  },
});
```

For `requestId` inclusion, use an interceptor on the handler since it's context-specific.

#### Step D: Document errors in OpenAPI spec

Use `customErrorResponseBodySchema` on the generator:

```typescript
const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(apiContract, {
  // errors defined via .errors() auto-generate 4xx/5xx response schemas
  // custom shape via customErrorResponseBodySchema if needed
  ...existingConfig,
});
```

### 3. Publishable SDK Client (`core/lightfast`)

#### Current State
- `core/lightfast/src/index.ts` exports `{}` (empty)
- Published as `lightfast@0.1.0-alpha.5` on npm
- Has proper `package.json` with `publishConfig`, `tsup` build, version injection
- Zero runtime dependencies currently

#### oRPC Client Pattern

The contract-driven client requires:

```
Dependencies:
  @orpc/client       — createORPCClient
  @orpc/openapi-client — OpenAPILink (for OpenAPI endpoints)
  @orpc/contract     — ContractRouterClient type
  @repo/app-api-contract — the contract itself
```

```typescript
// core/lightfast/src/index.ts
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { apiContract } from "@repo/app-api-contract";

export type LightfastClient = JsonifiedClient<
  ContractRouterClient<typeof apiContract>
>;

export function createLightfast(apiKey: string, options?: {
  baseUrl?: string;
}): LightfastClient {
  const link = new OpenAPILink(apiContract, {
    url: options?.baseUrl ?? "https://lightfast.ai",
    headers: () => ({
      authorization: `Bearer ${apiKey}`,
    }),
  });

  return createORPCClient(link);
}
```

#### Key Decision: Contract Bundling

The contract must be bundled INTO the published package (not a `workspace:*` dep). Options:
1. **Inline the contract** — copy/re-export the contract object in `core/lightfast/src/contract.ts`
2. **Publish the contract** — make `@repo/app-api-contract` a separate published package
3. **Bundle via tsup** — let tsup inline the contract at build time (current `bundle: true` in tsup config should handle this if `@repo/app-api-contract` is NOT in `external`)

Option 3 is the path of least resistance — tsup already has `bundle: true` and `external: []`.

#### Package.json Changes Needed

```json
{
  "dependencies": {
    "@orpc/client": "^1.13.0",
    "@orpc/openapi-client": "^1.13.0"
  },
  "devDependencies": {
    "@orpc/contract": "^1.13.0",
    "@repo/app-api-contract": "workspace:*",
    "@repo/app-validation": "workspace:*"
  }
}
```

The contract and validation packages are dev deps (bundled at build time), while `@orpc/client` and `@orpc/openapi-client` are runtime deps (peer or direct) that consumers install.

**Important**: `zod` schemas are embedded in the contract. If bundled, the built output carries the schema definitions. If NOT bundled, consumers need zod. The `bundle: true` tsup config handles this.

#### Consumer Usage

```typescript
import { createLightfast } from "lightfast";

const lf = createLightfast("sk-lf-...");

// Fully typed — input/output inferred from contract
const results = await lf.search({ query: "deployment errors" });
const proxy = await lf.proxy.search();
const exec = await lf.proxy.execute({
  installationId: "...",
  endpointId: "...",
});
```

### 4. MCP Integration (`core/mcp`)

#### Current State
- `core/mcp/src/index.ts` exports `{}` (empty)
- Published as `@lightfastai/mcp@0.1.0-alpha.5`
- Depends on `lightfast: workspace:*` — meaning it uses the SDK client
- Has `#!/usr/bin/env node` banner (CLI tool)
- Uses `@modelcontextprotocol/sdk: ^1.27.1`

#### Integration Path
Once `core/lightfast` exposes `createLightfast()`, MCP server wraps it as tools:

```typescript
// core/mcp/src/index.ts
import { createLightfast } from "lightfast";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const lf = createLightfast(process.env.LIGHTFAST_API_KEY!);
// Register lf.search as MCP tool "lightfast_search", etc.
```

No oRPC-specific changes needed in MCP — it's a consumer of the SDK client.

---

## Code References

- `packages/app-api-contract/src/contract.ts` — API contract (3 endpoints, no error defs)
- `packages/app-api-contract/scripts/generate.ts` — OpenAPI generator (no plugins, no error schema)
- `apps/app/src/app/(api)/v1/[...rest]/route.ts` — OpenAPI handler (no plugins, bare catch)
- `apps/app/src/app/(api)/lib/orpc-middleware.ts:22-92` — Auth resolver, throws ORPCError
- `apps/app/src/app/(api)/lib/orpc-router.ts:1-82` — Router implementation with ad-hoc error mapping
- `apps/app/src/app/(api)/lib/with-api-key-auth.ts` — API key validation (returns result objects)
- `packages/app-validation/src/schemas/api/search.ts` — Search schemas (zod)
- `packages/app-validation/src/schemas/api/proxy.ts` — Proxy schemas (zod)
- `packages/app-validation/src/schemas/api/common.ts` — Shared schemas (EventBase, RerankMode)
- `core/lightfast/package.json` — SDK package config (empty export, published)
- `core/lightfast/tsup.config.ts` — Build config (bundle: true, esm, dts)
- `core/mcp/package.json` — MCP package config (depends on lightfast)

## Installed Versions

| Package | Version |
|---------|---------|
| `@orpc/contract` | 1.13.13 |
| `@orpc/server` | 1.13.13 |
| `@orpc/openapi` | 1.13.13 |
| `@orpc/zod` | 1.13.13 |
| `zod` | (using catalog, zod v4 imports via `@orpc/zod/zod4` already in generate.ts) |

## oRPC Documentation References

- Error handling: https://orpc.dev/docs/error-handling
- OpenAPI error handling: https://orpc.dev/docs/openapi/error-handling
- Custom error response: https://orpc.dev/docs/openapi/advanced/customizing-error-response
- Publish client to npm: https://orpc.dev/docs/advanced/publish-client-to-npm
- OpenAPILink: https://orpc.dev/docs/openapi/client/openapi-link
- ZodSmartCoercionPlugin: https://orpc.dev/docs/openapi/plugins/zod-smart-coercion

## Decisions

1. **Error shape**: Adopt oRPC default `{ defined, code, status, message, data }`. No `customErrorResponseBodyEncoder` needed. Since both SDK (`lightfast`) and MCP (`@lightfastai/mcp`) are empty shells with zero consumers, there's nothing to break.

2. **`requestId` delivery**: Move to `X-Request-ID` response header instead of error body. Cleaner separation — available on ALL responses (success + error), not just error bodies. Remove `requestId` from manual JSON error responses in the handler.

3. **Contract bundling**: tsup `bundle: true` with `external: []` inlines the contract at build time. No need to publish `@repo/app-api-contract` separately.

## Remaining Open Questions

1. **Validation schema index cleanup**: `packages/app-validation/src/schemas/api/index.ts` re-exports `contents`, `findsimilar`, and `related` modules that no longer exist on disk. These dead exports should be cleaned up before expanding the contract.

2. **ZodSmartCoercionPlugin**: The `generate.ts` script only generates the spec — it doesn't serve requests. The plugin belongs on the `OpenAPIHandler` in `[...rest]/route.ts`, not the generator. The generator already uses `ZodToJsonSchemaConverter` from `@orpc/zod/zod4` which is correct.
