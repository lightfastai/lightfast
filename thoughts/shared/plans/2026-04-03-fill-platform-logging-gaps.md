---
date: 2026-04-03
author: claude
branch: chore/remove-memory-api-key-service-auth
status: ready
---

# Fill Platform Logging Gaps

## Overview

The research doc `2026-04-03-platform-e2e-logging.md` catalogued every log call in `apps/platform` and `api/platform`. This plan fills the gaps in 5 phases: adding `log` to completely unlogged routes, replacing `console.*` with `log` in tRPC infrastructure, adding observability to `connection-lifecycle.ts`, filling missing code paths in files that already import `log`, and retrofitting the `[prefix]` convention on all unprefixed files.

## Current State Analysis

**No `log` import — completely unlogged:**
- `apps/platform/src/app/api/connect/[provider]/authorize/route.ts` — returns 400s silently
- `apps/platform/src/app/api/connect/[provider]/callback/route.ts` — thin dispatcher, no logging
- `apps/platform/src/app/api/connect/oauth/poll/route.ts` — no logging
- `api/platform/src/inngest/functions/connection-lifecycle.ts` — DB audit trail only

**`console.*` instead of `log` (doesn't route to BetterStack in production):**
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:43` — `console.error` on tRPC errors
- `api/platform/src/trpc.ts:47,58,63,112` — `console.info`, `console.warn`, `console.log`

**Has `log` but missing code paths:**
- `api/platform/src/inngest/functions/memory-notification-dispatch.ts:20-26` — silent skip below threshold
- `api/platform/src/lib/oauth/callback.ts` — only logs in catch; state errors, pending-setup, and success all silent
- `api/platform/src/inngest/functions/memory-entity-embed.ts` — 1 log call; `fetch-entity`, `fetch-narrative-inputs`, `embed-narrative` steps silent

**Missing `[prefix]` convention (existing log calls lack module identifier):**
- `api/platform/src/lib/jobs.ts` — 12 calls, no prefix
- `api/platform/src/lib/edge-resolver.ts` — 3 calls, no prefix
- `api/platform/src/inngest/functions/memory-event-store.ts` — 8 calls, no prefix
- `api/platform/src/inngest/functions/memory-entity-embed.ts` — 1 call, no prefix
- `api/platform/src/inngest/functions/memory-notification-dispatch.ts` — 2 calls, no prefix

## Desired End State

Every request path and Inngest step in `apps/platform` and `api/platform` emits at least one structured `log.*` call that routes to BetterStack in production. No `console.*` calls remain in route handlers or library code (tRPC timing middleware is the only acceptable exception, and even that gets migrated). Every log call carries a `[prefix]` that identifies the module.

### Verification:
- `grep -r "console\." apps/platform/src/app/api/ api/platform/src/` returns 0 results
- `grep -r "console\." api/platform/src/trpc.ts` returns 0 results
- `grep -r "import { log }" apps/platform/src/app/api/ api/platform/src/inngest/functions/connection-lifecycle.ts` shows all target files

## What We're NOT Doing

- Adding logging to middleware (`apps/platform/src/middleware.ts`) — runs on Edge, nosecone-only, no value
- Adding logging to HTML template helpers in `oauth/callback.ts` (`successHtml`, `errorHtml`, `buildRedirectForCompletion`, `buildRedirectForError`) — pure string builders, no I/O
- Changing the `connection-lifecycle.ts` DB audit trail — `gatewayLifecycleLogs` inserts stay as-is; observability logging is additive
- Adding `log` to `apps/platform/src/lib/related-projects.ts` or other pure utility files
- Changing Sentry `captureException` calls — those stay

---

## Phase 1: Add `log` to Unlogged Route Handlers

### Overview

Three OAuth routes in `apps/platform/src/app/api/connect/` have zero logging. Add `log` import and instrument error + success paths.

### Changes Required:

#### 1. `authorize/route.ts`

**File**: `apps/platform/src/app/api/connect/[provider]/authorize/route.ts`

Add `log` import and three log calls:

```typescript
import { buildAuthorizeUrl } from "@api/platform/lib/oauth/authorize";
import type { SourceType } from "@repo/app-providers";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const providerName = provider as SourceType;

  const orgId = req.nextUrl.searchParams.get("org_id");
  const connectedBy =
    req.nextUrl.searchParams.get("connected_by") ??
    req.headers.get("X-User-Id") ??
    "unknown";
  const redirectTo = req.nextUrl.searchParams.get("redirect_to") ?? undefined;

  if (!orgId) {
    log.warn("[oauth/authorize] missing org_id", { provider: providerName });
    return Response.json({ error: "missing_org_id" }, { status: 400 });
  }

  const result = await buildAuthorizeUrl({
    provider: providerName,
    orgId,
    connectedBy,
    redirectTo,
  });

  if (!result.ok) {
    log.warn("[oauth/authorize] failed to build authorize URL", {
      provider: providerName,
      error: result.error,
    });
    return Response.json({ error: result.error }, { status: 400 });
  }

  log.info("[oauth/authorize] authorize URL built", { provider: providerName });
  return Response.json({ url: result.url, state: result.state });
}
```

#### 2. `callback/route.ts`

**File**: `apps/platform/src/app/api/connect/[provider]/callback/route.ts`

The route is a thin dispatcher over `processOAuthCallback`. Add logging for each result kind so the route layer is traceable independently of the lib layer:

```typescript
import {
  type CallbackProcessResult,
  processOAuthCallback,
} from "@api/platform/lib/oauth/callback";
import type { SourceType } from "@repo/app-providers";
import { log } from "@vendor/observability/log/next";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const providerName = provider as SourceType;

  const query: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams) {
    query[k] = v;
  }

  const state = query.state ?? "";

  const result: CallbackProcessResult = await processOAuthCallback({
    provider: providerName,
    state,
    query,
  });

  switch (result.kind) {
    case "redirect":
      log.info("[oauth/callback] redirecting", { provider: providerName });
      return NextResponse.redirect(result.url);

    case "inline_html":
      log.info("[oauth/callback] inline html response", {
        provider: providerName,
        status: result.status ?? 200,
      });
      return new Response(result.html, {
        status: result.status ?? 200,
        headers: { "Content-Type": "text/html" },
      });

    case "error":
      log.warn("[oauth/callback] error result", {
        provider: providerName,
        error: result.error,
        status: result.status,
      });
      return Response.json({ error: result.error }, { status: result.status });
  }
}
```

#### 3. `poll/route.ts`

**File**: `apps/platform/src/app/api/connect/oauth/poll/route.ts`

Add logging for the error path only. The `pending` response is intentionally silent (very chatty during polling). Truncate the state token in logs to avoid leaking the secret.

```typescript
import { getOAuthResult } from "@api/platform/lib/oauth/state";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");

  if (!state) {
    log.warn("[oauth/poll] missing state token");
    return Response.json({ error: "missing_state" }, { status: 400 });
  }

  const result = await getOAuthResult(state);

  if (!result) {
    return Response.json({ status: "pending" });
  }

  log.info("[oauth/poll] result found", {
    state: `${state.slice(0, 8)}...`,
  });
  return Response.json(result);
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [x] `grep -rn "import { log }" apps/platform/src/app/api/connect/` shows all 3 files

---

## Phase 2: Replace `console.*` with `log` in tRPC Infrastructure

### Overview

Two tRPC files use `console.*` directly, bypassing BetterStack in production. Replace all calls with `log.*`.

### Changes Required:

#### 1. `api/platform/src/trpc.ts`

**Current**: `console.info`, `console.warn`, `console.log` on lines 47, 58, 63, 112.

Add `log` import after the existing imports:
```typescript
import { log } from "@vendor/observability/log/next";
```

Replace line 47-49 (`console.info` for successful JWT auth):
```typescript
// Before:
console.info(
  `>>> Memory tRPC Request from ${source} - service JWT (caller: ${verified.caller})`
);

// After:
log.info("[trpc] memory service request", {
  source,
  auth: "service",
  caller: verified.caller,
});
```

Replace line 58 (`console.warn` for JWT verification error):
```typescript
// Before:
console.warn("[Memory Auth] JWT verification error:", error);

// After:
log.warn("[trpc] JWT verification error", {
  source,
  error: error instanceof Error ? error.message : String(error),
});
```

Replace line 63 (`console.info` for unauthenticated):
```typescript
// Before:
console.info(`>>> Memory tRPC Request from ${source} - unauthenticated`);

// After:
log.info("[trpc] memory service request", { source, auth: "unauthenticated" });
```

Replace line 112 (`console.log` for timing middleware):
```typescript
// Before:
console.log(`[TRPC:memory] ${path} took ${end - start}ms to execute`);

// After:
log.info("[trpc] procedure timing", { path, durationMs: end - start });
```

#### 2. `apps/platform/src/app/api/trpc/[trpc]/route.ts`

Add `log` import (after existing imports):
```typescript
import { log } from "@vendor/observability/log/next";
```

Replace line 43 (`console.error` in `onError`):
```typescript
// Before:
console.error(`>>> tRPC Error on 'memory.${path}'`, error);

// After:
log.error("[trpc] procedure error", {
  path,
  error: error.message,
  code: error.code,
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [x] `grep -n "console\." api/platform/src/trpc.ts` returns 0 results
- [x] `grep -n "console\." apps/platform/src/app/api/trpc/\[trpc\]/route.ts` returns 0 results

---

## Phase 3: Add Observability Logging to `connection-lifecycle.ts`

### Overview

`connection-lifecycle.ts` writes every state transition to `gatewayLifecycleLogs` (DB) but emits zero observability logs. Add `log` import and instrument each step — including the silent early-return paths in `revoke-token`.

### Changes Required:

**File**: `api/platform/src/inngest/functions/connection-lifecycle.ts`

Add `log` import after the existing imports:
```typescript
import { log } from "@vendor/observability/log/next";
```

**Function entry** (after destructuring `event.data`):
```typescript
log.info("[connection-lifecycle] starting", {
  installationId,
  provider: providerName,
});
```

**`close-gate` step** (after the DB insert):
```typescript
log.info("[connection-lifecycle] gate closed", { installationId });
```

**`cancel-backfill` step** (after `inngest.send`):
```typescript
log.info("[connection-lifecycle] backfill cancellation sent", { installationId });
```

In the catch block of `cancel-backfill`:
```typescript
} catch (err) {
  log.warn("[connection-lifecycle] backfill cancellation failed (best-effort)", {
    installationId,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

**`revoke-token` step** — replace silent returns with logged returns:
```typescript
// GitHub skip:
if (providerName === "github") {
  log.info("[connection-lifecycle] skipping token revocation (github uses on-demand JWTs)", {
    installationId,
  });
  return;
}

// Missing config:
if (!config) {
  log.warn("[connection-lifecycle] provider not configured, skipping token revocation", {
    installationId,
    provider: providerName,
  });
  return;
}

// Missing token row:
if (!tokenRow) {
  log.info("[connection-lifecycle] no token row found, skipping revocation", {
    installationId,
  });
  return;
}

// Success path (after revokeToken call):
log.info("[connection-lifecycle] token revoked", {
  installationId,
  provider: providerName,
});

// In the catch block:
} catch (err) {
  log.warn("[connection-lifecycle] token revocation failed (best-effort)", {
    installationId,
    provider: providerName,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

**`remove-resources` step** (after the lifecycle log insert):
```typescript
log.info("[connection-lifecycle] resources removed", {
  installationId,
  count: resources.length,
});
```

**Function return** (before `return { success: true, installationId }`):
```typescript
log.info("[connection-lifecycle] teardown complete", {
  installationId,
  provider: providerName,
});
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [x] `grep -n "import { log }" api/platform/src/inngest/functions/connection-lifecycle.ts` shows 1 result

---

## Phase 4: Fill Missing Code Paths

### Overview

Three files already import `log` but have silent code paths.

### Changes Required:

#### 1. `memory-notification-dispatch.ts` — below-threshold skip

**File**: `api/platform/src/inngest/functions/memory-notification-dispatch.ts`

Add log before the early return at line 21:
```typescript
if (significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
  log.info("[notification-dispatch] below threshold, skipping", {
    clerkOrgId,
    eventExternalId,
    significanceScore,
  });
  return {
    status: "skipped",
    reason: "below_notification_threshold",
    significanceScore,
  };
}
```

#### 2. `oauth/authorize.ts` — no log import, 4 silent error paths

**File**: `api/platform/src/lib/oauth/authorize.ts`

Add `log` import:
```typescript
import { log } from "@vendor/observability/log/next";
```

**Unknown provider** (line 65-67):
```typescript
if (!config) {
  log.warn("[oauth/authorize] provider not configured", { provider });
  return { ok: false, error: "unknown_provider" };
}
```

**Invalid redirect URL — allowlist check** (line 73-75) and **URL parse failure** (line 76-78). Both become `invalid_redirect_to`; log once using the outer `if`:
```typescript
if (redirectTo && redirectTo !== "inline") {
  try {
    const url = new URL(redirectTo);
    if (url.hostname !== "localhost" && !redirectTo.startsWith(consoleUrl)) {
      log.warn("[oauth/authorize] invalid redirect_to (not on allowlist)", {
        provider,
        redirectTo,
      });
      return { ok: false, error: "invalid_redirect_to" };
    }
  } catch {
    log.warn("[oauth/authorize] invalid redirect_to (malformed URL)", {
      provider,
      redirectTo,
    });
    return { ok: false, error: "invalid_redirect_to" };
  }
}
```

**Provider does not support OAuth** (line 103-105):
```typescript
} else {
  log.warn("[oauth/authorize] provider does not support OAuth", { provider });
  return { ok: false, error: "provider_does_not_support_oauth" };
}
```

#### 3. `oauth/callback.ts` — state errors, pending-setup, success, and missed intra-try path

**File**: `api/platform/src/lib/oauth/callback.ts`

**Unknown provider** (line 165-171 — before returning `kind: "error"`):
```typescript
if (!config) {
  log.warn("[oauth/callback] provider not configured", {
    provider: providerName,
  });
  return { kind: "error", error: "unknown_provider", status: 400 };
}
```

**Invalid/expired state** (line 206-211 — before first `kind: "error"` return after `!stateData`):
```typescript
if (!stateData) {
  log.warn("[oauth/callback] invalid or expired state", {
    provider: providerName,
    state: state ? `${state.slice(0, 8)}...` : "empty",
  });
  return { kind: "error", error: "invalid_or_expired_state", status: 400 };
}
```

**Provider mismatch** (line 214-219 — before second state error return):
```typescript
if (stateData.provider !== providerName) {
  log.warn("[oauth/callback] state provider mismatch", {
    provider: providerName,
    stateProvider: stateData.provider,
  });
  return { kind: "error", error: "invalid_or_expired_state", status: 400 };
}
```

**Pending-setup** (line 244-253 — after `storeOAuthResult`):
```typescript
log.info("[oauth/callback] pending setup, redirecting", {
  provider: providerName,
  setupAction: result.setupAction,
});
return buildRedirectForCompletion(stateData, providerName, {
  setupAction: result.setupAction,
});
```

**Provider does not support OAuth** (line 227-233 — inside try block, bypasses catch):
```typescript
if (auth.kind !== "oauth" && auth.kind !== "app-token") {
  log.warn("[oauth/callback] provider does not support OAuth callback", {
    provider: providerName,
    authKind: auth.kind,
  });
  return {
    kind: "error",
    error: "provider_does_not_support_oauth",
    status: 400,
  };
}
```

**Connected success** (line 326-328 — before `buildRedirectForCompletion`):
```typescript
log.info("[oauth/callback] connected", {
  provider: providerName,
  reactivated,
});
return buildRedirectForCompletion(stateData, providerName, { reactivated });
```

#### 5. `memory-entity-embed.ts` — step entry/error paths

**File**: `api/platform/src/inngest/functions/memory-entity-embed.ts`

**Function entry** (after destructuring `event.data`):
```typescript
log.info("[entity-embed] starting", {
  clerkOrgId,
  entityExternalId,
  provider,
  correlationId,
});
```

**`fetch-entity` step** — before throwing `NonRetriableError`:
```typescript
if (!row) {
  log.warn("[entity-embed] entity not found, aborting", {
    entityExternalId,
    correlationId,
  });
  throw new NonRetriableError(`Entity not found: ${entityExternalId}`);
}
```

**`embed-narrative` step** — before throwing `Error` on missing vector:
```typescript
const vector = embeddings[0];
if (!vector) {
  log.error("[entity-embed] embedding provider returned no vector", {
    entityExternalId,
    correlationId,
  });
  throw new Error("Embedding provider returned no vector");
}
```

**Narrative cap** (line 181 — if `narrative.length > NARRATIVE_CHAR_CAP`, worth noting silently):
```typescript
const cappedNarrative = narrative.slice(0, NARRATIVE_CHAR_CAP);
if (narrative.length > NARRATIVE_CHAR_CAP) {
  log.warn("[entity-embed] narrative capped", {
    entityExternalId,
    original: narrative.length,
    cap: NARRATIVE_CHAR_CAP,
    correlationId,
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [x] `grep -c "log\." api/platform/src/inngest/functions/memory-notification-dispatch.ts` returns ≥ 3
- [x] `grep -c "log\." api/platform/src/lib/oauth/callback.ts` returns ≥ 7
- [x] `grep -c "log\." api/platform/src/lib/oauth/authorize.ts` returns ≥ 4
- [x] `grep -c "log\." api/platform/src/inngest/functions/memory-entity-embed.ts` returns ≥ 4

---

## Phase 5: Retrofit `[prefix]` Convention

### Overview

Five files have existing log calls but omit the `[prefix]` module identifier that makes BetterStack filtering tractable. Update all messages to match the convention used by the rest of the codebase.

### Changes Required:

#### 1. `api/platform/src/lib/jobs.ts` → prefix `[jobs]`

| Line | Old message | New message |
|---|---|---|
| 47 | `"Invalid workflow input"` | `"[jobs] invalid workflow input"` |
| 61 | `"Job already exists, returning existing ID"` | `"[jobs] job already exists"` |
| 88 | `"Created job record"` | `"[jobs] job created"` |
| 96 | `"Failed to create job record"` | `"[jobs] failed to create job record"` |
| 130 | `"Updated job status"` | `"[jobs] job status updated"` |
| 132 | `"Failed to update job status"` | `"[jobs] failed to update job status"` |
| 165 | `"Invalid workflow output"` | `"[jobs] invalid workflow output"` |
| 206 | `"Completed job"` | `"[jobs] job completed"` |
| 212 | `"Failed to complete job"` | `"[jobs] failed to complete job"` |
| 232 | `"Invalid job ID format"` | `"[jobs] invalid job ID format"` |
| 242 | `"Failed to get job"` | `"[jobs] failed to get job"` |
| 263 | `"Failed to get job by Inngest run ID"` | `"[jobs] failed to get job by inngest run ID"` |

#### 2. `api/platform/src/lib/edge-resolver.ts` → prefix `[edge-resolver]`

| Line | Old message | New message |
|---|---|---|
| 94 | `"Edge resolver co-occurrence limit reached, recent events preferred"` | `"[edge-resolver] co-occurrence limit reached, recent events preferred"` |
| 262 | `"Entity edges created"` | `"[edge-resolver] entity edges created"` |
| 268 | `"Failed to create entity edges"` | `"[edge-resolver] failed to create entity edges"` |

#### 3. `api/platform/src/inngest/functions/memory-event-store.ts` → prefix `[event-store]`

| Line | Old message | New message |
|---|---|---|
| 127 | `"Storing neural observation"` | `"[event-store] storing observation"` |
| 171 | `"Observation already exists, skipping"` | `"[event-store] observation already exists, skipping"` |
| 232 | `"No resource ID in attributes, rejecting event"` | `"[event-store] no resource ID, rejecting event"` |
| 250 | `"Integration not found for resource, rejecting event"` | `"[event-store] integration not found, rejecting event"` |
| 263 | `"Integration is not active, rejecting event (Gate 2)"` | `"[event-store] integration not active, rejecting (Gate 2)"` |
| 283 | `"Event filtered by provider config"` | `"[event-store] event filtered by provider config"` |
| 403 | `"Observation stored"` | `"[event-store] observation stored"` |
| 493 | `"Entities and junctions stored"` | `"[event-store] entities and junctions stored"` |

#### 4. `api/platform/src/inngest/functions/memory-entity-embed.ts` → prefix `[entity-embed]`

The existing call at line 239 (`"Entity vector upserted"`) should become `"[entity-embed] entity vector upserted"`. The new calls added in Phase 4 already include the prefix — no additional work here.

#### 5. `api/platform/src/inngest/functions/memory-notification-dispatch.ts` → prefix `[notification-dispatch]`

| Line | Old message | New message |
|---|---|---|
| 32 | `"Knock not configured, skipping notification"` | `"[notification-dispatch] Knock not configured, skipping"` |
| 49 | `"Knock notification triggered"` | `"[notification-dispatch] Knock notification triggered"` |

The new call added in Phase 4 (`"[notification-dispatch] below threshold, skipping"`) already includes the prefix.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:
- [x] `grep -c '\[jobs\]' api/platform/src/lib/jobs.ts` returns 12
- [x] `grep -c '\[edge-resolver\]' api/platform/src/lib/edge-resolver.ts` returns 3
- [x] `grep -c '\[event-store\]' api/platform/src/inngest/functions/memory-event-store.ts` returns 8
- [x] `grep -c '\[entity-embed\]' api/platform/src/inngest/functions/memory-entity-embed.ts` returns ≥ 4
- [x] `grep -c '\[notification-dispatch\]' api/platform/src/inngest/functions/memory-notification-dispatch.ts` returns 3

---

## Updated Prefix Convention Table (post-implementation)

| Prefix | Source |
|---|---|
| `[ingest]` | `apps/platform/src/app/api/ingest/[provider]/route.ts` |
| `[oauth/authorize]` | `apps/platform/src/app/api/connect/[provider]/authorize/route.ts` |
| `[oauth/callback]` | `apps/platform/src/app/api/connect/[provider]/callback/route.ts` + `api/platform/src/lib/oauth/callback.ts` |
| `[oauth/poll]` | `apps/platform/src/app/api/connect/oauth/poll/route.ts` |
| `[trpc]` | `api/platform/src/trpc.ts` + `apps/platform/src/app/api/trpc/[trpc]/route.ts` |
| `[connection-lifecycle]` | `api/platform/src/inngest/functions/connection-lifecycle.ts` |
| `[ingest-delivery]` | `api/platform/src/inngest/functions/ingest-delivery.ts` |
| `[event-store]` | `api/platform/src/inngest/functions/memory-event-store.ts` |
| `[entity-graph]` | `api/platform/src/inngest/functions/memory-entity-graph.ts` |
| `[entity-embed]` | `api/platform/src/inngest/functions/memory-entity-embed.ts` |
| `[notification-dispatch]` | `api/platform/src/inngest/functions/memory-notification-dispatch.ts` |
| `[backfill-orchestrator]` / `[backfill]` | `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts` |
| `[entity-worker]` / `[backfill]` | `api/platform/src/inngest/functions/memory-entity-worker.ts` |
| `[delivery-recovery]` | `api/platform/src/inngest/functions/delivery-recovery.ts` |
| `[token-refresh]` | `api/platform/src/inngest/functions/token-refresh.ts` |
| `[health-check]` | `api/platform/src/inngest/functions/health-check.ts` |
| `[jobs]` | `api/platform/src/lib/jobs.ts` |
| `[edge-resolver]` | `api/platform/src/lib/edge-resolver.ts` |

---

## References

- Research: `thoughts/shared/research/2026-04-03-platform-e2e-logging.md`
- Route handler patterns: `apps/platform/src/app/api/ingest/[provider]/route.ts`
- BetterStack/console gate: `vendor/observability/src/log/next.ts`
