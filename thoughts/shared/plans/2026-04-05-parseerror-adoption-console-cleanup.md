# `parseError` Adoption + Console Cleanup — Implementation Plan

## Overview

Make the `parseError` utility universal by removing its `server-only` guard, replace 46 manual error extraction patterns across the codebase with `parseError`, and clean up `console.*` calls in `apps/app/src/` by migrating server-side calls to structured logging and removing redundant client-side calls.

## Current State Analysis

**`parseError` utility** (`vendor/observability/src/error/next.ts`): A 4-branch error-to-string resolver exported via `@vendor/observability/error/next`. Has `import "server-only"` at line 1, which blocks client component imports. Has **zero import-based call sites** — all 46 error extraction sites use inline `err instanceof Error ? err.message : String(err)`.

**Console calls in `apps/app/src/`**: 14 `console.*` calls across 11 files. 3 are in server-side files that can use the structured `log` from `@vendor/observability/log/next`. 2 are redundant alongside existing `captureException` calls. The remaining 9 are client-side error paths already captured by `captureConsoleIntegration({ levels: ["error", "warn"] })`.

### Key Discoveries

- `parseError` covers 4 branches (Error, duck-typed `{ message }`, raw string, `String()` fallback) vs the manual pattern's 2 branches — `vendor/observability/src/error/next.ts:3-14`
- The catch binding at `apps/platform/src/app/api/ingest/[provider]/route.ts:150` is named `parseError`, shadowing the utility — must be renamed
- `core/ai-sdk/src/core/primitives/agent.ts` uses `error instanceof Error ? error : undefined` for a `cause` argument alongside the message extraction — only the message part changes
- Form B sites (`"Unknown error"` fallback) exist in `api/app/src/lib/activity.ts` at lines 167, 263, 386 — `parseError` returns `String(value)` instead, a minor behavioral change for non-Error throws
- Server files `layout.tsx`, `invite-teammates.ts`, `gateway/stream/route.ts` already import nothing from `@vendor/observability` — need to add import
- `(early-access)/error.tsx:32` and `(auth)/error.tsx:30` both call `captureException` then `console.error` in the same `useEffect` — the `console.error` is redundant

## Desired End State

1. `parseError` has no `server-only` guard — usable in both server and client code
2. All 46 inline `err instanceof Error ? err.message : String(err)` patterns replaced with `parseError(err)`
3. Zero `console.*` calls in server-side files within `apps/app/src/` — all replaced with structured `log`
4. Redundant `console.error` calls removed from error pages that already call `captureException`

### Verification

- `pnpm check && pnpm typecheck` passes
- `grep -rn "server-only" vendor/observability/src/error/` returns nothing
- `grep -rn "instanceof Error ? .*\.message : String(" --include="*.ts" --include="*.tsx" api/ apps/ packages/ vendor/ core/` returns zero hits (excluding `thoughts/`)
- `grep -rn "instanceof Error ? .*\.message : \"Unknown" --include="*.ts" --include="*.tsx" api/ apps/ packages/ vendor/ core/` returns zero hits
- `grep -rn "console\." apps/app/src/app/(app)/(org)/\[slug\]/layout.tsx apps/app/src/app/api/gateway/stream/route.ts apps/app/src/app/\(early-access\)/error.tsx apps/app/src/app/\(auth\)/error.tsx` returns zero hits
- `grep -rn "parseError" vendor/observability/src/error/next.ts` shows the utility definition
- `grep -rn "from.*@vendor/observability/error/next" api/ apps/ packages/ vendor/ core/` returns 28+ import sites

## What We're NOT Doing

- **Client-side logger** — no `@vendor/observability/log/client` export. Client `console.error` calls that aren't redundant stay as-is (captured by `captureConsoleIntegration`)
- **`captureException` additions** — error boundaries and client error paths are a separate follow-up plan
- **Error boundary rework** — `page-error-boundary.tsx` and `org-page-error-boundary.tsx` keep their `console.error` calls (slated for separate rework)
- **Export path rename** — `./error/next` stays as-is despite removing `server-only`; renaming adds churn with no functional benefit

## Implementation Approach

This is a mechanical refactor with no behavioral risk. Phase 1 removes the guard. Phase 2 is the bulk replacement (46 sites). Phase 3 handles server console migration. Phase 4 removes redundant client console calls. Each phase is independently safe to land.

---

## Phase 1: Remove `server-only` Guard from `parseError` [DONE]

### Overview

Remove the `import "server-only"` guard so `parseError` can be imported from client components.

### Changes Required

#### 1. `vendor/observability/src/error/next.ts`

**Changes**: Remove `import "server-only"` (line 1)

```ts
// Before:
import "server-only";

export const parseError = (error: unknown): string => {
  // ...
};

// After:
export const parseError = (error: unknown): string => {
  // ...
};
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "server-only" vendor/observability/src/error/next.ts` returns nothing

---

## Phase 2: Adopt `parseError` Across Codebase (46 sites, ~28 files) [DONE]

### Overview

Replace all inline `err instanceof Error ? err.message : String(err)` expressions with `parseError(err)`. Grouped by directory for review clarity.

### Replacement Patterns

**Pattern A — Simple (most sites):**
```ts
// Before:
error: err instanceof Error ? err.message : String(err),

// After:
error: parseError(err),
```

**Pattern B — Dual-use (backfill.ts, proxy.ts):**
```ts
// Before:
} catch (err) {
  log.error("...", { error: err instanceof Error ? err.message : String(err) });
  throw new TRPCError({
    message: `...: ${err instanceof Error ? err.message : String(err)}`,
  });
}

// After:
} catch (err) {
  const message = parseError(err);
  log.error("...", { error: message });
  throw new TRPCError({ message: `...: ${message}` });
}
```

**Pattern C — Custom error constructors (agent.ts):**
```ts
// Before:
throw new ContextCreationError(
  "runtime",
  error instanceof Error ? error.message : String(error),
  error instanceof Error ? error : undefined
);

// After:
throw new ContextCreationError(
  "runtime",
  parseError(error),
  error instanceof Error ? error : undefined  // unchanged — cause arg
);
```

**Pattern D — Form B "Unknown error" (activity.ts):**
```ts
// Before:
error: error instanceof Error ? error.message : "Unknown error",

// After:
error: parseError(error),
// Note: non-Error throws now return String(value) instead of "Unknown error"
```

**Pattern E — Catch binding shadow (ingest route):**
```ts
// Before:
} catch (parseError) {
  log.warn("...", {
    error: parseError instanceof Error ? parseError.message : String(parseError),
  });
}

// After:
} catch (err) {  // renamed from parseError to avoid shadow
  log.warn("...", { error: parseError(err) });
}
```

### Changes Required

Every file below gets one new import line:
```ts
import { parseError } from "@vendor/observability/error/next";
```

#### Group 1: `api/app/src/` (6 files, 15 sites)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `api/app/src/lib/activity.ts` | 162, 167, 258, 263, 341, 380, 386 | A + D | 7 |
| `api/app/src/router/org/connections.ts` | 249, 418 | A | 2 |
| `api/app/src/router/user/organization.ts` | 92, 183 | A | 2 |
| `api/app/src/router/user/account.ts` | 49 | A | 1 |
| `api/app/src/inngest/workflow/infrastructure/record-activity.ts` | 115 | A | 1 |

#### Group 2: `api/platform/src/` (8 files, 18 sites)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `api/platform/src/router/platform/backfill.ts` | 101, 105, 151, 155, 248, 252 | B | 6 |
| `api/platform/src/router/platform/proxy.ts` | 163, 167, 220, 250 | A + B | 4 |
| `api/platform/src/inngest/functions/connection-lifecycle.ts` | 91, 159 | A | 2 |
| `api/platform/src/inngest/functions/platform-backfill-orchestrator.ts` | 205, 316 | A | 2 |
| `api/platform/src/inngest/functions/platform-entity-worker.ts` | 147 | A | 1 |
| `api/platform/src/inngest/functions/token-refresh.ts` | 123 | A | 1 |
| `api/platform/src/lib/token-store.ts` | 73 | A | 1 |
| `api/platform/src/trpc.ts` | 63 | A | 1 |

#### Group 3: `apps/` (5 files, 5 sites)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `apps/platform/src/app/api/ingest/[provider]/route.ts` | 150, 154 | E (rename binding) | 1 |
| `apps/app/src/app/(api)/v1/answer/[...v]/route.ts` | 117, 208 | A | 2 |
| `apps/app/src/app/(api)/v1/[...rest]/route.ts` | 36 | A | 1 |
| `apps/app/src/app/(api)/lib/with-api-key-auth.ts` | 143 | A | 1 |
| `apps/app/src/app/(early-access)/_actions/early-access.ts` | 301 | A | 1 |

#### Group 4: `apps/app/src/` client + `apps/app/src/` remaining (2 files, 2 sites)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `apps/app/src/app/(api)/lib/orpc-router.ts` | 66 | A | 1 |
| `apps/app/src/lib/proxy.ts` | 91 | A | 1 |

#### Group 5: `packages/` (4 files, 5 sites)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `packages/app-clerk-cache/src/membership.ts` | 45, 57 | A | 2 |
| `packages/app-config/src/parse.ts` | 89 | A | 1 |
| `packages/app-config/src/glob.ts` | 59 | A | 1 |
| `packages/app-test-data/src/cli/verify-datasets.ts` | 44 | A | 1 |

#### Group 6: `vendor/` + `core/` (4 files, 6 sites)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `core/ai-sdk/src/core/primitives/agent.ts` | 190, 233, 269, 288 | C | 4 |
| `vendor/mcp/src/index.ts` | 84 | A | 1 |
| `vendor/pinecone/src/client.ts` | 332 | A | 1 |

#### Group 7: `apps/app/src/components/` client (1 file, 1 site — now possible after Phase 1)

| File | Lines | Pattern | Sites |
|------|-------|---------|-------|
| `apps/app/src/components/org-search.tsx` | 143 | A (was blocked by server-only) | 1 |

Note: `org-search.tsx:143` currently uses `"Search failed"` as fallback. After replacement with `parseError(err)`, non-Error throws will show `String(value)` instead. This is a minor behavioral improvement — showing the actual error is better than a generic string.

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "instanceof Error ? .*\.message : String(" --include="*.ts" --include="*.tsx" api/ apps/ packages/ vendor/ core/` returns zero hits
- [x] `grep -rn "instanceof Error ? .*\.message : \"Unknown" --include="*.ts" --include="*.tsx" api/ apps/ packages/ vendor/ core/` returns zero hits
- [x] `grep -rn "from.*@vendor/observability/error/next" api/ apps/ packages/ vendor/ core/ | wc -l` returns 28+

#### Manual Verification

- [ ] Spot-check 2-3 replaced files to confirm import + replacement looks correct
- [ ] Verify `apps/platform/src/app/api/ingest/[provider]/route.ts` catch binding was renamed (not just the expression)

---

## Phase 3: Server `console.*` → Structured `log` (3 files) [DONE]

### Overview

Replace `console.*` calls in server-side files within `apps/app/src/` with the structured `log` from `@vendor/observability/log/next`.

### Changes Required

#### 1. `apps/app/src/app/(app)/(org)/[slug]/layout.tsx`

**Changes**: Replace `console.debug` with `log.debug`, add import

```ts
// Add import:
import { log } from "@vendor/observability/log/next";

// Before (line 59):
console.debug("Org access denied for slug:", slug, error);

// After:
log.debug("[org-layout] access denied", { slug, error: parseError(error) });
```

Note: Also add `import { parseError } from "@vendor/observability/error/next"` — this file has a manual error extraction opportunity too.

#### 2. `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts`

**Changes**: Replace `console.log` with `log.info`, add import

```ts
// Add import:
import { log } from "@vendor/observability/log/next";

// Before (lines 44-47):
console.log(
  `[invite-teammates] Mock: inviting to "${teamSlug}":`,
  invitedEmails
);

// After:
log.info("[invite-teammates] mock invitation", { teamSlug, emails: invitedEmails });
```

#### 3. `apps/app/src/app/api/gateway/stream/route.ts`

**Changes**: Replace `console.error` with `log.error`, add import

```ts
// Add import:
import { log } from "@vendor/observability/log/next";
import { parseError } from "@vendor/observability/error/next";

// Before (lines 108-111):
console.error("[events/stream] Catch-up query failed", {
  orgId,
  error: err,
});

// After:
log.error("[events/stream] catch-up query failed", {
  orgId,
  error: parseError(err),
});
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "console\." apps/app/src/app/\(app\)/\(org\)/\[slug\]/layout.tsx` returns zero hits
- [x] `grep -rn "console\." apps/app/src/app/\(app\)/\(user\)/\(pending-allowed\)/account/teams/invite/_actions/invite-teammates.ts` returns zero hits
- [x] `grep -rn "console\." apps/app/src/app/api/gateway/stream/route.ts` returns zero hits

---

## Phase 4: Remove Redundant Client `console.error` (2 files) [DONE]

### Overview

Remove `console.error` calls in client error pages where `captureException` is already called in the same `useEffect`.

### Changes Required

#### 1. `apps/app/src/app/(early-access)/error.tsx`

**Changes**: Remove `console.error` at line 32

```ts
// Before (lines 22-33):
useEffect(() => {
  captureException(error, {
    tags: { location: "early-access-route" },
    extra: { errorDigest: error.digest },
  });

  console.error("Early access route error:", error);  // remove this line
}, [error]);

// After:
useEffect(() => {
  captureException(error, {
    tags: { location: "early-access-route" },
    extra: { errorDigest: error.digest },
  });
}, [error]);
```

#### 2. `apps/app/src/app/(auth)/error.tsx`

**Changes**: Remove `console.error` at line 30 and its comment at line 29

```ts
// Before (lines 18-31):
useEffect(() => {
  captureException(error, {
    tags: { location: "auth-routes" },
    extra: { errorDigest: error.digest },
  });

  // Always log for local debugging
  console.error("Auth route error:", error);
}, [error]);

// After:
useEffect(() => {
  captureException(error, {
    tags: { location: "auth-routes" },
    extra: { errorDigest: error.digest },
  });
}, [error]);
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check && pnpm typecheck` passes
- [x] `grep -rn "console\." apps/app/src/app/\(early-access\)/error.tsx` returns zero hits
- [x] `grep -rn "console\." apps/app/src/app/\(auth\)/error.tsx` returns zero hits

---

## Testing Strategy

### Automated

- Full monorepo type check: `pnpm typecheck`
- Full monorepo lint: `pnpm check`
- `pnpm build:app` and `pnpm build:platform` to verify no import resolution issues

### Manual

- Trigger an error in the app to verify `parseError` works in catch blocks (e.g., invalid API request)
- Check BetterStack for structured log entries from the 3 server console replacements
- Verify Sentry still receives errors from the 2 error pages after removing `console.error` (via `captureException`)

## Performance Considerations

None — `parseError` is a pure function with no allocation overhead beyond the string return. Replacing inline ternaries with a function call has negligible performance impact.

## References

- Research: `thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md` — Items 1 and 6
- Utility: `vendor/observability/src/error/next.ts:3-14`
- Package exports: `vendor/observability/package.json:36-39`
- Sentry console integration: `apps/app/src/instrumentation-client.ts:54-56`
