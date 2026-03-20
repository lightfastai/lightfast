---
date: 2026-03-19T00:00:00+11:00
researcher: claude
git_commit: c7a983034c9f118684c0c98707259a997bb3b62b
branch: feat/platform-gate-first-health-hardening
repository: lightfast
topic: "@repo/inngest shared client + all-events schema pattern"
tags: [research, codebase, inngest, backfill, console, gateway, schemas, multi-app]
status: complete
last_updated: 2026-03-19
---

# Research: `@repo/inngest` — Shared Client Factory and All-Events Schema Pattern

**Date**: 2026-03-19
**Git Commit**: `c7a983034c9f118684c0c98707259a997bb3b62b`
**Branch**: `feat/platform-gate-first-health-hardening`

## Research Question

> The `@repo/inngest` package introduced in a recent merge collapses all event schemas
> and the Inngest client instantiation into a shared package with a `createInngestClient`
> factory. With Inngest multi-app setups, each app is expected to maintain only its own
> schemas. This research documents the current structure, what existed before, and how
> consumers use the package today.

---

## Summary

Commit `c2e047cf8` (2026-03-18) introduced `packages/inngest/` (`@repo/inngest`) — a new
shared workspace package that:

1. Centralises all event schema definitions across all services into three files
   (`platform.ts`, `console.ts`, `backfill.ts`) and merges them into `allEvents`
2. Exposes a `createInngestClient()` factory that stamps **all 9 events** from all three
   schema groups into every Inngest client instance, regardless of which service calls it
3. Is consumed by three services: `api/console`, `apps/backfill`, and `apps/gateway`

Before this commit, each service maintained its own isolated event map with only its own
events. The merge collapsed those isolated maps into a single merged `allEvents` object
shared by all consumers.

---

## Detailed Findings

### 1. Package Structure

`packages/inngest/` — `@repo/inngest`

**Schema files** (`packages/inngest/src/schemas/`):

| File | Export | Events defined |
|------|--------|----------------|
| `platform.ts:3` | `platformEvents` | `platform/webhook.received`, `platform/connection.lifecycle` |
| `console.ts:5` | `consoleEvents` | `console/activity.record`, `console/event.capture`, `console/event.stored`, `console/entity.upserted`, `console/entity.graphed` |
| `backfill.ts:5` | `backfillEvents` | `backfill/run.requested`, `backfill/run.cancelled`, `backfill/connection.health.check.requested`, `backfill/entity.requested` |

**Merged export** (`packages/inngest/src/index.ts:10-14`):

```ts
export const allEvents = {
  ...platformEvents,
  ...consoleEvents,
  ...backfillEvents,
} as const;
```

`allEvents` is a single 11-event object (2 platform + 5 console + 4 backfill).

**Client factory** (`packages/inngest/src/client.ts:19-39`):

```ts
export function createInngestClient(options: CreateInngestClientOptions) {
  // ...
  return new Inngest({
    id: appName,
    eventKey,
    schemas: new EventSchemas().fromSchema(allEvents),  // always all 11 events
    // ...middleware
  });
}
```

`allEvents` is unconditionally passed to every instantiated client via `EventSchemas().fromSchema()`.

**Package exports** (`packages/inngest/package.json:8-17`):

- `@repo/inngest` → root (schema maps, error classes, `allEvents`)
- `@repo/inngest/client` → `createInngestClient`, `GetEvents`

**Package dependencies** (`packages/inngest/package.json:24-31`):

```json
"dependencies": {
  "@inngest/middleware-sentry": "catalog:",
  "@repo/app-providers": "workspace:*",   // needed for consoleEvents + backfillEvents schemas
  "@repo/app-validation": "workspace:*",  // needed for consoleEvents schemas
  "@vendor/inngest": "workspace:*",
  "inngest": "catalog:",
  "zod": "catalog:"
}
```

`@repo/app-providers` and `@repo/app-validation` are pulled into the package
dependency graph to satisfy the `consoleEvents` and `backfillEvents` Zod schemas.

---

### 2. Consumer Usage — Who Uses What

#### `api/console/src/inngest/client/client.ts:1-13`

```ts
import type { GetEvents } from "@repo/inngest/client";
import { createInngestClient } from "@repo/inngest/client";

const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  withSentry: true,
});
export type Events = GetEvents<typeof inngest>;
export { inngest };
```

This `inngest` instance (with all 11 events in its type) is re-exported from
`api/console/src/inngest/index.ts:11` and consumed by all five workflow files
and all `inngest.send()` / `step.sendEvent()` call sites in the console service.

#### `apps/backfill/src/inngest/client.ts:4-8`

```ts
export const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  // withSentry omitted → defaults false
});
```

This instance (with all 11 events) is consumed by the two workflow files and
the HTTP trigger route in the backfill service.

#### `apps/gateway/src/inngest/client.ts:14-17`

```ts
const inngest = createInngestClient({
  appName: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
});
```

The gateway uses this client only to send `platform/connection.lifecycle` events.
No Inngest functions are registered in the gateway service; it has no serve handler.

---

### 3. Registered Functions Per App

#### Console — 5 functions

Assembled at `api/console/src/inngest/index.ts:26-38`, served via `inngest/next` at
`apps/console/src/app/(inngest)/api/inngest/route.ts`.

| Function ID | Trigger Event | Source |
|-------------|--------------|--------|
| `console/record-activity` | `console/activity.record` | `workflow/infrastructure/record-activity.ts:27` |
| `console/event.store` | `console/event.capture` | `workflow/neural/event-store.ts:109` |
| `console/entity.graph` | `console/entity.upserted` | `workflow/neural/entity-graph.ts:16` |
| `console/entity.embed` | `console/entity.graphed` | `workflow/neural/entity-embed.ts:47` |
| `console/notification.dispatch` | `console/event.stored` | `workflow/notifications/dispatch.ts:8` |

All console functions trigger exclusively on `console/*` events. No function in console
handles `platform/*` or `backfill/*` events.

#### Backfill — 2 functions

Assembled at `apps/backfill/src/routes/inngest.ts:13-16`, served via `@vendor/inngest/hono`
at `apps/backfill/src/app.ts:51` on `/api/inngest`.

| Function ID | Trigger Event | Source |
|-------------|--------------|--------|
| `backfill/run.orchestrator` | `backfill/run.requested` | `workflows/backfill-orchestrator.ts:12` |
| `backfill/entity.worker` | `backfill/entity.requested` | `workflows/entity-worker.ts:13` |

All backfill functions trigger exclusively on `backfill/*` events. No function in backfill
handles `console/*` or `platform/*` events.

---

### 4. Event Send Sites

#### Console sends

| File | Line | Event sent | Method |
|------|------|-----------|--------|
| `apps/console/src/app/api/gateway/ingress/_lib/notify.ts` | 21 | `console/event.capture` | `inngest.send()` |
| `api/console/src/lib/activity.ts` | 234 | `console/activity.record` | `inngest.send()` |
| `api/console/src/inngest/workflow/neural/event-store.ts` | 565 | `console/entity.upserted` | `step.sendEvent()` |
| `api/console/src/inngest/workflow/neural/event-store.ts` | 581 | `console/event.stored` | `step.sendEvent()` |
| `api/console/src/inngest/workflow/neural/entity-graph.ts` | 47 | `console/entity.graphed` | `step.sendEvent()` |

Console exclusively sends `console/*` events.

#### Backfill sends

| File | Line | Event sent | Method |
|------|------|-----------|--------|
| `apps/backfill/src/routes/trigger.ts` | 53 | `backfill/run.requested` | `inngest.send()` |
| `apps/backfill/src/routes/trigger.ts` | 121 | `backfill/run.cancelled` | `inngest.send()` |
| `apps/backfill/src/workflows/entity-worker.ts` | 121 | `backfill/connection.health.check.requested` | `step.sendEvent()` |

Backfill exclusively sends `backfill/*` events (the health check event is sent internally
from within a backfill function but no registered function consumes it — it is visible
in the Inngest event log but has no handler).

#### Gateway sends

| File | Line | Event sent | Method |
|------|------|-----------|--------|
| `apps/gateway/src/inngest/health-check.ts` | 154, 211 | `platform/connection.lifecycle` | `inngest.send()` |

No registered function in any app currently handles `platform/connection.lifecycle`.

---

### 5. Event Chain (Console)

```
[ingress webhook → Next.js]
  → inngest.send("console/event.capture")              notify.ts:21

[eventStore] ← console/event.capture
  → step.sendEvent("console/entity.upserted")          event-store.ts:565
  → step.sendEvent("console/event.stored")             event-store.ts:581

[entityGraph] ← console/entity.upserted
  → step.sendEvent("console/entity.graphed")           entity-graph.ts:47

[entityEmbed] ← console/entity.graphed
  → (terminal — writes to Pinecone)

[notificationDispatch] ← console/event.stored
  → (terminal — triggers Knock)

[activity helper]
  → inngest.send("console/activity.record")            activity.ts:234

[recordActivity] ← console/activity.record (batched)
  → (terminal — batch DB insert)
```

---

### 6. Before the Merge — Isolated Local Clients

Prior to `c2e047cf8`, each app owned its event map privately:

**`api/console/src/inngest/client/client.ts`** (~142 lines, pre-migration):
- Imported directly from `inngest` (not `@vendor/inngest`)
- Declared a local `eventsMap` object with 5 Zod schemas inline
- Event names prefixed `apps-console/*`
- `signingKey` was passed to `new Inngest()`
- `sentryMiddleware()` was unconditional (no `withSentry` flag)

**`apps/backfill/src/inngest/client.ts`** (~45 lines, pre-migration):
- Imported from `@vendor/inngest`
- Declared its own local `eventsMap` with 3 Zod schemas inline
- Event names prefixed `apps-backfill/*`
- `signingKey` was passed to `new Inngest()`
- No Sentry middleware

The merge also renamed all event prefixes:

| Old name | New name |
|----------|----------|
| `apps-console/activity.record` | `console/activity.record` |
| `apps-console/event.capture` | `console/event.capture` |
| `apps-console/event.stored` | `console/event.stored` |
| `apps-console/entity.upserted` | `console/entity.upserted` |
| `apps-console/entity.graphed` | `console/entity.graphed` |
| `apps-backfill/run.requested` | `backfill/run.requested` |
| `apps-backfill/run.cancelled` | `backfill/run.cancelled` |
| `apps-backfill/entity.requested` | `backfill/entity.requested` |

---

### 7. Cross-App Schema Awareness (Current State)

Each app's Inngest client currently has all 11 events in its type-level event map,
regardless of whether the app sends or handles those events:

| App | Events it sends | Events in its client schema |
|-----|-----------------|----------------------------|
| `api/console` | `console/*` only | `console/*` + `backfill/*` + `platform/*` |
| `apps/backfill` | `backfill/*` only | `console/*` + `backfill/*` + `platform/*` |
| `apps/gateway` | `platform/*` only | `console/*` + `backfill/*` + `platform/*` |

---

## Code References

- `packages/inngest/src/client.ts:19-39` — `createInngestClient` factory
- `packages/inngest/src/index.ts:10-14` — `allEvents` merged map
- `packages/inngest/src/schemas/platform.ts:3` — `platformEvents` (2 events)
- `packages/inngest/src/schemas/console.ts:5` — `consoleEvents` (5 events)
- `packages/inngest/src/schemas/backfill.ts:5` — `backfillEvents` (4 events)
- `packages/inngest/package.json:24-31` — package dependencies (includes `@repo/app-providers`, `@repo/app-validation`)
- `api/console/src/inngest/client/client.ts:9-13` — console client instantiation
- `api/console/src/inngest/index.ts:26-38` — console function list + serve
- `apps/console/src/app/(inngest)/api/inngest/route.ts:12` — Next.js route handler
- `apps/backfill/src/inngest/client.ts:4-8` — backfill client instantiation
- `apps/backfill/src/routes/inngest.ts:13-16` — backfill function list + serve
- `apps/backfill/src/app.ts:51` — backfill Hono route mounting
- `apps/gateway/src/inngest/client.ts:14-17` — gateway client instantiation (send-only)
- `apps/gateway/src/inngest/health-check.ts:154,211` — gateway event send sites

---

## Architecture Documentation

### How the shared `createInngestClient` is consumed

```
@repo/inngest/client
  └─ createInngestClient({ appName, eventKey, withSentry?, middleware? })
       └─ new Inngest({ id: appName, schemas: EventSchemas().fromSchema(allEvents) })
            └─ allEvents = { ...platformEvents, ...consoleEvents, ...backfillEvents }

api/console/ inngest client
  └─ createInngestClient({ appName, eventKey, withSentry: true })
       └─ re-exported as `inngest` → consumed by 5 workflow files + 2 send sites

apps/backfill/ inngest client
  └─ createInngestClient({ appName, eventKey })
       └─ exported as `inngest` → consumed by 2 workflow files + 1 trigger route

apps/gateway/ inngest client
  └─ createInngestClient({ appName, eventKey })
       └─ used only for inngest.send("platform/connection.lifecycle")
       └─ no serve handler, no registered functions
```

### What each app actually uses from the merged schema

| App | Events it registers functions for | Events it sends | Events from schema it never touches |
|-----|----------------------------------|-----------------|-------------------------------------|
| `api/console` | `console/*` (5) | `console/*` (5) | `backfill/*`, `platform/*` |
| `apps/backfill` | `backfill/*` (2) | `backfill/*` (3 of 4) | `console/*`, `platform/*` |
| `apps/gateway` | none | `platform/*` (1) | `console/*`, `backfill/*` |

Note: `backfill/entity.requested` is defined in the schema but the orchestrator
invokes `backfillEntityWorker` via `step.invoke()` rather than sending the event,
so the event itself is never sent directly from `trigger.ts`.

---

## Open Questions

1. **`platform/connection.lifecycle`** — sent by gateway but no registered function
   handles it. Is it intended to trigger a future console function, or is it only
   for Inngest event log visibility?

2. **`backfill/connection.health.check.requested`** — sent within `backfillEntityWorker`
   on 401 but no function is registered to handle it. Same question as above.

3. **`backfill/entity.requested`** — defined in schema and used as the trigger for
   `backfillEntityWorker`, but the orchestrator uses `step.invoke()` rather than
   sending this event directly. Is there an external send path that uses this event?

4. **`apps/gateway` as an Inngest consumer** — gateway has an Inngest client but
   no serve handler and no registered functions. It was not identified as an app
   that "has Inngest events" by the team but is currently wired to `createInngestClient`.
