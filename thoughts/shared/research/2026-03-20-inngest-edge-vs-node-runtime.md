---
date: 2026-03-20T00:00:00+00:00
researcher: claude
git_commit: 1624e4222c8acdff8018084f70edc4bd24f96887
branch: feat/memory-service-consolidation
repository: lightfast
topic: "Inngest edge vs node runtime in apps/platform — viability and recommendation"
tags: [research, inngest, edge-runtime, platform, performance]
status: complete
last_updated: 2026-03-20
---

# Research: Inngest Edge vs Node Runtime in apps/platform

**Date**: 2026-03-20
**Git Commit**: `1624e4222`
**Branch**: `feat/memory-service-consolidation`

## Research Question

`apps/platform/src/app/api/inngest/route.ts` currently exports `runtime = "edge"`. Is this viable and performant? Should we upgrade the architecture to be more edge-native, or revert to Node.js?

---

## Summary

**Recommendation: Revert to `runtime = "nodejs"` (or remove the export entirely).** Edge runtime provides no meaningful performance benefit for the Inngest serve endpoint and introduces hard operational constraints (30s timeout, 128MB memory) that conflict with the workloads the Inngest functions perform. The right performance upgrade is **Vercel Fluid Compute** on Node.js, not Edge runtime.

The one-line fix: remove `export const runtime = "edge"` from `apps/platform/src/app/api/inngest/route.ts`.

---

## Detailed Findings

### 1. Current State of the Inngest Route

`apps/platform/src/app/api/inngest/route.ts` — 4 lines:
```ts
import { createInngestRouteContext } from "@api/platform/inngest";

export const runtime = "edge";
export const { GET, POST, PUT } = createInngestRouteContext();
```

**This is the only route in apps/platform with `runtime = "edge"`.** All other routes are explicitly `"nodejs"`:
- `apps/platform/src/app/api/ingest/[provider]/route.ts:26` → `runtime = "nodejs"`
- `apps/platform/src/app/api/connect/[provider]/authorize/route.ts:15` → `runtime = "nodejs"`
- `apps/platform/src/app/api/connect/[provider]/callback/route.ts:16` → `runtime = "nodejs"`
- `apps/platform/src/app/api/trpc/[trpc]/route.ts:6` → `runtime = "nodejs"`

### 2. What `createInngestRouteContext()` Actually Does

`api/platform/src/inngest/index.ts:50-68` — Calls `serve()` from `inngest/next` and registers **11 functions**:

| Function ID | Trigger | Key Operations |
|---|---|---|
| `memory/ingest.delivery` | event `memory/webhook.received` | DB queries, Drizzle, Upstash Realtime emit |
| `memory/event.store` | event `memory/event.capture` | DB upserts |
| `memory/entity.graph` | event `memory/entity.upserted` | DB graph edge resolution |
| `memory/entity.embed` | event `memory/entity.graphed` | Cohere embed API, Pinecone upsert |
| `memory/notification.dispatch` | event | Knock notifications |
| `memory/backfill.orchestrator` | event | Fan-out, DB reads |
| `memory/backfill.entity-worker` | event | Multi-page provider API pagination (`timeouts.finish: "2h"`) |
| `memory/connection.lifecycle` | event | DB updates, cleanup |
| `memory/health.check` | cron `*/5 * * * *` | Iterates ALL active installations, probes provider APIs |
| `memory/token.refresh` | cron `*/5 * * * *` | Token decryption, OAuth refresh calls per-installation |
| `memory/delivery.recovery` | cron `*/5 * * * *` | DB sweep for stuck deliveries |

### 3. Edge Compatibility Audit of Dependencies

| Dependency | Edge Compatible? | Reason |
|---|---|---|
| `@db/app/client` | ✅ Yes | `drizzle-orm/neon-http` + Neon HTTP driver (`db/app/src/client.ts:1-24`) |
| `@repo/lib` `decrypt()`/`encrypt()` | ✅ Yes | Uses `crypto.subtle` Web Crypto API (`packages/lib/src/encryption.ts:1-7`) |
| `inngest/next` `serve()` | ✅ Yes | Inngest SDK supports Edge in `inngest/next` |
| `@vendor/db` (drizzle-orm) | ✅ Yes | Pure query builders, no Node.js I/O |
| `@vendor/observability/log/next` | ⚠️ Probably | Has `import "server-only"` (fine in Edge) + `@logtail/next` (`vendor/observability/src/log/next.ts:1-8`) |
| `@repo/app-upstash-realtime` | ❓ Unknown | Dynamic import in `ingest-delivery`. Upstash REST SDK is edge-compatible; custom wrapper unknown |
| `@repo/app-embed` (Cohere) | ❓ Unknown | Dynamic import in `entity-embed`. Cohere SDK may use Node.js HTTP |
| `@repo/app-pinecone` | ❓ Unknown | Dynamic import in `entity-embed`. Pinecone's fetch-based SDK is edge-compatible |
| `@vendor/inngest` | ✅ Yes | Thin re-export of `inngest` core (`vendor/inngest/src/index.ts:1-7`) |

### 4. The Hard Blockers for Edge Inngest (Operational, Not Code)

Even if all dependencies resolved cleanly, the Inngest functions cannot work correctly on Vercel Edge Runtime due to platform constraints:

#### a) 30-Second Execution Limit

Vercel Edge Functions have a **max execution time of 30 seconds** (no Fluid Compute support). When Inngest calls the serve endpoint to execute a step, the step's callback runs synchronously within that invocation.

Problematic steps:
- `entity-worker`: `fetch-${entityType}-p${pageNum}` — provider API call + DB insert. Multi-page pagination can have 50+ pages. Even if each step is 5-10s, these run serially within the same 30s window until Inngest's memoization replays.
- `entity-embed`: `embed-narrative` — Cohere embedding API roundtrip
- `entity-embed`: `upsert-entity-vector` — Pinecone upsert
- `health-check`: `probe-${installation.id}` — iterates ALL active installations with one step per installation. 10+ installations = 10+ sequential DB queries + provider API calls

`memoryEntityWorker` specifically has `timeouts: { finish: "2h" }` (`api/platform/src/inngest/functions/memory-entity-worker.ts:55`) — this is fine as an Inngest-level workflow timeout (not per-invocation), but it signals these are long-running, multi-step workflows.

#### b) 128MB Memory Limit

Edge Functions are constrained to **128MB memory**. Functions registering 11 handlers simultaneously — each loading DB client, provider SDK, and response schemas — could exceed this on cold start when all modules are loaded.

#### c) Edge Provides No Meaningful Performance Benefit for Inngest

The performance argument for Edge is **geographic cold-start reduction** (edge nodes are closer to users). But:

- **Inngest Cloud calls the serve endpoint from its own infrastructure** (US-based), not from users' geographic locations
- Cold start latency (200ms Node.js vs 5ms Edge) is irrelevant for background job orchestration — these are async workflows, not in the critical user request path
- The webhook ingest endpoint (`/api/ingest/[provider]`) IS the latency-sensitive path (external providers must get a 200 quickly), but it's already correctly on `"nodejs"`

### 5. What IS Edge-Compatible in the Codebase

The two key concerns in the original analysis turned out to be non-issues:

- **Token decryption** (`packages/lib/src/encryption.ts`) — already migrated to Web Crypto API (`crypto.subtle`). Explicitly noted as "Edge Runtime compatible — no Node.js crypto" in the file header.
- **Database client** (`db/app/src/client.ts`) — uses `drizzle-orm/neon-http` + Neon HTTP driver, explicitly documented as "Edge-compatible — uses fetch() instead of TCP sockets".

This means the codebase's core data layer is already well-positioned for Edge. The blocker is purely operational (Inngest's execution model + Vercel Edge limits), not a code-level incompatibility.

### 6. The Right Performance Upgrade: Fluid Compute

For the Inngest serve endpoint and the platform service overall, **Vercel Fluid Compute** (Node.js) is the correct performance upgrade:

| Dimension | Edge Function | Node.js (Standard) | Node.js + Fluid Compute |
|---|---|---|---|
| Max execution time | 30s | 60s | **800s** (paid plans) |
| Memory | 128MB | 1024MB | 3008MB |
| Cold start | ~5ms | ~200ms | ~200ms (warm via Fluid) |
| Fluid Compute | ❌ | ✅ | ✅ |
| `waitUntil()` / `after()` | ❌ | ✅ | ✅ |
| Cron functions | ⚠️ Risk (30s limit) | ✅ | ✅ |

Fluid Compute keeps function instances "warm" across requests, eliminating cold starts for high-traffic routes AND extending max duration to 800s — directly addressing the entity-worker's multi-page backfill workloads.

---

## Code References

- `apps/platform/src/app/api/inngest/route.ts:3` — `export const runtime = "edge"` — the setting to revert
- `api/platform/src/inngest/index.ts:18` — `import { serve } from "inngest/next"` — Inngest serve handler
- `api/platform/src/inngest/index.ts:50-68` — `createInngestRouteContext()` — registers all 11 functions
- `api/platform/src/inngest/functions/memory-entity-worker.ts:55` — `timeouts: { finish: "2h" }` — 2h workflow timeout signals long-running nature
- `api/platform/src/inngest/functions/health-check.ts:68` — `for (const installation of installations)` — serial probe loop over all active installations
- `db/app/src/client.ts:7-24` — Neon HTTP driver, explicitly edge-compatible
- `packages/lib/src/encryption.ts:1-7` — Web Crypto API, explicitly edge-compatible
- `vendor/observability/src/log/next.ts:1` — `import "server-only"` — safe in Edge; `@logtail/next` logger

---

## Architecture Documentation

The platform service (`apps/platform`) is structured as:
- **Next.js app** running on port 4112 at `platform.lightfast.ai`
- **All API routes** currently on `runtime = "nodejs"` (except the Inngest route)
- **Inngest serve endpoint** at `/api/inngest` — receives step execution requests from Inngest Cloud
- **Inngest functions** live in `api/platform/src/inngest/functions/` — they import from `@db/app/client`, `@repo/app-providers`, and other packages at module scope

The Inngest architecture: when Inngest Cloud calls `POST /api/inngest`, the serve handler identifies which function and which step to run, executes the step callback inline, and returns the serialized result. All module-level imports in every registered function are loaded on each invocation (or cached across warm invocations). The dynamic `import()` calls inside step callbacks are lazily evaluated only when that specific step runs.

---

## Recommendation

**Revert `export const runtime = "edge"` to nothing (Node.js default) in `apps/platform/src/app/api/inngest/route.ts`.**

If performance on the serve path is a goal:
1. **Fluid Compute**: Ensure `apps/platform` is deployed with Fluid Compute enabled on Vercel (extends max duration, keeps instances warm across Inngest step executions)
2. **The webhook ingest path** (`/api/ingest/[provider]`) is correctly on Node.js; it could use `after()` to defer the DB write and Inngest send after the 200 response
3. No changes needed to DB client or crypto — they're already edge-compatible, and that remains an asset if specific routes ever do need Edge in future

The `runtime = "edge"` on the Inngest route is inconsistent with all other platform routes and does not survive contact with Vercel's Edge Function constraints for the workloads these functions perform.
