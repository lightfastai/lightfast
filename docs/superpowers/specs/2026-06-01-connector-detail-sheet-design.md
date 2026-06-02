# Connector Detail Sheet Design

## Context

The Connectors workspace page (`connectors/page.tsx` → `connectors-client.tsx`)
lists MCP connectors from `org.workspace.connectors.list`. Connected connectors
render a `ConnectedConnectorCard` with an inline tools badge cloud, an
automations toggle, and a `'…'` dropdown (Refresh tools / Reconnect /
Disconnect). Post-connect, the OAuth callback redirects back to
`…/connectors?connector=linear` (or `&error=…`); the client shows a transient
green "connected" banner (or a red error banner) and then strips the params from
the URL.

There is no way to inspect a connection's details. The card surfaces tool
*names* only, and nothing tells you who/where the connection is bound (the
Linear workspace and account), when it was connected, or when tools were last
refreshed.

The `list` procedure already returns the full connection for each connected row,
so no new data fetch is needed. Each `connection` carries: `status`
(`active` | `error` | `revoked`), `connectedAt`, `providerWorkspaceName`,
`providerActorName`, `lastToolRefreshAt`, `lastToolRefreshErrorAt`,
`lastToolRefreshErrorCode`, `enabledForAutomations`, and `tools[]` (each
`{ name, description?, availableForAutomations }`).

This design adds a right-side detail **Sheet**, modeled on the signals detail
sheet (`signal-detail-sheet.tsx` / `signal-detail-content.tsx`): an icon/title
header, a metadata property block, a tools list, and a timestamp footer. The
sheet is **read-only** — all mutations stay in the card's `'…'` menu.

## Goals

- Open a right-side sheet with full connection detail, modeled on the signals
  detail sheet's container and `PropertyRow` layout.
- Reuse the existing `?connector=<provider>` URL parameter so the open sheet is
  shareable and refresh-safe, driven via `nuqs` (matching the signals
  `?signal=` pattern).
- Auto-open the sheet for the freshly-connected connector after a successful
  OAuth callback, **replacing** the green success banner — the open sheet is the
  post-connect confirmation.
- Add a "View details" item to the connected card's `'…'` dropdown that opens
  the sheet.
- Render entirely from the already-loaded `list` row (no new tRPC query, no DB
  read).

## Non-Goals

- No backend, tRPC, or DB changes. `org.workspace.connectors.list` is unchanged;
  no `get` procedure is added (unlike signals, the list row is always present).
- No exposure of the Clerk teammate who connected it (`connectedByUserId` stays
  unexposed). "Who" is the Linear-side identity only
  (`providerActorName` / `providerWorkspaceName`).
- No actions inside the sheet — no Refresh tools, Reconnect, Disconnect, or
  automations toggle. These remain in the card's `'…'` menu. The sheet mirrors
  the automations state as a read-only pill.
- No sheet for available (not-yet-connected) connectors; they keep their inline
  Connect button untouched.
- No tool input-schema display (the `list` row's `DisplayConnectorTool` omits
  `inputSchema`).
- No change to the public oRPC API.

## Recommended Approach

Drive the sheet from the existing `?connector=` URL parameter, resolving the row
synchronously from the cached `list` query.

`ConnectorsClient` reads `connector` via `nuqs` `useQueryState`. Because the page
prefetches `list` server-side and the client uses `useSuspenseQuery`, the list is
always loaded before the client renders — so the selected row resolves
synchronously and no skeleton/not-found/`get` fallback is required.

The OAuth callback already lands on `?connector=<provider>`, so a successful
connect opens the sheet for free. On error (`&error=…` present), the sheet must
*not* open — a failed connect has no connection to show — so the error path
keeps the inline banner and clears both params on mount.

This is a frontend-only change that reuses the param the callback already sets;
the only behavior change to existing flows is dropping the green success banner
in favor of the auto-opening sheet.

## UX

Two entry points open the sheet, both setting `?connector=<provider>`:

1. **Post-connect (success):** the OAuth callback redirects to
   `…/connectors?connector=linear`. The sheet auto-opens on the now-connected
   Linear row. The green "connected" banner is removed.
2. **"View details":** a new first item in the connected card's `'…'` dropdown.

Closing the sheet (close button, overlay click, or Escape) clears `?connector`.
A copy-link button writes the current `?connector=` URL to the clipboard with a
confirmation toast.

If `?connector=` names a provider with no current connection (available,
disconnected, or unknown), the sheet stays closed.

Sheet contents, top to bottom (mirroring the signals sheet):

- **Header:** the `ConnectorIcon`, the provider id (`linear`, monospace), and a
  status badge (dot + label) from the shared `connectionStatus()` helper.
  Right-aligned actions: copy-link and close. A visually-hidden `SheetTitle`
  carries the connector display name for accessibility.
- **Title:** the connector `displayName` (e.g. "Linear"), with `description` as a
  one-line subtitle.
- **Property block** (`PropertyRow`: icon + `w-36` label + value):
  - **Status** — Connected / Tools stale / Needs reconnect, from
    `connectionStatus()` (dot + label).
  - **Workspace** — `providerWorkspaceName` (hidden when null).
  - **Account** — `providerActorName` (hidden when null).
  - **Connected** — relative time from `connectedAt` (absolute on `title` hover).
  - **Automations** — read-only pill: "Enabled" / "Disabled" from
    `enabledForAutomations`.
  - **Tools refreshed** — relative time from `lastToolRefreshAt`; when
    `lastToolRefreshErrorAt` is set, show a warning treatment with
    `lastToolRefreshErrorCode`. Hidden when never refreshed.
- **Divider**, then **Tools** section:
  - A "Tools" heading with a count badge (`connection.tools.length`).
  - One row per tool: the tool `name` (monospace) and `description` (muted),
    with a small green dot when `availableForAutomations` is true. The list
    scrolls within the sheet body.
- **Footer:** "Connected {relative}" and, when present, "tools refreshed
  {relative}" (absolute on `title` hover).

The sheet is read-only; no field is editable and there are no mutation controls.

## Architecture

### URL / selection state — `connectors-client.tsx`

- Read the selected provider via `useQueryState("connector")` (nullable string).
  `setConnector(provider)` opens; `setConnector(null)` closes.
- **"View details"** dropdown item calls `setConnector(row.provider)`.
- **Resolve the row:** `connectors.find((r) => r.provider === selectedProvider && r.connection)`.
  Pass the matched row (or `undefined`) to the sheet; `undefined` means closed.
- **Post-connect / banner handling:**
  - Drop the green success-banner JSX. On success the `connector` param drives
    the sheet open; the param is *not* stripped (so it stays deep-linkable),
    and is cleared only when the sheet is closed.
  - Keep the red error banner (its content still comes from the one-time
    `callbackState` capture so it survives param clearing). Change the cleanup
    effect to run only when `callbackState.error` is set, and to clear *both*
    `connector` and `error` from the URL (so the sheet does not open on error
    and the banner does not re-trigger on refresh). Use `nuqs` setters for both
    params to avoid mixing with `router.replace`.
- `page.tsx` is unchanged — it still passes `callbackConnector` (for the error
  banner's provider label) and `callbackError`.

### Component — `connector-detail-sheet.tsx`

Lives in the connectors `_components/`. Uses `Sheet`, `SheetContent`,
`SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetClose` from
`@repo/ui/components/ui/sheet`, with the same floating-right container classes as
`signal-detail-sheet.tsx`
(`inset-y-3 right-3 left-auto … rounded-2xl border p-0 sm:max-w-md`).

Props:

```ts
{
  row?: ConnectorCatalogRow;          // the matched connected row; undefined = closed
  onOpenChange: (open: boolean) => void;
}
```

- Open when `row` is defined and `row.connection` is non-null.
- Renders `ConnectorDetailContent` directly from `row` (no query, no loading
  state). Owns the copy-link handler (copies `window.location.href`), matching
  the signals sheet.

### Component — `connector-detail-content.tsx`

The inner layout, mirroring `signal-detail-content.tsx`. Reuses local
`PropertyRow` (icon + `w-36` label + value) and a small `Tool` row. Props:

```ts
{
  row: ConnectorCatalogRow;           // guaranteed connected
  closeSlot?: ReactNode;
  onCopyLink: () => void;
}
```

Renders header, property block, tools list, and footer as described in UX.
Uses `formatRelativeTimeToNow` from `@vendor/lib/time` for timestamps and
`ConnectorIcon` for the header glyph.

### Model helpers — `connectors-model.ts` (new)

Extract the display helpers currently inline in `connectors-client.tsx` into a
shared model module, so the client and the sheet share one source (mirroring
`signals-model.ts`):

- Types: `ConnectorCatalogRow`, `ConnectorConnection`, `ConnectorProvider`,
  `ConnectorTool` (derived from `AppRouterOutputs["org"]["workspace"]["connectors"]["list"]`).
- `connectionStatus(connection) → { dotClass, label }` (moved verbatim).
- `displayProviderName(provider)` (moved verbatim).

`connectors-client.tsx` imports these instead of defining them locally; its
behavior is otherwise unchanged. The connect-availability / mutation-gating
helpers (`isConnectableProvider`, `isMutationDisabled`, etc.) stay in the client
since the read-only sheet does not use them.

## Error Handling

- A `?connector=` param naming a provider with no current connection resolves to
  `undefined` and the sheet stays closed; the param is left inspectable (no
  auto-clear), matching the signals sheet's not-found behavior.
- The OAuth error path (`&error=…`) shows the inline error banner, clears both
  params on mount, and never opens the sheet.
- Degraded connections render their status via `connectionStatus()`: amber
  "Tools stale" when `lastToolRefreshErrorAt` is set, red "Needs reconnect" when
  `status === "error"`. The "Tools refreshed" row surfaces
  `lastToolRefreshErrorCode` in the warning treatment.
- Null `providerWorkspaceName` / `providerActorName` / `lastToolRefreshAt` rows
  are hidden rather than shown empty (matching the signals sheet's absent-row
  behavior).

## Testing

Vitest + Testing Library, matching the existing app/connectors tests.

### Component tests — `connector-detail-content.test.tsx` (new)

- Renders all property rows and the tools list for a fully connected fixture
  (workspace, account, connected, automations enabled, tools refreshed, N tool
  rows with the correct count badge).
- Hides Workspace/Account/Tools-refreshed rows when those fields are null.
- Renders the "Disabled" automations pill when `enabledForAutomations` is false.
- Renders the degraded status (amber "Tools stale" with `lastToolRefreshErrorCode`,
  red "Needs reconnect") for the respective fixtures.
- Marks automation-available tools with the indicator dot and omits it
  otherwise.

### Client/integration tests — extend the connectors client/page tests

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`
(and/or the connectors client test):

- "View details" in the `'…'` menu opens the sheet and sets `?connector=`.
- Closing the sheet clears `?connector`.
- An initial `?connector=linear` (success callback) opens the sheet on mount and
  no longer renders the green success banner.
- An initial `?connector=linear&error=…` renders the error banner, clears both
  params, and does not open the sheet.
- A `?connector=` for an available (unconnected) provider does not open the
  sheet.
- Copy-link writes the current URL to the clipboard.

The existing assertion for the green success banner is replaced by the
sheet-opens assertion.

## Rollout

Ships behind the normal bound-org workspace gate with no feature flag.
Frontend-only: no tRPC, DB, or public-API change. Existing list/card behavior,
the connect/refresh/disconnect mutations, and the error banner are unchanged; the
only behavior change is replacing the post-connect success banner with the
auto-opening sheet, plus the small extraction of display helpers into
`connectors-model.ts`.
