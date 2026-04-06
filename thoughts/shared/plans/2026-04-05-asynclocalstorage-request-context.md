# AsyncLocalStorage Request Context + Request Journal — Implementation Plan

## Overview

Add AsyncLocalStorage-based request context propagation so every log call automatically includes request-scoped identity fields (e.g., `requestId`, `userId`, `orgId`, `caller`) without manual parameter drilling. The context primitive is **app-agnostic** — the vendor package enforces only `requestId`; each app passes whatever additional identity fields it needs. Additionally, accumulate a **request journal** — a structured, ordered array of every log entry within a request — emitted as a single log entry at request end. This gives complete request reconstruction from one BetterStack query instead of scattered log line correlation.

This is the Tier 2 follow-up to the Tier 1 observability work (completed in `fe187cf63`).

## Current State Analysis

**Tier 1 complete**: 6 platform files now have structured logging, tRPC `observabilityMiddleware` logs outcome/identity/timing, error classification filters Sentry noise. All checks pass.

**Logging pattern** (consistent across 53 consumers):
```typescript
import { log } from "@vendor/observability/log/next";
log.info("[module] message", { key: value });
```

**Problem**: Every log call must manually include `requestId`, `userId`, `orgId`, etc. This means:
- Callers deep in the stack don't have access to request-level identity
- Adding context requires drilling parameters through every function signature
- Inconsistent context across log lines within the same request
- Debugging a failed request requires searching BetterStack for a requestId and mentally reconstructing the sequence from scattered log lines

### Key Discoveries

- `vendor/observability/src/log/next.ts` (10 lines) conditionally exports `logtail` or `console` as `log` — `vendor/observability/src/log/next.ts:8`
- `vendor/observability/src/log/types.ts` exports a `Logger` interface with `info/warn/error/debug` — already the exact shape we need
- Nobody imports the `Logger` type from either `log/next` or `log/types` — clean slate for type changes
- No consumer calls non-standard methods (`log.log()`, `log.trace()`, `log.table()`) — all 53 use only `info/warn/error/debug`
- `"server-only"` import at line 1 of `next.ts` — context file needs the same
- Export pattern in `vendor/observability/package.json`: `{ "types": "./src/...", "default": "./src/..." }` pointing to `.ts` source
- `api/platform/src/trpc.ts:120` — `const result = await next()` is the wrap target; auth context is `MemoryAuthContext` (service/webhook/inngest/cron/unauthenticated)
- `api/app/src/trpc.ts:166` — `const result = await next()` is the wrap target; auth context is `AuthContext` (clerk-active/clerk-pending/unauthenticated)
- Relative path from `log/next.ts` to `context.ts` is `"../context"` (context.ts sits in `src/`, not `src/log/`)
- `nanoid` from `@repo/lib` (`packages/lib/src/nanoid.ts`) uses `customAlphabet` with 62-char alphanumeric set — already a dependency of both `api/app` and `api/platform`, but NOT of `vendor/observability` — so ID generation belongs in the middleware, not the context primitive

## Desired End State

1. `requestStore` AsyncLocalStorage instance exists at `@vendor/observability/context` — a composite `RequestStore` type cleanly separates identity (`ctx: RequestContext`) from accumulation (`journal: JournalEntry[]`). `RequestContext` is an open record (`{ requestId: string } & Record<string, unknown>`) — the vendor package is app-agnostic; each middleware passes its own identity fields
2. The existing `log` export from `@vendor/observability/log/next` is **transparently context-aware** — when called inside `requestStore.run()`, it auto-merges request context into every log call's metadata AND pushes each entry into the request journal; when called outside, it behaves identically to today
3. `withRequestContext()` and `emitJournal()` helpers at `@vendor/observability/request` eliminate middleware duplication
4. Both tRPC `observabilityMiddleware` instances use `withRequestContext()` to wrap `next()` and `emitJournal()` to emit the journal at request end
5. **All 53 existing consumers automatically benefit** — zero import changes, zero migration
6. A single BetterStack query on `"[trpc] request journal"` reconstructs the full causal chain of any request
7. Request IDs use `nanoid` from `@repo/lib` (consistent with all other IDs in the codebase)

### Verification

- `pnpm check && pnpm typecheck` passes
- `vendor/observability/src/context.ts` exists and exports `requestStore`, `createStore`, `getContext`, `getJournal`, `pushJournal`, and `JournalEntry`
- `vendor/observability/src/request.ts` exists and exports `withRequestContext` and `emitJournal`
- `grep -rn "AsyncLocalStorage" vendor/observability/src/context.ts` shows the import
- `grep -rn "withRequestContext" api/app/src/trpc.ts api/platform/src/trpc.ts` shows both files
- `grep -rn "emitJournal" api/app/src/trpc.ts api/platform/src/trpc.ts` shows both files
- `grep -rn "nanoid" api/app/src/trpc.ts api/platform/src/trpc.ts` shows both files using nanoid for requestId
- `grep -rn "request journal" api/app/src/trpc.ts api/platform/src/trpc.ts` shows journal emission in both files
- **No `contextLog` export exists anywhere** — `grep -rn "contextLog" vendor/observability/` returns nothing
- **No import changes in any of the 53 consumer files** — all still import `{ log } from "@vendor/observability/log/next"`

## Design Decisions

### Why transparent enrichment instead of `contextLog`

The original plan proposed a parallel `contextLog` export alongside the existing `log`, with consumers opting in via `import { contextLog as log }`. This approach has several code smells:

1. **Parallel API**: Creates a two-tier system with 53 files eventually needing migration and a permanent "which do I import?" decision for every new file
2. **Invisible aliasing**: `import { contextLog as log }` hides the semantic distinction — `log.info(...)` looks identical whether enriched or not; only the import line tells you
3. **Manual method enumeration**: The `contextLog` object manually wraps `info/warn/error/debug` — fragile if methods are added, and classic duplication
4. **Partial journal coverage**: Only opted-in files contribute to the journal, requiring file-by-file migration

**Transparent enrichment** makes the existing `log` itself context-aware:
- `getContext()` returns `{}` outside a request scope — behavior identical to today
- `pushJournal()` is a no-op outside a request scope — no journal side effects
- All 53 consumers automatically get enrichment and journal contribution with zero code changes
- No dual-import confusion, no migration tail, no Phase 4

### Why `withRequestContext()` helper instead of inline store creation

The original plan duplicated store creation + journal emission in both tRPC files. The `withRequestContext()` helper:
- Eliminates copy-paste of `requestStore.run()` + timing + journal emission
- Provides a clean API for any future entry point (API routes, webhooks) to adopt request context
- Encapsulates timing inside the helper (DRY)

### Why `createStore()` factory instead of inline construction

Eliminates the inline type assertion `[] as import("@vendor/observability/context").JournalEntry[]` that the original plan required at each call site. The factory returns a properly typed `RequestStore`.

### Why `RequestContext` is an open record, not a fixed interface

`vendor/observability` is a general-purpose vendor package. Hardcoding `userId`, `orgId`, `caller` as named fields couples it to Lightfast's specific identity model. The two apps already have **different** context shapes:

- **Platform**: `{ requestId, caller }` (service-to-service JWT)
- **App**: `{ requestId, userId, orgId }` (Clerk auth)

There is no single shared "app context" type — creating a package to house two unrelated interfaces is type-definition bureaucracy. Instead:

- The vendor package enforces only the universal minimum: `{ requestId: string } & Record<string, unknown>`
- Each middleware passes whatever identity fields it has at the `withRequestContext()` call site
- `getContext()` returns `Record<string, unknown>` — sufficient for log enrichment (spreading into metadata)
- TypeScript infers the shape at each call site — no separate type definitions needed

**Future extension**: If a downstream consumer ever needs to read typed context (e.g., `getContext().userId` with type safety), create `packages/app-observability` with typed accessor functions at that point. Not now — YAGNI.

## What We're NOT Doing

- **Adding a `contextLog` export** — `log` itself is context-aware; no parallel API needed
- **Changing any of the 53 consumer imports** — zero migration; enrichment is transparent
- **Adding context to Inngest functions** — Inngest has its own execution context; wiring AsyncLocalStorage there is a separate concern
- **OpenTelemetry trace ID propagation** — separate initiative
- **Persisting journals to a database** — journals are emitted as structured log entries to BetterStack only
- **Adding `./log/context` export path** — unnecessary since `log` itself is context-aware
- **Adding meta value truncation** — premature defensiveness; BetterStack handles large payloads natively
- **Hardcoding app-specific fields in the vendor package** — `RequestContext` is an open record; `userId`/`orgId`/`caller` are app concerns, not vendor concerns
- **Creating a shared app-context package** — the two apps have different context shapes; a shared type would house two unrelated interfaces (YAGNI)

## Implementation Approach

3 phases, each independently verifiable. The context primitive and logger modification come first, then the request lifecycle helper, then middleware wiring.

---

## Phase 1: Context Primitive + Context-Aware Logger [DONE]

### Overview

Create the `AsyncLocalStorage` instance with a composite `RequestStore` type. Then modify the existing `log` export in `next.ts` to transparently enrich with request context and push to the journal. This phase has **zero consumer impact** — no import changes anywhere.

### Design

```
RequestStore (single AsyncLocalStorage)
├── ctx: RequestContext     ← open record: { requestId } + arbitrary app fields
└── journal: JournalEntry[] ← accumulation, append-only
```

`RequestContext` is `{ requestId: string } & Record<string, unknown>` — the vendor package enforces only the universal minimum. Each app passes its own identity fields (`userId`, `orgId`, `caller`, etc.) at the `createStore()` call site.

`getContext()` reads `store.ctx` — returns `{}` when no store is active.
`pushJournal()` appends to `store.journal` — no-op when no store is active.
`getJournal()` reads `store.journal` — returns `[]` when no store is active.
`createStore()` returns a properly typed `RequestStore` — eliminates inline type assertions.

The `log` export wraps the underlying `baseLog` (logtail or console) with a thin layer that calls `pushJournal()` + spreads `getContext()` into metadata on every call. Outside a request scope, both are no-ops and behavior is identical to today.

### Changes Required

#### 1. New file: `vendor/observability/src/context.ts`

**File**: `vendor/observability/src/context.ts` (new)

```typescript
import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

const MAX_JOURNAL_ENTRIES = 50;

// -- Identity (read-only after creation) --------------------------------------
// Open record: vendor enforces only `requestId`; apps pass whatever they need.

export type RequestContext = { requestId: string } & Record<string, unknown>;

// -- Journal (append-only accumulation) ---------------------------------------

export interface JournalEntry {
  ts: number;
  level: "info" | "warn" | "error" | "debug";
  msg: string;
  meta?: Record<string, unknown>;
}

// -- Composite store ----------------------------------------------------------

export interface RequestStore {
  ctx: RequestContext;
  journal: JournalEntry[];
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

/** Type-safe store factory — eliminates `as` assertions at call sites. */
export function createStore(ctx: RequestContext): RequestStore {
  return { ctx, journal: [] };
}

export function getContext(): Record<string, unknown> {
  return requestStore.getStore()?.ctx ?? {};
}

export function getJournal(): readonly JournalEntry[] {
  return requestStore.getStore()?.journal ?? [];
}

export function pushJournal(
  level: JournalEntry["level"],
  msg: string,
  meta?: Record<string, unknown>,
): void {
  const store = requestStore.getStore();
  if (!store || store.journal.length >= MAX_JOURNAL_ENTRIES) return;
  store.journal.push({ ts: Date.now(), level, msg, meta });
}
```

#### 2. Modify `vendor/observability/src/log/next.ts`

**File**: `vendor/observability/src/log/next.ts` (modify)
**Changes**: Wrap the existing `log` export with context enrichment. Do NOT add a separate `contextLog` — `log` itself becomes context-aware.

Replace the entire file:

```typescript
import "server-only";

import { log as logtail } from "@logtail/next";
import { betterstackEnv } from "../env/betterstack";
import { getContext, pushJournal } from "../context";

const shouldUseBetterStack = betterstackEnv.VERCEL_ENV === "production";

const baseLog = shouldUseBetterStack ? logtail : console;

type LogLevel = "info" | "warn" | "error" | "debug";

function enriched(level: LogLevel) {
  return (msg: string, meta?: Record<string, unknown>) => {
    pushJournal(level, msg, meta);
    baseLog[level](msg, { ...getContext(), ...meta });
  };
}

export const log = {
  info: enriched("info"),
  warn: enriched("warn"),
  error: enriched("error"),
  debug: enriched("debug"),
};

export type Logger = typeof log;
```

**Why `enriched()` factory instead of 4 manual methods**: Single function generates all 4 methods — DRY, and adding a level is one array entry.

**Why `meta` spreads AFTER `getContext()`**: Callers can override any context field if needed. `pushJournal` only records the caller-provided `meta` (not the context fields, which are already on the journal's parent `RequestContext`).

**Graceful outside request scope**: `getContext()` returns `{}` (empty spread = no-op). `pushJournal` returns immediately (no store check). Net effect: identical to today's behavior for all 53 consumers.

**Open record context**: The logger spreads `getContext()` (a `Record<string, unknown>`) into metadata. It doesn't know or care whether the fields are `userId`, `caller`, `tenantId`, or anything else — it just merges whatever the middleware put into the store. This keeps the vendor package app-agnostic.

#### 3. Add export paths in `vendor/observability/package.json`

**File**: `vendor/observability/package.json`

Add one new export entry (following the existing pattern):

```json
"./context": {
  "types": "./src/context.ts",
  "default": "./src/context.ts"
},
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "AsyncLocalStorage" vendor/observability/src/context.ts` shows the import
- [x] `grep -rn "requestStore" vendor/observability/src/context.ts` shows the export
- [x] `grep -rn "createStore" vendor/observability/src/context.ts` shows the factory
- [x] `grep -rn "pushJournal" vendor/observability/src/context.ts vendor/observability/src/log/next.ts` shows export + 4 usage sites
- [x] `grep -rn "getContext" vendor/observability/src/context.ts vendor/observability/src/log/next.ts` shows export + usage
- [x] `grep -rn "contextLog" vendor/observability/` returns nothing (no parallel API)
- [x] Existing `log` import paths unchanged across all 53 consumers

**Implementation Note**: This phase has no runtime effect on existing consumers until Phase 3 seeds the AsyncLocalStorage via `requestStore.run()`. Proceed immediately to Phase 2.

---

## Phase 2: Request Lifecycle Helper [DONE]

### Overview

Create `withRequestContext()` and `emitJournal()` helpers that encapsulate the `requestStore.run()` + timing + journal emission pattern. This eliminates the middleware duplication that would otherwise exist in both tRPC files.

### Changes Required

#### 1. New file: `vendor/observability/src/request.ts`

**File**: `vendor/observability/src/request.ts` (new)

```typescript
import "server-only";

import type { RequestContext, JournalEntry } from "./context";
import { requestStore, createStore } from "./context";
import { log } from "./log/next";

interface RequestResult<T> {
  result: T;
  journal: readonly JournalEntry[];
  durationMs: number;
}

/**
 * Run an async function within a request context scope.
 * All `log` calls inside `fn` automatically get context enrichment and journal accumulation.
 */
export async function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T>,
): Promise<RequestResult<T>> {
  const store = createStore(ctx);
  const start = Date.now();
  const result = await requestStore.run(store, fn);
  const durationMs = Date.now() - start;
  return { result, journal: store.journal, durationMs };
}

/**
 * Emit the request journal as a single structured log entry.
 * No-op if the journal is empty.
 */
export function emitJournal(
  journal: readonly JournalEntry[],
  meta: Record<string, unknown>,
): void {
  if (journal.length === 0) return;
  log.info("[trpc] request journal", {
    ...meta,
    entryCount: journal.length,
    entries: journal,
  });
}
```

**Note on circular dependency**: `request.ts` imports from `./context` and `./log/next`. `log/next.ts` imports from `../context`. There is no cycle — `context.ts` imports from neither.

#### 2. Add export path in `vendor/observability/package.json`

**File**: `vendor/observability/package.json`

Add export entry:

```json
"./request": {
  "types": "./src/request.ts",
  "default": "./src/request.ts"
},
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "withRequestContext" vendor/observability/src/request.ts` shows the export
- [x] `grep -rn "emitJournal" vendor/observability/src/request.ts` shows the export
- [x] `grep -rn "requestStore.run" vendor/observability/src/request.ts` shows the usage

**Implementation Note**: This phase has no runtime effect — it only creates the helper. Proceed immediately to Phase 3.

---

## Phase 3: Wire Context + Journal into tRPC Middleware [DONE]

### Overview

Both `observabilityMiddleware` instances use `withRequestContext()` to wrap `next()` and `emitJournal()` to emit the journal. Identity extraction differs per app (the only app-specific part). Timing moves inside `withRequestContext()`, so `const start = Date.now()` and manual duration calculation are removed from the middleware.

### Changes Required

#### 1. `api/platform/src/trpc.ts`

**File**: `api/platform/src/trpc.ts`
**Changes**: Import `withRequestContext`, `emitJournal`, and `nanoid`. Replace inline `next()` call with `withRequestContext()` wrapper. Remove manual timing. Add journal emission.

Add imports (after line 9):
```typescript
import { nanoid } from "@repo/lib";
import { withRequestContext, emitJournal } from "@vendor/observability/request";
```

Replace the observabilityMiddleware body (lines 112–140) with:

```typescript
const observabilityMiddleware = t.middleware(
  async ({ next, path, ctx, type }) => {
    if (t._config.isDev) {
      const waitMs = Math.floor(Math.random() * 400) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const { result, journal, durationMs } = await withRequestContext(
      {
        requestId: nanoid(),
        ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
      },
      () => next(),
    );

    const meta = {
      path,
      type,
      durationMs,
      ok: result.ok,
      ...(!result.ok && { errorCode: result.error?.code }),
      ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
    };

    if (result.ok) {
      log.info("[trpc] procedure completed", meta);
    } else {
      log.warn("[trpc] procedure failed", meta);
    }

    emitJournal(journal, { path, durationMs, ok: result.ok });

    return result;
  }
);
```

**What changed**: `const start = Date.now()` and `Date.now() - start` are gone — timing is inside `withRequestContext()`. The `next()` call runs inside `requestStore.run()`, so all downstream `log` calls automatically get `requestId` + `caller`.

#### 2. `api/app/src/trpc.ts`

**File**: `api/app/src/trpc.ts`
**Changes**: Same structure as platform, different identity extraction.

Add imports (after line 15):
```typescript
import { nanoid } from "@repo/lib";
import { withRequestContext, emitJournal } from "@vendor/observability/request";
```

Replace the observabilityMiddleware body (lines 156–192) with:

```typescript
const observabilityMiddleware = t.middleware(
  async ({ next, path, ctx, type }) => {
    if (t._config.isDev) {
      const waitMs = Math.floor(Math.random() * 400) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const { result, journal, durationMs } = await withRequestContext(
      {
        requestId: nanoid(),
        ...(ctx.auth.type === "clerk-active" && {
          userId: ctx.auth.userId,
          orgId: ctx.auth.orgId,
        }),
        ...(ctx.auth.type === "clerk-pending" && {
          userId: ctx.auth.userId,
        }),
      },
      () => next(),
    );

    const meta = {
      path,
      type,
      durationMs,
      ok: result.ok,
      ...(!result.ok && { errorCode: result.error?.code }),
      ...(ctx.auth.type === "clerk-active" && {
        userId: ctx.auth.userId,
        orgId: ctx.auth.orgId,
      }),
      ...(ctx.auth.type === "clerk-pending" && {
        userId: ctx.auth.userId,
      }),
    };

    if (result.ok) {
      log.info("[trpc] procedure completed", meta);
    } else {
      log.warn("[trpc] procedure failed", meta);
    }

    emitJournal(journal, { path, durationMs, ok: result.ok });

    return result;
  }
);
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "withRequestContext" api/app/src/trpc.ts api/platform/src/trpc.ts` shows both files
- [x] `grep -rn "emitJournal" api/app/src/trpc.ts api/platform/src/trpc.ts` shows both files
- [x] `grep -rn "nanoid" api/app/src/trpc.ts api/platform/src/trpc.ts` shows both files
- [x] `grep -rn "request journal" vendor/observability/src/request.ts` shows journal emission

#### Manual Verification

- [ ] Run `pnpm dev:app`, make a tRPC call — verify no errors in console, verify `[trpc] procedure completed` logs now include `requestId`
- [ ] Run `pnpm dev:platform`, make a platform tRPC call — verify no errors in console, verify `requestId` and `caller` appear in logs
- [ ] Verify that `[trpc] request journal` log entries appear with ordered `entries` array
- [ ] Verify that downstream `log` calls in platform router files (proxy, connections, backfill) automatically include `requestId` in their metadata — with zero import changes

---

## Testing Strategy

### Unit Tests

No new unit tests required. This is additive observability plumbing — the context-aware `log` is a thin wrapper over the existing logger, and `AsyncLocalStorage` is a Node.js runtime primitive. The existing test suites validate functional behavior hasn't changed.

### Integration Tests

Not applicable. The changes are observability-only.

### Manual Testing Steps

1. **Context propagation**: Make a tRPC call through the app. Check that logs from the `observabilityMiddleware` include `requestId`. Then check that any downstream `log` calls (in any of the 53 consumer files) also show the same `requestId` — with no import changes.
2. **Identity propagation**: Sign in as a user with an org, make a tRPC call. Verify `userId` and `orgId` appear in the context-enriched logs.
3. **No context fallback**: Call `log.info(...)` outside of a `requestStore.run()` scope (e.g., during module init, in Inngest functions). Verify it logs normally with no context fields and no journal push — identical to today's behavior, no crashes.
4. **Journal reconstruction**: Trigger a platform proxy request that exercises multiple code paths (token acquisition -> proxy -> response parse). Find the `[trpc] request journal` log entry in the terminal. Verify it contains the ordered array of all log entries from that request. Confirm a single log entry is sufficient to understand the full request lifecycle.
5. **Journal cap**: Verify that requests generating >50 log calls have their journal capped at 50 entries (the individual log lines still fire — only the journal array stops growing).

## Performance Considerations

- **AsyncLocalStorage**: Node.js's `AsyncLocalStorage` has negligible overhead (~1us per `run()`/`getStore()`). It's used extensively in production by Next.js itself for request isolation.
- **`getContext()` on every log call**: One `getStore()` property read. Nanoseconds. `store.ctx` is a direct property access.
- **`pushJournal()` on every log call**: One `getStore()` + array push + shallow meta copy. Nanoseconds. No-op outside request scope.
- **`nanoid()`**: `customAlphabet` from `nanoid` — fast CSPRNG-based ID generation. One per request.
- **Journal accumulation**: Array push per log call. Max 50 entries x ~200 bytes = ~10KB worst case per request. The journal is GC'd with the request store at request end.
- **Journal emission**: One additional `log.info` call per request with the journal array. BetterStack/Logtail handles structured JSON natively.
- **Net overhead for existing consumers**: Two function calls (`getContext()` + `pushJournal()`) per `log.info/warn/error/debug` invocation, both of which resolve to a single `getStore()` read that returns `undefined` outside a request scope. This is ~2us per log call — undetectable.

## Migration Notes

No data migrations. All changes are additive:
- New file: `vendor/observability/src/context.ts`
- New file: `vendor/observability/src/request.ts`
- Modified: `vendor/observability/src/log/next.ts` (log becomes context-aware)
- Modified: `vendor/observability/package.json` (2 new export paths: `./context`, `./request`)
- Modified: 2 `trpc.ts` files (wrap `next()` in `withRequestContext()` + emit journal)
- **No changes to any of the 53 consumer files** — zero import migration
- **No `contextLog` export** — no parallel API, no dual-import confusion
- Files using `log` outside a request scope continue to work identically — `getContext()` returns `{}` and `pushJournal()` is a no-op

## Comparison with Original Plan

| Aspect | Original Plan | Redesign |
|---|---|---|
| Consumer migration | 6 files now, 47 later | **0 files — ever** |
| Parallel APIs | `log` + `contextLog` | **Single `log`** |
| Import pattern | `import { contextLog as log }` | **No changes** |
| Method duplication | 4 manual methods | **`enriched()` factory** |
| Middleware duplication | Copy-paste in 2 files | **`withRequestContext()` helper** |
| Type assertions | `[] as import(...).JournalEntry[]` | **`createStore()` factory** |
| Context type | Hardcoded `userId`/`orgId`/`caller` | **Open record: `{ requestId } & Record<string, unknown>`** |
| Journal coverage | 6 opted-in files | **All files automatically** |
| New export paths | `./context` + `./log/context` | **`./context` + `./request`** |
| Implementation phases | 4 (including migration) | **3 (no migration phase)** |

## References

- Tier 1 plan (completed): `thoughts/shared/plans/2026-04-05-tier1-observability-primitives.md`
- Tier 1 commit: `fe187cf63`
- Logger source: `vendor/observability/src/log/next.ts`
- Logger types: `vendor/observability/src/log/types.ts` (existing `Logger` interface with `info/warn/error/debug`)
- Platform tRPC: `api/platform/src/trpc.ts:111-140`
- App tRPC: `api/app/src/trpc.ts:156-192`
- Package exports: `vendor/observability/package.json:7-31`
- nanoid utility: `packages/lib/src/nanoid.ts` (62-char alphanumeric `customAlphabet`)
