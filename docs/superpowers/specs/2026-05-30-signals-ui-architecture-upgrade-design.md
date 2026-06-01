# Signals UI — Architecture Upgrade (Option A: client-side working set)

- Date: 2026-05-30
- Status: Reviewed — decisions locked (grill-me, 2026-05-30). Ready to plan implementation.
- Area: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/`
- Related server: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`, `db/app/src/utils/signals.ts`
- Prior art: `docs/superpowers/specs/2026-05-27-people-signals-ui-design.md` already prescribed
  `@tanstack/react-virtual` above a row-count threshold, `useDeferredValue` for expensive list
  filtering, nuqs shallow URL updates, and deferred/debounced search query keys. This upgrade
  executes that performance intent (which was specified but never implemented).

> Note on API layer: the frontend list/get/create path is tRPC (`org.workspace.signals`, wired at
> `api/app/src/root.ts:52`). The separate oRPC surface (`api/app/src/orpc/router/signals.ts`) is an
> external API-key path exposing only `create`+`get` (no `list`) plus the shared
> `createAndQueueSignal` service. This design touches only the tRPC frontend path; oRPC is unaffected.

## Decisions locked (2026-05-30 review)

The draft's core (Option A — in-memory filtering over a bounded working set) survived review, but
several specifics changed. Authoritative decisions:

1. **The ≤2k assumption is false long-term.** Signals are auto-ingested (Inngest
   `app/signal.created`); every workspace crosses 2,000 classified signals quickly. There is no
   retention/archival today.
2. **Bound the working set by a 30-day window + a hard cap + an explicit truncation banner — on day
   one.** `workingSet` = `status='classified' AND createdAt >= now()-30d`, `ORDER BY createdAt DESC,
   id DESC`, `LIMIT 2000`. When the window is clipped by the cap, the server returns
   `truncated: true` + `totalCount` and the UI shows a banner. **Silent truncation is forbidden** —
   that is the property that makes in-memory filtering correct *within the window*. The full archive
   *product* (per-workspace retention setting, an Archived browsing view, a background mark/delete
   job) is a separate later effort. Consequence accepted: signals older than 30 days are not visible
   in the list until the Archived view exists; deep-links still resolve via `get`.
3. **Detail body: skeleton + hover/focus prefetch of `get`.** The projection drops body fields from
   the list cache, so opening a *classified* row fetches the body via `get`. Prefetch `get` on row
   hover/focus so the body is usually warm by click; the skeleton shows only on a cold click.
4. **Freshness: fixed-interval polling, not invalidate-on-drain.** `workingSet` gets
   `refetchInterval ~25–30s`; the processing query keeps `refetchInterval 5s`; both keep
   `placeholderData: prev`. This avoids invalidate-on-processing-drain's fast-classify gap and its
   chattiness on busy workspaces, at a cost of ~33 KB/s average (usually far less under the window).
5. **Virtualize both views, no truncation.** The list (default view) can hold the full ~2,000 rows
   — virtualization is load-bearing for instant filter-swap, not gold-plating. The board virtualizes
   each column with its own vertical virtualizer (robust to kind-skew). No "first N per column".
6. **Keep `virtualization` + `placeholderData` + `useDeferredValue(filters)`. Drop
   `startTransition`-on-writes. Do NOT consolidate to `useQueryStates`.** Once render is virtualized
   the in-memory work is trivial; `useDeferredValue` is the single cheap hedge for a tail-case
   dropped frame. `startTransition` is redundant with it. The six existing `useQueryState` hooks
   (`signals-client.tsx:32-49`) stay — consolidation's only rationale was batching the transition we
   just removed.
7. **Server-side classification filtering becomes dead code; don't pin it with a parity test.** After
   the refactor nothing calls `listSignals`' `disposition`/`kind`/`priority`/`peopleRouted`/`search`
   branches (the frontend filters in memory; the oRPC API has no `list`). Keep `list` physically (the
   processing path still calls it with `statuses`), but make the client predicates in
   `signals-model.ts` the **single tested source of truth**. Write the SQL↔client parity test only
   if/when a server filter consumer reappears.
8. **`SignalListItem` (projection) is the canonical view-row type; the projection ⊂ full by design.**
   The doc's "confirm types stay compatible" is resolved honestly: they are *not* compatible — the
   projection is a strict subset. Views type against `SignalListItem`; the detail sheet seeds the
   header from it and gates the body `get` on a `"input" in item` discriminator. No
   `packages/api-contract` change (that package is the oRPC external surface; frontend types derive
   from the tRPC router output via `AppRouterOutputs`).
9. **Drop `inputPreview` from the server projection.** The working set is classified-only, so
   `classification.title`/`summary` are always present and the `?? input` fallback never fires.
   `inputPreview` is a display concern for *processing* rows, which arrive via `list` with full
   `input`; it is computed client-side when adapting a processing row into `SignalListItem`.

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
- **Never silently truncate filter results.** Filters must be complete *within the bounded window*,
  and any clipping must be visible to the user.
- Keep the existing test suites green; add tests for the new client-side logic.

## Non-goals

- Supporting unbounded (10k+) signal volumes *unbounded in time*. We do **not** assume workspaces
  stay under 2k — they don't. We bound the **live working set** by a 30-day window + a hard cap +
  a truncation banner (see "Bounding & retention"). Browsing beyond the window is the future Archived
  view.
- The full archive **product** (per-workspace retention setting, Archived browsing view, background
  mark/delete or retention job). Day-one ships only the query-level window + cap + banner.
- Realtime push (SSE/WebSocket). We keep polling; push is a separate future effort.
- Redesigning the visual UI (toolbar, rows, board cards, detail sheet layout) — out of scope, except
  the additive truncation banner.

## Decision: Option A

Fetch the workspace's signals as one **bounded, projected working set**, then do **all**
filtering / grouping / sorting / search **in memory**. Filters live only in the URL and the
client; they leave the React Query key entirely.

Alternatives considered:

- **Option B — keep server filtering, mask latency** (startTransition + pending overlay +
  prefetch-on-hover). Smallest change, scales past 2k, but the first application of any combo is
  still a real round-trip — it will still *feel* slow. Rejected: doesn't fix the cause. (We do borrow
  its prefetch-on-hover idea for the *detail body*, decision 3.)
- **Option C — hybrid** (filter loaded pages instantly, background-fetch the rest). Correct at
  large scale but most complex; overkill at the bounded window. Rejected for now.

Option A is the only one that removes the network from the filter path, and within the bounded
window the in-memory work is trivially cheap.

## Bounding & retention (decision 2)

The in-memory approach is only **correct** if the working set is a complete picture of what the
user can filter. Since volume grows unboundedly over time, we bound the *live* set:

- **`workingSet` query:** `status='classified' AND createdAt >= now() - 30d`,
  `ORDER BY createdAt DESC, id DESC`, `LIMIT 2000`, projected columns only (see below).
- **Truncation signal:** when the 30-day window contains more than the cap, the query returns
  `{ items, truncated: true, totalCount }`. The client renders a banner, e.g.
  *"Showing the 2,000 most recent of the last 30 days — filters apply to this window."* When not
  clipped, `truncated: false` and no banner.
- **Why both window and cap:** the 30-day window keeps the median workspace small; the cap +
  banner keep the busy-workspace tail *correct* (a workspace can exceed 2,000 within 30 days). Time
  alone does not bound count.
- **Older signals:** invisible in the list until the Archived view ships; `get` still resolves any
  `publicId` for deep-links, so the detail sheet works for old signals.
- **Future archive product (out of scope here):** per-workspace retention setting, an Archived
  browsing view, and a background job that actually marks/retires rows. Designed to be liftable out
  of Lightfast later if needed.

## The one real constraint and how we resolve it

`workspaceListLimitInput` caps `limit` at **100** and `listSignals` selects **all columns**
(`db.select()` with no projection, `db/app/src/utils/signals.ts:89`), including `input` (bounded by
`SIGNAL_INPUT_MAX_LENGTH = 4000`). Fetching ~2k full rows would be multi-MB and chatty (20 cursor
pages).

Resolution:

1. **Add a bounded, projected `workingSet` query** returning up to ~2,000 classified signals in
   **one request** (no cursor) with only the fields the list/board/grouping need (no `input`, no
   `rationale`/`nextAction`/`errorMessage`). A new input schema lifts the 100 cap to ~2,000 for this
   procedure only. Roughly ~1 MB at the cap.
2. The **detail sheet fetches the full row** via the existing `get` (full columns) for body fields
   not in the projection. Header/badges seed instantly from the cached projection.

### Projected list row (`SignalListItem` projection)

Verified against every renderer (`signals-list-view.tsx:196-255`, `signals-board-view.tsx:160-225`,
grouping in `use-signals-workspace-data.ts:172`). The **server `workingSet`** returns:

- `id` (number, for `SIG-<id>`), `publicId`, `status`, `createdAt`
- `createdByUserId`, `createdByApiKeyId` (for `SignalCreatorAvatar` / source)
- `classification` subset: `title`, `summary`, `kind`, `priority`, `disposition`, `confidence`,
  `routing.classifyPeople.shouldRun`

**No `inputPreview` from the server** (decision 9). Full `input`, `rationale`, `nextAction`,
`errorCode`, `errorMessage`, `updatedAt` are fetched by `get` for the detail sheet only.

`SignalListItem` (the client view-row type) additionally carries a client-computed
`inputPreview?: string`, populated **only when adapting a processing row** (which arrives full via
`list`) into the view type: `inputPreview = input.slice(0, 200)`. Classified working-set rows leave
it undefined — they always have `classification.title`. Helpers become:

```
getSignalTitle(item)   = item.classification?.title   ?? item.inputPreview ?? formatSignalIdentifier(item)
getSignalSummary(item) = item.classification?.summary ?? item.inputPreview ?? ""
```

> Type story (decision 8): `SignalListItem` (projection-derived, plus optional client
> `inputPreview`) is the canonical type for list/board/grouping. Processing rows from `list` are
> *adapted* (a trivial `map`) into `SignalListItem` — not zero-cost widened — because they need the
> computed preview and we don't want full `input` in the view layer. The **full** processing row is
> retained in `signalsByPublicId` so processing-item detail needs no `get`. All three shapes
> (`workingSet` item, `list` item, `get` output) derive from `AppRouterOutputs` — **no
> `packages/api-contract` change**.

## Target architecture

```
page.tsx (force-dynamic, RSC)
  └─ prefetch:
       • workspace.signals.workingSet  (classified, projected, 30d window, cap ~2000, NO filters)  stale 30s
       • workspace.signals.list        (statuses=[queued,processing], small, poll 5s)              stale 5s
  └─ <HydrateClient><Suspense fallback=SignalsLoading><SignalsClient/>

SignalsClient ("use client")
  ├─ nuqs filter state (six existing useQueryState hooks: disposition,kind,people,priority,view,signal)
  │     • NO startTransition wrapping (dropped)
  ├─ raw rows from useSignalsWorkspaceData()   ← NO filters in query key
  │     • workingSet rows (classified projection) + processing rows (adapted to SignalListItem)
  ├─ deferredFilters = useDeferredValue(filters)          ← single deferral hedge
  ├─ truncation banner when workingSet.truncated
  ├─ { listSections, boardSections, hasAnyRows } = useSignalsFiltering(rows, deferredFilters)
  │     • pure in-memory filter → group → sort (client predicates = source of truth)
  ├─ SignalsToolbar (unchanged UI; same handlers)
  ├─ board | list view  → VIRTUALIZED (@tanstack/react-virtual; per-column on the board)
  ├─ SignalCreateDialog (mutation → invalidate workingSet key + processing key)
  └─ SignalDetailSheet (seed header from cache projection + hover-prefetch + fetch full body via get)
```

### Data flow

1. On load, RSC prefetches the working set (projected, 30d-windowed, unfiltered) + the small
   processing query; both batch into one HTTP request via `httpBatchLink`.
2. Client hydrates. `useSignalsWorkspaceData` exposes raw classified rows (projection) + processing
   rows (adapted to `SignalListItem`), plus `truncated`/`totalCount`.
3. Toggling a filter updates nuqs URL state. No query key changes → **no fetch**.
4. `useSignalsFiltering` recomputes the filtered/grouped/sorted sections from the cached rows via
   `useMemo` keyed on `(rows, deferredFilters)`. Virtualized views render only visible rows.
5. Freshness is poll-driven (decision 4): the 5s processing poll keeps `queued/processing` fresh;
   the ~25–30s `workingSet` poll surfaces newly-classified signals. No invalidate-on-drain.

### Client filtering semantics (client predicates are the source of truth)

These mirror today's server SQL, but the **client** implementation in `signals-model.ts` is now
authoritative and directly unit-tested (the server filter branches are dormant — decision 7):

- `kinds` / `priorities` / `dispositions`: "is any of" — keep row if its
  `classification.{kind|priority|disposition}` ∈ selected set (empty set = no constraint).
- `peopleRouted`: keep row if `classification.routing.classifyPeople.shouldRun === true`.
- `search` (future): case-insensitive substring on `classification.title`/`summary` (+ processing
  `inputPreview`). Note: this is narrower than the old server `LIKE` over full `input`/`rationale`/
  `nextAction` — acceptable, since the frontend never wired server search (it passes `""`).
- Sort: `createdAt` desc, then `id` desc (matches `orderBy(desc(createdAt), desc(id))`).
- List grouping: `Classified` + `Processing` sections. Board grouping: `Processing` + one column
  per `signalKindOptions` value (mirrors current `groupRowsByKind`).

### Live updates (decision 4)

- Processing query (`statuses=[queued,processing]`): `refetchInterval: 5s` (small payload). Catches
  cross-tab/cross-user signals while they are queued/processing.
- Working set (classified): `refetchInterval: ~25–30s`. The global query client sets
  `refetchOnWindowFocus: false` and `refetchOnMount: false` (`apps/app/src/trpc/query-client.ts`),
  so a fixed interval is the freshness driver. New classified signals surface within ~30s.
- Both keep `placeholderData: (prev) => prev` so background refetches never flash. With virtualized
  rendering + React Query structural sharing, an unchanged poll re-renders nothing; a changed poll
  re-renders only changed visible rows.
- Rejected: invalidate-on-processing-drain (fast-classify gap when a signal is created+classified
  inside one 5s poll gap; full ~1 MB refetch per drain → chatty on busy workspaces; fragile
  set-diff detection). May be layered on later purely as a snappiness booster if 30s ever feels
  laggy — not required for correctness.

### Detail sheet (decisions 3 + 8)

- **Header** (identifier, disposition badge, title, kind/priority/confidence, status, source) seeds
  instantly from the cached `SignalListItem` → opens immediately.
- **Body** (`input`, `rationale`, `nextAction`, error fields, `updatedAt`) comes from `get`.
  - `hasBody(item)` discriminator = `"input" in item`. Processing rows (retained full in
    `signalsByPublicId`) and already-fetched rows have the body → **no `get`**. Classified
    projection rows fetch it.
  - `get` stays `enabled: open && !hasBody(initialItem) && Boolean(publicId)`.
  - **Hover/focus prefetch:** on row `onMouseEnter`/`onFocus`, `queryClient.prefetchQuery` the `get`
    so the body is usually warm by click; the body skeleton shows only on a cold click.
  - `SignalDetailContent` splits into header (always seeded) + body (skeleton until the full row is
    present); `bodyLoading = !body && query.isLoading`.
- **Deep-link** to a signal not in cache (e.g. >30d old): `get` provides everything; a brief header
  skeleton precedes it. Current behavior preserved.

### Invalidation

Create mutation invalidates exactly two stable keys (`workingSet` + processing), replacing the
filter-combination-dependent `refreshListQueryKeys`. No drain-detection logic (decision 4).

## Components / files affected

Server / DB:
- `db/app/src/utils/signals.ts` — add a projected `listWorkspaceSignals` returning the
  `SignalListItem` projection with the 30-day window + `LIMIT ~2000` + `truncated`/`totalCount`.
  **No `inputPreview` truncation** (decision 9). `listSignals` stays (processing path); its
  classification-filter branches become dormant (decision 7).
- `api/app/src/router/(pending-not-allowed)/workspace-signals.ts` — add the `workingSet` query
  (projected, windowed, cap ~2000, status-only, returns `truncated`/`totalCount`). New input schema
  lifting the 100 cap for this procedure only. Keep `list` (cursor) for the processing path.
- `packages/api-contract` — **no change** (oRPC external surface only; frontend types derive from
  the tRPC router output).

Client:
- `signals/page.tsx` — prefetch `workingSet` (windowed) + processing (no filters).
- `_components/use-signals-workspace-data.ts` — fetch working set + processing; expose raw rows +
  `truncated`/`totalCount`; adapt processing rows to `SignalListItem` (compute `inputPreview`); keep
  full processing rows in `signalsByPublicId`; drop filters from query input; two stable invalidation
  keys.
- `_components/use-classified-signals-query.ts` — repurpose/replace; remove filter-keyed query; add
  `refetchInterval ~25–30s` to the working set.
- `_components/use-signals-filtering.ts` — NEW: in-memory filter/group/sort over `(rows,
  deferredFilters)`.
- `_components/signals-client.tsx` — keep the six `useQueryState` hooks (no `useQueryStates`, no
  `startTransition`); add `useDeferredValue(filters)`; render the truncation banner; feed filtered
  sections to views.
- `_components/signals-list-view.tsx`, `signals-board-view.tsx` — virtualize (list: one vertical
  virtualizer; board: one per column); precompute per-row derived values (avoid `new Date()` per
  render); add row `onMouseEnter`/`onFocus` hover-prefetch.
- `_components/signal-detail-sheet.tsx`, `signal-detail-content.tsx` — seed header from cache, gate
  body `get` on `"input" in item`, split header/body with a body skeleton.
- `_components/signals-model.ts` — `SignalListItem` view type (+ optional `inputPreview`); client
  filter/group/sort predicates as the tested source of truth; update `getSignalTitle`/`getSignalSummary`.
- NEW: truncation banner component (additive UI).

## Error & loading states

- Initial load: existing `SignalsLoading` Suspense fallback (unchanged).
- Background refetch: keep the subtle "Refreshing" indicator already in section/column headers;
  `placeholderData` keeps content visible.
- Truncation: explicit banner when `workingSet.truncated` (additive, not an error).
- Working-set fetch error: section/column error + retry (existing pattern).
- Detail body fetch error: existing "Signal not found" / error treatment in the sheet.

## Testing

- Keep green: `signals-model.test.ts`, `signal-detail-content.test.tsx`,
  `apps/app/src/__tests__/.../signals-client.test.tsx`, `signals-page.test.tsx`,
  `db/app/src/__tests__/signals-list.test.ts`, api signal tests.
- Add:
  - **Client filter/group/sort unit tests** against `signals-model.ts` predicates — the single
    source of truth (replaces the SQL↔client parity test, decision 7).
  - **Working-set query test**: 30-day window + cap + `truncated`/`totalCount` correctness
    (clipped vs not).
  - **Virtualization smoke test**: renders a subset, selection still works (list + board column).
  - **Detail seed-then-fetch test**: header from projection, body via `get`, `"input" in item`
    discriminator skips `get` for processing/full rows, hover-prefetch warms the cache.
  - **Truncation banner test**: shows on `truncated`, hidden otherwise.
- Do **not** add the SQL↔client parity test now (server filter branches have no consumer).

## Rollout

Incremental, each step shippable:

1. Server: add the projected `workingSet` query (30d window + cap + `truncated`/`totalCount`;
   additive; nothing removed).
2. Client: switch data hook to working set + processing; add `useSignalsFiltering`; remove filters
   from query keys; render the truncation banner. (This alone kills the ~1s lag.)
3. Add `useDeferredValue(filters)`; add the ~25–30s working-set `refetchInterval`. (No
   `startTransition`, no `useQueryStates`.)
4. Virtualize list, then board (per-column virtualizers).
5. Detail sheet: seed header from `SignalListItem`, gate body `get` on `"input" in item`, add
   hover/focus prefetch, split header/body skeleton; simplify create invalidation to the two keys.
6. Optional polish: `next/dynamic` for create dialog + detail sheet.

Later, separate effort (not this spec): the archive **product** — per-workspace retention setting,
Archived browsing view, background mark/retire job.

## Resolved open questions

1. **Working-set cap / window** — RESOLVED: 30-day window + `LIMIT 2000` + `truncated`/`totalCount`
   banner (decision 2). Cap is a *correctness* boundary, not a soft perf knob.
2. **Projection field list** — RESOLVED: the field list above is sufficient; **`inputPreview` is
   dropped from the server projection** and computed client-side for processing rows only
   (decision 9).
3. **Working-set refetch cadence** — RESOLVED: fixed `refetchInterval ~25–30s`, not
   invalidate-on-drain (decision 4).
4. **Projection vs `get` type compatibility** — RESOLVED: they are *intentionally incompatible*
   (projection ⊂ full). `SignalListItem` is the canonical view type; the body `get` is gated by a
   `"input" in item` discriminator; no `api-contract` change (decision 8).

## Remaining items to confirm during implementation planning

- Exact working-set `LIMIT` (2,000) and retention window (30 days) as named constants — and where
  they live (db util vs shared config) so the future setting can promote them.
- Banner copy and placement (toolbar-adjacent vs above the list).
- `refetchInterval` exact value within 25–30s.
- Per-column board virtualization ergonomics with the existing collapse/expand store
  (`signals-ui-store.ts`).
