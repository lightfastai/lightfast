---
date: 2026-03-17T00:00:00+11:00
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: main
repository: lightfast
topic: "Relay app: Upstash Workflow → Inngest migration analysis"
tags: [research, codebase, relay, inngest, upstash-workflow, migration]
status: complete
last_updated: 2026-03-17
---

# Research: Relay — Upstash Workflow → Inngest Migration

**Date**: 2026-03-17
**Git Commit**: `2cebd819`
**Branch**: `main`

## Research Question

Deep analysis of `apps/relay` to understand the current Upstash Workflow implementation and what a conversion to Inngest would look like, using `apps/backfill`'s existing Inngest layer as the reference pattern.

---

## Summary

The relay's webhook delivery durable workflow (`POST /api/workflows/webhook-delivery`) is implemented with `@upstash/workflow`. The 6-step pipeline is structurally identical to what Inngest supports via `step.run`. The backfill app already has a complete, idiomatic Inngest pattern (`inngest/client.ts` → `routes/inngest.ts` → `workflows/*.ts`) that can be mirrored almost exactly. The migration touches 7 files, deletes 1 route file, adds 3 new files, and produces a cleaner result because Inngest's `step.run` is semantically identical to Upstash's `context.run`.

One key nuance: QStash stays in relay — it's used _independently_ for publishing to the Console ingress and DLQ topic. The `QSTASH_TOKEN` env var is not going away. Only the `@vendor/upstash-workflow` dependency is dropped.

---

## Current Relay Architecture

### Routes

```
GET  /                                      — health check
POST /api/webhooks/:provider                — inbound webhooks (webhooks.ts)
POST /api/workflows/webhook-delivery        — Upstash Workflow step callback (workflows.ts)
GET  /admin/health                          — service health (admin.ts)
POST /admin/cache/rebuild                   — Redis cache rebuild (admin.ts)
GET  /admin/dlq                             — list DLQ entries (admin.ts)
POST /admin/dlq/replay                      — replay DLQ entries (admin.ts)
POST /admin/replay/catchup                  — replay un-delivered webhooks (admin.ts)
POST /admin/delivery-status                 — QStash delivery callback (admin.ts)
POST /admin/dev/flush-dedup                 — dev only (admin.ts)
DELETE /admin/dev/backfill-runs/:id         — dev only (admin.ts)
```

### Dependencies (relay/package.json)

| Package | Purpose | Kept after migration? |
|---------|---------|----------------------|
| `@vendor/upstash-workflow` | Upstash Workflow `serve` + `workflowClient` | **Removed** |
| `@vendor/qstash` | `getQStashClient()` for console ingress + DLQ | **Kept** |
| `@vendor/upstash` | Redis for dedup + resource cache | **Kept** |
| `@vendor/db` | PlanetScale via Drizzle | **Kept** |
| `@db/app` | Schema + client | **Kept** |

---

## The Upstash Workflow: What It Does Today

### Entry point: `routes/webhooks.ts:46`

Two webhook paths exist:

**Service auth path** (from backfill/internal — `X-API-Key` present):
- Dedup via Redis SET NX synchronously in the handler
- DB insert + QStash publish directly in the handler
- No workflow involved
- Supports `X-Backfill-Hold` header to hold for batch replay

**Standard path** (from external providers):
- HMAC verification via middleware chain
- Triggers Upstash Workflow asynchronously (`workflowClient.trigger`)
- Returns 200 immediately to provider
- All durable processing happens in the workflow

Trigger call (`webhooks.ts:169`):
```typescript
await workflowClient.trigger({
  url: `${relayBaseUrl}/workflows/webhook-delivery`,
  body: JSON.stringify(workflowPayload),
  headers: { "Content-Type": "application/json" },
});
```

### The 6-step workflow: `routes/workflows.ts`

```
Step 1: dedup              — Redis SET NX (nx: true, ex: 86400). null = duplicate → early return.
Step 2: persist-delivery   — DB INSERT into gatewayWebhookDeliveries, status="received"
Step 3: resolve-connection — Redis hgetall → DB fallthrough → Redis pipeline cache populate
Step 4: route              — DLQ publish (publishToTopic "webhook-dlq") or DB installationId update
Step 5: publish-to-console — QStash publishJSON to consoleUrl/api/gateway/ingress, retries:5,
                             deduplicationId: `${provider}_${deliveryId}`,
                             callback: `${relayBaseUrl}/admin/delivery-status?provider=…`
Step 6: update-status-enqueued — DB UPDATE status="enqueued"
```

Step 4's route decision is all inside one `context.run` block to keep the workflow's step sequence flat. Conditional branching outside `context.run` is the Upstash pattern.

### Replay: `lib/replay.ts`

Used by `admin.ts` routes (`/dlq/replay`, `/replay/catchup`).
1. Clears Redis dedup key so the workflow's Step 1 doesn't see a duplicate
2. Calls `workflowClient.trigger` — identical to how webhooks.ts triggers it
3. Resets DB status to "received"

### Vendor abstraction: `vendor/upstash-workflow`

```
@vendor/upstash-workflow
├── src/hono.ts       → re-exports serve from @upstash/workflow/hono
├── src/client.ts     → new Client({ token: QSTASH_TOKEN }) → workflowClient
├── env.ts            → QSTASH_TOKEN, QSTASH_URL
```

The workflow `serve()` handler in `routes/workflows.ts` receives HTTP callbacks from QStash (Upstash Workflow's execution substrate). Signature verification happens inside the `@upstash/workflow` SDK transparently.

### Env vars consumed by Upstash Workflow (via `upstashEnv` + `qstashEnv`)

```
QSTASH_TOKEN          — used by workflowClient + getQStashClient() (dual use)
QSTASH_URL            — optional override
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Note: `QSTASH_TOKEN` is shared between the workflow client and QStash direct publishing. Even after removing upstash-workflow, QStash direct publishing for console ingress still needs it.

---

## Backfill Inngest Pattern (the reference)

### File structure

```
apps/backfill/src/
├── inngest/
│   └── client.ts         — new Inngest({ id, eventKey, signingKey, schemas })
├── routes/
│   └── inngest.ts        — serve({ client, functions }) via inngest/hono
└── workflows/
    ├── backfill-orchestrator.ts  — inngest.createFunction(...)
    └── entity-worker.ts          — inngest.createFunction(...)
```

### Client (`inngest/client.ts`)

```typescript
import { EventSchemas, Inngest } from "@vendor/inngest";

const eventsMap = { "apps-backfill/run.requested": schema, ... };

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
});
```

### Route (`routes/inngest.ts`)

```typescript
import { serve } from "@vendor/inngest/hono";
inngestRoute.on(["GET", "POST", "PUT"], "/", serve({ client: inngest, functions: [...] }));
```

Mounted at `/api/inngest` in `app.ts`.

### Functions

- `inngest.createFunction({ id, name, retries, concurrency, cancelOn, timeouts }, { event }, handler)`
- Handler receives `{ event, step }` — `step.run`, `step.invoke`, `step.sleep`
- `NonRetriableError` from `@vendor/inngest` for terminal errors

### Env vars (backfill/src/env.ts)

```
INNGEST_APP_NAME     — required, must start with "lightfast-"
INNGEST_EVENT_KEY    — optional (omit in dev for local Inngest)
INNGEST_SIGNING_KEY  — optional (omit in dev, required in prod, starts with "signkey-")
```

### Vendor abstraction: `vendor/inngest`

```
@vendor/inngest
├── src/index.ts   → re-exports EventSchemas, Inngest, InngestMiddleware, NonRetriableError, RetryAfterError
├── src/hono.ts    → re-exports serve from inngest/hono
```

---

## Migration Map

### Files to add (3 new)

```
apps/relay/src/
├── inngest/
│   └── client.ts           — new, mirror of backfill's
├── routes/
│   └── inngest.ts          — new, mirror of backfill's
└── workflows/
    └── webhook-delivery.ts — new, converted from routes/workflows.ts
```

### Files to modify (5)

| File | Change |
|------|--------|
| `apps/relay/package.json` | Remove `@vendor/upstash-workflow`, add `@vendor/inngest` |
| `src/app.ts` | Replace `workflows` import/route with `inngestRoute` |
| `src/env.ts` | Add `INNGEST_*` vars; keep `qstashEnv` and `upstashEnv` |
| `src/routes/webhooks.ts` | Replace `workflowClient.trigger` with `inngest.send` |
| `src/lib/replay.ts` | Replace `workflowClient.trigger` with `inngest.send` |

### Files to delete (1)

| File | Reason |
|------|--------|
| `src/routes/workflows.ts` | Replaced by `src/workflows/webhook-delivery.ts` |

### Test files to rewrite (1)

| File | Reason |
|------|--------|
| `src/routes/workflows.test.ts` | Mocks `@vendor/upstash-workflow/hono`; needs Inngest test approach |

---

## Conversion Details

### 1. `inngest/client.ts` (new)

Mirrors backfill exactly. Event name and schema need defining:

```typescript
import { EventSchemas, Inngest } from "@vendor/inngest";
import type { WebhookReceiptPayload } from "@repo/app-providers";
import { z } from "zod";

const eventsMap = {
  "relay/webhook.received": z.custom<WebhookReceiptPayload>(),
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
});
```

### 2. `routes/inngest.ts` (new)

```typescript
import { serve } from "@vendor/inngest/hono";
import { inngest } from "../inngest/client.js";
import { webhookDelivery } from "../workflows/webhook-delivery.js";

const inngestRoute = new Hono();
inngestRoute.on(["GET", "POST", "PUT"], "/", serve({ client: inngest, functions: [webhookDelivery] }));
export { inngestRoute };
```

### 3. `workflows/webhook-delivery.ts` (new, converted from `routes/workflows.ts`)

The 6 step calls map directly. Upstash uses `ctx.run(name, fn)` on the `WorkflowContext`; Inngest uses `step.run(name, fn)` on the destructured `step` object. The handler signature changes:

```
// UPSTASH WORKFLOW (existing — being removed)
//   WorkflowContext.run(name, fn) — Upstash-specific API
handler: async (ctx) => {
  const data = ctx.requestPayload;           // payload from QStash HTTP body
  const isDuplicate = await ctx.run("dedup", fn);
}

// INNGEST (replacement)
//   step.run(name, fn) — Inngest step API, identical memoization semantics
handler: async ({ event, step }) => {
  const data = event.data;                   // payload from inngest.send()
  const isDuplicate = await step.run("dedup", fn);
}
```

Step names, logic, Redis/DB/QStash calls — unchanged.

The `failureFunction` option has no direct Inngest equivalent at the `createFunction` level. Failure handling in Inngest is done via `onFailure` functions or via the Inngest dashboard.

### 4. `routes/webhooks.ts` — trigger change

```typescript
// Before
import { workflowClient } from "@vendor/upstash-workflow/client";
await workflowClient.trigger({
  url: `${relayBaseUrl}/workflows/webhook-delivery`,
  body: JSON.stringify(workflowPayload),
  headers: { "Content-Type": "application/json" },
});

// After
import { inngest } from "../inngest/client.js";
await inngest.send({
  name: "relay/webhook.received",
  data: workflowPayload,
});
```

### 5. `lib/replay.ts` — trigger change

Same as above: `workflowClient.trigger(...)` → `inngest.send({ name: "relay/webhook.received", data: ... })`.

The Redis dedup key clearing before re-triggering stays — that's not workflow-engine-specific.

### 6. `app.ts` — route swap

```typescript
// Before
import { workflows } from "./routes/workflows.js";
app.route("/api/workflows", workflows);

// After
import { inngestRoute } from "./routes/inngest.js";
app.route("/api/inngest", inngestRoute);
```

### 7. `env.ts` — add Inngest vars

```typescript
// Add to server env
INNGEST_APP_NAME: z.string().min(1).startsWith("lightfast-"),
INNGEST_EVENT_KEY: z.string().min(1).optional(),
INNGEST_SIGNING_KEY: z.string().min(1).startsWith("signkey-").optional(),
```

`qstashEnv` and `upstashEnv` remain — QStash is still used for console ingress publishing, and Redis is still used for dedup + resource cache.

---

## What Stays the Same

| Component | Why unchanged |
|-----------|--------------|
| QStash (`@vendor/qstash`) | Still used in Step 5 for publishJSON to console ingress, and DLQ publishToTopic |
| Redis (`@vendor/upstash`) | Dedup keys + resource→connection cache — both remain |
| DB operations | All Drizzle queries unchanged |
| `admin.ts` all routes | DLQ, replay, delivery-status, health, cache rebuild — untouched |
| Service auth webhook path | Synchronous, no workflow engine involved |
| `X-Backfill-Hold` mechanism | Handled in webhooks.ts directly |
| 6-step logical pipeline | Identical structure, just different step API |
| `admin/delivery-status` as QStash callback | This is the QStash callback URL passed in `publishJSON`, not an Upstash Workflow concern |

---

## Key Behavioral Differences

| Aspect | Upstash Workflow | Inngest |
|--------|-----------------|---------|
| Step memoization | `WorkflowContext.run(name, fn)` — fn skipped on retry if step completed | `step.run(name, fn)` — identical semantics |
| Workflow trigger | `workflowClient.trigger({ url, body })` — HTTP POST via QStash | `inngest.send({ name, data })` — event-based |
| Signature verification | QStash signature (QSTASH_TOKEN) | Inngest signing key (INNGEST_SIGNING_KEY) |
| Callback endpoint | QStash calls back to `/api/workflows/webhook-delivery` | Inngest calls `/api/inngest` |
| Failure handler | `failureFunction` option in `serve()` | `onFailure` function registered separately |
| Dev server | Upstash CLI / QStash dev | Inngest Dev Server (`npx inngest-cli@latest dev`) |
| Retries config | Hardcoded in Upstash serve options | `retries: N` in `createFunction` config |

---

## Test Strategy After Migration

Current `workflows.test.ts` works by:
1. Mocking `@vendor/upstash-workflow/hono`'s `serve` to capture the handler function
2. Creating a mock `context` with `requestPayload` and a `run` mock
3. Calling the captured handler directly

Inngest provides `@inngest/test` (or the function handler can be extracted and tested similarly). The test mock pattern is analogous — instead of capturing from `serve`, you import the handler function directly from the workflow file and invoke it with a mock `step` object.

The existing tests cover:
- Duplicate detection (Step 1 exit)
- Redis cache hit → publish (Steps 1-6)
- Redis cache miss → DB fallthrough → cache populate → publish
- No connection → DLQ path
- External dependency failures at each step
- Step-level retry semantics (memoized vs re-executed steps)
- Complete `WebhookEnvelope` shape assertion
- DB state machine (status transitions)

All these test cases remain relevant and their logic is preserved — only the mock targets change.

---

## Relay-Specific Inngest Naming Suggestion

Following backfill's convention (`apps-backfill/`):

```
INNGEST_APP_NAME: "lightfast-relay"
Events:
  "relay/webhook.received"    — triggers webhook-delivery function
```

---

## Code References

- `apps/relay/src/routes/workflows.ts:1-285` — current Upstash Workflow (6 steps)
- `apps/relay/src/routes/webhooks.ts:169-173` — workflowClient.trigger call (standard path)
- `apps/relay/src/lib/replay.ts:64-75` — workflowClient.trigger call (replay path)
- `apps/relay/src/routes/workflows.test.ts:1-776` — full test suite for current workflow
- `apps/relay/src/app.ts:67` — `/api/workflows` route mount
- `apps/relay/src/env.ts:27-28` — upstashEnv + qstashEnv extends
- `apps/relay/package.json` — `@vendor/upstash-workflow` dependency
- `apps/backfill/src/inngest/client.ts:1-47` — Inngest client pattern
- `apps/backfill/src/routes/inngest.ts:1-19` — Inngest Hono route pattern
- `apps/backfill/src/workflows/backfill-orchestrator.ts:1-328` — `step.run`/`step.invoke` pattern
- `apps/backfill/src/workflows/entity-worker.ts:1-260` — `step.run`/`step.sleep` pattern
- `vendor/upstash-workflow/src/hono.ts:1` — thin re-export of `@upstash/workflow/hono`
- `vendor/upstash-workflow/src/client.ts:1-4` — workflowClient construction
- `vendor/inngest/src/index.ts:1-7` — Inngest re-exports
- `vendor/inngest/src/hono.ts:1` — thin re-export of `inngest/hono`
