# Signals Detail Sheet Design

## Context

The Signals workspace page now renders a fuller list/board UI. Rows are
classified signals read from `org.workspace.signals.list` in tRPC. Selecting a
row already sets `selectedSignalId` in a Zustand store
(`signals-ui-store.ts`) and highlights the row, but there is no detail view —
clicking a signal does nothing visible beyond the highlight.

`listSignals` performs `db.select().from(signals)`, so each list item is the
full `Signal` record: `id`, `publicId`, `clerkOrgId`, `createdByUserId`,
`createdByApiKeyId`, `input`, `status`, `classification`, `errorCode`,
`errorMessage`, `createdAt`, `updatedAt`. Every field the detail view needs is
already present on the loaded row.

This design adds a right-side detail **Sheet** that opens when a signal is
clicked, modeled on a task-detail panel (icon/title header, a metadata property
block, a body, a timestamp footer) but retuned to the signal-classification
model. The sheet is read-only: classification is AI-generated and there is no
update path.

## Goals

- Open a right-side sheet with full signal detail when a row is selected, in
  both list and board views.
- Render instantly from the already-loaded list row when available.
- Make the open signal shareable and refresh-safe via a `?signal=<publicId>`
  URL parameter.
- Resolve a deep-linked or not-yet-loaded signal through a new org-scoped
  `org.workspace.signals.get` tRPC procedure.
- Present classification fields (disposition, kind, priority, confidence,
  status, people-routing, source, created) plus the input, summary, next
  action, rationale, and failure details.

## Non-Goals

- No editing, triage, dismissal, assignment, archive, or status mutation.
- No activity/audit log feed (we have no activity data); a created/updated
  footer stands in for it.
- No new DB columns or schema changes; the `get` procedure reuses the existing
  `getSignalByPublicId`.
- No change to the public `/api/v1/signals` oRPC contract.
- No multi-signal selection or bulk actions.

## Recommended Approach

Drive selection from the URL and prefer the in-memory row, falling back to a
thin `get` query.

`SignalsClient` owns a `signal` nuqs query parameter holding the selected
`publicId`. The selection state moves out of the Zustand store and is derived
from the URL; the store keeps only `collapsedListGroups`. Row highlight is
unchanged — list and board views still receive a `selectedSignalId` prop, now
sourced from the URL param.

When the param is set, `SignalsClient` looks up the matching row among the
loaded signal pages and passes it to the sheet as an instant `initialSignal`.
If the signal is not in the loaded set (a shared link opened fresh, or a signal
on a later page), the sheet fetches it by `publicId` via the new `get`
procedure, showing a skeleton while loading and a not-found state on a miss.

This keeps in-session clicks instant while making the shareable URL actually
resolve on refresh/share — the small amount of backend that makes the URL
feature real.

## UX

Clicking a signal row (list or board) opens a right-side sheet and sets
`?signal=<publicId>`. Closing the sheet (close button, overlay click, or Escape)
clears the param. The selected row stays highlighted while the sheet is open.

Sheet contents, top to bottom:

- **Header:** the signal kind icon, the identifier (`SIG-<id>`), and a
  disposition badge. Actions on the right: copy-link (writes the current
  `?signal=` URL to the clipboard with a confirmation toast) and close. A
  visually-hidden `SheetTitle` carries the signal title for accessibility.
- **Title:** `classification.title`, falling back to `input` when the signal is
  not yet classified.
- **Property block** (icon + label + value rows, mirroring the reference
  panel):
  - **Disposition** — Actionable / Needs context / Not actionable.
  - **Kind** — Engage / Follow up / Review / Fix / Investigate / Remember /
    Other.
  - **Priority** — Urgent / High / Normal / Low.
  - **Confidence** — `classification.confidence` formatted as a percentage.
  - **Status** — Queued / Processing / Classified / Failed.
  - **People routing** — Yes / No from
    `classification.routing.classifyPeople.shouldRun`, with the rationale in a
    tooltip when present.
  - **Source** — "API key" when `createdByApiKeyId` is set, otherwise "User".
  - **Created** — relative time from `createdAt`.
  - Rows whose underlying value is absent (e.g. classification fields on an
    unclassified signal) are hidden rather than shown empty.
- **Divider**, then **Body** sections, each with a small label:
  - **Input** — the raw submitted text.
  - **Summary** — `classification.summary`.
  - **Next action** — `classification.nextAction`.
  - **Rationale** — `classification.rationale`.
  - **Error** — `errorCode` and `errorMessage`, shown only when
    `status === "failed"`.
- **Footer:** Created and Updated timestamps (absolute on hover via `title`,
  relative inline).

The sheet is read-only; no field is editable and there are no mutation
controls.

## Architecture

### tRPC

Extend `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`:

- `list` and `create` remain unchanged.
- Add `get`, a `boundOrgProcedure` with input `{ publicId }` validated by
  `signalIdSchema` from `@repo/api-contract`. The handler calls
  `getSignalByPublicId(ctx.db, { publicId, clerkOrgId: ctx.auth.identity.orgId })`
  and returns the `Signal` row, or throws `TRPCError` `NOT_FOUND` when the row
  is missing or belongs to another org.

`getSignalByPublicId` already exists in `db/app` and is org-scoped, so no DB
change is needed. The returned shape is the same `Signal` element type as a list
item, so the sheet component is agnostic to whether its data came from the list
or the `get` query.

### Selection / URL state

- Add a `signal` parser to `signals-search-params.ts` (a nullable string
  param holding the `publicId`), consistent with the existing nuqs view/filter
  params.
- `SignalsClient` reads `signal` via `useQueryState`. `onSelectSignal(publicId)`
  sets the param; closing the sheet sets it to `null`.
- Remove `selectedSignalId`, `selectSignal`, and `clearSelection` from
  `signals-ui-store.ts`; keep `collapsedListGroups` and its toggle. List and
  board views are unchanged — they keep receiving `selectedSignalId` and
  `onSelectSignal` props.

### Component — `signal-detail-sheet.tsx`

Lives alongside the other signals components in `_components/`. Uses `Sheet`,
`SheetContent`, `SheetHeader`, `SheetTitle` from `@repo/ui/components/ui/sheet`
on the right side.

Props:

```ts
{
  publicId: string | null;          // from the URL param; null = closed
  initialSignal?: SignalRow;         // loaded row, when available
  onOpenChange: (open: boolean) => void;
}
```

Data resolution:

- Open when `publicId` is non-null.
- If `initialSignal` matches `publicId`, render it immediately.
- Otherwise call `useQuery(trpc.org.workspace.signals.get.queryOptions({ publicId }))`;
  render a skeleton while pending and a not-found empty state on error/null.

### Wiring — `signals-client.tsx`

- Render `<SignalDetailSheet>` once, controlled by the `signal` param.
- Compute `initialSignal` by scanning the loaded signal pages for the matching
  `publicId`. The flattened rows are available via the existing
  `use-signals-workspace-data` / `use-classified-signals-query` data; expose a
  `findSignalByPublicId` (or a flat row list) from that layer if not already
  reachable. The `get` fallback covers any miss, so this lookup is purely an
  instant-open optimization.

### Model helpers — `signals-model.ts`

Add:

- `getSignalStatusLabel(status)` — maps `signalStatusSchema` values to labels.
- `formatSignalConfidence(confidence)` — formats `0..1` as a percentage.
- `getSignalSource(signal)` — returns `{ label, isApiKey }` based on
  `createdByApiKeyId`.

Reuse the existing `getSignalKindLabel`, `getSignalPriorityLabel`,
`getSignalDispositionLabel`, `getSignalTitle`, and `formatSignalIdentifier`.

## Error Handling

- `get` throws `TRPCError` `NOT_FOUND` for a missing or cross-org `publicId`;
  the sheet renders a not-found empty state with a close action.
- A `?signal=` param that resolves to nothing (deleted/invalid id) shows the
  same not-found state; the param is not auto-cleared so the URL stays
  inspectable, but the user can close to clear it.
- Network/query errors in the `get` fallback render an inline error with a
  retry, consistent with the list section error treatment.
- Signals with `status === "failed"` render their `errorCode`/`errorMessage` in
  the body Error section.
- Unclassified signals (`classification` is null) hide the classification-only
  property rows and body sections and still show input, status, source, and
  timestamps.

## Testing

Vitest + Testing Library, matching the existing app tests.

### API tests

Extend `api/app/src/__tests__/workspace-signals-router.test.ts`:

- `get` returns the signal for a matching `publicId` in the bound org.
- `get` throws `NOT_FOUND` for an unknown `publicId`.
- `get` throws `NOT_FOUND` for a `publicId` owned by a different org.
- `get` rejects pending, unauthenticated, unbound, and revoked org states.

### Component tests

Add `signal-detail-sheet.test.tsx`:

- Renders all property rows and body sections for a fully classified fixture.
- Hides classification-only rows/sections for an unclassified fixture while
  still showing input, status, source, and timestamps.
- Renders the Error section for a `failed` fixture.
- Renders "API key" vs "User" source from `createdByApiKeyId`.
- Falls back to the `get` query when no `initialSignal` is provided (skeleton →
  resolved), and shows the not-found state on a miss.

### Client/integration tests

Extend
`apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`:

- Clicking a row opens the sheet and sets the `?signal=` param.
- Closing the sheet clears the param.
- The selected row stays highlighted while the sheet is open.
- Copy-link writes the current URL to the clipboard.
- An initial `?signal=` param opens the sheet on mount (deep-link), resolving
  via the loaded row when present and via `get` otherwise.

## Rollout

Ships behind the normal bound-org workspace gate with no feature flag. It adds
one read-only tRPC query and a client-rendered sheet; the list/board behavior,
the create flow, and the public API are unchanged. The only state migration is
moving selection from the Zustand store to the URL param, which is internal to
the signals page.
