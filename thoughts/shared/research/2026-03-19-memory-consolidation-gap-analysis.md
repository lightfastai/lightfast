---
date: 2026-03-19
topic: "Memory service consolidation — gap analysis after initial port"
tags: [research, memory, gap-analysis, relay, gateway, backfill, neural-pipeline]
status: complete
---

# Memory Service Consolidation — Gap Analysis

## Summary

5 parallel deep-dive research agents compared the original relay/gateway/backfill/neural-pipeline implementations (from git history) against the ported memory service code. The port is **structurally faithful** across OAuth, token vault, proxy, backfill orchestrator, entity worker, neural pipeline (all 11 event-store steps), entity graph, entity embed, and notification dispatch. However, there are **3 categories of issues** that need resolution.

---

## Category 1: BUILD BLOCKER — `.js` Import Extensions

**Status**: Blocks `pnpm build:memory`
**Scope**: 14 files, 34 import statements
**Root cause**: Agent-created files used `.js` suffixed relative imports (Node ESM convention), but Turbopack resolves `.ts` source files directly and can't find `.js` files.
**Fix**: Strip `.js` from all relative imports in `api/memory/src/`

### Files affected:
- `inngest/functions/memory-entity-worker.ts` (3 imports)
- `inngest/functions/connection-lifecycle.ts` (3)
- `inngest/functions/token-refresh.ts` (3)
- `inngest/functions/health-check.ts` (2)
- `lib/oauth/state.ts` (1)
- `lib/oauth/authorize.ts` (2)
- `lib/oauth/callback.ts` (3)
- `lib/provider-configs.ts` (1)
- `lib/token-store.ts` (1)
- `lib/token-helpers.ts` (2)
- `lib/encryption.ts` (1)
- `router/memory/backfill.ts` (4)
- `router/memory/connections.ts` (6)
- `router/memory/proxy.ts` (3)

---

## Category 2: MISSING IMPLEMENTATION — Webhook Ingestion Route

**Status**: `apps/memory/src/app/api/ingest/[provider]/route.ts` is a 501 stub
**Impact**: No external webhooks can enter the system. The entire data pipeline is broken.

### What the route needs to implement (ported from relay's 7-step middleware chain):

1. **providerGuard** — validate provider via `getProvider()`, reject API-only providers
2. **serviceAuthDetect** — check `X-API-Key` header with timing-safe comparison
3. **serviceAuthBodyValidator** — parse/validate body on service auth path
4. **webhookHeaderGuard** — validate provider-specific headers (standard path only)
5. **rawBodyCapture** — read raw body as text for HMAC (standard path only)
6. **signatureVerify** — HMAC/Ed25519 verification using provider secrets (standard path only)
7. **payloadParseAndExtract** — parse payload, extract deliveryId/eventType/resourceId

Then two divergent paths:
- **Standard path**: persist to `gatewayWebhookDeliveries` + `inngest.send("memory/webhook.received")`
- **Service auth path**: persist + check `X-Backfill-Hold` header + send event or hold

### Key details from relay implementation:
- `receivedAt` normalization: if < 1e12 (Unix seconds), multiply by 1000
- Persistence uses `.onConflictDoNothing()` on `(provider, deliveryId)` unique index
- Standard path sends `resourceId` for connection resolution by `ingest-delivery`
- Service auth path sends `preResolved: { connectionId, orgId }` to skip resolution
- `X-Backfill-Hold: true` causes DB insert WITHOUT Inngest event (held for replay)

---

## Category 3: BEHAVIORAL DIFFERENCES

### 3a. Entity worker `holdForReplay` not implemented
**Original**: `relay.dispatchWebhook(provider, data, holdForReplay)` — when `holdForReplay=true`, relay persists with `status: "received"` but does NOT deliver (no QStash publish). Webhooks are batched for chronological replay by orchestrator's `replay-held-webhooks` step.
**Memory port**: Always sends `memory/webhook.received` events immediately regardless of `holdForReplay`. The flag is destructured but never used.
**Impact**: Backfill events may arrive out of order when mixed with real-time traffic. The orchestrator's replay-held-webhooks step queries `status: "received"` rows but entity worker never creates them in hold mode.

### 3b. Entity worker 401 health-check signal — step boundary change
**Original**: `step.sendEvent("signal-connection-health-check")` fires INSIDE the `step.run("fetch-...")` callback — memoized together.
**Memory port**: Returns sentinel `{ __healthCheckSignal: true }` from step, then fires `step.sendEvent()` as a separate top-level call outside the step.
**Impact**: Different Inngest memoization behavior on replay. The health-check signal gets its own memoization slot in the memory port vs being part of the fetch step's slot in the original.

### 3c. Backfill cancel — missing `correlationId`
**Original**: Cancel event includes `{ installationId, correlationId }`.
**Memory port**: Cancel event only includes `{ installationId }`.
**Impact**: Trace correlation broken for cancel operations.

### 3d. Backfill trigger — extra connection verification gate
**Original trigger route**: Sends Inngest event immediately without pre-flight connection check (orchestrator validates inside Inngest).
**Memory port**: Verifies connection exists + is active + orgId matches BEFORE sending event.
**Impact**: Stricter than original — may reject valid requests during edge cases (e.g., race between connection status change and trigger).

### 3e. Ingest-delivery fan-out ordering
**Original console ingress**: `Promise.all([publishInngestNotification(), publishEventNotification()])` — parallel.
**Memory ingest-delivery**: `step.sendEvent("emit-event-capture")` then `step.run("publish-realtime")` — sequential.
**Impact**: Slight latency increase on realtime notifications. Not a correctness issue.

### 3f. Proxy execute — no structured logging
**Original gateway**: Sets `logFields` via Hono context with `connectionId`, `provider`, `endpointId`, `upstreamStatus`.
**Memory tRPC**: No equivalent structured log enrichment.
**Impact**: Reduced observability for proxy calls.

---

## Category 4: CONFIRMED FAITHFUL PORTS

All research agents confirmed these are correctly ported:

- **OAuth authorize** — state generation, Redis TTL, URL building, redirect_to validation
- **OAuth callback** — including GitHub stateless reinstall recovery (missing state + installation_id lookup)
- **OAuth CLI polling** — Redis `gw:oauth:result:{state}` read
- **Token vault** — AES-GCM encrypt/decrypt, writeTokenRecord, updateTokenRecord, assertEncryptedFormat
- **Token refresh cron** — proactive 10-min window, same DB query, same per-installation step loop
- **Health check cron** — probe active installations, transient failure counting (threshold 3→degraded, 6→lifecycle event)
- **Connection teardown** — all 5 Inngest steps (close-gate, cancel-backfill, revoke-token, cleanup-cache, remove-resources)
- **Proxy execute** — full 401 retry with `forceRefreshToken`, `freshToken !== token` guard, `endpoint.buildAuth` branch
- **Register/remove resource** — Redis cache population and cleanup
- **Provider configs** — module-level singleton from `PROVIDERS[name].createConfig(env, runtime)`
- **Redis key conventions** — same `gw:` namespace prefix
- **Backfill orchestrator** — gap-aware filtering, step.invoke(), persist-run-records, replay-held-webhooks loop
- **Entity worker** — paginated fetch loop, direct provider API calls, rate limit sleep, MAX_PAGES guard
- **Event store** — all 11 steps present and correct, idempotency key, replay-safe IDs
- **Entity graph** — resolveEdges co-occurrence algorithm, canonical edge dedup
- **Entity embed** — debounce 30s, narrative cap 1800 chars, Pinecone upsert with `ent_` prefix
- **Notification dispatch** — significance threshold 70, Knock workflow `observation-captured`
- **All lib files** — scoring, entity-extraction-patterns, edge-resolver, narrative-builder, transform, jobs, on-failure-handler

---

## Priority Fix Order

1. **Fix `.js` imports** (30 min) — unblocks build
2. **Implement webhook ingestion route** (2-4 hours) — unblocks the entire data pipeline
3. **Fix `holdForReplay` semantics** in entity worker (1 hour) — needed for backfill correctness
4. **Add `correlationId` to cancel event** (5 min) — trace correlation fix
5. **Structured logging for proxy** (optional) — observability improvement
