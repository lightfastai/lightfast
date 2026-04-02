---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 6ffe837eef605a64c778d2e56ced98e44e37d9d2
branch: chore/knip-cleanup-app-www
repository: lightfast
topic: "MEMORY_API_KEY and service-auth ingest path — dead code audit"
tags: [research, codebase, platform, ingest, auth, dead-code, relay-legacy]
status: complete
last_updated: 2026-04-03
---

# Research: MEMORY_API_KEY and service-auth ingest path — dead code audit

**Date**: 2026-04-03  
**Git Commit**: `6ffe837eef605a64c778d2e56ced98e44e37d9d2`  
**Branch**: `chore/knip-cleanup-app-www`

## Research Question

Is `MEMORY_API_KEY` old/legacy code that can be removed? Are there any external consumers of the ingest provider in lightfast?

## Summary

`MEMORY_API_KEY` is a legacy API key that guarded a "service-auth" branch in the `/api/ingest/[provider]` route — a short-circuit path that accepted pre-resolved `connectionId`/`orgId` from internal callers (backfill jobs) via `x-api-key` header, bypassing HMAC signature verification. **No caller exists anywhere in the monorepo.** All internal delivery paths (backfill orchestrator, entity worker, delivery recovery cron) now call `inngest.send("memory/webhook.received")` directly with `preResolved: { connectionId, orgId }`, never touching the HTTP endpoint. The env var is `optional()` in the schema and labeled "legacy" in its own comment. The service-auth path is dead code inherited from the former relay/gateway architecture.

The modern cross-service auth mechanism is `SERVICE_JWT_SECRET` — short-lived HS256 JWTs signed by `signServiceJWT()` and validated in the tRPC middleware.

## Detailed Findings

### MEMORY_API_KEY — where it lives

| File | Line | What it does |
|---|---|---|
| `apps/platform/src/env.ts` | 20 | Declared as `z.string().min(1).optional()`. Comment: "Service auth — internal API key for **legacy** cross-service calls" |
| `apps/platform/src/app/api/ingest/[provider]/route.ts` | 86–98 | Only consumer: reads `x-api-key` header, calls `timingSafeStringEqual(apiKey, env.MEMORY_API_KEY)` |
| `apps/platform/turbo.json` | 25 | Listed in `passThroughEnv` for the build task |

No other files in the monorepo reference this variable.

### The service-auth path in the ingest route

`apps/platform/src/app/api/ingest/[provider]/route.ts`:

- **Lines 86–98**: Service auth detection block. Reads `x-api-key` header; if present and `env.MEMORY_API_KEY` is non-null and matches, sets `isServiceAuth = true` and routes to `handleServiceAuth()`. If the header is present but doesn't match, returns 401 immediately.
- **Lines 105–181**: `handleServiceAuth()` function. Parses body against `serviceAuthWebhookBodySchema`, inserts into `gatewayWebhookDeliveries` with the pre-resolved connection/org, and calls `inngest.send("memory/webhook.received", { ..., serviceAuth: true, preResolved: { connectionId, orgId } })`.
- **Line 135**: Also reads `x-backfill-hold` header (if `"true"`, sets DB status to `"held"` and skips the `inngest.send`). No sender for this header exists in the monorepo.

### No callers exist

A full monorepo search found **zero files** that:
- Send an `x-api-key` header outbound
- Construct an HTTP request to `/api/ingest/`
- Reference `platform.lightfast.ai/api/ingest`

The service-auth HTTP path is receive-only code with no sender counterpart.

### How internal callers actually work (the live paths)

All three internal delivery paths bypass the HTTP endpoint entirely, calling `inngest.send("memory/webhook.received")` directly:

| Function | File | How it delivers |
|---|---|---|
| Backfill entity worker | `api/platform/src/inngest/functions/memory-entity-worker.ts:339` | `inngest.send(batch)` with `preResolved: { connectionId: installationId, orgId }` |
| Backfill orchestrator (replay held) | `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:366` | `inngest.send(events)` with `preResolved: { connectionId, orgId }` |
| Delivery recovery cron | `api/platform/src/inngest/functions/delivery-recovery.ts:108` | `inngest.send(...)` with `preResolved` resolved from DB lookup |

The `ingest-delivery.ts` Inngest function (`memory/ingest.delivery`) is the *consumer* of `memory/webhook.received` — it checks `data.preResolved` at line 54 to skip the DB join for connection resolution.

### serviceAuthWebhookBodySchema — scope

- **Definition**: `packages/app-providers/src/contracts/wire.ts:15–26`
  - File-level JSDoc still reads "Relay ↔ Console Pipeline Wire Contracts" and "consumed exclusively by the relay service"
  - Also defines `webhookReceiptPayloadSchema` / `WebhookReceiptPayload` and `webhookEnvelopeSchema` / `WebhookEnvelope`
- **Re-exports**: `packages/app-providers/src/index.ts:14` and `packages/app-providers/src/contracts.ts:4`
- **Only consumer**: `apps/platform/src/app/api/ingest/[provider]/route.ts:20,116`

Confirmed via full monorepo grep — only 2 files reference `serviceAuthWebhookBodySchema` or `ServiceAuthWebhookBody`.

### What in wire.ts is still alive

`WebhookEnvelope` (and `webhookEnvelopeSchema`) is still used:
- `api/platform/src/lib/transform.ts:4,13` — imports `WebhookEnvelope` as the parameter type for `transformEnvelope()`

`webhookReceiptPayloadSchema` / `WebhookReceiptPayload` — no consumers found outside `wire.ts` itself (grep returned only `wire.ts` and `transform.ts`; `transform.ts` only uses `WebhookEnvelope`).

### The modern auth mechanism: SERVICE_JWT_SECRET

The replacement for `MEMORY_API_KEY` is a JWT-based system:

- **`api/platform/src/lib/jwt.ts`**: `signServiceJWT(caller)` produces an HS256 token with `aud="lightfast-memory"`, `exp=now+60s`. `verifyServiceJWT(token)` validates it.
- **`api/platform/src/trpc.ts:37–68`**: `createMemoryTRPCContext` reads `Authorization: Bearer <token>`, verifies it, sets `ctx.auth = { type: "service", caller }`.
- **`packages/platform-trpc/src/caller.ts:21`**: `createMemoryCaller()` signs a JWT and passes it as `Authorization` header in the tRPC context — all in-process, no HTTP.
- **`packages/platform-trpc/src/server.tsx`**: Same pattern for RSC use.

All `api/app` → `api/platform` calls go through `createMemoryCaller()`, never through HTTP.

## Code References

- `apps/platform/src/env.ts:20` — `MEMORY_API_KEY` declaration (optional, labeled legacy)
- `apps/platform/src/app/api/ingest/[provider]/route.ts:86–98` — service auth detection block
- `apps/platform/src/app/api/ingest/[provider]/route.ts:105–181` — `handleServiceAuth()` function
- `apps/platform/src/app/api/ingest/[provider]/route.ts:135` — `x-backfill-hold` header read (no sender)
- `apps/platform/turbo.json:25` — `MEMORY_API_KEY` in `passThroughEnv`
- `packages/app-providers/src/contracts/wire.ts:15–26` — `serviceAuthWebhookBodySchema` / `ServiceAuthWebhookBody`
- `api/platform/src/inngest/schemas/memory.ts:58` — `serviceAuth: z.boolean().optional()` in Inngest event schema
- `api/platform/src/lib/transform.ts:4,13` — still uses `WebhookEnvelope` (alive, do not remove)
- `api/platform/src/lib/jwt.ts` — `signServiceJWT` / `verifyServiceJWT` (live auth mechanism)

## What Can Be Removed

Everything in the service-auth path is dead code with no callers:

1. `MEMORY_API_KEY` — `apps/platform/src/env.ts:20` and `apps/platform/turbo.json:25`
2. Service auth detection block — `apps/platform/src/app/api/ingest/[provider]/route.ts:86–98`
3. `handleServiceAuth()` function — `apps/platform/src/app/api/ingest/[provider]/route.ts:105–181`
4. `serviceAuthWebhookBodySchema` + `ServiceAuthWebhookBody` — `packages/app-providers/src/contracts/wire.ts:15–26` (only consumer is the route above)
5. `serviceAuth: z.boolean().optional()` — `api/platform/src/inngest/schemas/memory.ts:58` (set only by the dead path)
6. Related import in the route: `serviceAuthWebhookBodySchema` and `timingSafeStringEqual` (if not used elsewhere)

**Do not remove**: `WebhookEnvelope` / `webhookEnvelopeSchema` in `wire.ts` — still used by `transform.ts`.

## Architecture Documentation

The service-auth ingest path was designed for a former relay architecture where a separate relay service sent pre-resolved webhook bodies to the console via HTTP + static API key. That relay service no longer exists. Its replacement is Inngest-native: internal callers construct `memory/webhook.received` events with `preResolved` fields directly, bypassing any HTTP boundary. The `MEMORY_API_KEY` mechanism was never ported to the new JWT auth system and remained optional to avoid breaking deployments during the migration.

## Open Questions

- `webhookReceiptPayloadSchema` / `WebhookReceiptPayload` in `wire.ts` also appear to have no live consumers — worth verifying and removing alongside `serviceAuthWebhookBodySchema`.
- The `x-backfill-hold` header handling in `handleServiceAuth()` (line 135) had a specific purpose (holding deliveries for backfill replay). The orchestrator's "hold" path now achieves the same result by inserting directly to `gatewayWebhookDeliveries` with `status: "held"` (`memory-entity-worker.ts:329`).
