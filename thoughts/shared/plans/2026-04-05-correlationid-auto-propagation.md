# correlationId Auto-Propagation Implementation Plan

## Overview

Generate a `correlationId` at the webhook ingest entry point so every webhook-triggered pipeline chain is traceable end-to-end. Close the two propagation gaps: the `platform/event.stored` schema (missing `correlationId`) and the `connection-lifecycle.ts` emit of `platform/backfill.run.cancelled` (omits `correlationId`).

## Current State Analysis

`correlationId` is an optional string threaded through Inngest events as a distributed tracing token. It enters from two sources:

1. **Backfill tRPC** (`api/platform/src/router/platform/backfill.ts:94`) — caller-supplied, fully propagated through the backfill pipeline.
2. **Webhook ingest** (`apps/platform/src/app/api/ingest/[provider]/route.ts:180`) — **never generated**. Every webhook-triggered pipeline runs with `correlationId: undefined`.

### Gaps

| Gap | Location | Impact |
|-----|----------|--------|
| No generation at webhook entry | `route.ts:180` | All live webhook pipelines untraceable |
| `platform/event.stored` schema missing field | `platform.ts:73-78` | Notification dispatch has no correlation context |
| `platform-event-store.ts` emit omits field | `platform-event-store.ts:536-544` | Even when `correlationId` exists in scope, it's dropped at this emit |
| `connection-lifecycle.ts` emit omits field | `connection-lifecycle.ts:80-82` | Backfill cancellation loses trace context from the triggering lifecycle event |
| `platform-notification-dispatch.ts` doesn't log it | `platform-notification-dispatch.ts` | Even once available, not included in log calls |

### Key Discoveries

- `correlationId` is already in scope in `platform-event-store.ts` (destructured at line 116) — the `event.stored` emit just doesn't include it.
- `connection-lifecycle.ts` destructures `installationId` and `provider` from `event.data` (line 44) but not `correlationId` — the schema already supports it (`platform.ts:48`).
- `@repo/lib` exports a custom `nanoid` (used in `health-check.ts:16`, `oauth/authorize.ts:9`).
- The ingest route already imports `parseError` from `@vendor/observability` — `nanoid` from `@repo/lib` is a clean addition.
- Cron-originated paths (`delivery-recovery`, `health-check`) have no `correlationId` by nature — not in scope.

## Desired End State

- Every webhook-triggered pipeline has a `correlationId` generated at the ingest entry point.
- `correlationId` propagates through the entire pipeline including `platform/event.stored` → `platform/notification.dispatch`.
- `connection-lifecycle` forwards its `correlationId` (when present) to `platform/backfill.run.cancelled`.
- All consumer functions that receive `correlationId` include it in their log calls.

### Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm build:platform` succeeds

## What We're NOT Doing

- Generating `correlationId` for cron-originated paths (`delivery-recovery`, `health-check`, `token-refresh`) — these aren't part of a webhook pipeline trace.
- Storing `correlationId` in ALS — that's Item 4 (Inngest observability middleware), a separate follow-up.
- Adding `correlationId` to `platform/connection.lifecycle` emits from `health-check.ts` — cron-originated, no trace context exists.

## Phase 1: Schema + Generation [DONE]

### Overview

Add `correlationId` to the `platform/event.stored` schema and generate a `nanoid()` at the webhook ingest entry point.

### Changes Required

#### 1. Add `correlationId` to `platform/event.stored` schema

**File**: `api/platform/src/inngest/schemas/platform.ts`

```ts
// BEFORE (lines 73-78)
"platform/event.stored": z.object({
  clerkOrgId: z.string(),
  eventExternalId: z.string(),
  sourceType: z.string(),
  significanceScore: z.number(),
}),
```

```ts
// AFTER
"platform/event.stored": z.object({
  clerkOrgId: z.string(),
  eventExternalId: z.string(),
  sourceType: z.string(),
  significanceScore: z.number(),
  correlationId: z.string().optional(),
}),
```

#### 2. Generate `correlationId` at webhook ingest

**File**: `apps/platform/src/app/api/ingest/[provider]/route.ts`

Add import:
```ts
import { nanoid } from "@repo/lib";
```

Update `inngest.send()` at line 180:
```ts
// BEFORE (lines 180-191)
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
  },
});
```

```ts
// AFTER
const correlationId = nanoid();

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
```

Also add `correlationId` to the log call at line 193:
```ts
// BEFORE
log.info("[ingest] webhook received", {
  provider: providerSlug,
  deliveryId,
  eventType,
  resourceId,
});
```

```ts
// AFTER
log.info("[ingest] webhook received", {
  provider: providerSlug,
  deliveryId,
  eventType,
  resourceId,
  correlationId,
});
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

---

## Phase 2: Emit Site Fixes + Consumer Logging [DONE]

### Overview

Thread `correlationId` through the remaining emit gaps and add it to consumer log calls.

### Changes Required

#### 1. `platform-event-store.ts` — include `correlationId` in `event.stored` emit

**File**: `api/platform/src/inngest/functions/platform-event-store.ts`

```ts
// BEFORE (lines 536-544)
await step.sendEvent("emit-event-stored", {
  name: "platform/event.stored" as const,
  data: {
    clerkOrgId,
    eventExternalId: observation.externalId,
    sourceType: sourceEvent.eventType,
    significanceScore: significance.score,
  },
});
```

```ts
// AFTER
await step.sendEvent("emit-event-stored", {
  name: "platform/event.stored" as const,
  data: {
    clerkOrgId,
    eventExternalId: observation.externalId,
    sourceType: sourceEvent.eventType,
    significanceScore: significance.score,
    correlationId,
  },
});
```

`correlationId` is already destructured from `event.data` at line 116 — no new variable needed.

#### 2. `connection-lifecycle.ts` — forward `correlationId` in `backfill.run.cancelled` emit

**File**: `api/platform/src/inngest/functions/connection-lifecycle.ts`

Update destructuring at line 44:
```ts
// BEFORE
const { installationId, provider: providerName } = event.data;
```

```ts
// AFTER
const { installationId, provider: providerName, correlationId } = event.data;
```

Update `inngest.send()` at line 78-83:
```ts
// BEFORE
await inngest.send({
  name: "platform/backfill.run.cancelled",
  data: {
    installationId,
  },
});
```

```ts
// AFTER
await inngest.send({
  name: "platform/backfill.run.cancelled",
  data: {
    installationId,
    correlationId,
  },
});
```

#### 3. `platform-notification-dispatch.ts` — add `correlationId` to destructuring and logs

**File**: `api/platform/src/inngest/functions/platform-notification-dispatch.ts`

Update destructuring at line 17-18:
```ts
// BEFORE
const { clerkOrgId, eventExternalId, sourceType, significanceScore } =
  event.data;
```

```ts
// AFTER
const { clerkOrgId, eventExternalId, sourceType, significanceScore, correlationId } =
  event.data;
```

Add `correlationId` to all three log calls:

Line 21-25 (below threshold):
```ts
log.info("[notification-dispatch] below threshold, skipping", {
  clerkOrgId,
  eventExternalId,
  significanceScore,
  correlationId,
});
```

Line 37-39 (Knock not configured):
```ts
log.info("[notification-dispatch] Knock not configured, skipping", {
  clerkOrgId,
  eventExternalId,
  correlationId,
});
```

Line 54-58 (triggered):
```ts
log.info("[notification-dispatch] Knock notification triggered", {
  clerkOrgId,
  eventExternalId,
  significanceScore,
  correlationId,
});
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm build:platform` succeeds

## References

- Research: `thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md` — Item 5
- Schema file: `api/platform/src/inngest/schemas/platform.ts`
- Webhook ingest: `apps/platform/src/app/api/ingest/[provider]/route.ts`
- Event store: `api/platform/src/inngest/functions/platform-event-store.ts`
- Connection lifecycle: `api/platform/src/inngest/functions/connection-lifecycle.ts`
- Notification dispatch: `api/platform/src/inngest/functions/platform-notification-dispatch.ts`
