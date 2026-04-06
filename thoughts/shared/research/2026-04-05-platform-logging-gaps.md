---
date: 2026-04-05T00:00:00+00:00
researcher: claude
git_commit: 49b1745f8253dd50feff86d7d7db1f8b95628480
branch: main
topic: "Logging gaps in apps/platform — critical blind spots in the data plane"
tags: [research, codebase, observability, logging, platform, betterstack]
status: complete
last_updated: 2026-04-05
---

# Research: Platform Logging Gaps — Critical Blind Spots

**Date**: 2026-04-05
**Git Commit**: `49b1745f8`
**Branch**: main

## Research Question

What are the logging gaps across critical paths in `apps/platform` / `api/platform`, and which are most important to fix right now?

## Summary

The platform service has 17 files that import the structured logger (`@vendor/observability/log/next`). Zero `console.*` calls exist — this is clean. But **the entire data plane** (proxy, token vault, backfill estimation) and **all three tRPC router files** have no logger at all. The result: when something breaks in production — like the `token_error: GitHub installation token request failed: 401` we just saw — there's almost no structured telemetry to diagnose it. The error message reaches Sentry via the tRPC `onError` handler, but without the surrounding context (which installation, which provider, what token path was taken, what GitHub actually said in the response body).

## Severity Tiers

### TIER 1 — Fix now (blind in production today)

These are the paths that broke in the `token_error: 401` incident and would break again without any additional diagnostic information.

#### 1.1 `proxy.ts` — The entire data plane is unlogged

[`api/platform/src/router/memory/proxy.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/router/memory/proxy.ts)

No logger imported. Every provider API call flows through `proxy.execute`. Today it:
- Acquires a token (line 146-165) — no log of which token path was taken (`buildAuth` vs `getActiveTokenForInstallation`)
- Makes an outbound `fetch()` to a provider API (line 203) — no log of URL, method, or response status
- Handles 401 retry (line 205-228) — no log that a retry was attempted or whether the fresh token differed
- Silently swallows `buildAuth` failure on retry (line 208-211) — `catch {}` with comment "ignore"
- Returns raw response (line 238-242) — no log of final status

**What this costs**: The `token_error: 401` in production surfaced as a tRPC error message with no context about which installation, which endpoint, whether a retry was attempted, or what GitHub's response body said. The only log entry comes from the tRPC `onError` handler in `apps/platform/src/app/api/trpc/[trpc]/route.ts:43-52`, which logs `error.message` and `path` — but `path` is just `"proxy.execute"` and `message` is the sanitized `"An unexpected error occurred"` in production (because `errorFormatter` at `trpc.ts:87-91` strips `INTERNAL_SERVER_ERROR` messages).

**What to log**:
- Token acquisition: `{ installationId, provider, tokenPath: "buildAuth" | "installation", durationMs }`
- Outbound fetch: `{ provider, endpointId, method, url (redacted), status, durationMs }`
- 401 retry: `{ provider, installationId, retryAttempted: boolean, freshTokenDiffered: boolean, retryStatus }`
- Token error: `{ provider, installationId, endpointId, error: err.message }` (log BEFORE wrapping in TRPCError)

#### 1.2 `token-helpers.ts` — Silent catch blocks hide token failures

[`api/platform/src/lib/token-helpers.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/lib/token-helpers.ts)

No logger imported. Two silent `catch {}` blocks in `forceRefreshToken()`:

- **Line 111-113**: OAuth `refreshToken()` fails → swallowed, falls through to `getActiveToken`. No record of what refresh error occurred (expired refresh token? provider API down? decryption failure?).
- **Line 125-127**: `getActiveToken()` fallback fails → returns `null`. Caller receives `null` and skips the 401 retry entirely. No record that the entire token refresh pipeline failed or why.

**What this costs**: When `forceRefreshToken` returns `null`, the proxy's 401 retry at `proxy.ts:223` silently doesn't execute (`freshToken` is `null`). From the outside it looks like "no retry was attempted" but actually the retry *was* attempted and failed — invisibly.

#### 1.3 `getInstallationToken` — GitHub's error response body is discarded

[`packages/app-providers/src/providers/github/index.ts:61-64`](https://github.com/lightfastai/lightfast/blob/49b1745f8/packages/app-providers/src/providers/github/index.ts#L61-L64)

```typescript
if (!response.ok) {
  throw new Error(`GitHub installation token request failed: ${response.status}`);
}
```

The response body — which contains GitHub's actual error reason (e.g. `"The installation has been suspended"`, `"A JSON web token could not be decoded"`, `"Bad credentials"`) — is thrown away. The status code alone (`401`) doesn't distinguish between a revoked installation, a rotated private key, or a malformed JWT.

This isn't a logging gap per se (it's an error message gap), but it's the single most impactful change for diagnosing the exact incident that prompted this investigation.

### TIER 2 — Fix soon (operational visibility)

These are paths where failures are recoverable but undiagnosable.

#### 2.1 `connections.ts` router — Token vault and disconnect unlogged

[`api/platform/src/router/memory/connections.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/router/memory/connections.ts)

No logger imported. Critical unlogged operations:

- **`getToken` (line 71-144)**: The token vault endpoint. On the error path (line 122-143), errors are re-mapped to `TRPCError` variants but not logged before re-throwing. Unexpected errors become `INTERNAL_SERVER_ERROR` with no structured log entry.
- **`disconnect` (line 151-202)**: Writes a lifecycle log to DB and fires an Inngest event. If either fails, the error propagates with no log at the point of failure.
- **`getAuthorizeUrl` (line 208-233)**: Starts the OAuth flow. No log of which provider/org is initiating.

#### 2.2 `backfill.ts` router — Estimate probes fail silently

[`api/platform/src/router/memory/backfill.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/router/memory/backfill.ts)

No logger imported. Two silent catches in `estimate`:

- **Line 254-264**: `resolveResourceMeta()` failure → resource silently skipped. For GitHub/Sentry (where resource name is required for routing), this means entire repositories are excluded from estimates with no trace.
- **Line 367-376**: Probe job `fetch()` / `processResponse()` failure → returns `returnedCount: -1` silently. The estimate response includes `-1` counts but no indication of *why* the probe failed.

Also: `trigger` (line 83-101) and `cancel` (line 133-146) catch Inngest dispatch failures and re-throw as `TRPCError` but don't log before re-throwing.

#### 2.3 `token-store.ts` — Encrypt + DB writes for the token vault, unlogged

[`api/platform/src/lib/token-store.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/lib/token-store.ts)

No logger imported. Two functions:

- **`writeTokenRecord` (line 12-49)**: Encrypts tokens, upserts into `gatewayTokens`. Called after every OAuth callback. Neither success nor failure produces a log entry.
- **`updateTokenRecord` (line 79-116)**: Encrypts new access token, validates existing refresh token format via `assertEncryptedFormat()`, updates DB. Called during proactive cron refresh and on-demand refresh.

If encryption fails, the `assertEncryptedFormat` guard (line 59-71) throws a descriptive error that propagates — but because no logger is imported, there's no log at the detection point.

#### 2.4 `oauth/state.ts` — All Redis operations unlogged

[`api/platform/src/lib/oauth/state.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/lib/oauth/state.ts)

No logger imported. Four Redis operations underpinning the entire OAuth flow:

- `storeOAuthState` (line 24-40) — HSET + EXPIRE pipeline
- `consumeOAuthState` (line 48-63) — atomic HGETALL + DEL (MULTI/EXEC)
- `storeOAuthResult` (line 78-99) — HSET + EXPIRE pipeline
- `getOAuthResult` (line 107-111) — HGETALL poll

Any Redis failure surfaces as a propagated exception caught by the route handler — but without a log at the Redis operation level, you can't distinguish "Redis is down" from "state key expired" from "MULTI/EXEC failed" without checking Redis logs separately.

### TIER 3 — Nice to have (Inngest catch blocks)

These files already import the logger but have specific catch blocks that discard the error object.

#### 3.1 `health-check.ts` — Error objects discarded in catch blocks

[`api/platform/src/inngest/functions/health-check.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/inngest/functions/health-check.ts)

Logger IS imported. But:

- **Line 91-94**: `getActiveTokenForInstallation()` failure → calls `recordTransientFailure()` (which logs `"transient failure recorded"`) but discards the error object. The log says "it failed" but not "why".
- **Line 107-110**: `healthCheck.check()` failure → same pattern. The error (network timeout? DNS failure? 5xx?) is discarded.

#### 3.2 `delivery-recovery.ts` — Failed deliveries not individually logged

[`api/platform/src/inngest/functions/delivery-recovery.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/inngest/functions/delivery-recovery.ts)

Logger IS imported. But:

- **Line 77-84**: `extractResourceId` failure → `catch {}` proceeds with `null`. No log of which delivery/provider failed.
- **Line 138-139**: Outer catch for the entire per-delivery processing pipeline → pushes `deliveryId` to `failed[]` but doesn't log the error. The summary at line 146 reports `failed: result.failed.length` as a count — which delivery IDs failed and why is lost.

## Architecture Documentation

### Current Logger Coverage Map

```
api/platform/src/
├── trpc.ts                          ✅ has logger
├── lib/
│   ├── oauth/authorize.ts           ✅ has logger
│   ├── oauth/callback.ts            ✅ has logger
│   ├── oauth/state.ts               ❌ NO LOGGER — Redis ops
│   ├── token-helpers.ts             ❌ NO LOGGER — silent catches
│   ├── token-store.ts               ❌ NO LOGGER — encrypt + DB
│   ├── jwt.ts                       ⚪ no logger (acceptable — library)
│   ├── encryption.ts                ⚪ no logger (acceptable — utility)
│   ├── edge-resolver.ts             ✅ has logger
│   ├── jobs.ts                      ✅ has logger
│   ├── provider-configs.ts          ⚪ no logger (acceptable — config init)
│   ├── cache.ts                     ⚪ no logger (acceptable — key builder)
│   ├── constants.ts                 ⚪ no logger (acceptable — constants)
│   ├── scoring.ts                   ⚪ no logger (acceptable — pure)
│   ├── transform.ts                 ⚪ no logger (acceptable — pure)
│   ├── narrative-builder.ts         ⚪ no logger (acceptable — pure)
│   └── entity-extraction-patterns.ts ⚪ no logger (acceptable — pure)
├── router/memory/
│   ├── proxy.ts                     ❌ NO LOGGER — entire data plane
│   ├── connections.ts               ❌ NO LOGGER — token vault, disconnect
│   └── backfill.ts                  ❌ NO LOGGER — estimate probes
├── inngest/functions/
│   ├── health-check.ts              ⚠️  has logger, but discards errors in catches
│   ├── delivery-recovery.ts         ⚠️  has logger, but discards errors in catches
│   ├── memory-entity-worker.ts      ✅ has logger
│   ├── memory-backfill-orchestrator.ts ✅ has logger
│   ├── connection-lifecycle.ts      ✅ has logger
│   ├── ingest-delivery.ts           ✅ has logger
│   ├── memory-event-store.ts        ✅ has logger
│   ├── memory-entity-embed.ts       ✅ has logger
│   ├── memory-entity-graph.ts       ✅ has logger
│   ├── memory-notification-dispatch.ts ✅ has logger
│   ├── token-refresh.ts             ✅ has logger
│   └── on-failure-handler.ts        ✅ has logger
└── apps/platform/src/app/api/
    ├── trpc/[trpc]/route.ts         ✅ has logger
    ├── connect/*/authorize/route.ts ✅ has logger
    ├── connect/*/callback/route.ts  ✅ has logger
    ├── connect/oauth/poll/route.ts  ✅ has logger
    ├── ingest/[provider]/route.ts   ✅ has logger
    ├── health/route.ts              ⚪ no logger (acceptable — static)
    └── inngest/route.ts             ⚪ no logger (acceptable — SDK adapter)
```

**Legend**: ✅ has structured logger | ❌ critical gap | ⚠️ has logger but silent catches | ⚪ acceptable absence

### The Production Error Sanitization Problem

Even when errors DO reach the tRPC `onError` handler at `apps/platform/src/app/api/trpc/[trpc]/route.ts:43-52`, there's a compounding problem: the `errorFormatter` at `api/platform/src/trpc.ts:86-91` replaces `INTERNAL_SERVER_ERROR` messages with `"An unexpected error occurred"` in production. This means:

1. `proxy.execute` throws `TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "token_error: GitHub installation token request failed: 401" })`
2. The `onError` handler logs `error.message` — but by this point the formatter has already sanitized it for the client response
3. Sentry gets the exception via `captureException(error)`, which preserves the original message — but Sentry alone isn't a substitute for structured logs with context fields

This is actually fine for the client response (don't leak internals), but it means the route-level `onError` log entry is the sanitized version. The fix is to log **before** throwing the `TRPCError` in the router procedures themselves.

## Code References

- `api/platform/src/router/memory/proxy.ts` — Entire file, no logger, entire data plane
- `api/platform/src/lib/token-helpers.ts:111-113` — Silent catch, refresh failure
- `api/platform/src/lib/token-helpers.ts:125-127` — Silent catch, getActiveToken fallback
- `api/platform/src/router/memory/proxy.ts:208-211` — Silent catch, buildAuth retry
- `packages/app-providers/src/providers/github/index.ts:61-64` — Response body discarded
- `api/platform/src/router/memory/connections.ts` — Entire file, no logger
- `api/platform/src/router/memory/backfill.ts:254-264` — Silent catch, resolveResourceMeta
- `api/platform/src/router/memory/backfill.ts:367-376` — Silent catch, probe job
- `api/platform/src/lib/token-store.ts` — Entire file, no logger
- `api/platform/src/lib/oauth/state.ts` — Entire file, no logger
- `api/platform/src/inngest/functions/health-check.ts:91-94` — Error object discarded
- `api/platform/src/inngest/functions/health-check.ts:107-110` — Error object discarded
- `api/platform/src/inngest/functions/delivery-recovery.ts:77-84` — Silent catch
- `api/platform/src/inngest/functions/delivery-recovery.ts:138-139` — Error not logged
- `api/platform/src/trpc.ts:86-91` — Production error sanitization (compounds the problem)
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:43-52` — tRPC onError handler (receives sanitized messages)

## Related Research

- [`thoughts/shared/research/2026-04-05-app-platform-auth-flow.md`](./2026-04-05-app-platform-auth-flow.md) — Full authentication flow documentation (same session)
