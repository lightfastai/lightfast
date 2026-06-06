# Skills Sync Architecture Upgrade Design

Date: 2026-06-06
Status: Draft for review
Area: `api/app`, `db/app`, `apps/app` workspace Skills surface, Inngest skills workflows

## Problem

The current skills indexer intentionally treats GitHub `refs/heads/main` as the
source of truth and stores the database index as a materialized cache. That is
the right product model, but the current read interface carries too much sync
behavior:

- `org.workspace.skills.list` calls `ensureFreshSkillIndexForRead`.
- `ensureFreshSkillIndexForRead` checks the GitHub ref before trusting an
  existing index.
- If GitHub has moved, or if no index exists, the read path can acquire the
  refresh lock, read GitHub tree/blob data, replace entries, and wait up to the
  read budget before returning.
- The Skills page, the actions slot, and workspace-assistant prompt assembly all
  depend on that same side-effecting read path.

This gives strong "fresh if possible" semantics, but it couples browser
rendering and assistant prompt construction to external GitHub latency and
refresh lock timing. It also leaves the browser with only query refetches to
discover refresh completion. Adding TanStack DB directly to `page.tsx` would
improve client-side derived views, but it would not solve the deeper server sync
interface problem.

## Decision

Upgrade skills sync in three required phases, then evaluate TanStack DB as an
optional client read-model layer.

1. Make skills reads fast database snapshots.
2. Move refresh initiation into explicit commands and background workflows.
3. Publish skill-index change notifications so the browser can invalidate or
   update its local read model.
4. Defer TanStack DB until the snapshot and event interfaces are stable.

GitHub `refs/heads/main` remains the source of truth. The database remains the
current materialized snapshot plus refresh state. The semantic change is that a
normal page read no longer synchronously proves GitHub freshness. Instead,
webhooks, setup refreshes, hourly reconciliation, and explicit refresh requests
advance the materialized snapshot. The UI presents freshness relative to the
latest observed GitHub ref, not a per-render GitHub check.

## Goals

- Remove GitHub I/O from normal skills list/get reads.
- Keep first paint and client navigation bounded by local database latency.
- Keep the existing transactional refresh lock and replacement model.
- Preserve stale fallback behavior when GitHub or parsing fails.
- Let the UI notice refresh completion without waiting for navigation or focus
  refetch.
- Give the app one versioned snapshot interface that can later back TanStack DB
  collections, desktop sync, or assistant context caching.
- Keep the current read-only skills product behavior.

## Non-Goals

- No skill editor or GitHub write flow.
- No marketplace, install/uninstall, enable/disable, or runtime skill execution.
- No redesign of the current Skills page UI.
- No new parser or validation rules beyond what `@repo/skills-contract` already
  owns.
- No build-history or audit timeline table in this scope.
- No switch from GitHub `main` to branch selection.
- No requirement to introduce TanStack DB in the first implementation.

## Current Architecture

```text
page.tsx
  prefetches org.workspace.skills.list with staleTime: 0

SkillsClient / SkillsActions
  useSkillsList()
    useSuspenseQuery(org.workspace.skills.list)

workspaceSkillsRouter.list
  get verified .lightfast repository
  ensureFreshSkillIndexForRead()

ensureFreshSkillIndexForRead
  load candidate and state
  check GitHub main ref
  return entries if observed current
  otherwise refresh with read budget
  return fresh, stale, refreshing, or unavailable snapshot

refreshSkillIndexSource
  acquire DB lock
  read GitHub ref/tree/blobs
  build entries
  replace entries transactionally
  mark failure without deleting old entries
  release DB lock
```

The backend index modules are relatively deep: the lock, replacement, failure,
parser, and GitHub helper concerns are well separated. The shallow interface is
the browser-facing query, because a caller asking for "list skills" implicitly
opts into freshness checks, refresh execution, sleep-on-lock-contention behavior,
and timeout/failure state transitions.

## Target Architecture

```text
Skills page / actions / assistant prompt
  read org.workspace.skills.list
    getSkillIndexSnapshot()
      database state + entries only

Skills page refresh controller
  request org.workspace.skills.requestRefresh when snapshot is missing/stale

Webhook / setup / hourly reconcile / explicit request
  enqueue app/skills.index.refresh.requested
    refreshSkillIndexSource()
      lock + GitHub + parser + transactional replace
      publishSkillIndexChanged()

Browser event hook
  listens for skill-index change events
  invalidates org.workspace.skills.list
```

TanStack DB, if adopted later, sits behind the browser event hook:

```text
snapshot query + change events
  -> skillIndexState collection
  -> skillIndexEntry collection
  -> live queries for visible skills, selected skill, actions slot status
```

## Server Interfaces

### `getSkillIndexSnapshot`

Create a read service that returns the current database snapshot without GitHub
I/O.

Proposed shape:

```ts
export async function getSkillIndexSnapshot(input: {
  clerkOrgId: string;
  deps?: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
  slug?: string;
}): Promise<{
  freshness: SkillIndexFreshness;
  indexDiagnostics: SkillDiagnostic[];
  repositoryUrl: string;
  skills: SkillIndexEntry[];
  snapshotVersion: string | null;
}>;
```

Behavior:

- Verify the source-control repository still belongs to the active organization
  and is a verified `.lightfast` skill source.
- Load the skill index state by source-control repository id.
- If no candidate or state exists, return `unavailable`, empty diagnostics,
  empty repository URL when unavailable, empty skills, and `snapshotVersion:
  null`.
- If `slug` is provided, load exactly that entry by state id and slug.
- If `slug` is absent, load entries ordered by validation status and slug using
  the existing DB helper.
- Do not call GitHub.
- Do not acquire a refresh lock.
- Do not enqueue refresh work.
- Do not sleep.

`snapshotVersion` should be a derived stable string in the first
implementation, avoiding a schema migration unless later replay semantics need
one. Use the visible state fields that change when the UI should refetch:

```text
<state-id>:<updated-at-ms>:<indexed-commit-sha-or-empty>:<last-refresh-status>
```

This is not an event replay cursor. It is a cheap client-side "did the visible
snapshot change?" token. If we later need durable event replay, add a dedicated
event ledger or monotonic version column in a separate design.

### `requestSkillIndexRefresh`

Create an explicit command for non-blocking refresh requests.

Proposed shape:

```ts
export async function requestSkillIndexRefresh(input: {
  clerkOrgId?: string;
  deps?: Partial<SkillIndexServiceDeps>;
  reason: "read" | "setup" | "webhook" | "schedule";
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}): Promise<{
  enqueued: boolean;
  sourceControlRepositoryId: number;
}>;
```

Behavior:

- Verify repository eligibility when `clerkOrgId` is supplied.
- Enqueue `app/skills.index.refresh.requested` through Inngest.
- Use a dedupe key that includes `sourceControlRepositoryId`, reason, and
  `targetCommitSha` when present.
- Do not run GitHub refresh inline.
- Return `enqueued: false` when the repository is no longer eligible.

The existing webhook, setup, and hourly reconcile paths should use this command
instead of hand-rolling event payloads where practical. The refresh worker still
calls `refreshSkillIndexSource`.

### `publishSkillIndexChanged`

Create a small notification adapter called by the refresh worker after a
visible terminal state transition:

- successful replacement;
- refresh failure metadata update;
- known-stale mark, if surfaced to users.

Do not publish on lock acquisition in the first implementation. The browser
refresh controller handles `refreshing` through mutation response and fallback
refetch. Publishing only terminal state changes keeps the event stream small and
avoids turning lock churn into UI traffic.

Proposed event payload:

```ts
interface SkillIndexChangedEvent {
  type: "skill_index.changed";
  clerkOrgId: string;
  sourceControlRepositoryId: number;
  snapshotVersion: string | null;
  indexedCommitSha: string | null;
  lastRefreshStatus: SkillIndexRefreshStatus;
  occurredAt: string;
}
```

Implementation:

- Resolve the organization id from the refreshed repository candidate.
- Re-read the index state after the refresh/failure update so the event carries
  the current `snapshotVersion`.
- Publish to Redis channel:

```text
lightfast:org:<clerkOrgId>:skills:index
```

- If Redis publish fails, log the error and do not fail the refresh. The
  database snapshot remains authoritative and the browser fallback refetch still
  works.

## tRPC/API Shape

Keep the existing public route shape small.

### `org.workspace.skills.list`

Change implementation from `ensureFreshSkillIndexForRead` to
`getSkillIndexSnapshot`.

The returned payload adds `snapshotVersion`. Existing fields remain so
`SkillsClient`, `SkillsActions`, and tests can migrate incrementally.

`validationStatus` filtering remains supported in the router, but it filters the
database snapshot result, not a freshly checked GitHub result.

### `org.workspace.skills.get`

Change implementation from `ensureFreshSkillIndexForRead` to
`getSkillIndexSnapshot({ slug })`.

Return `NOT_FOUND` when the snapshot has no matching entry. Do not force-refresh
inline.

### `org.workspace.skills.requestRefresh`

Add a mutation:

```ts
requestRefresh: boundOrgProcedure
  .input(z.object({}).strict().optional())
  .mutation(...)
```

The mutation resolves the verified `.lightfast` repository for the active
organization. Do not accept a caller-supplied repository id in the public tRPC
mutation; cross-repository/admin refresh belongs in a separate internal command
or admin surface if it becomes necessary.

The mutation returns `{ enqueued: boolean }`.

## Browser Update Flow

### Baseline React Query Flow

Keep `useSkillsList` as the main client accessor, backed by
`useSuspenseQuery(org.workspace.skills.list.queryOptions(...))`.

Add a small route-local hook:

```ts
function useSkillIndexRefreshController(snapshot: SkillsListResult) {
  // 1. If snapshot is unavailable or stale, request a refresh once per version.
  // 2. If snapshot is refreshing/unavailable/stale, refetch on a short interval.
  // 3. Subscribe to change events and invalidate the list query on event.
}
```

Rules:

- `fresh`: no automatic refresh request.
- `refreshing`: no new request; use fallback refetch while waiting.
- `stale`: request refresh once for the current `snapshotVersion`, then poll
  slowly until an event or refetch advances the snapshot.
- `unavailable`: request refresh once; poll while waiting.

Use query invalidation instead of manual cache writes in the first
implementation. That keeps the server snapshot as the single client payload
source and avoids premature TanStack DB complexity.

### Event Route

Add a route handler instead of changing the global tRPC link chain:

```text
GET /api/skills/index/events
```

Behavior:

- Resolve auth using the existing Clerk identity resolver.
- Require active, bound organization identity.
- Subscribe to `lightfast:org:<orgId>:skills:index`.
- Send Server-Sent Events with `event: skill-index` and the JSON event payload.
- Send a keepalive comment periodically.
- Clean up Redis subscription on abort.

The first implementation may mirror the resumable chat stream posture and return
`204` in local development if Redis pub/sub is disabled. The UI must still work
through `requestRefresh` plus polling when the event route is unavailable.

The client hook should tolerate:

- route returning `204` or non-OK;
- malformed event payloads;
- reconnects;
- duplicate events for the same `snapshotVersion`.

## Freshness Semantics

This design changes the user-visible meaning of `fresh`.

Current meaning:

```text
The read path checked GitHub during this request and the indexed commit matches
the latest observed main commit.
```

New meaning:

```text
The current materialized snapshot matches the latest GitHub main commit observed
by webhook, setup refresh, hourly reconciliation, or explicit refresh request.
```

That means a missed webhook can leave the UI showing a previously fresh snapshot
until hourly reconciliation or explicit refresh observes the newer commit.
This is acceptable because:

- the old read-time check is the source of render latency and timeout behavior;
- scheduled reconciliation already exists to cover missed webhooks;
- explicit refresh requests cover first-load and known-stale states;
- the UI carries timestamps/commit metadata instead of pretending GitHub was
  checked on every render.

Do not label the UI "Live from GitHub" or otherwise imply per-render GitHub
verification.

## TanStack DB Position

TanStack DB is a good fit once the app needs a richer browser read model:

- one collection for skill index state;
- one collection for skill index entries;
- live queries for filtered/sorted lists, selected skill, diagnostics, and
  actions-slot status;
- event-driven writes from the skill-index event stream.

It is not the first implementation step.

Reasons to defer:

- The skills catalog is capped at 200 canonical skills, so client-side array
  filtering is not the performance bottleneck.
- The current problem is server read/sync coupling, which TanStack DB cannot
  fix by itself.
- TanStack DB would still need the snapshot and event interfaces scoped above.
- The current read-only skills product does not need optimistic mutations.

Adoption trigger:

- at least two independent workspace surfaces need reactive access to the same
  skill index state beyond the current page/actions/dialog; or
- skills become editable/installable from the app; or
- assistant skill selection needs local joins with usage, recommendations, or
  per-user preferences.

When one of those triggers exists, add TanStack DB as an adapter over the stable
snapshot/event interfaces, not as a replacement for the server indexer.

## Migration Plan

### Phase 1: Snapshot Reads And Refresh Command

Files likely touched:

- `api/app/src/services/skills/read.ts`
- `api/app/src/services/skills/refresh-request.ts` or equivalent new module
- `api/app/src/services/skills/index.ts`
- `api/app/src/router/(pending-not-allowed)/workspace-skills.ts`
- `api/app/src/inngest/workflow/skill-refresh-event.ts`
- `api/app/src/inngest/workflow/reconcile-skill-indexes.ts`
- `api/app/src/inngest/workflow/queue-skill-refresh-from-source-control.ts`
- `api/app/src/__tests__/skills-index-service.test.ts`
- `api/app/src/__tests__/workspace-skills-router.test.ts`
- `api/app/src/__tests__/skills-index-workflows.test.ts`
- `apps/app/src/app/(chat)/api/chat/route.ts`

Work:

- Add `getSkillIndexSnapshot`.
- Add `requestSkillIndexRefresh`.
- Update `list` and `get` to use snapshot reads.
- Update assistant prompt construction to use snapshot reads.
- Route webhook/setup/reconcile refresh enqueueing through the command where
  practical.
- Keep `refreshSkillIndexSource` and DB replacement helpers intact.
- Delete or rewrite tests that assert GitHub is checked on every read.

Acceptance:

- `org.workspace.skills.list` performs no GitHub calls in tests.
- First-load with no index returns `unavailable` promptly.
- Stale existing index returns old entries promptly.
- Explicit refresh request enqueues the existing refresh worker.
- Chat system prompt construction cannot block on GitHub tree/blob reads.

### Phase 2: Browser Refresh Controller

Files likely touched:

- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skills-list.ts`
- new route-local hook near the skills components
- skills client/action tests

Work:

- Add refresh controller hook.
- Request refresh once per stale/unavailable snapshot version.
- Add fallback refetch while status is `refreshing`, `stale`, or
  `unavailable`.
- Keep the current `page.tsx` prefetch/hydrate shape.

Acceptance:

- The page renders immediately from the snapshot payload.
- Missing/stale index schedules a refresh without blocking render.
- The hook does not spam refresh requests across re-renders.
- Existing search/filter/dialog behavior remains unchanged.

### Phase 3: Change Notifications

Files likely touched:

- new skill index event publisher/subscriber adapter under `api/app` or
  `apps/app/src/app/(api)`
- `api/app/src/services/skills/refresh.ts`
- `apps/app/src/app/(api)/api/skills/index/events/route.ts` or equivalent
- skills client hook/tests

Work:

- Publish `skill_index.changed` after visible refresh state changes.
- Add authenticated SSE route for active bound orgs.
- Add browser event hook that invalidates `org.workspace.skills.list`.
- Keep polling fallback for local dev and event failures.

Acceptance:

- Refresh completion invalidates the skills list without navigation.
- Duplicate events do not cause incorrect UI state.
- Failed event publishing does not fail refresh.
- SSE route rejects unauthenticated, pending, unbound, or wrong-org requests.

### Phase 4: Optional TanStack DB Adapter

Do this only after Phases 1-3 are stable and a product surface actually needs a
shared reactive collection model.

Files likely touched:

- `apps/app/package.json`
- new app-local skills collection module
- `use-skills-list.ts`
- skills page/actions/dialog consumers

Work:

- Add TanStack DB dependencies.
- Create skill index state and entry collections from the snapshot query.
- Feed change events into collection invalidation or direct writes.
- Move visible-list derivation into live queries.

Acceptance:

- Page/actions/dialog read the same collections.
- Search/filter/selected-skill live queries update without bespoke per-component
  derivation.
- React Query remains the server snapshot fetch layer.
- No optimistic mutation code is added unless edit/install behavior exists.

## Testing Strategy

### API/service tests

- Snapshot read returns DB entries without GitHub calls.
- Snapshot read returns `unavailable` for missing candidate/state.
- Snapshot read supports slug-specific reads without listing all entries.
- Refresh request verifies org ownership and queues the refresh event.
- Refresh request dedupe key covers reason and target commit.
- Refresh worker still preserves old entries on failure.
- Refresh worker publishes change events after success/failure.
- Publish failures are logged but do not fail refresh.

### Router tests

- `skills.list` filters validation status from snapshot data.
- `skills.get` returns one snapshot entry or `NOT_FOUND`.
- `skills.requestRefresh` queues the active org `.lightfast` repository.
- Auth/setup gates continue to reject pending, unbound, and unauthenticated
  identities through existing procedure boundaries.

### Client tests

- Skills page renders from snapshot data.
- Stale/unavailable snapshot triggers one refresh request per version.
- Refreshing snapshot polls but does not request another refresh.
- Skill-index event invalidates the list query.
- Event failures fall back to polling.
- Search/filter/dialog tests from the current page continue passing.

### Validation commands

Use focused commands while developing, then broad checks before completion:

```bash
pnpm --filter @api/app test -- skills-index
pnpm --filter @api/app test -- workspace-skills
pnpm --filter @lightfast/app test -- skills
pnpm --filter @api/app build
pnpm build:app
pnpm check
pnpm typecheck
```

## Rollout And Compatibility

- The existing DB schema can support Phases 1-3 without mandatory migrations.
- Existing entries remain valid; no backfill required.
- Existing `org.workspace.skills.list` callers keep their route path and mostly
  the same payload shape.
- The visible freshness semantics change and should be reflected in tests and
  any user-facing copy.
- If live events are disabled or broken, polling keeps the UI functional.
- The previous read-time enforcement behavior should not remain as a hidden
  fallback; keeping it would preserve the latency problem this design is meant
  to remove.

## Risks

- **Eventual consistency:** without per-read GitHub checks, a missed webhook can
  show an older snapshot until reconcile or explicit refresh observes the newer
  ref. Mitigation: hourly reconcile, explicit refresh request, and visible
  checked/indexed timestamps.
- **Redis/SSE reliability:** serverless streaming and Redis pub/sub can be
  uneven locally. Mitigation: polling fallback and non-fatal publish failures.
- **Status language drift:** `fresh` no longer means "checked GitHub during this
  request." Mitigation: document this in code comments/tests and avoid UI copy
  that implies live GitHub verification.
- **Refresh request spam:** stale/unavailable client state can cause repeated
  mutation calls. Mitigation: dedupe by `snapshotVersion` in the client and
  dedupe refresh events in Inngest.
- **Premature TanStack DB adoption:** adding a collection layer before the
  server interfaces are stable would create another place to encode sync
  policy. Mitigation: make TanStack DB a Phase 4 trigger-based adoption.

## Rough Edges This Removes

- Page reads no longer perform GitHub ref checks or refresh work.
- Assistant prompt construction no longer waits on skill-index refresh.
- Refresh initiation has one explicit command interface.
- Browser state can move forward when background refresh completes.
- TanStack DB has a clean future integration point instead of being mixed into
  `page.tsx`.
