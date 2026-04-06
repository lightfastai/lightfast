# Internal tRPC Caller Setup

## Overview

Set up the internal tRPC infrastructure that enables Inngest functions and `apps/platform` route handlers to call platform capabilities through a typed, middleware-wrapped caller — without JWT overhead. This is the foundation layer; no business logic migration happens here.

## Current State Analysis

`api/platform/src/trpc.ts` defines three procedure tiers (`publicProcedure`, `serviceProcedure`, `adminProcedure`), all using the same observability middleware. Cross-service callers in `packages/platform-trpc/` sign a JWT, construct Headers, and call `platformRouter.createCaller(ctx)` — the full auth ceremony for every call.

Inngest functions in `api/platform/src/inngest/functions/` make ~67 async calls (DB, provider APIs, Redis, Inngest dispatch) directly, with no middleware wrapping. Route handlers in `apps/platform/src/app/api/` import lib functions directly from `@api/platform`.

### Key Discoveries:

- `PlatformAuthContext` already has `{ type: "inngest" }` and `{ type: "cron" }` variants defined but never populated — the auth model anticipated internal callers (`trpc.ts:22-27`)
- `observabilityMiddleware` is instantiated once at `trpc.ts:104` and reused by all procedure tiers — adding a new tier requires zero middleware changes
- `createCaller(ctx)` accepts a resolved context object synchronously — no async needed for internal calls (`packages/platform-trpc/src/caller.ts:28`)
- The `extractAuth` function at `trpc.ts:107-109` only extracts fields for `service` type — needs extension for `internal`

## Desired End State

A `createInternalCaller()` function that returns a fully-typed tRPC caller bound to an `internalRouter`. The caller:
- Applies the existing observability middleware (structured logging, Sentry tracing, request journaling) to every procedure call
- Requires zero JWT signing, header construction, or async context creation
- Is importable from `@api/platform/internal` by both Inngest functions and route handlers
- Is NOT exposed via HTTP — only accessible through in-process `createCaller()`

Verification: `pnpm build:platform && pnpm --filter @api/platform typecheck` passes.

## What We're NOT Doing

- Migrating any business logic into internal procedures (separate follow-up plan)
- Changing existing `serviceProcedure` / `platformRouter` / `adminRouter`
- Adding procedures for DB, provider API, or OAuth operations
- Modifying Inngest functions or route handlers to use the caller
- Creating Zod schemas for domain operations

## Implementation Approach

Add a fourth procedure tier (`internalProcedure`) alongside the existing three, create an empty `internalRouter` with a single health-ping proof procedure, wire up a synchronous caller factory, and export it.

## Phase 1: Add `internalProcedure`, Internal Router, and Caller

### Overview

Extend the tRPC instance with a new procedure tier for trusted in-process callers, create the internal router with a proof-of-concept procedure, and wire up a synchronous caller factory. This is one atomic unit — `internalProcedure` is inert without `internalRouter` and vice versa.

### Changes Required:

#### 1. Define Explicit `PlatformContext` Type

**File**: `api/platform/src/trpc.ts`
**Changes**: Add an explicit context type and use it for tRPC initialization.

**Why this is needed**: `initTRPC.context<typeof createPlatformTRPCContext>()` infers the context type from the function's actual return paths — which only produce `"service"` or `"unauthenticated"`. TypeScript correctly rejects `"internal"` as impossible under this inferred type. Switching to an explicit type widens the context to match the full declared union. (Confirmed via spike — the plan fails to typecheck without this change.)

Add after `PlatformAuthContext` (after line 27):

```ts
/** Explicit context type for tRPC initialization.
 *
 * Must be used instead of `typeof createPlatformTRPCContext` because the
 * context factory only returns "service" | "unauthenticated" — but in-process
 * callers (createInternalCaller) provide other auth variants directly.
 *
 * If you add fields to createPlatformTRPCContext's return type, add them here too.
 */
export type PlatformContext = {
  auth: PlatformAuthContext;
  headers: Headers;
};
```

Then update `createPlatformTRPCContext` with an explicit return type:

```ts
export const createPlatformTRPCContext = async (opts: { headers: Headers }): Promise<PlatformContext> => {
```

And update the tRPC initialization (line 85):

```ts
const t = initTRPC.context<PlatformContext>().create({
```

#### 2. Extend `PlatformAuthContext`

**File**: `api/platform/src/trpc.ts`
**Changes**: Add `internal` variant to the auth discriminated union.

```ts
export type PlatformAuthContext =
  | { type: "service"; caller: string }
  | { type: "webhook"; provider: string }
  | { type: "internal"; source: string }
  | { type: "inngest" }
  | { type: "cron" }
  | { type: "unauthenticated" };
```

#### 3. Update `extractAuth` for Observability

**File**: `api/platform/src/trpc.ts`
**Changes**: Extend the `extractAuth` callback so internal calls appear in structured logs and Sentry spans.

Current (line 107-109):
```ts
extractAuth: (ctx) => ({
  ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
}),
```

New:
```ts
extractAuth: (ctx) => ({
  ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
  ...(ctx.auth.type === "internal" && { source: ctx.auth.source }),
}),
```

#### 4. Add `internalProcedure` Export

**File**: `api/platform/src/trpc.ts`
**Changes**: Add after `adminProcedure` (after line 179).

```ts
/**
 * Internal procedure -- trusted in-process callers only.
 * Used by Inngest functions and platform route handlers via createInternalCaller().
 *
 * NOT exposed over HTTP. Applies observability middleware without auth checks.
 */
export const internalProcedure = t.procedure.use(observabilityMiddleware);
```

Note: This is identical to `publicProcedure` in implementation but distinct in intent. `publicProcedure` is for HTTP endpoints that don't require auth (health checks). `internalProcedure` is for in-process callers that bypass HTTP entirely. Keeping them separate allows diverging middleware later (e.g., adding internal-only tracing tags) without affecting public endpoints.

#### 5. Create Internal Router

**File**: `api/platform/src/internal.ts` (new)

```ts
/**
 * Internal platform router — in-process callers only.
 *
 * NOT served over HTTP. Accessed exclusively via createInternalCaller().
 * All procedures use internalProcedure (observability middleware, no auth).
 *
 * Sub-routers will be added as business logic is migrated from:
 * - Inngest function steps (DB calls, provider APIs, token management)
 * - Route handler lib calls (OAuth, webhook ingestion)
 */
import { createTRPCRouter, internalProcedure } from "./trpc";

// -- Internal Router ----------------------------------------------------------

export const internalRouter = createTRPCRouter({
  /**
   * Proof-of-concept procedure.
   * Validates the full chain: caller -> router -> procedure -> middleware -> response.
   * Remove once real sub-routers are added.
   */
  ping: internalProcedure.query(({ ctx }) => ({
    ok: true as const,
    timestamp: new Date().toISOString(),
    source: ctx.auth.type === "internal" ? ctx.auth.source : "unknown",
  })),
});

export type InternalRouter = typeof internalRouter;

// -- Internal Caller ----------------------------------------------------------

/**
 * Create a typed caller for the internal router.
 *
 * No JWT, no headers, no async — just a direct in-process call
 * with full observability middleware on every procedure.
 *
 * Note: This bypasses createPlatformTRPCContext entirely — context is built
 * inline. If you add fields to createPlatformTRPCContext's return type,
 * update PlatformContext and this function accordingly.
 *
 * Usage in Inngest functions:
 *   const platform = createInternalCaller();
 *   await step.run("some-step", () => platform.someRouter.someProc(input));
 *
 * Usage in route handlers:
 *   const platform = createInternalCaller();
 *   const result = await platform.someRouter.someProc(input);
 */
export function createInternalCaller(source = "unknown") {
  return internalRouter.createCaller({
    auth: { type: "internal" as const, source },
    headers: new Headers(),
  });
}
```

#### 6. Add Package Export Path

**File**: `api/platform/package.json`
**Changes**: Add `./internal` export alongside existing paths.

```json
"./internal": {
  "types": "./src/internal.ts",
  "default": "./src/internal.ts"
}
```

#### 7. Re-export Types from Index

**File**: `api/platform/src/index.ts`
**Changes**: Add type export for consumers that need the router type.

```ts
export type { InternalRouter } from "./internal";
```

No runtime exports from index — consumers import `createInternalCaller` from `@api/platform/internal` directly. This keeps the internal router out of the main bundle path.

### Success Criteria:

#### Automated Verification:

- [x] Type-check passes: `pnpm --filter @api/platform typecheck`
- [x] Platform build passes: `pnpm build:platform`
- [x] Downstream type-check passes: `pnpm --filter @repo/platform-trpc typecheck`

#### Manual Verification:

- [ ] `internalRouter` is NOT referenced in any `serve()` call or HTTP handler
- [ ] `createInternalCaller("test").ping()` resolves to `{ ok: true, timestamp: string, source: "test" }`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Phase 2: Convenience Caller Exports

### Overview

Create pre-configured internal callers for Inngest functions and route handlers so consumers don't repeat `createInternalCaller("inngest")` / `createInternalCaller("route")` at every call site.

### Changes Required:

#### 1. Create Inngest-Specific Caller

**File**: `api/platform/src/inngest/platform.ts` (new)

```ts
/**
 * Pre-configured internal tRPC caller for Inngest functions.
 *
 * Import this in any Inngest function to call platform procedures:
 *
 *   import { platform } from "../platform";
 *   await step.run("get-token", () => platform.tokens.resolve(id));
 *
 * Module-level instantiation is safe because:
 * - createInternalCaller() is synchronous (no JWT, no async context)
 * - The caller is stateless — each procedure call creates its own middleware chain
 * - The auth context ({ type: "internal", source: "inngest" }) is static
 */
import { createInternalCaller } from "../internal";

export const platform = createInternalCaller("inngest");
```

#### 2. Create Route Handler Caller

**File**: `apps/platform/src/lib/internal-caller.ts` (new)

```ts
/**
 * Pre-configured internal tRPC caller for platform route handlers.
 *
 * Usage in route handlers:
 *   import { platform } from "@/lib/internal-caller";
 *   const result = await platform.webhooks.persistAndDispatch(input);
 */
import { createInternalCaller } from "@api/platform/internal";

export const platform = createInternalCaller("route");
```

### Success Criteria:

#### Automated Verification:

- [x] Type-check passes: `pnpm --filter @api/platform typecheck`
- [x] Platform app type-check passes: `pnpm --filter lightfast-platform typecheck`
- [ ] Full check: `pnpm check`

---

## Testing Strategy

### Automated Tests:

This is infrastructure-only — no business logic to unit test. Verification is that the type system and build pipeline accept the new exports.

### Manual Testing Steps:

1. Import `createInternalCaller` in a scratch file, call `.ping()`, confirm the observability middleware fires (check log output for `[trpc] ok` with `source: "test"`)
2. Verify the internal router is not accessible via HTTP by confirming no `serve()` or `fetchRequestHandler` references it

## Performance Considerations

- `createInternalCaller()` is synchronous — no JWT signing (saves ~1-2ms per call vs `createPlatformCaller()`)
- The caller itself is cheap to instantiate (just `router.createCaller(ctx)`)
- The observability middleware adds ~0ms in production (dev mode adds 100-500ms artificial latency, controlled by `opts.isDev`)
- Module-level instantiation (`export const platform = createInternalCaller("inngest")`) means zero per-call overhead for caller creation

## Architecture Notes

```
Existing (unchanged):
  api/app ──JWT──> platformRouter (serviceProcedure)
  apps/app ──JWT──> platformRouter (serviceProcedure)

New:
  Inngest functions ──direct──> internalRouter (internalProcedure)
  apps/platform routes ──direct──> internalRouter (internalProcedure)
```

The two router trees (`platformRouter` and `internalRouter`) are independent. Shared procedure implementations can be composed into both routers in later phases via shared handler functions, but that's out of scope here.

## References

- Research: `thoughts/shared/research/2026-04-05-parseerror-full-propagation-inventory.md` — identified 67 async call sites in Inngest functions
- Existing tRPC setup: `api/platform/src/trpc.ts` — procedure tiers and middleware
- Existing caller: `packages/platform-trpc/src/caller.ts` — JWT-based service caller pattern
- Observability middleware: `vendor/observability/src/trpc.ts` — full middleware implementation

---

## Improvement Log

### Review: 2026-04-06

**Spike verdict: PARTIAL** — The original plan's `createInternalCaller` failed to typecheck. Root cause: `initTRPC.context<typeof createPlatformTRPCContext>()` infers context type from the factory's actual return paths (`"service" | "unauthenticated"` only), rejecting `"internal"` as impossible.

#### Changes made:

1. **[Critical] Added `PlatformContext` type and context initialization fix** (Phase 1, Step 1) — Without this, the entire plan fails to typecheck. The fix introduces an explicit `PlatformContext` type and switches `initTRPC.context<>()` from inferred to explicit. Also adds return type annotation on `createPlatformTRPCContext`. Discovered via spike-validator in isolated worktree.

2. **Collapsed Phase 1 + Phase 2 into single Phase 1** — `internalProcedure` without `internalRouter` is inert. One atomic unit, one verification pass.

3. **Renumbered Phase 3 → Phase 2** — Follows from the collapse above.

4. **Improved `ping` to return `source` from context** — Original ping ignored context, making it impossible to verify auth propagation without checking logs. Now returns `source` field from `ctx.auth` for direct manual verification.

5. **Added context bypass documentation** — `createInternalCaller` builds context inline, bypassing `createPlatformTRPCContext`. Added comments in both `internal.ts` and `PlatformContext` type to flag this coupling for future maintainers.

6. **Removed "(Optional)" from route handler caller** — User confirmed it should ship with this plan.

#### Spike finding (empty headers):
The observability middleware (`vendor/observability/src/trpc.ts`) does **not** read from `ctx.headers` — it only uses `opts.extractAuth(ctx)` for auth fields and Sentry APIs for trace context. Empty `new Headers()` is completely safe. No degradation.
