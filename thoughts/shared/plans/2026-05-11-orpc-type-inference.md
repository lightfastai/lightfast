# oRPC Type Inferencing — Eliminate `any` Escapes Across the Public-API Stack

## Overview

The oRPC integration (PR `feat/orpc-public-api-and-lib-rework`) ships with two `any` escape hatches and a structural cast that compensate for missing type plumbing between `vendor/observability` and `api/app`. Both escapes are annotated with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` even though the repository does not use ESLint (it uses Biome / ultracite — those comments are dead). This plan replaces every `any` and the unsafe inline cast in the oRPC type chain with the public types `@orpc/server` and `@orpc/contract` already export, so the chain is fully inferred end-to-end.

## Current State Analysis

### The two `any` escapes (not where the user's command pointed)

The command argument referenced `@vendor/observability/src/orpc.ts` and `@api/app/src/orpc/middleware/observability.ts`. The middleware file in `api/app` is actually 11 lines with no disable. The second disable lives one file over, in the procedure factory:

1. **`vendor/observability/src/orpc.ts:34-38`** — factory returns an inline middleware whose argument is annotated `any`:

   ```ts
   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC's Middleware generic is parameterized by the full procedure chain; the cast at the call site bridges the two type systems.
   return async ({ context, next, path }: any) => {
     const { requestId } = context as { requestId: string };
     const procedurePath = (path as readonly string[]).join(".");
     ...
   ```

   The factory then narrows by `context as { requestId: string }` (line 37) and `path as readonly string[]` (line 38). Each cast is an independent escape.

2. **`api/app/src/orpc/procedures.ts:12-13`** — contract-procedure constraint uses `any` four times:

   ```ts
   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ContractProcedure<any,any,any,any> matches AnyContractProcedure; the implementer narrows ctx/output downstream.
   export const authed = <P extends ContractProcedure<any, any, any, any>>(
     proc: P
   ) => implement(proc).$context<InitialContext>().use(observabilityMiddleware).use(authMiddleware);
   ```

   The comment is correct — `ContractProcedure<any,any,any,any>` is the manual form of the type alias `AnyContractProcedure`, which `@orpc/contract` exports for exactly this use.

### Why the casts exist (the structural root cause)

`vendor/observability` cannot depend on `api/app`, so it cannot import `InitialContext`. The natural shape of the typed middleware is `Middleware<InitialContext, Record<never, never>, unknown, unknown, ORPCErrorConstructorMap<...>, Meta>` — but `InitialContext` lives downstream. The current author worked around this by typing the parameter `any` and casting inside the body. tRPC has the same boundary problem and solves it via a generic `TCtx` on the factory (`vendor/observability/src/trpc.ts:41-56`), but oRPC's `Middleware<...>` interface is parameterized too tightly to be inferred from an inline `t.middleware(fn)` call — it benefits from an explicit return-type annotation instead.

### Public types we'll lean on

Verified by inspection of `node_modules/.pnpm/@orpc+*@1.14.2/.../dist/index.d.ts`:

- **`@orpc/server`** publicly exports: `Middleware`, `Context`, `Meta`, `ORPCErrorConstructorMap`, `MiddlewareOptions`, `MiddlewareNextFn`, `MiddlewareResult`, `AnyMiddleware`, `AnyProcedure`, `AnyRouter`, `Builder`, `Implementer`, `DecoratedMiddleware`, …
- **`@orpc/contract`** publicly exports: `AnyContractProcedure`, `AnyContractRouter`, `ContractProcedure`, `oc`, …
- **`Middleware<TInContext, TOutContext, TInput, TOutput, TErrorConstructorMap, TMeta>`** — the callable shape (shared/server.qKsRrdxW.d.ts:107) is `(opts: MiddlewareOptions<TInContext, TOutput, TErrorConstructorMap, TMeta>, input: TInput, output: MiddlewareOutputFn<TOutput>) => Promisable<MiddlewareResult<TOutContext, TOutput>>`.
- **`MiddlewareOptions<TInContext, ...>`** has `{ context: TInContext; path: readonly string[]; procedure; signal?; lastEventId; next; errors }` — i.e. `path` is already `readonly string[]` and `context` is `TInContext`, so once `TInContext` is fixed we get both for free without inline casts.

### Key Discoveries

- **The repo does not use ESLint.** Both `eslint-disable-next-line` comments are no-ops — they document a constraint but enforce nothing. Removing them is risk-free if the underlying `any` is removed. Verified: no `.eslintrc*` at repo root, `package.json` does not depend on ESLint at the root, lint runs via Biome/ultracite (`pnpm check` → `biome` + ultracite).
- **`InitialContext` is small.** Only `{ headers: Headers; requestId: string }` (`api/app/src/orpc/context.ts:1-4`). The observability factory only reads `context.requestId`, so the factory's `TInContext` only needs `{ requestId: string }` — strictly weaker than `InitialContext`, which makes it structurally assignable into a `Middleware<InitialContext, ...>` position by function-parameter contravariance.
- **Auth fields are read out of ALS, not the oRPC context.** `vendor/observability/src/orpc.ts:75-81` reads `enrichedCtx` returned by `withRequestContext(...)`, not the oRPC `context` parameter. So the observability middleware does not need to know about `AuthContext` and does not need to bridge to the post-`.use(authMiddleware)` context type.
- **`api/app/src/orpc/middleware/observability.ts` is correctly typed already.** Once the factory's return type is `Middleware<{ requestId: string }, ...>`, `base.middleware(...)` accepts it without any cast — that consumer file does not need to change.
- **`router/system.ts:8` already infers correctly.** `authed(apiContract.system.health).handler(({ context: _ctx }) => ...)` — `context` is inferred as `AuthContext` from the implementer chain. No `any` there today.
- **tRPC's solution is structurally different.** tRPC's factory uses an inline generic `<TCtx>` because `t.middleware(fn)` infers the parameter shape structurally. oRPC's `base.middleware(fn)` checks `fn` against a rigid `Middleware<TInContext, ...>` interface, so the parallel fix for oRPC is to *annotate the return type* of the factory rather than make it generic over `TCtx`.

## Desired End State

- `vendor/observability/src/orpc.ts` declares the factory return type as a concrete `Middleware<...>`; the inline arrow function takes a properly-typed `MiddlewareOptions<...>` argument (no `any`, no `as { requestId: string }`, no `as readonly string[]`). The `eslint-disable` comment is gone.
- `api/app/src/orpc/procedures.ts` constrains `P extends AnyContractProcedure` (imported from `@orpc/contract`). The `eslint-disable` comment is gone.
- `pnpm typecheck` passes across `@vendor/observability`, `@api/app`, `@repo/api-contract`, and `core/lightfast` without new diagnostics.
- All existing oRPC tests (`api/app/src/orpc/__tests__/*` and `core/lightfast/src/__tests__/**`) continue to pass.
- Grep for `eslint-disable` and for `any` in `vendor/observability/src/orpc.ts`, `api/app/src/orpc/**`, and `packages/api-contract/**` returns zero matches inside the oRPC type chain (only expected matches: test code, unrelated areas).

### How to verify
- `pnpm --filter @api/app typecheck` and `pnpm --filter @vendor/observability typecheck` are clean.
- `rg -n "eslint-disable" vendor/observability/src/orpc.ts api/app/src/orpc/ packages/api-contract/` returns empty.
- `rg -n ": any\b" vendor/observability/src/orpc.ts api/app/src/orpc/ packages/api-contract/src/` returns empty.
- `pnpm --filter @api/app test -- orpc` passes (auth + system-health unit tests).
- `pnpm --filter lightfast test` passes (integration test `system-health.test.ts` exercises the typed chain end-to-end).

## What We're NOT Doing

- No changes to the tRPC observability middleware. It uses a different (working) pattern and is out of scope.
- No changes to `@repo/api-contract` schemas or contract surface. The contract is correctly typed; this plan is purely about internal generics.
- No introduction of new oRPC procedures, middleware, or auth boundaries. The middleware chain `observability → auth` and the `authed()` factory stay structurally identical.
- No refactor of `vendor/observability/src/orpc.ts`'s logging/Sentry behavior — error classification, journal emission, and Sentry scope/span setup remain bit-for-bit identical.
- No move of types between packages. `InitialContext` / `AuthContext` stay in `api/app/src/orpc/context.ts`; the structural minimum (`{ requestId: string }`) is declared inline in the vendor file as a local type, not exported.
- No attempt to type `publicProcedure` / un-authed procedures. The oRPC stack today exposes only `authed()`; if/when an unauthed factory is added, it should follow the same `AnyContractProcedure` pattern.

## Implementation Approach

The fix is mechanical once the public types are identified. Three pieces of evidence drive the approach:

1. `Middleware<TInContext, TOutContext, TInput, TOutput, TErrorConstructorMap, TMeta>` is exported from `@orpc/server` — we can annotate the factory's return type directly.
2. `{ requestId: string }` is the *only* field the factory reads off `context`. Setting `TInContext = { requestId: string }` makes the function parameter type strictly weaker than `InitialContext`. By function-parameter contravariance, the factory's value is assignable wherever a `Middleware<InitialContext, ...>` is expected — including `base.middleware(...)` and `implementer.use(...)`.
3. `AnyContractProcedure` is the canonical alias for `ContractProcedure<any, any, any, any>` and is exported from `@orpc/contract`.

`TErrorConstructorMap` and `TMeta` are kept as generics on the factory with sensible defaults so that consumers who add `.errors({...})` or custom meta to their contract upstream still get the middleware to chain in. If TypeScript variance lets the no-generic form pass cleanly at the `procedures.ts` call site, the generics can be dropped later — that's a Phase 3 verification decision, not a Phase 1 design call.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Type the Vendor Observability Factory

### Overview

Replace the `any` parameter and inline casts in `createORPCObservabilityMiddleware` with a concrete `Middleware<...>` return type drawn from `@orpc/server`'s public types. The function body stays bit-identical — only the signature changes and the two `as` casts at lines 37-38 disappear.

### Changes Required:

#### 1. Imports

**File**: `vendor/observability/src/orpc.ts`
**Changes**: Add `Middleware`, `Meta`, `ORPCErrorConstructorMap` to the `@orpc/server` value/type imports. `ORPCError` continues to come from `@orpc/client`.

```ts
import "server-only";

import { ORPCError } from "@orpc/client";
import type {
  Meta,
  Middleware,
  ORPCErrorConstructorMap,
} from "@orpc/server";
import {
  captureException,
  getActiveSpan,
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN,
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE,
  startSpan,
  withIsolationScope,
} from "@sentry/core";

import { log } from "./log/next";
import { withRequestContext } from "./request";
```

#### 2. Factory signature

**File**: `vendor/observability/src/orpc.ts:34-38`
**Changes**: Drop the `eslint-disable`, drop the `: any`, drop the two casts. Annotate the factory's return type and let `MiddlewareOptions` typing do the work.

```ts
type ObservabilityContext = { requestId: string };

/**
 * Create an oRPC observability middleware that consolidates:
 * - Sentry isolation scope + span creation
 * - Error classification via ORPCError.status
 * - Selective Sentry capture (server errors only)
 * - Structured logging with trace ID correlation
 * - ALS request context seeding (requestId + traceId)
 * - Request journal emission
 *
 * Returns a `Middleware` parameterised with the *minimum* context shape it reads
 * (`{ requestId: string }`). This is structurally weaker than any concrete oRPC
 * `InitialContext` that includes `requestId`, so the value is assignable into
 * `base.middleware(...)` / `.use(...)` slots without a cast at the call site.
 *
 * `TErrorConstructorMap` and `TMeta` are inferred from the caller (defaults make
 * the no-arg form work in isolation).
 */
export function createORPCObservabilityMiddleware<
  TErrorConstructorMap extends ORPCErrorConstructorMap<any> = ORPCErrorConstructorMap<Record<never, never>>,
  TMeta extends Meta = Meta,
>(): Middleware<
  ObservabilityContext,
  Record<never, never>,
  unknown,
  unknown,
  TErrorConstructorMap,
  TMeta
> {
  return async ({ context, next, path }) => {
    const { requestId } = context;
    const procedurePath = path.join(".");
    // ...body is unchanged from lines 40-146...
  };
}
```

Body from line 40 (`return withIsolationScope(...)`) through line 146 (closing `);`) is unchanged. The only deletions inside the body are:

- The `as { requestId: string }` on line 37 — no longer needed; `context.requestId` is typed.
- The `as readonly string[]` on line 38 — no longer needed; `path` is already `readonly string[]` per `MiddlewareOptions`.

The single `any` that remains on the *type level* is the constraint `ORPCErrorConstructorMap<any>` in the default for `TErrorConstructorMap`. That `any` is fenced inside a generic constraint, not a value-level escape, and matches how oRPC's own internal types declare `DecoratedMiddleware extends Middleware<..., ORPCErrorConstructorMap<any>, ...>` (see shared/server.qKsRrdxW.d.ts:440). It is the idiomatic way to write "any error constructor map shape". If the user prefers, this can be `Record<never, never>` instead — record it as an open question only if Phase 3 typecheck flags variance issues.

### Success Criteria:

#### Automated Verification:

- [x] Typecheck passes: `pnpm --filter @vendor/observability typecheck`
- [x] Typecheck passes for downstream: `pnpm --filter @api/app typecheck`
- [x] Lint/format passes: `pnpm --filter @vendor/observability check` (Biome)
- [x] `rg -n "eslint-disable\|: any\b\| as { requestId\| as readonly string\[\]" vendor/observability/src/orpc.ts` returns empty
- [x] Unit tests still pass: `pnpm --filter @api/app test -- orpc/__tests__/system-health`

#### Human Review:

(None — every behavior change is observable to `pnpm typecheck` / unit tests.)

---

## Phase 2: Use `AnyContractProcedure` in the Procedure Factory

### Overview

Replace `ContractProcedure<any, any, any, any>` with the public alias `AnyContractProcedure`, drop the now-unnecessary `eslint-disable`. This is the single-file change the agent flagged in the original analysis at `api/app/src/orpc/procedures.ts:12`.

### Changes Required:

#### 1. Import + constraint

**File**: `api/app/src/orpc/procedures.ts`
**Changes**: swap `ContractProcedure` (type) for `AnyContractProcedure`. Imports come from `@orpc/server` (which re-exports from `@orpc/contract`) — using `@orpc/contract` directly is also acceptable; choose `@orpc/server` to keep the single-package import.

```ts
import { implement } from "@orpc/server";
import type { AnyContractProcedure } from "@orpc/contract";

import type { InitialContext } from "./context";
import { authMiddleware } from "./middleware/auth";
import { observabilityMiddleware } from "./middleware/observability";

/**
 * Wrap a contract procedure with the public oRPC middleware stack
 * (observability + API-key auth). Returns a typed implementer whose
 * `.handler(...)` is checked against the contract's output schema.
 */
export const authed = <P extends AnyContractProcedure>(proc: P) =>
  implement(proc)
    .$context<InitialContext>()
    .use(observabilityMiddleware)
    .use(authMiddleware);
```

Note: `AnyContractProcedure` lives in `@orpc/contract`. It is also re-exported via `@orpc/server` (verified at `@orpc/server/dist/shared/contract.TuRtB1Ca.js`). Either import path is acceptable; `@orpc/contract` is more direct.

### Success Criteria:

#### Automated Verification:

- [x] Typecheck passes: `pnpm --filter @api/app typecheck`
- [x] `authed(apiContract.system.health).handler(...)` in `api/app/src/orpc/router/system.ts:8` still type-checks (context inferred as `AuthContext`)
- [x] Lint/format passes: `pnpm --filter @api/app check`
- [x] `rg -n "eslint-disable\|<any, any, any, any>" api/app/src/orpc/procedures.ts` returns empty
- [x] All orpc unit tests pass: `pnpm --filter @api/app test -- orpc`

#### Human Review:

(None.)

---

## Phase 3: Audit + Integration Verification

### Overview

Sweep the oRPC chain for any residual `any` / `as` coercions, confirm the contract package and SDK client still typecheck, and run the integration test that exercises the full chain end-to-end (HTTP → oRPC handler → authed middleware → typed response → typed SDK client).

### Changes Required:

#### 1. Residual coercion audit

**Files**: `api/app/src/orpc/`, `vendor/observability/src/orpc.ts`, `packages/api-contract/`, `vendor/mcp/src/index.ts`, `core/lightfast/src/`
**Changes**: read-only audit. For each match, classify as (a) acceptable (e.g. inside a test using `as any` to forge a fixture) or (b) fixable. Acceptable matches are left in place. Fixable matches are repaired in this phase as small targeted edits.

Commands to run:

```bash
rg -n "\\bany\\b" vendor/observability/src/orpc.ts api/app/src/orpc/ packages/api-contract/src/ core/lightfast/src/index.ts vendor/mcp/src/index.ts
rg -n " as [A-Z]" vendor/observability/src/orpc.ts api/app/src/orpc/ packages/api-contract/src/
rg -n "@ts-ignore\\|@ts-expect-error" vendor/observability/src/orpc.ts api/app/src/orpc/ packages/api-contract/src/
```

Expected findings after Phase 1 + Phase 2:

- `vendor/observability/src/orpc.ts` — only `ORPCErrorConstructorMap<any>` in a generic constraint default (idiomatic; leave).
- `api/app/src/orpc/middleware/auth.ts:68` — `(err: unknown) =>` in a `.catch(...)` — already typed `unknown`, fine.
- `api/app/src/orpc/__tests__/*` — any test-only casts are acceptable; do not touch.
- `packages/api-contract/` — should have zero `any` / coercions in non-test code.

If anything else is found, repair it or document why it must stay (rare).

#### 2. End-to-end typecheck + tests

```bash
pnpm typecheck                                # workspace-wide
pnpm --filter @vendor/observability check
pnpm --filter @api/app check
pnpm --filter @repo/api-contract check
pnpm --filter @api/app test -- orpc
pnpm --filter lightfast test                  # integration: system-health.test.ts
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` is clean workspace-wide (no new diagnostics introduced by this plan)
- [x] `pnpm --filter @api/app test -- orpc` passes (auth.test.ts + system-health.test.ts)
- [x] `pnpm --filter lightfast test -- system-health` type-compiles (runtime gated by `LIGHTFAST_RUN_INTEGRATION=1`; test file imports without type errors — that's the type-regression check the plan calls out)
- [x] `rg -n "eslint-disable" vendor/observability/src/orpc.ts api/app/src/orpc/ packages/api-contract/` returns empty
- [x] `rg -n ": any\\b\\| as { requestId" vendor/observability/src/orpc.ts api/app/src/orpc/procedures.ts api/app/src/orpc/middleware/` returns empty
- [x] Biome passes on modified files: `pnpm exec biome check vendor/observability/src/orpc.ts api/app/src/orpc/procedures.ts`

#### Human Review:

- [ ] Open `api/app/src/orpc/router/system.ts:8` in editor, hover over `context` parameter → tooltip shows `AuthContext` (verifies inference flows through both middlewares end-to-end, not just the procedure signature).
- [ ] Open `vendor/observability/src/orpc.ts:36` in editor, hover over `context` and `path` parameters → tooltip shows `{ requestId: string }` and `readonly string[]` respectively (no `any`).

---

## Testing Strategy

### Unit Tests

The existing tests already exercise the typed surface and require no changes. The plan succeeds when they continue to pass without modification:

- `api/app/src/orpc/__tests__/auth.test.ts` — exercises `authMiddleware` against a mock request; verifies API-key validation paths.
- `api/app/src/orpc/__tests__/system-health.test.ts` — exercises the `authed(apiContract.system.health).handler(...)` chain; this is the primary check that the middleware stack still type-checks and runs.

If any test fails with a *type* error (rather than a behavioral one), the fix is in the plan, not the tests.

### Integration Tests

`core/lightfast/src/__tests__/integration/system-health.test.ts` runs against a real `/api/v1` mount. It validates the full chain:
- HTTP catch-all in `apps/app/src/app/(api)/api/v1/[...rest]/route.ts` → `OpenAPIHandler(orpcRouter)` → `observabilityMiddleware` → `authMiddleware` → typed handler → typed response → typed `@orpc/client` consumer.

If type-inference regresses anywhere in that chain, the integration test will fail at type-compile time before runtime.

### Edge cases worth confirming during Phase 3 review

- Adding a future `.errors({ ... })` clause to a contract procedure must still allow `authed()` to wrap it — the generic `TErrorConstructorMap` default in the factory should keep this working. If a future PR adds `.errors(...)` and gets a type error, the fix is to drop the default and let TS infer.
- Adding `.meta({ ... })` to a contract procedure — similar reasoning via `TMeta`.

## Performance Considerations

None. This plan is entirely type-level. Generated JavaScript is unchanged.

## Migration Notes

None. No runtime contract changes. No DB / Redis / external-service surface touched.

## References

- Original prompt: user noted "2 rando eslint disable's" in `@vendor/observability/src/orpc.ts` + `@api/app/src/orpc/middleware/observability.ts` — second disable is actually in `api/app/src/orpc/procedures.ts:12`, not the middleware file (verified).
- Current `any` escapes:
  - `vendor/observability/src/orpc.ts:35` (factory parameter), `:37` (`context as`), `:38` (`path as`)
  - `api/app/src/orpc/procedures.ts:12` (`ContractProcedure<any, any, any, any>`)
- tRPC parallel (different pattern, do not copy): `vendor/observability/src/trpc.ts:41-56`
- oRPC public types (verified): `@orpc/server` exports `Middleware`, `Context`, `Meta`, `ORPCErrorConstructorMap`, `MiddlewareOptions`; `@orpc/contract` exports `AnyContractProcedure`. See `node_modules/.pnpm/@orpc+server@1.14.2.../dist/index.d.ts` lines 7-8 and `@orpc+contract@1.14.2.../dist/index.d.ts` line 4.
- Procedure factory and downstream consumer: `api/app/src/orpc/procedures.ts:13`, `api/app/src/orpc/router/system.ts:8`.
- Recent commit baseline: `488e934be feat(sdk): wire createLightfast and MCP server through apiContract`, `23a0084f0 feat(app): mount oRPC public API at /api/v1 and consolidate API-key auth`, `10c31e6d6 feat(api-contract): scaffold @repo/api-contract with system.health`.
