# Rename "console" → "app" and "memory" → "platform" Implementation Plan

## Overview

Standardize service naming across the monorepo. The app service was historically called "console" and the platform service was called "memory". This plan renames all identifiers, Inngest events/function IDs, JWT claims, tRPC routes, file/directory names, comments, and package descriptions to match the current service names.

## Current State Analysis

### "console" in @api/app — Small Footprint
- 1 schema file (`console.ts`), 1 exported const (`consoleEvents`), 1 Inngest function ID, 1 event name
- Cross-package: `ConsolePineconeClient`, `consoleM2MEnv`, `consoleUrl`, `service: "console"`, `caller = "console"`
- ~34 occurrences across ~23 files

### "memory" in @api/platform — Pervasive Footprint
- 1 directory, 10 files, 5 exported types, 8+ exported consts, 11 Inngest function IDs, 10 event names (~30 ref sites)
- JWT audience `"lightfast-memory"`, tRPC route `/api/trpc/memory`
- Cross-package: `packages/platform-trpc` bridge, `apps/app` consumers, `apps/platform` route handler
- ~150+ occurrences across ~36 files

### Key Discoveries
- `apps/platform/src/app/api/trpc/[trpc]/route.ts` already uses `appUrl` from its own `related-projects.ts` — no "console" naming there
- `apps/platform` env already has `INNGEST_APP_NAME="lightfast-platform"` — already correct
- `API_KEY_PREFIX = "console_sk_"` at `packages/app-api-key/src/crypto.ts:33` is dead code (not imported anywhere), active prefix is `"sk-lf-"`
- The `[trpc]` dynamic segment in the platform route handler means the tRPC URL path segment is arbitrary — renaming `/api/trpc/memory` → `/api/trpc/platform` requires only a client-side URL change
- JWT audience change (`"lightfast-memory"` → `"lightfast-platform"`) is safe in monorepo atomic deploy since both signing and verification code deploy together

## Desired End State

All product/service naming in `@api/app` uses "app" (not "console"). All product/service naming in `@api/platform` uses "platform" (not "memory"). Cross-package references are consistent.

### Verification
- `pnpm check && pnpm typecheck` passes
- `pnpm build:app && pnpm build:platform` passes
- `grep -r "consoleEvents\|console/activity\|console/record" api/app/src/` returns no results
- `grep -r "memoryRouter\|memoryEvents\|MemoryRouter\|memory/" api/platform/src/` returns no results (excluding node_modules)
- Platform JWT tests pass: `cd api/platform && pnpm test`

## What We're NOT Doing

- **NOT renaming `core/ai-sdk` `Memory<T>` interface** — it's an AI concept (conversation memory), not platform naming
- **NOT renaming `AnswerRedisMemory`** in `apps/app/src/ai/runtime/memory.ts` — it implements the ai-sdk `Memory<T>` interface
- **NOT removing reserved name `"console"`** from workspace/org name lists — still a good slug to reserve
- **NOT renaming Sentry `captureConsoleIntegration`** — that's Sentry's API
- **NOT doing Inngest dual-registration** — hard cut, accepting dashboard history reset
- **NOT renaming `NEXT_PUBLIC_CONSOLE_PORT`** env var — this is a Vercel env var that may be set in production Vercel dashboard; renaming requires Vercel env update (separate task)
- **NOT changing URL redirects** in `apps/app/next.config.ts` for `/features/memory` and changelog slugs — these are SEO redirects for published URLs

## Implementation Approach

Two PRs, each an atomic commit that keeps the build passing:
1. **PR1**: "console" → "app" (small, ~34 changes)
2. **PR2**: "memory" → "platform" (large, ~150+ changes)

File renames are done via `git mv` to preserve history. Identifier renames cascade from source definitions to all import sites.

---

## Phase 1: "console" → "app"

### Overview

Rename all "console" product naming in `@api/app/` and cross-package consumers to "app".

### Changes Required:

#### 1. Rename schema file and identifiers in `@api/app/`

**File**: `api/app/src/inngest/schemas/console.ts` → rename to `app.ts`

```bash
git mv api/app/src/inngest/schemas/console.ts api/app/src/inngest/schemas/app.ts
```

In the renamed `api/app/src/inngest/schemas/app.ts`:
```ts
// Line 3: consoleEvents → appEvents
export const appEvents = {
  // Line 4: "console/activity.record" → "app/activity.record"
  "app/activity.record": z.object({
```

#### 2. Update Inngest client import

**File**: `api/app/src/inngest/client/client.ts`
```ts
// Line 6: update import path and identifier
import { appEvents } from "../schemas/app";
// Line 11: update reference
schemas: new EventSchemas().fromSchema(appEvents),
```

#### 3. Update Inngest index comment

**File**: `api/app/src/inngest/index.ts`
```ts
// Line 2: "console application" → "app"
/**
 * Inngest exports for app
 */
```

#### 4. Update record-activity workflow

**File**: `api/app/src/inngest/workflow/infrastructure/record-activity.ts`
```ts
// Line 8: update comment
// Triggered by: app/activity.record events (Tier 2 user actions)

// Line 29: update function ID
id: "app/record-activity",

// Line 46: update event trigger
{ event: "app/activity.record" },
```

#### 5. Update activity helper event sends

**File**: `api/app/src/lib/activity.ts`
```ts
// Line 233: update event name
name: "app/activity.record",

// Line 323: update event name
name: "app/activity.record",
```

#### 6. Update health check service identifier

**File**: `apps/app/src/app/(health)/api/health/route.ts`
```ts
// Line 35: "console" → "app"
service: "app",
```

#### 7. Update Pinecone client naming

**File**: `packages/app-pinecone/src/client.ts`
```ts
// Line 2-5: Update JSDoc: "Console-specific" → "App-specific"
// Line 21-24: Update class JSDoc
// Line 26: ConsolePineconeClient → AppPineconeClient
export class AppPineconeClient {

// Line 67: Update comment "console config" → "app config"

// Line 190-191: Update function name and JSDoc
export function createAppPineconeClient(): AppPineconeClient {
  return new AppPineconeClient();
}

// Line 197-201: Update singleton
export const appPineconeClient = new AppPineconeClient();
```

**File**: `packages/app-pinecone/src/index.ts`
```ts
// Line 4: Update JSDoc: "Console-specific" → "App-specific"
// Line 21: Update comment
// Lines 23-28: Update exports
export {
  AppPineconeClient,
  appPineconeClient,
  appPineconeClient as pineconeClient,
  createAppPineconeClient,
} from "./client";
```

#### 8. Update Clerk M2M naming

**File**: `packages/app-clerk-m2m/src/env.ts`
```ts
// Line 5: Update JSDoc: "Console-specific" → "App-specific"
// Line 23: consoleM2MEnv → appM2MEnv
export const appM2MEnv = createEnv({
```

**File**: `packages/app-clerk-m2m/src/index.ts`
```ts
// Line 2-4: Update JSDoc: "Console Clerk M2M" → "App Clerk M2M"
// Line 24: Update export
export { appM2MEnv } from "./env";
```

**Then update all consumers of `consoleM2MEnv`** — search for imports:
```bash
grep -rn "consoleM2MEnv" --include="*.ts" --include="*.tsx"
```

#### 9. Delete dead `console_sk_` export

**File**: `packages/app-api-key/src/crypto.ts`
```ts
// Delete lines 30-33 (the @deprecated API_KEY_PREFIX)
```

**File**: `packages/app-api-key/src/index.ts`
```ts
// Line 4: Update JSDoc "Console CLI" → "CLI"
```

Note: `API_KEY_PREFIX` is NOT in the index.ts exports (only `LIGHTFAST_API_KEY_PREFIX` is), so no consumer updates needed.

#### 10. Update `consoleUrl` → `appUrl` in `apps/www`

**File**: `apps/www/src/lib/related-projects.ts`
```ts
// Line 8: Update comment
// Get the app URL dynamically based on environment
// Line 9: consoleUrl �� appUrl
export const appUrl = withRelatedProject({
```

**File**: `apps/www/src/app/(app)/(content)/docs/(general)/layout.tsx`
```ts
// Line 12: update import
import { appUrl } from "~/lib/related-projects";
// Line 19: update usage
const signInUrl = `${appUrl}/sign-in`;
```

**File**: `apps/www/src/app/(app)/(content)/docs/(api)/layout.tsx`
```ts
// Line 12: update import
import { appUrl } from "~/lib/related-projects";
// Line 15: update usage
const signInUrl = `${appUrl}/sign-in`;
```

#### 11. Update platform-trpc caller defaults

**File**: `packages/platform-trpc/src/server.tsx`
```ts
// Line 21: Update comment "caller="console"" → "caller="app""
// Line 27: "console" → "app"
const token = await signServiceJWT("app");
// Line 39: Update comment "console" → "app"
// Line 52: Update comment
// Line 54: default "console" → "app"
export const createMemoryCaller = cache(async (caller = "app") => {
```

Note: `createMemoryCaller` name itself stays for now — it gets renamed in Phase 2.

**File**: `packages/platform-trpc/src/caller.ts`
```ts
// Line 18: Update @param JSDoc example "console" → "app"
// Line 20: default "console" → "app"
export const createMemoryCaller = cache(async (caller = "app") => {
```

#### 12. Update JWT test caller strings

**File**: `api/platform/src/lib/jwt.test.ts`
```ts
// Line 7: "console" → "app"
const token = await signServiceJWT("app");
// Line 9: "console" → "app"
expect(caller).toBe("app");
// Line 17: "console" → "app"
.setIssuer("app")
// Line 30: "console" → "app"
.setIssuer("app")
```

#### 13. Update JWT JSDoc

**File**: `api/platform/src/lib/jwt.ts`
```ts
// Line 3: "console/platform" → "app/platform"
// Used by app/platform to authenticate calls to platform service.
// Line 28: @param example "console" → "app"
```

#### 14. Update package descriptions

**File**: `packages/app-reserved-names/package.json`
```json
"description": "Reserved workspace names for Lightfast App to prevent URL routing conflicts"
```

#### 15. Update JSDoc examples in validation

**File**: `packages/app-validation/src/primitives/ids.ts`
```ts
// Line 124: "console/docs.push" → "app/docs.push"
```

**File**: `packages/app-validation/src/schemas/job.ts`
```ts
// Line 137: "console/docs.push" → "app/docs.push"
```

#### 16. Update Inngest app name env var

**File**: `apps/app/.vercel/.env.development.local`
```
# Line 26: "lightfast-console" → "lightfast-app"
INNGEST_APP_NAME="lightfast-app"
```

**Vercel Dashboard**: Also update the `INNGEST_APP_NAME` env var in the Vercel project settings for the `lightfast-app` project (manual step).

#### 17. Update @api/platform tRPC comments referencing "console"

**File**: `api/platform/src/trpc.ts`
```ts
// Line 5: "console, platform, inngest, cron" → "app, platform, inngest, cron"
// Line 162: "Used by console, platform" → "Used by app, platform"
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds
- [x] `cd api/platform && pnpm test` passes (JWT tests)
- [x] `grep -rn "consoleEvents\|consoleM2MEnv\|ConsolePinecone\|consoleUrl\|consolePinecone" --include="*.ts" --include="*.tsx" api/ apps/ packages/ core/` returns no results
- [x] `grep -rn '"console/' --include="*.ts" api/app/src/` returns no results (Inngest event/function names)

#### Manual Verification:
- [ ] Inngest dev dashboard shows function registered as `app/record-activity` (not `console/record-activity`)
- [ ] Health endpoint at `/api/health` returns `service: "app"`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 2.

---

## Phase 2: "memory" → "platform"

### Overview

Rename all "memory" product naming in `@api/platform/` and cross-package consumers to "platform". This is the larger rename touching ~150+ occurrences.

### Changes Required:

#### 1. Rename Inngest schema file and identifiers

**File**: `api/platform/src/inngest/schemas/memory.ts` → rename to `platform.ts`

```bash
git mv api/platform/src/inngest/schemas/memory.ts api/platform/src/inngest/schemas/platform.ts
```

In the renamed `api/platform/src/inngest/schemas/platform.ts`:
```ts
// Line 9: memoryEvents → platformEvents
export const platformEvents = {
  // All 10 event name keys: "memory/" → "platform/"
  "platform/backfill.run.requested": backfillTriggerPayload,
  "platform/backfill.run.cancelled": z.object({...}),
  "platform/backfill.entity.requested": z.object({...}),
  "platform/health.check.requested": z.object({...}),
  "platform/connection.lifecycle": z.object({...}),
  "platform/webhook.received": z.object({...}),
  "platform/event.capture": z.object({...}),
  "platform/event.stored": z.object({...}),
  "platform/entity.upserted": z.object({...}),
  "platform/entity.graphed": z.object({...}),
};
```

#### 2. Update Inngest client

**File**: `api/platform/src/inngest/client.ts`
```ts
// Line 6: update import path and identifier
import { platformEvents } from "./schemas/platform";
// Line 11: update reference
schemas: new EventSchemas().fromSchema(platformEvents),
```

#### 3. Rename Inngest function files (6 files)

```bash
git mv api/platform/src/inngest/functions/memory-backfill-orchestrator.ts api/platform/src/inngest/functions/platform-backfill-orchestrator.ts
git mv api/platform/src/inngest/functions/memory-entity-embed.ts api/platform/src/inngest/functions/platform-entity-embed.ts
git mv api/platform/src/inngest/functions/memory-entity-graph.ts api/platform/src/inngest/functions/platform-entity-graph.ts
git mv api/platform/src/inngest/functions/memory-entity-worker.ts api/platform/src/inngest/functions/platform-entity-worker.ts
git mv api/platform/src/inngest/functions/memory-event-store.ts api/platform/src/inngest/functions/platform-event-store.ts
git mv api/platform/src/inngest/functions/memory-notification-dispatch.ts api/platform/src/inngest/functions/platform-notification-dispatch.ts
```

#### 4. Update all Inngest function internals

For each of the 6 renamed files, plus `health-check.ts`, `token-refresh.ts`, `delivery-recovery.ts`, `connection-lifecycle.ts`, `ingest-delivery.ts`:

**Rename pattern for exported consts** (in the 6 renamed files):
- `memoryBackfillOrchestrator` → `platformBackfillOrchestrator`
- `memoryEntityEmbed` → `platformEntityEmbed`
- `memoryEntityGraph` → `platformEntityGraph`
- `memoryEntityWorker` → `platformEntityWorker`
- `memoryEventStore` → `platformEventStore`
- `memoryNotificationDispatch` → `platformNotificationDispatch`

**Rename pattern for function IDs** (all 11 files):
- `"memory/backfill.orchestrator"` → `"platform/backfill.orchestrator"`
- `"memory/entity.embed"` → `"platform/entity.embed"`
- `"memory/entity.graph"` → `"platform/entity.graph"`
- `"memory/backfill.entity-worker"` → `"platform/backfill.entity-worker"`
- `"memory/event.store"` → `"platform/event.store"`
- `"memory/notification.dispatch"` → `"platform/notification.dispatch"`
- `"memory/health.check"` → `"platform/health.check"`
- `"memory/token.refresh"` → `"platform/token.refresh"`
- `"memory/delivery.recovery"` → `"platform/delivery.recovery"`
- `"memory/connection.lifecycle"` → `"platform/connection.lifecycle"`
- `"memory/ingest.delivery"` → `"platform/ingest.delivery"`

**Rename pattern for event name strings** (~30 reference sites):
All `"memory/..."` event strings → `"platform/..."` in:
- trigger declarations (`{ event: "memory/..." }`)
- cancelOn declarations
- `step.sendEvent({ name: "memory/..." })`
- `inngest.send({ name: "memory/..." })`
- onFailure references

**Rename display names**:
- `"Memory Backfill Orchestrator"` → `"Platform Backfill Orchestrator"` (platform-backfill-orchestrator.ts:34)
- `"Memory Backfill Entity Worker"` → `"Platform Backfill Entity Worker"` (platform-entity-worker.ts:34)

**Update all JSDoc/comments** referencing "memory/" in these files.

#### 5. Update Inngest index

**File**: `api/platform/src/inngest/index.ts`
```ts
// Line 2: "memory application" → "platform application"
/**
 * Inngest exports for platform application
 */

// Update all import paths and identifiers:
import { platformBackfillOrchestrator } from "./functions/platform-backfill-orchestrator";
import { platformEntityEmbed } from "./functions/platform-entity-embed";
import { platformEntityGraph } from "./functions/platform-entity-graph";
import { platformEntityWorker } from "./functions/platform-entity-worker";
import { platformEventStore } from "./functions/platform-event-store";
import { platformNotificationDispatch } from "./functions/platform-notification-dispatch";

// Update exports and function array references similarly
// Update JSDoc listing function names
```

#### 6. Rename router directory and files

```bash
git mv api/platform/src/router/memory api/platform/src/router/platform
```

This moves all 3 router files (`backfill.ts`, `connections.ts`, `proxy.ts`) into `router/platform/`.

#### 7. Update router file internals

**File**: `api/platform/src/router/platform/connections.ts`
```ts
// Line 7: Update JSDoc "memory/connection.lifecycle" → "platform/connection.lifecycle"
// Line 155: Update JSDoc
// Line 191: "via memory service" → "via platform service"
// Line 192: "memory_disconnect_handler" → "platform_disconnect_handler"
// Line 197: event name "memory/connection.lifecycle" → "platform/connection.lifecycle"
```

**File**: `api/platform/src/router/platform/backfill.ts`
```ts
// Line 9: "memory/*" → "platform/*"
// Line 47: "memory/backfill.run.requested" → "platform/backfill.run.requested"
// Line 85: event name
// Line 114: "memory/backfill.run.cancelled" → "platform/backfill.run.cancelled"
// Line 141: event name
```

#### 8. Update root router

**File**: `api/platform/src/root.ts`
```ts
// Line 2: "Memory service" → "Platform service"
// Line 5: "memoryRouter" → "platformRouter"
// Lines 8-10: Update import paths
import { backfillRouter } from "./router/platform/backfill";
import { connectionsRouter } from "./router/platform/connections";
import { proxyRouter } from "./router/platform/proxy";

// Line 14-15: Update JSDoc
/**
 * Platform router -- service-accessible procedures.
 * Accessible via /api/trpc/platform/*
 */
// Line 24: memoryRouter → platformRouter
export const platformRouter = createTRPCRouter({

// Line 43: MemoryRouter → PlatformRouter
export type PlatformRouter = typeof platformRouter;
```

#### 9. Update tRPC context

**File**: `api/platform/src/trpc.ts`
```ts
// Line 2: "Memory service" → "Platform service"
// Line 5: "console, platform" → "app, platform" (also done in Phase 1)
// Line 20: "memory service" → "platform service"
// Line 23: MemoryAuthContext → PlatformAuthContext
export type PlatformAuthContext =

// Line 33: "memory service" → "platform service"
// Line 37: "X-Memory-Source" → "X-Platform-Source" (or just remove mention since actual header is x-trpc-source)
// Line 40: createMemoryTRPCContext → createPlatformTRPCContext
export const createPlatformTRPCContext = async (opts: { headers: Headers }) => {

// Line 50, 71: "[trpc] memory service request" → "[trpc] platform service request"
// Line 162: "calling memory" → "calling platform"
// Line 180: MemoryAuthContext → PlatformAuthContext
```

#### 10. Update index.ts exports

**File**: `api/platform/src/index.ts`
```ts
import type { AdminRouter, PlatformRouter } from "./root";

/**
 * Platform API exports
 */

export type { AdminRouter, PlatformRouter } from "./root";
export { adminRouter, platformRouter } from "./root";
export type { PlatformAuthContext } from "./trpc";
export { createPlatformTRPCContext } from "./trpc";

export type PlatformRouterInputs = inferRouterInputs<PlatformRouter>;
export type PlatformRouterOutputs = inferRouterOutputs<PlatformRouter>;
```

#### 11. Update JWT audience

**File**: `api/platform/src/lib/jwt.ts`
```ts
// Line 3: Update JSDoc (already handled in Phase 1 for "console" part)
// Line 37: "lightfast-memory" → "lightfast-platform"
.setAudience("lightfast-platform")
// Line 54: "lightfast-memory" → "lightfast-platform"
audience: "lightfast-platform",
```

**File**: `api/platform/src/lib/jwt.test.ts`
```ts
// Line 32: "lightfast-memory" → "lightfast-platform"
.setAudience("lightfast-platform")
```

#### 12. Update `packages/platform-trpc` bridge layer

**File**: `packages/platform-trpc/src/server.tsx`
```ts
// Line 1: MemoryRouter → PlatformRouter
import type { PlatformRouter } from "@api/platform";
// Lines 3-5: update imports
import {
  createPlatformTRPCContext,
  platformRouter,
  signServiceJWT,
} from "@api/platform";

// Line 19: Update JSDoc "memory RSC" → "platform RSC"
// Line 22: createMemoryContext → createPlatformContext
const createPlatformContext = cache(async () => {
  // Line 30: update reference
  return createPlatformTRPCContext({

// Line 38: Update JSDoc "Memory tRPC" → "Platform tRPC"
// Line 41: memoryTrpc → platformTrpc, MemoryRouter → PlatformRouter
export const platformTrpc: TRPCOptionsProxy<PlatformRouter> =
  createTRPCOptionsProxy({
    router: platformRouter,
    ctx: createPlatformContext,

// Line 49: Update JSDoc "memory caller" → "platform caller"
// Line 54: createMemoryCaller → createPlatformCaller
export const createPlatformCaller = cache(async (caller = "app") => {
  // Line 61: update reference
  const ctx = await createPlatformTRPCContext({ headers: heads });
  return platformRouter.createCaller(ctx);
```

**File**: `packages/platform-trpc/src/caller.ts`
```ts
// Line 2: Update JSDoc "memory caller" → "platform caller"
// Lines 8-9: update imports
import {
  createPlatformTRPCContext,
  platformRouter,
  signServiceJWT,
} from "@api/platform";

// Line 15: Update JSDoc "memory caller" → "platform caller"
// Line 20: createMemoryCaller → createPlatformCaller
export const createPlatformCaller = cache(async (caller = "app") => {
  // Line 27: update reference
  const ctx = await createPlatformTRPCContext({ headers: heads });
  return platformRouter.createCaller(ctx);
```

**File**: `packages/platform-trpc/src/react.tsx`
```ts
// Line 3: MemoryRouter → PlatformRouter
import type { PlatformRouter } from "@api/platform";

// Line 17: CreateMemoryTRPCProviderOptions → CreatePlatformTRPCProviderOptions
export interface CreatePlatformTRPCProviderOptions {

// Line 22: MemoryRouter → PlatformRouter
const trpcContext = createTRPCContext<PlatformRouter>();

// Line 47: MemoryTRPCReactProvider → PlatformTRPCReactProvider
export function PlatformTRPCReactProvider({
  options,
}: {
  children: React.ReactNode;
  options?: CreatePlatformTRPCProviderOptions;
}) {
  // Line 59: MemoryRouter → PlatformRouter
  return createTRPCClient<PlatformRouter>({
    // Line 66: Update comment "memory has one router" → "platform has one router"
    // Line 69: /api/trpc/memory → /api/trpc/platform
    url: `${baseUrl}/api/trpc/platform`,
```

**File**: `packages/platform-trpc/src/types.ts`
```ts
// Line 2: Update JSDoc "memory tRPC" → "platform tRPC"
// Line 4: MemoryRouter → PlatformRouter
import type { PlatformRouter } from "@api/platform";

export type RouterOutputs = inferRouterOutputs<PlatformRouter>;
export type RouterInputs = inferRouterInputs<PlatformRouter>;
```

#### 13. Update `apps/app` consumers

**File**: `apps/app/src/lib/proxy.ts`
```ts
// Line 9: createMemoryCaller → createPlatformCaller
import { createPlatformCaller } from "@repo/platform-trpc/caller";

// Line 37: update usage
const platform = await createPlatformCaller();
// Line 66: update reference
platform.proxy.execute({ ... })

// Line 266: update usage
const platform = await createPlatformCaller();
// Line 267: update reference
await platform.proxy.execute({ ... })
```

Search for any other `createMemoryCaller` or `memoryTrpc` imports in `apps/app`:
```bash
grep -rn "createMemoryCaller\|memoryTrpc\|MemoryTRPCReactProvider" apps/app/src/ --include="*.ts" --include="*.tsx"
```

#### 14. Update `apps/platform` route handler

**File**: `apps/platform/src/app/api/trpc/[trpc]/route.ts`
```ts
// Line 1: update imports
import { createPlatformTRPCContext, platformRouter } from "@api/platform";

// Line 51: update router
router: platformRouter,
// Line 53-54: update context
createContext: () =>
  createPlatformTRPCContext({
```

**File**: `apps/platform/src/app/api/ingest/[provider]/route.ts`
```ts
// Line 182: "memory/webhook.received" → "platform/webhook.received"
name: "platform/webhook.received",
```

#### 15. Update test data package

**File**: `packages/app-test-data/src/trigger/trigger.ts`
```ts
// Line 67: "memory/event.capture" → "platform/event.capture"
name: "platform/event.capture",
```

#### 16. Update on-failure handler JSDoc

**File**: `api/platform/src/inngest/on-failure-handler.ts`
```ts
// Line 15: "memory/event.capture" → "platform/event.capture"
```

#### 17. Update cache lib JSDoc

**File**: `api/platform/src/lib/cache.ts`
```ts
// Line 2: "Memory service" → "Platform service"
```

#### 18. Update provider-configs JSDoc

**File**: `api/platform/src/lib/provider-configs.ts`
```ts
// Line 5: "memory app's" → "platform app's"
```

#### 19. Update package descriptions

**File**: `core/mcp/package.json`
```json
"description": "Lightfast Platform MCP Server - MCP for the Lightfast Platform API",
// keywords: "memory" → "platform"
```

**File**: `core/lightfast/package.json`
```json
"description": "Lightfast Platform SDK - TypeScript client for the Lightfast Platform API",
// keywords: "memory" → "platform"
```

**File**: `core/cli/package.json`
```json
// keywords: "memory" → "platform"
```

#### 20. Search for any remaining "memory" references

Run a final sweep to catch anything missed:
```bash
grep -rn '"memory/' --include="*.ts" --include="*.tsx" api/platform/ packages/platform-trpc/ apps/platform/ packages/app-test-data/
grep -rn "memoryRouter\|memoryEvents\|MemoryRouter\|MemoryAuthContext\|createMemoryTRPCContext\|memoryTrpc\|createMemoryCaller\|MemoryTRPCReactProvider\|memoryBackfill\|memoryEntity\|memoryEvent\|memoryNotification" --include="*.ts" --include="*.tsx"
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds
- [x] `cd api/platform && pnpm test` passes (JWT tests with updated audience)
- [x] `grep -rn "memoryRouter\|memoryEvents\|MemoryRouter\|MemoryAuthContext\|createMemoryTRPCContext" --include="*.ts" --include="*.tsx" api/ apps/ packages/` returns no results
- [x] `grep -rn '"memory/' --include="*.ts" --include="*.tsx" api/platform/ packages/platform-trpc/ apps/platform/ packages/app-test-data/` returns no results
- [x] `grep -rn "memoryTrpc\|createMemoryCaller\|MemoryTRPCReactProvider" --include="*.ts" --include="*.tsx"` returns no results

#### Manual Verification:
- [ ] Inngest dev dashboard shows all 11 functions with `platform/` prefix
- [ ] tRPC calls from app to platform succeed (e.g., proxy search works)
- [ ] JWT auth between services works (sign as "app", verify with "lightfast-platform" audience)
- [ ] Webhook ingest at `/api/ingest/:provider` triggers `platform/webhook.received` event

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before merging.

---

## Testing Strategy

### Unit Tests:
- JWT sign/verify tests in `api/platform/src/lib/jwt.test.ts` — updated audience and caller values
- Any existing tests referencing event names or function IDs

### Integration Tests:
- Inngest function registration (dev server should show all functions)
- tRPC client → server communication (proxy search)
- Webhook ingestion pipeline (delivery → event capture → entity store)

### Manual Testing Steps:
1. Start full dev stack: `pnpm dev:full`
2. Verify Inngest dev dashboard at `http://localhost:8288` shows functions with `app/` and `platform/` prefixes
3. Verify proxy search works in the app UI (triggers `createPlatformCaller`)
4. Send a test webhook to `/api/ingest/github` and verify pipeline processes
5. Check health endpoint returns `{ service: "app" }`

## Performance Considerations

None — this is a pure naming change with no runtime behavior changes.

## Migration Notes

- **Inngest**: Hard cut. Old function IDs (`memory/*`, `console/*`) will appear as archived in Inngest dashboard. New IDs (`platform/*`, `app/*`) create fresh function entries. In-flight events with old names will fail to match triggers — acceptable for dev; coordinate deploy timing for production.
- **JWT**: Atomic deploy ensures signing and verification change together. No backwards-compatible window needed.
- **Vercel env**: `INNGEST_APP_NAME="lightfast-console"` must be updated to `"lightfast-app"` in Vercel dashboard for the `lightfast-app` project before deploying Phase 1.

## References

- Research document: `thoughts/shared/research/2026-04-05-console-memory-naming-audit.md`
- CLAUDE.md architecture section for service layout
