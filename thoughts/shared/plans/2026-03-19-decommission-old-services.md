---
date: 2026-03-19
topic: "Decommission old services — remove relay, gateway, backfill apps and unused packages"
tags: [plan, cleanup, decommission, relay, gateway, backfill, migration]
status: draft
dependencies: [all other platform migration plans must be complete]
---

# Decommission Old Services

## Executive Summary

Final cleanup phase of the platform consolidation. Removes the three standalone Hono microservices (`apps/relay`, `apps/gateway`, `apps/backfill`), the inter-service HTTP client package (`@repo/gateway-service-clients`), unused vendor packages, and all supporting configuration. This plan runs only after all traffic has migrated to the consolidated platform service (memory).

**Prerequisite**: Every other migration plan is complete and verified in production.

---

## Phase 1: Traffic Verification

### Overview

Before deleting anything, confirm zero traffic is hitting the old services. This is a monitoring-only phase with no code changes.

### Steps

#### 1.1 Verify relay receives no webhook traffic

- Check Vercel logs for `lightfast-relay` project: filter for `POST /api/webhooks/:provider` requests in the last 7 days
- Check Sentry for any relay error events
- Verify all provider webhook URLs have been updated:
  - **GitHub App**: webhook URL should point to `memory.lightfast.ai/api/ingest/github` (not relay)
  - **Sentry App**: webhook URL updated
  - **Linear App**: webhook URL updated
  - **Vercel Integration**: webhook URL updated
- Confirm relay's Upstash Workflow queue is drained (no in-flight workflows)

#### 1.2 Verify gateway receives no OAuth callbacks

- Check Vercel logs for `lightfast-gateway` project: filter for `GET /services/gateway/:provider/callback` in the last 7 days
- Check Redis for any pending OAuth state keys (prefix `oauth:state:`)
- Verify `GET /services/gateway/oauth/status` has no active polling clients

#### 1.3 Verify backfill receives no triggers

- Check Vercel logs for `lightfast-backfill` project: filter for `POST /api/trigger` in the last 7 days
- Check Inngest dashboard: confirm no `backfill/run.requested` events are routed to the old backfill app ID
- Confirm no in-flight Inngest functions under the old `lightfast-backfill` app

#### 1.4 Verify console no longer calls gateway-service-clients

- Search production console logs for `gateway-service-clients` or `createGatewayClient` error patterns
- Verify `@api/console` router files (`connections.ts`, `workspace.ts`) no longer import from `@repo/gateway-service-clients`
- Confirm `apps/console/src/app/api/debug/inject-event/route.ts` no longer uses `createRelayClient`

### Success Criteria

- [ ] Zero requests to relay in last 7 days
- [ ] Zero OAuth callbacks to gateway in last 7 days
- [ ] Zero backfill triggers in last 7 days
- [ ] Zero console-to-gateway HTTP calls in last 7 days
- [ ] All provider webhook URLs point to new endpoints
- [ ] No in-flight Upstash Workflows on relay or gateway
- [ ] No in-flight Inngest functions on old backfill/gateway app IDs

---

## Phase 2: Remove Console Service Rewrites and References

### Overview

Remove the Next.js rewrite rules that proxy traffic from `lightfast.ai/services/*` to the old Hono services. Remove the debug route that uses the relay client.

### Changes

#### 2.1 Remove service rewrite rules from `apps/console/next.config.ts`

**File**: `apps/console/next.config.ts`

Remove the `gatewayUrl`, `relayUrl`, `backfillUrl` variable declarations (lines 165-173) and the three service rewrite entries:

```typescript
// DELETE these three rewrites:
{
  source: "/services/gateway/:path*",
  destination: `${gatewayUrl}/services/gateway/:path*`,
},
{
  source: "/services/relay/:path*",
  destination: `${relayUrl}/api/:path*`,
},
{
  source: "/services/backfill/:path*",
  destination: `${backfillUrl}/api/:path*`,
},
```

Keep the `/docs` rewrite — it's unrelated.

Also remove the `isProd`, `gatewayUrl`, `relayUrl`, `backfillUrl` const declarations that are only used by these rewrites.

#### 2.2 Remove related-projects references from console

**File**: `apps/console/src/lib/related-projects.ts`

Remove the `relayUrl` export (line 22-27). Keep `authUrl` and `wwwUrl` as they serve the microfrontends architecture.

#### 2.3 Remove debug inject-event route

**File**: `apps/console/src/app/api/debug/inject-event/route.ts`

This route imports `createRelayClient` from `@repo/gateway-service-clients`. Either:
- Delete the entire route if debug injection is now handled through the new platform
- Or update it to use the new platform's ingest endpoint

#### 2.4 Remove `@vendor/upstash-workflow` from console

**File**: `apps/console/package.json`

Remove the `"@vendor/upstash-workflow": "workspace:*"` dependency. The console ingress route (`apps/console/src/app/api/gateway/ingress/route.ts`) that uses it should already have been migrated to the platform service.

**File**: `apps/console/src/app/api/gateway/ingress/route.ts`

Delete this file and its `_lib/` directory — webhook ingestion is now handled by the platform service.

#### 2.5 Remove `@repo/gateway-service-clients` from console

**File**: `apps/console/package.json`

Remove the `"@repo/gateway-service-clients": "workspace:*"` dependency.

### Success Criteria

- [ ] `pnpm build:console` succeeds with no gateway/relay/backfill references
- [ ] `pnpm typecheck` passes for `@lightfast/console`
- [ ] No `/services/*` rewrite rules remain in `next.config.ts`

---

## Phase 3: Remove `@api/console` Dependencies on Old Services

### Overview

The `@api/console` package (tRPC server-side business logic) currently imports `createGatewayClient` and `createBackfillClient` from `@repo/gateway-service-clients`. These must have been replaced by platform tRPC callers before this phase runs.

### Pre-Check

Verify these files no longer import from `@repo/gateway-service-clients`:
- `api/console/src/router/org/connections.ts` (currently 8 usages of `createGatewayClient`)
- `api/console/src/router/org/workspace.ts` (currently uses `createGatewayClient` and `createBackfillClient`)
- `api/console/src/router/org/__tests__/notify-backfill.test.ts` (mocks `@repo/gateway-service-clients`)

If any of these still import from the old package, the prerequisite migration is not complete — stop here.

### Changes

#### 3.1 Remove dependency from `@api/console`

**File**: `api/console/package.json`

Remove `"@repo/gateway-service-clients": "workspace:*"` from dependencies.

### Success Criteria

- [ ] `pnpm --filter @api/console typecheck` passes
- [ ] `pnpm --filter @api/console build` succeeds
- [ ] `grep -r "gateway-service-clients" api/console/` returns zero results

---

## Phase 4: Delete Service Apps

### Overview

Remove the three Hono service app directories. This is the point of no return.

### Changes

#### 4.1 Delete `apps/relay/`

```bash
rm -rf apps/relay/
```

Contents being deleted:
- Hono webhook ingestion routes (HMAC verify, QStash dispatch)
- Upstash Workflow webhook delivery
- Admin/DLQ/replay routes
- Recovery cron handler
- All tests (~15 test files)
- Vercel project config (`.vercel/project.json`)

#### 4.2 Delete `apps/gateway/`

```bash
rm -rf apps/gateway/
```

Contents being deleted:
- OAuth flow routes (authorize, callback, status polling)
- Connection CRUD routes
- Token vault (encrypt/decrypt/refresh)
- API proxy (`executeApi`)
- Connection teardown Upstash Workflow
- Health check and token refresh Inngest functions
- All tests (~12 test files)
- Vercel project config

#### 4.3 Delete `apps/backfill/`

```bash
rm -rf apps/backfill/
```

Contents being deleted:
- Backfill trigger/cancel/estimate routes
- Backfill orchestrator Inngest function
- Entity worker Inngest function
- All tests (~10 test files)
- Vercel project config

### Success Criteria

- [ ] `ls apps/` shows only: `auth`, `console`, `docs`, `www` (plus any new `memory`/`platform` app)
- [ ] `pnpm install` completes without errors (no dangling workspace references)

---

## Phase 5: Delete Service Packages

### Overview

Remove packages that existed solely to support inter-service communication between the old Hono services.

### Changes

#### 5.1 Delete `packages/gateway-service-clients/`

```bash
rm -rf packages/gateway-service-clients/
```

This package exports:
- `createGatewayClient` — HTTP client for gateway service
- `createRelayClient` — HTTP client for relay service
- `createBackfillClient` — HTTP client for backfill service
- `buildServiceHeaders` / `ServiceClientConfig` — shared auth headers
- `backfillUrl`, `consoleUrl`, `gatewayUrl`, `relayUrl` — URL resolution via `@vercel/related-projects`
- `HttpError` — error class

**Pre-check**: Verify no workspace packages still depend on it:

```bash
grep -r '"@repo/gateway-service-clients"' --include="package.json" .
```

Expected: zero results (after Phases 2-3). Currently referenced by:
- `apps/console/package.json` (removed in Phase 2)
- `api/console/package.json` (removed in Phase 3)
- `apps/gateway/package.json` (deleted in Phase 4)
- `apps/backfill/package.json` (deleted in Phase 4)
- `packages/integration-tests/package.json` (addressed in Phase 6)

#### 5.2 Check and potentially delete `packages/gateway-types/`

Search for a `packages/gateway-types/` directory. Based on current codebase analysis, this package does not exist as a separate directory — the types are part of `@repo/gateway-service-clients`. The `@repo/gateway-types` reference in `CLAUDE.md` is a documentation reference to the types shared via `@repo/gateway-service-clients`. No action needed.

### Success Criteria

- [ ] `packages/gateway-service-clients/` no longer exists
- [ ] `pnpm install` completes without errors

---

## Phase 6: Delete or Update Integration Tests

### Overview

The `packages/integration-tests/` package contains integration tests that exercise the old service architecture. Most test files reference gateway-service-clients, upstash-workflow, and qstash.

### Changes

#### 6.1 Delete old integration test files

The following test files test the old 3-service architecture and should be deleted:

- `packages/integration-tests/src/full-stack-connection-lifecycle.integration.test.ts`
- `packages/integration-tests/src/backfill-connections-api.integration.test.ts`
- `packages/integration-tests/src/connections-backfill-trigger.integration.test.ts`
- `packages/integration-tests/src/connections-relay-cache.integration.test.ts`
- `packages/integration-tests/src/event-ordering.integration.test.ts`
- `packages/integration-tests/src/connections-cli-oauth-flow.integration.test.ts`
- `packages/integration-tests/src/connections-browser-oauth-flow.integration.test.ts`
- `packages/integration-tests/src/backfill-relay-dispatch.integration.test.ts`
- `packages/integration-tests/src/api-console-connections.integration.test.ts`
- `packages/integration-tests/src/cli-oauth-full-flow.integration.test.ts`
- `packages/integration-tests/src/__stubs__/gateway-service-clients.ts`

#### 6.2 Update integration test dependencies

**File**: `packages/integration-tests/package.json`

Remove:
- `"@repo/gateway-service-clients"` from dependencies
- `"@vendor/upstash-workflow"` from dependencies (if no remaining tests use it)
- `"@vendor/qstash"` from dependencies (if no remaining tests use it)
- `"@vendor/upstash"` from dependencies (if no remaining tests use it)

**File**: `packages/integration-tests/vitest.config.ts`

Remove the `@repo/gateway-service-clients` alias from the vitest config.

#### 6.3 Update knip ignore list

**File**: `knip.json`

Remove the `ignoreDependencies` entries for packages that no longer exist:
- `"@relay/webhook-delivery"` (in integration-tests workspace config)
- `"@vendor/qstash"` (if deleted)
- `"@vendor/upstash-workflow"` (if deleted)

#### 6.4 Evaluate remaining test files

Keep and potentially update:
- `contract-snapshots.test.ts` — may need updating if contract shapes changed
- `lineage-integrity.test.ts` — may still be relevant for the new platform
- `neural-pipeline.integration.test.ts` — keep if neural pipeline tests are architecture-agnostic

If all test files are deleted, consider deleting the entire `packages/integration-tests/` directory.

### Success Criteria

- [ ] `pnpm --filter @repo/integration-tests typecheck` passes (or package is deleted)
- [ ] No dangling imports to deleted packages

---

## Phase 7: Remove Vendor Packages (Conditional)

### Overview

Check if vendor packages used exclusively by the old services can be deleted. Exercise caution — some may be used by the new platform service.

### Changes

#### 7.1 `@vendor/upstash-workflow` — CONDITIONAL DELETE

**Current consumers** (from package.json grep):
- `apps/relay/package.json` — DELETED in Phase 4
- `apps/gateway/package.json` — DELETED in Phase 4
- `apps/console/package.json` — REMOVED in Phase 2
- `packages/integration-tests/package.json` — REMOVED in Phase 6

**Decision**: If the new platform service does NOT use `@vendor/upstash-workflow`, delete it:

```bash
rm -rf vendor/upstash-workflow/
```

If the platform service has replaced Upstash Workflow with Inngest for all durable execution, this package is safe to delete.

#### 7.2 `@vendor/qstash` — CONDITIONAL DELETE

**Current consumers** (from package.json grep):
- `apps/relay/package.json` — DELETED in Phase 4
- `apps/gateway/package.json` — DELETED in Phase 4
- `packages/integration-tests/package.json` — REMOVED in Phase 6

**Decision**: If QStash is not used by any remaining service (console, platform, etc.), delete it:

```bash
rm -rf vendor/qstash/
```

#### 7.3 `@vendor/upstash` (Redis) — KEEP

Used by:
- `apps/console/package.json` — OAuth state, caching
- `packages/console-clerk-cache/package.json` — Clerk cache
- `packages/console-workspace-cache/package.json` — workspace config cache
- `packages/console-upstash-realtime/package.json` — SSE realtime
- `apps/auth/package.json` — auth state

**Decision**: Keep. Redis is a core dependency.

#### 7.4 `@vendor/inngest` — KEEP

Used by console and the new platform service for durable execution.

### Success Criteria

- [ ] `pnpm install` completes without errors
- [ ] No workspace references to deleted vendor packages
- [ ] `pnpm typecheck` passes globally

---

## Phase 8: Clean Up Root Configuration

### Overview

Update root-level configuration files to remove references to the deleted services.

### Changes

#### 8.1 Update root `package.json` scripts

**File**: `package.json` (root)

Remove these scripts:
```json
"build:relay": "echo \"lightfast-relay\" | vercel build --yes 2>&1",
"build:gateway": "echo \"lightfast-gateway\" | vercel build --yes 2>&1",
"build:backfill": "echo \"lightfast-backfill\" | vercel build --yes 2>&1",
"dev:relay": "turbo watch dev -F @lightfast/relay --continue",
"dev:backfill": "turbo watch dev -F @lightfast/backfill --continue",
"dev:gateway": "turbo watch dev -F @lightfast/gateway --continue",
```

Update `dev:app` to remove the old service filters:
```json
// Before:
"dev:app": "turbo watch dev --concurrency=15 --filter=@lightfast/www --filter=@lightfast/auth --filter=@lightfast/console --filter=@lightfast/relay --filter=@lightfast/backfill --filter=@lightfast/gateway --continue",

// After (add memory/platform if applicable):
"dev:app": "turbo watch dev --concurrency=15 --filter=@lightfast/www --filter=@lightfast/auth --filter=@lightfast/console --continue",
```

Update `dev:inngest` in `apps/console/package.json` to remove the backfill Inngest URL:
```json
// Before:
"dev:inngest": "npx inngest-cli@latest dev -u http://localhost:3024/api/inngest -u http://localhost:4109/api/inngest",

// After:
"dev:inngest": "npx inngest-cli@latest dev -u http://localhost:3024/api/inngest",
```

#### 8.2 Update `knip.json`

**File**: `knip.json`

Remove workspace entries for the deleted apps:
```json
// DELETE these three entries:
"apps/relay": {
  "entry": ["src/routes-table.ts"],
  "project": ["src/**/*.ts"]
},
"apps/gateway": {
  "entry": ["src/routes-table.ts"],
  "project": ["src/**/*.ts"],
  "ignoreDependencies": ["drizzle-orm"]
},
"apps/backfill": {
  "entry": ["src/routes-table.ts"],
  "project": ["src/**/*.ts"]
},
```

#### 8.3 Verify `pnpm-workspace.yaml` — no changes needed

The workspace globs (`apps/*`, `packages/*`, `vendor/*`) are pattern-based, not explicit. Deleting directories is sufficient — the globs will simply match fewer directories.

### Success Criteria

- [ ] `pnpm dev:app` starts only console + www + auth (+ platform if applicable)
- [ ] `pnpm build:console` succeeds
- [ ] No references to `@lightfast/relay`, `@lightfast/gateway`, or `@lightfast/backfill` in root config

---

## Phase 9: Update `@repo/inngest` Event Schemas

### Overview

Clean up Inngest event schemas to remove events that are no longer needed or have been renamed for the new platform architecture.

### Changes

#### 9.1 Evaluate event schema retention

**File**: `packages/inngest/src/schemas/platform.ts`

Current events:
- `platform/webhook.received` — **EVALUATE**: If the new platform uses different event names, remove or rename
- `platform/connection.lifecycle` — **EVALUATE**: Same consideration

**File**: `packages/inngest/src/schemas/backfill.ts`

Current events:
- `backfill/run.requested` — **KEEP if platform backfill uses same event name**, otherwise rename
- `backfill/run.cancelled` — Same
- `backfill/connection.health.check.requested` — Same
- `backfill/entity.requested` — Same

**File**: `packages/inngest/src/schemas/console.ts`

Current events:
- `console/activity.record` — **KEEP** (used by console's `record-activity` Inngest function)
- `console/event.capture` — **EVALUATE**: If neural pipeline moved to platform with new event names
- `console/event.stored` — Same
- `console/entity.upserted` — Same
- `console/entity.graphed` — Same

#### 9.2 Remove unused event schemas

After determining which events are actively used by the new architecture, remove any orphaned schemas. Rebuild the package:

```bash
pnpm --filter @repo/inngest build
```

#### 9.3 Update `packages/inngest/src/index.ts`

If any schema files are deleted entirely (e.g., if all `backfill/*` events are renamed to `memory/*` or `platform/*`), update the barrel export.

### Success Criteria

- [ ] `pnpm --filter @repo/inngest typecheck` passes
- [ ] `pnpm --filter @repo/inngest build` succeeds
- [ ] All exported event schemas are consumed by at least one Inngest function

---

## Phase 10: DNS and Provider Webhook URL Updates

### Overview

Update external-facing URLs and provider configurations. This phase may have already been partially completed during the migration — verify and complete.

### Changes

#### 10.1 Vercel project cleanup

- Archive or delete the `lightfast-relay` Vercel project
- Archive or delete the `lightfast-gateway` Vercel project
- Archive or delete the `lightfast-backfill` Vercel project

**Note**: Do NOT delete immediately if there's any chance of needing rollback. Archive first, delete after 30 days of confirmed stability.

#### 10.2 DNS cleanup

If custom domains were configured:
- `relay.lightfast.ai` — either remove DNS record or point to a 301 redirect to `memory.lightfast.ai`
- Any gateway/backfill subdomains — same treatment

#### 10.3 Provider webhook URL verification

Confirm all registered webhook URLs point to the new platform endpoints:

| Provider | Old URL | New URL |
|----------|---------|---------|
| GitHub App | `relay.lightfast.ai/api/webhooks/github` | `memory.lightfast.ai/api/ingest/github` (or equivalent) |
| Sentry App | `relay.lightfast.ai/api/webhooks/sentry` | Update in Sentry dashboard |
| Linear App | `relay.lightfast.ai/api/webhooks/linear` | Update in Linear dashboard |
| Vercel Integration | `relay.lightfast.ai/api/webhooks/vercel` | Update in Vercel Integration Console |

**Important**: Existing OAuth installations that were created before the migration may have the OLD webhook URLs baked into their provider registration. Verify:
- GitHub App installations: The webhook URL is configured at the GitHub App level (not per-installation), so a single update covers all installations
- Linear: Webhook URLs are per-integration — may need to re-register webhooks for existing installations
- Vercel: Webhook URLs are configured in the Vercel Integration Console

#### 10.4 Transition redirect (optional safety net)

If there's concern about missed webhook URLs, configure a simple redirect:
- Deploy a minimal Vercel project at the old relay URL that 308-redirects all `POST /api/webhooks/*` to the new platform endpoint
- Keep running for 30-60 days, monitor for any redirected traffic
- Remove after confirming zero traffic

### Success Criteria

- [ ] All provider webhook URLs verified and pointing to new endpoints
- [ ] Old Vercel projects archived (not deleted yet)
- [ ] No DNS records pointing to non-existent services

---

## Phase 11: Update Documentation

### Overview

Update `CLAUDE.md` and any other documentation to reflect the simplified architecture.

### Changes

#### 11.1 Update `CLAUDE.md` architecture diagram

Remove the "Hono Services" section from the architecture diagram. Update to show the new consolidated architecture:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Next.js Apps                                                                   │
│  ┌──────────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐            │
│  │ console (4107)   │  │ www (4101) │  │ auth (4104)│  │docs(4105│            │
│  │ @api/console     │  │ marketing  │  │ Clerk      │  │Fumadocs │            │
│  │ tRPC + Inngest   │  │ CMS        │  │ OAuth      │  │MDX      │            │
│  └───────┬──────────┘  └────────────┘  └────────────┘  └─────────┘            │
│          │                                                                      │
│  [Platform/Memory service — consolidated from relay+gateway+backfill]           │
│                                                                                 │
│          @db/console (Drizzle)                                                  │
│          @vendor/upstash (Redis)                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 11.2 Update `CLAUDE.md` development commands

Remove:
- `pnpm dev:relay`
- `pnpm dev:gateway`
- `pnpm dev:backfill`
- `pnpm build:relay` / `build:gateway` / `build:backfill`

Add the new platform/memory dev commands if applicable.

Update the `pnpm dev:app` description to reflect the new service set.

#### 11.3 Update `CLAUDE.md` key rules and architecture description

- Remove references to "3 edge-runtime microservices (`relay`, `gateway`, `backfill`)"
- Remove references to "Internal auth via `X-API-Key` header"
- Remove the Hono service descriptions (gateway, relay, backfill bullet points)
- Update the `@repo/gateway-types` reference if present

#### 11.4 Clean up thoughts/ directory

Delete research and plan documents that are now fully obsoleted by this decommission:
- `thoughts/shared/plans/2026-03-17-relay-drop-redis-cache.md`
- `thoughts/shared/plans/2026-03-18-delivery-recovery-cron.md`
- `thoughts/shared/plans/2026-03-18-entity-worker-401-hardening.md`
- `thoughts/shared/plans/2026-03-18-health-check-token-refresh-crons.md`
- `thoughts/shared/plans/2026-03-18-gate-first-lifecycle-audit-log.md`
- `thoughts/shared/plans/2026-03-18-repo-inngest-shared-package.md`
- `thoughts/shared/plans/2026-03-19-hono-trpc-migration.md`
- Any research docs referencing the old service architecture exclusively

### Success Criteria

- [ ] `CLAUDE.md` accurately describes the current architecture
- [ ] No references to relay/gateway/backfill in documentation
- [ ] Development commands are accurate and functional

---

## Phase 12: Final Verification

### Overview

End-to-end validation that the entire system works without the old services.

### Steps

#### 12.1 Build verification

```bash
pnpm install                  # No workspace resolution errors
pnpm typecheck                # All packages pass
pnpm check                    # Lint passes
pnpm build:console            # Console builds
pnpm test                     # All tests pass
```

#### 12.2 Runtime verification

```bash
pnpm dev:app                  # Full stack starts without errors
```

Verify:
- Console UI loads at `localhost:3024`
- OAuth connection flow works end-to-end
- Webhook ingestion processes events
- Backfill triggers and completes
- Neural pipeline processes events to Pinecone
- Activity feed shows events in real-time

#### 12.3 Grep for ghost references

```bash
# Should return zero meaningful results (excluding this plan file, git history, and lockfile):
grep -r "lightfast-relay\|lightfast-gateway\|lightfast-backfill" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude="pnpm-lock.yaml" .

grep -r "@lightfast/relay\|@lightfast/gateway\|@lightfast/backfill" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude="pnpm-lock.yaml" .

grep -r "gateway-service-clients" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude="pnpm-lock.yaml" .
```

### Success Criteria

- [ ] `pnpm install` — no errors
- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm build:console` — succeeds
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm dev:app` — starts without errors
- [ ] Ghost reference grep returns zero results (excluding lockfile/history)
- [ ] End-to-end flows verified manually

---

## Risk Mitigation

### Rollback Strategy

- **Phase 1-3**: Fully reversible — no code has been deleted
- **Phase 4**: Point of no return for service code. Before executing, ensure:
  - Git branch is clean with a known-good commit to revert to
  - All service code exists in git history if restoration is needed
- **Phase 10**: Vercel projects archived (not deleted) for 30 days

### Transition Period (Pre-Phase 4)

Consider keeping the old services alive but idle for 2-4 weeks after the platform migration goes live:
- Old relay accepts webhooks and 301-redirects to new platform endpoint
- Old gateway accepts OAuth callbacks and 301-redirects
- Monitor redirect logs — any non-zero traffic indicates missed migration

### In-Flight Workflow Handling

- **Upstash Workflows**: Existing in-flight workflows on relay and gateway will complete on the old service. Wait for the workflow queue to drain completely before deleting the service.
- **Inngest Functions**: Functions registered under old app IDs (`lightfast-backfill`, `lightfast-gateway`) will stop being invoked once the new platform registers the same function IDs under the new app. Verify in the Inngest dashboard that no functions are stuck.

### Provider Webhook URL Migration

For providers where webhook URLs are per-installation (not per-app):
1. Before decommission, run a migration script that updates all `gatewayInstallations` records with the new webhook callback URLs
2. For each active installation, call the provider API to update the webhook URL
3. Verify by checking the provider's webhook settings page for each installation

---

## Inventory of Items to Delete

### Directories

| Path | Package Name | Size Estimate |
|------|-------------|---------------|
| `apps/relay/` | `@lightfast/relay` | ~40 files |
| `apps/gateway/` | `@lightfast/gateway` | ~50 files |
| `apps/backfill/` | `@lightfast/backfill` | ~30 files |
| `packages/gateway-service-clients/` | `@repo/gateway-service-clients` | ~10 files |
| `vendor/upstash-workflow/` (conditional) | `@vendor/upstash-workflow` | ~5 files |
| `vendor/qstash/` (conditional) | `@vendor/qstash` | ~5 files |

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` (root) | Remove 6 scripts, update `dev:app` |
| `apps/console/next.config.ts` | Remove 3 service rewrite rules + URL vars |
| `apps/console/package.json` | Remove 2 dependencies |
| `apps/console/src/lib/related-projects.ts` | Remove `relayUrl` export |
| `apps/console/src/app/api/debug/inject-event/route.ts` | Delete or update |
| `apps/console/src/app/api/gateway/ingress/route.ts` | Delete (+ `_lib/` dir) |
| `api/console/package.json` | Remove 1 dependency |
| `packages/integration-tests/package.json` | Remove dependencies |
| `packages/integration-tests/vitest.config.ts` | Remove aliases |
| `knip.json` | Remove 3 workspace entries + update ignoreDependencies |
| `packages/inngest/src/schemas/*.ts` | Remove unused event schemas |
| `CLAUDE.md` | Update architecture diagram + commands |

---

## Execution Order Summary

```
Phase 1:  Verify zero traffic (monitoring only, no code changes)
Phase 2:  Remove console service rewrites and references
Phase 3:  Remove @api/console dependencies on old services
Phase 4:  Delete service app directories (point of no return)
Phase 5:  Delete gateway-service-clients package
Phase 6:  Delete/update integration tests
Phase 7:  Delete unused vendor packages (conditional)
Phase 8:  Clean up root configuration
Phase 9:  Clean up Inngest event schemas
Phase 10: DNS and provider webhook URL updates
Phase 11: Update documentation
Phase 12: Final verification
```

Phases 2-3 should be a single commit. Phase 4-8 should be a single commit. Phases 9-11 can be separate commits. Phase 12 is verification only.
