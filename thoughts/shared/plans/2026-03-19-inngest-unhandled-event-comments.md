# Inngest Unhandled Event Comments

## Overview

Add comments to all unhandled Inngest events and their send sites so the intent is
clear as `apps/platform` is built out. No schema changes, no handler implementations,
no restructuring — comments only.

## Current State Analysis

Three events are sent but have no registered handler in any app:

| Event | Sender | Handler |
|-------|--------|---------|
| `platform/connection.lifecycle` | `apps/gateway/src/functions/health-check.ts:154,211` | None |
| `platform/webhook.received` | Nobody | None (dead schema — reserved) |
| `backfill/connection.health.check.requested` | `apps/backfill/src/workflows/entity-worker.ts:121` | None |

One event (`backfill/entity.requested`) is declared as a trigger but never sent directly
(orchestrator uses `step.invoke()` instead). This is intentional and documented inline.

The `entity-worker.ts` 401 path already has a clear comment explaining the health-check
signal (lines 118–132). No change needed there beyond a `apps/platform` forward reference.

## Desired End State

Every unhandled event has:
1. An event-level JSDoc block in its schema file explaining: what it represents, who
   sends it, and that the consumer lives in `apps/platform` (future)
2. A `// TODO(apps/platform)` comment at each send site pointing to the intended handler

The `allEvents` merge in `index.ts` gets grouping comments so the namespace breakdown
is visible at a glance.

## What We're NOT Doing

- Splitting schemas per-app
- Implementing handlers
- Removing `platform/webhook.received` (reserved for future Inngest-native webhook path)
- Changing any runtime behaviour

---

## Phase 1: Schema file comments

### Changes Required

#### 1. `packages/inngest/src/schemas/platform.ts`

Add event-level JSDoc above each event key:

```ts
export const platformEvents = {
  /**
   * Fired by `apps/relay` when a webhook is received from a provider.
   *
   * Reserved for a future Inngest-native webhook ingestion path. The current
   * production path routes webhooks through Upstash Workflow instead.
   *
   * @sender  apps/relay (not yet implemented — schema reserved)
   * @handler apps/platform (not yet implemented)
   */
  "platform/webhook.received": z.object({ ... }),

  /**
   * Fired by `apps/gateway` when a connection's auth is permanently revoked
   * (health-check probe returned "revoked"/"suspended", or hit
   * `FAILURE_THRESHOLD_LIFECYCLE` consecutive transient failures).
   *
   * Intended to drive downstream teardown and user-facing notifications in
   * `apps/platform`. No handler is registered yet.
   *
   * @sender  apps/gateway › functions/health-check.ts
   * @handler apps/platform (not yet implemented)
   */
  "platform/connection.lifecycle": z.object({ ... }),
};
```

#### 2. `packages/inngest/src/schemas/backfill.ts`

Add event-level JSDoc above `backfill/connection.health.check.requested`:

```ts
  /**
   * Fired by `apps/backfill` when the entity worker receives a 401 from the
   * gateway proxy, indicating the provider token is definitively revoked (the
   * gateway has already attempted a force-refresh and failed).
   *
   * Intended to allow `apps/platform` to expedite health-check processing and
   * surface the revocation to the user. No handler is registered yet.
   *
   * @sender  apps/backfill › workflows/entity-worker.ts
   * @handler apps/platform (not yet implemented)
   */
  "backfill/connection.health.check.requested": z.object({ ... }),
```

Add event-level JSDoc above `backfill/entity.requested` clarifying `step.invoke()` usage:

```ts
  /**
   * Trigger event for `backfillEntityWorker`.
   *
   * In normal operation the orchestrator starts workers via `step.invoke()`
   * (direct function invocation) rather than sending this event, so no
   * `backfill/entity.requested` event appears on the Inngest event bus during
   * a standard backfill run. The event trigger declaration remains so workers
   * can also be started externally (e.g. admin tooling, replay).
   *
   * @sender  apps/backfill › workflows/backfill-orchestrator.ts (via step.invoke, not send)
   * @handler apps/backfill › workflows/entity-worker.ts
   */
  "backfill/entity.requested": z.object({ ... }),
```

#### 3. `packages/inngest/src/index.ts`

Add grouping comments to the `allEvents` merge:

```ts
// Merged map — all events from all services.
// Each namespace is owned by its respective service; schemas are centralised
// here so every client gets full type coverage for cross-service sends.
//
// Namespace ownership:
//   platform/*  — apps/gateway (sends), apps/platform (handles, future)
//   console/*   — api/console (sends + handles)
//   backfill/*  — apps/backfill (sends + handles), apps/gateway (teardown sends)
export const allEvents = {
  ...platformEvents, // gateway → platform (handler: apps/platform, future)
  ...consoleEvents,  // console → console
  ...backfillEvents, // backfill ↔ backfill (+ gateway teardown)
} as const;
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck` passes (comments must not break types)
- [ ] `pnpm check` passes

#### Manual Verification
- [ ] Schema files read cleanly — JSDoc blocks display correctly in editor hover

---

## Phase 2: Send site comments

### Changes Required

#### 1. `apps/gateway/src/functions/health-check.ts:154` (revoked path)

Replace the existing `// Fire connectionLifecycle event` comment with:

```ts
// Fire platform/connection.lifecycle — signals apps/platform to trigger
// connection teardown and user-facing notifications.
// TODO(apps/platform): implement handler in apps/platform/src/inngest/
await inngest.send({
  name: "platform/connection.lifecycle",
  ...
});
```

#### 2. `apps/gateway/src/functions/health-check.ts:199-211` (unreachable path)

Add comment before the existing `inngest.send` call:

```ts
// After FAILURE_THRESHOLD_LIFECYCLE consecutive failures (~30min), fire lifecycle
// TODO(apps/platform): same handler as revoked path above
await inngest.send({
  name: "platform/connection.lifecycle",
  ...
});
```

#### 3. `apps/backfill/src/workflows/entity-worker.ts:121`

The existing comment block (lines 118–132) already explains the 401 path well.
Append a `TODO` reference after the existing comment:

```ts
// Token is definitively revoked — gateway already attempted forceRefreshToken()
// and failed before returning 401 to us. Fire health-check signal so the
// platform can detect and surface the revocation, then stop immediately.
// TODO(apps/platform): implement handler for backfill/connection.health.check.requested
await step.sendEvent("signal-connection-health-check", {
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm check` passes

---

## References

- Research: `thoughts/shared/research/2026-03-19-repo-inngest-shared-client-schema-analysis.md`
- Schema package: `packages/inngest/src/schemas/`
- Gateway health check: `apps/gateway/src/functions/health-check.ts`
- Entity worker: `apps/backfill/src/workflows/entity-worker.ts`
