# Drop `@repo/inngest` Package — Implementation Plan

## Overview

Delete `packages/inngest/` by inlining client construction and moving event schemas into the services that own them. Each service only sends/consumes events from its own namespace (`console/*` for `api/app`, `memory/*` for `api/platform`), so the shared package is pure overhead.

## Current State Analysis

`@repo/inngest` exposes two entry points:
- `.` — re-exports `NonRetriableError`, `RetryAfterError` from `@vendor/inngest`, plus `consoleEvents`, `memoryEvents`, `allEvents`
- `./client` — `createInngestClient()` factory, `GetEvents` type re-export from `inngest`

**Three consumers:**

| Consumer | How it uses `@repo/inngest` |
|---|---|
| `api/app/src/inngest/client/client.ts` | `createInngestClient` + `GetEvents` from `./client` |
| `api/platform/src/inngest/client.ts` | `createInngestClient` + `GetEvents` from `./client` |
| `api/platform/src/inngest/functions/*.ts` (5 files) | `NonRetriableError` from `.` |
| `apps/platform/next.config.ts` | `transpilePackages` + `optimizePackageImports` config entries only |

**Cross-service event flow: zero.** `api/app` only ever sends/consumes `console/*` events. `api/platform` only ever sends/consumes `memory/*` events. Confirmed by exhaustive grep across both services.

**`@vendor/inngest` already exports** `NonRetriableError`, `RetryAfterError`, `EventSchemas`, `Inngest`, `InngestMiddleware`. Everything needed is already available.

**`@inngest/middleware-sentry` is already declared** in `api/app/package.json:43` — no new dependency needed.

## Desired End State

- `packages/inngest/` directory deleted
- `api/app/src/inngest/client/client.ts` directly constructs `new Inngest()` with `consoleEvents` only
- `api/platform/src/inngest/client.ts` directly constructs `new Inngest()` with `memoryEvents` only
- Schema files live alongside their owning services:
  - `api/app/src/inngest/schemas/console.ts`
  - `api/platform/src/inngest/schemas/memory.ts`
- All 5 platform function files import `NonRetriableError` from `@vendor/inngest`
- `@repo/inngest` removed from all `package.json` and `next.config.ts` references

**Verification:** `pnpm typecheck` passes, `pnpm check` passes, `pnpm build:app` and `pnpm build:platform` succeed.

## What We're NOT Doing

- Fixing the orphan `memory/health.check.requested` event (sent by `memory-entity-worker.ts` but never consumed — pre-existing issue, out of scope)
- Changing any event schemas (content is preserved verbatim)
- Changing Inngest function logic
- Modifying `api/app` client options (`withSentry: true`, env-sourced `appName`/`eventKey` are preserved)

## Implementation Approach

Move in four discrete phases: schemas first (new files, no deletions), then inline the clients (replacing factory calls), then fix the `NonRetriableError` imports, then delete all `@repo/inngest` references and the package itself. Each phase is independently verifiable before proceeding.

---

## Phase 1: Move Schema Files

Create schema files alongside their owning services. No deletions yet — original files stay in place until clients are switched over.

### Changes Required

#### 1. Create `api/app/src/inngest/schemas/console.ts`
**File**: `api/app/src/inngest/schemas/console.ts` *(new)*

Copy verbatim from `packages/inngest/src/schemas/console.ts`:

```ts
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
};
```

#### 2. Create `api/platform/src/inngest/schemas/memory.ts`
**File**: `api/platform/src/inngest/schemas/memory.ts` *(new)*

Copy verbatim from `packages/inngest/src/schemas/memory.ts`:

```ts
import { backfillDepthSchema } from "@repo/app-providers/client";
import { backfillTriggerPayload } from "@repo/app-providers/contracts";
import { postTransformEventSchema } from "@repo/app-providers/contracts";
import { ingestionSourceSchema } from "@repo/app-validation";
import { z } from "zod";

export const memoryEvents = {
  // ── Backfill orchestration events ──
  "memory/backfill.run.requested": backfillTriggerPayload,
  "memory/backfill.run.cancelled": z.object({
    installationId: z.string(),
    correlationId: z.string().max(128).optional(),
  }),
  "memory/backfill.entity.requested": z.object({
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
  // ── Health check signal ──
  "memory/health.check.requested": z.object({
    installationId: z.string(),
    provider: z.string(),
    reason: z.enum(["401_unauthorized"]),
    correlationId: z.string().max(128).optional(),
  }),
  // ── Connection lifecycle (teardown) ──
  "memory/connection.lifecycle": z.object({
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    reason: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
  // ── Ingest + neural pipeline events ──
  "memory/webhook.received": z.object({
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
  "memory/event.capture": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string().optional(),
    sourceEvent: postTransformEventSchema,
    ingestionSource: ingestionSourceSchema.optional(),
    ingestLogId: z.number().optional(),
    correlationId: z.string().optional(),
  }),
  "memory/event.stored": z.object({
    workspaceId: z.string(),
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    sourceType: z.string(),
    significanceScore: z.number(),
  }),
  "memory/entity.upserted": z.object({
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
  "memory/entity.graphed": z.object({
    workspaceId: z.string(),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    occurredAt: z.string(),
    correlationId: z.string().optional(),
  }),
};
```

### Success Criteria

#### Automated Verification:
- [ ] Both new schema files exist and TypeScript can parse them: `pnpm typecheck`

---

## Phase 2: Inline Inngest Clients

Replace `createInngestClient()` calls with direct `new Inngest()` construction in both service client files. Each service now registers only its own events.

### Changes Required

#### 1. Rewrite `api/app/src/inngest/client/client.ts`
**File**: `api/app/src/inngest/client/client.ts`

```ts
import { sentryMiddleware } from "@inngest/middleware-sentry";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { env } from "@vendor/inngest/env";
import type { GetEvents } from "inngest";

import { consoleEvents } from "../schemas/console";

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(consoleEvents),
  middleware: [sentryMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

#### 2. Rewrite `api/platform/src/inngest/client.ts`
**File**: `api/platform/src/inngest/client.ts`

```ts
import { EventSchemas, Inngest } from "@vendor/inngest";
import type { GetEvents } from "inngest";

import { memoryEvents } from "./schemas/memory";

const inngest = new Inngest({
  id: "lightfast-memory",
  schemas: new EventSchemas().fromSchema(memoryEvents),
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
```

### Success Criteria

#### Automated Verification:
- [ ] No remaining imports from `@repo/inngest/client`: `grep -r "@repo/inngest/client" api/`
- [ ] Type checking passes: `pnpm typecheck`

---

## Phase 3: Fix NonRetriableError Imports

Switch all 5 `api/platform` function files from `@repo/inngest` to `@vendor/inngest`.

### Changes Required

In each of the following files, change:
```ts
import { NonRetriableError } from "@repo/inngest";
```
to:
```ts
import { NonRetriableError } from "@vendor/inngest";
```

**Files to update:**
- `api/platform/src/inngest/functions/ingest-delivery.ts:25`
- `api/platform/src/inngest/functions/memory-event-store.ts:39`
- `api/platform/src/inngest/functions/memory-entity-embed.ts:21`
- `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:27`
- `api/platform/src/inngest/functions/memory-entity-worker.ts:20`

### Success Criteria

#### Automated Verification:
- [ ] No remaining imports from `@repo/inngest` (root entry): `grep -r "from \"@repo/inngest\"" api/`
- [ ] Type checking passes: `pnpm typecheck`

---

## Phase 4: Remove All References and Delete Package

### Changes Required

#### 1. Remove from `api/app/package.json`
Remove the line: `"@repo/inngest": "workspace:*"`

#### 2. Remove from `api/platform/package.json`
Remove the line: `"@repo/inngest": "workspace:*"`

#### 3. Remove from `apps/platform/package.json`
Remove the line: `"@repo/inngest": "workspace:*"`

#### 4. Update `apps/platform/next.config.ts`
Remove `"@repo/inngest"` from `transpilePackages` array (line 14) and from `experimental.optimizePackageImports` array (line 24).

#### 5. Delete `packages/inngest/`
Delete the entire directory.

#### 6. Reinstall dependencies
```bash
pnpm install
```

### Success Criteria

#### Automated Verification:
- [ ] No references to `@repo/inngest` anywhere: `grep -r "@repo/inngest" --include="*.ts" --include="*.json" .`
- [ ] `packages/inngest/` does not exist
- [ ] `pnpm install` completes without errors
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] App build succeeds: `pnpm build:app`
- [ ] Platform build succeeds: `pnpm build:platform`

#### Manual Verification:
- [ ] `pnpm dev:platform` starts without errors
- [ ] `pnpm dev:app` starts without errors
- [ ] Inngest dev server registers functions from both services correctly

---

## Testing Strategy

### Automated:
- `pnpm typecheck` — catches any missed imports or type incompatibilities
- `pnpm check` — linting/formatting
- `pnpm build:app` + `pnpm build:platform` — full compilation

### Manual:
1. Start dev stack with `pnpm dev:full`
2. Visit Inngest dev server UI (typically `localhost:8288`) — confirm both `lightfast-app` and `lightfast-memory` apps appear with their correct function counts
3. Trigger a `console/activity.record` event via the Inngest UI and confirm `recordActivity` function fires
4. Confirm no TypeScript or runtime errors in either dev server console

## References

- Research document: `thoughts/shared/research/2026-03-20-drop-repo-inngest-package.md`
- `packages/inngest/src/client.ts` — factory being inlined
- `packages/inngest/src/schemas/console.ts` — schema being moved
- `packages/inngest/src/schemas/memory.ts` — schema being moved
