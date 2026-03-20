---
date: 2026-03-18
topic: "@repo/inngest — shared typed Inngest client and merged event schemas"
tags: [plan, inngest, shared-package, event-schemas, refactor]
status: ready
---

# `@repo/inngest` Shared Package — Implementation Plan

## Overview

Create `packages/inngest/` (`@repo/inngest`) as the single source of truth for all Inngest event
schemas and the typed client factory. The two isolated local clients (`apps/backfill/src/inngest/client.ts`
and `api/console/src/inngest/client/client.ts`) are deleted and replaced with imports from this package.
All three service namespaces (`platform/`, `console/`, `backfill/`) are merged into one `EventSchemas`
instance so cross-service type safety is enforced at compile time.

This is a parallel-track prerequisite for the platform architecture redesign (entity worker 401
hardening, gate-first lifecycle, health-check cron). It has no blocking dependencies of its own.

---

## Current State Analysis

### Two isolated clients, incompatible by type

| Attribute | Backfill client | Console client |
|---|---|---|
| File | `apps/backfill/src/inngest/client.ts` | `api/console/src/inngest/client/client.ts` |
| Inngest import | `@vendor/inngest` | bare `inngest` |
| Env source | inline in `apps/backfill/src/env.ts` | `@vendor/inngest/env` |
| Middleware | none | `sentryMiddleware()` |
| Event prefix | `apps-backfill/` | `apps-console/` |
| `Events` type export | no | `export type Events` |
| App id | `env.INNGEST_APP_NAME` (e.g. `lightfast-backfill`) | `env.INNGEST_APP_NAME` (e.g. `lightfast-console`) |

The two `Inngest` instances are opaque to each other's event types. `console-test-data` reaches
into `@api/app/inngest/client` for the typed client, cementing the cross-package coupling.

### Event namespaces

**Backfill events** (`apps/backfill/src/inngest/client.ts`):
- `apps-backfill/run.requested` — `backfillTriggerPayload` from `@repo/app-providers/contracts`
- `apps-backfill/run.cancelled` — `{ installationId, correlationId? }`
- `apps-backfill/entity.requested` — `{ installationId, provider, orgId, entityType, resource, since, depth, holdForReplay?, correlationId? }`

**Console events** (`api/console/src/inngest/client/client.ts`):
- `apps-console/activity.record`
- `apps-console/event.capture`
- `apps-console/event.stored`
- `apps-console/entity.upserted`
- `apps-console/entity.graphed`

**Platform events** (new — from architecture redesign plan):
- `platform/webhook.received`
- `platform/connection.lifecycle`

### All import sites

**`apps/backfill`** (4 local client imports + 2 `@vendor/inngest` imports):
- `src/inngest/client.ts` — the client itself (to be deleted)
- `src/routes/inngest.ts` — `import { inngest } from "../inngest/client.js"`
- `src/routes/trigger.ts` — `import { inngest } from "../inngest/client.js"`
- `src/workflows/backfill-orchestrator.ts` — `import { inngest } from "../inngest/client.js"` + `NonRetriableError` from `@vendor/inngest`
- `src/workflows/entity-worker.ts` — `import { inngest } from "../inngest/client.js"` + `NonRetriableError` from `@vendor/inngest`

**`api/console`** (3 local + bare `inngest` imports):
- `src/inngest/client/client.ts` — the client itself (to be deleted)
- `src/inngest/index.ts` — re-exports `inngest` from `./client/client`
- `src/lib/activity.ts` — `import { inngest } from "../inngest/client/client"`
- `src/inngest/workflow/neural/event-store.ts` — `NonRetriableError` from bare `"inngest"`
- `src/inngest/workflow/neural/entity-embed.ts` — `NonRetriableError` from bare `"inngest"`

**`apps/console`** (no client import, uses `@api/app/inngest` — unaffected):
- `src/app/(inngest)/api/inngest/route.ts` — `createInngestRouteContext` from `@api/app/inngest`
- `src/app/api/gateway/ingress/_lib/notify.ts` — `inngest` from `@api/app/inngest`

**`packages/console-test-data`** (cross-package client import):
- `src/trigger/trigger.ts` — `inngest` from `@api/app/inngest/client`

---

## Desired End State

- `packages/inngest/` exists as `@repo/inngest` with two exports: `.` (schemas) and `./client` (typed client factory)
- All event schemas live in `packages/inngest/src/schemas/` organized by namespace
- The shared `inngest` client instance is constructed once via a factory that accepts per-service middleware
- `apps/backfill/src/inngest/client.ts` is deleted; backfill imports `{ createInngestClient }` from `@repo/inngest/client`
- `api/console/src/inngest/client/client.ts` is rewritten to delegate to `@repo/inngest/client`
- Event names are renamed: `apps-backfill/*` → `backfill/*`, `apps-console/*` → `console/*`
- All bare `"inngest"` imports in console workflows are replaced with `@vendor/inngest`
- `@repo/inngest` is listed in `apps/backfill/package.json` and `api/console/package.json` as `workspace:*`

### Verification

```bash
pnpm --filter @repo/inngest build    # package builds cleanly
pnpm --filter @repo/inngest typecheck
pnpm --filter apps-backfill typecheck
pnpm --filter @api/app typecheck
pnpm --filter @api/app build
pnpm --filter apps-backfill build
pnpm check
```

---

## What We're NOT Doing

- Not merging the Inngest *serve* route handlers — each service keeps its own `serve()` call
- Not moving workflow function definitions out of `api/console` or `apps/backfill`
- Not changing the `@vendor/inngest` package (it remains the raw re-export layer)
- Not adding any runtime logic to `@repo/inngest` — schemas and factory only
- Not removing the `@api/app/inngest/client` export path (used by `console-test-data`; that migration is separate)
- Not changing `INNGEST_APP_NAME` env var usage in either service's `env.ts` — they keep their per-service values and pass them into the factory

---

## Implementation Approach

**Single-phase, bottom-up:** Create the package, define schemas, expose the factory, then update
consumers in both services. Since both services are in the monorepo and `turbo.json` already
propagates `^build` correctly, no pipeline changes are needed.

**Schema-only export + factory pattern** resolves the middleware asymmetry. The package exports:
1. `allEvents` — the merged Zod event map (all three namespaces)
2. `createInngestClient(options)` — factory that accepts optional middleware so each service keeps its own middleware config
3. `NonRetriableError`, `RetryAfterError` — re-exported from `@vendor/inngest` to eliminate bare `"inngest"` imports in consumers

**Event namespace rename** (`apps-backfill/*` → `backfill/*`, `apps-console/*` → `console/*`) happens
here since the schemas are being rewritten centrally. This is the right time; the platform
architecture plan already uses the short prefixes.

---

## Phase 1: Create `packages/inngest/`

### Overview

Scaffold the package with all event schemas and the client factory. No consumer changes yet —
this phase is pure addition.

### Changes Required

#### 1. `packages/inngest/package.json`

```json
{
  "name": "@repo/inngest",
  "license": "FSL-1.1-Apache-2.0",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "default": "./dist/client.js"
    }
  },
  "scripts": {
    "build": "tsup && tsc --incremental false",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@inngest/middleware-sentry": "catalog:",
    "@repo/app-providers": "workspace:*",
    "@repo/app-validation": "workspace:*",
    "@vendor/inngest": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "tsup": "^8.5.1",
    "typescript": "catalog:"
  }
}
```

**Note on `@inngest/middleware-sentry`:** Listed as a regular dep (not peer) so the factory can
import it without requiring consumers to install it separately. The factory only applies
`sentryMiddleware()` when the caller opts in.

#### 2. `packages/inngest/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "lib": ["ES2022"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

No `"DOM"` lib needed — this package has no browser-side code.

#### 3. `packages/inngest/turbo.json`

```json
{
  "extends": ["//"],
  "tags": ["packages"],
  "tasks": {}
}
```

#### 4. `packages/inngest/tsup.config.ts`

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
```

#### 5. `packages/inngest/src/schemas/platform.ts`

New events for the platform service (gateway health-check and connection lifecycle):

```typescript
import { z } from "zod";

export const platformEvents = {
  "platform/webhook.received": z.object({
    provider: z.string(),
    deliveryId: z.string(),
    eventType: z.string(),
    resourceId: z.string().nullable(),
    payload: z.unknown(),
    receivedAt: z.number(),
    serviceAuth: z.boolean().optional(),
    preResolved: z
      .object({
        connectionId: z.string(),
        orgId: z.string(),
      })
      .optional(),
    correlationId: z.string().optional(),
  }),
  "platform/connection.lifecycle": z.object({
    reason: z.string(),
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
};
```

#### 6. `packages/inngest/src/schemas/console.ts`

Lifted verbatim from `api/console/src/inngest/client/client.ts` eventsMap, with prefix renamed
from `apps-console/` to `console/`:

```typescript
import { postTransformEventSchema } from "@repo/app-providers/contracts";
import { ingestionSourceSchema } from "@repo/app-validation";
import { z } from "zod";

export const consoleEvents = {
  "console/activity.record": z.object({
    workspaceId: z.string(),
    category: z.enum([
      "auth",
      "workspace",
      "integration",
      "store",
      "job",
      "search",
      "document",
      "permission",
      "api_key",
      "settings",
    ]),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    relatedActivityId: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
  "console/event.capture": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    sourceEvent: postTransformEventSchema,
    ingestionSource: ingestionSourceSchema.optional(),
    ingestLogId: z.number().optional(),
    correlationId: z.string().optional(),
  }),
  "console/event.stored": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    sourceType: z.string(),
    significanceScore: z.number(),
  }),
  "console/entity.upserted": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    internalEventId: z.number(),
    entityRefs: z.array(
      z.object({
        type: z.string(),
        key: z.string(),
        label: z.string().nullable(),
      })
    ),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
  "console/entity.graphed": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
};
```

#### 7. `packages/inngest/src/schemas/backfill.ts`

Lifted from `apps/backfill/src/inngest/client.ts` eventsMap, prefix renamed from `apps-backfill/`
to `backfill/`:

```typescript
import { backfillDepthSchema } from "@repo/app-providers/client";
import { backfillTriggerPayload } from "@repo/app-providers/contracts";
import { z } from "zod";

export const backfillEvents = {
  "backfill/run.requested": backfillTriggerPayload,
  "backfill/run.cancelled": z.object({
    installationId: z.string(),
    correlationId: z.string().max(128).optional(),
  }),
  "backfill/entity.requested": z.object({
    installationId: z.string(),
    provider: z.string(),
    orgId: z.string(),
    entityType: z.string(),
    resource: z.object({
      providerResourceId: z.string(),
      resourceName: z.string(),
    }),
    since: z.string().datetime(),
    depth: backfillDepthSchema,
    holdForReplay: z.boolean().optional(),
    correlationId: z.string().max(128).optional(),
  }),
};
```

#### 8. `packages/inngest/src/index.ts`

Barrel for schema re-exports and `NonRetriableError` / `RetryAfterError` normalisation:

```typescript
export { NonRetriableError, RetryAfterError } from "@vendor/inngest";

export { platformEvents } from "./schemas/platform.js";
export { consoleEvents } from "./schemas/console.js";
export { backfillEvents } from "./schemas/backfill.js";

// Merged map — useful for ad-hoc sends outside a typed client
export const allEvents = {
  ...platformEvents,
  ...consoleEvents,
  ...backfillEvents,
} as const;
```

#### 9. `packages/inngest/src/client.ts`

Factory that constructs the unified typed client. Each service calls this with its own env and
optional middleware:

```typescript
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest, type InngestMiddleware } from "@vendor/inngest";
import { allEvents } from "./index.js";

export interface CreateInngestClientOptions {
  /** Service app name, e.g. "lightfast-console" or "lightfast-backfill" */
  appName: string;
  eventKey?: string;
  signingKey?: string;
  /** Pass true to enable Sentry middleware (console service only) */
  withSentry?: boolean;
  /** Additional middleware beyond Sentry */
  middleware?: InngestMiddleware<any>[];
}

/**
 * Creates a fully-typed Inngest client with all platform, console, and backfill
 * event schemas registered. Call once per service entry point.
 */
export function createInngestClient(options: CreateInngestClientOptions) {
  const { appName, eventKey, signingKey, withSentry = false, middleware = [] } =
    options;

  const resolvedMiddleware = [
    ...(withSentry ? [sentryMiddleware()] : []),
    ...middleware,
  ];

  return new Inngest({
    id: appName,
    eventKey,
    signingKey,
    schemas: new EventSchemas()
      .fromZod(allEvents),
    ...(resolvedMiddleware.length > 0
      ? { middleware: resolvedMiddleware }
      : {}),
  });
}

/** Convenience type for consumers that need the full event map type */
export type { GetEvents } from "inngest";
```

**Note on `id`:** The factory accepts `appName` (the per-service `INNGEST_APP_NAME` value). The
platform architecture plan uses `id: "lightfast"` as the eventual unified ID; that rename is a
separate concern when the platform service is bootstrapped and can be handled then. For this
package the factory is ID-agnostic.

### Success Criteria

#### Automated Verification:
- [ ] Package builds: `pnpm --filter @repo/inngest build`
- [ ] Types compile: `pnpm --filter @repo/inngest typecheck`
- [ ] No lint errors: `pnpm check`

#### Manual Verification:
- [ ] `dist/index.js`, `dist/index.d.ts`, `dist/client.js`, `dist/client.d.ts` all present after build

---

## Phase 2: Migrate `apps/backfill`

### Overview

Replace the local `apps/backfill/src/inngest/client.ts` with an import from `@repo/inngest/client`.
Update all consumer files to use renamed event names (`backfill/*` instead of `apps-backfill/*`).

### Changes Required

#### 1. Add dependency — `apps/backfill/package.json`

Add to `dependencies`:
```json
"@repo/inngest": "workspace:*"
```

Remove from `devDependencies` if `@vendor/inngest` was only used for the client constructor
(it's still needed for `NonRetriableError` re-exports, but those now come from `@repo/inngest`).
Keep `@vendor/inngest` only if the route handler imports `serve` from `@vendor/inngest/hono`
(it does — `src/routes/inngest.ts` imports `serve` from `@vendor/inngest/hono`, so keep it).

#### 2. Rewrite `apps/backfill/src/inngest/client.ts`

```typescript
import { createInngestClient } from "@repo/inngest/client";
import { env } from "../env.js";

export const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  // No sentry middleware for backfill service
});
```

The local `eventsMap` definition is deleted entirely.

#### 3. Update workflow consumers — rename event strings

**`apps/backfill/src/workflows/backfill-orchestrator.ts`**

All string literals using `"apps-backfill/*"` event names must be updated:
- `"apps-backfill/run.requested"` → `"backfill/run.requested"`
- `"apps-backfill/run.cancelled"` → `"backfill/run.cancelled"`
- `"apps-backfill/entity.requested"` → `"backfill/entity.requested"`

Also update `NonRetriableError` import source:
```typescript
// Before
import { NonRetriableError } from "@vendor/inngest";
// After
import { NonRetriableError } from "@repo/inngest";
```

**`apps/backfill/src/workflows/entity-worker.ts`**

Same event name renames. Same `NonRetriableError` import update.

**`apps/backfill/src/routes/trigger.ts`**

Check for any hardcoded event names and rename accordingly. The `inngest` client import path
is unchanged (`"../inngest/client.js"`).

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter apps-backfill typecheck`
- [x] `pnpm --filter apps-backfill build`
- [x] Backfill tests pass: `pnpm --filter apps-backfill test` (249/249, 2 pre-existing server-only failures unrelated)
- [ ] No lint errors: `pnpm check`

#### Manual Verification:
- [ ] Local backfill dev server starts without errors: `pnpm dev:backfill`
- [ ] Inngest dev dashboard shows backfill functions registered under `lightfast-backfill`

**Implementation Note**: Pause here after verifying the dev server and Inngest dashboard before
proceeding to Phase 3.

---

## Phase 3: Migrate `api/console`

### Overview

Replace the local client and eventsMap in `api/console/src/inngest/client/client.ts`. Update
all workflow files that reference `apps-console/*` event names. Normalize bare `"inngest"` imports.

### Changes Required

#### 1. Add dependency — `api/console/package.json`

Add to `dependencies`:
```json
"@repo/inngest": "workspace:*"
```

#### 2. Rewrite `api/console/src/inngest/client/client.ts`

```typescript
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { createInngestClient } from "@repo/inngest/client";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";

/**
 * Inngest client for console application.
 * Schemas are sourced from @repo/inngest (all platform + console + backfill events).
 */
const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  withSentry: true,
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

The local `eventsMap` (150 lines of Zod definitions) is deleted entirely.

#### 3. Rename event strings across all console workflow files

The following event name strings must be updated wherever they appear as Inngest trigger/send
arguments, `cancelOn` patterns, or step event names:

| Old | New |
|---|---|
| `"apps-console/activity.record"` | `"console/activity.record"` |
| `"apps-console/event.capture"` | `"console/event.capture"` |
| `"apps-console/event.stored"` | `"console/event.stored"` |
| `"apps-console/entity.upserted"` | `"console/entity.upserted"` |
| `"apps-console/entity.graphed"` | `"console/entity.graphed"` |

Files to check (run grep to find all occurrences before editing):
```bash
grep -r "apps-console/" api/console/src/ --include="*.ts" -l
grep -r "apps-console/" apps/console/src/ --include="*.ts" -l
```

Known files from research:
- `api/console/src/inngest/workflow/infrastructure/record-activity.ts`
- `api/console/src/inngest/workflow/neural/event-store.ts`
- `api/console/src/inngest/workflow/neural/entity-embed.ts`
- `api/console/src/inngest/workflow/neural/entity-graph.ts` (verify)
- `api/console/src/inngest/workflow/notifications/notification-dispatch.ts` (verify)
- `api/console/src/lib/activity.ts`
- `apps/console/src/app/api/gateway/ingress/_lib/notify.ts`

#### 4. Normalize bare `"inngest"` imports in workflow files

**`api/console/src/inngest/workflow/neural/event-store.ts`**
```typescript
// Before
import { NonRetriableError } from "inngest";
// After
import { NonRetriableError } from "@repo/inngest";
```

**`api/console/src/inngest/workflow/neural/entity-embed.ts`**
```typescript
// Before
import { NonRetriableError } from "inngest";
// After
import { NonRetriableError } from "@repo/inngest";
```

Also normalize the `import { serve } from "inngest/next"` in `api/console/src/inngest/index.ts`
— this can stay as-is since `@vendor/inngest` doesn't export a Next.js adapter, or replace with
the direct `inngest` catalog import. Leave it unless it causes a lint error.

### Success Criteria

#### Automated Verification:
- [ ] `pnpm --filter @api/app typecheck`
- [ ] `pnpm --filter @api/app build`
- [ ] `pnpm check`

#### Manual Verification:
- [ ] Console dev server starts: `pnpm dev:console`
- [ ] Inngest dev dashboard shows all 5 console functions registered
- [ ] Activity recording works (test via a login action)
- [ ] `console-test-data` trigger still works (imports via `@api/app/inngest/client` which now delegates to `@repo/inngest`)

**Implementation Note**: Pause here after manual verification before declaring the migration done.

---

## Phase 4: Verify End-to-End and Clean Up

### Overview

Full integration check across the monorepo. Remove any dead code left by the migration.

### Changes Required

#### 1. Remove dead imports from `apps/backfill/src/inngest/client.ts`

After Phase 2, verify the original backfill `client.ts` contains only the delegating form.
Delete any orphaned import lines.

#### 2. Verify `console-test-data` still compiles

`packages/console-test-data/src/trigger/trigger.ts` imports from `@api/app/inngest/client`.
That export path still resolves to the rewritten `client.ts` which now delegates to `@repo/inngest`.
No change needed, but verify:

```bash
pnpm --filter @repo/app-test-data typecheck
```

#### 3. Full monorepo type check and build

```bash
pnpm typecheck
pnpm build:console
pnpm build:backfill
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm --filter @repo/app-test-data typecheck`
- [ ] `pnpm build:console`
- [ ] `pnpm build:backfill`
- [ ] `pnpm check` (lint)
- [ ] All backfill tests: `pnpm --filter apps-backfill test`

#### Manual Verification:
- [ ] Full local stack starts: `pnpm dev:app`
- [ ] Inngest dashboard shows both `lightfast-console` and `lightfast-backfill` apps registered
- [ ] A real webhook delivery flows: relay → backfill orchestrator → entity-worker → console event.capture
- [ ] No TypeScript errors in IDE for event name strings (autocomplete resolves to correct schema)

---

## Testing Strategy

### Unit Tests

No new unit tests are required for the package itself — the schemas are pure data (Zod objects)
with no logic to test beyond what Zod validates. Existing backfill workflow tests
(`backfill-orchestrator.test.ts`, `entity-worker.test.ts`) will serve as the integration signal:
if they pass with the renamed event names, the migration is correct.

### Manual Testing Steps

1. Start `pnpm dev:app` and open the Inngest dev dashboard (default: `http://localhost:8288`)
2. Verify both apps appear: `lightfast-console` (5 functions) and `lightfast-backfill` (2 functions)
3. Trigger a test webhook via the relay; confirm it routes through the backfill orchestrator
4. Check that `console/event.capture` function fires and stores the event correctly
5. Verify activity logging still works from a UI action in the console

---

## Performance Considerations

None. This is a compile-time type consolidation with no runtime behaviour change. The merged
`EventSchemas` object is constructed once at module initialisation in each service; the additional
schema entries add negligible startup overhead.

---

## Migration Notes

**Event name rename rollout:** Both services are internal (no external consumers of these event
names). The rename from `apps-console/*` / `apps-backfill/*` to `console/*` / `backfill/*` is
atomic within this PR — all send sites and trigger/cancelOn matchers must be updated in the same
commit to avoid a split-brain state during deployment. Deploy both services together.

**No data migration needed:** Inngest event names are ephemeral strings. In-flight events at
deploy time will carry the old names but their functions will still be registered under the new
names. Any in-flight events using old names will simply not match a trigger and will expire
naturally. Given typical backfill job durations (minutes), a brief deploy window is acceptable.

---

## References

- Research doc: `thoughts/shared/research/2026-03-18-repo-inngest-shared-package.md`
- Platform architecture plan (event schema section): `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md` (§ "Inngest Event Schema")
- Backfill client: `apps/backfill/src/inngest/client.ts`
- Console client: `api/console/src/inngest/client/client.ts`
- `@vendor/inngest` package: `vendor/inngest/package.json`
- Reference package structure: `packages/console-providers/` (tsup + tsc build pattern)
- Turbo tag pattern: `packages/console-validation/turbo.json`
