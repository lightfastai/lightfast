# Console Slimdown + Auth Collapse

## Overview

Two-part refactoring to reduce console scope and simplify deployment:

- **Part A** — Strip M2M routers, neural pipeline, webhook ingress, gateway-proxy procedures, and backfill triggers from console. Console becomes purely UI + org/user tRPC.
- **Part B** — Merge `apps/auth` into `apps/console`, removing a Vercel project and one microfrontend entry.

**Dependency**: Part A step 4 (repoint gateway-proxy) and step 5 (repoint backfill triggers) require `@api/platform` + `@repo/platform-trpc` to exist first. All other steps are independent.

---

## Part A: Console Slimdown

### Phase A1: Drop M2M Router (leaf deletion — no callers outside `console-trpc/server.tsx`)

**Why first**: The m2mRouter has no external HTTP endpoint and its only callers (`createM2MCaller`, `createInngestCaller`) live inside `packages/console-trpc/src/server.tsx`. Deleting it is pure dead-code removal.

#### Step 1: Delete M2M router files

```
DELETE api/console/src/router/m2m/jobs.ts
DELETE api/console/src/router/m2m/sources.ts
DELETE api/console/src/router/m2m/workspace.ts
```

Evidence these are dead:
- `createM2MCaller` (the only import of `m2mRouter.createCaller`) is defined in `console-trpc/server.tsx:121` — grep confirms zero imports of `createM2MCaller` outside that file.
- `createInngestCaller` (`console-trpc/server.tsx:131`) creates an **orgRouter** caller, not m2mRouter.
- The m2m sources router has live webhook callers, but those callers live in relay/backfill and will call platform/memory tRPC directly once platform exists. Until then, those callers already talk to console through HTTP (not through m2mRouter). The m2m sources procedures are only reachable via `createM2MCaller()` which has zero imports.

#### Step 2: Remove m2mRouter from root.ts

File: `api/console/src/root.ts`

```diff
- import { jobsM2MRouter } from "./router/m2m/jobs";
- import { sourcesM2MRouter } from "./router/m2m/sources";
- import { workspaceM2MRouter } from "./router/m2m/workspace";
  ...
- export const m2mRouter = createTRPCRouter({
-   jobs: jobsM2MRouter,
-   sources: sourcesM2MRouter,
-   workspace: workspaceM2MRouter,
- });
  ...
- export type M2MRouter = typeof m2mRouter;
```

Update file header comment to remove m2m references.

#### Step 3: Remove m2mRouter from index.ts

File: `api/console/src/index.ts`

```diff
- import type { M2MRouter, OrgRouter, UserRouter } from "./root";
+ import type { OrgRouter, UserRouter } from "./root";

- export type { M2MRouter, OrgRouter, UserRouter } from "./root";
+ export type { OrgRouter, UserRouter } from "./root";

- export { m2mRouter, orgRouter, userRouter } from "./root";
+ export { orgRouter, userRouter } from "./root";

- export type M2MRouterInputs = inferRouterInputs<M2MRouter>;
- export type M2MRouterOutputs = inferRouterOutputs<M2MRouter>;
```

#### Step 4: Drop M2M procedure types from trpc.ts

File: `api/console/src/trpc.ts`

```diff
- import { verifyM2MToken } from "@repo/app-clerk-m2m";
  ...
```

Remove these from the `AuthContext` union:
```diff
  type AuthContext =
    | { type: "clerk-pending"; userId: string }
    | { type: "clerk-active"; userId: string; orgId: string }
-   | { type: "m2m"; machineId: string }
    | { type: "apiKey"; orgId: string; userId: string; apiKeyId: string }
    | { type: "unauthenticated" };
```

Remove M2M Bearer token branches from `createUserTRPCContext` (lines 82-105) and `createOrgTRPCContext` (lines 172-195).

Delete the two procedure exports:
```diff
- export const webhookM2MProcedure = sentrifiedProcedure...
- export const inngestM2MProcedure = sentrifiedProcedure...
```

Remove `@repo/app-clerk-m2m` from `api/console/package.json` dependencies.

#### Step 5: Drop M2M callers from console-trpc/server.tsx

File: `packages/console-trpc/src/server.tsx`

```diff
- import { createM2MToken } from "@repo/app-clerk-m2m";
  ...
- import {
-   ...
-   m2mRouter,
-   ...
- } from "@api/app";
  ...
- const createWebhookContext = cache(async () => { ... });
- const createInngestContext = cache(async () => { ... });
  ...
- export const createCaller = cache(async () => { ... });
- export const createM2MCaller = cache(async () => { ... });
- export const createInngestCaller = cache(async () => { ... });
```

Remove `@repo/app-clerk-m2m` from `packages/console-trpc/package.json` dependencies.

**Verification**: `pnpm typecheck` should pass. Grep for `createM2MCaller`, `createInngestCaller`, `createCaller` (from console-trpc) to confirm zero remaining imports.

---

### Phase A2: Remove Console Neural Pipeline + Notifications

**Why**: The neural pipeline (event-store, entity-graph, entity-embed) and notification dispatch will be owned by platform. Console only keeps `recordActivity`.

#### Step 6: Delete neural pipeline files

```
DELETE api/console/src/inngest/workflow/neural/edge-resolver.ts
DELETE api/console/src/inngest/workflow/neural/entity-embed.ts
DELETE api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts
DELETE api/console/src/inngest/workflow/neural/entity-graph.ts
DELETE api/console/src/inngest/workflow/neural/event-store.ts
DELETE api/console/src/inngest/workflow/neural/index.ts
DELETE api/console/src/inngest/workflow/neural/narrative-builder.ts
DELETE api/console/src/inngest/workflow/neural/on-failure-handler.ts
DELETE api/console/src/inngest/workflow/neural/scoring.ts
```

Delete the entire directory: `api/console/src/inngest/workflow/neural/`

#### Step 7: Delete notification dispatch

```
DELETE api/console/src/inngest/workflow/notifications/dispatch.ts
DELETE api/console/src/inngest/workflow/notifications/index.ts
```

Delete the entire directory: `api/console/src/inngest/workflow/notifications/`

#### Step 8: Update Inngest index to only register recordActivity

File: `api/console/src/inngest/index.ts`

```diff
  import { serve } from "inngest/next";
  import { inngest } from "./client/client";
  import { recordActivity } from "./workflow/infrastructure/record-activity";
- import { entityEmbed, entityGraph, eventStore } from "./workflow/neural";
- import { notificationDispatch } from "./workflow/notifications";

  export { inngest };
  export { recordActivity };
- export { entityEmbed, entityGraph, eventStore };
- export { notificationDispatch };

  export function createInngestRouteContext() {
    return serve({
      client: inngest,
-     functions: [
-       recordActivity,
-       eventStore,
-       entityGraph,
-       entityEmbed,
-       notificationDispatch,
-     ],
+     functions: [recordActivity],
      servePath: "/api/inngest",
    });
  }
```

Remove unused dependencies from `api/console/package.json`:
- `@vendor/knock` (only used by notification dispatch)
- `@repo/app-embed` (only used by entity-embed)
- `@repo/app-pinecone` (only used by entity-embed)
- `@repo/app-octokit-github` (verify — may still be used by connections)
- `ai` (only used by neural pipeline)
- `@ai-sdk/gateway` (only used by neural pipeline)
- `braintrust` (only used by neural pipeline)

**Caveat**: Verify each dependency isn't imported elsewhere in `api/console/src/` before removing. Use grep.

#### Step 9: Remove `@api/app/inngest` export path (if neural pipeline was the primary consumer)

Actually, `createInngestRouteContext` is still needed by `apps/console/src/app/api/inngest/route.ts`. The `inngest/client` export is still needed for sending `console/activity.record` events. Keep both — just reduce registered functions.

Update `api/console/package.json` exports — keep `./inngest` and `./inngest/client`, remove `./lib/token-vault` if it was only used by neural pipeline:

```diff
  "exports": {
    ".": { ... },
    "./env": { ... },
    "./inngest": { ... },
    "./inngest/client": { ... },
    "./lib/activity": { ... },
-   "./lib/token-vault": { ... }
  }
```

Verify `./lib/token-vault` callers. If only neural pipeline used it, delete `api/console/src/lib/token-vault.ts` too.

---

### Phase A3: Remove Console Webhook Ingress

**Why**: The `POST /api/gateway/ingress` route receives QStash payloads from relay and runs an Upstash Workflow. This belongs to platform.

#### Step 10: Delete the ingress directory

```
DELETE apps/console/src/app/api/gateway/ingress/route.ts
DELETE apps/console/src/app/api/gateway/ingress/_lib/notify.ts
DELETE apps/console/src/app/api/gateway/ingress/_lib/transform.ts
```

Delete the entire directory: `apps/console/src/app/api/gateway/ingress/`

Check if `apps/console/src/app/api/gateway/` has other contents (like `realtime/` and `stream/`). If so, only delete the `ingress/` subdirectory, keeping the parent.

Evidence from grep: `realtime/route.ts` and `stream/route.ts` exist — keep those.

#### Step 11: Remove `@vendor/upstash-workflow` dependency from console

File: `apps/console/package.json`

```diff
-   "@vendor/upstash-workflow": "workspace:*",
```

Verify no other file in `apps/console/src/` imports `@vendor/upstash-workflow`. Grep confirms only `apps/console/src/app/api/gateway/ingress/route.ts` uses it.

---

### Phase A4: Remove `/services/*` Rewrite Rules

**Why**: Once platform owns gateway/relay/backfill, console doesn't need to proxy requests to them.

#### Step 12: Remove service rewrite rules from next.config.ts

File: `apps/console/next.config.ts`

Remove the gateway/relay/backfill URL variables and rewrite rules:

```diff
  async rewrites() {
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    const docsUrl = ...;

-   const isProd = ...;
-   const gatewayUrl = isProd ? "https://lightfast-gateway.vercel.app" : "http://localhost:4110";
-   const relayUrl = isProd ? "https://lightfast-relay.vercel.app" : "http://localhost:4108";
-   const backfillUrl = isProd ? "https://lightfast-backfill.vercel.app" : "http://localhost:4109";

    return [
      { source: "/docs", destination: `${docsUrl}/docs` },
      { source: "/docs/:path*", destination: `${docsUrl}/docs/:path*` },
-     { source: "/services/gateway/:path*", destination: `${gatewayUrl}/services/gateway/:path*` },
-     { source: "/services/relay/:path*", destination: `${relayUrl}/api/:path*` },
-     { source: "/services/backfill/:path*", destination: `${backfillUrl}/api/:path*` },
    ];
  },
```

**Timing**: This step can only land when no consumers still route through these rewrites. If `@repo/gateway-service-clients` still uses these URLs (steps 13-14 not yet done), defer this step.

---

### Phase A5: Repoint Gateway-Proxy and Backfill Triggers (DEPENDS on @api/platform)

**Why**: Console's `org/connections.ts` calls `createGatewayClient()` for OAuth URLs, disconnect, config detection, etc. Console's `org/workspace.ts` calls `createBackfillClient()` for backfill triggers. These move to memory tRPC calls.

#### Step 13: Repoint gateway-proxy procedures in org/connections.ts

File: `api/console/src/router/org/connections.ts`

Replace:
```ts
import { createGatewayClient } from "@repo/gateway-service-clients";
```
With:
```ts
import { memoryTrpc } from "@repo/platform-trpc/server";
```

Procedure-by-procedure migration:

| Procedure | Current call | New call |
|-----------|-------------|----------|
| `getAuthorizeUrl` | `gw.getAuthorizeUrl(provider, { orgId, userId })` | `memoryTrpc.connections.getAuthorizeUrl({ provider, orgId, userId })` |
| `cliAuthorize` | `gw.getAuthorizeUrl(provider, { orgId, userId, redirectTo })` | `memoryTrpc.connections.getAuthorizeUrl({ provider, orgId, userId, redirectTo })` |
| `disconnect` | `gw.deleteConnection(provider, id)` | `memoryTrpc.connections.disconnect({ provider, installationId: id })` |
| `github.validate` | `gwValidate.executeApi(id, { endpointId, pathParams })` | `memoryTrpc.proxy.execute({ installationId: id, endpointId, pathParams })` |
| `github.detectConfig` | `gw.executeApi(id, { endpointId, pathParams, queryParams })` | `memoryTrpc.proxy.execute({ installationId: id, endpointId, pathParams, queryParams })` |
| `vercel.disconnect` | `gw.deleteConnection("vercel", id)` | `memoryTrpc.connections.disconnect({ provider: "vercel", installationId: id })` |
| `generic.listInstallations` | `gw.executeApi(id, request)` | `memoryTrpc.proxy.execute({ installationId: id, ...request })` |
| `generic.listResources` | `gw.executeApi(id, request)` | `memoryTrpc.proxy.execute({ installationId: id, ...request })` |

Also in `workspace.ts`:
| Procedure | Current call | New call |
|-----------|-------------|----------|
| `integrations.linkVercelProject` | `createGatewayClient().registerResource(...)` | `memoryTrpc.connections.registerResource(...)` |
| `integrations.bulkLinkResources` | `createGatewayClient().registerResource(...)` | `memoryTrpc.connections.registerResource(...)` |

Add `@repo/platform-trpc: workspace:*` to `api/console/package.json`.

#### Step 14: Repoint backfill triggers in org/workspace.ts

File: `api/console/src/router/org/workspace.ts`

Replace:
```ts
import { createBackfillClient } from "@repo/gateway-service-clients";
```
With:
```ts
import { memoryTrpc } from "@repo/platform-trpc/server";
```

Replace the `notifyBackfill` helper function (lines 1025-1111) with a thin wrapper around memory tRPC:

```ts
async function notifyBackfill(params: {
  installationId: string;
  provider: SourceType;
  orgId: string;
  depth?: 1 | 7 | 30 | 90;
  entityTypes?: string[];
  holdForReplay?: boolean;
  correlationId?: string;
}): Promise<void> {
  try {
    await memoryTrpc.backfill.trigger(params);
  } catch (err) {
    log.error("[console] Failed to trigger backfill via memory-trpc", {
      installationId: params.installationId,
      provider: params.provider,
      err,
    });
  }
}
```

Or inline the calls and delete `notifyBackfill` entirely.

Also delete: `api/console/src/router/org/__tests__/notify-backfill.test.ts`

#### Step 15: Remove unused gateway-service-clients dependency

After steps 13-14, remove from both:
- `api/console/package.json`: `"@repo/gateway-service-clients": "workspace:*"`
- `apps/console/package.json`: `"@repo/gateway-service-clients": "workspace:*"`

Grep to verify no remaining imports in either package.

Also remove from `api/console/package.json`:
- `@vendor/upstash-workflow` (if present — check)
- `@vendor/qstash` (if present — check)

---

## Part B: Auth Collapse (apps/auth → apps/console)

### Phase B1: Research & Inventory

#### Auth app contents (from codebase analysis)

Three route groups served via microfrontends:

| Route | Group | Content |
|-------|-------|---------|
| `/sign-in` | `(auth)` | Custom Clerk sign-in flow (email + OTP + OAuth) |
| `/sign-in/sso-callback` | `(auth)` | Clerk OAuth callback handler |
| `/sign-up` | `(auth)` | Custom Clerk sign-up flow (standard + invitation) |
| `/sign-up/sso-callback` | `(auth)` | Clerk OAuth callback handler |
| `/early-access` | `(early-access)` | Waitlist form (email + company size + sources) |
| `/test-page` | `(user)` | Placeholder test page (can delete) |

Supporting files:
- `_actions/sign-in.ts`, `_actions/sign-up.ts` — Server actions for Clerk auth
- `_actions/early-access.ts` — Server action for waitlist
- `_lib/search-params.ts` (auth), `_lib/search-params.ts` (early-access) — nuqs param parsing
- `_components/` — 12 shared components (email-form, otp-island, oauth-button, etc.)
- `src/lib/fonts.ts` — PP Neue Montreal custom font
- `src/lib/related-projects.ts` — `consoleUrl` resolver
- `src/lib/observability.ts` — BetterStack init
- `src/env.ts` — Minimal env (Clerk, Sentry, BetterStack, Upstash, security)
- `src/proxy.ts` — Unknown purpose (read to verify)

Auth app dependencies NOT in console:
- `react-confetti` — Used by early-access success animation
- `nuqs` — Already in console
- `@vercel/related-projects` — Already in console

---

### Phase B2: Port Auth Pages Into Console

#### Step 16: Create auth route group in console

```
apps/console/src/app/(auth)/
├── layout.tsx              ← Port from auth (auth)/layout.tsx
├── sign-in/
│   ├── page.tsx            ← Port from auth (auth)/sign-in/page.tsx
│   └── sso-callback/
│       └── page.tsx        ← Port from auth (auth)/sign-in/sso-callback/page.tsx
├── sign-up/
│   ├── page.tsx            ← Port from auth (auth)/sign-up/page.tsx
│   └── sso-callback/
│       └── page.tsx        ← Port from auth (auth)/sign-up/sso-callback/page.tsx
└── early-access/
    ├── layout.tsx          ← Port from auth (early-access)/layout.tsx
    └── page.tsx            ← Port from auth (early-access)/early-access/page.tsx
```

Note: The auth app nests pages inside `(app)` route group which is just an organizational wrapper. Flatten when porting to console.

#### Step 17: Port shared components and actions

```
apps/console/src/app/(auth)/_components/
├── email-form.tsx
├── error-banner.tsx        ← Both auth and early-access have error-banner; reconcile
├── oauth-button.tsx
├── otp-island.tsx
├── separator-with-text.tsx
├── session-activator.tsx
└── shared/
    └── code-verification-ui.tsx

apps/console/src/app/(auth)/_actions/
├── sign-in.ts
├── sign-in.test.ts
├── sign-up.ts
├── sign-up.test.ts
├── early-access.ts
└── early-access.test.ts

apps/console/src/app/(auth)/_lib/
├── search-params.ts        ← Merge auth + early-access search params
└── search-params.test.ts
```

Early-access specific components:
```
apps/console/src/app/(auth)/early-access/_components/
├── company-size-island.tsx
├── confetti-wrapper.tsx
├── early-access-form-server.tsx
├── error-banner.tsx        ← early-access variant (rename to avoid conflict)
├── sources-island.tsx
└── submit-button.tsx
```

#### Step 18: Update imports in ported files

Key changes:
- `~/env` → Console's env (already has Clerk, Sentry, etc.)
- `~/lib/fonts` → Check if console already has PP Neue Montreal; if not, port the font import
- `~/lib/related-projects` → Remove entirely (pages are now in the same app)
- `@vercel/microfrontends/next/client` `Link` → Standard `next/link` `Link` (no cross-app linking needed)
- `consoleUrl` references in Clerk config → Use relative paths (e.g., `/account/teams/new`)

#### Step 19: Update console root layout Clerk config

File: `apps/console/src/app/layout.tsx`

Ensure ClerkProvider has the correct auth URLs:
```tsx
<ClerkProvider
  signInUrl="/sign-in"
  signUpUrl="/sign-up"
  signInFallbackRedirectUrl="/account/teams/new"
  signUpFallbackRedirectUrl="/account/teams/new"
  waitlistUrl="/early-access"
  taskUrls={{
    "choose-organization": "/account/teams/new",
  }}
>
```

#### Step 20: Add missing dependencies to console

File: `apps/console/package.json`

```diff
+ "react-confetti": "^6.4.0",
```

Verify `nuqs` already present (it is).

#### Step 21: Update Clerk env vars

Ensure these are set in console's env:
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

These may already be set. Check `apps/console/src/env.ts` and Vercel dashboard.

#### Step 22: Port auth-specific env vars

Auth's env.ts adds:
- `HEALTH_CHECK_AUTH_TOKEN` — optional, only used by health check route. If console already has health checks, skip.

Auth's `@vendor/upstash` and `@vendor/security` env extensions — verify console already extends these (it likely does via existing env setup).

---

### Phase B3: Remove Auth From Microfrontends

#### Step 23: Update microfrontends.json

File: `apps/console/microfrontends.json`

```diff
  {
    "$schema": "https://openapi.vercel.sh/microfrontends.json",
    "applications": {
      "lightfast-console": { ... },
-     "lightfast-www": { ... },
-     "lightfast-auth": {
-       "packageName": "@lightfast/auth",
-       "development": {
-         "local": 4104
-       },
-       "routing": [
-         {
-           "group": "auth",
-           "paths": [
-             "/early-access",
-             "/sign-in",
-             "/sign-in/:path*",
-             "/sign-up",
-             "/sign-up/opengraph-image-:hash",
-             "/test-page"
-           ]
-         }
-       ]
-     }
+     "lightfast-www": { ... }
    }
  }
```

Auth routes are now handled natively by console — no microfrontend routing needed.

#### Step 24: Delete apps/auth directory

```
DELETE apps/auth/  (entire directory)
```

#### Step 25: Update pnpm-workspace.yaml (if needed)

Check if `apps/auth` is explicitly listed. Since the workspace file uses globs (`apps/*`), no change should be needed. Verify:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - ...
```

#### Step 26: Update root scripts

Check `package.json` root for auth-related scripts:
- `dev:auth` — Remove or note as deprecated
- `build:auth` — Remove

#### Step 27: Update Vercel project configuration

- Delete the `lightfast-auth` Vercel project (or disconnect it)
- The auth routes are now served by `lightfast-console` Vercel project natively

---

## Execution Order

```
Phase A1: Drop M2M Router (Steps 1-5)           — INDEPENDENT, do first
    ↓
Phase A2: Remove Neural Pipeline (Steps 6-9)     — INDEPENDENT of A1
    ↓
Phase A3: Remove Webhook Ingress (Steps 10-11)   — INDEPENDENT of A1/A2
    ↓
Phase A4: Remove Service Rewrites (Step 12)      — AFTER A5 (or defer)
    ↓
Phase A5: Repoint to memory-trpc (Steps 13-15)   — BLOCKED on @api/platform existing
    ↓
Phase B1: Research (already done above)
    ↓
Phase B2: Port Auth Pages (Steps 16-22)          — INDEPENDENT of Part A
    ↓
Phase B3: Remove Auth App (Steps 23-27)          — AFTER B2 verified working
```

Phases A1, A2, A3 can be done in parallel as separate PRs.
Phase B can be done independently of Part A.
Phase A5 (+ A4) is the only gated work.

---

## Verification Checklist

### After Part A (each phase)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm check` (lint) passes
- [ ] `pnpm dev:console` starts without errors
- [ ] Console UI loads — workspace pages, connections pages
- [ ] Inngest dev server shows only `recordActivity` registered
- [ ] No remaining imports of deleted modules (grep verification)

### After Part B
- [ ] `pnpm typecheck` passes
- [ ] `/sign-in` renders correctly in console
- [ ] `/sign-up` renders correctly in console
- [ ] `/early-access` renders correctly in console
- [ ] OAuth SSO callback flow works (sign-in + sign-up)
- [ ] OTP code verification flow works
- [ ] Invitation ticket sign-up flow works
- [ ] Clerk redirect after sign-in lands on `/account/teams/new`
- [ ] `pnpm dev:app` works without auth port (4104)
- [ ] Microfrontend proxy routes auth paths to console

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| M2M router deletion breaks webhook handlers | Low — grep confirms no external callers | Grep all imports before deleting |
| Neural pipeline removal breaks Inngest event chain | Low — pipeline stays in platform | Verify `console/event.capture` sender is also being moved |
| Auth port pages have console-specific middleware | Medium — console middleware may reject unauthenticated users on auth pages | Ensure `(auth)` route group bypasses org middleware |
| Clerk env var conflicts between auth and console | Low — both already use `@vendor/clerk` | Verify env schemas are compatible |
| Missing PP Neue Montreal font in console | Medium — auth app loads a custom font | Port `src/lib/fonts.ts` and the font files |
| `@vercel/microfrontends` Link usage in ported components | Medium — auth uses MicrofrontendLink for cross-app navigation | Replace all with standard `next/link` |

---

## Files Touched (Summary)

### Part A Deletions
- `api/console/src/router/m2m/` (3 files)
- `api/console/src/inngest/workflow/neural/` (9 files)
- `api/console/src/inngest/workflow/notifications/` (2 files)
- `apps/console/src/app/api/gateway/ingress/` (3 files)
- `api/console/src/router/org/__tests__/notify-backfill.test.ts`

### Part A Modifications
- `api/console/src/root.ts` — Remove m2mRouter
- `api/console/src/index.ts` — Remove M2M exports
- `api/console/src/trpc.ts` — Remove M2M auth context + procedures
- `api/console/src/inngest/index.ts` — Reduce to recordActivity only
- `api/console/src/router/org/connections.ts` — Repoint to memory-trpc
- `api/console/src/router/org/workspace.ts` — Repoint backfill to memory-trpc
- `api/console/package.json` — Remove unused dependencies
- `apps/console/package.json` — Remove unused dependencies
- `apps/console/next.config.ts` — Remove service rewrite rules
- `packages/console-trpc/src/server.tsx` — Remove M2M callers

### Part B Additions
- `apps/console/src/app/(auth)/` — All auth pages + components + actions

### Part B Deletions
- `apps/auth/` (entire directory)

### Part B Modifications
- `apps/console/microfrontends.json` — Remove auth entry
- `apps/console/package.json` — Add `react-confetti`
- `apps/console/src/app/layout.tsx` — Update Clerk config
- Root `package.json` — Remove `dev:auth`, `build:auth` scripts
