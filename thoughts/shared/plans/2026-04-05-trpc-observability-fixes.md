# tRPC Observability Fixes — Implementation Plan

## Overview

Fix three gaps in the tRPC observability architecture identified during the architecture evaluation. These are server-side Sentry quality improvements and a client-side noise filter — separate from the client error propagation plan which addresses user-facing error presentation.

## Current State Analysis

The `createObservabilityMiddleware` consolidation is complete and working. Three gaps remain:

1. **`captureException` sends the TRPCError wrapper, not the original error** — `vendor/observability/src/trpc.ts:125` sends `result.error` (the `TRPCError` with generic message) to Sentry. For `INTERNAL_SERVER_ERROR`, the actual error (e.g., "DB connection refused") is buried in `.cause`. Every 500 looks identical in Sentry.

2. **`parseError` unconditionally calls `captureException`** — `vendor/observability/src/error/next.ts:20` reports every error to Sentry with no classification. One consumer: `apps/app/src/app/(early-access)/_actions/early-access.ts:300`.

3. **Client-side Sentry captures all HTTP 400-599** — `apps/app/src/instrumentation-client.ts:38-39` has `httpClientIntegration({ failedRequestStatusCodes: [[400, 599]] })` with no `beforeSend` filter. Every tRPC 4xx creates client-side Sentry events. Platform has no client instrumentation yet.

### Key Discoveries

- `captureException` is already imported in `early-access.ts:3` — adding an explicit call is trivial
- The return value of `parseError(error)` is unused at `early-access.ts:300` — it's called purely for side effects
- Platform (`apps/platform`) has no `instrumentation-client.ts` — needs scaffolding for when client-side UI is added
- Platform's `env.ts` exports `NEXT_PUBLIC_VERCEL_ENV` but not `NEXT_PUBLIC_SENTRY_DSN` to the client schema — the scaffold will need this added

## Desired End State

After this plan is complete:

1. Sentry issue titles for 500 errors show the actual error message (e.g., "DB connection refused at 10.0.0.1:5432") instead of the generic TRPCError wrapper
2. `parseError` is a pure parsing utility with no Sentry side effects
3. Client-side Sentry in `apps/app` drops `TRPCClientError < 500` via `beforeSend`

### How to verify

- `pnpm check && pnpm typecheck` passes
- Grep `captureException` in `vendor/observability/src/error/next.ts` returns zero results
- Grep `beforeSend` in `apps/app/src/instrumentation-client.ts` returns results

## What We're NOT Doing

- **Not changing the `beforeSend` in server-side `instrumentation.ts`** — it's already correct (drops TRPCError < 500)
- **Not adding `isUserFacing` to errorFormatters** — that's Phase 1 of the client error propagation plan
- **Not touching `showErrorToast` or `MutationCache`** — that's the client error propagation plan
- **Not narrowing `httpClientIntegration` to 500+** — we keep `[[400, 599]]` to capture non-tRPC HTTP errors, and filter tRPC 4xx via `beforeSend`

## Phase 1: Send original error to Sentry for INTERNAL_SERVER_ERROR [DONE]

### Overview

When a procedure throws a raw `Error`, tRPC wraps it as `TRPCError(INTERNAL_SERVER_ERROR, { cause: originalError })`. The middleware currently sends the wrapper to Sentry, producing identical "An error occurred in the tRPC handler." titles for every 500. Fix: send `.cause` when it exists.

### Changes Required

#### 1. `vendor/observability/src/trpc.ts`

**Lines 125-130** — Replace the `captureException` call to unwrap the cause for `INTERNAL_SERVER_ERROR`:

```typescript
if (httpStatus >= 500) {
  log.error("[trpc] server error", meta);
  scope.setTag("trpc.path", path);
  scope.setTag("trpc.type", type);
  scope.setTag("trpc.error_code", result.error.code);
  scope.setExtra("durationMs", durationMs);
  scope.setExtra("requestId", requestId);

  // Send the original error for better Sentry grouping and titles.
  // TRPCError wraps raw Errors with a generic message; the cause has the real info.
  const reportedError =
    result.error.code === "INTERNAL_SERVER_ERROR" &&
    result.error.cause instanceof Error
      ? result.error.cause
      : result.error;

  captureException(reportedError, {
    mechanism: {
      handled: false,
      type: "auto.rpc.trpc.middleware",
    },
  });
}
```

The tRPC context (`trpc.path`, `trpc.error_code`, `requestId`) is still on the scope via `setTag`/`setExtra`, so Sentry retains full context even when receiving the unwrapped cause.

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (pre-existing lint error in Pinecone client — unrelated)

#### Manual Verification

- [ ] Temporarily throw `new Error("test error")` in a procedure — verify Sentry shows "test error" as the issue title (not the generic wrapper)
- [ ] Throw a `TRPCError(NOT_FOUND, ...)` — verify it does NOT appear in Sentry (filtered by `beforeSend`)
- [ ] Throw a `TRPCError(INTERNAL_SERVER_ERROR, { message: "explicit" })` — verify Sentry shows "explicit" (no `.cause`, so it sends the TRPCError itself)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Make `parseError` a pure parsing utility [DONE]

### Overview

Remove `captureException` and `log.error` from `parseError` so it only extracts error messages. Add explicit `captureException` at the one call site that needs it.

### Changes Required

#### 1. `vendor/observability/src/error/next.ts`

Replace the entire function to remove side effects:

```typescript
import "server-only";

export const parseError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return error.message as string;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
};
```

This removes `@sentry/nextjs` and `log` imports entirely.

#### 2. `apps/app/src/app/(early-access)/_actions/early-access.ts`

**Line 300** — Add explicit `captureException` call alongside `parseError`. The `captureException` import already exists at line 3:

```typescript
// Non-Clerk errors
captureException(error);
parseError(error);
```

Note: `parseError` return value is unused here — the call now just extracts the message for logging purposes if needed in the future. The `captureException` call is the explicit reporting.

Actually, `parseError` no longer logs, and the return value is unused. The caller should handle logging explicitly:

```typescript
// Non-Clerk errors
captureException(error);
log.error("Early access signup error", {
  error: error instanceof Error ? error.message : String(error),
});
```

And remove the `parseError` import from line 6 since it's no longer used here.

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (pre-existing lint error in Pinecone client — unrelated)
- [x] `grep -r "captureException" vendor/observability/src/error/next.ts` returns zero results
- [x] `grep -r "parseError" apps/app/src/app/\(early-access\)/_actions/early-access.ts` returns zero results

#### Manual Verification

- [ ] Early access signup flow still works end-to-end
- [ ] Trigger a non-Clerk error in early-access — verify it appears in Sentry

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Client-side Sentry noise filter [DONE]

### Overview

Add `beforeSend` to `apps/app/src/instrumentation-client.ts` to drop `TRPCClientError` with HTTP status < 500. The server owns tRPC error observability, so the client should not duplicate it.

**Note**: `apps/platform` is headless with no client components — scaffolding `instrumentation-client.ts` there would be premature. When platform gains a UI, the engineer adding it will know to add client instrumentation.

### Changes Required

#### 1. `apps/app/src/instrumentation-client.ts`

Add a `beforeSend` callback to the `initSentry` call. Use `instanceof TRPCClientError` for type-safe narrowing:

```typescript
import { TRPCClientError } from "@trpc/client";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  beforeSend(event, hint) {
    // Drop tRPC client errors (4xx) — server owns tRPC error observability.
    const err = hint?.originalException;
    if (
      err instanceof TRPCClientError &&
      err.data?.httpStatus != null &&
      err.data.httpStatus < 500
    ) {
      return null;
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    // ... existing breadcrumb scrubbing unchanged
  },
  // ... rest unchanged
});
```

### Success Criteria

#### Automated Verification

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes (pre-existing lint error in Pinecone client — unrelated)
- [x] `grep -r "beforeSend" apps/app/src/instrumentation-client.ts` returns results

#### Manual Verification

- [ ] Trigger a 401 UNAUTHORIZED tRPC error in the app — verify it does NOT create a client-side Sentry event
- [ ] Trigger a 500 INTERNAL_SERVER_ERROR — verify it DOES create a client-side Sentry event
- [ ] Verify `console.error` from `loggerLink` still appears in browser console (not suppressed)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Execution Order

This plan should be completed **before** the client error propagation plan (`thoughts/shared/plans/2026-04-05-trpc-client-error-propagation.md`). The observability fixes ensure Sentry quality is correct before the client error propagation plan changes how errors surface to users.

## Testing Strategy

### Manual Testing Steps

1. **Sentry 500 title**: Throw `new Error("specific message")` in a procedure → Sentry shows "specific message" as issue title
2. **Sentry grouping**: Throw different raw errors in the same procedure → Sentry creates separate issues (not one giant "An error occurred in the tRPC handler." bucket)
3. **Client noise**: Navigate the app, trigger UNAUTHORIZED/NOT_FOUND scenarios → check Sentry client events dashboard shows no tRPC 4xx
4. **Early access**: Submit early access form → verify non-Clerk errors still reach Sentry

## Performance Considerations

None. The `.cause` unwrapping and `beforeSend` filter are both O(1) property lookups. No additional network calls.

## References

- Architecture evaluation: `thoughts/shared/research/2026-04-05-trpc-observability-architecture-evaluation.md`
- Client error propagation plan: `thoughts/shared/plans/2026-04-05-trpc-client-error-propagation.md`
- Server-side consolidation plan: `thoughts/shared/plans/2026-04-05-trpc-error-handling-consolidation.md`
