# Signals UI — Architecture Upgrade (Option A: client-side working set)

- Date: 2026-05-30
- Status: Draft (awaiting review)
- Area: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/`
- Related server: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`, `db/app/src/utils/signals.ts`
- Prior art: `docs/superpowers/specs/2026-05-27-people-signals-ui-design.md` already prescribed
  `@tanstack/react-virtual` above a row-count threshold, `useDeferredValue` for expensive list
  filtering, nuqs shallow URL updates, and deferred/debounced search query keys. This upgrade
  executes that performance intent (which was specified but never implemented).

## Problem statement

Selecting a filter takes ~1 second before the list visibly updates. Root cause: filtering
is **server-side and keyed on URL state**, so every distinct filter combination triggers a
fresh network round-trip.

Exact chain:

1. Toggle a filter → `setKindState(...)` (nuqs, `shallow: true`, no RSC reload).
2. `filters` `useMemo` recomputes (`signals-client.tsx:56`).
3. `useSignalsListQuery({ filters })` bakes filters into the tRPC **query key**
   (`use-classified-signals-query.ts:38-54`).
4. New key → `useInfiniteQuery` has no cache → it **fetches over the network**
   (`workspace.signals.list` → `listSignals` SQL with JSON-path predicates).
   `placeholderData: (prev) => prev` prevents a flash, but the *filtered* result only
   appears once the fetch resolves.
5. First application of any combo pays full HTTP + DB latency (~1s in dev). `staleTime: 30s`
   makes re-applying the *same* combo instant, but the first time always lags.

This is confirmed by the server: `listSignals` (`db/app/src/utils/signals.ts`) filters in SQL
via `classification->>'$.disposition' | '$.kind' | '$.priority'`, `routing.classifyPeople.shouldRun`,
and `input LIKE` search, with keyset pagination ordered by `createdAt DESC, id DESC`.

## Goals

- Filtering, grouping, sorting, and (future) search feel **instant** — no network on the filter path.
- Keep filters in the URL (shareable / deep-linkable) via nuqs.
- Render up to ~2,000 signals smoothly (no jank on data swap or scroll).
- Keep live status transitions (`queued → processing → classified`) appearing without a manual refresh.
- Keep the existing test suites green; add tests for the new client-side logic.

## Non-goals

- Supporting unbounded (10k+) signal volumes per workspace. Decided scale is ≤ ~1–2k. If that
  assumption breaks later, revisit server-side filtering + virtualized pagination (Option B/C below).
- Realtime push (SSE/WebSocket). We keep polling; push is a separate future effort.
- Redesigning the visual UI (toolbar, rows, board cards, detail sheet layout) — out of scope.

## Decision: Option A

Fetch the workspace's signals as one **bounded, projected working set**, then do **all**
filtering / grouping / sorting / search **in memory**. Filters live only in the URL and the
client; they leave the React Query key entirely.

Alternatives considered:

- **Option B — keep server filtering, mask latency** (startTransition + pending overlay +
  prefetch-on-hover). Smallest change, scales past 2k, but the first application of any combo is
  still a real round-trip — it will still *feel* slow. Rejected: doesn't fix the cause.
- **Option C — hybrid** (filter loaded pages instantly, background-fetch the rest). Correct at
  large scale but most complex; overkill at ≤2k. Rejected for now.

Option A is the only one that removes the network from the filter path, and at ≤2k the in-memory
work is trivially cheap.

## The one real constraint and how we resolve it

`workspaceListLimitInput` caps `limit` at **100** and `listSignals` selects **all columns**
(`getSignalColumns()`), including `input` (which can be large — bounded by `SIGNAL_INPUT_MAX_LENGTH`).
Fetching ~2k full rows would be multi-MB and chatty (20 cursor pages).

Resolution:

1. **Add a bounded, projected working-set query** that returns up to ~2,000 classified signals in
   **one request** with only the fields the list/board/grouping need (no full `input`, no
   `rationale`/`nextAction`/`errorMessage`). This keeps the payload to roughly ~1 MB.
2. The **detail sheet fetches the full row** via the existing `get` (full columns) for body fields
   not in the projection. Header/badges seed instantly from the cached projection.

### Projected list row (`SignalListItem` projection)

Fields required by `signals-list-view.tsx` / `signals-board-view.tsx` / grouping:

- `id` (number, for `SIG-<id>`), `publicId`, `status`, `createdAt`
- `createdByApiKeyId` / `createdByUserId` (for `SignalCreatorAvatar` / source)
- `inputPreview` — `input` truncated server-side (e.g. first 200 chars) for unclassified/processing
  rows whose title/summary fall back to `input`
- `classification` subset: `title`, `summary`, `kind`, `priority`, `disposition`, `confidence`,
  `routing.classifyPeople.shouldRun`

Full `input`, `rationale`, `nextAction`, `errorCode`, `errorMessage`, `updatedAt` are fetched by
`get` for the detail sheet only.

> Note: the existing tRPC `get` already returns the full row, and `list`/`get` share
> `getSignalColumns()` today — so the detail sheet works for deep-links. The projection is an
> additive new shape; `get` stays the source of truth for the full body.

## Target architecture

```
page.tsx (force-dynamic, RSC)
  └─ prefetch:
       • workspace.signals.workingSet  (classified, projected, cap ~2000, NO filters)   stale 30s
       • workspace.signals.list        (statuses=[queued,processing], small, poll 5s)    stale 5s
  └─ <HydrateClient><Suspense fallback=SignalsLoading><SignalsClient/>

SignalsClient ("use client")
  ├─ nuqs filter state (consolidated useQueryStates: disposition,kind,people,priority,view,signal)
  │     • writes wrapped in startTransition (non-urgent)
  ├─ raw rows from useSignalsWorkspaceData()   ← NO filters in query key
  │     • workingSet rows (classified) + processing rows
  ├─ deferredFilters = useDeferredValue(filters)
  ├─ { listSections, boardSections, hasAnyRows } = useSignalsFiltering(rows, deferredFilters)
  │     • pure in-memory filter → group → sort (mirrors server SQL semantics exactly)
  ├─ SignalsToolbar (unchanged UI; same handlers)
  ├─ board | list view  → VIRTUALIZED (@tanstack/react-virtual)
  ├─ SignalCreateDialog (mutation → invalidate ONE workingSet key + processing key)
  └─ SignalDetailSheet (seed header from cache projection + fetch full body via get)
```

### Data flow

1. On load, RSC prefetches the working set (projected, unfiltered) + the small processing query;
   both batch into one HTTP request via `httpBatchLink`.
2. Client hydrates. `useSignalsWorkspaceData` exposes raw classified + processing rows.
3. Toggling a filter updates nuqs URL state inside `startTransition`. No query key changes →
   **no fetch**.
4. `useSignalsFiltering` recomputes the filtered/grouped/sorted sections from the cached rows via
   `useMemo` keyed on `(rows, deferredFilters)`. Virtualized views render only visible rows.
5. The 5s processing poll keeps `queued/processing` fresh; when a processing item completes it
   leaves the processing set, and we refetch/invalidate the working set so it appears under
   "Classified" (see Live updates).

### Client filtering semantics (must match server SQL exactly)

- `kinds` / `priorities` / `dispositions`: "is any of" — keep row if its
  `classification.{kind|priority|disposition}` ∈ selected set (empty set = no constraint).
- `peopleRouted`: keep row if `classification.routing.classifyPeople.shouldRun === true`.
- `search` (future): case-insensitive substring on `input`/`inputPreview`.
- Sort: `createdAt` desc, then `id` desc (matches `orderBy(desc(createdAt), desc(id))`).
- List grouping: `Classified` + `Processing` sections. Board grouping: `Processing` + one column
  per `signalKindOptions` value (mirrors current `groupRowsByKind`).

A small parity test fixture will assert client predicates produce the same membership as the
server filter for representative inputs.

### Live updates

- Processing query (`statuses=[queued,processing]`): `refetchInterval: 5s` (small payload).
- Working set (classified): `staleTime: 30s`. The global query client sets
  `refetchOnWindowFocus: false` and `refetchOnMount: false` (`apps/app/src/trpc/query-client.ts`),
  so we **cannot** rely on focus/mount refetch — instead **invalidate the working set when the
  processing set shrinks** (an item finished classifying), so newly-classified signals surface
  promptly without polling ~2k rows every 5s. (Optionally enable `refetchOnWindowFocus` for just
  this query if invalidation proves insufficient.)
- Keep `placeholderData: (prev) => prev` so background refetches never flash.

### Detail sheet

- Seed header (identifier, disposition badge, title, kind/priority/confidence, status, source) from
  the cached working-set projection → opens instantly.
- Fetch the full row via `get` (enabled when open) for body fields (`input`, `summary`,
  `nextAction`, `rationale`, error fields, `updatedAt`); show a body skeleton until it resolves.
- Deep-link to a signal not in the working set: `get` provides everything (current behavior).

### Invalidation

Create mutation invalidates exactly two stable keys (working set + processing), replacing the
filter-combination-dependent `refreshListQueryKeys`.

## Components / files affected

Server / DB:
- `db/app/src/utils/signals.ts` — add a projected, higher-cap working-set list (or a
  `listWorkspaceSignals` returning `SignalListItem` projection + `inputPreview`).
- `api/app/src/router/(pending-not-allowed)/workspace-signals.ts` — add the `workingSet` query
  (projected, cap ~2000, status-only). Keep `list` (filtered/cursor) for API consumers.
- `packages/api-contract` — schema for the projected row + working-set input/output if needed.

Client:
- `signals/page.tsx` — prefetch working set + processing (no filters).
- `_components/use-signals-workspace-data.ts` — fetch working set + processing; expose raw rows;
  drop filters from query input; simplify invalidation keys.
- `_components/use-classified-signals-query.ts` — repurpose/replace; remove filter-keyed query.
- `_components/use-signals-filtering.ts` — NEW: in-memory filter/group/sort (+ `useDeferredValue`).
- `_components/signals-client.tsx` — consolidate nuqs to `useQueryStates` with `startTransition`;
  feed filtered sections to views.
- `_components/signals-list-view.tsx`, `signals-board-view.tsx` — virtualize rows/columns;
  precompute per-row derived values (avoid `new Date()` per render).
- `_components/signal-detail-sheet.tsx` — seed header from cache + fetch full body.
- `_components/signals-model.ts` — projected row type + parity-friendly predicate helpers.

## Error & loading states

- Initial load: existing `SignalsLoading` Suspense fallback (unchanged).
- Background refetch: keep the subtle "Refreshing" indicator already in section/column headers;
  `placeholderData` keeps content visible.
- Working-set fetch error: section/column error + retry (existing pattern).
- Detail body fetch error: existing "Signal not found" / error treatment in the sheet.

## Testing

- Keep green: `signals-model.test.ts`, `signal-detail-content.test.tsx`,
  `apps/app/src/__tests__/.../signals-client.test.tsx`, `signals-page.test.tsx`,
  `db/app/src/__tests__/signals-list.test.ts`, api signal tests.
- Add: client filter/group/sort unit tests; **parity test** (client predicates vs server filter
  membership); virtualization smoke test (renders subset, selection still works); detail
  seed-then-fetch test.

## Rollout

Incremental, each step shippable:

1. Server: add projected working-set query (additive; nothing removed).
2. Client: switch data hook to working set + processing; add `useSignalsFiltering`; remove filters
   from query keys. (This alone kills the ~1s lag.)
3. Wrap nuqs writes in `startTransition`; consolidate to `useQueryStates`.
4. Virtualize list + board.
5. Detail sheet seed-header + fetch-body; simplify invalidation.
6. Optional polish: `next/dynamic` for create dialog + detail sheet.

## Open questions / to confirm during planning

1. **Working-set cap**: confirm ~2,000 is the right ceiling, and the `inputPreview` length (200?).
2. **Projection vs full row**: confirmed projection is required for payload reasons — confirm the
   exact field list above is sufficient for the row/board renderers.
3. **Working-set refetch cadence**: invalidate-on-processing-drain vs a fixed interval — pick one.
4. Confirm `AppRouterOutputs[...].list.items[number]` vs `get` output types stay compatible after
   introducing the projection (the detail sheet relies on the full shape).
