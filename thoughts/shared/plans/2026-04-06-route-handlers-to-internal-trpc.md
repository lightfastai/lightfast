# Route Handlers → Internal tRPC Procedures

## Overview

Migrate all async business logic from the 4 non-trivial `apps/platform` route handlers into internal tRPC procedures on `api/platform/src/internal.ts`. Route handlers become thin HTTP adapters that parse requests and delegate to `platform.*` procedures. This is Phase 2 of the "tRPC as source of truth" migration — Phase 1 (infrastructure) is complete.

## Current State Analysis

`apps/platform` has 4 route handlers that bypass tRPC entirely:

| Route | File | What it does directly |
|---|---|---|
| `POST /api/ingest/[provider]` | `apps/platform/src/app/api/ingest/[provider]/route.ts` | Webhook header validation, HMAC verification, JSON parse, DB insert (`gatewayWebhookDeliveries`), `inngest.send()` |
| `GET /api/connect/[provider]/authorize` | `apps/platform/src/app/api/connect/[provider]/authorize/route.ts` | Calls `buildAuthorizeUrl()` from `@api/platform/lib/oauth/authorize` |
| `GET /api/connect/[provider]/callback` | `apps/platform/src/app/api/connect/[provider]/callback/route.ts` | Calls `processOAuthCallback()` from `@api/platform/lib/oauth/callback` — DB reads/writes, token exchange, Redis state management |
| `GET /api/connect/oauth/poll` | `apps/platform/src/app/api/connect/oauth/poll/route.ts` | Calls `getOAuthResult()` from `@api/platform/lib/oauth/state` — Redis read |

The internal caller at `apps/platform/src/lib/internal-caller.ts` is wired (`createInternalCaller("route")`) but unused — route handlers import lib functions directly.

### Key Discoveries:

- `oauth/callback.ts:351` still has a manual `err instanceof Error ? err.message : "unknown"` ternary — one of the 12 sites from the parseError research. This is inside `processOAuthCallback`'s own catch block, NOT in the route handler — moving the call into a tRPC procedure does NOT eliminate it. We fix it inline as part of this plan (replace with `parseError(err)`).
- `connections.ts:103-149` (the `getToken` serviceProcedure) already calls `getActiveTokenForInstallation` and maps errors to TRPCError codes — this is the exact pattern internal procedures should follow.
- `buildAuthorizeUrl` already returns a typed `{ ok: true, url, state } | { ok: false, error }` result — clean for procedure wrapping.
- `processOAuthCallback` returns `CallbackProcessResult` (redirect | inline_html | error) — the route handler maps this to HTTP responses. The procedure returns the same union; the route handler maps it to `NextResponse`.
- The ingest route uses `@repo/app-providers` functions (`getProvider`, `hasInboundWebhooks`, `deriveVerifySignature`) for webhook verification and `@db/app/client` for DB persist. All imports already exist in `@api/platform` dependencies.

## Desired End State

All 4 route handlers delegate to `platform.*` internal procedures:

```
POST /api/ingest/[provider]     → platform.webhooks.ingest({ provider, rawBody, headers })
GET  /connect/[provider]/authorize → platform.oauth.buildAuthorizeUrl({ provider, orgId, ... })
GET  /connect/[provider]/callback  → platform.oauth.processCallback({ provider, state, query })
GET  /connect/oauth/poll           → platform.oauth.pollResult({ state })
```

Route handlers contain ONLY: request parsing, `platform.*` call, HTTP response mapping. Zero direct DB, Redis, or lib imports.

### Verification:

- `pnpm build:platform` passes
- `pnpm --filter @api/platform typecheck && pnpm --filter lightfast-platform typecheck` passes
- All 4 endpoints behave identically (same HTTP status codes, same response shapes, same HMAC verification)

## What We're NOT Doing

- Migrating Inngest functions to internal tRPC (Phase 3, separate plan)
- Changing `serviceProcedure` routers (`connections`, `proxy`, `backfill`) to delegate to internal procedures (Phase 4)
- Changing webhook HMAC verification logic — just moving it
- Modifying the tRPC HTTP handler at `/api/trpc/[trpc]`

## Implementation Approach

Create 2 new sub-routers on the internal router (`webhooks`, `oauth`), move existing lib logic into procedure handlers, then slim down route handlers to HTTP adapters. Each sub-router is one self-contained step.

---

## Phase 1: `webhooks` Sub-Router — Ingest Endpoint

### Overview

Move the webhook ingestion logic (HMAC verification, DB persist, Inngest dispatch) from the route handler into `platform.webhooks.ingest()`. The route handler becomes a thin POST adapter.

### Changes Required:

#### 1. Create Webhooks Internal Router

**File**: `api/platform/src/router/internal/webhooks.ts` (new)

```ts
/**
 * Internal webhooks sub-router.
 *
 * Handles webhook ingestion: HMAC verification, DB persistence, Inngest dispatch.
 * Moved from apps/platform/src/app/api/ingest/[provider]/route.ts.
 */
import { inngest } from "../../inngest/client";
import { getProviderConfigs } from "../../lib/provider-configs";
import { db } from "@db/app/client";
import { gatewayWebhookDeliveries } from "@db/app/schema";
import type { WebhookDef } from "@repo/app-providers";
import {
  deriveVerifySignature,
  getProvider,
  hasInboundWebhooks,
  isWebhookProvider,
} from "@repo/app-providers";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import { internalProcedure } from "../../trpc";

// ── Helpers (moved from route handler) ──────────────────────────────────────

function getWebhookDef(
  providerDef: NonNullable<ReturnType<typeof getProvider>>
): WebhookDef<unknown> | null {
  if (isWebhookProvider(providerDef)) {
    return providerDef.webhook as WebhookDef<unknown>;
  }
  if (providerDef.kind === "managed") {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  if (
    providerDef.kind === "api" &&
    "inbound" in providerDef &&
    providerDef.inbound
  ) {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  return null;
}

// ── Router ──────────────────────────────────────────────────────────────────

export const webhooksInternalRouter = {
  /**
   * Ingest a webhook delivery: verify HMAC, persist to DB, dispatch to Inngest.
   *
   * The route handler extracts rawBody and headers from the HTTP request
   * and passes them here. This procedure handles everything else.
   *
   * Returns the response shape for the route handler to forward as JSON.
   */
  ingest: internalProcedure
    .input(
      z.object({
        provider: z.string(),
        rawBody: z.string(),
        headers: z.record(z.string()),
        receivedAt: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { provider: providerSlug, rawBody, headers, receivedAt } = input;

      // Provider guard
      const providerDef = getProvider(providerSlug);
      if (!providerDef) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `unknown_provider: ${providerSlug}`,
        });
      }

      if (!hasInboundWebhooks(providerDef)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `not_webhook_provider: ${providerSlug}`,
        });
      }

      const webhookDef = getWebhookDef(providerDef);
      if (!webhookDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `no_webhook_def: ${providerSlug}`,
        });
      }

      // Webhook header validation
      const headersObj: Record<string, string | undefined> = {};
      for (const key of Object.keys(
        (webhookDef.headersSchema as { shape: Record<string, unknown> }).shape
      )) {
        headersObj[key] = headers[key] ?? undefined;
      }
      const headersParsed = webhookDef.headersSchema.safeParse(headersObj);
      if (!headersParsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "missing_headers",
        });
      }

      // Signature verification
      const configs = getProviderConfigs();
      const providerConfig = configs[providerSlug];
      if (!providerConfig) {
        log.error("[webhooks.ingest] provider config not found", {
          provider: providerSlug,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `provider_not_configured: ${providerSlug}`,
        });
      }

      const secret = (webhookDef.extractSecret as (config: unknown) => string)(
        providerConfig
      );
      const verify =
        webhookDef.verifySignature ??
        deriveVerifySignature(webhookDef.signatureScheme);

      // Build a Headers object for the verify function (it expects Headers, not Record)
      const reqHeaders = new Headers(headers);
      const isValid = await verify(rawBody, reqHeaders, secret);
      if (!isValid) {
        log.warn("[webhooks.ingest] signature verification failed", {
          provider: providerSlug,
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "signature_invalid",
        });
      }

      // Payload parse + metadata extraction
      let jsonPayload: unknown;
      try {
        jsonPayload = JSON.parse(rawBody);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "invalid_json",
        });
      }

      let parsedPayload: unknown;
      try {
        parsedPayload = webhookDef.parsePayload(jsonPayload);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `payload_validation_failed: ${providerSlug}`,
        });
      }

      const deliveryId = webhookDef.extractDeliveryId(reqHeaders, parsedPayload);
      const eventType = webhookDef.extractEventType(reqHeaders, parsedPayload);
      const resourceId = webhookDef.extractResourceId(parsedPayload);

      // Persist to DB
      await db
        .insert(gatewayWebhookDeliveries)
        .values({
          provider: providerSlug,
          deliveryId,
          eventType,
          installationId: null,
          status: "received",
          payload: JSON.stringify(parsedPayload),
          receivedAt: new Date(receivedAt).toISOString(),
        })
        .onConflictDoNothing();

      // Dispatch Inngest event
      const correlationId = crypto.randomUUID();

      await inngest.send({
        id: `wh-${providerSlug}-${deliveryId}`,
        name: "platform/webhook.received",
        data: {
          provider: providerSlug,
          deliveryId,
          eventType,
          resourceId,
          payload: parsedPayload,
          receivedAt,
          correlationId,
        },
      });

      log.info("[webhooks.ingest] webhook received", {
        provider: providerSlug,
        deliveryId,
        eventType,
        resourceId,
        correlationId,
      });

      return { status: "accepted" as const, deliveryId };
    }),
} satisfies TRPCRouterRecord;
```

#### 2. Mount on Internal Router

**File**: `api/platform/src/internal.ts`

Replace the current `ping`-only router with:

```ts
/**
 * Internal platform router — in-process callers only.
 *
 * NOT served over HTTP. Accessed exclusively via createInternalCaller().
 * All procedures use internalProcedure (observability middleware, no auth).
 */
import { createTRPCRouter } from "./trpc";
import { oauthInternalRouter } from "./router/internal/oauth";
import { webhooksInternalRouter } from "./router/internal/webhooks";

// -- Internal Router ----------------------------------------------------------

export const internalRouter = createTRPCRouter({
  webhooks: webhooksInternalRouter,
  oauth: oauthInternalRouter,
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

Note: The `ping` procedure is removed — it served its proof-of-concept purpose. Real sub-routers now validate the chain.

#### 3. Slim Down Ingest Route Handler

**File**: `apps/platform/src/app/api/ingest/[provider]/route.ts`

Replace the entire file with a thin HTTP adapter:

```ts
/**
 * POST /api/ingest/:provider
 *
 * Webhook ingestion endpoint for external provider webhooks.
 * Validates HMAC signatures and dispatches to the Inngest pipeline.
 *
 * NOT tRPC — external providers send raw HTTP with HMAC signatures.
 * All business logic lives in platform.webhooks.ingest().
 */
import { platform } from "@/lib/internal-caller";
import { TRPCError } from "@trpc/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const receivedAt = Date.now();
  const rawBody = await req.text();

  // Collect headers as a plain Record for the tRPC procedure
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  try {
    const result = await platform.webhooks.ingest({
      provider,
      rawBody,
      headers,
      receivedAt,
    });

    return Response.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof TRPCError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        INTERNAL_SERVER_ERROR: 500,
      };
      const status = statusMap[err.code] ?? 500;
      return Response.json(
        { error: err.message },
        { status }
      );
    }
    throw err;
  }
}
```

### Success Criteria:

#### Automated Verification:

- [x] Type-check passes: `pnpm --filter @api/platform typecheck`
- [x] Platform app type-check passes: `pnpm --filter @lightfast/platform typecheck`
- [x] Platform build passes: `pnpm build:platform`

#### Manual Verification:

- [ ] `POST /api/ingest/github` with valid HMAC returns `202 { status: "accepted", deliveryId: "..." }`
- [ ] `POST /api/ingest/unknown` returns `404 { error: "unknown_provider: unknown" }`
- [ ] `POST /api/ingest/github` with invalid signature returns `401 { error: "signature_invalid" }`
- [ ] Observability middleware fires — check logs for `[trpc] ok` with `source: "route"` on success and `[trpc] client error` on 4xx

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

**Implementation Notes (2026-04-06)**:
- `z.record(z.string())` → `z.record(z.string(), z.string())`: Zod in this project requires key+value schemas for `z.record()`
- `@/lib/internal-caller` → `~/lib/internal-caller`: Platform app uses `~/*` path alias, not `@/*`
- `new Headers(headers)` → `new Headers(Object.entries(headers))`: Zod's `z.record()` output type doesn't match `HeadersInit`; `Object.entries()` bridges the gap
- `headers[key]` needs explicit cast to `Record<string, string>` before indexing (Zod record output type inference)

---

## Phase 2: `oauth` Sub-Router — Authorize, Callback, Poll

### Overview

Move all 3 OAuth route handler lib calls into `platform.oauth.*` procedures. These handlers are already thin (authorize: 54 lines, callback: 69 lines, poll: 35 lines), so the primary benefit is architectural consistency and uniform observability timing — not code reduction.

**Observability caveat**: `processOAuthCallback` catches errors internally and returns `{ kind: "error" }`. The tRPC observability middleware will always see "ok" for the callback procedure, even on OAuth failures. This is acceptable — wall-clock timing is still captured. If failure-aware observability is needed, `processOAuthCallback` should be refactored to throw (separate concern, Phase 3+).

### Changes Required:

#### 1. Create OAuth Internal Router

**File**: `api/platform/src/router/internal/oauth.ts` (new)

```ts
/**
 * Internal OAuth sub-router.
 *
 * Handles OAuth authorize URL generation, callback processing, and CLI polling.
 * Moved from apps/platform/src/app/api/connect/ route handlers.
 */
import { z } from "zod";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { internalProcedure } from "../../trpc";
import { buildAuthorizeUrl } from "../../lib/oauth/authorize";
import {
  type CallbackProcessResult,
  processOAuthCallback,
} from "../../lib/oauth/callback";
import { getOAuthResult } from "../../lib/oauth/state";
import type { SourceType } from "@repo/app-providers";

// ── Router ──────────────────────────────────────────────────────────────────

export const oauthInternalRouter = {
  /**
   * Build OAuth authorize URL for a provider.
   *
   * Generates a cryptographically random state token, stores it in Redis,
   * and returns the authorization URL.
   */
  buildAuthorizeUrl: internalProcedure
    .input(
      z.object({
        provider: z.string(),
        orgId: z.string(),
        connectedBy: z.string(),
        redirectTo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await buildAuthorizeUrl({
        provider: input.provider as SourceType,
        orgId: input.orgId,
        connectedBy: input.connectedBy,
        redirectTo: input.redirectTo,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
        });
      }

      return { url: result.url, state: result.state };
    }),

  /**
   * Process OAuth callback: validate state, exchange code, upsert installation,
   * persist tokens, store result for CLI polling.
   *
   * Returns CallbackProcessResult — the route handler maps this to HTTP responses
   * (redirect, inline HTML, or error JSON).
   */
  processCallback: internalProcedure
    .input(
      z.object({
        provider: z.string(),
        state: z.string(),
        query: z.record(z.string()),
      })
    )
    .mutation(async ({ input }): Promise<CallbackProcessResult> => {
      return processOAuthCallback({
        provider: input.provider as SourceType,
        state: input.state,
        query: input.query,
      });
    }),

  /**
   * Poll for OAuth completion result.
   *
   * Returns the result hash from Redis if the OAuth flow has completed,
   * or null if still pending.
   */
  pollResult: internalProcedure
    .input(
      z.object({
        state: z.string(),
      })
    )
    .query(async ({ input }) => {
      return getOAuthResult(input.state);
    }),
} satisfies TRPCRouterRecord;
```

#### 2. Slim Down Authorize Route Handler

**File**: `apps/platform/src/app/api/connect/[provider]/authorize/route.ts`

Replace with:

```ts
/**
 * GET /api/connect/:provider/authorize
 *
 * Initiate OAuth flow. Returns authorize URL + state for browser OAuth.
 * All business logic lives in platform.oauth.buildAuthorizeUrl().
 */
import { platform } from "@/lib/internal-caller";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  const orgId = req.nextUrl.searchParams.get("org_id");
  const connectedBy =
    req.nextUrl.searchParams.get("connected_by") ??
    req.headers.get("X-User-Id") ??
    "unknown";
  const redirectTo = req.nextUrl.searchParams.get("redirect_to") ?? undefined;

  if (!orgId) {
    log.warn("[oauth/authorize] missing org_id", { provider });
    return Response.json({ error: "missing_org_id" }, { status: 400 });
  }

  try {
    const result = await platform.oauth.buildAuthorizeUrl({
      provider,
      orgId,
      connectedBy,
      redirectTo,
    });

    log.info("[oauth/authorize] authorize URL built", { provider });
    return Response.json(result);
  } catch (err) {
    if (err instanceof TRPCError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
```

#### 3. Slim Down Callback Route Handler

**File**: `apps/platform/src/app/api/connect/[provider]/callback/route.ts`

Replace with:

```ts
/**
 * GET /api/connect/:provider/callback
 *
 * OAuth callback. Provider redirects here after authorization.
 * All business logic lives in platform.oauth.processCallback().
 * Maps CallbackProcessResult to HTTP responses.
 */
import { platform } from "@/lib/internal-caller";
import { log } from "@vendor/observability/log/next";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  const query: Record<string, string> = Object.assign(
    Object.create(null) as Record<string, string>,
    Object.fromEntries(req.nextUrl.searchParams)
  );

  const state = query.state ?? "";

  const result = await platform.oauth.processCallback({
    provider,
    state,
    query,
  });

  switch (result.kind) {
    case "redirect":
      log.info("[oauth/callback] redirecting", { provider });
      return NextResponse.redirect(result.url);

    case "inline_html":
      log.info("[oauth/callback] inline html response", {
        provider,
        status: result.status ?? 200,
      });
      return new Response(result.html, {
        status: result.status ?? 200,
        headers: { "Content-Type": "text/html" },
      });

    case "error":
      log.warn("[oauth/callback] error result", {
        provider,
        error: result.error,
        status: result.status,
      });
      return Response.json({ error: result.error }, { status: result.status });

    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
```

#### 4. Fix `parseError` Ternary in `processOAuthCallback`

**File**: `api/platform/src/lib/oauth/callback.ts`

At line 351, replace the manual ternary with `parseError`:

```diff
+ import { parseError } from "@vendor/observability/error/next";
  // ... (add to existing imports)

  } catch (err) {
-   const message = err instanceof Error ? err.message : "unknown";
+   const message = parseError(err);
    log.error("[oauth/callback] oauth callback failed", {
```

One-line fix. `parseError` is already used elsewhere in the platform codebase (e.g., `ingest/[provider]/route.ts`).

#### 5. Slim Down Poll Route Handler

**File**: `apps/platform/src/app/api/connect/oauth/poll/route.ts`

Replace with:

```ts
/**
 * GET /api/connect/oauth/poll
 *
 * Poll for OAuth completion. CLI polling with state token as auth.
 * All business logic lives in platform.oauth.pollResult().
 */
import { platform } from "@/lib/internal-caller";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");

  if (!state) {
    log.warn("[oauth/poll] missing state token");
    return Response.json({ error: "missing_state" }, { status: 400 });
  }

  const result = await platform.oauth.pollResult({ state });

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

- [x] Type-check passes: `pnpm --filter @api/platform typecheck`
- [x] Platform app type-check passes: `pnpm --filter @lightfast/platform typecheck`
- [x] Platform build passes: `pnpm build:platform`
- [x] Full check: `pnpm check`

#### Manual Verification:

- [ ] OAuth authorize flow works end-to-end (click "Connect" in app → redirected to provider → callback processes correctly)
- [ ] CLI OAuth polling works (`GET /api/connect/oauth/poll?state=...` returns `{ status: "pending" }` then result)
- [ ] GitHub state-recovery path works (callback without our state token but with `installation_id` recovers via DB lookup)
- [ ] Inline HTML response works for CLI-initiated flows (`redirectTo=inline`)
- [ ] Observability middleware fires on all 3 procedures — check logs for `[trpc] ok` with `source: "route"`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Phase 3: Cleanup — Remove Dead Imports from Route Handlers

### Overview

After Phases 1-2, the route handler files should have no direct imports from `@api/platform/lib/*`, `@db/*`, or `@vendor/inngest`. Verify this is the case and clean up any residual imports.

### Changes Required:

#### 1. Verify No Direct DB/Lib Imports in Route Handlers

Run: `grep -r "@api/platform/lib\|@db/app\|@vendor/inngest" apps/platform/src/app/api/ --include="*.ts" --include="*.tsx"`

Expected: zero matches except the Inngest route handler (`/api/inngest/route.ts` which mounts the serve handler — this stays).

#### 2. Verify `internalRouter` Is Not HTTP-Exposed

Run: `grep -r "internalRouter" apps/platform/src/app/ --include="*.ts" --include="*.tsx"`

Expected: zero matches. The internal router must only be accessible via `createInternalCaller()`.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm check` passes
- [x] `pnpm build:platform` passes
- [x] No direct `@db/app`, `@api/platform/lib`, or Inngest client imports in `apps/platform/src/app/api/` (except `/api/inngest/route.ts`)

---

## Testing Strategy

### Automated Tests:

- Type-checking across both `@api/platform` and `lightfast-platform`
- Full monorepo check (`pnpm check`)

### Manual Testing Steps:

1. **Webhook ingestion**: Send a test webhook to `POST /api/ingest/github` with valid HMAC → verify 202, DB row in `gatewayWebhookDeliveries`, Inngest event dispatched
2. **Webhook rejection**: Send with invalid HMAC → verify 401
3. **OAuth authorize**: Hit `GET /api/connect/github/authorize?org_id=...&connected_by=...` → verify redirect URL returned
4. **OAuth callback**: Complete a full OAuth flow (GitHub or Sentry) → verify installation upserted, token persisted, redirect works
5. **OAuth poll**: Start a CLI OAuth flow, poll with state token → verify pending then completed

## Performance Considerations

- **Zero overhead**: `createInternalCaller()` is synchronous, no JWT. The observability middleware adds ~0ms in production.
- **One extra function call per request**: Route handler → tRPC procedure → lib function. Negligible vs the actual I/O (DB, Redis, HTTP to providers).
- **Headers serialization**: The ingest route converts `req.headers` to `Record<string, string>` and the procedure reconstructs `new Headers(headers)` for the verify function. This is a one-time O(n) copy over ~10-20 headers.

## Architecture After This Plan

```
apps/platform (thin HTTP adapters)
├── /api/ingest/[provider]        → platform.webhooks.ingest()
├── /api/connect/.../authorize    → platform.oauth.buildAuthorizeUrl()
├── /api/connect/.../callback     → platform.oauth.processCallback()
├── /api/connect/oauth/poll       → platform.oauth.pollResult()
├── /api/inngest                  → mounts Inngest functions (unchanged)
└── /api/trpc/[trpc]              → HTTP adapter for platformRouter (unchanged)

api/platform
├── internalRouter (no auth, observability middleware)
│   ├── webhooks.ingest
│   ├── oauth.buildAuthorizeUrl
│   ├── oauth.processCallback
│   └── oauth.pollResult
│
├── platformRouter (JWT auth, for cross-service HTTP)
│   ├── connections.* (6 procedures — unchanged)
│   ├── proxy.* (2 procedures — unchanged)
│   └── backfill.* (3 procedures — unchanged)
│
└── lib/ (still exists — called by internal procedures, not route handlers)
    ├── oauth/authorize.ts (called by oauth.buildAuthorizeUrl)
    ├── oauth/callback.ts (called by oauth.processCallback)
    ├── oauth/state.ts (called by oauth.pollResult)
    └── provider-configs.ts (called by webhooks.ingest)
```

The lib layer remains as the implementation layer — procedures are the interface layer. Route handlers never reach past procedures into lib.

## References

- Phase 1 plan: `thoughts/shared/plans/2026-04-06-internal-trpc-caller-setup.md`
- parseError research: `thoughts/shared/research/2026-04-05-parseerror-full-propagation-inventory.md` — `callback.ts:351` manual ternary is fixed inline as part of Phase 2
- Current ingest route: `apps/platform/src/app/api/ingest/[provider]/route.ts`
- Current OAuth routes: `apps/platform/src/app/api/connect/`
- Internal caller (Phase 1 output): `apps/platform/src/lib/internal-caller.ts`
- Existing service router pattern: `api/platform/src/router/platform/connections.ts`

## Improvement Log

**2026-04-06 — Adversarial review (`/improve_plan`)**

1. **Fixed false claim about `callback.ts:351` ternary** (Critical). The plan originally claimed that wrapping the route handler in a tRPC procedure would eliminate the `err instanceof Error ? err.message : "unknown"` ternary via middleware. This was wrong — the ternary is inside `processOAuthCallback`'s own catch block, not the route handler. tRPC middleware never sees it. Corrected the claim and added an explicit `parseError` fix step in Phase 2 (step 4).

2. **Removed contradictory "What We're NOT Doing" bullet** (Critical). The plan said "NOT adding Zod input schemas" but every procedure uses `.input(z.object(...))`. Removed the contradiction — the Zod schemas are correct and necessary.

3. **Fixed router pattern inconsistency** (High). Existing sub-routers (`connectionsRouter`, `proxyRouter`, `backfillRouter`) all use `export const xRouter = { ... } satisfies TRPCRouterRecord`. The plan used `createTRPCRouter()` for sub-routers, which is a different structural pattern. Changed both `webhooksInternalRouter` and `oauthInternalRouter` to use `satisfies TRPCRouterRecord`, matching the established convention.

4. **Added observability caveat for `processCallback`** (Improvement). `processOAuthCallback` catches errors internally and returns `{ kind: "error" }` — tRPC observability always sees "ok" even on OAuth failures. Documented this limitation in Phase 2 overview. Wall-clock timing still captured, which is the primary observability benefit.

5. **Added context for OAuth migration rationale** (Improvement). The 3 OAuth handlers are already thin (54, 69, 35 lines). Documented that the migration is for architectural consistency and uniform observability, not code reduction. Decision confirmed: migrate all 4 for consistency.
