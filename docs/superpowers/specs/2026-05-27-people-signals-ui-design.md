# People And Signals UI Design

## Context

Lightfast now has the backend pieces for signals and people:

- Signals are created through the public app API, persisted in
  `lightfast_signals`, classified by Inngest, and exposed through public
  `POST /api/v1/signals` and `GET /api/v1/signals/{id}` routes.
- People are created by the people classification workflow from durable
  identities discovered in classified signals and persisted in
  `lightfast_people`.
- `apps/app` does not yet have client-side workspace UI for either surface.

This design adds web UI in `apps/app` while keeping the public API contract and
API-key authentication shape unchanged.

## Goals

- Add separate top-level workspace surfaces for Signals and People.
- Make Signals a read-only operational monitor for the new signal pipeline.
- Make People a simple directory of durable people discovered from signals.
- Use app-internal tRPC queries for Clerk-session UI reads.
- Match a Linear-like, edge-to-edge list style for Signals.
- Keep manual signal capture as a development-only affordance, not a product
  feature.

## Non-Goals

- No production manual signal capture workflow.
- No signal triage actions such as assign, dismiss, archive, or mark reviewed.
- No person detail page, drawer, edit, merge, labels, or relationship history.
- No changes to the public `/api/v1` signal API contract.
- No separate people identity table or full signal-person relationship history.

## Product Shape

Signals and People are separate workspace areas:

- `/${slug}/signals`
- `/${slug}/people`

The sidebar gains a primary `Workspace` group:

- Signals
- People

The existing admin/configuration surface remains under `Manage`:

- Settings

Signals is the default operational surface style. People is a directory.

## Architecture

Add app-internal, bound-org tRPC routers under `org.workspace`:

- `org.workspace.signals.list`
- `org.workspace.people.list`

These routers read directly from `db/app` with organization scoping through the
existing `boundOrgProcedure`. They are separate from the public oRPC API, which
continues to serve API-key callers.

Add DB helpers in `db/app` for organization-scoped list queries:

- `listSignals`
- `listPeople`

Both helpers should support newest-first cursor pagination and simple search.
The app can render the first page for v1, but the API should return
`nextCursor` because automations can grow both tables quickly.

Client code in `apps/app` should infer types from tRPC outputs and inputs. Do
not hand-maintain duplicate row types in the UI. Use `AppRouterOutputs`,
`inferInput`, or equivalent tRPC inference from the existing app patterns.

## Signals UI

Signals uses a Linear-like edge-to-edge workspace surface:

- No centered max-width content container.
- No large left or right page padding.
- The content starts at the sidebar border.
- Header, filter bar, and list span the workspace width.
- Row padding exists inside rows only.
- Use separators and hover states instead of cards.

The Signals page contains:

- A compact topbar with the page title, search, utility controls, and a quiet
  dev-only capture button.
- Status filters: `All`, `Queued`, `Processing`, `Classified`, `Failed`.
- A list of issue-like rows.

Each signal row shows:

- status icon
- classification title when available, otherwise a raw input fallback
- summary or input preview
- priority
- kind
- disposition
- created or updated time

Failed rows show the failure state and should surface `errorCode`.
`errorMessage` is included in the internal query output and should appear as
secondary text or behind a tooltip/popover so the row remains scannable.

Search filters by:

- classification title
- classification summary
- raw input
- signal public id

### Development Capture

The capture affordance is development-only and visually secondary. It exists to
help developers create a real signal while testing the monitor.

It must not create a production-facing tRPC mutation or establish manual capture
as a product workflow. The preferred implementation calls the existing public
`POST /api/v1/signals` endpoint with a developer-provided `ak_` key, then
invalidates the internal tRPC signal list. The key should be provided explicitly
in the dev UI or another local-only mechanism, not silently pulled into a
production client bundle.

## People UI

People uses a conventional directory table with modest page padding. It does
not need the Linear-like full-bleed monitor treatment because v1 is a directory,
not a live queue.

The People page contains:

- page heading
- search input
- directory table
- empty and no-results states

Each person row shows:

- display name, falling back to identity value
- identity provider
- identity type
- identity value
- normalized identity value when useful for debugging
- seen count
- first seen signal id
- last seen signal id
- created or updated time

Search filters by:

- display name
- identity provider
- identity value
- normalized identity value

There is no v1 click-through detail page.

## Data Shape

Signals query input conceptually supports:

```ts
{
  status?: "queued" | "processing" | "classified" | "failed";
  search?: string;
  limit?: number;
  cursor?: { createdAt: string; id: number };
}
```

Signals query output conceptually returns:

```ts
{
  items: Array<{
    id: string;
    input: string;
    status: SignalStatus;
    classification: SignalClassification | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: { createdAt: string; id: number } | null;
}
```

People query input conceptually supports:

```ts
{
  search?: string;
  limit?: number;
  cursor?: { createdAt: string; id: number };
}
```

People query output conceptually returns:

```ts
{
  items: Array<{
    id: string;
    displayName: string | null;
    identityProvider: "email" | "x" | "linkedin" | "github" | "website";
    identityType: "email" | "handle" | "profile_url";
    identityValue: string;
    normalizedIdentityValue: string;
    firstSeenSignalId: string | null;
    lastSeenSignalId: string | null;
    seenCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  nextCursor: { createdAt: string; id: number } | null;
}
```

These shapes are design-level descriptions. The implementation should infer
actual UI types from the tRPC router.

## Loading And Empty States

Signals:

- Edge-to-edge skeleton rows.
- Empty state when no signals exist.
- No-results state when filters/search exclude all signals.
- Error state should preserve the shell and explain that signals could not be
  loaded.

People:

- Table skeleton.
- Empty state when no people exist.
- No-results state when search excludes all people.
- Error state should preserve the page layout and explain that people could not
  be loaded.

## Testing

Use focused tests at the changed boundaries:

- DB helper tests for org scoping, search, newest-first order, limit, and cursor
  pagination.
- tRPC router tests for bound-org access, tenant isolation, filters, cursor
  behavior, and failed-signal fields.
- App page tests verifying server prefetch happens before hydration.
- Sidebar tests for the new `Workspace` group and active route matching.
- Signals component tests for filters, search, empty states, failed rows, and
  dev capture visibility.
- People component tests for directory rendering, search, empty states, and
  no-results behavior.

## Implementation Notes

- Add a small workspace surface helper in `apps/app` so pages can opt into a
  `flush` or `contained` content treatment. Signals uses `flush` and renders its
  header, filter bar, and list directly inside the existing workspace shell.
  People uses `contained`.
- Current backend code already has public signal create/get, but not internal
  tRPC list queries or people list queries.
- Current `lightfast_people` only stores first and last seen signal ids plus
  `seenCount`; do not imply full signal history in the UI.
