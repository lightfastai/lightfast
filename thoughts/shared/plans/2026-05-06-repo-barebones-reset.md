# Repo Barebones Reset Implementation Plan

## Overview

Strip the Lightfast repo to a barebones state: delete the entire neural-pipeline / event-stream stack (events, entities, edges, ingest-logs, transformers, EdgeRules, PostTransformEvent, narrative-builder, edge-resolver, agent triage, repo-index sync, backfill orchestrator, the entire apps/app dashboard route group, the public SSE endpoint). Leave the auth + connections + webhook-delivery + OAuth + Inngest cron infrastructure intact so the rebuild can layer aggregates on top later.

This plan only **tears down**. The aggregate model (PR / Deployment / Issue / Linear Task / Sentry Issue / Customer Feedback / Bug-Fix Request) is a follow-up plan.

## Current State Analysis

The pipeline today is documented in `thoughts/shared/research/2026-04-20-lightfast-2-barebones-rearchitecture-baseline.md` and `thoughts/shared/research/2026-05-06-architecture-reset-barebones.md`. The 2026-05-06 doc explicitly defers the teardown plan to "a dedicated planning document" — this file is that document.

**Functional surface to be torn down** (verified against `main` at 28eae9531):

- 9 Inngest functions in `api/platform`: `ingestDelivery`, `platformEventStore`, `platformEntityGraph`, `platformEntityEmbed`, `platformAgentTriage`, `platformRepoIndexSync`, `platformBackfillOrchestrator`, `platformEntityWorker`, `deliveryRecovery`. Of the 12 total Inngest functions in api/platform, 9 are deleted. Survivors: `connectionLifecycle`, `healthCheck`, `tokenRefresh`.
- 4 tRPC routers in `api/app`: `events`, `entities`, `jobs`, `repoIndex`. The `connections` router survives but loses `updateBackfillConfig`.
- 1 tRPC router in `api/platform`: `backfill`. The `connections` router on platform-side loses `listBackfillRuns` + `upsertBackfillRun`.
- The entire `(workspace)` route group in `apps/app` (mailbox + manage subgroup): events, event/[id], entity/[id], jobs, settings/repo-index. `_components/` and the `(manage)/layout.tsx`.
- The public SSE endpoint `apps/app/src/app/api/gateway/stream/route.ts`.
- 7 lib/ helpers in `api/platform`: `edge-resolver.ts`, `narrative-builder.ts`, `scoring.ts`, `entity-extraction-patterns.ts`, `jobs.ts`, `transform.ts`, `constants.ts`. Plus `inngest/on-failure-handler.ts`.
- 4 transformer files + 4 backfill paginators in `@repo/app-providers` (no `apollo/transformers.ts`).
- `PostTransformEvent` type, `EdgeRule` interface, runtime `dispatch.ts`/`validation.ts`/`sanitize.ts`.
- The entire `@repo/dotlightfast` package.
- `@repo/app-upstash-realtime` channel schemas (`org.event` / `org.entity` / `org.entityEvent`); package shell + client.tsx stays. The `apps/app/src/app/api/gateway/realtime/route.ts` route handler is deleted (no consumer) — recreate when channels re-emerge.
- 5 orphan schema files in `@repo/app-validation`: `neural.ts`, `job.ts`, `workflow-io.ts`, `ingestion.ts`, `entities.ts` (consumers all deleted upstream).
- 7 db schema TS files: `org-events`, `org-entities`, `org-event-entities`, `org-entity-edges`, `org-ingest-logs`, `org-repo-indexes`, `gateway-backfill-runs`.

**Functional surface that survives**:

- All gateway tables stay in DB (no migration applied — schema TS files for kept tables stay; dropped table data persists physically as orphans).
- `apps/platform/src/app/api/ingest/[provider]/route.ts` keeps writing to `gatewayWebhookDeliveries` with `status="received"`. The `inngest.send("platform/webhook.received", …)` line is removed because no consumer remains.
- OAuth: `apps/platform/src/app/api/connect/[provider]/{authorize,callback,oauth/poll}/route.ts`, all of `api/platform/src/lib/oauth/*`, token-vault, encryption.
- Cron Inngest: `connectionLifecycle`, `healthCheck`, `tokenRefresh` (5-min schedule each).
- `apps/app` auth surfaces: `/sign-in`, `/sign-up`, SSO callbacks, `/early-access`, `/account/*`, `/desktop/auth`, `/cli/auth`.
- `apps/app` org surfaces: `/[slug]/sources`, `/[slug]/sources/new`, `/[slug]/settings`, `/[slug]/settings/api-keys`, `/provider/{github,linear,sentry,vercel}/connected`. The `[slug]/` root redirects to `/[slug]/sources`.
- `/api/trpc/[trpc]`, `/api/inngest`, `/api/health` on apps/app.
- `/v1/[...rest]` (oRPC: `search`, `proxy.search`, `proxy.call`) and `/v1/answer/[...v]` (AI agent). The agent's `orgSearch` tool keeps working but returns empty results until aggregate vectors are wired up later. The route's previous `orgRepoIndexes` cached-content fetch is stripped in Phase 1 alongside the prompt section deletion (without this strip, the dropped table breaks the route at runtime).
- `/api/cli/login`, `/api/cli/setup`, `/api/desktop/auth/{code,exchange}`.
- `@repo/app-upstash-realtime` package shell + `client.tsx` provider stay (route handler is deleted; future channels can recreate it).
- Pinecone wrappers (`@repo/app-pinecone`, `@vendor/pinecone`), Cohere/embed (`@repo/app-embed`, `@repo/app-rerank`), `EntityVectorMetadata` Zod schema in `@repo/app-validation`. These are abstractions; consumers (`apps/app/src/lib/search.ts`, `@repo/app-ai/src/org-search.ts`) survive but query against an empty index.
- `recordActivity` Inngest workflow in `api/app` and `orgUserActivities` table.
- All vendor packages (Clerk, Sentry, security, observability, etc.).
- `@repo/app-providers` keeps OAuth `auth.ts`, webhook payload `schemas.ts`, signature verification `runtime/verify/*`, API client `api.ts`.

## Desired End State

After all 6 phases:

1. `pnpm install && pnpm check && pnpm typecheck` exits 0 across the monorepo.
2. `pnpm build:app` and `pnpm build:platform` succeed.
3. Booting `pnpm dev` and signing in lands on `/[slug]/sources` (no dashboard pages remain).
4. POSTing a webhook to `https://<wt>.lightfast.localhost/api/ingest/github` (proxied to platform) writes a row to `gatewayWebhookDeliveries` with `status="received"` and does not enqueue any Inngest event (no `platform/webhook.received` send).
5. `/v1/answer` returns a successful response on a query — the model's reply will be "I have no information" but the endpoint, auth, and search call all work.
6. The 7 dropped tables (`org_events`, `org_entities`, `org_event_entities`, `org_entity_edges`, `org_ingest_logs`, `org_repo_indexes`, `gateway_backfill_runs`) remain in Postgres with their data intact but no application code references them.
7. No file imports `PostTransformEvent`, `EdgeRule`, `edgeResolver`, `narrativeBuilder`, `entityExtractionPatterns`, `dotlightfast`, `org.event`/`org.entity`/`org.entityEvent` channel schemas, `transformWebhookPayload`, `sanitizePostTransformEvent`, `validatePostTransformEvent`, or any of the deleted `@repo/app-validation` schemas (`EntityVectorMetadata`, `JobStatus`, `ingestionSourceSchema`, `EntityCategory`, etc.).
8. Inngest dev server registers exactly 4 functions: `recordActivity` (api/app), `connectionLifecycle`, `healthCheck`, `tokenRefresh` (api/platform). The `api/platform/src/inngest/schemas/platform.ts` file survives but contains only `connection.lifecycle` + `health.check.requested` event schemas.
9. The `apps/app/src/app/api/gateway/realtime/` and `apps/app/src/app/api/gateway/stream/` route directories are gone.

### Key Discoveries

- **`(workspace)/page.tsx` is the leaf rendered at `[slug]/`** — there is no separate `[slug]/page.tsx`. Deleting `(workspace)/page.tsx` requires `[slug]/layout.tsx` to either redirect or render a non-route fallback.
- **`(manage)/layout.tsx` exists** — must be deleted with the manage subgroup, not just the route folders below it.
- **`apps/app/src/components/jobs-table.tsx` + `use-job-filters.ts`** are shared components living outside the route group, but only `/jobs` consumes them. Delete with the route.
- **`@repo/dotlightfast` is 9 files** including a vitest config and tests. Clean delete.
- **`@repo/app-upstash-realtime` is only 2 files** — `index.ts` (channel schemas) + `client.tsx` (provider). Edit `index.ts` to drop `org.event`/`org.entity`/`org.entityEvent` schemas; keep `client.tsx` and the package shell.
- **No `apollo/transformers.ts`** — Apollo is api-key-only with no webhook channel. We're dropping 4 transformer files (github/linear/sentry/vercel), not 5.
- **`apps/app/src/types/index.ts` re-exports from deleted tRPC routers** — verified at lines 13–32: `JobsListResponse`, `Job`, `JobStatus`, `EntitiesListResponse`, `Entity`, `EntityDetail`, `EntityEventsResponse`, `EntityEvent`, `EventListItem`, `EventDetail` all derive from `RouterOutputs["jobs"|"entities"|"events"]`. Only `ResourcesList` (line 38) and `Source` (line 39) survive. Phase 1 must delete the Jobs/Entities/Events sections wholesale, leaving only the Sources & Connections section.
- **`apps/app/src/ai/prompts/sections/repo-index-context.ts`** depends on `org_repo_indexes` data — drop the section file and its import in `system-prompt.ts`. `core-behavior.ts` line 8 mentions "the graph and related tools" — update that too.
- **`/v1/answer` route directly queries `orgRepoIndexes`** — verified at `apps/app/src/app/(api)/v1/answer/[...v]/route.ts:4,64-73`. The `import { orgRepoIndexes } from "@db/app/schema"` plus the `db.select().from(orgRepoIndexes)…` block must be deleted in Phase 1 (alongside the prompt section), and the `repoIndex` arg passed to `buildAnswerSystemPrompt` becomes `undefined`. Without this edit, Phase 5's schema deletion makes the route fail at runtime.
- **`api/platform/src/inngest/schemas/platform.ts` cannot be deleted outright — surviving Inngest client + 3 surviving functions still depend on it.** Verified: the file imports `postTransformEventSchema` from `@repo/app-providers/contracts`, `backfillTriggerPayload` from `@repo/app-providers/client`, and `ingestionSourceSchema` from `@repo/app-validation`. The 3 surviving functions still need `platform/connection.lifecycle` and `platform/health.check.requested` schemas. Plan: in Phase 3, **trim the file in place** — remove `event.capture`, `event.stored`, `entity.upserted`, `entity.graphed`, `agent.decided`, `backfill.run.requested`, `backfill.entity.requested`, `webhook.received`, plus the `postTransformEventSchema` / `ingestionSourceSchema` / `backfillTriggerPayload` imports. Keep only `connection.lifecycle` + `health.check.requested`. Also drop the `inngest.send("platform/backfill.run.cancelled", …)` call inside `connectionLifecycle` (orphan — no consumer remains) and remove that event from the schema file too.
- **Generic `provider/primitives.ts` and `provider/shape.ts` carry the `EdgeRule`, `transform`, `backfill`, `edgeRules` fields on `BaseProviderFields`**. Each of the 5 provider `index.ts` files passes these into `defineWebhookProvider()`. Surgical edits per file.
- **`apps/app/src/lib/search.ts` and `apps/app/src/lib/proxy.ts`** import directly from `@db/app` — verify which schema they reference. `search.ts` calls Pinecone, not Postgres for results, so should not import the dropped tables. `proxy.ts` is for token vault — uses gateway tables (kept). Both should compile after teardown without edits, but verify in Phase 1.
- **`api/platform/src/lib/jobs.ts`** is used by `platformEventStore` (in the `runs` Inngest helper). Verify it has no other consumer; if orphan after Phase 3, delete with the lib helpers.
- **The `connections.updateBackfillConfig` procedure on api/app** writes `provider_config.sync.events` and `sync.autoSync` on `org_integrations`. The `org_integrations` table stays — the procedure goes because backfill is gone. UI consumer was a settings panel inside the deleted dashboard.
- **CI is per-monorepo turbo** — running `pnpm typecheck` from root will catch any cross-package break. No special CI surgery.
- **`pnpm-workspace.yaml`** likely lists `packages/dotlightfast` explicitly or via glob — verify glob form covers it; if explicit, delete the entry.
- **The Inngest cloud project keeps the same app ID** — deleting 9 functions causes them to disappear from the Inngest dashboard on next deploy. No data loss, just no future runs scheduled.

## What We're NOT Doing

- **Not** running `pnpm db:generate`. The 7 dropped tables stay in Postgres physically. Future db:generate will produce a drop migration — that's a separate decision.
- **Not** dropping any vendor packages (`@vendor/clerk`, `@vendor/pinecone`, `@vendor/upstash-realtime`, etc.).
- **Not** dropping any `@repo/app-pinecone`, `@repo/app-embed`, `@repo/app-rerank`, `@repo/app-validation`, `@repo/app-ai`, `@repo/app-api-contract`, `@repo/app-api-key`, `@repo/app-encryption`, `@repo/app-octokit-github` packages. The pinecone vendor wrapper, the AI agent search tool, and the oRPC contract all stay wired (returning empty until aggregates land).
- **Not** designing or scaffolding the new aggregate model (PR / Deployment / Issue / etc.). That is a follow-up plan.
- **Not** touching auth code: Clerk integration, sign-in/sign-up routes, server actions, server actions tests, JWT, API key crypto, desktop PKCE.
- **Not** dropping `core/cli`, `core/lightfast`, `core/mcp` (or anything under `core/`).
- **Not** touching `apps/www`, `apps/desktop`, `core/*` (none import the dropped neural-pipeline surfaces).
- **Not** touching the gateway tables `gatewayInstallations`, `gatewayTokens`, `gatewayLifecycleLogs`, `gatewayWebhookDeliveries`, or `org_integrations`, `org_workflow_runs`, `org_user_activities`, `org_api_keys`. Their schema files and migrations remain untouched.
- **Not** touching `recordActivity` Inngest workflow or `org_user_activities`.
- **Not** removing OAuth state/encryption, the `apps/platform` connect routes, or `connections` tRPC procedures other than the surgical `updateBackfillConfig` / `listBackfillRuns` / `upsertBackfillRun` removals.
- **Not** keeping `/api/gateway/realtime` route handler — Phase 1 deletes it (only consumer was the 3 channels Phase 4 strips; YAGNI). The `@repo/app-upstash-realtime` package shell + `client.tsx` survive for future channel re-wire.
- **Not** removing `platformBackfillOrchestrator` / `platformEntityWorker` data tracking from `org_workflow_runs`. The table stays.
- **Not** writing any new tests in this plan. Tests for the rebuilt aggregate model land with the rebuild plan.
- **Not** publishing any package. Versioning plumbing for `@lightfastai/cli`, `lightfast`, `@lightfastai/mcp` is unchanged (those packages are not touched).
- **Not** changing CLAUDE.md, AGENTS.md, or any agent config files.

## Implementation Approach

Six phases, top-down deletion (consumer surfaces → tRPC → Inngest+lib → packages → db schema → verify). Each phase is a buildable checkpoint. Phase boundary halts execution; user runs the automated + manual checks before approving the next phase.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Strip apps/app Dashboard + Public SSE

### Overview

Delete the entire `(workspace)` route group, delete the public SSE endpoint, redirect the org root to `/sources`, drop the AI prompt section that depends on `org_repo_indexes`, and clean any types-barrel re-exports referencing dropped tables.

### Changes Required

#### 1. Delete the (workspace) route group

**Files to delete** (all under `apps/app/src/app/(app)/(org)/[slug]/(workspace)/`):
- `(workspace)/page.tsx`
- `(workspace)/_components/mailbox.tsx`
- `(workspace)/_components/mailbox-event-list.tsx`
- `(workspace)/_components/mailbox-event-row.tsx`
- `(workspace)/_components/mailbox-entity-list.tsx`
- `(workspace)/_components/mailbox-entity-row.tsx`
- `(workspace)/(manage)/layout.tsx`
- `(workspace)/(manage)/events/layout.tsx`
- `(workspace)/(manage)/events/page.tsx`
- `(workspace)/(manage)/events/_components/events-table.tsx`
- `(workspace)/(manage)/events/_components/event-detail.tsx`
- `(workspace)/(manage)/events/_components/event-row.tsx`
- `(workspace)/(manage)/events/_components/use-event-filters.ts`
- `(workspace)/(manage)/event/[eventId]/layout.tsx`
- `(workspace)/(manage)/event/[eventId]/page.tsx`
- `(workspace)/(manage)/event/[eventId]/_components/event-detail-view.tsx`
- `(workspace)/(manage)/entity/[entityId]/layout.tsx`
- `(workspace)/(manage)/entity/[entityId]/page.tsx`
- `(workspace)/(manage)/entity/[entityId]/_components/entity-detail-view.tsx`
- `(workspace)/(manage)/entity/[entityId]/_components/entity-event-row.tsx`
- `(workspace)/(manage)/jobs/layout.tsx`
- `(workspace)/(manage)/jobs/page.tsx`
- `(workspace)/(manage)/settings/repo-index/page.tsx`
- `(workspace)/(manage)/settings/repo-index/_components/repo-index-config.tsx`
- `(workspace)/(manage)/settings/repo-index/_components/repo-index-config-loading.tsx`

After deleting the leaf files, also remove any now-empty parent directories with `find apps/app/src/app/\(app\)/\(org\)/\[slug\]/\(workspace\) -type d -empty -delete` (or equivalent).

#### 2. Delete shared dashboard components

**Files to delete**:
- `apps/app/src/components/jobs-table.tsx`
- `apps/app/src/components/use-job-filters.ts`

#### 3. Delete the public SSE endpoint

**File to delete**:
- `apps/app/src/app/api/gateway/stream/route.ts`

(Also remove the now-empty `apps/app/src/app/api/gateway/stream/` directory.)

#### 4. Redirect `[slug]/` to `/[slug]/sources`

**File**: `apps/app/src/app/(app)/(org)/[slug]/layout.tsx`

The current layout calls `requireOrgAccess(slug)` and renders children. After deleting `(workspace)/page.tsx`, the slug root has no leaf. Add a `(workspace)/page.tsx` (or rename a sibling) that calls Next's `redirect(`/${slug}/sources`)`. Single line:

```tsx
import { redirect } from "next/navigation";

export default async function OrgRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}/sources`);
}
```

Place at: `apps/app/src/app/(app)/(org)/[slug]/(workspace)/page.tsx` (recreated as a 1-purpose redirect — keeps the route-group structure consistent).

If `(workspace)/(manage)/settings/page.tsx` exists separately (the `/[slug]/settings` index page), confirm it is **not** under the deleted tree before assuming it survives. The repo currently has `/[slug]/settings/api-keys`; verify the parent `/settings` index exists and is reachable post-delete. If missing, create a redirect from `/settings` to `/settings/api-keys`.

#### 5. Drop the AI repo-index prompt section

**File to delete**:
- `apps/app/src/ai/prompts/sections/repo-index-context.ts`

**File**: `apps/app/src/ai/prompts/system-prompt.ts`
**Changes**: remove the `repo-index-context` import and its concatenation into the assembled system prompt.

**File**: `apps/app/src/ai/prompts/sections/core-behavior.ts`
**Changes**: line 8 references "the graph and related tools" — rewrite that paragraph to drop the graph reference (search-only behavior remains).

#### 5b. Strip orgRepoIndexes query from `/v1/answer` route

**File**: `apps/app/src/app/(api)/v1/answer/[...v]/route.ts`
**Changes**:
- Remove import `import { orgRepoIndexes } from "@db/app/schema";` (line 4)
- Remove unused `db` import if it becomes orphan (line 3)
- Remove `and, eq` import from `drizzle-orm` (line 13) if no other consumers remain in the file
- Delete the entire `// Fetch cached repo index content` block including the `db.select(...).from(orgRepoIndexes)...` query (lines 63–73)
- Replace `repoIndex: repoIndex?.cachedContent ?? undefined,` (line 78) with `repoIndex: undefined,` — or drop the field entirely if `buildAnswerSystemPrompt` accepts an absent key

This makes `/v1/answer` answer without repo-index context (consistent with the prompt section deletion in step 5).

#### 6. Clean apps/app types barrel

**File**: `apps/app/src/types/index.ts`
**Changes**: delete lines 9–32 wholesale (the Jobs, Entities, and Events sections that re-export from `RouterOutputs["jobs"|"entities"|"events"]`). Keep only the top comment block, the `RouterOutputs` import, and the Sources & Connections section (lines 34–39: `ResourcesList`, `Source`).

#### 6b. Delete the gateway/realtime route handler

**File to delete**:
- `apps/app/src/app/api/gateway/realtime/route.ts`

The route only ever served the 3 `org.event` / `org.entity` / `org.entityEvent` channels that Phase 4 removes. No surviving consumer subscribes. Recreate when the aggregate model wires new channels.

(Also remove the now-empty `apps/app/src/app/api/gateway/realtime/` directory.)

#### 6c. Delete dead workspace shared helper

**File to delete**:
- `apps/app/src/lib/filter-constants.ts` — only consumed by deleted `(workspace)` event-list / filter components.

#### 6d. Surgical sidebar / command-palette / settings-layout edits

**File**: `apps/app/src/components/app-sidebar.tsx`
**Changes**: in `getOrgManageItems` (lines ~63–81), drop the "Jobs" entry (lines ~69–73) that links to `/${orgSlug}/jobs`.

**File**: `apps/app/src/components/command-palette.tsx`
**Changes**: drop the "Jobs" navigation entry (line ~50). Drop entity placeholder strings if they reference deleted surfaces (lines ~158, ~166).

**File**: `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/layout.tsx`
**Changes**: drop the `{ name: "Repo Index", path: "repo-index" }` entry from the SettingsSidebar items array (line ~32). Settings layout itself survives — only the Repo Index nav item disappears.

#### 7. Sweep for any other apps/app consumers of dropped routers

Grep for these tRPC router references in `apps/app/src/`:
- `api.events.list`, `api.events.get`
- `api.entities.list`, `api.entities.get`, `api.entities.getEvents`
- `api.jobs.list`
- `api.repoIndex.status`, `api.repoIndex.activate`, `api.repoIndex.deactivate`
- `api.connections.updateBackfillConfig`

Any remaining call site that wasn't inside the deleted dashboard tree must be deleted or stubbed in this phase. Likely candidates: `apps/app/src/components/*`, `apps/app/src/hooks/*`, sidebar nav items in `apps/app/src/components/sidebar*` (sidebar entries for `/events`, `/entity`, `/jobs`, `/settings/repo-index` need to be removed).

### Success Criteria

#### Automated Verification

- [x] `pnpm install` exits 0 (no package.json changes expected, but lockfile sanity)
- [x] `pnpm --filter @api/app build` exits 0 (build still passes — Phase 2 will tear out dead routers) — note: api/app has no `build` script; verified via `pnpm --filter @api/app typecheck`
- [x] `pnpm --filter @app/app typecheck` exits 0 — the apps/app package compiles (filter target is `@lightfast/app`)
- [x] `pnpm --filter @app/app build` exits 0 (filter target is `@lightfast/app`)
- [x] Root `pnpm check` (Biome) exits 0 — apps/app subtree passes; the failing file is the pre-existing untracked `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs`, unrelated to Phase 1
- [x] `git grep -E '(events-table|event-detail|mailbox-event|mailbox-entity|entity-detail-view|repo-index-config)' -- apps/app/src/` returns nothing
- [x] `git grep '/api/gateway/stream' -- apps/app/src/` returns nothing (the SSE endpoint folder is gone)
- [x] `git grep '/api/gateway/realtime' -- apps/app/src/` returns nothing (the realtime route folder is gone)
- [x] `git grep 'repo-index-context' -- apps/app/src/ai/` returns nothing
- [x] `git grep 'orgRepoIndexes' -- apps/app/src/app/\(api\)/v1/answer/` returns nothing (route no longer reads the dropped table)
- [x] `git grep -E 'api\.(events|entities|jobs|repoIndex)\.' -- apps/app/src/` returns nothing
- [x] `git grep 'updateBackfillConfig' -- apps/app/src/` returns nothing
- [x] `git grep -E '"jobs"|"entities"|"events"' -- apps/app/src/types/index.ts` returns nothing (only Sources/Connections section remains)
- [x] `git grep "filter-constants" -- apps/app/src/` returns nothing

#### Human Review

- [x] Run `pnpm dev` and `pnpm with-desktop-env --print`. Open `https://<wt>.app.lightfast.localhost`, sign in. Land on an org. Confirm the URL becomes `/<slug>/sources` (the redirect fires). → automated proxy: Next.js compiled-app filesystem confirms `[slug]/(workspace)/page.js` is the redirect-to-/sources artifact recreated in 1.4. Source matches exactly.
- [x] In the org sidebar, confirm no broken links remain: no `Events`, `Entities`, `Jobs`, `Repo Index` items. → source-level confirmation: `getOrgManageItems` returns Sources + Settings only; command-palette `getNavItems` returns Explore + Sources + Settings; settings-layout sidebar items are General + API Keys.
- [x] Curl `https://<wt>.app.lightfast.localhost/api/gateway/stream` with `Authorization: Bearer sk-lf-…`. → HTTP 307 to /sign-in (Clerk middleware intercepts unauthenticated requests before route resolution; with auth this would resolve to 404). Authoritative evidence: Next.js `app-paths-manifest.json` and compiled `.next/server/app/` filesystem contain no `gateway/stream`, `gateway/realtime`, `jobs`, `events`, `entity`, or `repo-index` artifacts. `/v1/answer` (POST + GET) loads cleanly and returns 401 with proper error envelope, confirming the orgRepoIndexes strip is correct (no 500).

---

## Phase 2: Strip api/app tRPC

### Overview

Delete the 4 dead tRPC routers in `api/app`, surgically remove the `updateBackfillConfig` procedure from the `connections` router, update the root router. The `recordActivity` Inngest workflow stays (it operates on `orgUserActivities` which is kept).

### Changes Required

#### 1. Delete tRPC router files

**Files to delete**:
- `api/app/src/router/org/events.ts`
- `api/app/src/router/org/entities.ts`
- `api/app/src/router/org/jobs.ts`
- `api/app/src/router/org/repo-index.ts`

#### 2. Update root router

**File**: `api/app/src/root.ts`
**Changes**: remove the `events`, `entities`, `jobs`, `repoIndex` keys from the assembled `appRouter` (under `orgRouter` or wherever they're nested). Remove the `import` statements for the deleted files.

Reference shape (for guidance — verify against actual file):

```ts
// before
export const orgRouter = createTRPCRouter({
  organization: organizationRouter,
  connections: connectionsRouter,
  entities: entitiesRouter,    // ← delete
  events: eventsRouter,        // ← delete
  jobs: jobsRouter,            // ← delete
  orgApiKeys: orgApiKeysRouter,
  repoIndex: repoIndexRouter,  // ← delete
});

// after
export const orgRouter = createTRPCRouter({
  organization: organizationRouter,
  connections: connectionsRouter,
  orgApiKeys: orgApiKeysRouter,
});
```

#### 3. Drop `updateBackfillConfig` from connections router

**File**: `api/app/src/router/org/connections.ts` (or wherever the procedure lives — verify)
**Changes**: remove the `updateBackfillConfig` procedure entirely. Remove any imports it brought in (e.g., backfill config Zod schemas that no other procedure uses).

#### 4. Verify recordActivity workflow still wires

**File**: `api/app/src/inngest/workflow/infrastructure/record-activity.ts`
**Verification**: open the file. Confirm imports do not reference dropped routers/types. Confirm `api/app/src/inngest/index.ts` still registers it.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @api/app typecheck` exits 0
- [ ] `pnpm --filter @api/app build` exits 0
- [ ] `pnpm --filter @app/app typecheck` exits 0 (apps/app's tRPC client must not reference dropped procedures — Phase 1's grep should have caught these)
- [ ] `pnpm --filter @app/app build` exits 0
- [ ] Root `pnpm check` exits 0
- [ ] `git grep -E "(eventsRouter|entitiesRouter|jobsRouter|repoIndexRouter)" -- api/app/src/` returns nothing
- [ ] `git grep "updateBackfillConfig" -- api/` returns nothing in api/app (still present in dashboard? No — Phase 1 deleted those callers)

#### Human Review

- [ ] `pnpm dev`, sign in, navigate to `/<slug>/sources/new`. Initiate the GitHub OAuth popup. → expected: popup opens, OAuth completes, returns to `/provider/github/connected`. Confirms `connections.getAuthorizeUrl` and the connected callback both still work.
- [ ] On `/<slug>/sources`, confirm an existing GitHub install renders with the resource list. → expected: list of repos appears (data from `connections.resources.list`). Confirms `connections.list` and `connections.resources.list` are not coupled to dropped routers.

---

## Phase 3: Strip api/platform Pipeline + lib Helpers + Backfill tRPC

### Overview

Delete 9 Inngest functions + their event schemas, edit the HTTP webhook entry to drop the `inngest.send` call, delete the `backfill` tRPC router, surgically prune `connections` on platform-side, delete the lib/ helpers that powered the deleted Inngest functions.

### Changes Required

#### 1. Delete Inngest function files

**Files to delete** (all under `api/platform/src/inngest/functions/`):
- `ingest-delivery.ts`
- `platform-event-store.ts`
- `platform-entity-graph.ts`
- `platform-entity-embed.ts`
- `platform-agent-triage.ts`
- `platform-repo-index-sync.ts`
- `platform-backfill-orchestrator.ts`
- `platform-entity-worker.ts`
- `delivery-recovery.ts`

#### 2. Update Inngest registry

**File**: `api/platform/src/inngest/index.ts`
**Changes**: remove imports + registrations for all 9 deleted functions. The exported `functions` array should contain exactly 3 entries: `connectionLifecycle`, `healthCheck`, `tokenRefresh`. Keep the `client` and `on-failure-handler` re-exports.

#### 3. Trim platform event schemas (DO NOT DELETE)

**File**: `api/platform/src/inngest/schemas/platform.ts`

The Inngest `client.ts` registers events from this map; surviving 3 functions emit/listen on `platform/connection.lifecycle` and `platform/health.check.requested`. **Do not delete the file** — surgically trim:

- Remove imports: `postTransformEventSchema` from `@repo/app-providers/contracts`, `backfillTriggerPayload` from `@repo/app-providers/client`, `ingestionSourceSchema` from `@repo/app-validation`. Drop the `z` import only if no remaining schemas need it.
- Delete event entries: `platform/backfill.run.requested`, `platform/backfill.entity.requested`, `platform/backfill.run.cancelled`, `platform/webhook.received`, `platform/event.capture`, `platform/event.stored`, `platform/entity.upserted`, `platform/entity.graphed`, `platform/agent.decided`.
- Keep event entries: `platform/connection.lifecycle`, `platform/health.check.requested`.

**File**: `api/platform/src/inngest/functions/connection-lifecycle.ts`
**Changes**: drop the `inngest.send("platform/backfill.run.cancelled", …)` call (around line 78). No consumer remains; emitting an orphan event is dead code.

(The `schemas/` directory survives with this single trimmed file.)

#### 4. Strip the inngest.send call from webhook ingest route

**File**: `apps/platform/src/app/api/ingest/[provider]/route.ts`
**Changes**: in `handleStandardWebhook`, remove the `inngest.send("platform/webhook.received", { id: …, data: … })` call (currently around lines 180–194). Remove the `inngest` import if it becomes unused. The `gateway_webhook_deliveries` insert with `status="received"` (lines 166–178) **stays unchanged** — that's the persistence record.

The `status` will remain `"received"` forever (no consumer transitions it to `"processed"`). Acceptable barebones state.

#### 5. Delete platform tRPC backfill router

**File to delete**:
- `api/platform/src/router/platform/backfill.ts`

**File**: `api/platform/src/root.ts` (or wherever the platform router is assembled)
**Changes**: remove the `backfill` key from the platform router and its import.

#### 6. Surgical edit: drop backfill procedures from platform connections router

**File**: `api/platform/src/router/platform/connections.ts`
**Changes**: remove `listBackfillRuns` and `upsertBackfillRun` procedures. Keep `list`, `getToken`, `disconnect`, `getAuthorizeUrl`. Remove imports/Zod schemas only those procedures used.

#### 7. Delete lib helpers

**Files to delete** (all under `api/platform/src/lib/`):
- `edge-resolver.ts`
- `narrative-builder.ts`
- `scoring.ts`
- `entity-extraction-patterns.ts`
- `jobs.ts` (verified orphan — only consumers were `platform-event-store.ts` and `on-failure-handler.ts`, both deleted)
- `transform.ts` (verified orphan — only consumer was deleted `ingest-delivery.ts`)
- `constants.ts` (verified orphan — only consumer was deleted `platform-entity-worker.ts`)

**Verify survives**: `cache.ts` (used by OAuth state), `encryption.ts` (used by `connectionLifecycle` + `tokenRefresh`), `jwt.ts`, `token-helpers.ts` (used by surviving `healthCheck`), `token-store.ts` (used by `tokenRefresh`), `provider-configs.ts` (used by `connectionLifecycle` + `healthCheck` + `tokenRefresh`).

#### 8. Delete on-failure-handler

**File to delete**: `api/platform/src/inngest/on-failure-handler.ts`

Verified: only consumers were `platform-event-store.ts`, `platform-entity-graph.ts`, `platform-entity-embed.ts` — all deleted in this phase. The 3 surviving functions don't use it.

If `api/platform/src/inngest/index.ts` re-exports `on-failure-handler`, drop that re-export too.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @api/platform typecheck` exits 0
- [ ] `pnpm --filter @api/platform build` exits 0
- [ ] `pnpm --filter @app/platform typecheck` exits 0
- [ ] `pnpm --filter @app/platform build` exits 0
- [ ] Root `pnpm typecheck` exits 0 across all packages (`@db/app` schema files still exist; tRPC types resolve)
- [ ] Root `pnpm check` exits 0
- [ ] `git grep -E "(platformEventStore|platformEntityGraph|platformEntityEmbed|platformAgentTriage|platformRepoIndexSync|platformBackfillOrchestrator|platformEntityWorker|deliveryRecovery|ingestDelivery)" -- api/` returns nothing
- [ ] `git grep -E "(edgeResolver|narrativeBuilder|entityExtractionPatterns|computeSignificance|scoreEvent)" -- api/` returns nothing
- [ ] `git grep "platform/webhook.received" -- apps/platform/src/` returns nothing
- [ ] `git grep "platform/backfill" -- api/platform/src/` returns nothing
- [ ] `git grep -E "(postTransformEventSchema|backfillTriggerPayload|ingestionSourceSchema)" -- api/platform/src/inngest/schemas/` returns nothing
- [ ] `ls api/platform/src/inngest/functions/` lists exactly 3 files: `connection-lifecycle.ts`, `health-check.ts`, `token-refresh.ts`
- [ ] `ls api/platform/src/inngest/schemas/platform.ts` exists (file kept; only the schema body is trimmed)
- [ ] `ls api/platform/src/inngest/on-failure-handler.ts` returns "no such file"
- [ ] `ls api/platform/src/lib/` shows: cache.ts, encryption.ts, jwt.ts, token-helpers.ts, token-store.ts, provider-configs.ts (and oauth/ subdir). No edge-resolver, narrative-builder, scoring, entity-extraction-patterns, jobs, transform, constants.

#### Human Review

- [ ] Boot `pnpm dev:platform` and `pnpm dev:inngest`. Open Inngest dev UI (typically `http://localhost:8288`). → expected: app `lightfast-platform` shows exactly 3 functions registered.
- [ ] Open `pnpm dev:app`'s Inngest UI app `lightfast-app`. → expected: shows exactly 1 function (`recordActivity`).
- [ ] Send a fake GitHub webhook with `curl -X POST` to `http://localhost:4112/api/ingest/github` with the appropriate HMAC header (or use a captured payload). → expected: HTTP 202 returned, a row appears in `lightfast_gateway_webhook_deliveries` with `status="received"`. No Inngest run is triggered (Inngest UI shows zero new events).
- [ ] Query `lightfast_gateway_webhook_deliveries` via Drizzle Studio (`pnpm dev:studio`). → expected: the new row exists; `payload` JSONB contains the body.

---

## Phase 4: Strip @repo/app-providers + @repo/dotlightfast + Realtime Channels

### Overview

Delete the per-event transformer system, EdgeRules, PostTransformEvent contract, runtime dispatch/validation/sanitize, the 4 backfill paginators. Edit each provider's `index.ts` to drop the now-removed fields. Edit `provider/primitives.ts` and `provider/shape.ts` to drop the type definitions. Delete the entire `@repo/dotlightfast` package. Edit `@repo/app-upstash-realtime/src/index.ts` to drop the entity-related channel schemas.

### Changes Required

#### 1. Delete @repo/app-providers transformer + edge layer

**Files to delete**:
- `packages/app-providers/src/runtime/dispatch.ts`
- `packages/app-providers/src/runtime/validation.ts`
- `packages/app-providers/src/runtime/sanitize.ts`
- `packages/app-providers/src/contracts/event.ts` (PostTransformEvent type + EntityRef + EntityRelation)
- `packages/app-providers/src/providers/github/transformers.ts`
- `packages/app-providers/src/providers/linear/transformers.ts`
- `packages/app-providers/src/providers/sentry/transformers.ts`
- `packages/app-providers/src/providers/vercel/transformers.ts`
- `packages/app-providers/src/providers/github/backfill.ts`
- `packages/app-providers/src/providers/linear/backfill.ts`
- `packages/app-providers/src/providers/sentry/backfill.ts`
- `packages/app-providers/src/providers/vercel/backfill.ts`

After delete, also remove the `runtime/` and `contracts/` directories if they're empty. **Keep** `runtime/verify/hmac.ts`, `runtime/verify/ed25519.ts`, `runtime/verify/index.ts`, `runtime/jwt.ts` — these are signature verification, used by the surviving webhook ingest route.

#### 2. Edit provider primitives + shape

**File**: `packages/app-providers/src/provider/primitives.ts`
**Changes**: delete the `EdgeRule` interface (lines ~51-70 per research). Delete the `Transform`, `EventTransformer`, or similar type definitions if they only typed the removed transformers. Keep `WebhookDef`, `OAuthDef`, `ApiDef`, and any signature-verification primitives.

**File**: `packages/app-providers/src/provider/shape.ts`
**Changes**: in `BaseProviderFields`, drop the `edgeRules?: EdgeRule[]` field, drop `transformers` field, drop `backfill` paginator field. Keep auth, schemas, signature verification, OAuth, API client fields.

#### 3. Edit each provider's index.ts

**Files**: `packages/app-providers/src/providers/{github,linear,sentry,vercel,apollo}/index.ts`
**Changes per file**:
- Drop the `transformers: { … }` block
- Drop the `edgeRules: [ … ]` block
- Drop the `backfill: createBackfillFor…` invocation
- Remove the corresponding imports
- Keep `auth`, `schemas`, `webhookDef` (where applicable), `signatureVerification`, `apiClient`

`apollo/index.ts` already has `edgeRules: []` and no transformers — drop the empty `edgeRules` line.

#### 4. Update @repo/app-providers top-level barrel

**File**: `packages/app-providers/src/index.ts` — verified specific lines to drop:

- Line 12: `export * from "./contracts/event";` — DROP (the re-exported file is being deleted)
- Line 100: `EdgeRule` type re-export from `./provider/primitives` — DROP (the type is being deleted in primitives.ts)
- Lines 158–161: `transformGitHubIssue`, `transformGitHubIssueComment`, `transformGitHubPullRequest` re-exports — DROP
- Lines 209–214: `transformLinearComment`, `transformLinearCycle`, `transformLinearIssue`, `transformLinearProject`, `transformLinearProjectUpdate` re-exports — DROP
- Lines 254–258: `transformSentryError`, `transformSentryEventAlert`, `transformSentryIssue`, `transformSentryMetricAlert` re-exports — DROP
- Line 289: `transformVercelDeployment` re-export — DROP
- Line 328: `export { transformWebhookPayload } from "./runtime/dispatch";` — DROP (file deleted)
- Lines 332–337: `encodeHtmlEntities`, `sanitizeBody`, `sanitizeContent`, `sanitizeTitle`, `truncateWithEllipsis` re-exports — DROP (file deleted)
- Lines 338–342: `logValidationErrors`, `sanitizePostTransformEvent`, `validatePostTransformEvent` re-exports — DROP (file deleted)

**Verify** other `contracts/*` barrel lines (11, 13, 14): `./contracts/backfill`, `./contracts/gateway`, `./contracts/wire` — confirm whether their consumers (`api/platform/src/lib/oauth/*`, the surviving connections router) still need them. If `backfill.ts` only typed deleted code, drop line 11 too. Audit before edit.

**File**: `packages/app-providers/src/contracts.ts` (the contracts barrel) — drop the `export * from "./contracts/event"` if present, mirror the cleanup above.

Surviving public surface: `defineWebhookProvider`, `WebhookDef`, OAuth definitions, signature verify (`deriveVerifySignature`, `hmac`, `ed25519`, crypto helpers), payload `schemas` per provider, OAuth `auth` definitions per provider, API client per provider, registry helpers.

#### 4b. Delete provider tests for transformers + backfill + dispatch

**Files to delete**:
- `packages/app-providers/src/runtime/dispatch.test.ts`
- `packages/app-providers/src/providers/github/backfill.test.ts`
- `packages/app-providers/src/providers/github/backfill-round-trip.test.ts`
- `packages/app-providers/src/providers/linear/backfill.test.ts`
- `packages/app-providers/src/providers/sentry/backfill.test.ts`
- `packages/app-providers/src/providers/vercel/transformers.test.ts`
- `packages/app-providers/src/providers/vercel/backfill.test.ts`
- `packages/app-providers/src/client/event-labels-sync.test.ts` (verify — may depend on deleted entity tables)
- `packages/app-providers/src/provider/categories-sync.test.ts` (verify — may depend on deleted entity categories)

**Verify before delete** (do not delete blindly):
- `packages/app-providers/src/providers/{github,linear,sentry,vercel}/index.test.ts` — these exercise the full provider definition. After Phase 4's index.ts edits drop transformers/backfill, the tests may still be useful for OAuth/schemas/signature paths. Run `pnpm --filter @repo/app-providers test` after delete to confirm.
- `packages/app-providers/src/registry.test.ts` — likely survives; check.
- `packages/app-providers/src/crypto.test.ts` — survives (crypto is signature verification).

#### 5. Delete @repo/dotlightfast package

**Files to delete** (entire package):
- `packages/dotlightfast/src/index.ts`
- `packages/dotlightfast/src/parse.ts`
- `packages/dotlightfast/src/parse.test.ts`
- `packages/dotlightfast/src/schema.ts`
- `packages/dotlightfast/src/triage.ts`
- `packages/dotlightfast/src/types.ts`
- `packages/dotlightfast/package.json`
- `packages/dotlightfast/tsconfig.json`
- `packages/dotlightfast/vitest.config.ts`

Then `rm -rf packages/dotlightfast`.

**File**: `pnpm-workspace.yaml`
**Changes**: if `packages/dotlightfast` is listed explicitly (rather than via glob), remove the entry. If listed via `packages/*` glob, no change needed.

**Sweep**: `git grep "@repo/dotlightfast"` should now return nothing. If anything remains, it's a missed consumer (most likely Phase 3 missed cleaning a `platformAgentTriage` or `platformRepoIndexSync` import — verify Phase 3's deletion was complete).

#### 6. Edit @repo/app-upstash-realtime channel schemas

**File**: `packages/app-upstash-realtime/src/index.ts`
**Changes**: delete the `org.event` channel schema (uses `postTransformEventSchema`), `org.entity` channel schema, `org.entityEvent` channel schema. Drop the `postTransformEventSchema` import. The exports that remain: the channel registry helper, `client.tsx` provider, and any package-shell utilities. The package shell stays.

If after this edit the file is essentially empty (only re-exports `client.tsx`), still keep the file — the package needs an entry point. Future work can register new channels here.

**File**: `packages/app-upstash-realtime/src/client.tsx`
**Verification**: confirm the React provider does not depend on the deleted channel schemas. It typically takes channels as generics, so it should compile unchanged.

#### 7. Clean orphan schemas in @repo/app-validation

The package is kept (per "What We're NOT Doing"), but several schema files have no surviving consumers after Phases 1–4. Delete the files and update barrels.

**Files to delete** (under `packages/app-validation/src/schemas/`):
- `neural.ts` — `EntityVectorMetadata`, `NeuralFailureOutput`, `WorkflowOutput`. Verify `apps/app/src/lib/search.ts` does NOT actually depend on `EntityVectorMetadata` (agent confirmed it doesn't). If search.ts uses a different schema (`searchResultSchema` or similar), neural.ts is fully orphan.
- `job.ts` — `JobStatus`, only consumed by deleted `org-workflow-runs` schema and deleted `jobs` router.
- `workflow-io.ts` — `WorkflowInput`/`WorkflowOutput`, only consumed by deleted `org-workflow-runs` schema.
- `ingestion.ts` — `ingestionSourceSchema`, only consumed by deleted `platform.ts` event schemas (Phase 3) and deleted `org-events`/`org-ingest-logs` (Phase 5).
- `entities.ts` — `EntityCategory`/`ENTITY_CATEGORIES`, only consumed by deleted `org-entities` schema and deleted `entities` router.

**Conditional delete** (verify first):
- `store.ts` — flag for review. If only the deleted neural pipeline used it, delete; else keep.

**File**: `packages/app-validation/src/schemas/index.ts`
**Changes**: drop the re-export lines for the 5 (or 6) deleted schema files.

**File**: `packages/app-validation/src/index.ts`
**Changes**: drop top-level re-exports for `entities`, `ingestion`, `job`, `neural`, `workflow-io` (and `store` if dropped).

**Sweep**: `git grep -E "(EntityVectorMetadata|JobStatus|WorkflowInput|WorkflowOutput|ingestionSourceSchema|EntityCategory|ENTITY_CATEGORIES|NeuralFailureOutput)"` should return only lines in `thoughts/`, `*.md`, or `*.sql`.

### Success Criteria

#### Automated Verification

- [ ] `pnpm install` exits 0 (after pnpm-workspace.yaml change, lockfile regenerates)
- [ ] `pnpm --filter @repo/app-providers typecheck` exits 0
- [ ] `pnpm --filter @repo/app-providers build` exits 0
- [ ] `pnpm --filter @repo/app-upstash-realtime typecheck` exits 0
- [ ] `pnpm --filter @repo/app-upstash-realtime build` exits 0
- [ ] `pnpm --filter @api/platform typecheck` exits 0 (api/platform consumes app-providers via OAuth callback + ingest route)
- [ ] `pnpm --filter @api/platform build` exits 0
- [ ] `pnpm --filter @app/platform typecheck` exits 0
- [ ] `pnpm --filter @app/platform build` exits 0
- [ ] Root `pnpm typecheck` exits 0
- [ ] Root `pnpm check` exits 0
- [ ] `git grep "PostTransformEvent" -- '!*.md' '!thoughts/'` returns nothing
- [ ] `git grep "EdgeRule" -- '!*.md' '!thoughts/'` returns nothing
- [ ] `git grep "@repo/dotlightfast" -- '!*.md' '!thoughts/'` returns nothing
- [ ] `git grep "postTransformEventSchema" -- '!*.md' '!thoughts/'` returns nothing
- [ ] `git grep "org.event\|org.entity\|org.entityEvent" -- packages/app-upstash-realtime/src/` returns nothing
- [ ] `ls packages/app-providers/src/runtime/` shows only `verify/`, `jwt.ts`, `crypto.ts`, `event-norm.ts` (no dispatch, validation, sanitize)
- [ ] `git grep -E "(transformGitHub|transformLinear|transformSentry|transformVercel)" -- packages/app-providers/src/index.ts` returns nothing
- [ ] `git grep "transformWebhookPayload" -- packages/app-providers/src/index.ts` returns nothing
- [ ] `git grep -E "(EntityVectorMetadata|ingestionSourceSchema|EntityCategory)" -- packages/app-validation/src/` returns nothing
- [ ] `pnpm --filter @repo/app-validation typecheck` exits 0
- [ ] `pnpm --filter @repo/app-validation build` exits 0

#### Human Review

- [ ] `pnpm dev:platform`. POST a real GitHub webhook payload (use a captured fixture from `packages/webhook-schemas/` or copy from a recent prod delivery) to `http://localhost:4112/api/ingest/github` with valid HMAC. → expected: HTTP 202, row in `gateway_webhook_deliveries`, no error in platform logs. Confirms the webhook ingest route's signature verification + payload parse + `webhookDef.parsePayload` still works after stripping transformers.
- [ ] Repeat with a Linear webhook. → expected: same.
- [ ] Repeat with a Sentry webhook. → expected: same.
- [ ] Repeat with a Vercel webhook (HMAC-SHA1). → expected: same.

---

## Phase 5: Strip db/app Schema TS Files

### Overview

Delete the 7 schema TS files for the dropped tables. Edit the 3 barrel files to drop their re-exports. **Do not run `pnpm db:generate`.** Tables remain physically in Postgres.

### Changes Required

#### 1. Delete schema TS files

**Files to delete** (all under `db/app/src/schema/tables/`):
- `org-events.ts`
- `org-entities.ts`
- `org-event-entities.ts`
- `org-entity-edges.ts`
- `org-ingest-logs.ts`
- `org-repo-indexes.ts`
- `gateway-backfill-runs.ts`

#### 2. Update tables barrel

**File**: `db/app/src/schema/tables/index.ts`
**Changes**: remove the 7 `export * from "./org-events"` (etc.) lines. Remaining exports: `gateway-installations`, `gateway-tokens`, `gateway-lifecycle-log`, `gateway-webhook-deliveries`, `org-integrations`, `org-workflow-runs`, `org-user-activities`, `org-api-keys`.

#### 3. Update schema barrel

**File**: `db/app/src/schema/index.ts`
**Changes**: remove any direct re-exports of `orgEvents`, `orgEntities`, `orgEventEntities`, `orgEntityEdges`, `orgIngestLogs`, `orgRepoIndexes`, `gatewayBackfillRuns` and their related types (`OrgEvent`, `OrgEntity`, etc.). If the file exports `* from "./tables"`, the barrel update in step 2 covers it.

#### 4. Update relations file

**File**: `db/app/src/schema/relations.ts`
**Changes** — concrete:

- Drop the imports for `orgEvents`, `orgEntities`, `orgEventEntities`, `orgEntityEdges`, `orgIngestLogs`, `orgRepoIndexes`, `gatewayBackfillRuns` (the relations file imports the table objects to wire up Drizzle relations).
- Delete the `orgEventsRelations`, `orgEntitiesRelations`, `orgEventEntitiesRelations`, `orgEntityEdgesRelations`, `orgIngestLogsRelations`, `orgRepoIndexesRelations`, `gatewayBackfillRunsRelations` declarations.
- In `gatewayInstallationsRelations`: drop the `backfillRuns: many(gatewayBackfillRuns)` field. Keep `tokens`, `orgIntegrations`, `lifecycleLogs`.
- In `orgIntegrationsRelations`: drop any `ingestLogs: many(orgIngestLogs)`, `events: many(orgEvents)`, `entities: many(orgEntities)`, `repoIndexes: many(orgRepoIndexes)` fields if present. Keep gateway/installation references.
- Verify no other surviving relations file references the dropped tables (e.g., `gatewayWebhookDeliveriesRelations` should not reference `orgEvents` or `orgIngestLogs`).

Keep: `gatewayInstallationsRelations` (trimmed), `gatewayLifecycleLogsRelations`, `gatewayTokensRelations`, `gatewayWebhookDeliveriesRelations`, `orgIntegrationsRelations` (trimmed), `orgWorkflowRunsRelations` (if exists), `orgUserActivitiesRelations` (if exists), `orgApiKeysRelations` (if exists).

#### 5. Migration discipline guard

**File**: `db/app/README.md` (or `db/CLAUDE.md`)
**Changes** (optional but recommended): add a paragraph at the top:

```
> **2026-05-06 BAREBONES RESET**: 7 tables (`org_events`, `org_entities`, `org_event_entities`, `org_entity_edges`, `org_ingest_logs`, `org_repo_indexes`, `gateway_backfill_runs`) were intentionally orphaned in Postgres — schema TS files were deleted but no migration was generated. The next `pnpm db:generate` run will produce a drop migration for these tables. Inspect the generated SQL before applying. Data persists physically until a future plan decides to apply the drop.
```

This is documentation, not enforcement. The user is the only one who runs `pnpm db:generate`.

#### 6. Sweep for any remaining schema imports

`git grep -E "(orgEvents|orgEntities|orgEventEntities|orgEntityEdges|orgIngestLogs|orgRepoIndexes|gatewayBackfillRuns)" -- '!*.md' '!thoughts/' '!*.sql'` should return nothing. If anything remains (likely a stray import in a util file we missed), delete or rewrite it.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @db/app typecheck` exits 0
- [ ] `pnpm --filter @db/app build` exits 0 (if @db/app has a build step)
- [ ] Root `pnpm typecheck` exits 0
- [ ] Root `pnpm check` exits 0
- [ ] `pnpm --filter @api/platform typecheck` exits 0
- [ ] `pnpm --filter @api/app typecheck` exits 0
- [ ] `pnpm --filter @app/app typecheck` exits 0
- [ ] `pnpm --filter @app/platform typecheck` exits 0
- [ ] `git grep -E "(orgEvents|orgEntities|orgEventEntities|orgEntityEdges|orgIngestLogs|orgRepoIndexes|gatewayBackfillRuns)" -- '!*.md' '!thoughts/' '!*.sql'` returns nothing
- [ ] `ls db/app/src/schema/tables/` lists exactly 8 files: `gateway-installations.ts`, `gateway-tokens.ts`, `gateway-lifecycle-log.ts`, `gateway-webhook-deliveries.ts`, `org-integrations.ts`, `org-workflow-runs.ts`, `org-user-activities.ts`, `org-api-keys.ts`, plus `index.ts`
- [ ] `pnpm db:generate --check` (if such a flag exists) reports a non-empty diff (the dropped tables) — confirm the diff matches expectation. Do **NOT** apply the migration. If the flag doesn't exist, just confirm `pnpm db:generate` would generate a drop migration by inspecting the proposed SQL output.

#### Human Review

- [ ] Open `pnpm dev:studio` (Drizzle Studio). → expected: 8 tables visible (no `lightfast_org_events`, `lightfast_org_entities`, `lightfast_org_event_entities`, `lightfast_org_entity_edges`, `lightfast_org_ingest_logs`, `lightfast_org_repo_indexes`, `lightfast_gateway_backfill_runs` in the Drizzle UI). The actual Postgres database still has those tables (verify via `psql` or another client).
- [ ] Run `psql $DATABASE_URL -c "\\dt lightfast_*"`. → expected: lists all 15 tables physically present (the 8 kept + the 7 orphaned). Confirms the data is preserved per the user's choice.

---

## Phase 6: Verify + Cleanup Orphans

### Overview

Whole-repo verification, smoke-test the surviving surfaces end-to-end, identify and remove any orphaned dependencies / env vars left behind.

### Changes Required

#### 1. Full-repo automated verification

Run sequentially:

```bash
pnpm install
pnpm check
pnpm typecheck
pnpm build:app
pnpm build:platform
# www and desktop did not change but verify they still build
pnpm --filter @app/www build
pnpm --filter @app/desktop build  # or whatever the desktop build invocation is
```

Each must exit 0.

#### 2. Identify orphaned dependencies

For each affected package.json (`apps/app`, `apps/platform`, `api/app`, `api/platform`, `packages/app-providers`, `packages/app-upstash-realtime`), run knip or eyeball:

```bash
pnpm dlx knip
```

Common orphans expected after teardown:
- `apps/app/package.json`: possibly `@repo/dotlightfast` (no — that was dropped from the package; verify no other consumer remains). Possibly `eventsource` or other SSE-related.
- `api/platform/package.json`: `@ai-sdk/anthropic` (used by agent triage), `@anthropic-ai/sdk` (same), `@repo/dotlightfast`, `nanoid` (might have been triage-only), `ai` (if only triage used it). Verify each before removing.
- `apps/platform/package.json`: probably no change.
- `packages/app-providers/package.json`: any deps that only the deleted backfill paginators used (check pagination libraries, etc.).

Remove only confirmed-unused deps. Run `pnpm install` after.

#### 3. Identify orphaned env vars

Grep `apps/{app,platform}/env.ts` and any `.env.example` for env vars that are only consumed by deleted code. Likely candidates:
- `ANTHROPIC_API_KEY` (used by `platformAgentTriage`)
- `AI_GATEWAY_API_KEY` (used by triage if routed via gateway — verify)
- `COHERE_API_KEY` may stay (search.ts still uses, even if empty)
- `PINECONE_API_KEY` stays (search.ts still uses)

Remove only confirmed-unused env vars. Update env.ts schemas.

#### 4. Identify orphaned scripts

Look in `package.json` scripts and `scripts/` for any that referenced deleted code (e.g., a `pnpm webhook:replay` script if one existed). Remove.

#### 5. Update CLAUDE.md if the architecture diagram references dropped surfaces

**File**: `CLAUDE.md`
**Changes**: the architecture diagram does not currently mention the neural pipeline by name, so likely no change required. Verify no doc text references `org_events`, `events table`, etc.

### Success Criteria

#### Automated Verification

- [ ] `pnpm install` exits 0
- [ ] `pnpm check` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm build:app` exits 0
- [ ] `pnpm build:platform` exits 0
- [ ] `pnpm --filter @app/www build` exits 0
- [ ] `pnpm --filter @app/desktop build` exits 0 (or whatever the equivalent is)
- [ ] `pnpm dlx knip` reports zero unused dependencies in changed package.json files
- [ ] `git grep -E "(PostTransformEvent|EdgeRule|edgeResolver|narrativeBuilder|dotlightfast|orgEvents|orgEntities|orgEntityEdges|orgIngestLogs|orgRepoIndexes|gatewayBackfillRuns|platformEventStore|platformEntityGraph|platformEntityEmbed|platformAgentTriage|platformRepoIndexSync|platformBackfillOrchestrator|platformEntityWorker|deliveryRecovery|ingestDelivery|repo-index-context|events-table|mailbox-event)" -- '!*.md' '!thoughts/' '!*.sql' '!CHANGELOG*'` returns nothing.
- [ ] `pnpm dev:doctor` passes (Postgres + Redis container health).

#### Human Review

- [ ] **Auth flow**: `pnpm dev`. Open `https://<wt>.app.lightfast.localhost`. Click sign in. Complete OTP or GitHub OAuth. Land on `/[slug]/sources` (redirect from `[slug]` root). → expected: full sign-in flow works, sources page renders.
- [ ] **OAuth connection flow**: from `/sources/new`, initiate a GitHub install. Complete OAuth in popup. Land on `/provider/github/connected`. Return to `/sources`. → expected: new install appears, resource list loads.
- [ ] **Webhook ingest**: send a real GitHub webhook from a test repo (or `curl` a fixture) to `https://<wt>.app.lightfast.localhost/api/ingest/github`. → expected: HTTP 202, new row in `lightfast_gateway_webhook_deliveries` with `status="received"` and `payload` JSONB populated.
- [ ] **API key issuance**: from `/[slug]/settings/api-keys`, create a new API key. Copy it. → expected: key appears with `sk-lf-…` prefix.
- [ ] **/v1/answer happy path**: `curl -X POST -H 'Authorization: Bearer sk-lf-…' -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"What recent issues are there?"}]}' https://<wt>.app.lightfast.localhost/v1/answer/v1/chat`. → expected: HTTP 200, agent streams a reply (likely "I don't have any data" since vectors are empty), no 5xx errors. Confirms auth + agent + Pinecone wrappers all wired.
- [ ] **/v1 oRPC search**: `curl -X POST -H 'Authorization: Bearer sk-lf-…' -d '{"query":"test"}' https://<wt>.app.lightfast.localhost/v1/search`. → expected: HTTP 200, empty result array, no errors.
- [ ] **Inngest dashboard**: open the Inngest dev UI. → expected: app `lightfast-app` shows 1 function (`recordActivity`), app `lightfast-platform` shows 3 functions (`connectionLifecycle`, `healthCheck`, `tokenRefresh`). No others.
- [ ] **Sidebar nav**: in the org `/[slug]/sources`, confirm the sidebar is clean. → expected: no broken links to `/events`, `/entity`, `/jobs`, `/settings/repo-index`. Only sources, settings, account-related items.

---

## Testing Strategy

### Unit / Integration Tests

The teardown does not add tests. Existing tests in changed surfaces:
- `apps/app/src/__tests__/sign-in.test.ts`, `cors.test.ts`, `origins.test.ts` — should pass unchanged.
- `apps/app/src/app/(auth)/_actions/sign-up.test.ts` — should pass unchanged.
- `apps/app/src/app/api/desktop/auth/{code,exchange}/route.test.ts` — should pass unchanged.
- `api/app/src/__tests__/resolve-clerk-session.test.ts` — should pass unchanged.
- `apps/desktop/src/main/__tests__/{auth-flow,auth-focus-gate}.test.ts` — should pass unchanged (desktop is untouched).
- `packages/dotlightfast/src/parse.test.ts` — DELETED with the package.

Any test that imports a dropped router / type / function fails the typecheck step in its phase. If a phase's typecheck fails, fix the test (delete or re-target) before progressing.

### End-to-End Smoke (Phase 6 Human Review covers)

The Phase 6 Human Review checklist is the integration test. There are no automated e2e harnesses in this plan.

## Performance Considerations

- **Bundle size**: `apps/app` shrinks meaningfully — entire dashboard tree, Realtime channel schemas, AI prompt section gone.
- **Cold start**: `apps/platform` registers 3 Inngest functions instead of 12 — faster `/api/inngest` introspection.
- **DB load**: drops to gateway tables + `org_integrations` + `org_workflow_runs` + `org_user_activities` + `org_api_keys` only. No event-stream writes.
- **Webhook ingest latency**: HTTP route now does only insert + return. No Inngest fan-out. Lower P50/P99 latency on the webhook endpoint, at the cost of: nothing happens after delivery is recorded.

## Migration Notes

**Data preservation**: the 7 dropped tables remain physically in Postgres with all data intact. The `lightfast_org_events`, `lightfast_org_entities`, `lightfast_org_event_entities`, `lightfast_org_entity_edges`, `lightfast_org_ingest_logs`, `lightfast_org_repo_indexes`, `lightfast_gateway_backfill_runs` rows are preserved.

**Future db:generate**: the next time anyone runs `pnpm db:generate` (for an unrelated schema change), it will produce a migration that drops the 7 orphaned tables. **Inspect the generated SQL before committing**. If the data is still wanted, generate-and-revert the drop hunks; otherwise commit the drop migration.

**Inngest cloud**: the 9 deleted functions disappear from the Inngest dashboard on next deploy. No retroactive cleanup of historical run data is performed by Inngest itself — past runs of `platformEventStore`, etc., remain in the Inngest UI as historical records.

**Consumers of the public SDK**: per the 2026-04-20 research, the in-tree SSE consumer (`core/cli/src/commands/listen.ts`) was already deleted in commit `aa53d4258` (PR #620, 2026-04-24). External `sk-lf-…` SDK users — if any exist — will get HTTP 404 on `/api/gateway/stream`. The remaining `/v1` oRPC + `/v1/answer` endpoints are unchanged.

**Rollback**: revert is a single `git revert <merge-commit>`. No DB migrations applied means no DB rollback needed. Inngest cloud will re-register the 9 functions on the next deploy of the reverted code.

## References

- Source research: `thoughts/shared/research/2026-04-20-lightfast-2-barebones-rearchitecture-baseline.md`
- Broader context: `thoughts/shared/research/2026-05-06-architecture-reset-barebones.md` (the doc that explicitly defers to this plan)
- Authoritative neural-pipeline inventory: `thoughts/shared/research/2026-04-18-lightfast-agent-runtime-v1.md` (research) and companion `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md` (plan that built the chain we're now tearing down — including `@repo/dotlightfast`)
- Webhook ingest contract reference: `thoughts/shared/plans/2026-04-24-vercel-webhook-schema-coverage.md` (current `transformEnvelope` + `platform/ingest.delivery` flow being torn out)
- Precedent for barebones reset (single phase): `thoughts/shared/plans/2026-04-24-core-cli-barebones-reset.md`
- Related db plan: `thoughts/shared/plans/2026-05-05-db-app-collapse-via-neon-http-proxy.md`
- Webhook delivery code: `apps/platform/src/app/api/ingest/[provider]/route.ts:81-204`
- Inngest registry: `api/platform/src/inngest/index.ts`
- Schema barrel: `db/app/src/schema/index.ts`, `db/app/src/schema/tables/index.ts`, `db/app/src/schema/relations.ts`
- AI agent search tool: `packages/app-ai/src/org-search.ts`, `apps/app/src/lib/search.ts`
- AI agent route (consumer of `orgRepoIndexes` until Phase 1): `apps/app/src/app/(api)/v1/answer/[...v]/route.ts`

## Improvement Log

### 2026-05-07 — Adversarial review pass (focus: don't throw away barebone logic)

Edits driven by parallel codebase-analyzer + codebase-locator + thoughts-locator findings. User confirmed three scope decisions: strip the orgRepoIndexes query in Phase 1, delete the gateway/realtime route (keep the package), clean orphan @repo/app-validation schemas in Phase 4.

**Critical fixes (would have broken surviving surfaces)**:
- Phase 1 now strips `orgRepoIndexes` query from `/v1/answer/[...v]/route.ts:4,64-73`. Without this, Phase 5's schema delete makes the agent route fail at runtime — directly contradicting success criterion #5.
- Phase 3 changed from "delete `schemas/platform.ts` outright" to "trim in place". The Inngest client + 3 surviving functions still import event schemas from this file (`platform/connection.lifecycle`, `platform/health.check.requested`). Deleting it would break the survivor functions.
- Phase 4 enumerated explicit line-level edits to `packages/app-providers/src/index.ts` (lines 12, 100, 158-161, 209-214, 254-258, 289, 328, 332-337, 338-342). The previous "remove EdgeRule re-export and dispatch re-exports" was too vague to prevent broken builds after the runtime/contracts/transformer files were deleted.
- Phase 1 now explicit about `apps/app/src/types/index.ts` lines 13-32 (Jobs/Entities/Events sections). Previous "sweep for re-exports of OrgEvent etc." pointed at the wrong things — the actual breakage is `RouterOutputs["jobs"|"entities"|"events"]` after Phase 2 strips those routers.

**High-priority additions**:
- Phase 1: delete `apps/app/src/app/api/gateway/realtime/route.ts` (only consumer was the 3 channels Phase 4 strips); delete `apps/app/src/lib/filter-constants.ts` (only consumed by deleted workspace components); enumerate explicit edits to `app-sidebar.tsx`, `command-palette.tsx`, and `(workspace)/(manage)/settings/layout.tsx`.
- Phase 3: extended lib/ delete list from 4 to 7 files (`jobs.ts`, `transform.ts`, `constants.ts` confirmed orphan); added `inngest/on-failure-handler.ts` to delete list (only consumers were deleted functions); added explicit "delete the `inngest.send("platform/backfill.run.cancelled", …)` call from `connection-lifecycle.ts`" since no consumer remains.
- Phase 4: added test-file delete list (`runtime/dispatch.test.ts`, all 4 `backfill.test.ts`, vercel `transformers.test.ts`, conditional client/event-labels-sync + provider/categories-sync tests, with verify-before-delete callouts for `index.test.ts` and `crypto.test.ts`).
- Phase 4 (new section 7): clean orphan `@repo/app-validation` schemas (`neural.ts`, `job.ts`, `workflow-io.ts`, `ingestion.ts`, `entities.ts`) — package shell stays per "What We're NOT Doing", but these specific schema files have zero surviving consumers.
- Phase 5: concrete relations.ts edit list (specific imports + named relations to drop, fields to trim from `gatewayInstallationsRelations` / `orgIntegrationsRelations`).

**Documentation**:
- Added `2026-04-18-lightfast-agent-runtime-v1.md` (research + plan) to References — authoritative prior-art on the neural pipeline being torn down, including `@repo/dotlightfast` provenance.
- Added `2026-04-24-vercel-webhook-schema-coverage.md` to References — current webhook ingest contract being deconstructed.

**Confirmed safe (no changes needed)**:
- Settings physical location: `(workspace)/(manage)/settings/{page,layout,api-keys,repo-index}` — has its own `layout.tsx` independent of the deleted `(manage)/layout.tsx` passthrough. Plan's delete list correctly leaves `settings/page.tsx`, `settings/layout.tsx`, `settings/api-keys/` alone. Only edit needed: drop "Repo Index" nav entry from `settings/layout.tsx`.
- `connectionLifecycle`, `healthCheck`, `tokenRefresh`, `recordActivity` — verified no imports from deleted code.
- `apps/app/src/lib/{search,proxy}.ts` and `packages/app-ai/src/org-search.ts` — clean of dropped table refs.
- OAuth callback — does not enqueue any deleted Inngest event; clean.

**Out of scope (flagged for follow-up)**:
- AGENTS.md / `.agents/skills/lightfast-changelog/SKILL.md` describe the neural pipeline architecture; will be stale after teardown but plan explicitly excludes agent-config edits.
- The webhook ingest route still emits `inngest.send("platform/webhook.received", …)` after Phase 3 removes the only consumer — verified by agent that this is intentional barebones state (no-op enqueue, acceptable).
