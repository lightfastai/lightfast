# Decisions — audit-log table rework

- **Date:** 2026-06-03
- **Status:** Approved (design); ready for implementation plan
- **Supersedes:** the card-list UI from `2026-06-02-decisions-ui-design.md`
- **Related:** `2026-06-02-integration-call-ledger-design.md` (the `provider_routine_calls` ledger this reads)

## Problem

The Decisions page is an audit log of every action Lightfast took against an external provider (Linear, X) on an org's behalf — backed by `lightfast_provider_routine_calls`. Today it renders as a centered card-list (`max-w-4xl`) with a fixed-position slide-in detail panel, and the API returns a flat, unfiltered, unpaginated array (latest 50). For log data this is hard to scan, can't be filtered, and throws away data the API already returns (`inputRedacted` / `outputRedacted` payloads are reduced to a "captured" badge; `errorMessage` is never shown).

This rework moves Decisions to a **full-width, day-grouped audit table** with **inline row expansion** for detail, mirroring the proven People feature architecture but swapping People's detail *sheet* for an *inline expand* (you inspect a log entry in context without losing your place). It also adds **server-side filtering, search, and cursor pagination** to the API.

## Goals

- Full-width, scannable table view of provider routine calls, newest first.
- Inline (accordion) row expansion for full detail — replaces the slide-in panel and avoids covering surrounding rows.
- Server-side **cursor pagination**, **filters** (provider, status), and **search**, mirroring People's exact keyset pattern.
- Surface data already present but currently hidden: pretty-printed input/output JSON payloads and the full `errorMessage`.
- Six "premium" client-only upgrades (below), built almost entirely from existing shared components.

## Non-goals (deferred to GitHub issue/s)

- ⑤ **Live running rows** (auto-refetch / in-place status flip)
- ⑧ **Trace / correlation** ("N related actions in this run" via `calledById` / `sourceRef`) — needs a dedicated correlation query
- ⑨ **Keyboard navigation** (j/k/↵)
- ⑩ **Failure-summary quick-filter chip** ("2 failed · 24h")

Also out of scope: resolving `calledByUserId` to a human name/email (keep the raw caller string as today); a bespoke isometric `decisionsScene` (reuse an existing scene or `AppEmptyState` for now).

## Locked decisions

1. **Table = hand-rolled CSS grid**, mirroring `people-table-view.tsx`'s `ROW_GRID` approach — NOT the shared `<Table>` primitive, which can't cleanly express day-group section headers + inline expansion rows.
2. **Single-row accordion expand**, deep-linkable via `?decision=<publicId>` (opening one collapses the other). Matches "inspect one entry in context."
3. **Server-side** filters + search + cursor pagination (chosen over client-only). Mirror People's keyset cursor exactly.
4. **Reuse over build** everywhere possible (see Reuse Map). The only new shared asset is adding the missing `x` brand mark to `@repo/ui` `integration-icons`.

## Columns

`Status · Action · Caller · Source · Started · Duration · (chevron)`

| Column | Source field(s) | Rendering |
|---|---|---|
| Status | `status` | colored glyph + label (succeeded/running/failed); also drives the left-rail accent |
| Action | `provider`, `providerToolName` | brand glyph + `provider / providerToolName` (mono) |
| Caller | `calledByKind`, `calledById`, `calledByUserId` | `formatCaller` → "Automation …" / "User …" / "System …" |
| Source | `sourceSurface` | small badge (automation / hosted_mcp / native_cli / system) |
| Started | `startedAt` | `formatRelativeTimeToNow`; exact timestamp on hover (title attr) |
| Duration | `startedAt`, `finishedAt` | `formatDuration`; "—" while running |

## Kept upgrades (the six)

- **① Day grouping + sticky headers** — rows grouped by calendar day ("Today" / "Yesterday" / `formatUtcCalendarDate`), each header showing the day's action count + failure count. Grouping is computed client-side over the loaded (paginated) rows.
- **② Status left-rail** — 2px colored left edge per row (green/red/amber) so failures pop on a scan.
- **③ Brand glyphs** — real Linear / X marks instead of letter tiles.
- **④ Source column** — `sourceSurface` badge.
- **⑥ Copy-on-hover** — IDs, payloads, and error text copy via a hover-revealed button.
- **⑦ JSON inspector** — `inputRedacted` / `outputRedacted` pretty-printed with syntax coloring in the expand; full `errorMessage` shown.

## Data layer (`db/app`)

Extend `listProviderRoutineCalls` in `db/app/src/utils/provider-routine-calls.ts` to copy the keyset pattern from `db/app/src/utils/people.ts:47-95`.

**New input shape:**

```ts
interface ListProviderRoutineCallsInput {
  clerkOrgId: string;
  cursor?: { createdAt: Date; id: number } | null;
  limit?: number;                              // normalizeLimit → [1,100], default 50 (already present)
  providers?: ProviderRoutineCallProvider[];   // inArray filter; omit/empty → no filter
  statuses?: ProviderRoutineCallStatus[];      // inArray filter
  search?: string;                             // LIKE over routineId, providerToolName, calledById
}
```

**Return shape:** `Promise<{ items: ProviderRoutineCall[]; nextCursor: { createdAt: Date; id: number } | null }>` (was `ProviderRoutineCall[]`).

**Implementation notes:**

- Keep `ORDER BY createdAt DESC, id DESC` (already present); `provider_routine_calls_org_created_idx` (`clerkOrgId, createdAt, id`) covers it.
- Cursor WHERE: `or(lt(createdAt, cursor.createdAt), and(eq(createdAt, cursor.createdAt), lt(id, cursor.id)))` — same formula as People.
- Fetch `limit + 1`, slice to `limit`, derive `nextCursor` from the last kept item when an extra row exists.
- Reuse existing `normalizeLimit`; add a local `escapeLikePattern` (copy from `people.ts:34-36`) for the search LIKE (`%term%`, `escape '\\'`).
- Filters via `inArray(providerRoutineCalls.provider, providers)` / `inArray(providerRoutineCalls.status, statuses)`, added only when the array is non-empty.

## API layer (`api/app`)

`api/app/src/router/(pending-not-allowed)/decisions.ts` — `decisions.list` on `boundOrgProcedure`:

- **Input** reuses shared schemas from `api/app/src/router/(pending-not-allowed)/workspace-list-input.ts`: `workspaceListCursorInput`, `workspaceListLimitInput`, `workspaceListSearchInput`, plus filter arrays whose elements are small new `z.enum` schemas matching the DB unions — `z.enum(["linear", "x"])` for `providers` (`.max(2)`) and `z.enum(["failed", "running", "succeeded"])` for `statuses` (`.max(3)`), both `.optional()`. Define these enums next to the router (or co-locate with the existing provider-routine-call types if a shared zod schema already exists). (Drop the current `.strict().optional()` flat-limit schema.)
- Router coerces empty filter arrays → `undefined` before calling the DB (as People does).
- **Output** is the DB function's `{ items, nextCursor }` passthrough.

This output change is safe: `grep` confirms `listProviderRoutineCalls` and `decisions.list` are consumed only by the decisions router/page/client and their tests.

## UI layer (`apps/app`)

New/changed files under `…/[slug]/(workspace)/decisions/`, mirroring People's file set:

| File | Role |
|---|---|
| `page.tsx` | RSC — `prefetch(infiniteQueryOptions)` (was `fetchQuery`), `HydrateClient` + `Suspense` fallback |
| `_components/decisions-client.tsx` | "use client" orchestrator — owns all nuqs URL state + the infinite query, flattens pages to `rows[]` |
| `_components/decisions-toolbar.tsx` | search input (deferred value) + Status / Provider filter dropdowns + active-filter chips |
| `_components/decisions-table-view.tsx` | day-grouped CSS-grid table, sticky day headers, status rail, "Load more", footer count |
| `_components/decision-row.tsx` | a single row + its inline-expand detail body |
| `_components/decisions-detail.tsx` | expand content: grouped fields + JSON inspector + error box (the data the old `DecisionDetailPanel` showed, reorganized) |
| `_components/decision-provider-icon.tsx` | maps `provider` → brand glyph from `@repo/ui` integration-icons |
| `_components/decisions-model.ts` | `formatCaller`, status meta (glyph/color/label), day-grouping helper, `DecisionRow` type alias |
| `_components/decisions-search-params.ts` | nuqs parsers: `status`, `provider`, `q`, `decision` (expanded id) — `parseAsString` with no default for `decision` so absence → `null` |
| `_components/use-decisions-list-query.ts` | `useInfiniteQuery` wrapper, `getNextPageParam: p => p.nextCursor`, `placeholderData: prev => prev`, `staleTime` |
| `_components/decisions-loading.tsx` | skeleton mirroring the grid 1:1 (Suspense fallback) |
| `_components/decisions-empty-state.tsx` | `IsoFigure` (reuse existing scene) page-empty + section-empty variants |

**URL state** (nuqs, mirroring `people-search-params.ts`): `?status=`, `?provider=` (comma-joined enum lists), `?q=` (search), `?decision=<publicId>` (expanded row). Search wrapped in `useDeferredValue` before feeding the query.

**Expand interaction:** clicking a row toggles `?decision=<publicId>`; the matching row renders `decisions-detail` immediately below it within the same scroll container (rows below shift down). Single open at a time. The clicked row already holds the full `ProviderRoutineCall` (it's in the list payload) — no extra fetch needed for detail.

**Empty / loading / error / placeholder states:** follow People (`decisions-loading.tsx` 1:1 skeleton; empty vs filtered-empty copy; retry on error; `opacity-60` while `isPlaceholderData`).

## Reuse map

| Need | Reuse |
|---|---|
| Relative time + duration | `@vendor/lib/time` → `formatRelativeTimeToNow`, `formatDuration`, `formatUtcCalendarDate` (deletes the client's hand-rolled `formatDuration`) |
| JSON inspector | `@repo/ui/components/ai-elements/code-block` → `CodeBlock` + `CodeBlockCopyButton`, `language="json"`, `JSON.stringify(payload, null, 2)` |
| Field-level copy | `@repo/ui/components/ssr-code-block` → `SSRCodeBlockCopyButton` (no new clipboard code) |
| Empty-state figure | `@repo/ui/components/iso-figure` → `IsoFigure` + an existing scene |
| Cursor zod inputs | `api/app/.../workspace-list-input.ts` shared schemas |
| Keyset DB pattern | copy `db/app/src/utils/people.ts:47-95` |
| Brand glyphs | `@repo/ui/components/integration-icons` → `IntegrationLogoIcons.linear` (exists). **Add a new `x` mark** to this registry (X is currently missing) so both providers resolve from one shared place. |

## Testing

- `db/app/src/__tests__/provider-routine-calls.test.ts` — extend `listProviderRoutineCalls` coverage: pagination (nextCursor present/null, `limit+1` boundary), provider/status filters, search LIKE, ordering.
- `api/app/src/__tests__/decisions-router.test.ts` — update for `{ items, nextCursor }` output and the new input schema; keep the pending-user FORBIDDEN assertion.
- `apps/app` — a light `decisions-table-view`/expand test mirroring People's component test (renders rows, toggles expansion, shows detail).

## Open items to confirm during implementation

1. **Deferred GH issues:** one umbrella tracking issue listing ⑤⑧⑨⑩, or four separate issues? (Confirm before filing.)
2. **Empty-state scene:** reuse `signalsScene` as a stand-in, or fall back to the non-isometric `AppEmptyState`? (A bespoke `decisionsScene` is explicitly out of scope.)
3. **Caller filter:** provider + status are the two facets shown in the mockup. `calledByKind` is an easy third facet (`org_caller_created` index exists) — include only if cheap.
