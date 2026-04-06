# Tier 1 Observability Primitives — Implementation Plan

## Overview

Add foundational observability to the platform's blind spots: logging in 6 unlogged files, response body capture in provider HTTP errors, enhanced tRPC observability, and error classification to separate signal from noise in Sentry.

These are the highest-ROI, lowest-risk changes available. No version upgrades, no architectural shifts — just filling gaps and improving what already exists.

## Current State Analysis

**Logging gaps:** 6 critical platform files have zero logger imports. Every production incident today (token failures, proxy 401s, backfill errors) hits these unlogged paths.

**Provider errors:** All provider `fetch()` calls discard the response body on error. A GitHub 401 just says `"failed: 401"` — the body that explains *why* (revoked, suspended, bad JWT) is thrown away.

**tRPC observability:** `timingMiddleware` logs only `path` and `durationMs`. Doesn't log outcome (`result.ok`), error code, user/org identity, or procedure type.

**Sentry noise:** `onError` handlers send ALL `INTERNAL_SERVER_ERROR` to Sentry. No `beforeSend` filter exists. The Sentry `trpcMiddleware` captures all errors including intentional 4xx, creating noise that dilutes real alerts.

### Key Discoveries

- Logging convention is consistent: `import { log } from "@vendor/observability/log/next"`, message format `[module-prefix] description`, flat metadata objects — `api/platform/src/lib/jobs.ts`, `api/platform/src/lib/oauth/authorize.ts`
- Error extraction pattern: `err instanceof Error ? err.message : String(err)` — used in all Inngest functions
- `log.warn` for expected failures (validation, guard exits), `log.error` for unexpected failures — `api/platform/src/lib/oauth/callback.ts`
- `apps/app` tRPC route handler (`apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts:49`) uses `console.error` — the only `console.error` in api/app. Platform route handler already uses structured logger.
- No `beforeSend` exists in any of the three Sentry `init()` calls — `apps/app/src/instrumentation.ts`, `apps/platform/src/instrumentation.ts`, `apps/www/src/instrumentation.ts`
- 13 `!response.ok` sites across providers discard the body. Only `sentry/index.ts:61` reads it (via `response.text()`)
- `packages/app-providers` has a `src/runtime/` directory for shared utilities — natural home for `readErrorBody`

## Desired End State

After this plan is complete:

1. **Every error path in the 6 blind files logs structured context** — installationId, provider, operation, error message
2. **Provider HTTP errors include the response body** (truncated) in the error message — diagnosing a GitHub 401 no longer requires reproduction
3. **Every tRPC procedure call logs outcome, identity, and error code** — a single BetterStack query reconstructs any request's journey
4. **Sentry only receives unexpected errors** — 4xx noise eliminated, alerts are actionable

### Verification

- `pnpm check && pnpm typecheck` passes across the monorepo
- `grep -r "console.error" api/app/src/` returns zero hits (replaced with structured logger)
- Every file in the 6 blind files imports `@vendor/observability/log/next`
- Every `if (!response.ok)` in `packages/app-providers/src/providers/` includes body capture
- `beforeSend` exists in all three `instrumentation.ts` files

## What We're NOT Doing

- **AsyncLocalStorage context propagation** — Tier 2 (requires new `@vendor/observability` primitive)
- **Inngest v4 upgrade** — Tier 2 (breaking change, affects 12 functions)
- **OpenTelemetry** — Tier 2 (architectural shift)
- **Provider circuit breaker** — Tier 2 (new infrastructure)
- **tRPC input sanitization for Sentry** — Tier 2 (requires analysis of all inputs)
- **Adding logging to `packages/app-providers`** — the provider package has no logger dependency and we're not adding one; instead we enrich error messages so the platform layer's existing logging captures the detail

---

## Phase 1: Add Logging to 6 Blind Platform Files

### Overview

Add `import { log } from "@vendor/observability/log/next"` and structured log calls to every error path in the 6 files that currently have zero logging.

### Changes Required

#### 1. `api/platform/src/router/memory/proxy.ts`

**File**: `api/platform/src/router/memory/proxy.ts`
**Changes**: Add logger import. Log at 3 error sites.

Add import after line 17 (`import { z } from "zod"`):
```typescript
import { log } from "@vendor/observability/log/next";
```

**Site 1 — Line 159-165**: Token acquisition catch block (already throws `TRPCError`). Add `log.error` before the throw:

```typescript
} catch (err) {
  log.error("[proxy] token acquisition failed", {
    installationId: input.installationId,
    provider: providerName,
    error: err instanceof Error ? err.message : String(err),
  });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Failed to acquire auth token: ${err instanceof Error ? err.message : "unknown error"}`,
  });
}
```

**Site 2 — Line 208-212**: Silent catch in 401 retry `buildAuth`. Replace the bare `catch {}`:

```typescript
} catch (retryErr) {
  log.warn("[proxy] auth rebuild failed during 401 retry", {
    installationId: input.installationId,
    provider: providerName,
    endpointId: input.endpointId,
    error: retryErr instanceof Error ? retryErr.message : String(retryErr),
  });
  // fall through without retry
}
```

**Site 3 — Line 232**: Silent `.catch(() => null)` on `response.json()`. Replace with logging:

```typescript
const data = await response.json().catch((parseErr: unknown) => {
  log.warn("[proxy] response body parse failed", {
    installationId: input.installationId,
    provider: providerName,
    endpointId: input.endpointId,
    status: response.status,
    error: parseErr instanceof Error ? parseErr.message : String(parseErr),
  });
  return null;
});
```

#### 2. `api/platform/src/router/memory/connections.ts`

**File**: `api/platform/src/router/memory/connections.ts`
**Changes**: Add logger import. Log in the `getToken` catch block.

Add import after line 25 (`import { z } from "zod"`):
```typescript
import { log } from "@vendor/observability/log/next";
```

**Site 1 — Lines 103-143**: The `getToken` catch block remaps errors to TRPCError variants. Add logging before each rethrow. The catch block currently reads the error message and branches. Add a single log call at the top of the catch:

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  log.warn("[connections] token retrieval failed", {
    installationId: input.id,
    provider: providerName,
    error: message,
  });

  // ... existing TRPCError remapping branches unchanged ...
}
```

Using `log.warn` because all three branches produce expected 4xx errors (NOT_FOUND, BAD_REQUEST) except the fallthrough which is INTERNAL_SERVER_ERROR. The tRPC `onError` handler will additionally log the 5xx case.

#### 3. `api/platform/src/router/memory/backfill.ts`

**File**: `api/platform/src/router/memory/backfill.ts`
**Changes**: Add logger import. Log at 4 error sites.

Add import after line 29 (`import { z } from "zod"`):
```typescript
import { log } from "@vendor/observability/log/next";
```

**Site 1 — Lines 96-101**: `trigger` catch on `inngest.send`. Add `log.error` before the throw:

```typescript
} catch (err) {
  log.error("[backfill] trigger dispatch failed", {
    installationId: input.installationId,
    provider: input.provider,
    orgId: input.orgId,
    error: err instanceof Error ? err.message : String(err),
  });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Failed to trigger backfill: ${err instanceof Error ? err.message : "unknown"}`,
  });
}
```

**Site 2 — Lines 141-145**: `cancel` catch on `inngest.send`. Same pattern:

```typescript
} catch (err) {
  log.error("[backfill] cancel dispatch failed", {
    installationId: input.installationId,
    correlationId: input.correlationId,
    error: err instanceof Error ? err.message : String(err),
  });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Failed to cancel backfill: ${err instanceof Error ? err.message : "unknown"}`,
  });
}
```

**Site 3 — Lines 232-236**: `estimate` catch on token acquisition. Add `log.error` before the throw:

```typescript
} catch (err) {
  log.error("[backfill] token acquisition failed for estimate", {
    installationId,
    provider,
    orgId,
    error: err instanceof Error ? err.message : String(err),
  });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Failed to acquire token for estimate: ${err instanceof Error ? err.message : "unknown"}`,
  });
}
```

**Site 4 — Lines 254-263**: Silent per-resource catch in `resolveResourceMeta`. Add `log.warn`:

```typescript
} catch (resolveErr) {
  log.warn("[backfill] resolveResourceMeta failed", {
    installationId,
    provider,
    resourceId: r.providerResourceId,
    error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr),
  });
  if (resourceNameRequiredForRouting) {
    return null;
  }
  return {
    providerResourceId: r.providerResourceId,
    resourceName: r.providerResourceId,
  };
}
```

**Site 5 — Lines 367-376**: Silent per-probe catch. Add `log.warn`:

```typescript
} catch (probeErr) {
  log.warn("[backfill] estimate probe failed", {
    installationId,
    provider,
    resourceId: resource.providerResourceId,
    entityType,
    error: probeErr instanceof Error ? probeErr.message : String(probeErr),
  });
  return {
    entityType,
    sample: {
      resourceId: resource.providerResourceId,
      returnedCount: -1,
      hasMore: false,
    },
  };
}
```

#### 4. `api/platform/src/lib/token-helpers.ts`

**File**: `api/platform/src/lib/token-helpers.ts`
**Changes**: Add logger import. Log at 2 silent catch sites.

Add import after line 7 (`import { updateTokenRecord } from "./token-store"`):
```typescript
import { log } from "@vendor/observability/log/next";
```

**Site 1 — Lines 111-113**: Silent catch in `forceRefreshToken` refresh path. Replace:

```typescript
} catch (refreshErr) {
  log.warn("[token-helpers] token refresh failed, falling back to getActiveToken", {
    installationId: installation.id,
    provider: installation.provider,
    error: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
  });
  // Fall through to getActiveToken
}
```

**Site 2 — Lines 125-127**: Silent catch in `forceRefreshToken` fallback. Replace:

```typescript
} catch (fallbackErr) {
  log.warn("[token-helpers] getActiveToken fallback failed", {
    installationId: installation.id,
    provider: installation.provider,
    externalId: installation.externalId,
    error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
  });
  return null;
}
```

#### 5. `api/platform/src/lib/token-store.ts`

**File**: `api/platform/src/lib/token-store.ts`
**Changes**: Add logger import. Add audit logging on write/update operations.

Add import after line 6 (`import { getEncryptionKey } from "./encryption"`):
```typescript
import { log } from "@vendor/observability/log/next";
```

**Site 1 — After `db.insert` in `writeTokenRecord` (around line 29)**: Add confirmation log:

```typescript
// After the db.insert().values().onConflictDoUpdate() call:
log.info("[token-store] token record written", {
  installationId,
  hasRefreshToken: !!oauthTokens.refreshToken,
  hasExpiry: !!oauthTokens.expiresAt,
});
```

**Site 2 — After `db.update` in `updateTokenRecord` (around line 107)**: Add confirmation log:

```typescript
// After the db.update().set().where() call:
log.info("[token-store] token record updated", {
  tokenId,
  refreshed: true,
  hasNewExpiry: !!oauthTokens.expiresAt,
});
```

#### 6. `api/platform/src/lib/oauth/state.ts`

**File**: `api/platform/src/lib/oauth/state.ts`
**Changes**: Add logger import. Log on store/consume operations and the `return null` guard.

Add import after line 8 (`import { oauthResultKey, oauthStateKey } from "../cache"`):
```typescript
import { log } from "@vendor/observability/log/next";
```

**Site 1 — In `consumeOAuthState`, around lines 58-60**: The `return null` when `stateData?.orgId` is falsy. Add `log.warn`:

```typescript
if (!stateData?.orgId) {
  log.warn("[oauth/state] state not found or expired", {
    statePrefix: state.slice(0, 8),
  });
  return null;
}
```

**Site 2 — In `storeOAuthState`, after the Redis pipeline exec**: Add `log.info`:

```typescript
log.info("[oauth/state] state stored", {
  provider: data.provider,
  orgId: data.orgId,
  statePrefix: state.slice(0, 8),
});
```

**Site 3 — In `consumeOAuthState`, after successful consumption**: Add `log.info`:

```typescript
log.info("[oauth/state] state consumed", {
  statePrefix: state.slice(0, 8),
  orgId: stateData.orgId,
});
```

### Success Criteria

#### Automated Verification

- [ ] `pnpm check && pnpm typecheck` passes
- [ ] `grep -rn "from \"@vendor/observability/log/next\"" api/platform/src/router/memory/proxy.ts api/platform/src/router/memory/connections.ts api/platform/src/router/memory/backfill.ts api/platform/src/lib/token-helpers.ts api/platform/src/lib/token-store.ts api/platform/src/lib/oauth/state.ts` shows 6 matches (one per file)

#### Manual Verification

- [ ] Run `pnpm dev:platform`, trigger a proxy request through the app — verify `[proxy]` logs appear in terminal
- [ ] Trigger a token refresh by disconnecting/reconnecting a provider — verify `[token-helpers]` and `[token-store]` logs appear

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Provider Response Body Capture

### Overview

Create a shared `readErrorBody` utility and update all `if (!response.ok)` sites in `packages/app-providers` to include the response body in error messages. This enriches error messages at the source — the platform layer's existing logging then captures the full diagnostic detail.

### Changes Required

#### 1. New shared utility

**File**: `packages/app-providers/src/runtime/http.ts` (new file)

```typescript
/**
 * Read a truncated error body from a failed HTTP response.
 * Safe to call on any response — catches read failures silently.
 */
export async function readErrorBody(
  response: Response,
  maxLength = 200
): Promise<string> {
  try {
    const text = await response.text();
    return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
  } catch {
    return "";
  }
}
```

No new dependencies. Uses only `Response.text()` and string slicing.

#### 2. GitHub provider — `packages/app-providers/src/providers/github/index.ts`

**Line 61-64** (`getInstallationToken`): Replace the throw:

```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(
    `GitHub installation token request failed: ${response.status} ${body}`
  );
}
```

Add import at the top of the file:
```typescript
import { readErrorBody } from "../../runtime/http";
```

**Line 186-189** (`revokeAccess`): Same pattern:

```typescript
if (!response.ok && response.status !== 404) {
  const body = await readErrorBody(response);
  throw new Error(
    `GitHub installation revocation failed: ${response.status} ${body}`
  );
}
```

#### 3. GitHub backfill — `packages/app-providers/src/providers/github/backfill.ts`

**Line 133-136** (`resolveResourceMeta`):

```typescript
if (!res.ok) {
  const body = await readErrorBody(res);
  throw new Error(
    `GitHub repo lookup failed for ${providerResourceId}: ${res.status} ${body}`
  );
}
```

Add import:
```typescript
import { readErrorBody } from "../../runtime/http";
```

#### 4. Linear provider — `packages/app-providers/src/providers/linear/index.ts`

Update 4 sites (lines 56, 135, 452, 477). Each follows the same pattern — add `const body = await readErrorBody(response)` and append `${body}` to the error message.

Add import:
```typescript
import { readErrorBody } from "../../runtime/http";
```

**Line 56** (`fetchLinearExternalId`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Linear viewer query failed: ${response.status} ${body}`);
}
```

**Line 135** (`exchangeLinearCode`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Linear token exchange failed: ${response.status} ${body}`);
}
```

**Line 452** (`refreshToken`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Linear token refresh failed: ${response.status} ${body}`);
}
```

**Line 477** (`revokeToken`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Linear token revocation failed: ${response.status} ${body}`);
}
```

#### 5. Linear backfill — `packages/app-providers/src/providers/linear/backfill.ts`

**Line 397** (`resolveResourceMeta`):
```typescript
if (!res.ok) {
  const body = await readErrorBody(res);
  throw new Error(`Linear team lookup failed: ${res.status} ${body}`);
}
```

Add import:
```typescript
import { readErrorBody } from "../../runtime/http";
```

#### 6. Sentry provider — `packages/app-providers/src/providers/sentry/index.ts`

**Line 61** already reads the body — leave unchanged (it's the one correct example).

**Line 327** (`refreshToken`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Sentry token refresh failed: ${response.status} ${body}`);
}
```

**Line 363** (`revokeToken`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Sentry token revocation failed: ${response.status} ${body}`);
}
```

Add import:
```typescript
import { readErrorBody } from "../../runtime/http";
```

#### 7. Vercel provider — `packages/app-providers/src/providers/vercel/index.ts`

**Line 47** (`exchangeVercelCode`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Vercel token exchange failed: ${response.status} ${body}`);
}
```

**Line 341** (`revokeToken`):
```typescript
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Vercel token revocation failed: ${response.status} ${body}`);
}
```

Add import:
```typescript
import { readErrorBody } from "../../runtime/http";
```

### Success Criteria

#### Automated Verification

- [ ] `pnpm check && pnpm typecheck` passes
- [ ] `pnpm --filter @repo/app-providers test` passes (existing tests)
- [ ] `grep -rn "readErrorBody" packages/app-providers/src/` shows imports in all 7 provider files + the definition in `runtime/http.ts`

#### Manual Verification

- [ ] Trigger a GitHub 401 (e.g., revoke a test installation) — error log now includes the response body explaining why

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Enhanced tRPC Observability Middleware

### Overview

Replace `timingMiddleware` in both `api/app/src/trpc.ts` and `api/platform/src/trpc.ts` with an `observabilityMiddleware` that logs outcome, error code, user/org identity, and procedure type. Also fix the `apps/app` route handler to use the structured logger instead of `console.error`.

### Changes Required

#### 1. `api/app/src/trpc.ts` — Replace timingMiddleware

**File**: `api/app/src/trpc.ts`
**Lines 156-171**: Replace the entire `timingMiddleware` with:

```typescript
/**
 * Observability middleware — logs outcome, identity, and timing for every procedure.
 * Replaces the original timingMiddleware with richer context.
 */
const observabilityMiddleware = t.middleware(async ({ next, path, ctx, type }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const durationMs = Date.now() - start;

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

  return result;
});
```

Then update all 4 references from `timingMiddleware` to `observabilityMiddleware`:
- Line 180: `publicProcedure = sentrifiedProcedure.use(observabilityMiddleware)`
- Line 199: `userScopedProcedure = sentrifiedProcedure.use(observabilityMiddleware)`
- Line 247: `orgScopedProcedure = sentrifiedProcedure.use(observabilityMiddleware)`

#### 2. `api/platform/src/trpc.ts` — Replace timingMiddleware

**File**: `api/platform/src/trpc.ts`
**Lines 111-124**: Replace with:

```typescript
/**
 * Observability middleware — logs outcome, identity, and timing for every procedure.
 */
const observabilityMiddleware = t.middleware(async ({ next, path, ctx, type }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const durationMs = Date.now() - start;

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

  return result;
});
```

Then update all 4 references from `timingMiddleware` to `observabilityMiddleware`:
- Line 135: `publicProcedure = sentrifiedProcedure.use(observabilityMiddleware)`
- Line 143-144: `serviceProcedure = sentrifiedProcedure.use(observabilityMiddleware)`
- Line 168-169: `adminProcedure = sentrifiedProcedure.use(observabilityMiddleware)`

#### 3. `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` — Fix console.error

**File**: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
**Line 49**: Replace `console.error` with structured logger.

Add import:
```typescript
import { log } from "@vendor/observability/log/next";
```

Replace the onError handler (lines 48-53):
```typescript
onError({ error, path }) {
  log.error("[trpc] procedure error", {
    path,
    error: error.message,
    code: error.code,
  });
  if (error.code === "INTERNAL_SERVER_ERROR") {
    captureException(error);
  }
},
```

This makes the app route handler match the platform route handler's existing pattern.

### Success Criteria

#### Automated Verification

- [ ] `pnpm check && pnpm typecheck` passes
- [ ] `grep -rn "timingMiddleware" api/app/src/trpc.ts api/platform/src/trpc.ts` returns zero hits
- [ ] `grep -rn "console.error" apps/app/src/app/\(trpc\)/` returns zero hits
- [ ] `grep -rn "observabilityMiddleware" api/app/src/trpc.ts api/platform/src/trpc.ts` shows references in both files

#### Manual Verification

- [ ] Run `pnpm dev:app`, make a tRPC call — verify logs now include `ok`, `type`, `userId`, and `orgId`
- [ ] Trigger a tRPC error (e.g., access org resource without org) — verify `errorCode` appears in the log

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Error Classification

### Overview

Separate expected 4xx errors from unexpected 5xx at two layers: the tRPC `onError` handlers (logging + Sentry gate) and Sentry's `beforeSend` callback (noise filter). This ensures Sentry alerts only fire for real problems.

### Changes Required

#### 1. `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts` — Classify onError

**File**: `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`

After Phase 3, the `onError` handler uses `log.error` for all errors. Now classify them.

Replace the onError handler with:

```typescript
onError({ error, path }) {
  if (EXPECTED_TRPC_ERRORS.has(error.code)) {
    log.info("[trpc] expected error", {
      path,
      code: error.code,
    });
  } else {
    log.error("[trpc] unexpected error", {
      path,
      error: error.message,
      code: error.code,
    });
    captureException(error);
  }
},
```

Add the constant above the handler function (after the imports):

```typescript
/** tRPC error codes that represent expected domain conditions, not bugs. */
const EXPECTED_TRPC_ERRORS = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PARSE_ERROR",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);
```

This replaces the current `if (error.code === "INTERNAL_SERVER_ERROR")` gate with an inverted allowlist. The effect is the same (only unexpected errors go to Sentry) but reads more explicitly and also correctly handles any future custom error codes.

#### 2. `apps/platform/src/app/api/trpc/[trpc]/route.ts` — Same classification

**File**: `apps/platform/src/app/api/trpc/[trpc]/route.ts`

Same change. Add the `EXPECTED_TRPC_ERRORS` set and replace the onError handler:

```typescript
/** tRPC error codes that represent expected domain conditions, not bugs. */
const EXPECTED_TRPC_ERRORS = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PARSE_ERROR",
  "UNPROCESSABLE_CONTENT",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

// ... in the handler:
onError({ error, path }) {
  if (EXPECTED_TRPC_ERRORS.has(error.code)) {
    log.info("[trpc] expected error", {
      path,
      code: error.code,
    });
  } else {
    log.error("[trpc] unexpected error", {
      path,
      error: error.message,
      code: error.code,
    });
    captureException(error);
  }
},
```

#### 3. `apps/app/src/instrumentation.ts` — Add beforeSend

**File**: `apps/app/src/instrumentation.ts`

Add `beforeSend` to both `init()` calls to filter TRPCError 4xx that might still leak through (e.g., from the Sentry `trpcMiddleware` which captures all errors independently of `onError`).

Import `TRPCError` type for the instance check. Since `instrumentation.ts` runs at startup and `@trpc/server` is already a dependency, this is safe:

```typescript
import { TRPCError } from "@trpc/server";
```

Add the filter function before `register()`:

```typescript
const EXPECTED_TRPC_CODES = new Set([
  "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "BAD_REQUEST",
  "CONFLICT", "PRECONDITION_FAILED", "PARSE_ERROR",
  "UNPROCESSABLE_CONTENT", "TOO_MANY_REQUESTS", "CLIENT_CLOSED_REQUEST",
]);

const beforeSend: Parameters<typeof init>[0] extends infer O
  ? O extends { beforeSend?: infer B } ? B : never
  : never = (event, hint) => {
  const err = hint?.originalException;
  if (err instanceof TRPCError && EXPECTED_TRPC_CODES.has(err.code)) {
    return null;
  }
  return event;
};
```

Then add `beforeSend` to both `init()` calls:

In the nodejs init (line 18):
```typescript
init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  includeLocalVariables: true,
  beforeSend,
  integrations: [
    ...sharedIntegrations(),
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightIntegration()]
      : []),
  ],
});
```

In the edge init (line 36):
```typescript
init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  beforeSend,
  integrations: sharedIntegrations(),
});
```

#### 4. `apps/platform/src/instrumentation.ts` — Same beforeSend

**File**: `apps/platform/src/instrumentation.ts`

Identical changes as `apps/app/src/instrumentation.ts` — add `TRPCError` import, `EXPECTED_TRPC_CODES` set, `beforeSend` function, and pass to both `init()` calls.

#### 5. `apps/www/src/instrumentation.ts` — No change needed

The www app doesn't use tRPC — no `beforeSend` filter needed. Sentry config stays as-is.

### Success Criteria

#### Automated Verification

- [ ] `pnpm check && pnpm typecheck` passes
- [ ] `pnpm build:app` passes (instrumentation.ts is evaluated at build time)
- [ ] `pnpm build:platform` passes
- [ ] `grep -rn "beforeSend" apps/app/src/instrumentation.ts apps/platform/src/instrumentation.ts` shows matches in both files
- [ ] `grep -rn "EXPECTED_TRPC" apps/app/src/ apps/platform/src/` shows the constant in route handlers and instrumentation files

#### Manual Verification

- [ ] Trigger a 401 (unauthenticated tRPC call) — verify it appears as `log.info("[trpc] expected error")` in logs, NOT `log.error`
- [ ] Verify the 401 does NOT appear in Sentry
- [ ] Trigger a real 500 (e.g., DB connection error) — verify it appears as `log.error("[trpc] unexpected error")` AND in Sentry

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests

No new unit tests required — these changes add logging (side effects) and error message enrichment to existing code paths. The existing test suites (`pnpm --filter @repo/app-providers test`) validate that the functional behavior hasn't changed.

### Integration Tests

Not applicable — the changes are observability-only. The tRPC procedures, provider calls, and token operations continue to behave identically.

### Manual Testing Steps

1. **Proxy logging**: Make a proxy request through the app to a provider API. Verify `[proxy]` prefix logs appear with installationId, provider, and endpointId.
2. **Token flow logging**: Disconnect and reconnect a provider. Verify `[token-store] token record written` and `[oauth/state] state stored/consumed` appear.
3. **Provider body capture**: Temporarily use an invalid GitHub App key. Verify the error message now includes the response body (e.g., `"Bad credentials"` or `"This installation has been suspended"`).
4. **Observability middleware**: Make any tRPC call. Verify the log includes `ok: true`, `type: "query"` or `"mutation"`, `userId`, `orgId`.
5. **Error classification**: Access a protected resource without auth. Verify `[trpc] expected error` appears at `info` level. Check Sentry to confirm no event was created.

## Performance Considerations

- **Response body reads on error** (`readErrorBody`): Only called on `!response.ok` paths — not on happy-path responses. The 200-char truncation prevents reading large error pages. Negligible performance impact.
- **Observability middleware**: Replaces `timingMiddleware` 1:1. The only additional work is spreading a few auth fields into the metadata object — nanoseconds.
- **`beforeSend` filter**: One `instanceof` check + one `Set.has` per Sentry event. Reduces Sentry volume (fewer events sent), so net positive.

## Migration Notes

No migrations needed. All changes are additive (new log calls, enriched error messages, new Sentry filter). No breaking changes to any public API or contract.

## References

- Original research: `thoughts/shared/research/2026-04-05-logging-error-handling-architecture.md`
- Logging pattern exemplars: `api/platform/src/lib/jobs.ts`, `api/platform/src/lib/oauth/authorize.ts`
- Error extraction pattern: `api/platform/src/inngest/functions/connection-lifecycle.ts:86`
- Sentry beforeSend docs: `@sentry/nextjs` API — `init({ beforeSend })` callback
