# People UI Rework Design

## Context

`apps/app` already ships a People workspace surface, but it is a thin v1:

- `lightfast_people` stores **identity-centric** rows (one row per identity:
  email / x / github / linkedin / website), each with `displayName`,
  `identityProvider`, `identityType`, `identityValue`, `normalizedIdentityValue`,
  `seenCount`, `firstSeenSignalId`, `lastSeenSignalId`, and `metadata`.
- People are produced **only** by the `classify-people` Inngest workflow, which
  runs an AI classifier over a classified signal whose
  `classification.routing.classifyPeople.shouldRun === true` and upserts the
  discovered identities (`upsertPeopleFromCandidates`).
- The People UI (`people/_components/people-client.tsx`) is a flat,
  search-only, single-page table (Identity / Provider / Type / Seen / Updated)
  with a `contained` (modest-padding) layout and **no** detail view.

Meanwhile, the **Signals** surface was just reworked into a Linear/Attio-style
edge-to-edge workspace with a `Filter` + `Display` toolbar, list/board views,
and a floating detail sheet. People now looks dated next to it.

This design reworks the **People UI only** to match that quality bar, populates
the `lightfast` org with realistic people by running the existing pipeline
end-to-end, and surfaces the Signal↔People interrelation in the UI — **without
changing the data model or the classification pipeline.**

This design supersedes the **People UI** sections of
`docs/superpowers/specs/2026-05-27-people-signals-ui-design.md` (which made
People a contained directory with no detail drawer). The Signals sections of
that spec are unaffected.

## Goals

- Rebuild People as a **full-bleed, edge-to-edge** Attio/Folk-style table that
  visually matches the reworked Signals surface.
- Reuse the Signals **`Filter` + `Display` toolbar pattern**, with **icon-only**
  buttons (no `Filter` / `Display` text labels), mirroring
  `signals-toolbar.tsx`.
- Open a **detail sheet** on row click, styled like the Signals detail sheet.
- Surface the **Signal↔People link** as a `Signals` column in the table and a
  `Signals` section in the detail sheet.
- Populate the `lightfast` org with realistic people by seeding new,
  people-mentioning signals and letting the real pipeline extract identities.

## Non-Goals

- **No data-model change.** `lightfast_people` schema, identity normalization,
  and the `classify-people` / `classify-signal` workflows stay exactly as they
  are. People remains identity-centric (one row per identity).
- **No person↔signal join table** and therefore **no full signal history.** Only
  `firstSeenSignalId` and `lastSeenSignalId` are real, linkable references.
- No manual person create / edit / merge / delete.
- No board view for People (table only for now).
- No rework of existing `lightfast` signals; people data comes from the newly
  seeded signals. (Enriching pre-existing signals is a possible future pass.)
- No changes to the public `/api/v1` API contract.

## Product Shape

Route is unchanged: `/${slug}/people`.

People switches from a `contained` directory to a `flush` (full-bleed)
workspace surface, matching Signals. The page is:

```
┌─────────────────────────────────────────────────────────────┐
│ [⧩ filter]                                   [⊟ display]      │  ← icon-only toolbar
├──────────────┬───────────────────────┬─────────┬─────────────┤
│ Name         │ Identity              │ Type    │ Signals      │  ← column header
├──────────────┼───────────────────────┼─────────┼─────────────┤
│ 👤 G. Rauch  │ ✉ rauchg@vercel.com   │ email   │ ⌁SIG-3f9a +3 │  ← row (click → sheet)
│ 👤 @leerob   │ 𝕏 @leerob             │ handle  │ ⌁SIG-8b21 +2 │
│ …            │ …                     │ …       │ …            │
├──────────────┴───────────────────────┴─────────┴─────────────┤
│ 12 count · Load more                                          │  ← footer
└─────────────────────────────────────────────────────────────┘
```

### Columns

| Column     | Source                              | Notes |
|------------|-------------------------------------|-------|
| **Name**   | `displayName ?? identityValue`      | Person glyph prefix. When `displayName` is null, show the raw identity in muted text (matches the `support@…` rows in the reference). |
| **Identity** | `identityValue`                   | Prefixed by a small **provider glyph** (email / x / github / linkedin / website). No separate Provider column. |
| **Type**   | `identityType`                      | `email` / `handle` / `profile_url`, muted. |
| **Signals**| `lastSeenSignalId` + `seenCount`    | A `SIG-xxxx` chip for the last-seen signal, plus a muted `+N` overflow where `N = seenCount − 1`. **Simplified on purpose** (see Honesty Constraint); reworked later. |

Dropped from the old table: Provider column, Seen column, Last seen column,
normalized-identity debug line, and the raw first/last-seen id text lines.

### Honesty Constraint (Signals column)

We only have two linkable signal references per person (`firstSeenSignalId`,
`lastSeenSignalId`). `seenCount` counts total mentions but the intermediate
signal ids are **not** stored. Therefore:

- The table chip links to **`lastSeenSignalId`**; the `+N` is a *count only*
  (not a list we can expand). It signals "mentioned in N+1 signals total."
- The detail sheet shows the **two real** linkable signals (first-seen and
  last-seen) explicitly, and states the total `seenCount`. It must not render a
  fabricated list of N signals.
- Full per-signal history is explicitly **out of scope** (needs a join table).

This is the one place the simplification is visible; it is called out so we do
not silently imply data we don't have.

## Toolbar

Mirror `signals-toolbar.tsx` structure and styling exactly, but icon-only:

- **Filter** (left): `ListFilter` icon button (`size-6`, rounded, bordered,
  muted) opening a `DropdownMenu` of filter sub-menus, plus active filter
  **chips** ("Provider is any of …" with an `X` to clear), identical to Signals.
  - Filter groups for People: **Provider** (email / x / github / linkedin /
    website) and **Type** (email / handle / profile_url).
- **Display** (right): `SlidersHorizontal` icon button opening a small menu.
  - For now: **sort order** — `Recently seen` (default, `updatedAt` desc) and
    `Name` (`displayName`/identity asc). This keeps the button meaningful without
    a board view. *(Optional — may be deferred to a stub during planning; the
    button still renders for parity.)*

No `Add` button (people are not manually created).

## Detail Sheet

Open on row click, styled like the Signals detail sheet (floating sheet, rounded
header action buttons). Selection lives in the URL as `?person=<publicId>`
(nuqs), mirroring Signals' `?signal=` param, so it is shareable and survives
reload.

Sheet content for a person:

- **Header:** display name (or identity value), provider badge, identity type.
- **Identity:** provider, type, `identityValue`, `normalizedIdentityValue`.
- **Activity:** `seenCount`, `createdAt`, `updatedAt` (relative + absolute).
- **Classifier metadata:** `metadata.confidence`, `metadata.rationale`,
  `metadata.source` when present (this is what `classify-people` stored).
- **Signals:** the **first-seen** and **last-seen** signals as linkable rows
  (fetched via the existing `org.workspace.signals.get`), each navigating to the
  signal. Plus a line: "Mentioned in {seenCount} signals." (per Honesty
  Constraint). No fabricated middle entries.

## Architecture / Data

Keep the app-internal, bound-org tRPC router pattern (`org.workspace.people`).

### Router changes (additive only, no schema change)

- **Add `org.workspace.people.get`** — fetch one person by `publicId`, org
  scoped via `boundOrgProcedure`, for the detail sheet. Add a matching
  `getPersonByPublicId` DB helper in `db/app/src/utils/people.ts` (sibling to the
  existing `getPersonByIdentityKey`).
- **Extend `org.workspace.people.list` input** with optional
  `providers?: PersonIdentityProvider[]` and `types?: PersonIdentityType[]`
  filters, and an optional `sort?: "recent" | "name"`. Thread these into
  `listPeople` as additive `WHERE` / `ORDER BY` clauses. No new columns.

The detail sheet reuses `org.workspace.signals.get` for the linked signals — no
new signals endpoint needed.

### Client structure (mirror the Signals `_components` layout)

Under `people/_components/`:

- `people-model.ts` — types inferred from `AppRouterOutputs`, provider/type label
  maps, glyph map, `getPersonName`, `formatPersonIdentifier`, page-size const.
- `people-search-params.ts` — nuqs parsers (`person`, `provider`, `type`,
  `peopleQuery`, `sort`).
- `people-ui-store.ts` — zustand store for selected person (and any local UI
  state), mirroring `signals-ui-store.ts`.
- `use-people-list-query.ts` — `useInfiniteQuery` wrapper over
  `org.workspace.people.list.infiniteQueryOptions`, deferred search, filters.
- `people-toolbar.tsx` — icon-only Filter + Display, chips (reuses the Signals
  toolbar patterns/styles).
- `people-table-view.tsx` — full-bleed table: header row, body rows, footer
  count + Load more. Fixed row height; cursor pagination.
- `people-detail-sheet.tsx` / `people-detail-content.tsx` — the sheet + body,
  including the Signals section that calls `signals.get`.
- `people-empty-state.tsx` — empty + no-results states (full-bleed).
- `people-loading.tsx` — first-load skeleton (edge-to-edge rows).
- `people-client.tsx` — thin shell wiring URL state, deferred search, store,
  data hook, toolbar, table, and sheet.
- `page.tsx` — switch to `flush` surface; prefetch the first `list` page (+
  the selected `person` when `?person=` is present) before `HydrateClient`.

Follow the existing performance rules from the prior spec: cursor pagination,
deferred search value, `nuqs` shallow updates, no blanket memoization, infer
types from tRPC. Add `@tanstack/react-virtual` only if row counts grow past the
first page (not required for the seed-sized dataset).

## Seeding `lightfast` With People

Chosen approach: **seed new realistic signals end-to-end** and let the real
pipeline extract people (no direct people inserts, no schema change).

- Add a dev seed script (e.g. `api/app/scripts/seed-people-signals.ts`, run with
  `pnpm with-env tsx`). It creates a curated batch of ~12 signals in the
  `lightfast` org via the existing `createAndQueueSignal` service (status
  `queued` + `app/signal.created` event), exactly as a real capture would.
- Each seed input is written to **unambiguously mention a person with an
  identity**, so `classify-signal` reliably sets
  `routing.classifyPeople.shouldRun = true` and `classify-people` extracts the
  identity. Examples:
  - "Reply to rauchg@vercel.com about the microfrontends partnership."
  - "DM @leerob on X re: the App Router demo for next week."
  - "Follow up with sarah@netlify.com after the edge functions call."
  - "Review github.com/shadcn's PR feedback on the dialog primitive."
  - "Connect with linkedin.com/in/leerob about the DX role."
  - "Email support@planetscale.com — Vitess branch quota question."
  - … (mix of email / x / github / linkedin / website, ~12 total)
- Inputs: the script needs the `lightfast` `clerkOrgId` and a
  `createdByUserId`, provided via env/args (e.g. `SEED_CLERK_ORG_ID`,
  `SEED_CREATED_BY_USER_ID`). The org id can be obtained via the Clerk CLI.

### Operational requirements (this path is live + nondeterministic)

- Requires the local stack running: `pnpm dev` (app + **local Inngest** +
  QStash) with `DATABASE_*` and AI provider credentials pointed at the
  `lightfast` org's branch.
- The AI does the extraction, so the exact people set is **not deterministic**.
  The seed inputs are written to maximize reliable extraction, but results
  should be eyeballed after the workflow runs.
- After seeding, watch the Inngest dashboard / dev logs until `classify-people`
  completes, then verify rows appear at `/${slug}/people`.

## Testing

Focused tests at changed boundaries, following existing test patterns:

- **DB:** `getPersonByPublicId` (org scoping, not-found); `listPeople` provider/
  type filters and `sort` ordering (extend `db/app/src/__tests__`).
- **Router:** `org.workspace.people.get` bound-org access + tenant isolation;
  `list` filter/sort input validation (extend the existing workspace-people
  router test).
- **Components:** People table rendering, Name fallback to identity, Signals
  column chip + `+N`, empty vs no-results states, filter chips, row-click →
  `?person=` selection, and detail-sheet Signals section calling `signals.get`.
- **Page:** server prefetch happens before hydration (incl. selected person).
- The seed script is dev-only and not unit-tested; it is validated by running it.

## Open Questions

1. **`Display` sort** — ship `Recently seen` / `Name` sort now, or stub the
   Display button for parity and defer sort? (Leaning: ship it; it's additive.)
2. **`+N` semantics** — keep `+N = seenCount − 1` as a count-only affordance, or
   drop `+N` entirely and show only the single last-seen chip until a join table
   exists? (Leaning: keep it, with the detail sheet telling the honest story.)
3. **Seed org targeting** — confirm we seed against the `lightfast` org's
   PlanetScale branch in this worktree (not staging/main), and confirm the
   `createdByUserId` to attribute the seed signals to.
