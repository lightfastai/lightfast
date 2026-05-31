# Signals UI Loading And Board Rework Design

## Context

The Signals workspace page currently uses a client-side Linear-inspired list
surface, but the data and interaction model still behaves like a page-level
filter boundary. The client reads `status` and `q` from `nuqs`, passes those
values directly into a single `useSuspenseQuery`, and renders the route
fallback whenever a new query key suspends.

That makes common interactions feel heavier than they should:

- clicking `All signals`, `Queued`, `Processing`, `Classified`, or `Failed`
  can show the loading skeleton,
- search and status selection are coupled to the same suspense boundary,
- status lists cannot paginate independently,
- board view cannot be added cleanly because the cache is shaped around one
  active status instead of the full workspace.

The desired behavior is closer to Linear: once the Signals surface is loaded,
status tabs and display changes should feel immediate. Server requests may
continue in the background, but the workspace should remain populated and
stable.

## Goals

- Remove page-level loading from status-tab, search, and display-mode changes.
- Prefetch the first page for each concrete signal status:
  `queued`, `processing`, `classified`, and `failed`.
- Model each status as an independently cached, independently paginated list.
- Keep `All signals` list view grouped into status sections like the current UI.
- Add a Display Options menu that switches between `List` and `Board`.
- Make board view always show all status columns, regardless of the active
  status tab.
- Use fixed-width board cards in horizontally scrollable status columns.
- Keep URL-shareable state in `nuqs` and local interaction state in zustand.
- Keep search server-backed while avoiding route-level loading during search.
- Preserve the Linear-like dense visual language: compact controls, separators,
  hover states, and no nested card-heavy page shell.

## Non-Goals

- No signal detail drawer in this rework.
- No filter popover beyond the existing status tabs and search.
- No drag-and-drop between board columns.
- No signal mutations such as retry, archive, assign, classify, or delete.
- No API contract change unless implementation proves the current cursor shape
  is insufficient.
- No generalized table, board, or virtualization framework outside Signals.
- No redesign of the app sidebar or surrounding workspace layout.

## Invariants

- The canonical route remains `/${slug}/signals`.
- `status` values remain `all`, `queued`, `processing`, `classified`, and
  `failed`.
- Signal rows continue to come from `org.workspace.signals.list`.
- The backend list cursor remains conceptually `{ createdAt, id }`.
- First route load may show the existing Signals skeleton.
- After hydration, tab clicks and view changes must not replace the surface with
  the skeleton.
- Search remains server-backed, not limited to rows already loaded in the
  browser.

## Architecture

Split the Signals page into small units with explicit responsibilities:

- `page.tsx`: server route shell and prefetch orchestration.
- `SignalsClient`: URL state wiring, query hook wiring, and top-level layout.
- `signals-search-params.ts`: shared `nuqs` parsers for `status`, `q`, and
  `view`.
- `signals-ui-store.ts`: zustand store for local interaction state.
- `use-signal-status-query.ts`: hook for one status-specific infinite query.
- `use-signals-workspace-data.ts`: hook that wires the four status queries and
  exposes derived list and board view models.
- `signals-toolbar.tsx`: status tabs, search input, and display options.
- `signals-list-view.tsx`: grouped list rendering.
- `signals-board-view.tsx`: horizontally scrollable status board rendering.
- shared row/card/status helpers for identifiers, status labels, icons, and
  signal title/summary derivation.

The implementation should keep the existing route and tRPC procedure names.
The important change is client data ownership: there is no single "active
status query" anymore. There are four concrete status query caches, and the
visible view is a projection over them.

## URL State

Use `nuqs` for state that should survive refreshes and be shareable:

```ts
{
  status: "all" | "queued" | "processing" | "classified" | "failed";
  q: string;
  view: "list" | "board";
}
```

Defaults:

- `status`: `all`
- `q`: empty string
- `view`: `list`

Status tab clicks update only the `status` query param. Display options update
only the `view` query param. Search updates `q` immediately for shareability,
while server queries consume a deferred value derived from `q` so typing does
not block the workspace.

## Local UI State

Use zustand for local interaction state that should not be encoded in the URL:

```ts
interface SignalsUiState {
  collapsedListGroups: Partial<Record<SignalStatus, boolean>>;
  selectedSignalId: string | null;
  toggleListGroup(status: SignalStatus): void;
  selectSignal(publicId: string): void;
  clearSelection(): void;
}
```

This keeps local row selection and group collapse stable across query refreshes
without pushing incidental UI details into the URL. Board column collapse or
density can be added later to the same store if the UI needs it.

## Query Model

Use one infinite query per concrete status:

```ts
org.workspace.signals.list({
  status: "queued" | "processing" | "classified" | "failed",
  search,
  limit,
  cursor
})
```

The route prefetches the first page for all four statuses with no search term.
The client hydrates those caches and starts from a populated surface.

Client query behavior:

- Use `useInfiniteQuery`, not `useSuspenseQuery`, for status lists after
  hydration.
- Keep a nonzero `staleTime` so immediate navigation across tabs does not
  refetch aggressively.
- Keep previous hydrated/cache data visible during background refreshes.
- Use query metadata such as `isFetching`, `isFetchingNextPage`, `isError`, and
  `hasNextPage` for scoped inline indicators.
- Do not put the full Signals surface behind a client Suspense boundary for
  status, search, or display-mode changes.

`All signals` is not a separate query in v1. It is composed from the four status
queries. In list view this means rendering each status section from its own
query cache. In board view this means rendering each status column from its own
query cache.

## Search

Search remains server-backed. A search term changes the query key for each
concrete status, because results must be correct beyond rows already loaded in
the browser.

Interaction rules:

- The search input updates immediately.
- The server query uses the deferred search value derived from `q`.
- While the searched queries are fetching, keep the prior populated view
  visible.
- Show subtle inline pending state in the toolbar or affected sections, not the
  route skeleton.
- Once searched results arrive, replace each status section or column with the
  server-backed result for that status.
- Empty states should distinguish "no signals yet" from "no matching signals".

If search is cleared, the page returns to the prefetched no-search status
caches.

## List View

List view keeps the current grouped shape:

- `All signals` shows status sections for `Queued`, `Processing`,
  `Classified`, and `Failed`.
- A concrete status tab shows only that status section.
- Sections remain collapsible.
- Rows stay dense and issue-like.
- Row hover and selected states stay subtle.
- Section headers show status icon, label, count, and a quiet description.

Each visible section renders from its matching status query. Pagination is
section-scoped. Loading more `Failed` signals does not affect the cursor or
fetch state for `Queued`, `Processing`, or `Classified`.

## Board View

Board view is selected from the Display Options control and stored in `view`.

Board behavior:

- Always show all concrete status columns, even when `status` is a concrete
  value in the URL.
- Columns appear in status order: `Queued`, `Processing`, `Classified`,
  `Failed`.
- The board scrolls horizontally when columns exceed the viewport.
- Each column has a fixed width.
- Each card has a fixed width equal to the column content width.
- Columns own their own vertical scroll or load-more region.
- Each column renders from its matching status query and cursor.

Board cards should remain compact. A card should show:

- status icon or status label context through the column header,
- signal identifier,
- classification title or input fallback,
- summary or input preview,
- priority and kind when present,
- relative creation time,
- failed error code when present.

Cards are not detail panels. They should be sized for scanning and repeated use,
not for reading full signal payloads.

## Pagination

Use the existing cursor contract. Each status query returns:

```ts
{
  items: Signal[];
  nextCursor: { createdAt: Date; id: number } | null;
}
```

Pagination rules:

- Each status owns its own cursor chain.
- `fetchNextPage` receives the previous page `nextCursor`.
- List view triggers pagination per visible section.
- Board view triggers pagination per column.
- `All signals` does not have a global cursor in v1.

Implementation can start with a small `Load more` row/button per section or
column. Intersection-observer infinite loading can be added once the static
pagination behavior is correct and tested.

## Loading And Error UX

Use the route skeleton only before the first hydrated Signals surface is ready.

After hydration:

- Status tab changes are immediate.
- Display mode changes are immediate.
- Search keeps the current populated surface visible while server-backed
  searched results load.
- Background refresh uses small inline indicators only.
- Loading the next page uses section or column scoped pending affordances.
- Query errors are shown inside the affected section or column with a retry
  action.
- A failure in one status does not collapse or block other statuses.

This is the core Linear-style interaction principle for the rework: local view
changes should not feel like page navigation.

## Display Options

The toolbar keeps the current status tabs and search input. The right-side
Display Options icon becomes a real dropdown.

For v1 the dropdown includes:

- `List`
- `Board`

The active option should be visibly selected. Selecting an option updates the
`view` query param and closes the dropdown. This control can later host density,
ordering, or hidden-column settings if needed, but those are outside this
rework.

## Empty States

Empty states are scoped:

- No rows across all four no-search status queries: global "No signals yet".
- Search active and no rows across all four statuses: global "No matching
  signals".
- Concrete status tab with no rows: section-level empty state for that status.
- Board column with no rows: compact column-level empty state.

Empty states should not replace unrelated populated sections or columns.

## Testing

Use focused tests before production changes.

Client tests should cover:

- first render shows hydrated status data without requiring a status-specific
  click,
- clicking a status tab updates `nuqs` state and does not render the loading
  skeleton,
- `All signals` list renders grouped sections from multiple status query
  results,
- concrete status tabs render only the selected list section,
- collapsed group state is stored locally and survives query refresh,
- Display Options switches from list to board and updates `view`,
- board view always renders all four status columns,
- board columns render fixed status ownership regardless of active status,
- search passes the server-backed search term to all status queries,
- search pending state is inline and does not replace the page surface,
- per-section and per-column load-more actions call the matching status query,
- query errors are isolated to the affected status.

Router and DB tests are only needed if implementation changes the API input or
database helper behavior. The current `status`, `search`, `limit`, and `cursor`
shape already supports the desired client model.

## Acceptance Criteria

- Status tab interactions are visually immediate after the first page load.
- No page-level loading skeleton appears for status tab clicks.
- No page-level loading skeleton appears for display-mode changes.
- Search is server-backed and does not clear the current surface while fetching.
- The route prefetches first pages for all four concrete statuses.
- List view preserves grouped, collapsible status sections.
- Board view shows all four status columns with horizontal scrolling and
  fixed-width cards.
- Each status can paginate independently in list and board views.
- Query errors and pagination pending states are scoped to the affected status.
- `nuqs` owns `status`, `q`, and `view`; zustand owns local selection and
  collapse state.
- Focused client tests cover the interaction contracts above.
- Final verification includes the focused Signals tests and
  `pnpm --filter @lightfast/app typecheck`.
