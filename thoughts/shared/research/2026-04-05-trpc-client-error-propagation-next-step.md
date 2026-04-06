---
date: 2026-04-05T22:00:00+08:00
researcher: claude
git_commit: e400ef63a4a0ad34715bed54993ecabec5f14eae
branch: main
topic: "tRPC client-side error propagation — code smells, full pipeline, and the most accretive next step"
tags: [research, trpc, error-handling, client, react-query, maintainability]
status: complete
last_updated: 2026-04-05
---

# Research: tRPC Client-Side Error Propagation — The Most Accretive Next Step

**Date**: 2026-04-05T22:00:00+08:00
**Git Commit**: e400ef63a4a0ad34715bed54993ecabec5f14eae
**Branch**: main

## Research Question

Given the completed server-side tRPC error handling consolidation (Phase 1-6 of `thoughts/shared/plans/2026-04-05-trpc-error-handling-consolidation.md`), analyze the remaining code smell in `apps/app/src/lib/trpc-errors.ts` and the full error propagation chain from server to client. What is the most accretive, innovative, and radical step to improve developer long-term maintainability by 100x?

## Summary

The server-side consolidation eliminated constants, triple logging, and duplicate Sentry captures. But the **client-side error handling is now the bottleneck** — every mutation manually wires `onError: (err) => showErrorToast(err, "Failed to X")`, a hand-maintained `SAFE_MESSAGE_CODES` set duplicates the server's error classification logic, and error boundaries do string matching on `error.message`. The single most accretive step is to **eliminate `trpc-errors.ts` entirely** by:

1. Enriching the `errorFormatter` to add an `isUserFacing: boolean` field (derived from HTTP status, same logic as the middleware)
2. Installing a global `MutationCache.onError` handler in `@packages/app-trpc` that auto-toasts all mutation errors correctly — zero boilerplate per mutation
3. Removing all per-mutation `onError: showErrorToast` callbacks

This turns every current and future mutation into a zero-config consumer of correct error presentation, with no constants, no classification sets, and no per-call wiring.

---

## Current State: The Full Error Propagation Chain (Post-Consolidation)

### Server → Wire

```
Procedure throws TRPCError({ code, message, cause? })
        ↓
observabilityMiddleware (vendor/observability/src/trpc.ts)
   — Sentry scope + span
   — classifies via getHTTPStatusCodeFromError: ≥500 → captureException, <500 → log.info
   — single structured log entry with traceId, requestId
        ↓
errorFormatter (api/app/src/trpc.ts:103-119)
   — INTERNAL_SERVER_ERROR in prod → message = "An unexpected error occurred"
   — ZodError cause → shape.data.zodError = error.cause.flatten()
   — all else → shape passes through unchanged
        ↓
Wire shape (JSON via superjson):
{
  message: string,
  code: number,        // JSON-RPC numeric code
  data: {
    code: string,      // "NOT_FOUND", "CONFLICT", etc.
    httpStatus: number, // 404, 409, etc.
    path?: string,
    stack?: string,     // dev only
    zodError: FlattenedZodError | null
  }
}
```

### Wire → Client

```
httpBatchStreamLink deserializes → TRPCClientError<AppRouter>
   — error.message: the (possibly sanitized) message
   — error.data.code: string error code
   — error.data.httpStatus: numeric HTTP status
   — error.data.zodError: flattened Zod errors or null
        ↓
React Query surfaces error in:
   — useMutation().error (for mutations)
   — useQuery().error / useSuspenseQuery throws (for queries)
        ↓
Consumer handles error:
   — Mutation: per-mutation onError callback → showErrorToast()
   — Query (suspense): error boundary catches → OrgPageErrorBoundary / PageErrorBoundary
   — Query (non-suspense): inline isError check in JSX
```

---

## The Code Smells in `trpc-errors.ts`

### File: `apps/app/src/lib/trpc-errors.ts`

**Smell 1 — Hand-maintained `TRPCErrorCode` type (line 8-17)**

```typescript
type TRPCErrorCode =
  | "PARSE_ERROR" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR"
  | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND"
  | "CONFLICT" | "TOO_MANY_REQUESTS" | "TIMEOUT";
```

This is a 9-member subset of tRPC's 20+ error codes. It's manually maintained and already incomplete — missing `PAYMENT_REQUIRED`, `METHOD_NOT_SUPPORTED`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `PRECONDITION_REQUIRED`, `PRECONDITION_FAILED`, `CLIENT_CLOSED_REQUEST`, `UNPROCESSABLE_CONTENT`, `NOT_IMPLEMENTED`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`. It will silently fall out of sync with any tRPC upgrade.

**Smell 2 — `SAFE_MESSAGE_CODES` duplicates server classification (line 24-31)**

```typescript
const SAFE_MESSAGE_CODES: ReadonlySet<TRPCErrorCode> = new Set([
  "BAD_REQUEST", "CONFLICT", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED", "TOO_MANY_REQUESTS",
]);
```

This is a client-side reimplementation of "is this error expected?" — the same question the server already answers via `getHTTPStatusCodeFromError(error) < 500`. But the client doesn't read `error.data.httpStatus`; it maintains its own string set. If a procedure starts throwing `PAYMENT_REQUIRED` (HTTP 402, a client error), the toast will show the generic fallback because `PAYMENT_REQUIRED` isn't in the set.

**Smell 3 — `error.name` string matching (line 38-39)**

```typescript
return error instanceof Error && error.name === "TRPCClientError";
```

This avoids `instanceof TRPCClientError` to dodge bundler deduplication issues — a reasonable workaround, but brittle if tRPC ever changes the class name.

**Smell 4 — Every mutation needs explicit `onError` wiring**

The `showErrorToast` utility must be called explicitly in every mutation's `onError` callback. Current call sites:

| File | Mutations | Pattern |
|------|-----------|---------|
| `org-api-key-list.tsx:66-111` | 4 mutations | `onError: (error) => showErrorToast(error, "Failed to X")` |
| `team-general-settings-client.tsx:74-75` | 1 mutation | `onError: (err) => showErrorToast(err, "Failed to update team name", "Please try again.")` |

Files that DON'T use `showErrorToast` and handle errors inconsistently:

| File | Pattern | Problem |
|------|---------|---------|
| `link-sources-button.tsx:37-42` | inline `toast.error(...)` with static message | Ignores server error message entirely |
| `team-name-form.tsx:40-42` | `setError(err.message)` inline | Reads `err.message` raw, no code check, shows INTERNAL_SERVER_ERROR messages |
| `source-settings-form.tsx:211-213` | `{updateMutation.isError && <span>Failed to save</span>}` | Static string, no error detail |
| `use-oauth-popup.ts:147-158` | bare `catch { toast.error(resolvedErrorMessage) }` | Ignores error entirely |
| `events-table.tsx:185-199` | `try/finally` with no catch | Error swallowed silently |

Every new mutation a developer writes requires them to:
1. Know that `showErrorToast` exists
2. Import it
3. Write the `onError` callback
4. Choose an appropriate title string
5. Optionally provide a fallback

Most developers will forget or skip this — the 5 inconsistent call sites above prove it.

**Smell 5 — Error boundaries do message string matching**

`apps/app/src/components/errors/org-page-error-boundary.tsx:38-45`:

```typescript
const message = error.message?.toLowerCase() ?? "";
if (message.includes("access denied") || message.includes("forbidden")) {
  errorType = "access_denied";
} else if (message.includes("not found")) {
  errorType = "not_found";
}
```

This classifies errors by searching for substrings in `error.message` — not by reading the typed `error.data.code` field. It breaks if a procedure message happens to contain "not found" in a different context (e.g., "Config file not found, using defaults" → incorrectly classified as `not_found`).

---

## The Insight: Classification Already Exists on the Wire

The server's `errorFormatter` already puts `httpStatus` on every error response (`error.data.httpStatus`). This field is:
- Derived from tRPC's canonical `getHTTPStatusCodeFromError` mapping
- Available on every `TRPCClientError` via `error.data.httpStatus`
- Already the exact same classification logic the consolidated middleware uses

But **nobody on the client reads it**. Instead, `trpc-errors.ts` maintains a parallel string set that approximates the same thing.

The `httpStatus` field makes `SAFE_MESSAGE_CODES` unnecessary: any error with `httpStatus < 500` has a user-facing message (the server only sanitizes `INTERNAL_SERVER_ERROR` messages in production). Any error with `httpStatus >= 500` has a sanitized generic message.

---

## The Most Accretive Next Step: Global MutationCache Error Handler

### The Idea

React Query's `MutationCache` accepts a global `onError` callback that fires for ALL mutations. Combined with enriching the `errorFormatter` to mark errors as user-facing, this eliminates:
- `trpc-errors.ts` entirely
- All per-mutation `onError` callbacks for toast display
- The `SAFE_MESSAGE_CODES` constant
- The `TRPCErrorCode` type
- The `isTRPCClientError` guard
- The `getTRPCErrorCode` function
- The `getSafeErrorMessage` function
- The `showErrorToast` function

Every mutation — current and future — gets correct error toasts with zero boilerplate.

### How It Works

**Step 1: Enrich `errorFormatter` with `isUserFacing`**

In `api/app/src/trpc.ts` errorFormatter, add one field:

```typescript
errorFormatter: ({ shape, error }) => {
  const httpStatus = getHTTPStatusCodeFromError(error);
  return {
    ...shape,
    message: isProduction && error.code === "INTERNAL_SERVER_ERROR"
      ? "An unexpected error occurred"
      : shape.message,
    data: {
      ...shape.data,
      isUserFacing: httpStatus < 500,  // ← NEW: derived, not maintained
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  };
};
```

This field:
- Is derived from `getHTTPStatusCodeFromError` — zero maintenance, covers all 20+ codes including future additions
- Is fully typed — `error.data.isUserFacing` is `boolean` on the client with no extra type definitions
- Uses the same classification as the server middleware — single source of truth
- Makes the client classification problem trivial: `if (error.data.isUserFacing) show(error.message) else show(fallback)`

**Step 2: Global `MutationCache.onError` in `createQueryClient`**

In `packages/app-trpc/src/client.ts`, add a `MutationCache` with `onError`:

```typescript
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/components/ui/sonner";

export function createQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        // error.data is typed from errorFormatter
        const message = error.data?.isUserFacing
          ? error.message
          : "An unexpected error occurred. Please try again.";

        toast.error("Something went wrong", {
          description: message,
        });
      },
    }),
    defaultOptions: {
      // ... existing options
    },
  });
}
```

**Enhancement — per-mutation title override via `meta`**

React Query supports `meta` on mutations. For mutations that want a specific toast title:

```typescript
const mutation = useMutation(
  trpc.orgApiKeys.create.mutationOptions({
    meta: { errorTitle: "Failed to create API key" },  // optional
    onSuccess: () => { /* ... */ },
    // NO onError needed
  }),
);
```

The global handler reads `meta`:

```typescript
onError: (error, _variables, _context, mutation) => {
  const title = (mutation.options.meta as any)?.errorTitle ?? "Something went wrong";
  const message = error.data?.isUserFacing
    ? error.message
    : "An unexpected error occurred. Please try again.";
  toast.error(title, { description: message });
},
```

**Enhancement — opt-out for mutations with custom error handling**

Some mutations (like `team-name-form.tsx`) handle errors inline instead of toasting. Use `meta.suppressErrorToast`:

```typescript
const mutation = useMutation(
  trpc.organization.create.mutationOptions({
    meta: { suppressErrorToast: true },
    onError: (err) => setError(err.message),
  }),
);
```

Global handler checks:

```typescript
onError: (error, _variables, _context, mutation) => {
  if ((mutation.options.meta as any)?.suppressErrorToast) return;
  // ... toast logic
},
```

**Step 3: Delete `trpc-errors.ts` and all `showErrorToast` imports**

Remove:
- `apps/app/src/lib/trpc-errors.ts` (entire file)
- All imports of `showErrorToast` from 2 files
- All `onError: (err) => showErrorToast(...)` callbacks from 5 mutation sites

**Step 4: Fix error boundaries to use `error.data.code` or `error.data.httpStatus`**

In `org-page-error-boundary.tsx`, replace message string matching with:

```typescript
const data = (error as any).data;
if (data?.httpStatus === 403) errorType = "access_denied";
else if (data?.httpStatus === 404) errorType = "not_found";
else errorType = "unknown";
```

Or even simpler — read `data?.code`:

```typescript
if (data?.code === "FORBIDDEN") errorType = "access_denied";
else if (data?.code === "NOT_FOUND") errorType = "not_found";
```

### Why This Is Radical

**Before** (current state):
```
Developer writes a new mutation:
1. Implement the mutation hook
2. Remember that showErrorToast exists
3. Import showErrorToast from the right path
4. Write onError callback with appropriate title string
5. Hope SAFE_MESSAGE_CODES covers the errors this procedure throws
6. If it doesn't, errors show generic fallback even when they shouldn't
```

**After** (proposed state):
```
Developer writes a new mutation:
1. Implement the mutation hook
2. (done — errors are automatically handled correctly)
```

This is why it's 100x: every mutation written from now on requires zero error handling code. The classification is derived, not maintained. The toast is automatic, not manual. The only code a developer writes is when they want to OVERRIDE the default (custom title, or suppress toast for inline error display).

### Why Not Other Approaches

**"Errors as data" (discriminated union return values)**: Requires changing every procedure to return `{ success, data } | { success: false, error }`. Loses HTTP error codes, breaks error boundaries, breaks tRPC's built-in retry semantics, and requires changing every consumer. Massive blast radius for questionable benefit.

**Per-procedure typed errors (tRPC PR #7279 / #6849)**: Neither has merged. Waiting for upstream is not accretive. When they do merge, the `isUserFacing` enrichment and global handler are still needed — they're complementary, not competing.

**Custom `appCode` field in errorFormatter**: Tempting (e.g., `ORG_NOT_FOUND` vs `REPO_NOT_FOUND`), but introduces a new constant to maintain. The built-in tRPC codes + `error.message` are sufficient for client-side presentation. Custom codes are valuable for programmatic error handling (e.g., "if org not found, redirect to create org"), but that's a separate concern from toast display.

**oRPC `safe()` pattern**: Already exists in the oRPC public API path (see `thoughts/shared/plans/2026-04-04-orpc-errors-and-sdk-client.md`). Great for the SDK client, but the internal app uses tRPC, not oRPC. The oRPC and tRPC error handling are separate concerns for separate surfaces.

---

## Impact Analysis

### Lines Removed
- `apps/app/src/lib/trpc-errors.ts`: **95 lines deleted** (entire file)
- `onError: showErrorToast` callbacks across 2 files: **~15 lines deleted**
- Total: **~110 lines deleted**

### Lines Added
- `errorFormatter` enrichment: **1 line** (`isUserFacing: httpStatus < 500`)
- `MutationCache.onError` in `createQueryClient`: **~15 lines**
- Error boundary fix: **~5 lines changed** (replace string matching with code check)
- Total: **~21 lines added**

### Net: -89 lines, and every future mutation gets correct error handling for free.

### Files Affected
1. `api/app/src/trpc.ts` — add `isUserFacing` to errorFormatter (+2 lines)
2. `api/platform/src/trpc.ts` — same (+2 lines)
3. `packages/app-trpc/src/client.ts` — add `MutationCache.onError` (~15 lines)
4. `apps/app/src/lib/trpc-errors.ts` — **DELETE**
5. `apps/app/src/app/.../org-api-key-list.tsx` — remove `showErrorToast` import + callbacks
6. `apps/app/src/app/.../team-general-settings-client.tsx` — remove `showErrorToast` import + callback
7. `apps/app/src/components/errors/org-page-error-boundary.tsx` — replace string matching with code check

### Blast Radius
- No API contract changes
- No wire format changes (additive field)
- No auth changes
- No procedure logic changes
- Client-only behavior change: mutations that previously had no error handling now get automatic toasts (improvement, not regression)

---

## Code References

- `apps/app/src/lib/trpc-errors.ts:1-95` — the file to eliminate
- `api/app/src/trpc.ts:103-119` — errorFormatter (add `isUserFacing`)
- `api/platform/src/trpc.ts:85-98` — platform errorFormatter (same change)
- `packages/app-trpc/src/client.ts:1-33` — `createQueryClient` (add MutationCache)
- `packages/app-trpc/src/react.tsx:55-81` — tRPC client setup (no changes needed)
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx:26,66-111` — 4 `showErrorToast` calls to remove
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx:29,74-75` — 1 `showErrorToast` call to remove
- `apps/app/src/components/errors/org-page-error-boundary.tsx:36-48` — string matching to replace
- `apps/app/src/components/errors/page-error-boundary.tsx:34` — generic boundary (no changes needed)
- `vendor/observability/src/trpc.ts:225-239` — server middleware already uses same classification

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-04-05-trpc-error-handling-consolidation.md` — server-side consolidation plan (all 6 phases DONE). Eliminated `trpcMiddleware`, `sentryMiddleware`, `sentrifiedProcedure`, `EXPECTED_TRPC_ERRORS` sets, `onError` callbacks, and duplicate Sentry captures. Established `getHTTPStatusCodeFromError` as the single classification mechanism.

- `thoughts/shared/research/2026-04-05-trpc-error-handling-propagation.md` — deep research on the full error pipeline. Documented the 4-layer problem (sentryMiddleware → observabilityMiddleware → errorFormatter → onError) and the overlap matrix. All smells identified here have been resolved by the consolidation plan, except the client-side issues.

- `thoughts/shared/plans/2026-04-04-orpc-errors-and-sdk-client.md` — oRPC error handling for the public API surface. Uses `.errors()` on the contract for typed error definitions. Separate concern from the internal tRPC error handling (different API surface, different consumers).

- `thoughts/shared/research/2026-04-04-orpc-error-handling-and-sdk-client.md` — research on oRPC's `safe()` pattern and per-procedure typed errors. Documents the oRPC approach that tRPC PRs #6849 and #7279 are trying to replicate.

## Ecosystem Context

- **tRPC v11.12.0** — current version. No per-procedure typed errors. `errorFormatter` return type is inferred end-to-end to the client.
- **tRPC PR #7279** (Nick-Lucas, Mar 2026) — "Declared Errors" draft. Open, not merged.
- **tRPC PR #6849** (heitorlisboa, Jun 2025) — per-procedure `.errors()` + `safe()`. Open, not merged.
- **oRPC v1.13.13** — already ships per-procedure typed errors with `safe()`. Used in the public API, not the internal app.
- **React Query v5** — `MutationCache.onError` is a stable API. Supported in `@tanstack/react-query` which the app already uses.

## Open Questions

1. **Toast title derivation**: The global handler needs a toast title. Options: (a) always use "Something went wrong" (simple), (b) derive from procedure path (`trpc.orgApiKeys.create` → "API Key Creation Error"), (c) use `meta.errorTitle` for per-mutation override. Option (c) is recommended — it's opt-in and zero-config by default.

2. **Query errors**: The global `MutationCache.onError` only covers mutations. Query errors surface through error boundaries (suspense) or `isError` state (non-suspense). Should a `QueryCache.onError` also auto-toast? Probably not — query errors are typically retried automatically and showing toasts on retry would be noisy. But worth considering.

3. **`error.data.isUserFacing` vs reading `error.data.httpStatus < 500` directly**: Adding `isUserFacing` to the errorFormatter is more semantic and self-documenting. But it's also possible to skip the formatter change entirely and just read `httpStatus` on the client. The tradeoff is readability vs. minimalism.
