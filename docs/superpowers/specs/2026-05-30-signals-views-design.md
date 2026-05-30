# Signals Views — Design Spec

**Date:** 2026-05-30
**Status:** Approved (brainstorm complete)
**Surface:** `apps/app` → `[slug]/(workspace)/signals`

## Problem

The signals page exposes filters (kind, priority, disposition, people-routing) and a
list/board layout, but all of it is ephemeral URL state — it resets between sessions and
cannot be named, saved, or reopened. Linear's "Views" solve this by promoting a
filter+layout combination into a saved, named, reopenable entity. We want the same for
signals.

## Decisions (locked during brainstorm)

| Question | Decision |
| --- | --- |
| Where the switcher lives | Topbar, left of Docs / API Reference / User |
| How signals feeds the topbar | **Parallel route slot** `@actions` on `(workspace)/layout.tsx` |
| Scope / ownership | **Personal-only** — every view is private to its creator, partitioned by org |
| What a view captures | **Filters + layout**, stored as an extensible JSON `config` |
| Default landing | **Always "All signals"** (synthetic, no DB row). No per-user default, no `setDefault` |
| v1 actions | **list, create, delete** (no update/rename/duplicate/reorder) |

## Non-goals (v1)

- Shared / workspace-wide views (explicitly dropped).
- Updating or renaming a view in place (delete + recreate instead).
- A settable/remembered default view.
- New grouping/sort controls (grouping stays hardcoded: list = Classified/Processing,
  board = by kind).
- Duplicate / drag-reorder.

These are all reachable later without a migration: ownership columns and a JSON `config`
are already in place, so adding `visibility`, `is_default`, or `groupBy`/`sort` later is
additive.

## Architecture

### Data (`db/app`)

One new table, `lightfast_signal_views`, mirroring `lightfast_signals` conventions
(bigint PK, prefixed `public_id`, `clerk_org_id`, `created_by_user_id`, fsp:3 timestamps,
`json` config):

```
id                  bigint PK autoincrement
public_id           varchar(64)  uq            -- prefix "sigview_"
clerk_org_id        varchar(64)  notNull
created_by_user_id  varchar(64)  notNull
name                varchar(120) notNull
config              json         notNull        -- SignalViewConfig
created_at          timestamp(3) notNull
updated_at          timestamp(3) notNull onUpdateNow
index (clerk_org_id, created_by_user_id, created_at, id)
```

`SignalViewConfig` (typed via `SignalClassification` from `@repo/api-contract`):

```ts
interface SignalViewConfig {
  filters: {
    kinds: SignalClassification["kind"][];
    priorities: SignalClassification["priority"][];
    dispositions: SignalClassification["disposition"][];
    peopleRouted: boolean;
  };
  layout: "list" | "board";
}
```

DB helpers in `db/app/src/utils/signal-views.ts`, all scoped to
`(clerkOrgId, createdByUserId)`:

- `listSignalViews({ clerkOrgId, createdByUserId })` → `SignalView[]` (newest-first)
- `createSignalView({ clerkOrgId, createdByUserId, name, config })` → `SignalView`
- `deleteSignalView({ clerkOrgId, createdByUserId, publicId })` → `boolean`

### API (`api/app`)

New tRPC router `workspaceSignalViewsRouter` (same pattern as `workspace-signals.ts`,
`boundOrgProcedure`), mounted as a sub-router at **`org.workspace.signals.views`** by
adding a `views:` key to `workspaceSignalsRouter`. Config validated with zod built from the
existing `signalKindSchema` / `signalPrioritySchema` / `signalDispositionSchema`.

- `views.list` — query, returns the caller's views for the active org.
- `views.create` — mutation `{ name, config }`.
- `views.delete` — mutation `{ publicId }`, owner+org scoped.

### Frontend (`apps/app`)

**Topbar slot (parallel route):**

- `AuthenticatedTopbar` gains a generic, route-agnostic `actions?: ReactNode` prop,
  rendered just left of the Docs/API/User cluster. No signals imports.
- `(workspace)/layout.tsx` takes the `@actions` named slot and passes it to
  `<AuthenticatedTopbar actions={actions} />`.
- `(workspace)/@actions/default.tsx` → `null` (People/Settings/Automations stay empty).
- `(workspace)/@actions/signals/page.tsx` → renders `<SignalsViewSwitcher/>`.

**URL params (collision fix):** today `?view` means list/board layout. Repurposed:

| Param | Meaning |
| --- | --- |
| `?view=<publicId>` | active saved view (absent ⇒ "All signals") |
| `?layout=list\|board` | layout (renamed from old `?view`) |
| `?kind` `?priority` `?disposition` `?people` | filters (unchanged) |

**Interaction model — filter params stay the query's source of truth; `?view` is a label + a "stamp":**

- Select view X → the switcher writes X's filters + layout into the params and sets
  `?view=X`.
- Select "All signals" → clear filter params and `?view`.
- Edit any filter/layout in the toolbar → `signals-client` clears `?view` (you're now
  ad-hoc).
- "New view" → snapshot current params into a `config`, `create`, then set `?view` to the
  new id.

The switcher (parallel-slot subtree) and the page (`children` subtree) never share React
state — they coordinate entirely through these URL params (nuqs) and the shared
react-query cache (`views.list` is prefetched in `signals/page.tsx`). This reuses 100% of
the existing filter pipeline (`useSignalsWorkspaceData`, toolbar, `signals-search-params`).

**New components (all inside `signals/_components/`):**

- `signals-views-model.ts` — `ALL_SIGNALS_VIEW` synthetic constant, `SignalViewRow` type
  (tRPC output), `viewConfigToParams`, `currentSelectionToConfig` helpers.
- `use-signal-views-query.ts` — `useSignalViewsQuery`, `useCreateSignalView`,
  `useDeleteSignalView`.
- `signals-view-switcher.tsx` — the dropdown.
- `signal-create-view-dialog.tsx` — name input; snapshots current selection.

## Risk / fallback

Parallel routes are new to this repo. If slot resolution proves brittle across every
`(workspace)` sub-route (route groups + the nested `(manage)/settings` layout), fall back
to the **client-portal slot** (a `TopbarSlot` context + portal target in the topbar's
`actions` prop) — same `actions` prop, same UX, no routing files. The `actions` prop is
designed to support either.

## Testing

- DB: `signal-views.test.ts` — list scoping (org + user), create round-trip, delete
  affected-rows. Stub-the-builder pattern from `signals-list.test.ts`.
- API: `workspace-signal-views-router.test.ts` — forwards org+user scope, validates
  config, auth gating (pending/unauthenticated/unbound/revoked). `createCallerFactory`
  pattern from `workspace-signals-router.test.ts`.
- Frontend: switcher select/create/delete writes the right params; toolbar edits clear
  `?view`.
