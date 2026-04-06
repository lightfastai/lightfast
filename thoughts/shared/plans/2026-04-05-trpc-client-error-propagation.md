# tRPC Client-Side Error Propagation — Implementation Plan

## Overview

Eliminate the hand-maintained `trpc-errors.ts` utility and all per-mutation `onError` boilerplate by installing a global `MutationCache.onError` handler that auto-toasts all mutation errors correctly. Every current and future mutation gets correct error presentation with zero boilerplate.

## Current State Analysis

### Server-side errorFormatters (identical in both APIs)

`api/app/src/trpc.ts:103-119` and `api/platform/src/trpc.ts:85-98` sanitize `INTERNAL_SERVER_ERROR` messages in production and flatten `ZodError` causes. The `httpStatus` field is already on the wire via tRPC's default error shape (`DefaultErrorData.httpStatus`), which is sufficient for client-side classification — no additional server-side field is needed.

### Client-side error handling

`apps/app/src/lib/trpc-errors.ts` (95 lines) maintains a parallel `SAFE_MESSAGE_CODES` set that approximates the server's `httpStatus < 500` classification. Only 2 files use `showErrorToast` (5 call sites). 3 other files handle mutation errors inconsistently (inline `toast.error`, `setError(err.message)`, or silent failure).

### QueryClient setup

`packages/app-trpc/src/client.ts:7-33` and `packages/platform-trpc/src/client.ts:7-33` are identical `createQueryClient` factories with no `MutationCache` or `QueryCache`.

### Error boundaries

`apps/app/src/components/errors/org-page-error-boundary.tsx:36-48` classifies errors by substring-matching `error.message.toLowerCase()` for "access denied", "forbidden", and "not found" — ignoring the typed `error.data.code` field.

### Platform app

`apps/platform` is headless (no client components, no toast, no error boundaries). Only consumed server-side via `@repo/platform-trpc/caller`. The `MutationCache` change applies only to `@repo/app-trpc`.

### Key Discoveries

- `httpStatus` is already part of tRPC's `DefaultErrorData` shape and available on every `TRPCClientError.data` — `instanceof TRPCClientError` provides type-safe access without casting
- `@repo/app-trpc` has no `@repo/ui` dependency — needs to be added for `toast` import in `react.tsx`
- `PlatformTRPCReactProvider` is NOT mounted in `apps/app` — platform-trpc React provider is only used within `apps/platform` itself (which has no UI)
- `source-settings-form.tsx:70` mutation has no `onError` at all — currently fails silently, will automatically get toast with the global handler (improvement)

## Desired End State

After this plan is complete:

1. Every tRPC mutation error in `apps/app` automatically shows a correctly-classified toast — no per-mutation wiring needed
2. `apps/app/src/lib/trpc-errors.ts` is deleted
3. No file imports `showErrorToast`
4. The error boundary in `org-page-error-boundary.tsx` classifies errors via `error.data.code` instead of message substring matching
5. Mutations that need custom error handling (inline form errors) opt out via `meta: { suppressErrorToast: true }`
6. React Query `meta` is type-safe via module augmentation — no `as Record<string, unknown>` casts

### How to verify

- `pnpm check && pnpm typecheck` passes
- `grep -r "showErrorToast" apps/ packages/` returns zero results
- `grep -r "SAFE_MESSAGE_CODES" apps/ packages/` returns zero results
- `apps/app/src/lib/trpc-errors.ts` does not exist
- `grep -r "MutationCache" packages/app-trpc/src/react.tsx` shows the global handler

## What We're NOT Doing

- **Not adding `isUserFacing` to errorFormatters** — `httpStatus` is already on the wire via tRPC's default error shape. The classification `httpStatus < 500` is trivially derivable client-side via `instanceof TRPCClientError`. Adding a redundant field only makes sense if classification logic becomes complex (it hasn't).
- **Not adding `MutationCache` to `@repo/platform-trpc`** — the platform app is headless with no client-side UI. When it gains a UI, this can be added trivially.
- **Not adding `QueryCache.onError`** — query errors surface through error boundaries (suspense) or `isError` state (non-suspense). Auto-toasting query errors would be noisy with automatic retries.
- **Not fixing non-tRPC error handlers** — `oauth-button.tsx` (Clerk SDK errors), `use-oauth-popup.ts` (network errors via `fetchQuery`), and `answer-interface.tsx` (fire-and-forget catch) handle non-tRPC errors and are out of scope.
- **Not adding custom `appCode` fields** — the built-in tRPC codes + `error.message` are sufficient for client-side presentation.
- **Not putting MutationCache in `client.ts`** — `client.ts` is a pure data layer (also used server-side for dehydration). The MutationCache with toast logic belongs in `react.tsx` which is already `"use client"` and React-coupled.

## Implementation Approach

Three phases, each independently verifiable. Phase 1 is a standalone correctness fix. Phase 2 installs the global handler and adds type-safe meta. Phase 3 removes the old code.

---

## Phase 1: Fix error boundary classification

### Overview

Replace substring matching on `error.message` with typed `error.data.code` checks in `OrgPageErrorBoundary`. This is a standalone correctness fix — no dependency on other phases.

### Changes Required

#### 1. `org-page-error-boundary.tsx` — use `error.data.code`

**File**: `apps/app/src/components/errors/org-page-error-boundary.tsx`

Replace `getDerivedStateFromError` (lines 36-48):

```typescript
static getDerivedStateFromError(error: Error): State {
  // Classify using tRPC's typed error code instead of message substring matching
  const data = (error as Record<string, unknown>).data as
    | Record<string, unknown>
    | undefined;
  const code = data?.code;

  let errorType: State["errorType"] = "unknown";
  if (code === "FORBIDDEN") {
    errorType = "access_denied";
  } else if (code === "NOT_FOUND") {
    errorType = "not_found";
  }

  return { hasError: true, error, errorType };
}
```

This:
- Uses `error.data.code` which is the typed tRPC error code string (e.g., `"FORBIDDEN"`, `"NOT_FOUND"`)
- Eliminates false positives from messages that happen to contain "not found" or "forbidden" as substrings
- Doesn't require importing `TRPCClientError` — accesses `data` via property access with safe casting

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (pre-existing app-pinecone lint issue unrelated)

#### Manual Verification

- [ ] Navigate to a non-existent org slug → "Organization Not Found" error page renders
- [ ] Navigate to an org you don't have access to → "Access Denied" error page renders
- [ ] Trigger an unrelated server error → generic error page renders with Retry button

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Install global MutationCache error handler

### Overview

Add a `MutationCache` with `onError` to `@repo/app-trpc`'s `TRPCReactProvider`. This auto-toasts all mutation errors using the existing `httpStatus` field from tRPC's default error shape. Supports per-mutation `meta.errorTitle` override and `meta.suppressErrorToast` opt-out, both type-safe via module augmentation.

### Changes Required

#### 1. Add `sonner` dependency

**File**: `packages/app-trpc/package.json`

Add `sonner` to dependencies for access to the `toast` export (importing from `@repo/ui` doesn't resolve cleanly from a library package's `tsc` due to wildcard subpath exports):

```json
"dependencies": {
  ...
  "sonner": "^2.0.6",
  ...
}
```

Run `pnpm install` after this change.

#### 2. Add type-safe `meta` via module augmentation

**File**: `packages/app-trpc/src/types.ts`

This file already exists (exported as `./types` in package.json). Add the module augmentation:

```typescript
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorTitle?: string;
      suppressErrorToast?: boolean;
    };
  }
}
```

This gives autocompletion and compile-time checks on all `meta: { ... }` usage across the app. No casts needed.

#### 3. Make `createQueryClient` accept optional MutationCache

**File**: `packages/app-trpc/src/client.ts`

Keep this file pure (no toast import). Accept an optional `mutationCache` parameter:

```typescript
import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = (opts?: { mutationCache?: MutationCache }) =>
  new QueryClient({
    mutationCache: opts?.mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => {
          return false;
        },
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
```

#### 4. Add MutationCache to TRPCReactProvider

**File**: `packages/app-trpc/src/react.tsx`

Import `MutationCache`, `TRPCClientError`, and `toast`. Create the MutationCache and pass it to `createQueryClient` on the client side only:

```typescript
import { TRPCClientError } from "@trpc/client";
import { MutationCache } from "@tanstack/react-query";
import { toast } from "@repo/ui/components/ui/sonner";

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.meta?.suppressErrorToast) {
      return;
    }

    const title = mutation.options.meta?.errorTitle ?? "Something went wrong";

    let message = "An unexpected error occurred. Please try again.";
    if (
      error instanceof TRPCClientError &&
      error.data?.httpStatus != null &&
      error.data.httpStatus < 500
    ) {
      message = error.message;
    }

    toast.error(title, { description: message });
  },
});

let clientQueryClientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient(); // Server: no MutationCache (no toast context)
  }
  return (clientQueryClientSingleton ??= createQueryClient({ mutationCache }));
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes (54/54 packages)
- [x] `pnpm check` passes (pre-existing app-pinecone lint issue unrelated)

#### Manual Verification

- [ ] Trigger a mutation error (e.g., create a duplicate API key name) — toast appears automatically with correct message
- [ ] Trigger an INTERNAL_SERVER_ERROR — toast shows generic "An unexpected error occurred" message
- [ ] Existing `showErrorToast` call sites still work (they will double-toast until Phase 3 removes them — this is expected)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Migrate consumers and delete `trpc-errors.ts`

### Overview

Remove all `showErrorToast` usage, add `suppressErrorToast` meta where needed, remove redundant inline `toast.error` calls, and delete `trpc-errors.ts`.

### Changes Required

#### 1. `org-api-key-list.tsx` — remove `showErrorToast` import and all 4 `onError` callbacks

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx`

- **Line 26**: Remove `import { showErrorToast } from "~/lib/trpc-errors";`
- **Lines 66-68**: Remove `onError` from `createMutation`. Add `meta: { errorTitle: "Failed to create API key" }` to `mutationOptions`.
- **Lines 80-82**: Remove `onError` from `revokeMutation`. Add `meta: { errorTitle: "Failed to revoke API key" }`.
- **Lines 94-96**: Remove `onError` from `deleteMutation`. Add `meta: { errorTitle: "Failed to delete API key" }`.
- **Lines 109-111**: Remove `onError` from `rotateMutation`. Add `meta: { errorTitle: "Failed to rotate API key" }`.

Example (createMutation):

```typescript
const createMutation = useMutation(
  trpc.orgApiKeys.create.mutationOptions({
    meta: { errorTitle: "Failed to create API key" },
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      toast.success("Organization API key created successfully");
      void queryClient.invalidateQueries({
        queryKey: trpc.orgApiKeys.list.queryOptions().queryKey,
      });
    },
  })
);
```

#### 2. `team-general-settings-client.tsx` — remove `showErrorToast`, add meta

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx`

- **Line 29**: Remove `import { showErrorToast } from "~/lib/trpc-errors";`
- **Lines 74-75**: Remove `onError` callback. Add `meta: { errorTitle: "Failed to update team name" }`.

```typescript
const updateNameMutation = useMutation(
  trpc.organization.updateName.mutationOptions({
    meta: { errorTitle: "Failed to update team name" },
    onSuccess: async (data) => {
      // ... existing onSuccess
    },
  })
);
```

#### 3. `team-name-form.tsx` — add `suppressErrorToast` meta (keeps inline error handling)

**File**: `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx`

This mutation uses `setError(err.message)` to display the error inline in the form — not as a toast. Add `suppressErrorToast` to prevent the global handler from double-displaying:

```typescript
const mutation = useMutation(
  trpc.organization.create.mutationOptions({
    meta: { suppressErrorToast: true },
    onSuccess: async (data) => {
      // ... existing onSuccess
    },
    onError: (err) => {
      setError(err.message ?? "Failed to create team. Please try again.");
    },
  })
);
```

#### 4. `link-sources-button.tsx` — remove redundant inline `toast.error`

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx`

This mutation has an inline `toast.error` in `onError` that would double-toast with the global handler. Replace with `meta` title and keep only the `console.error`:

```typescript
const linkMutation = useMutation(
  trpc.connections.resources.bulkLink.mutationOptions({
    meta: { errorTitle: "Sources not linked" },
    onError: (error) => {
      console.error("Failed to link sources:", error);
    },
    onSuccess: () => {
      // ... existing onSuccess
    },
  })
);
```

Remove the `toast` import from `@repo/ui/components/ui/sonner` if it's no longer used elsewhere in this file. Check for other `toast.*` calls first.

#### 5. Delete `trpc-errors.ts`

**File**: `apps/app/src/lib/trpc-errors.ts` — **DELETE entirely**

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes (54/54 packages)
- [x] `pnpm check` passes (pre-existing app-pinecone lint issue unrelated)
- [x] `grep -r "showErrorToast" apps/ packages/` returns zero results
- [x] `grep -r "trpc-errors" apps/ packages/` returns zero results (no dangling imports)
- [x] `apps/app/src/lib/trpc-errors.ts` does not exist

#### Manual Verification

- [ ] Create a duplicate API key → toast shows "Failed to create API key" with the server's error message
- [ ] Trigger an org rename conflict → toast shows "Failed to update team name" with the server's error message
- [ ] Create a team with a taken slug → error appears inline in the form (no toast)
- [ ] Link sources that fail → toast shows "Sources not linked"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps

1. **Error boundary (FORBIDDEN)**: Access an org you're not a member of — verify "Access Denied" page renders
2. **Error boundary (NOT_FOUND)**: Navigate to `/nonexistent-slug` — verify "Organization Not Found" page renders
3. **Auto-toast (happy path)**: Create a mutation that fails (e.g., duplicate API key) — verify toast appears with correct title and server message
4. **INTERNAL_SERVER_ERROR**: Temporarily throw an unhandled error in a procedure — verify toast shows generic message, not the raw error
5. **Inline error (opt-out)**: Go to `/account/teams/new`, enter a taken team name — verify error appears inline in form, no toast
6. **Silent mutation (new behavior)**: Trigger `source-settings-form.tsx` update failure — verify toast now appears (was previously silent)

## Performance Considerations

None. The `MutationCache.onError` callback runs synchronously on error — no additional network calls, no re-renders. The `instanceof` check and `httpStatus` comparison are O(1).

## References

- Research: `thoughts/shared/research/2026-04-05-trpc-client-error-propagation-next-step.md`
- Server-side consolidation: `thoughts/shared/plans/2026-04-05-trpc-error-handling-consolidation.md`
- Error propagation research: `thoughts/shared/research/2026-04-05-trpc-error-handling-propagation.md`
- React Query `MutationCache` API: stable in `@tanstack/react-query` v5
