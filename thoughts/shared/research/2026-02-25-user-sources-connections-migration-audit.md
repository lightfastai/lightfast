---
date: 2026-02-25T10:48:45Z
researcher: Claude Code
git_commit: b1720d29ba9c46c27dac8f2c12ec65fbcd447f81
branch: feat/gateway-foundation
repository: lightfast
topic: "user-sources.ts vs connections service: end-to-end audit and migration state"
tags: [research, connections, oauth, user-sources, gw-installations, org-scoped, tRPC, migration]
status: complete
last_updated: 2026-02-25
last_updated_by: Claude Code
related_research:
  - thoughts/shared/plans/2026-02-25-gateway-console-db-consolidation.md
  - thoughts/shared/research/2026-02-10-oauth-architecture-decision-user-vs-workspace-owned.md
  - thoughts/shared/research/2026-02-25-console-db-architecture-gateway-integration.md
---

# Research: user-sources.ts vs Connections Service — End-to-End Audit

**Date**: 2026-02-25T10:48:45Z
**Researcher**: Claude Code
**Git Commit**: `b1720d29ba9c46c27dac8f2c12ec65fbcd447f81`
**Branch**: `feat/gateway-foundation`
**Repository**: lightfast

## Research Question

Given the latest `apps/connections/` service and `api/console/src/router/user/user-sources.ts`, what is the full end-to-end state of the connections/user-sources layer? Is `user-sources` still valid? Have we moved to org-level connections? What needs to be cleaned up, migrated, or reworked?

## Summary

**Yes, we've fully moved to org-level connections.** The legacy `userSources` naming layer has been completely removed.

### Migration Status: COMPLETE

The following work was completed on `feat/gateway-foundation`:

1. **Router rename** (Phase 1): `userSources` router renamed to `connections`, moved from `userRouter` to `orgRouter`. All 14 frontend files updated from `trpc.userSources.*` to `trpc.connections.*`. Server prefetches switched from `userTrpc` to `orgTrpc`. Client splitLink updated. Empty stub routers (`org/integration.ts`, `org/sources.ts`) deleted.

2. **Legacy table drop** (Phase 2): `lightfast_user_sources` table deleted. `workspaceIntegrations.userSourceId` column and FK dropped. `workspaceIntegrations.gatewayInstallationId` redundant string column dropped. Seed script updated to no longer reference `userSources`.

3. **sourceConfig split** (Phase 3): **Skipped.** After analysis, the split of `sourceConfig` into `resourceMeta` + `syncConfig` + `backfillState` was deemed not worth the effort. With GitHub push sync removed (no more `branches`/`paths` in sync config), the sync portion is just `{ events: InternalEventType[], autoSync: boolean }` — too thin to justify its own column. The `sourceConfig` JSONB blob remains as-is.

---

## Current Architecture (post-migration)

### Data Layer

```
PlanetScale (@db/console)
├── lightfast_gw_installations   ← org-scoped OAuth connections (ACTIVE)
│   ├── id, provider, external_id, org_id, connected_by, status
│   ├── provider_account_info (JSONB — GitHub installations array, Vercel team info, etc.)
│   └── unique index: (provider, external_id)
├── lightfast_gw_tokens          ← encrypted OAuth tokens (ACTIVE)
│   └── installation_id → gw_installations.id (CASCADE)
├── lightfast_gw_resources       ← linked provider resources for webhook routing (ACTIVE)
│   └── installation_id → gw_installations.id (CASCADE)
└── lightfast_workspace_integrations  ← workspace-level resource subscriptions (ACTIVE)
    ├── installation_id → gw_installations.id (sole FK, nullable)
    ├── provider (varchar, denormalized for fast filtering)
    └── source_config (JSONB — GitHub repo config, Vercel project config)
```

**Deleted:**
- `lightfast_user_sources` table — dropped
- `workspaceIntegrations.user_source_id` column — dropped
- `workspaceIntegrations.gateway_installation_id` column — dropped

### Router Tree

```
userRouter                          (no org required — allows clerk-pending)
  ├── organization
  ├── account
  ├── userApiKeys
  └── workspaceAccess

orgRouter                           (requires active org membership)
  ├── connections                   ← renamed from userSources, moved from userRouter
  │     ├── getAuthorizeUrl         ← proxies connections service
  │     ├── list                    ← queries gwInstallations
  │     ├── disconnect              ← queries gwInstallations
  │     ├── github.*                ← queries gwInstallations
  │     └── vercel.*                ← queries gwInstallations
  ├── workspace
  ├── search
  ├── contents
  ├── clerk
  ├── jobs
  ├── activities
  └── orgApiKeys
```

### Service Layer

```
Browser
  ↓ Opens OAuth popup via
apps/console (Next.js, port 4107)
  ↓ tRPC call to
api/console → orgRouter.connections.getAuthorizeUrl
  ↓ HTTP fetch with X-Org-Id header to
apps/connections (Hono, port 4110)
  ↓ GET /:provider/authorize → Redis state → returns {url, state}
  ↓ Popup navigates to provider OAuth URL
Provider OAuth
  ↓ Redirects to
apps/connections GET /:provider/callback
  ↓ Exchanges code → inserts gwInstallations row → encrypts tokens into gwTokens
  ↓ For Linear/Sentry: registers webhook pointing at gateway
  ↓ QStash notifyBackfillService (best-effort)
  ↓ Redirects popup to
apps/console /github/connected (or /vercel/connected etc.)
  ↓ popup posts message → parent polls popup.closed
Browser detects popup close → tRPC refetch of connections.github.get
```

---

## sourceConfig — Why We Kept It

The `sourceConfig` JSONB column on `workspaceIntegrations` stores both resource identity and sync preferences in a single discriminated union blob:

### GitHub Repository
```jsonc
{
  "version": 1,
  "sourceType": "github",
  "type": "repository",
  "installationId": "12345678",        // GitHub App installation ID
  "repoId": "567890123",
  "repoName": "frontend",
  "repoFullName": "acme/frontend",
  "defaultBranch": "main",
  "isPrivate": true,
  "isArchived": false,
  "sync": {
    "events": ["github:pull-request.opened", "github:pull-request.closed", "github:issue.opened"],
    "autoSync": true
  }
}
```

### Vercel Project
```jsonc
{
  "version": 1,
  "sourceType": "vercel",
  "type": "project",
  "projectId": "prj_123456",
  "projectName": "my-nextjs-app",
  "teamId": "team_abc",
  "teamSlug": "lightfastai",
  "configurationId": "icfg_789",
  "sync": {
    "events": ["vercel:deployment.created", "vercel:deployment.ready", "vercel:deployment.error"],
    "autoSync": true
  }
}
```

**Key detail**: `sync.events` stores Lightfast's internal event type keys (`InternalEventType` from `packages/console-types/src/integrations/event-types.ts`), not the raw provider webhook format. These are the granular event types like `"github:pull-request.opened"`, not category-level keys like `"pull_request"`.

**Why the split was skipped**: The original plan proposed splitting `sourceConfig` into `resourceMeta` (identity) + `syncConfig` (preferences) + `backfillState` (tracking). However, with GitHub push sync removed, `syncConfig` would only contain `{ events: string[], autoSync: boolean }` — two fields. Not worth 8+ write path changes and a data migration. If backfill state tracking is needed later, it can be added as a standalone column without splitting `sourceConfig`.

---

## The Connections Service (`apps/connections/`)

The connections service is a standalone **Hono HTTP app** running on port 4110 (dev) / `connections.lightfast.ai` (prod). It handles:

- **OAuth initiation**: `GET /:provider/authorize` (requires `X-Org-Id` header)
- **OAuth callback**: `GET /:provider/callback` (public, receives OAuth redirect)
- **Installation lifecycle**: `GET /:id`, `GET /:id/token`, `DELETE /:provider/:id` (all `apiKeyAuth`)
- **Resource management**: `POST /:id/resources`, `DELETE /:id/resources/:resourceId` (all `apiKeyAuth`)
- **Teardown workflow**: Upstash durable workflow at `POST /workflows/connection-teardown`

**Providers** (`apps/connections/src/providers/impl/`):
- `github.ts` — no token storage (JWTs on demand); handles App installation callbacks
- `vercel.ts` — stores encrypted token; no webhook registration
- `linear.ts` — stores encrypted token; registers webhook via GraphQL
- `sentry.ts` — stores encrypted token; webhook no-op (configured statically); has refresh token support

---

## Code References

- `api/console/src/router/org/connections.ts` — The connections router (all org-scoped)
- `api/console/src/root.ts` — Router assembly (`connections` under `orgRouter`)
- `api/console/src/trpc.ts:385-410` — `orgScopedProcedure` definition
- `apps/connections/src/routes/connections.ts` — Full connections service routes
- `apps/connections/src/providers/index.ts` — Provider registry
- `db/console/src/schema/tables/gw-installations.ts` — `gwInstallations` table definition
- `db/console/src/schema/tables/workspace-integrations.ts` — `workspaceIntegrations` (installationId FK only)
- `packages/console-types/src/integrations/event-types.ts` — Event registry and `InternalEventType` definitions

---

## Remaining Open Items

1. **Linear/Sentry UI**: The `connections.getAuthorizeUrl` procedure accepts `"linear"` and `"sentry"` as valid providers, but there are no frontend components for Linear/Sentry connection. Those flows exist in the connections service but have no UI entrypoint yet.

2. **`disconnect` vs connection teardown**: The `connections.disconnect` procedure sets `gwInstallations.status = "revoked"` directly, bypassing the connections service `DELETE /:provider/:id` teardown workflow that handles token revocation, webhook deregistration, and cache cleanup. Whether these should proxy to the connections service teardown endpoint is unresolved.

3. **`detectConfig` procedure**: The `connections.github.detectConfig` procedure searches for `lightfast.yml` files in repositories. This config detection mechanism may be obsolete — to be confirmed and potentially removed.
