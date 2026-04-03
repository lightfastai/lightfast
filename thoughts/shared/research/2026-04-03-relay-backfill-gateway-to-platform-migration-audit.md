---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "relay/backfill/gateway → platform migration: audit for missed cleanup"
tags: [research, codebase, platform, relay, backfill, gateway, migration]
status: complete
last_updated: 2026-04-03
last_updated_note: "Follow-up: fixed 6 stale JSDoc comments that described old services as still active"
---

# Research: relay/backfill/gateway → platform Migration Audit

**Date**: 2026-04-03
**Git Commit**: 34f5b76837648856dc476b8f947679021f7a6679
**Branch**: chore/remove-memory-api-key-service-auth

## Research Question

After the consolidation of apps/relay, apps/backfill, and apps/gateway into the single apps/platform service, audit the entire codebase for anything that was missed — stale references, dead env vars, broken routing, or orphaned config.

---

## Summary

**The migration is complete and clean.** Two rounds of research plus direct grep verification found no actionable gaps. Every item flagged in the initial agent sweep was either already cleaned, an intentional retention (DB table names, migration attribution comments), or an active platform feature (backfill as a domain concept). The only surviving artifacts are provenance comments that document where migrated code came from.

---

## Verified Clean — Full Checklist

### Config / Workspace Layer
- **pnpm-workspace.yaml** — no stale relay/backfill/gateway workspace entries
- **turbo.json** — generic task names, no named old-app targets
- **All tsconfig.json path aliases** — none point to old apps
- **knip.json** — workspace map contains no old app entries
- **apps/app/microfrontends.json** — only `lightfast-app` and `lightfast-www`

### CI / Deployment
- All 5 GitHub workflow files (`.github/workflows/`) — clean
- `apps/app/vercel.json`, `apps/platform/vercel.json`, `apps/www/vercel.json` — clean
- `apps/app/next.config.ts`, `apps/platform/next.config.ts` — no old rewrites, no `/gateway/*` redirect rules

### Environment Variables
- No `RELAY_*`, `GATEWAY_*`, or `BACKFILL_*` env var names in any Zod schema
- No `relay.lightfast.ai`, `gateway.lightfast.ai`, `backfill.lightfast.ai` URLs anywhere in the codebase
- `GATEWAY_API_KEY` — not present in `apps/app/.vercel/.env.development.local` (was already removed)
- `SERVICE_JWT_SECRET` correctly replaces `MEMORY_API_KEY`

### OAuth Callback URLs
- **Linear** (`packages/app-providers/src/providers/linear/index.ts:416,481`) — uses `${callbackBaseUrl}/api/connect/linear/callback` ✓
- **Vercel** (`packages/app-providers/src/providers/vercel/index.ts:342`) — uses `${callbackBaseUrl}/api/connect/vercel/callback` ✓
- Both match the actual platform route at `apps/platform/src/app/api/connect/[provider]/callback/route.ts`
- `callbackBaseUrl` resolves to the platform domain via `api/platform/src/lib/provider-configs.ts:21-35`

### Webhook Ingestion
- Inbound webhooks land at `apps/platform/src/app/api/ingest/[provider]/route.ts` (path: `/api/ingest/:provider`)
- Route verifies HMAC signature, inserts into `gatewayWebhookDeliveries`, fires `memory/webhook.received` Inngest event
- No `webhookBaseUrl` field in `RuntimeConfig` — the URL is structural (Next.js filesystem routing)
- No code constructs or registers webhook URLs programmatically; operators configure them in provider dashboards

### api/app → apps/platform Communication
- `api/app` calls platform **in-process** — imports `@api/platform` directly via `packages/platform-trpc/src/caller.ts`
- No `PLATFORM_URL` env var needed or exists
- `createMemoryCaller()` (`packages/platform-trpc/src/caller.ts:20`) signs a 60-second HS256 JWT, creates the tRPC context, and calls `memoryRouter.createCaller(ctx)` — no HTTP
- Browser clients use HTTP to `${origin}/api/trpc/memory` (CORS restricted to `appUrl` via `@vercel/related-projects`)

### Inngest Event Namespaces
- All platform events use `memory/*` (10 event types in `api/platform/src/inngest/schemas/memory.ts`)
- All app events use `console/*` (1 event type: `console/activity.record`)
- No `relay/`, `gateway/`, `backfill/`, `apps-gateway/`, `apps-relay/` event names anywhere in runtime code — only in migration attribution comments

### Stale Comments (packages/app-providers)
- `packages/app-providers/src/contracts/backfill.ts` — no relay/gateway refs (already cleaned)
- `packages/app-providers/src/provider/webhook.ts` — no relay middleware refs (already cleaned)
- `packages/app-providers/src/provider/shape.ts` — no relay/gateway refs (already cleaned)
- `packages/app-providers/src/provider/api.ts` — no "the gateway" refs (already cleaned)
- `packages/app-providers/src/provider/resource-picker.ts` — no gateway proxy refs (already cleaned)

### DB Schema Comment
- `db/app/src/schema/tables/index.ts:1` — "Gateway-owned tables" comment no longer present (already cleaned)

### validate_plan.md
- `.claude/commands/validate_plan.md` — no stale `pnpm build:relay/gateway/backfill` references (already cleaned)

---

## Intentionally Retained (Not Stale)

### "Ported From" Attribution Comments
14 files in `api/platform/` and `apps/platform/` carry provenance comments documenting the migration origin. These are intentional and informative:

| File | Comment |
|---|---|
| `api/platform/src/inngest/functions/memory-entity-worker.ts:4` | `Ported from apps/backfill/src/workflows/entity-worker.ts` |
| `api/platform/src/inngest/functions/memory-backfill-orchestrator.ts:4` | `Ported from apps/backfill/src/workflows/backfill-orchestrator.ts` |
| `api/platform/src/inngest/functions/delivery-recovery.ts:5` | `Source logic: apps/relay/src/lib/replay.ts + apps/relay/src/routes/admin.ts` |
| `api/platform/src/inngest/functions/connection-lifecycle.ts:4` | `Ported from apps/gateway/src/workflows/connection-teardown.ts` |
| `api/platform/src/inngest/functions/token-refresh.ts:4` | `Ported from apps/gateway/src/functions/token-refresh.ts` |
| `api/platform/src/inngest/functions/health-check.ts:4` | `Ported from apps/gateway/src/functions/health-check.ts` |
| `api/platform/src/lib/oauth/state.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |
| `api/platform/src/lib/oauth/authorize.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |
| `api/platform/src/lib/oauth/callback.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |
| `api/platform/src/lib/provider-configs.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |
| `api/platform/src/router/memory/backfill.ts:4` | `Ported from apps/backfill/src/routes/trigger.ts` |
| `api/platform/src/router/memory/proxy.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |
| `apps/platform/src/app/api/connect/[provider]/authorize/route.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |
| `apps/platform/src/app/api/connect/[provider]/callback/route.ts:4` | `Ported from apps/gateway/src/routes/connections.ts` |

### `gateway*` DB Table Names
Six tables (`gatewayInstallations`, `gatewayTokens`, `gatewayResources`, `gatewayLifecycleLog`, `gatewayBackfillRuns`, `gatewayWebhookDeliveries`) retain the `gateway` prefix as historical naming. They are live, actively queried tables now owned by `apps/platform`. Renaming requires a DB migration.

### `backfill` as Active Domain Feature
`BackfillDef`, `backfillRunRecord`, `BACKFILL_TERMINAL_STATUSES`, `BACKFILL_DEPTH_OPTIONS`, etc. in `packages/app-providers/` and `packages/app-validation/` are active platform capabilities — not stale references to the old app.

### `@ai-sdk/gateway`
External npm package (`pnpm-workspace.yaml:11`, `apps/app/package.json:21`, `packages/app-rerank/package.json:18`). Completely unrelated to the removed gateway app.

### `/api/gateway/stream` and `/api/gateway/realtime` in `apps/app`
Upstash Realtime SSE proxy routes — unrelated to the old gateway service.

---

## Architecture: apps/platform Current State

### API Routes
- `GET /api/connect/[provider]/authorize` — initiates OAuth, returns `{url, state}`
- `GET /api/connect/[provider]/callback` — OAuth callback handler
- `GET /api/connect/oauth/poll` — CLI OAuth polling
- `POST /api/ingest/[provider]` — inbound webhook ingestion
- `GET /api/health` — returns `{status:"ok", service:"memory"}`
- `GET,POST,PUT /api/inngest` — Inngest serve handler
- `GET,POST,OPTIONS /api/trpc/[trpc]` — tRPC handler (CORS: lightfast.ai only)

### Inngest Functions (11 total)
- **Event-triggered (8)**: `ingestDelivery`, `memoryEventStore`, `memoryEntityGraph`, `memoryEntityEmbed`, `memoryNotificationDispatch`, `memoryBackfillOrchestrator`, `memoryEntityWorker`, `connectionLifecycle`
- **Cron `*/5 * * * *` (3)**: `healthCheck`, `tokenRefresh`, `deliveryRecovery`

### tRPC Procedures (14 total, via in-process caller from api/app)
- `connections`: `list`, `get`, `getToken`, `disconnect`, `getAuthorizeUrl`, `registerResource`, `removeResource`, `listBackfillRuns`, `upsertBackfillRun`
- `proxy`: `listEndpoints`, `execute`
- `backfill`: `trigger`, `cancel`, `estimate`

---

## Research Note: Agent Hallucinations

Round 1 of this research produced several false findings from sub-agents that were disproved by direct grep verification:
- OAuth callback paths were reported as stale (`/gateway/linear/callback`) but are already correct (`/api/connect/linear/callback`)
- Stale comments in `packages/app-providers/src/` were reported but don't exist in the files
- `GATEWAY_API_KEY` in local env was reported but is already removed
- DB schema comment and `validate_plan.md` stale refs were reported but are already cleaned

Round 2 direct verification (using Grep tool directly) was used to confirm the actual state.

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-04-03-memory-api-key-service-auth-dead-code.md` — related dead code audit covering `MEMORY_API_KEY` removal and the legacy `handleServiceAuth()` path in `apps/platform/src/app/api/ingest/[provider]/route.ts`.
- `memory/project_memory_architecture.md` — architecture decision: relay + gateway + backfill + neural pipeline absorbed into `apps/platform`. Domain: `platform.lightfast.ai`.

---

## Follow-up Research 2026-04-03

A second audit pass via 6 parallel sub-agents confirmed the above findings. Additionally, 6 stale JSDoc comments were found that described the old services as **currently active** (not provenance comments — they implied relay/gateway still exist). These were fixed:

| File | Lines | Change |
|---|---|---|
| `api/platform/src/lib/cache.ts` | 4–5 | "share namespace as the gateway and relay services" → "legacy namespace from the former gateway and relay services" |
| `api/platform/src/lib/provider-configs.ts` | 16 | "In the gateway this resolved to..." → "In the former gateway service this resolved to..." |
| `api/platform/src/lib/provider-configs.ts` | 17–18 | "memory app's base URL" phrasing updated to "platform app's base URL" |
| `db/app/src/schema/tables/org-ingest-logs.ts` | 41 | "Delivery ID from relay" → "Delivery ID from the platform ingest pipeline" |
| `db/app/src/schema/tables/org-ingest-logs.ts` | 60 | "received by the relay service" → "received by the platform ingest service" |
| `db/app/src/schema/tables/org-ingest-logs.ts` | 86 | "Trace back to relay's delivery tracking" → "Trace back to the platform ingest delivery record" |
| `packages/app-providers/src/contracts/wire.ts` | 21–22 | "Envelope sent from Relay to Console ingress via QStash. This is the Relay->Console contract" → "Envelope sent from the platform ingest endpoint to the app ingress via QStash. Historical: formerly the Relay→Console contract" |
