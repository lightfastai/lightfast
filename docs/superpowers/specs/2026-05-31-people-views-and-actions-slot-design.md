# People Views + `@actions` Slot Scoping — Design Spec

**Date:** 2026-05-31
**Status:** Approved (brainstorm complete)
**Surface:** `apps/app` → `[slug]/(workspace)/{@actions,people}`
**Builds on:** [`2026-05-30-signals-views-design.md`](./2026-05-30-signals-views-design.md) (the stack this mirrors)

---

## Problem

Two threads, shipped together in one update.

1. **The `@actions` slot leaks across routes.** `@actions` is a Next.js parallel
   route slot on `(workspace)/layout.tsx`, fed into the topbar's left region.
   Today it has only `signals/page.tsx` (→ `SignalsViewSwitcher`) and
   `default.tsx` (→ `null`). The signals-views spec assumed
   "People/Settings/Automations stay empty" because of `default.tsx`. **That
   assumption is wrong for client-side navigation.** Per the official Next.js
   Parallel Routes docs:

   > **Soft Navigation**: During client-side navigation, Next.js will perform a
   > partial render, changing the subpage within the slot, **while maintaining
   > the other slot's active subpages, even if they don't match the current
   > URL.**
   >
   > **Hard Navigation**: After a full-page load (browser refresh) … it will
   > render a `default.js` file for the unmatched slots …

   So `default.tsx` runs **only on hard load/refresh**. After visiting
   `/signals`, soft-navigating to `/automations`, `/settings/*`, etc. **keeps
   the stale `SignalsViewSwitcher` visible**. Refreshing clears it — the
   signature of this exact behavior.

2. **People has no saved views.** `/people` has a filter/search toolbar
   (`people-toolbar.tsx`, filters = `providers` + `types`) but no named,
   reopenable views. We want the same Linear-style saved views signals has, and
   we want `/signals` + `/people` — and **only** those two — to carry an actions
   bar.

## Decisions (locked during brainstorm)

| Question | Decision |
| --- | --- |
| Slot architecture | **Keep the slot** on `(workspace)/layout.tsx` (not a separate views-only layout). The shared topbar stays in one place. |
| How to stop the leak | **Catch-all + index slot pages returning `null`** — the Next.js-documented fix. Not a separate layout (that would duplicate the topbar). |
| Which routes get an action | **Only `/signals` and `/people`.** Everything else renders `null`. |
| People views data model | **Mirror signals** — a new `lightfast_people_views` table + parallel router/hooks/components. No generalized `workspace_views` table. |
| What a people view captures | **Filters only**, as an extensible JSON `config`: `{ filters: { providers, types } }`. Search query stays transient (signals don't persist it either). |
| Scope / ownership | **Personal-only**, partitioned by org — identical to signal views. |
| Default landing | **Always "All people"** (synthetic, no DB row). No per-user default. |
| v1 actions | **list, create, delete** (no update/rename/duplicate/reorder). |
| Ship together | Slot fix + people views land in the **same update**, not split PRs. |

## Non-goals (v1)

- Shared / workspace-wide people views.
- Update/rename in place (delete + recreate instead).
- A settable/remembered default view.
- Persisting the people search query into a view.
- A generalized polymorphic `workspace_views` table (the configs differ enough
  per surface that mirroring is cleaner; revisit only if a 3rd surface appears).
- Adding an actions bar to automations / settings / workspace root.

## Architecture

### Part A — Fix the slot leak (`(workspace)/@actions/`)

Static segments win over the catch-all, so `/signals` and `/people` keep their
switchers while every other route resolves to a `null`-rendering match (which
clears the slot on soft navigation):

```
@actions/
  signals/page.tsx        → <SignalsViewSwitcher />   (exact match — unchanged)
  people/page.tsx         → <PeopleViewSwitcher />     (exact match — NEW, see Part B)
  page.tsx                → null   (NEW — clears slot on soft-nav to workspace root /[slug])
  [...catchAll]/page.tsx  → null   (NEW — clears slot on soft-nav to /automations, /settings/**, etc.)
  default.tsx             → null   (KEEP — hard-load fallback)
```

Why each piece:

- `[...catchAll]/page.tsx` matches **1+** trailing segments (`/automations`,
  `/automations/[id]`, `/settings/billing`, …). On soft nav these now resolve to
  a real match returning `null` instead of retaining the last switcher.
- `page.tsx` (slot index) matches the **0-segment** workspace root `/[slug]`,
  which the catch-all does *not* match. The Next.js Modals example uses both an
  `@auth/page.tsx` and an `@auth/[...catchAll]/page.tsx` for exactly this split.
- `default.tsx` stays as the hard-load/refresh fallback.

No changes to `authenticated-topbar.tsx` or `(workspace)/layout.tsx` — the
`actions` prop wiring already exists.

### Part B — People saved views (mirror the signals stack)

Mirrors [`2026-05-30-signals-views-design.md`](./2026-05-30-signals-views-design.md)
layer-for-layer.

**Data (`db/app`)** — new table `lightfast_people_views`, same conventions as
`lightfast_signal_views` (bigint PK, prefixed `public_id`, org+user scoping,
fsp:3 timestamps, runtime `$onUpdate` — **not** DDL `.onUpdateNow()`, to dodge
the Vitess errno 1294 `ON UPDATE` precision bug documented in `signal-views.ts`):

```
id                  bigint PK autoincrement
public_id           varchar(64)  uq            -- prefix "peoview_"
clerk_org_id        varchar(64)  notNull
created_by_user_id  varchar(64)  notNull
name                varchar(120) notNull
config              json         notNull        -- PeopleViewConfig
created_at          timestamp(3) notNull
updated_at          timestamp(3) notNull $onUpdate(() => new Date())
index (clerk_org_id, created_by_user_id, created_at, id)
```

```ts
interface PeopleViewConfig {
  filters: {
    providers: PersonProvider[]; // from people-model / peopleIdentityProviderSchema
    types: PersonType[];         // from people-model / peopleIdentityTypeSchema
  };
}
```

- `db/app/src/schema/tables/people-views.ts` — table + `createPeopleViewId()` +
  `PeopleViewConfig` / `PeopleView` / `InsertPeopleView` types.
- `db/app/src/utils/people-views.ts` — `listPeopleViews`, `createPeopleView`,
  `deletePeopleView`, all scoped to `(clerkOrgId, createdByUserId)`. Copy the
  `getRowsAffected` helper pattern from `utils/signal-views.ts`.
- Wire exports through `schema/tables/index.ts`, `schema/index.ts`, `index.ts`.
- `pnpm db:generate` for the migration (never hand-write SQL). On worktree
  branches apply via the generated migration path, not `db:push` (known broken).

**API (`api/app`)** — new router mirroring `workspace-signal-views.ts`:

- `api/app/src/router/(pending-not-allowed)/workspace-people-views.ts` →
  `workspacePeopleViewsRouter` on `boundOrgProcedure`, `list`/`create`/`delete`.
  Config zod built from `peopleIdentityProviderSchema` /
  `peopleIdentityTypeSchema` (already used by `workspace-people.ts`).
- Mount as `views:` in `workspacePeopleRouter` (`workspace-people.ts`) →
  **`org.workspace.people.views`**.

**Frontend (`apps/app`, inside `people/_components/`)** — mirror the signals
components, reusing the existing people filter pipeline:

- `people-views-model.ts` — `ALL_PEOPLE_VIEW_NAME` synthetic constant,
  `PeopleViewRow`/`PeopleViewConfig` types (from tRPC output),
  `viewConfigToParamValues`, `allPeopleParamValues`, `selectionToConfig`.
- `use-people-views-query.ts` — `usePeopleViewsQuery`, `useCreatePeopleView`,
  `useDeletePeopleView` (invalidate `people.views.list` on mutate).
- `people-view-switcher.tsx` — the pills row (synthetic "All people" first, then
  saved-view pills with hover-`×`, trailing `+`). Mirror
  `signals-view-switcher.tsx`.
- `people-create-view-dialog.tsx` — name input; snapshots current selection.
- `people-search-params.ts` — add a `view` param (mirror
  `signalSavedViewParser`); the switcher writes `view` + filter params in a
  single `useQueryStates` call.
- `people-client.tsx` — clear `?view` when the user edits a filter ad-hoc
  (mirror the signals interaction model: filter params are the source of truth,
  `?view` is a label + a stamp).

**Slot wiring (Part A ∩ Part B):**

- `@actions/people/page.tsx` → `export const dynamic = "force-dynamic"`,
  `prefetch(people.views.list)` with `staleTime: 60_000`, then
  `<HydrateClient><PeopleViewSwitcher /></HydrateClient>`. Mirror
  `@actions/signals/page.tsx`.

The switcher (slot subtree) and the page (`children` subtree) never share React
state — they coordinate via URL params (nuqs) + the shared react-query cache, so
this reuses 100% of the existing people filter pipeline.

## Risk / fallback

- **Catch-all precedence.** Static `signals`/`people` segments must out-rank
  `[...catchAll]`. This is Next.js's documented route priority (static > dynamic
  > catch-all); verify in dev that `/signals` and `/people` still render their
  switchers after adding the catch-all, and that `/automations` / `/settings/*`
  / workspace root clear on **soft** nav (not just refresh).
- **All slots must resolve every `children` route on hard nav.** With
  index `page.tsx` + `[...catchAll]` + explicit `signals`/`people`, the
  `@actions` slot resolves every reachable `(workspace)` route, so no hard-nav
  `404`. `default.tsx` remains as a belt-and-suspenders fallback.
- If the catch-all proves brittle across the nested `(manage)/settings` layout,
  the documented client-portal fallback from the signals-views spec still
  applies (a `TopbarSlot` context + portal), but that is a last resort — the
  catch-all is the first-class Next.js fix.

## Testing

- **DB:** `people-views.test.ts` — list scoping (org + user), create round-trip,
  delete affected-rows. Mirror `signal-views.test.ts`.
- **API:** `workspace-people-views-router.test.ts` — forwards org+user scope,
  validates config, auth gating (pending/unauthenticated/unbound/revoked).
  Mirror `workspace-signal-views-router.test.ts`.
- **Frontend:** `people-view-switcher.test.tsx` — select/create/delete writes
  the right params; toolbar filter edits clear `?view`. Mirror
  `signals-view-switcher.test.tsx`.
- **Slot regression (the bug that started this):** assert the actions region is
  empty on `/automations` / `/settings` / workspace root **after** visiting
  `/signals` via soft navigation — the catch-all's reason for existing.
