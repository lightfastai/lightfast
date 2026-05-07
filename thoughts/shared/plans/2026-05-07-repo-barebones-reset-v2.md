# Repo Barebones Reset v2 Implementation Plan

## Overview

Continue the barebones reset that began with `thoughts/shared/plans/2026-05-06-repo-barebones-reset.md` (all 6 phases complete on `refactor/repo-barebones-reset`). v1 ripped out the neural-pipeline / event-stream stack but left the OAuth + connections + webhook + token-vault + AI agent surfaces fully wired. v2 strips that floor too — every provider/connections/webhook/AI surface is deleted, the `@repo/app-providers` heavyweight goes, the `gateway_*` + `org_integrations` + `org_workflow_runs` tables drop, and `SPEC.md` is rewritten to retract the v0.1.0 shipping claim for `Connection` / `Event` / `Entity`.

End-state: `apps/app` keeps Clerk auth, CLI/desktop auth handoff, Account/Teams/Welcome, Org primitive (slug + Clerk membership), API-keys management, and `/api/{trpc,inngest,health}`. `apps/platform` survives as an empty Next.js host. `apps/desktop` and `apps/www` are unaffected. `core/cli` already barebones; `core/lightfast` and `core/mcp` get trimmed to bare client + bare MCP server stubs (no contract tools). `db/app` ends with **2 tables** physically: `lightfast_org_user_activities` and `lightfast_workspace_api_keys`.

This plan only **tears down**. The aggregate model (PR / Deployment / Issue / etc.) is a follow-up.

## Current State Analysis

Surface map verified at git commit `4934a881efc6f02f` (the same commit `thoughts/shared/research/2026-05-07-repo-barebones-reset-v2.md` documents). Key file/route counts as of now:

- `apps/app/src/`: **121 files** total — 79 KEEP (auth + cli + desktop handoff + account + api-keys + infra) and 42 DELETE candidates (provider/sources/AI).
- `apps/platform/src/`: **15 files** — 9 KEEP, 5 DELETE + `env.ts` trim.
- `apps/desktop/src/`: untouched (already barebones).
- `apps/www/`: untouched apart from inlining the marketing `PROVIDER_DISPLAY` map locally.
- `api/app/src/router/`: 8 surviving procedures (`account.get`, `organization.{listUserOrganizations,create,updateName}`, `orgApiKeys.{list,create,revoke,delete,rotate}`); 10 procedures + `connections` router deleted; `recordActivity` Inngest survives.
- `api/platform/src/`: 3 Inngest functions deleted, both routers deleted, every `lib/*` except `jwt.ts` deleted, `inngest/schemas/platform.ts` emptied.
- `db/app/src/schema/`: 6 table TS files deleted (`gateway-installations`, `gateway-tokens`, `gateway-lifecycle-log`, `gateway-webhook-deliveries`, `org-integrations`, `org-workflow-runs`); `relations.ts` becomes empty; barrels strip the deleted re-exports.
- `packages/`: 12 packages deleted (`app-providers`, `app-ai`, `app-ai-types`, `app-api-contract`, `app-embed`, `app-pinecone`, `app-rerank`, `prompt-engine`, `webhook-schemas`, `app-test-data`, `platform-trpc`, `app-octokit-github`).
- `vendor/`: 3 packages deleted (`embed`, `pinecone`, `upstash-realtime`).
- `core/`: `core/lightfast` and `core/mcp` trimmed to stubs.

User decisions captured in research §"Resolved Scope" (2026-05-07) plus four follow-up questions answered today:

1. **Strip everything AND rewrite SPEC.md.** OAuth, webhooks, AI, gateway tables all go. SPEC.md §3.2.1 + §4.1.1–4.1.3 rewritten to mark `Connection`/`Event`/`Entity` as `(planned)`. Mission/vision unchanged.
2. **`org_workflow_runs` → DROP.** Zero source consumers. Folded into v2's drop migration.
3. **`[slug]/(workspace)/(manage)/` route-group skeleton stays.** Even with only `settings/` as leaf.
4. **`core/lightfast` + `core/mcp` KEEP** but trimmed to bare client / bare server stubs.
5. **`apps/platform` service KEEP** — Next.js host with `/api/health`, `/api/inngest` (registering zero functions), `/api/trpc/[trpc]` (empty router shell).
6. **Orphan policy: conservative.** `@repo/app-encryption` package and `apps/app/src/app/(api)/lib/orpc-middleware.ts` stay as inert scaffolding. `workflow-io.ts` deletes (it imports from the deleted `@repo/app-providers`).
7. **Sidebar rebuild: trim in place.** `app-sidebar.tsx`/`app-header.tsx` trimmed; `command-palette.tsx` + `answer-tool-results.tsx` + `answer-tool-error-utils.ts` + `config-template-dialog.tsx` deleted; help popover stays.
8. **`[slug]/(workspace)/page.tsx`: leaf with empty-state placeholder.** No redirect.
9. **`@repo/app-validation/src/schemas/api/*`: DELETE.** `core/lightfast` and `core/mcp` strip to bare stubs.

## Desired End State

After Phase 7, all of the following hold:

1. `pnpm install && pnpm check && pnpm typecheck` exits 0 across the monorepo.
2. `pnpm build:app` and `pnpm build:platform` succeed.
3. `pnpm dev:app` boots; signing in lands on `/[slug]` showing the empty-state placeholder. The org sidebar shows TeamSwitcher + a single "Settings" nav item + the help popover.
4. Inngest dev server (when running) registers exactly **1 function**: `recordActivity` from `api/app`. Both `api/platform` and `apps/platform` register zero functions but the `/api/inngest` route stays mounted on each.
5. `apps/platform` boots on `:4112`. `/api/health` responds 200; `/api/trpc/[trpc]` is mounted against an empty `platformRouter` (no procedures); `/api/inngest` mounts the empty function array.
6. POSTing to any `/api/connect/*` or `/api/ingest/[provider]` URL on `apps/platform` returns 404. Curling `/v1/answer/*` or `/v1/search` on `apps/app` returns 404.
7. `apps/desktop` E2E sign-in still works end-to-end (auth-flow and `apps/app`'s `/api/desktop/auth/*` endpoints are untouched).
8. `db/app` end-state schema: exactly **2 tables** in Postgres — `lightfast_org_user_activities` and `lightfast_workspace_api_keys`. The 6 v2-dropped tables and the 7 v1-orphan tables are all dropped via a single new migration.
9. No file in the repo imports `@repo/app-providers`, `@repo/app-ai`, `@repo/app-ai-types`, `@repo/app-api-contract`, `@repo/app-embed`, `@repo/app-pinecone`, `@repo/app-rerank`, `@repo/prompt-engine`, `@repo/webhook-schemas`, `@repo/app-test-data`, `@repo/platform-trpc`, `@repo/app-octokit-github`, `@vendor/embed`, `@vendor/pinecone`, or `@vendor/upstash-realtime`.
10. `SPEC.md` §3.2.1 still names the Connection Layer as Component 1 of the Core System but with "Status: planned" and the v0.1.0 shipping claim retracted from §4.1.1, §4.1.2, §4.1.3, and §4.1.7.
11. `AGENTS.md` describes `apps/platform` correctly (no longer "Connections, webhooks, backfill, neural pipeline"). `CLAUDE.md` removes `connections`/`sources` from the tRPC Auth Boundaries section.

### Key Discoveries

- **`workflow-io.ts` has zero external consumers** — `git grep "workflow-io|workflowInputSchema|workflowOutputSchema"` returns only the internal re-exports inside `@repo/app-validation`. Safe to delete in Phase 5 alongside the `app-providers` deletion.
- **`sha256Hex` is a 3-line function** at `packages/app-providers/src/runtime/crypto.ts:47` and is the only `@repo/app-providers` symbol consumed by a KEEP-bucket package (`@repo/app-api-key/src/crypto.ts:10`). It's a wrapper over `@noble/hashes/sha2`. Phase 5 inlines it directly into `@repo/app-api-key` (or uses Node's built-in `crypto.createHash('sha256').update(value).digest('hex')` — equivalent and removes the `@noble/hashes` dep from `app-api-key`).
- **`apps/www/src/lib/builders/integrations.ts:1,41`** is the only `apps/www` consumer of `@repo/app-providers/client` (`PROVIDER_DISPLAY`). The marketing integrations page is built from this. Phase 5 inlines a frozen copy of the `PROVIDER_DISPLAY` map directly in `apps/www` (or in a new `apps/www/src/lib/integrations-display.ts` file) so the marketing site keeps working independently.
- **`apps/app/src/components/{app-sidebar,app-header}.tsx` survive but are edited.** `command-palette.tsx`, `answer-tool-results.tsx`, `answer-tool-error-utils.ts`, `config-template-dialog.tsx` are deleted — the trimmed sidebar references none of them.
- **`apps/app/src/proxy.ts:isApiRoute` regex includes `/v1/(.*)`** — this match is dropped in Phase 1 since the `(api)/v1/` route group goes.
- **`apps/app/src/types/index.ts`** contains `Source` + `ResourcesList` types from `RouterOutputs["connections"]`. After Phase 2 deletes the `connections` router, this file's surviving types break. Phase 1 deletes the file outright (no surviving callers in the KEEP bucket).
- **`apps/app/src/lib/api-client.ts`** is the oRPC client targeting `/v1/*`. Deleted in Phase 1.
- **`apps/app/src/app/(app)/(org)/[slug]/(workspace)/page.tsx` currently redirects to `/${slug}/sources`** — Phase 1 replaces with a leaf empty-state component (no redirect).
- **`api/platform/src/inngest/schemas/platform.ts`** has 2 schemas remaining (`platform/health.check.requested`, `platform/connection.lifecycle`). Both consumers (the 3 Inngest functions) delete in Phase 4. The file becomes a stub with `export const platformEvents = {} as const;` so the Inngest client still type-checks.
- **`api/platform/src/root.ts`** declares both `platformRouter` and `adminRouter`. Phase 4 trims `platformRouter` to an empty `createTRPCRouter({})` and leaves `adminRouter` as-is (already empty).
- **`db/app/src/index.ts` and `db/app/src/schema/index.ts`** re-export 6 deleted tables + their relations. Phase 6 strips both barrels and removes the `WorkflowInput`/`WorkflowOutput` re-export (which originated from the now-deleted `workflow-io.ts`).
- **`db/app/src/schema/relations.ts` becomes empty** after Phase 6 — no surviving table has FK relations now that gateway tables are gone (Clerk org IDs were already non-FK refs). The file ends as a single comment placeholder so future relations have a place to land.
- **The `pnpm db:generate` migration** in Phase 6 will drop **13 tables** total — the 6 v2 deletions plus the 7 v1-orphan tables that were left in the physical schema by the v1 plan (`org_events`, `org_entities`, `org_event_entities`, `org_entity_edges`, `org_ingest_logs`, `org_repo_indexes`, `gateway_backfill_runs`). Cleaner than two separate migrations.
- **`pnpm-workspace.yaml`** uses globs (`packages/*`, `vendor/*`, `core/*`, `apps/*`, `api/*`, `db/*`) — package deletions don't require workspace-yaml edits, only `pnpm install` to re-resolve the lockfile.
- **CI is per-monorepo turbo** — `pnpm typecheck` from root catches all cross-package breaks. No CI surgery needed.
- **`.changeset/pre.json`** lists `@repo/app-octokit-github` and `core/cli` and `core/lightfast` and `core/mcp`. After Phase 5 deletes `@repo/app-octokit-github`, the changeset entry must be removed (otherwise `pnpm changeset version` fails).
- **`apps/platform/package.json` direct deps** — after Phase 3 deletes the OAuth + ingest routes, the direct dep on `@repo/app-providers` and `@db/app` can both be dropped from this `package.json`. No replacement deps needed.
- **Three KEEP-bucket files are orphaned but stay** per user's conservative orphan policy: `@repo/app-encryption` (package), `apps/app/src/app/(api)/lib/orpc-middleware.ts`, `api/platform/src/lib/jwt.ts`. They type-check standalone.

## What We're NOT Doing

- **Not** deleting `apps/desktop` or any of its files.
- **Not** deleting `apps/www`. Only inlining a small `PROVIDER_DISPLAY` map locally so the marketing integrations page is independent of `@repo/app-providers`.
- **Not** deleting `core/cli`, `core/lightfast`, or `core/mcp`. Trimming the latter two to stub clients.
- **Not** deleting `core/ai-sdk` (already source-stripped — only `dist/` remains, published as external npm `@lightfastai/ai-sdk`).
- **Not** deleting `@repo/app-encryption`, `apps/app/src/app/(api)/lib/orpc-middleware.ts`, or `api/platform/src/lib/jwt.ts`. Conservative orphan policy.
- **Not** rewriting the `/[slug]/account/*` or `/[slug]/(workspace)/(manage)/settings/*` routes. They survive as-is.
- **Not** touching Clerk, Sentry, observability, security, analytics, seo, aeo, remotion, forms, ui, mcp, lib, next, db (`@vendor/db`), inngest, upstash, app-trpc, app-validation primitives/forms/constants, app-reserved-names — all KEEP.
- **Not** reverting v1's deletions. The v1 plan stays committed.
- **Not** writing or migrating data — drop migration only.
- **Not** designing the next architecture (aggregates / new domain model). v2 is teardown-only; the rebuild plan lands later.

## Implementation Approach

Seven phases, ordered consumer-first → packages → schema → docs so each phase leaves the build green at its boundary. The dependency graph dictates the ordering: nothing in Phase 5 (delete `@repo/app-providers`) can run until Phases 1–4 detach every consumer. Schema migration (Phase 6) runs last among code phases so the application is already disconnected from the dropped tables. Docs + verification (Phase 7) sweeps last.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: apps/app — strip provider/sources UI, AI runtime, /v1 endpoints

### Overview

Detach `apps/app` from every provider, sources, and AI surface. After this phase, the `[slug]/(workspace)/(manage)/settings/*` routes are the only meaningful workspace surfaces; the org root renders an empty-state leaf; the sidebar shows TeamSwitcher + Settings nav + help popover; no `/v1/*` endpoint exists.

### Changes Required:

#### 1. Delete oRPC + `/v1` route group

**Files**:

- `apps/app/src/app/(api)/v1/answer/[...v]/route.ts`
- `apps/app/src/app/(api)/v1/[...rest]/route.ts`
- `apps/app/src/app/(api)/lib/orpc-router.ts`

`orpc-middleware.ts` stays (orphan, conservative policy).

#### 2. Delete AI runtime + prompts

**Directory**: `apps/app/src/ai/` (entire subtree)

Concretely: `prompts/{providers,system-prompt}.ts`, all 8 `prompts/sections/*.ts`, `runtime/memory.ts`, `types.ts`.

#### 3. Delete sources UI tree

**Directory**: `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/sources/` (entire subtree)

#### 4. Delete provider OAuth callback pages

**Directory**: `apps/app/src/app/(providers)/` (entire subtree, all 4 callback pages)

#### 5. Delete provider/AI-coupled libs

**Files**:

- `apps/app/src/lib/search.ts`
- `apps/app/src/lib/proxy.ts`
- `apps/app/src/lib/types.ts`
- `apps/app/src/lib/api-client.ts`
- `apps/app/src/lib/provider-icon.tsx`
- `apps/app/src/hooks/use-oauth-popup.ts`
- `apps/app/src/types/index.ts`

#### 6. Delete provider/AI-coupled shared components

**Files**:

- `apps/app/src/components/command-palette.tsx`
- `apps/app/src/components/answer-tool-results.tsx`
- `apps/app/src/components/answer-tool-error-utils.ts`
- `apps/app/src/components/config-template-dialog.tsx`

#### 7. Trim `app-sidebar.tsx`

**File**: `apps/app/src/components/app-sidebar.tsx`

Drop the `Explore` primary-nav item and the `Sources` manage-nav item. Drop the `useTRPC()`/`useSuspenseQuery` import for `organization.listUserOrganizations` only if no longer needed (TeamSwitcher likely uses it — keep). Drop the search button + `KeyboardEvent` dispatcher (no command palette). Keep TeamSwitcher, Settings nav item, and the help popover footer.

End state: sidebar shows TeamSwitcher → Manage → Settings → footer help popover.

#### 8. Trim `app-header.tsx`

**File**: `apps/app/src/components/app-header.tsx`

Drop any references to deleted components (search, command palette, provider icons). Keep user-menu/sign-out only. (Verify what's there during execution; the file's surface is small.)

#### 9. Replace `[slug]/(workspace)/page.tsx` with empty-state leaf

**File**: `apps/app/src/app/(app)/(org)/[slug]/(workspace)/page.tsx`

Replace:

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

With a small empty-state component (no redirect):

```tsx
import { Card } from "@repo/ui/components/ui/card";

export default function OrgRootPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your team and API keys from the sidebar.
        </p>
      </Card>
    </div>
  );
}
```

(Adjust to match repo's existing UI tokens — e.g., reuse `EmptyState` from `@repo/ui` if one exists.)

#### 10. Drop `/v1/(.*)` from middleware

**File**: `apps/app/src/proxy.ts`

Find `isApiRoute` regex and remove the `/v1/(.*)` alternation. Keep `/api/(.*)`.

#### 11. Trim env.ts

**File**: `apps/app/src/env.ts`

Drop:

- `PINECONE_API_KEY`
- `COHERE_API_KEY`
- `OPENAI_API_KEY` (if declared — the v2 research notes it's optional/never reached)
- `VERCEL_OIDC_TOKEN` (if declared)
- The `@repo/app-octokit-github` `extends` import on line 2 (per research §9, the package is consumed only via env extends; Phase 5 deletes the package).
- The `@repo/app-providers` `extends` import (it brings `GITHUB_APP_*`, `LINEAR_*`, `SENTRY_*`, `VERCEL_*` env vars in — all gone after Phase 5).

#### 12. Update next.config.ts deps if needed

**File**: `apps/app/next.config.ts`

Verify whether `@repo/app-octokit-github` or `@repo/app-providers` are referenced (they're in the `transpilePackages` list in many configs). Drop them.

#### 13. Update apps/app/package.json

**File**: `apps/app/package.json`

Drop deps that won't be consumed after Phase 1:

- `@repo/app-ai`
- `@repo/app-ai-types`
- `@repo/app-api-contract`
- `@repo/app-embed`
- `@repo/app-octokit-github`
- `@repo/app-pinecone`
- `@repo/app-providers`
- `@repo/app-rerank`
- `@repo/prompt-engine`
- `@vendor/embed`
- `@vendor/pinecone`
- `@orpc/openapi`, `@orpc/server`, `@orpc/openapi-client` (kept only if `orpc-middleware.ts` survives — verify orpc-middleware.ts only imports `@orpc/server`, drop the others)
- `@ai-sdk/gateway`, `ai`, `@lightfastai/ai-sdk`
- `cohere-ai` if direct
- `@upstash/redis` (only if AnswerRedisMemory was the sole consumer — verify; KV is also used by `app/api/desktop/auth/lib/code-store.ts`, so KEEP)

(Verify each by `git grep` on the import name during execution; only drop if zero KEEP-bucket consumers remain.)

#### 14. Update apps/app vitest mocks

**File**: `apps/app/src/__tests__/__mocks__/github-env.ts`

Delete (only used to mock `@repo/app-octokit-github` env). Verify by checking `apps/app/vitest.config.ts` — drop the alias entry if present.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @apps/app typecheck` passes
- [x] `pnpm --filter @apps/app build` succeeds
- [x] `pnpm --filter @apps/app test` passes (auth + cors + sign-in tests survive)
- [x] `git grep "from \"@repo/app-providers\"\|from \"@repo/app-ai\"\|from \"@repo/app-pinecone\"\|from \"@repo/app-embed\"\|from \"@repo/app-rerank\"\|from \"@repo/app-api-contract\"\|from \"@repo/prompt-engine\"" -- apps/app/src` returns zero matches
- [x] `git grep "/v1/" -- apps/app/src/proxy.ts` returns zero matches
- [x] `git grep "redirect.*sources" -- apps/app/src` returns zero matches (only hit is the early-access survey form's `sourcesError` test assertion — KEEP per research)

#### Human Review:

- [ ] Boot `pnpm dev:app`, sign in → org root URL `/[slug]` renders the empty-state card (no 404, no redirect to `/sources`)
- [ ] Sidebar shows: TeamSwitcher → "Settings" under Manage → help popover at footer. No "Sources", no "Explore", no search button
- [ ] Click into `/[slug]/settings/api-keys` → list/create/rotate API keys still works (no regression in surviving routes)
- [ ] DevTools network tab during sign-in shows no requests to `/v1/*`
- [ ] Curl `https://<wt>.app.lightfast.localhost/v1/answer/foo/bar` returns 404

---

## Phase 2: api/app — drop connections router + token-vault [DONE]

### Overview

Delete the `connections` tRPC router (10 procedures) and its `lib/token-vault.ts` dependency. Update `appRouter` to drop the `connections` namespace. The 8 surviving procedures (`account.get`, `organization.*`, `orgApiKeys.*`) plus `recordActivity` Inngest stay intact.

### Changes Required:

#### 1. Delete connections router

**File**: `api/app/src/router/org/connections.ts`

#### 2. Delete token-vault helper

**File**: `api/app/src/lib/token-vault.ts`

#### 3. Update appRouter

**File**: `api/app/src/root.ts`

Drop the `connectionsRouter` import on line 8 and the `connections: connectionsRouter` entry on line 18. Final shape:

```ts
import { orgApiKeysRouter } from "./router/org/org-api-keys";
import { accountRouter } from "./router/user/account";
import { organizationRouter } from "./router/user/organization";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  account: accountRouter,
  orgApiKeys: orgApiKeysRouter,
});

export type AppRouter = typeof appRouter;
```

#### 4. Trim env.ts

**File**: `api/app/src/env.ts`

Drop:

- The `@repo/app-octokit-github` `extends` import on line 1
- The `@repo/app-providers` `extends` import (drops `GITHUB_APP_*`, `LINEAR_*`, `SENTRY_*`, `VERCEL_*` provider OAuth secrets)
- Any direct `ENCRYPTION_KEY` declaration — it was used by `token-vault.ts` only

#### 5. Trim api/app/package.json

**File**: `api/app/package.json`

Drop:

- `@repo/app-octokit-github`
- `@repo/app-providers`
- `@repo/platform-trpc` (only consumer was `connections.ts`)

`@repo/app-encryption` stays per conservative orphan policy (Phase 6 may also drop it if package list deletion sweep identifies it, but KEEP for now).

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @api/app build` succeeds (n/a — source-only package, no build script; typecheck covers it)
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter @api/app test` passes (6 tests passing)
- [x] `git grep "connectionsRouter\|connections:" -- api/app/src` returns zero matches
- [x] `git grep "from \"@repo/app-providers\"\|from \"@repo/app-octokit-github\"\|from \"@repo/platform-trpc\"" -- api/app/src` returns zero matches
- [x] `pnpm --filter @apps/app build` still succeeds (Phase 1's `apps/app` keeps building after dropping `connections` from `appRouter`)

#### Human Review:

- [x] Open `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx` in the running dev server. The page renders without throwing, even if it's a route that previously consumed `connections.list` (the file is in the KEEP bucket; verify it doesn't reference `trpc.connections.*`). — verified statically: file uses only `trpc.organization.*` (lines 44, 68, 73); zero `trpc.connections.*` references in apps/app or api/app; full apps/app production build succeeds with the trimmed appRouter (compile-time proof that no consumer references the removed namespace).

---

## Phase 3: apps/platform — drop OAuth + webhook ingest routes [DONE]

### Overview

Delete the four route handlers in `apps/platform/src/app/api/{connect,ingest}/*` and trim `env.ts` so the remaining `apps/platform` surface is `/api/{health,inngest,trpc/[trpc]}` only.

### Changes Required:

#### 1. Delete OAuth + ingest route handlers

**Files**:

- `apps/platform/src/app/api/connect/[provider]/authorize/route.ts`
- `apps/platform/src/app/api/connect/[provider]/callback/route.ts`
- `apps/platform/src/app/api/connect/oauth/poll/route.ts`
- `apps/platform/src/app/api/ingest/[provider]/route.ts`

After deletion, the empty `connect/` and `ingest/` directories should be removed too (`rm -rf` clean — Next.js doesn't tolerate empty route directories in dev gracefully on some platforms).

#### 2. Trim apps/platform/src/env.ts

**File**: `apps/platform/src/env.ts`

Drop:

- `providerEnv` extend from `@repo/app-providers/env`
- Direct `ENCRYPTION_KEY` declaration

#### 3. Trim apps/platform/package.json

**File**: `apps/platform/package.json`

Drop:

- `@repo/app-providers`
- `@db/app` (no surviving direct consumer in this package — `apps/platform` only re-exports api/platform's tRPC + Inngest, which themselves drop their `@db/app` consumers in Phase 4)

(Verify each via `git grep` on the import name within `apps/platform/src/`.)

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @lightfast/platform build` succeeds
- [x] `pnpm --filter @lightfast/platform typecheck` passes
- [x] `git grep "@repo/app-providers\|gatewayInstallations\|gatewayTokens\|orgIntegrations\|gatewayWebhookDeliveries" -- apps/platform/src` returns zero matches
- [x] `git grep "from \"@vendor/octokit\"\|from \"@repo/app-octokit-github\"" -- apps/platform/src` returns zero matches
- [x] `find apps/platform/src/app/api/connect apps/platform/src/app/api/ingest` returns "No such file" (directories cleaned)

#### Human Review:

- [x] Boot `pnpm dev:platform`. `curl http://localhost:4112/api/health` returns 200. `curl http://localhost:4112/api/connect/github/authorize` returns 404. (also verified `/api/ingest/github` → 404)
- [x] Sentry init still completes on startup (no missing-env crash) — confirmed via successful `/api/health` request through `instrumentation.ts`; Sentry SDK loaded (deprecation warnings prove module evaluated) with no crash.

---

## Phase 4: api/platform — drop Inngest functions + tRPC routers + lib/oauth + lib helpers [DONE]

### Overview

Tear down the OAuth + token-vault + connection-lifecycle backbone in `api/platform`. After this phase, `api/platform` keeps only `lib/jwt.ts` (scaffolding for future serviceProcedure), an empty `platformRouter`, an empty Inngest function array, and a stubbed `inngest/schemas/platform.ts`.

### Changes Required:

#### 1. Delete Inngest functions

**Files**:

- `api/platform/src/inngest/functions/connection-lifecycle.ts`
- `api/platform/src/inngest/functions/health-check.ts`
- `api/platform/src/inngest/functions/token-refresh.ts`

#### 2. Empty Inngest registration

**File**: `api/platform/src/inngest/index.ts`

Replace function imports + array with an empty array. Final shape:

```ts
import { serve } from "inngest/next";
import { inngest } from "./client";

export { inngest };

export function createInngestRouteContext() {
  return serve({
    client: inngest,
    functions: [],
    servePath: "/api/inngest",
  });
}
```

#### 3. Stub Inngest schemas

**File**: `api/platform/src/inngest/schemas/platform.ts`

Replace contents with:

```ts
import { z } from "zod";

// Platform event schemas — empty after v2 barebones reset.
// Future platform-side workflows will register their schemas here.
export const platformEvents = {} as const satisfies Record<
  string,
  z.ZodTypeAny
>;
```

(Or `as const satisfies Record<string, z.ZodSchema>` matching the existing typing. Verify the `inngest/client.ts` file's typing on `platformEvents` and match it.)

#### 4. Delete tRPC routers + procedures

**Files**:

- `api/platform/src/router/platform/connections.ts`
- `api/platform/src/router/platform/proxy.ts`

#### 5. Empty platformRouter

**File**: `api/platform/src/root.ts`

Replace contents with:

```ts
import { createTRPCRouter } from "./trpc";

/** Platform router — empty after v2 barebones reset. */
export const platformRouter = createTRPCRouter({});

/** Admin router — already empty; reserved for future admin-only procedures. */
export const adminRouter = createTRPCRouter({});

export type PlatformRouter = typeof platformRouter;
export type AdminRouter = typeof adminRouter;
```

#### 6. Delete lib helpers + lib/oauth

**Files**:

- `api/platform/src/lib/cache.ts` (Redis OAuth state keys — no surviving consumer)
- `api/platform/src/lib/encryption.ts`
- `api/platform/src/lib/token-helpers.ts`
- `api/platform/src/lib/token-store.ts`
- `api/platform/src/lib/provider-configs.ts`
- `api/platform/src/lib/oauth/authorize.ts`
- `api/platform/src/lib/oauth/callback.ts`
- `api/platform/src/lib/oauth/state.ts`
- The `api/platform/src/lib/oauth/` directory itself (post-delete cleanup)

**Keep**: `api/platform/src/lib/jwt.ts` — survives as scaffolding for future serviceProcedure even though it has no consumer right now (conservative orphan policy).

#### 7. Trim api/platform/package.json

**File**: `api/platform/package.json`

Drop:

- `@repo/app-providers`
- `@repo/app-encryption` (if listed — KEEP only if other paths still use it; verify)
- `@db/app` if no surviving import in api/platform/src
- `@vendor/upstash` (cache.ts was the consumer; Inngest dev server uses its own)

(Verify each via `git grep` within `api/platform/src/`.)

#### 8. Trim api/platform/src/env.ts

**File**: `api/platform/src/env.ts`

Drop `providerEnv` extends + `ENCRYPTION_KEY`. Keep `SERVICE_JWT_SECRET` (jwt.ts retained per orphan policy).

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @api/platform build` succeeds (n/a — source-only package, no build script; typecheck covers it)
- [x] `pnpm --filter @api/platform typecheck` passes
- [x] `pnpm --filter @api/platform test` passes (3 tests in lib/jwt.test.ts)
- [x] `git grep "connectionLifecycle\|healthCheck\|tokenRefresh\|connectionsRouter\|proxyRouter" -- api/platform/src` returns zero matches
- [x] `git grep "@repo/app-providers" -- api/platform/src` returns zero matches
- [x] `pnpm --filter @lightfast/platform build` still succeeds (apps/platform consumes api/platform's empty router and zero-function Inngest array)

#### Human Review:

- [x] Boot `pnpm dev:platform`. Visit `http://localhost:4112/api/inngest` — introspection reports `function_count: 0` (was 3 before Phase 4).
- [x] `curl -X POST http://localhost:4112/api/trpc/connections.list` returns HTTP 404 with `"No procedure found on path \"connections.list\""`. The connections router is gone.

---

## Phase 5: Packages — relocate sha256Hex, delete provider+AI packages, trim core/lightfast + core/mcp [DONE]

### Overview

The big delete: 12 packages + 3 vendor packages + the `app-validation/api/*` schemas + `workflow-io.ts`. Before deletions, relocate `sha256Hex` into `@repo/app-api-key/src/crypto.ts` and inline the marketing `PROVIDER_DISPLAY` map into `apps/www`. After this phase, `core/lightfast` is a bare client class with no contract; `core/mcp` is a bare MCP server with no tool registration.

### Changes Required:

#### 1. Inline `sha256Hex` into `@repo/app-api-key/src/crypto.ts`

**File**: `packages/app-api-key/src/crypto.ts`

Replace line 10's import with a local function. Use Node's built-in `crypto` module to avoid a new `@noble/hashes` dep:

```ts
import { createHash } from "node:crypto";
import { nanoid } from "@vendor/lib";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";
// ... rest of file unchanged, callers of sha256Hex now use the local fn
```

**Important**: Verify the package runs in edge runtime contexts. If `app-api-key` is consumed in edge-runtime code paths (Cloudflare Workers / Vercel Edge), `node:crypto` is *not* available and we must use `@noble/hashes` (add as dep) or `crypto.subtle.digest`. Check during execution via `git grep "@repo/app-api-key" -- 'apps/' 'api/'` and inspect each call site for edge-runtime declarations.

If edge runtime support is needed:

```ts
// edge-safe alternative
async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

(Async signature change requires updating callers — `hashApiKey` likely already async.)

#### 2. Inline `PROVIDER_DISPLAY` for apps/www

**Option A (recommended)**: Create `apps/www/src/lib/integrations-display.ts` with a frozen copy of the map:

```ts
// Inlined from former @repo/app-providers/client. Owned by apps/www.
export const PROVIDER_DISPLAY = {
  github: { label: "GitHub", description: "..." /* etc */ },
  linear: { label: "Linear", description: "..." },
  sentry: { label: "Sentry", description: "..." },
  vercel: { label: "Vercel", description: "..." },
  apollo: { label: "Apollo", description: "..." },
} as const;

export type ProviderId = keyof typeof PROVIDER_DISPLAY;
```

(Copy actual values from `packages/app-providers/src/client.ts`'s `PROVIDER_DISPLAY` export.)

**File**: `apps/www/src/lib/builders/integrations.ts`

Update line 1's import:

```ts
import { PROVIDER_DISPLAY } from "~/lib/integrations-display";
```

#### 3. Delete provider package

**Directory**: `packages/app-providers/` (entire subtree)

#### 4. Delete AI/contract packages

**Directories**:

- `packages/app-ai/`
- `packages/app-ai-types/`
- `packages/app-api-contract/`
- `packages/app-embed/`
- `packages/app-pinecone/`
- `packages/app-rerank/`
- `packages/prompt-engine/`
- `packages/webhook-schemas/`
- `packages/app-test-data/`

#### 5. Delete platform tRPC client + octokit shim

**Directories**:

- `packages/platform-trpc/`
- `packages/app-octokit-github/`

#### 6. Delete vendor packages

**Directories**:

- `vendor/embed/`
- `vendor/pinecone/`
- `vendor/upstash-realtime/`

#### 7. Trim `@repo/app-validation`

**Files**:

- Delete `packages/app-validation/src/schemas/workflow-io.ts`
- Delete the entire `packages/app-validation/src/schemas/api/` directory (`search.ts`, `proxy.ts`, `index.ts`)

**File**: `packages/app-validation/src/index.ts`

Drop:

- `export * from "./schemas/workflow-io";` (line 69)
- The Search* re-export block (lines 49–62 in the current file): `SearchMode`, `SearchRequest`, `SearchResponse`, `SearchResult`, `SearchModeSchema`, `SearchRequestSchema`, `SearchResponseSchema`, `SearchResultSchema`

**File**: `packages/app-validation/src/schemas/index.ts`

Drop the workflow-io re-export.

**File**: `packages/app-validation/package.json`

If the package declares an `./api` export entry, drop it.

#### 8. Strip `core/lightfast` to bare client

**File**: `core/lightfast/src/index.ts`

Replace contents with:

```ts
declare const __SDK_VERSION__: string;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
}

/**
 * Lightfast SDK client (barebones).
 *
 * The full contract has been removed pending the post-v2 architecture.
 * The constructor still validates an API key; method registration
 * returns when concrete endpoints land.
 */
export class LightfastClient {
  readonly baseUrl: string;
  readonly version = __SDK_VERSION__;

  constructor(
    public readonly apiKey: string,
    options: LightfastOptions = {}
  ) {
    if (!apiKey?.startsWith("sk-lf-")) {
      throw new Error("Invalid Lightfast API key");
    }
    this.baseUrl = options.baseUrl ?? "https://lightfast.ai";
  }
}

/** Backwards-compatible factory matching the old createLightfast() shape. */
export function createLightfast(
  apiKey: string,
  options?: LightfastOptions
): LightfastClient {
  return new LightfastClient(apiKey, options);
}
```

**File**: `core/lightfast/package.json`

Drop deps:

- `@repo/app-api-contract`
- `@repo/app-validation` (the `api/` subpath was the only consumer)
- `@orpc/client`, `@orpc/contract`, `@orpc/openapi-client` (no longer used)

#### 9. Strip `core/mcp` to bare MCP server

**File**: `core/mcp/src/index.ts`

Replace contents with:

```ts
import { McpServer, StdioServerTransport } from "@vendor/mcp";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

// Tools removed — pending post-v2 contract definition.

const transport = new StdioServerTransport();
await server.connect(transport);
```

**File**: `core/mcp/package.json`

Drop deps:

- `@repo/app-api-contract`
- `lightfast` (workspace consumer no longer used since no tools register)

(Keep `@vendor/mcp`.)

#### 10. Update `.changeset/pre.json`

**File**: `.changeset/pre.json`

If `@repo/app-octokit-github` appears in any field (`changesets`, `packages`, etc.), remove the entry. Same audit for any other deleted package names if they leak into changesets.

#### 11. Update root configs

**Files**:

- `pnpm-workspace.yaml` — likely a glob, no edit needed; verify
- `turbo.json` — verify deleted packages aren't referenced by name
- `tsconfig.base.json` — drop any path aliases pointing to deleted packages

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds (lockfile re-resolves cleanly)
- [x] `pnpm typecheck` passes from root
- [x] `pnpm build:app && pnpm build:platform` both succeed
- [x] `pnpm --filter lightfast build && pnpm --filter @lightfastai/mcp build` succeed (core/lightfast + core/mcp build cleanly as stubs)
- [x] `pnpm --filter @lightfast/www build` succeeds (marketing site compiles without `@repo/app-providers`; OpenAPI doc generation backed by a placeholder spec at `apps/www/src/openapi.empty.json` until the post-v2 contract lands)
- [x] `git grep "@repo/app-providers\|@repo/app-ai\|@repo/app-pinecone\|@repo/app-embed\|@repo/app-rerank\|@repo/prompt-engine\|@repo/webhook-schemas\|@repo/app-api-contract\|@repo/app-test-data\|@repo/platform-trpc\|@repo/app-octokit-github\|@vendor/embed\|@vendor/pinecone\|@vendor/upstash-realtime" -- 'apps/' 'api/' 'packages/' 'vendor/' 'core/' 'db/'` returns zero live import matches (only stale-comment hits, scrubbed)
- [x] `find packages/app-providers packages/app-ai packages/app-ai-types packages/app-api-contract packages/app-embed packages/app-pinecone packages/app-rerank packages/prompt-engine packages/webhook-schemas packages/app-test-data packages/platform-trpc packages/app-octokit-github packages/app-upstash-realtime vendor/embed vendor/pinecone vendor/upstash-realtime -type d 2>/dev/null` returns no results
- [x] `pnpm --filter @repo/app-api-key typecheck` passes; no pre-existing unit tests in this package, but `pnpm --filter @lightfast/app test` (10 files / 120 tests) and `pnpm --filter @api/app test` (6 tests) exercise `hashApiKey` / `generateApiKey` end-to-end and remain green

#### Phase 5 ↔ Phase 6 source-level overlap (executed in Phase 5)

To make Phase 5's `pnpm install` + root `pnpm typecheck` reachable, the source-level pieces of Phase 6 were pulled forward (Phase 6 retains migration generation + apply):

- Deleted `db/app/src/schema/tables/{gateway-installations,gateway-tokens,gateway-lifecycle-log,gateway-webhook-deliveries,org-integrations,org-workflow-runs}.ts`
- Stripped `db/app/src/schema/relations.ts` to a placeholder `export {}`
- Stripped `db/app/src/schema/index.ts`, `db/app/src/index.ts`, `db/app/src/schema/tables/index.ts` barrels to the surviving exports (`orgApiKeys`, `orgUserActivities`, plus types)
- Dropped `@repo/app-providers` from `db/app/package.json` (kept `@repo/app-validation` — still consumed by `org-user-activities.ts`)
- Also deleted `packages/app-upstash-realtime` (zero source consumers, transitively broken by `@vendor/upstash-realtime` deletion)

#### Human Review:

- [x] `apps/www` dev server boots; `GET /integrations` (HTTP 200, 637 KB) lists all 5 inlined providers (Apollo, GitHub, Linear, Sentry, Vercel); `GET /integrations/github` (HTTP 200) renders the inlined "Connect your GitHub" copy. PROVIDER_DISPLAY inlining works.
- [x] After `pnpm --filter lightfast build`, a fresh `tsc --strict` run against `core/lightfast/dist/index.d.ts` typechecks a consumer importing `LightfastClient`, `createLightfast`, and `VERSION` (no errors).
- [x] After `pnpm --filter @lightfastai/mcp build`, running `node core/mcp/dist/index.mjs` with `LIGHTFAST_API_KEY=sk-lf-test` answers MCP `initialize` with `serverInfo: {name: "lightfast", version: "0.1.0-alpha.5"}`. `tools/list` returns `-32601 Method not found` — the protocol-correct signal for a server that declares no tools capability (zero tools registered).

---

## Phase 6: db/app schema teardown + drop migration

### Overview

Delete 6 schema TS files, strip the relations file, regenerate migration. The single new migration drops 13 tables total — the 6 v2 deletions plus 7 v1-orphans left in the physical schema.

### Changes Required:

#### 1. Delete table TS files

**Files**:

- `db/app/src/schema/tables/gateway-installations.ts`
- `db/app/src/schema/tables/gateway-tokens.ts`
- `db/app/src/schema/tables/gateway-lifecycle-log.ts`
- `db/app/src/schema/tables/gateway-webhook-deliveries.ts`
- `db/app/src/schema/tables/org-integrations.ts`
- `db/app/src/schema/tables/org-workflow-runs.ts`

#### 2. Strip relations.ts

**File**: `db/app/src/schema/relations.ts`

Replace contents with:

```ts
// Relations between tables for Drizzle ORM queries.
//
// All gateway/org-integrations relations were removed in the v2 barebones reset.
// Surviving tables (org_user_activities, org_api_keys) have no inter-table FK
// relationships — they reference Clerk org IDs as opaque strings.
//
// New relations should be declared here as features land.
export {};
```

#### 3. Strip schema barrel

**File**: `db/app/src/schema/index.ts`

Replace with the trimmed surface:

```ts
// Table schemas

// Re-exported types from tables (post-v2)
export {
  type InsertOrgApiKey,
  type InsertOrgUserActivity,
  type OrgApiKey,
  type OrgUserActivity,
  orgApiKeys,
  orgUserActivities,
} from "./tables";
```

(Remove all gateway/org-integrations/org-workflow-runs re-exports + the 4 relations exports.)

#### 4. Strip top-level barrel

**File**: `db/app/src/index.ts`

Replace with the trimmed surface:

```ts
// Schema exports

// Client
export { db } from "./client";

// Re-exported types from schema
export {
  type InsertOrgApiKey,
  type InsertOrgUserActivity,
  type OrgApiKey,
  type OrgUserActivity,
  orgApiKeys,
  orgUserActivities,
} from "./schema";

// Utilities
export { buildOrgNamespace } from "./utils/org";
```

(Remove `WorkflowInput`/`WorkflowOutput` re-exports — those came from the deleted `workflow-io.ts`. Remove all gateway re-exports + relations exports.)

#### 5. Update tables/index.ts

**File**: `db/app/src/schema/tables/index.ts`

Drop the 6 deleted table re-exports + the `WorkflowInput`/`WorkflowOutput` re-export (which forwards from the deleted `workflow-io.ts`).

#### 6. Generate migration

```sh
cd db/app
pnpm with-env pnpm db:generate
```

Drizzle should produce a single migration that issues `DROP TABLE IF EXISTS …` for the 6 v2 tables and 7 v1-orphans. Inspect the generated SQL file before committing.

#### 7. Apply migration

```sh
cd db/app
pnpm with-env pnpm db:migrate
```

(Run against local Postgres only at this stage. Production runs on next deploy.)

#### 8. Trim db/app/package.json

**File**: `db/app/package.json`

Drop:

- `@repo/app-providers` (was used for `$type<…>` annotations on the deleted tables)
- `@repo/app-validation` if listed as direct dep and no surviving table imports from it (verify; activities.ts may still import primitives)

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --filter @db/app typecheck` passes
- [x] `pnpm --filter @db/app build` succeeds (n/a — source-only package, no build script; typecheck covers it)
- [x] `pnpm typecheck` from root passes (api/app's `recordActivity` and `lib/activity.ts` still build against the trimmed `@db/app` exports)
- [x] `git grep "gatewayInstallations\|gatewayTokens\|gatewayLifecycleLogs\|gatewayWebhookDeliveries\|orgIntegrations\|orgWorkflowRuns" -- 'apps/' 'api/' 'packages/' 'core/' 'db/app/src/'` returns zero matches
- [x] The new migration file `db/app/src/migrations/0064_slim_king_cobra.sql` includes `DROP TABLE` for all 13 tables (6 v2 + 7 v1-orphans)
- [x] After running migration, `docker exec lightfast-postgres psql -U postgres -d $DB -c "\dt"` shows only `lightfast_org_user_activities` and `lightfast_workspace_api_keys`

#### Human Review:

- [ ] Open `pnpm db:studio` (`http://127.0.0.1:4983`) → confirm the table list shows exactly 2 tables.
- [ ] Inspect the new migration SQL by hand — confirm the column drops are clean (no leftover constraint drops referencing dropped columns from other tables).

---

## Phase 7: Verify + docs + env trim

### Overview

Final sweep: full monorepo typecheck/build, env-var audit, SPEC.md rewrite, AGENTS.md and CLAUDE.md updates.

### Changes Required:

#### 1. Full monorepo verification

```sh
pnpm install
pnpm clean:workspaces
pnpm install
pnpm check
pnpm typecheck
pnpm build:app
pnpm build:platform
pnpm --filter @apps/www build
pnpm --filter lightfast build
pnpm --filter @lightfast/mcp build
pnpm --filter @apps/desktop build
pnpm --filter @core/cli build
```

All commands exit 0.

#### 2. Env-var audit

For each `.env.development.local`, `.env.example`, `.env.test` in the repo:

- Drop `PINECONE_API_KEY`
- Drop `COHERE_API_KEY`
- Drop `OPENAI_API_KEY`
- Drop `VERCEL_OIDC_TOKEN`
- Drop `ENCRYPTION_KEY`
- Drop `GITHUB_APP_*` vars (CLIENT_ID, CLIENT_SECRET, PRIVATE_KEY, INSTALLATION_ID, etc.)
- Drop `LINEAR_*` provider OAuth vars
- Drop `SENTRY_*` provider OAuth vars (NOT the Sentry observability vars `SENTRY_DSN`/`SENTRY_AUTH_TOKEN`)
- Drop `VERCEL_*` provider OAuth vars (NOT the deployment vars `VERCEL_GIT_*`)

Keep:

- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (desktop PKCE code-store on apps/app keeps using these)
- `CLERK_*`
- `DATABASE_*`
- `SERVICE_JWT_SECRET` (kept for future serviceProcedure)
- All Sentry/observability/logging vars

#### 3. Rewrite SPEC.md sections per user decision

**File**: `SPEC.md`

##### Update §3.2.1 (Connection Layer)

Add a `Status: planned` line after the bullet:

```md
1. `Connection Layer`
   - Manages OAuth flows, credential storage, webhook registration, and backfills per tool.
   - Status: planned. The connection-layer scaffolding shipped in v0.1.0 was removed in the v2 barebones reset; this component will be rebuilt on top of the post-v2 aggregate model.
   - Further specification deferred.
```

##### Retract v0.1.0 shipping claims in §4.1

Update three entity status tags:

- §4.1.1 Event: change `(shipped v0.1.0)` → `(planned)`
- §4.1.2 Entity: change `(shipped v0.1.0)` → `(planned)`
- §4.1.3 Connection: change `(shipped v0.1.0)` → `(planned)`
- §4.1.7 Agent: change `(partial v0.1.0)` → `(planned)` and rewrite the second sentence:
  > "The agent surface scaffolding shipped in v0.1.0 was removed in the v2 barebones reset; identity and per-skill permissions will land with the next domain model."

##### Update the status-tags legend

In §4.1's preamble, drop the `(shipped v0.1.0)` and `(partial v0.1.0)` entries from the status-tags list since no entity carries them anymore. Keep `(planned)` only.

##### Update Last Updated

Set `Last Updated: 2026-05-07`.

#### 4. Rewrite AGENTS.md

**File**: `AGENTS.md`

Replace the architecture diagram with the post-v2 layout (mirror the user's `CLAUDE.md` diagram, scaled down). Drop the `apps/platform` description line "Connections, webhooks, backfill, neural pipeline" + "OAuth flows, token vault, event ingestion" — replace with "Empty Next.js host (post-v2 reset). Reserved for future platform-side workflows."

Drop the §"Platform Service" section entirely (it details the OAuth + token-vault stack that no longer exists).

Update the §"tRPC Auth Boundaries" section: drop `connections` and `sources`, leave `account`, `apiKeys` under userRouter and `workspace` (or empty) under orgRouter. Match the boundaries that survive after Phase 2.

#### 5. Update CLAUDE.md

**File**: `CLAUDE.md`

Section "tRPC Auth Boundaries":

```md
## tRPC Auth Boundaries

- **userScopedProcedure**: Clerk-pending or Clerk-active session (account, organization listing/create/rename)
- **orgScopedProcedure**: Clerk-active org membership required (orgApiKeys list/create/revoke/delete/rotate)
```

(Drop the old `connections` and `sources` references. The previous wording was already imprecise — the sources were never on `userRouter`.)

#### 6. Update plan + research links

**File**: `thoughts/shared/plans/2026-05-07-repo-barebones-reset-v2.md`

Add to the References section a final note: "Implementation completed at <commit-sha>." after Phase 7 lands. (This is updated by the `implement_plan` skill at completion.)

#### 7. Drop changeset entries for deleted packages

Verify `.changeset/pre.json` and `.changeset/*.md` files don't reference deleted packages. Adjust as needed.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm install && pnpm check && pnpm typecheck` exits 0 from root
- [ ] `pnpm build:app && pnpm build:platform` succeed
- [ ] `pnpm --filter @apps/www build && pnpm --filter @apps/desktop build` succeed
- [ ] `pnpm --filter lightfast build && pnpm --filter @lightfast/mcp build && pnpm --filter @core/cli build` succeed
- [ ] `git grep "PINECONE_API_KEY\|COHERE_API_KEY\|VERCEL_OIDC_TOKEN\|ENCRYPTION_KEY\|GITHUB_APP_CLIENT_ID\|GITHUB_APP_PRIVATE_KEY" -- ':!*.lock' ':!thoughts/' ':!CHANGELOG*' ':!.changeset/*.md'` returns zero matches in source files (matches in `thoughts/` and historical changelogs are expected)
- [ ] `git grep "shipped v0.1.0" -- SPEC.md` returns zero matches
- [ ] `git grep "Connections, webhooks, backfill, neural pipeline" -- AGENTS.md` returns zero matches
- [ ] `git grep "connections\|sources" -- CLAUDE.md` returns at most marketing/architecture-level mentions (no auth-boundary procedure references)
- [ ] `psql $DATABASE_URL -c "\dt" | grep -c lightfast_` equals 2

#### Human Review:

- [ ] Boot `pnpm dev:full`. Sign in via `https://app.lightfast.localhost`. Land on `/[slug]` empty-state. Click sidebar Settings → Settings page renders. Click API Keys → list/create/rotate works.
- [ ] Boot `pnpm dev:desktop`. Complete PKCE sign-in. Account view + settings panes render with no console errors.
- [ ] Visit `pnpm dev:www`. The integrations page (`/integrations` or wherever it lives) renders the same provider tiles as before v2 (data inlined locally).
- [ ] Read SPEC.md end-to-end. Confirm every entity in §4.1 has `(planned)` status and the §3.2.1 Connection Layer carries the retraction note.
- [ ] Read AGENTS.md and CLAUDE.md. Confirm the `apps/platform` description is honest and the tRPC Auth Boundaries section names only surviving routers.

---

## Testing Strategy

### Unit Tests

The KEEP-bucket tests survive untouched and provide regression coverage:

- `apps/app/src/__tests__/cors.test.ts`
- `apps/app/src/__tests__/origins.test.ts`
- `apps/app/src/__tests__/sign-in.test.ts`
- `apps/app/src/app/api/desktop/auth/{code,exchange}/route.test.ts`
- `apps/app/src/app/(auth)/{sign-in,sign-up}/__tests__/*` (server action tests)
- `apps/app/src/app/(early-access)/early-access/__tests__/*` (server action tests)
- `packages/app-api-key/src/crypto.test.ts` — exercises the relocated `sha256Hex`
- `db/app` Drizzle schema tests (if any)

If any test imports from a deleted module, delete the test alongside the module it tested.

### Integration Tests

- **`/api/cli/login` + `/api/cli/setup`**: smoke-test by running `pnpm cli login` against local dev (if the CLI smoke-tests are wired up). Expected: PKCE handshake succeeds, JWT mints.
- **`/api/desktop/auth/code` + `/api/desktop/auth/exchange`**: covered by `apps/desktop` E2E sign-in. Phase 7 human review item #2 exercises this.
- **Org membership flow**: sign-in → org creation → API-key issuance. All three procedures (`organization.create`, `orgApiKeys.create`) must succeed end-to-end.

### Smoke checklist after Phase 7

- `pnpm dev:full` boots all three apps without errors
- Sign-in flow completes
- API key creation + revocation works
- Desktop PKCE sign-in works
- Marketing site (`apps/www`) renders all routes

## Performance Considerations

The v2 deletions remove an entire AI request path (Cohere embed + Pinecone query + rerank), the OAuth state machine, the token-refresh cron, and the connection-lifecycle cron. Net effect: lower idle CPU/memory, fewer Inngest scheduled events, fewer outbound API calls per tenant. No new performance hotspots are introduced.

## Migration Notes

### Database

Single drop migration in Phase 6 covers 13 tables (6 v2 deletions + 7 v1-orphans left over from the previous reset). Data in those tables is permanently lost. The user has confirmed (via the v2 research's "Resolved Scope" section) that the v0.1.0 shipping claim is being retracted, so production data in those tables is treated as discardable.

### Environment

Phase 7 trims roughly 9–12 env vars. Drop them from Vercel project envs (apps/app, apps/platform, apps/www) at deploy time. Surviving env-var set is documented in the updated `apps/<app>/.env.example` files.

### Inngest

Cloud Inngest project loses 3 functions (`connectionLifecycle`, `healthCheck`, `tokenRefresh`) on next deploy. The `recordActivity` function survives. Inngest dashboard will show the deleted functions as "removed" — no manual cleanup needed.

### SDK consumers

`core/lightfast` published to npm at `0.1.0-alpha.5` had typed procedure methods. The post-v2 stub is a major API surface reduction. No external consumers exist in this monorepo, but if there are external npm consumers, the next published version should bump to `0.2.0-alpha.0` (or similar) and the changelog should call out the contract removal.

## References

- Original research: `thoughts/shared/research/2026-05-07-repo-barebones-reset-v2.md` (this plan's surface map and resolved-scope decisions)
- v1 plan (DONE): `thoughts/shared/plans/2026-05-06-repo-barebones-reset.md` — the precedent 6-phase teardown
- v1 motivating research: `thoughts/shared/research/2026-05-06-architecture-reset-barebones.md`
- Must-survive inventory (now superseded): `thoughts/shared/research/2026-04-20-lightfast-2-barebones-rearchitecture-baseline.md:65-68,84-106,536-540`
- Desktop auth-only model: `thoughts/shared/research/2026-04-23-codex-vs-lightfast-desktop-production-gap.md:218-221`
- Single-package strip precedent: `thoughts/shared/plans/2026-04-24-core-cli-barebones-reset.md`
- Vendor collapse precedent: `thoughts/shared/plans/2026-04-19-collapse-vendor-lib-to-nanoid.md`
- AI SDK extraction context: `thoughts/shared/plans/2026-05-05-extract-ai-sdk-to-own-repo.md`
- Specification: `SPEC.md` (rewritten in Phase 7)
