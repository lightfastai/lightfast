---
date: 2026-04-05T22:00:00+08:00
researcher: claude
git_commit: 1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa
branch: main
topic: "Observability remaining work inventory — items 1–6"
tags: [research, codebase, observability, parseError, inngest, correlationId, console-cleanup]
status: complete
last_updated: 2026-04-05
---

# Research: Observability Remaining Work Inventory (Items 1–6)

**Date**: 2026-04-05T22:00:00+08:00
**Git Commit**: 1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa
**Branch**: main

## Research Question

Document the current state of items 1–6 from the observability priority list (omitting item 7 / Inngest v4 upgrade): `parseError` adoption sites, provider `console.error` cleanup, Inngest silent catch blocks, Inngest observability middleware, `correlationId` auto-propagation, and client-side console cleanup.

## Summary

Six areas were inventoried. The `parseError` utility exists but has zero import-based call sites — 45 manual `err instanceof Error ? err.message : String(err)` expressions are spread across 25 files. One Sentry provider function uses `console.error` + raw `response.text()` instead of the established `readErrorBody` pattern. Four Inngest catch blocks swallow errors silently (two in `delivery-recovery.ts`, two in `health-check.ts`). No Inngest function runs inside ALS — `InngestMiddleware` is re-exported but never instantiated. `correlationId` is manually threaded through Inngest events but never generated at the webhook ingest entry point and never stored in ALS. Fourteen `console.*` calls exist in `apps/app/src/` across 11 files; 10 are `console.error` captured by Sentry's `captureConsoleIntegration`.

---

## Item 1: `parseError` Adoption

### The Utility

[`vendor/observability/src/error/next.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/observability/src/error/next.ts)

```ts
export const parseError = (error: unknown): string => {
  if (error instanceof Error) { return error.message; }
  if (error && typeof error === "object" && "message" in error) {
    return error.message as string;
  }
  if (typeof error === "string") { return error; }
  return String(error);
};
```

Four-branch resolution (vs two in the manual ternary). Exported via `@vendor/observability/error/next` in `package.json`. Has `import "server-only"` — not usable in client components.

**Current import-based call sites: 0.** The only occurrence of `parseError` as an identifier in production code is a **catch binding variable name** in `apps/platform/src/app/api/ingest/[provider]/route.ts:150` that shadows the utility name — it still uses the manual ternary inline.

### Manual Error Extraction Sites — Complete Inventory (45 sites, 25 files)

| File | Lines | Count | Notes |
|------|-------|-------|-------|
| [`api/app/src/lib/activity.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/app/src/lib/activity.ts) | 162, 167, 258, 263, 341, 380, 386 | 7 | Mixed Form A (`String(err)`) and Form B (`"Unknown error"`) |
| [`api/platform/src/router/platform/backfill.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/router/platform/backfill.ts) | 101, 105, 151, 155, 248, 252 | 6 | Each catch uses expression twice (log + TRPCError) |
| [`api/platform/src/router/platform/proxy.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/router/platform/proxy.ts) | 163, 167, 220, 250 | 4 | |
| [`core/ai-sdk/src/core/primitives/agent.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/core/ai-sdk/src/core/primitives/agent.ts) | 190, 233, 269, 288 | 4 | Custom error class constructors |
| [`api/app/src/router/org/connections.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/app/src/router/org/connections.ts) | 249, 418 | 2 | |
| [`api/app/src/router/user/organization.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/app/src/router/user/organization.ts) | 92, 183 | 2 | |
| [`api/platform/src/inngest/functions/connection-lifecycle.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/connection-lifecycle.ts) | 91, 159 | 2 | |
| [`packages/app-clerk-cache/src/membership.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-clerk-cache/src/membership.ts) | 45, 57 | 2 | |
| [`apps/app/src/app/(api)/v1/answer/[...v]/route.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(api)/v1/answer/[...v]/route.ts) | 117, 208 | 2 | |
| [`api/app/src/inngest/workflow/infrastructure/record-activity.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/app/src/inngest/workflow/infrastructure/record-activity.ts) | 115 | 1 | |
| [`api/app/src/router/user/account.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/app/src/router/user/account.ts) | 49 | 1 | |
| [`api/platform/src/trpc.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/trpc.ts) | 63 | 1 | |
| [`api/platform/src/inngest/functions/token-refresh.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/token-refresh.ts) | 123 | 1 | |
| [`api/platform/src/inngest/functions/platform-backfill-orchestrator.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/platform-backfill-orchestrator.ts) | 205, 316 | 2 | |
| [`api/platform/src/inngest/functions/platform-entity-worker.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/platform-entity-worker.ts) | 147 | 1 | |
| [`api/platform/src/lib/token-store.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/lib/token-store.ts) | 73 | 1 | |
| [`api/platform/src/lib/oauth/callback.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/lib/oauth/callback.ts) | 351 | 1 | |
| [`api/platform/src/router/platform/connections.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/router/platform/connections.ts) | 123 | 1 | |
| [`apps/app/src/app/(early-access)/_actions/early-access.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(early-access)/_actions/early-access.ts) | 301 | 1 | |
| [`apps/app/src/app/(api)/v1/[...rest]/route.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(api)/v1/[...rest]/route.ts) | 36 | 1 | |
| [`apps/app/src/app/(api)/lib/with-api-key-auth.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(api)/lib/with-api-key-auth.ts) | 143 | 1 | |
| [`apps/app/src/app/(api)/lib/orpc-router.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(api)/lib/orpc-router.ts) | 66 | 1 | |
| [`apps/app/src/lib/proxy.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/lib/proxy.ts) | 91 | 1 | |
| [`apps/app/src/components/org-search.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/org-search.tsx) | 143 | 1 | Client component — can't use `parseError` (server-only) |
| [`apps/platform/src/app/api/ingest/[provider]/route.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/platform/src/app/api/ingest/[provider]/route.ts) | 154 | 1 | catch binding named `parseError` |
| [`packages/app-test-data/src/cli/verify-datasets.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-test-data/src/cli/verify-datasets.ts) | 44 | 1 | |
| [`packages/app-test-data/src/raw.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-test-data/src/raw.ts) | 67 | 1 | |
| [`packages/app-config/src/parse.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-config/src/parse.ts) | 89 | 1 | |
| [`packages/app-config/src/glob.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-config/src/glob.ts) | 59 | 1 | |
| [`vendor/mcp/src/index.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/mcp/src/index.ts) | 84 | 1 | |
| [`vendor/pinecone/src/client.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/pinecone/src/client.ts) | 332 | 1 | |

**Blocker for client components**: `parseError` has `import "server-only"` — `org-search.tsx` (client component) cannot import it directly. Would need a separate export path without the server-only guard, or the client component keeps its manual pattern.

---

## Item 2: Provider `console.error` Cleanup

### The Anomaly — `sentry/index.ts:62–68`

[`packages/app-providers/src/providers/sentry/index.ts:62-68`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-providers/src/providers/sentry/index.ts#L62-L68)

```ts
if (!response.ok) {
  const errorBody = await response.text();        // raw .text(), no truncation
  console.error("[sentry] token exchange failed:", {
    status: response.status,
    body: errorBody,
  });
  throw new Error(`Sentry token exchange failed: ${response.status}`);
  // Note: errorBody is NOT in the thrown message
}
```

Two deviations from the established pattern:
1. Uses `response.text()` directly instead of `readErrorBody(response)` (no truncation to 200 chars)
2. Uses `console.error` instead of the `log` abstraction

### The Established Pattern — `readErrorBody`

[`packages/app-providers/src/runtime/http.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-providers/src/runtime/http.ts)

```ts
export async function readErrorBody(response: Response, maxLength = 200): Promise<string> {
  try {
    const text = await response.text();
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch { return ""; }
}
```

Used consistently in 12 call sites across `github/index.ts`, `linear/index.ts`, `vercel/index.ts`, `sentry/index.ts` (auth methods), `github/backfill.ts`, `linear/backfill.ts`. All follow the same shape: `const body = await readErrorBody(response); throw new Error(\`... ${response.status} ${body}\`)`.

### Other `console.error` in Provider Code

[`packages/app-providers/src/runtime/validation.ts:15-22`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/packages/app-providers/src/runtime/validation.ts#L15-L22) — `logValidationErrors()` function uses `console.error` for Zod validation failures on `PostTransformEvent`. This is an exported utility, not an inline call.

---

## Item 3: Inngest Silent Catch Blocks

### Silent Catches (no logging at catch site)

| File | Lines | Pattern | What Happens |
|------|-------|---------|--------------|
| [`delivery-recovery.ts:83-85`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/delivery-recovery.ts#L83-L85) | `catch { }` | No binding, no logging | Swallows `getProvider()` / `extractResourceId()` errors; proceeds with `resourceId = null` |
| [`delivery-recovery.ts:138-140`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/delivery-recovery.ts#L138-L140) | `catch { failed.push(...) }` | No binding, no logging | Outer per-delivery catch; tracks in `failed` array but individual error reason is lost |
| [`health-check.ts:91-95`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/health-check.ts#L91-L95) | `catch { recordTransientFailure(); return; }` | No binding, no logging at site | `recordTransientFailure` logs `log.warn` internally — error reason not included |
| [`health-check.ts:107-110`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/health-check.ts#L107-L110) | `catch { recordTransientFailure(); return; }` | No binding, no logging at site | Same as above — `recordTransientFailure` logs but error itself is discarded |

### Also Notable (no `log.*` but captures error)

| File | Lines | Pattern |
|------|-------|---------|
| [`platform-backfill-orchestrator.ts:308-319`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/api/platform/src/inngest/functions/platform-backfill-orchestrator.ts#L308-L319) | `catch (err)` — error captured into result shape, no `log.*` call at site. Aggregated at function end. |

### The Established Logging Pattern

All Inngest files import `log` from `@vendor/observability/log/next`. The consistent pattern for catch blocks:

```ts
} catch (err) {
  log.warn("[function-tag] description", {
    contextField: value,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

Examples: `connection-lifecycle.ts:86-94`, `token-refresh.ts:117-125`, `platform-backfill-orchestrator.ts:203-208`.

---

## Item 4: Inngest Observability Middleware

### Current State

**Inngest version**: `3.52.6` (`catalog: ^3.52.6`)

**Client setup** (both `api/platform` and `api/app`):
```ts
new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(events),
  middleware: [sentryMiddleware()],   // only middleware
})
```

**`InngestMiddleware`** — re-exported from [`vendor/inngest/src/index.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/inngest/src/index.ts) but **never instantiated** anywhere.

### All 12 Inngest Functions

| # | Function ID | File | Manual Context Logging |
|---|-------------|------|----------------------|
| 1 | `platform/ingest.delivery` | `ingest-delivery.ts:29` | Mid-function log only |
| 2 | `platform/event.store` | `platform-event-store.ts:76` | Mid-function log only |
| 3 | `platform/entity.graph` | `platform-entity-graph.ts:17` | Mid-function log only |
| 4 | `platform/entity.embed` | `platform-entity-embed.ts:50` | Start log only |
| 5 | `platform/notification.dispatch` | `platform-notification-dispatch.ts:7` | No bookends |
| 6 | `platform/backfill.orchestrator` | `platform-backfill-orchestrator.ts:31` | Start + end logs |
| 7 | `platform/backfill.entity-worker` | `platform-entity-worker.ts:31` | Start + end logs |
| 8 | `platform/connection.lifecycle` | `connection-lifecycle.ts:30` | Start + end logs |
| 9 | `platform/health.check` | `health-check.ts:26` | Start log only |
| 10 | `platform/token.refresh` | `token-refresh.ts:26` | Start log only |
| 11 | `platform/delivery.recovery` | `delivery-recovery.ts:20` | Start + end logs |
| 12 | `app/record-activity` | `record-activity.ts:27` | Start log only |

No function calls `withRequestContext` or `requestStore.run()`. All context fields (`correlationId`, `installationId`, `provider`, etc.) are manually passed in every `log.*` call.

### ALS / requestStore Architecture

- **Definition**: [`vendor/observability/src/context.ts:28`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/observability/src/context.ts#L28) — `AsyncLocalStorage<RequestStore>` with `ctx: RequestContext` and `journal: JournalEntry[]`
- **Entry point**: [`vendor/observability/src/request.ts:17`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/observability/src/request.ts#L17) — `withRequestContext(ctx, fn)` wraps `fn` in `requestStore.run()`
- **Consumer**: [`vendor/observability/src/trpc.ts:41`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/observability/src/trpc.ts#L41) — `createObservabilityMiddleware` calls `withRequestContext` with `{ requestId, traceId, ...authFields }`
- **Log enrichment**: [`vendor/observability/src/log/next.ts:16-17`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/vendor/observability/src/log/next.ts#L16-L17) — every `log.*` call merges `getContext()` from the ALS store

For Inngest functions, `getContext()` returns `{}` (empty fallback) because no ALS scope is active.

---

## Item 5: `correlationId` Auto-Propagation

### Generation

**`correlationId` is never generated inside the codebase.** There is no `nanoid()` or `crypto.randomUUID()` call that produces a correlationId. It arrives as caller-supplied input at two entry points:

1. **Webhook ingest route** (`apps/platform/src/app/api/ingest/[provider]/route.ts:180`) — `inngest.send()` call does **not include** `correlationId`. For all real incoming webhooks, `correlationId` is `undefined` throughout the entire neural pipeline.

2. **tRPC `backfill.trigger`** (`api/platform/src/router/platform/backfill.ts:84`) — passes `input.correlationId` from the caller. Present only if the caller supplies it.

### Propagation Chain

```
webhook → ingest route (correlationId: ABSENT)
  └→ platform/webhook.received
    └→ ingest-delivery → platform/event.capture (correlationId: data.correlationId — undefined)
      └→ event-store → platform/entity.upserted (correlationId: passed through)
                      → platform/event.stored (correlationId: NOT IN SCHEMA)
        └→ entity-graph → platform/entity.graphed (correlationId: passed through)
          └→ entity-embed (terminal — no outbound events)

backfill.trigger (correlationId: input.correlationId — caller-supplied)
  └→ platform/backfill.run.requested
    └→ orchestrator → step.invoke(entity-worker) with correlationId
                    → inngest.send(platform/webhook.received) with correlationId
      └→ entity-worker → platform/health.check.requested with correlationId
```

### Gaps in Current Propagation

- `platform/event.stored` schema at `platform.ts:73-78` has **no `correlationId` field**
- `connection-lifecycle.ts:77` sends `platform/backfill.run.cancelled` with **no `correlationId`**
- Standard webhook path always has `correlationId: undefined`

### Relationship to ALS

`correlationId` is **not in the ALS store**. The tRPC middleware stores `{ requestId, traceId, ...authFields }` — no `correlationId`. All Inngest logging of `correlationId` is manual field-passing in every `log.*` call.

---

## Item 6: Client-Side Console Cleanup

### All `console.*` Calls in `apps/app/src/` (14 calls, 11 files)

| File | Line | Method | Context | Sentry Captured? |
|------|------|--------|---------|------------------|
| [`team-general-settings-client.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx#L93) | 93 | `console.error` | Client — setActiveOrg failure | Yes |
| [`link-sources-button.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx#L39) | 39 | `console.error` | Client — tRPC mutation onError | Yes |
| [`[slug]/layout.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(org)/[slug]/layout.tsx#L59) | 59 | `console.debug` | Server layout — org access denied | No (debug not in levels) |
| [`invite-teammates.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts#L44) | 44 | `console.log` | Server action — mock invitation | No (log not in levels) |
| [`(early-access)/error.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(early-access)/error.tsx#L32) | 32 | `console.error` | Client error boundary | Yes (also calls `captureException`) |
| [`(auth)/error.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/error.tsx#L30) | 30 | `console.error` | Client error boundary | Yes (also calls `captureException`) |
| [`api/gateway/stream/route.ts`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/api/gateway/stream/route.ts#L108) | 108 | `console.error` | API route (server) | Yes |
| [`jobs-table.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/jobs-table.tsx#L104) | 104 | `console.log` | Client — cancel stub | No (log not in levels) |
| [`answer-interface.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/answer-interface.tsx#L74) | 74 | `console.error` | Client — sendMessage failure | Yes |
| [`page-error-boundary.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/errors/page-error-boundary.tsx#L39-L40) | 39, 40 | `console.error` ×2 | Client error boundary class | Yes (no explicit Sentry call) |
| [`org-page-error-boundary.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/errors/org-page-error-boundary.tsx#L54-L55) | 54, 55 | `console.error` ×2 | Client error boundary class | Yes (no explicit Sentry call) |

### Sentry `captureConsoleIntegration` Config

Both client ([`instrumentation-client.ts:54-56`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/instrumentation-client.ts#L54-L56)) and server ([`instrumentation.ts:14`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/instrumentation.ts#L14)):

```ts
captureConsoleIntegration({ levels: ["error", "warn"] })
```

All `console.error` calls are captured by Sentry. `console.log` and `console.debug` calls are not.

### Client-Side Logger

No client-side logger exists in `@vendor/observability`. The `log` object in `vendor/observability/src/log/next.ts` has `import "server-only"`. No client-side alternative is exported.

---

## Code References

### Item 1 — parseError
- `vendor/observability/src/error/next.ts:3-10` — utility definition
- 45 manual sites across 25+ files (see table above)

### Item 2 — Provider console.error
- `packages/app-providers/src/providers/sentry/index.ts:62-68` — the anomalous `console.error` + `response.text()`
- `packages/app-providers/src/runtime/http.ts:1-15` — `readErrorBody` implementation
- `packages/app-providers/src/runtime/validation.ts:15-22` — `logValidationErrors` console.error

### Item 3 — Silent catches
- `api/platform/src/inngest/functions/delivery-recovery.ts:83,138` — silent swallows
- `api/platform/src/inngest/functions/health-check.ts:91,107` — silent swallows (delegate to `recordTransientFailure`)

### Item 4 — Inngest middleware
- `api/platform/src/inngest/client.ts` — platform client with `sentryMiddleware()` only
- `vendor/inngest/src/index.ts` — re-exports `InngestMiddleware` (unused)
- `vendor/observability/src/context.ts:28` — `requestStore` ALS
- `vendor/observability/src/request.ts:17` — `withRequestContext`
- `vendor/observability/src/trpc.ts:41` — tRPC ALS consumer (reference pattern)

### Item 5 — correlationId
- `packages/app-providers/src/contracts/wire.ts:16,40` — schema definitions
- `apps/platform/src/app/api/ingest/[provider]/route.ts:180` — webhook entry (no correlationId)
- `api/platform/src/router/platform/backfill.ts:84` — backfill entry (caller-supplied)

### Item 6 — Console cleanup
- `apps/app/src/instrumentation-client.ts:54-56` — Sentry console integration
- 14 calls across 11 files (see table above)

## Related Research

- [`thoughts/shared/research/2026-04-05-observability-architecture-complete-state.md`](thoughts/shared/research/2026-04-05-observability-architecture-complete-state.md) — Full observability architecture documentation
- [`thoughts/shared/research/2026-04-05-platform-logging-gaps.md`](thoughts/shared/research/2026-04-05-platform-logging-gaps.md) — Platform logging gap analysis
- [`thoughts/shared/research/2026-04-05-logging-error-handling-architecture.md`](thoughts/shared/research/2026-04-05-logging-error-handling-architecture.md) — Logging and error handling architecture

## Open Questions — Resolved

1. **`parseError` client-safe export?** — **No change needed.** The `server-only` guard is fine. The one client component (`org-search.tsx`) keeps its manual ternary.

2. **Generate `correlationId` at webhook ingest?** — **Yes.** Add `nanoid()` at `apps/platform/src/app/api/ingest/[provider]/route.ts:180` so every webhook-triggered pipeline chain is traceable. Currently no ID-generation import exists in the file — `nanoid` would need to be added. The `platform/webhook.received` schema already accepts `correlationId: z.string().optional()` at `platform.ts:64`, so only the emit site changes.

3. **Add `correlationId` to `platform/event.stored` schema?** — **Yes.** It's the only event in the pipeline that omits it. Both the schema (`platform.ts:73-78`) and the emit site (`platform-event-store.ts:536-544`) need updating. The consumer `platform/notification.dispatch` would then have correlation context for its Knock trigger logs.

4. **Error boundaries + explicit `captureException`?** — **Defer.** Error boundaries are slated for a complete rework. `captureConsoleIntegration` is sufficient in the interim.
