---
date: 2026-03-16T11:30:00+11:00
researcher: claude
git_commit: ccea146841e17dc61f000058c9104ccf5c1ab736
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Inngest poll log bloat — where logging fires and how to suppress it"
tags: [research, codebase, inngest, logging, lifecycle, backfill, console, hono, nextjs]
status: complete
last_updated: 2026-03-16
---

# Research: Inngest poll log bloat — where logging fires and how to suppress it

**Date**: 2026-03-16T11:30:00+11:00
**Git Commit**: `ccea146841e17dc61f000058c9104ccf5c1ab736`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Inngest constantly "pings" `PUT /api/inngest` and causes log bloat in both:
- `@lightfast/backfill` — the Hono service at `apps/backfill`
- `@lightfast/console` — the Next.js app at `apps/console` (through `api/console`)

The goal is to understand exactly where those logs originate so they can be suppressed.

## Summary

Two completely separate logging mechanisms produce the two log lines. They have different root causes and require different fixes.

| Layer | Log line | Source | Mechanism |
|---|---|---|---|
| Backfill (Hono) | `>>> PUT /api/inngest 200 306ms from service [...]` | `apps/backfill/src/middleware/lifecycle.ts:77-83` | Custom `lifecycle` Hono middleware — logs every request unconditionally |
| Console (Next.js) | `PUT /api/inngest 200 in 20ms (compile: 5ms, proxy.ts: 6ms, render: 9ms)` | Next.js 16.1.6 internal dev server | Built-in `logRequests()` in `next-dev-server.js` — no application code involved |

---

## Detailed Findings

### 1. Backfill — `lifecycle` Hono Middleware

**File**: `apps/backfill/src/middleware/lifecycle.ts`

The `lifecycle` middleware is registered as the second middleware in backfill's Hono app (`apps/backfill/src/app.ts:25`), after `requestId` and before `errorSanitizer`. Every HTTP request to the service passes through it unconditionally.

**Timing start** (`lifecycle.ts:45`):
```ts
const start = Date.now();
```

**Dev-only artificial delay** (`lifecycle.ts:48-51`):
A random 100-500ms sleep is injected *before* `next()` in development. This is why the `duration_ms` in the Inngest poll logs reads 100-500ms instead of <10ms.

**The `finally` block is where logging fires** (`lifecycle.ts:60-114`):

- **Line 77-84** — Dev human-readable line:
  ```ts
  const prefix = (entry.status as number) >= 400 ? "!!!" : ">>>";
  let line = `${prefix} ${c.req.method} ${c.req.path} ${entry.status} ${duration}ms from ${source} [${c.get("requestId")}]`;
  console.log(line);
  ```
  This produces: `>>> PUT /api/inngest 200 306ms from service [t3YRmqOv0mhv4isnZ0ffm]`

- **Line 92** — Structured BetterStack log (no-op in dev unless token is set):
  ```ts
  log[level](`${c.req.method} ${c.req.path}`, entry);
  ```
  This produces the second log block (the JSON object with `service`, `requestId`, etc.)

- **Line 95-104** — Sentry breadcrumb (fires on every request, including polls).

**No path-based filtering exists** anywhere in `lifecycle.ts` or the Hono app. Every request that reaches the Hono process — including the health check `GET /` — generates a full log entry.

**Same middleware, same issue** in relay (`apps/relay/src/middleware/lifecycle.ts`) and gateway (`apps/gateway/src/middleware/lifecycle.ts`). The three `lifecycle.ts` files are structurally identical.

**Fix location**: Add a path guard at the top of the `lifecycle` middleware body, before `start = Date.now()`, to call `await next()` and `return` immediately for Inngest poll paths, skipping timing, logging, Sentry breadcrumbs, and the artificial dev delay.

```ts
// Skip logging for Inngest polling — suppress log bloat
if (c.req.path === "/api/inngest" && c.req.method === "PUT") {
  return next();
}
```

This can be placed at `lifecycle.ts:43` (immediately after the opening of the middleware function, before `c.set("logFields", {})`).

---

### 2. Console (Next.js) — Built-in Dev Server Logging

**Route handler**: `apps/console/src/app/(inngest)/api/inngest/route.ts`

The `(inngest)` route group is a Next.js parenthesized group (invisible in the URL). The file exports `GET`, `POST`, and `PUT` handlers at lines 19, 29, and 39 via `createInngestRouteContext()` (`api/console/src/inngest/index.ts:26-38`), which wraps `serve()` from `inngest/next`.

**The log line is 100% Next.js 16.1.6 internals — no application code is involved.**

The three timing segments in the log line correspond to three timestamp markers set by Next.js:

| Segment | Value | Set by | What it measures |
|---|---|---|---|
| `compile` | ~5ms | `app-route.js:127` | Framework boot to route handler entry |
| `proxy.ts` | ~6ms | `resolve-routes.js:326,352` | Time in `apps/console/src/middleware.ts` (Clerk) |
| `render` | ~9ms | computed in `log-requests.js:85-88` | Inngest handler execution time |
| `in Xms` (total) | ~20ms | `next-dev-server.js:351-353` | Full wall-clock request duration |

**`proxy.ts` is a hardcoded string in Next.js source** (`log-requests.js:63`) — it is not a reference to any file in this repo.

**How the log is emitted** (`log-requests.js:117-119`):
```js
process.stdout.write(` ${text}\n`);
```
It writes directly to `process.stdout` — not via `console.log` — so there is no way to intercept it via `console` monkey-patching.

**The gate** (`next-dev-server.js:348`):
```js
if (loggingConfig !== false) { ... }
```
Setting `logging: false` in `next.config.ts` passes `false` as `loggingConfig` and completely disables all dev request logging for the console app.

**`apps/console/next.config.ts` currently has no `logging` key** — Next.js defaults to logging enabled.

**Fix options for console:**

Option A — Disable all dev request logging:
```ts
// apps/console/next.config.ts
const config: NextConfig = withSentry(withBetterStack(mergeNextConfig(vendorConfig, {
  logging: false,  // suppress all dev request logs
  // ... rest of config
})));
```
This eliminates all `PUT /api/inngest` noise but also removes logs for all other routes.

Option B — Use `logging.incomingRequests.ignore` (Next.js 15.2+):
Next.js 15.2 introduced a `logging.incomingRequests.ignore` config that accepts regex patterns. Since this repo is on Next.js 16.1.6, this option should be available:
```ts
logging: {
  incomingRequests: {
    ignore: [/^\/api\/inngest$/],
  },
},
```
This would suppress only the Inngest polling logs while preserving all other route logs. **Verify this option exists in Next.js 16.x by checking `node_modules/next` types or changelog before using it.**

---

## Code References

| File | Lines | Role |
|---|---|---|
| `apps/backfill/src/middleware/lifecycle.ts` | 43-115 | Hono middleware — entire logging implementation |
| `apps/backfill/src/middleware/lifecycle.ts` | 45 | `start = Date.now()` — timing capture |
| `apps/backfill/src/middleware/lifecycle.ts` | 48-51 | Dev artificial delay (included in `duration_ms`) |
| `apps/backfill/src/middleware/lifecycle.ts` | 60-114 | `finally` block — all log emissions |
| `apps/backfill/src/middleware/lifecycle.ts` | 77-83 | Dev human-readable `>>> PUT ...` line |
| `apps/backfill/src/middleware/lifecycle.ts` | 92 | Structured BetterStack log |
| `apps/backfill/src/middleware/lifecycle.ts` | 95-104 | Sentry breadcrumb |
| `apps/backfill/src/app.ts` | 24-27 | Middleware registration order |
| `apps/relay/src/middleware/lifecycle.ts` | — | Identical structure to backfill lifecycle |
| `apps/gateway/src/middleware/lifecycle.ts` | — | Identical structure to backfill lifecycle |
| `apps/console/src/app/(inngest)/api/inngest/route.ts` | 19,29,39 | Route handler exporting GET/POST/PUT for Inngest |
| `api/console/src/inngest/index.ts` | 26-38 | `createInngestRouteContext()` wrapping `inngest/next serve()` |
| `apps/console/src/middleware.ts` | ~30 | `/api/inngest` declared public route (no Clerk auth check) |
| `apps/console/next.config.ts` | — | No `logging` key — defaults to all dev logging enabled |
| `vendor/observability/src/service-log.ts` | 27-29 | `shouldShip` gate — only sends to BetterStack in prod/preview |

## Architecture Documentation

### Why Inngest polls so frequently

Inngest's dev server (running via `pnpm dev:app`) sends `PUT /api/inngest` every 5 seconds to sync function definitions. In production, this sync is infrequent. In development, the Inngest dev server is constantly checking both the console app and the backfill service, producing two log entries per poll (one per service).

### Why Backfill gets polled too

`api/console/src/inngest/index.ts` registers 5 workflow functions in the console app. The backfill service (`apps/backfill`) also has its own Inngest registration (`apps/backfill/src/routes/inngest.ts` or similar). Both endpoints are discovered by the dev server, so both get polled.

### Dev delay amplifies the noise

The artificial 100-500ms delay in `lifecycle.ts:48-51` means each Inngest poll that should take <5ms instead takes 100-500ms in development. This makes the logs appear more "heavy" than the actual work being done.

## Open Questions

- Does Next.js 16.x support `logging.incomingRequests.ignore`? Check the Next.js 16 changelog or `NextConfig` TypeScript types before using Option B.
- Should the path guard in backfill's `lifecycle.ts` also skip the artificial dev delay? (Currently the delay fires before any path check, so yes — the guard should go before the delay to be effective.)
- Should relay and gateway get the same path guard? They also have identical `lifecycle.ts` implementations, though they may not have `/api/inngest` routes registered.
