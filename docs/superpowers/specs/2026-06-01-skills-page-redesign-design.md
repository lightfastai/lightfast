# Skills page redesign — design

Date: 2026-06-01
Status: Approved (visuals approved via `/tmp/skills-redesign-mockup.html`)
Area: `apps/app` — workspace Skills surface

## Problem

The current Skills page is more complex than the feature warrants. It renders a
flush full-width header, a tabbed validity filter, an index-diagnostics block,
and a vertical list of `Collapsible` rows that each carry badges, resource
counts, a path, a Source button, and an inline markdown preview. A *separate*
full detail page (`[skillSlug]/page.tsx`) duplicates that information with a
metadata/diagnostics/resources sidebar. Skills are read-only (indexed from a
connected GitHub repo), so this is a lot of chrome for "browse the catalog, read
one skill."

We want a calmer, denser surface modeled on the connectors page and the Codex
"skills" reference: a centered hero, a search + filter row, one grouped grid of
compact skill cells, and a centered dialog for reading a single skill.

## Goals

- Replace the row list + standalone detail page with a **2-column grid** of
  compact skill cells under a single **Team** group.
- Centered **hero** ("Make Lightfast work your way") + subtitle.
- Reading a skill happens in a **centered dialog**, deep-linkable via
  `?skill=<slug>`. The dialog is the single home for a skill's markdown and
  (when invalid) its diagnostics.
- Keep the **validity filter** (All / Valid / Invalid) and mark invalid skills
  on their cell.
- Match the existing "precise" visual language (connectors tokens: `h-7`
  controls, `rounded-[9px]` / `rounded-[12px]`, muted palette, `size="lf"`
  inputs).

## Non-goals

- **No** enable/disable toggle, **no** install/uninstall, **no** "Try in chat".
  These appear in the Codex reference but have no backend (skills are read-only).
  This is a visual/structural redesign only — no API, schema, or router changes.
- No new skill grouping. Only "Team" exists; "Recommended" / "System" are out.
- No per-skill icons in the data model. Use one shared glyph for every skill.
- No changes to the skills index/refresh services or the tRPC `list` / `get`
  procedures (we may stop calling `get` from a page — see Routing).

## Decisions (from brainstorming)

| Topic | Decision |
| --- | --- |
| Dialog actions (toggle/uninstall/try-in-chat) | Visual-only — omit them. Keep the working "View source" GitHub link. |
| Detail view | Replace the `[skillSlug]` route with a centered dialog keyed by `?skill=<slug>`. Remove the route page. |
| Icons | One shared glyph for every team skill. |
| Filter | Keep validity filter (All / Valid / Invalid); mark invalid cells with a small pill. |
| Hero copy | "Make Lightfast work your way" + descriptive subtitle. |
| Header alignment | Centered hero (not left-aligned). |
| Trailing cell action | None (no `+` / `✓`). Whole cell is the click target. |
| Group label | "Team". |

## Architecture

### Routing & data

- `skills/page.tsx` keeps the prefetch → `HydrateClient` → client shape. It
  already prefetches `trpc.org.workspace.skills.list`. No change needed beyond
  rendering the new client. (Mirrors `connectors/page.tsx`.)
- Detail is **not** a route anymore. The dialog reads from the same `list`
  payload already in the client (every skill in `list` carries `bodyMarkdown` /
  `sourceMarkdown`, `diagnostics`, `resources`, `path`, `indexedCommitSha`), so
  the dialog needs **no** extra fetch. We select the open skill by `?skill=<slug>`
  via `useQueryState("skill")` (nuqs), exactly like connectors' `?connector=`.
- **Remove** `skills/[skillSlug]/page.tsx` and `skill-detail.tsx`. The
  `skills.get` procedure stays in the router (still useful / tested) but is no
  longer called by a page. This keeps the change scoped to the UI.

### Component breakdown

```
skills/
  page.tsx                         (unchanged shape; renders SkillsClient)
  _components/
    skills-client.tsx             (REWRITE) hero + controls + group + grid + dialog state
    skill-grid.tsx                (NEW)     "Team" group header + 2-col grid; maps cells
    skill-cell.tsx                (NEW)     one compact clickable cell (glyph/name/desc/invalid pill)
    skill-glyph.tsx               (NEW)     shared skill glyph (size variants)
    skill-dialog.tsx              (NEW)     centered Dialog: header, desc, diagnostics, markdown, footer
    skill-markdown.tsx            (KEEP)    renders SKILL.md via MarkdownContent (already exists)
    skill-status.tsx              (KEEP)    freshness badge; relocated into the controls row
    skills-loading.tsx            (UPDATE)  skeleton matching hero + grid
    skill-row.tsx                 (DELETE)  replaced by skill-cell
    skill-detail.tsx              (DELETE)  replaced by skill-dialog
```

Each unit has one job:
- `SkillGlyph` — visual identity only; no data.
- `SkillCell` — pure presentation + `onSelect(slug)`; no data fetching, no
  query-state. Receives a `skill` and renders glyph/name/truncated description
  and an Invalid pill when `validationStatus === "invalid"`.
- `SkillGrid` — group header ("Team" + count), divider, the `grid grid-cols-1
  sm:grid-cols-2` layout, empty state. Receives the filtered list + `onSelect`.
- `SkillDialog` — receives the selected `skill` (or `undefined`), `repositoryUrl`,
  and `onOpenChange`. Renders the centered dialog. Open state is derived from
  whether a skill is selected (mirrors connectors' sheet).
- `SkillsClient` — owns search state, filter state, `?skill` query-state, the
  `useSuspenseQuery`, filtering/sorting, and wiring `onSelect` → set `?skill`.

### Layout (matches the approved mockup)

- Container: `mx-auto w-full max-w-3xl px-6 py-10` (connectors container; 2 cols
  fit comfortably). `WorkspaceSurface variant="contained"` is `max-w-6xl` so we
  use a bespoke wrapper or pass a `max-w-3xl` className.
- Hero: centered. `h1` `font-semibold text-3xl tracking-[-0.02em]`, subtitle
  `text-muted-foreground text-sm` centered, `max-w-[30rem] mx-auto`.
- Controls row: search `Input` (`variant="lf" size="lf"` with leading Search
  icon, `pl-8`) + `Select` validity filter (`h-7 rounded-[9px]`). The
  `SkillStatus` freshness badge sits at the end of this row (small, muted). A
  subtle ghost `Open repository ↗` link (uses `repositoryUrl`) also lives in this
  row so the source repo stays one click from the list.
- Group: header line — `Team` (`text-sm font-medium`) + **visible-count** pill
  (`text-xs text-muted-foreground`, counts the filtered result set so it tracks
  search/filter) — over a `border-b border-border` divider, then the grid.
- Cell: `flex items-center gap-3 rounded-[9px] px-2.5 py-3 hover:bg-muted/50`,
  glyph `size-9 rounded-[9px] border`, name `text-sm font-medium truncate`,
  desc `text-xs text-muted-foreground truncate`, trailing Invalid pill only
  when invalid.
- Dialog (`@repo/ui/components/ui/dialog`): `DialogContent` ~`sm:max-w-2xl`,
  `max-h-[82vh]`, internal column with a scrollable markdown body.
  - Header: `SkillGlyph` (rounded) + title (`name` bold + `Skill` muted) +
    GitHub source `icon-btn` + `DialogClose`.
  - `DialogDescription` = skill description.
  - Invalid: amber diagnostics callout above the body.
  - Body: bordered `rounded-[12px] bg-muted/20` scroll region rendering
    `SkillMarkdown`. When markdown is unavailable, the existing fallback copy.
  - Footer: skill `path` (mono, muted) on the left, `View source` outline button
    on the right (uses `getSkillSourceUrl`).

### Data flow

1. `page.tsx` prefetches `skills.list` → hydrate.
2. `SkillsClient` `useSuspenseQuery(skills.list)` → `{ freshness,
   indexDiagnostics, repositoryUrl, skills }`.
3. Local `query` (deferred) + `filter` derive `visibleSkills` via the existing
   `matchesFilter` / `matchesQuery` helpers (carried over), sorted invalid-first
   then by slug (current behavior).
4. Grid renders cells; clicking sets `?skill=<slug>`.
5. `selectedSkill = skills.find(s => s.slug === skillParam)`; passed to
   `SkillDialog`. Closing clears `?skill`.

### Edge cases

- **Empty catalog** vs **no matches**: same two-message split the current client
  uses ("No skills indexed." / "No matching skills."), shown inside the group.
- **Invalid skill**: Invalid pill on the cell; dialog shows the diagnostics
  callout and the markdown fallback when `bodyMarkdown`/`sourceMarkdown` is
  absent.
- **Index diagnostics** (repo-level): keep as a subtle banner above the group
  when `indexDiagnostics.length > 0` (carried from current client).
- **Freshness**: `SkillStatus` relocated into the controls row (stale /
  refreshing / unavailable still visible).
- **`?skill` for an unknown/filtered-out slug**: `find` returns `undefined` →
  dialog stays closed; param is harmless. (We do not force-clear it, matching
  connectors' tolerance of stale params.)
- **Repo-level "Open in GitHub"**: the prominent header button becomes a subtle
  ghost `Open repository ↗` link in the controls row; per-skill `View source`
  covers the per-skill case.

## Testing

- Update `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/*`
  to the new structure. Cover:
  - Grid renders one cell per skill; search filters; validity filter filters.
  - Invalid skill shows the Invalid pill.
  - Clicking a cell sets `?skill` and opens the dialog with the right
    name/description/markdown; closing clears `?skill`.
  - Invalid skill dialog renders diagnostics + fallback copy.
  - Empty vs no-match messaging.
- Remove tests tied to the deleted `[skillSlug]` route / `skill-detail`.
- `pnpm --filter @api/app build` (types), `pnpm check`, `pnpm typecheck`, and the
  app test suite.

## Files

- **Rewrite**: `skills-client.tsx`.
- **New**: `skill-grid.tsx`, `skill-cell.tsx`, `skill-glyph.tsx`,
  `skill-dialog.tsx`.
- **Update**: `skills-loading.tsx`, `skill-status.tsx` (placement only), skills
  test file(s).
- **Delete**: `skills/[skillSlug]/page.tsx`, `skill-row.tsx`, `skill-detail.tsx`,
  and the corresponding detail test(s).
- **Keep untouched**: `page.tsx` (shape), `skill-markdown.tsx`, router/services.
