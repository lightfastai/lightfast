# Create New Signal Design

## Context

The Signals workspace page currently reads organization-scoped signals through
`org.workspace.signals.list` in tRPC. Signal creation exists only through the
public oRPC `POST /api/v1/signals` endpoint, which is authenticated by org API
keys. After a signal is created, the existing pipeline persists the row, emits
`app/signal.created`, and classifies the signal through
`@repo/ai/signal-classifier` inside the Inngest `classify-signal` workflow.

This design adds a production, user-facing Clerk-session create flow to the
Signals page in `apps/app`. It preserves the public API-key endpoint and reuses
the same durable classification pipeline.

## Goals

- Add a production `New signal` action to the Signals workspace page.
- Let signed-in users create one raw signal input from a single-submit,
  chat-style composer.
- Keep the browser UI on Clerk-session tRPC auth, not API-key auth.
- Reuse the existing DB create, Inngest enqueue, and AI classification path.
- Refresh the Signals list after creation so the queued signal appears quickly.

## Non-Goals

- No multi-turn chat or AI-assisted refinement before creation.
- No direct browser import from `@repo/ai` or client-side classification.
- No change to the public `/api/v1/signals` contract.
- No API-key creation or exposure inside the app UI.
- No signal editing, triage, dismissal, assignment, or archive workflow.

## Recommended Approach

Use a shared server-side creation service and a new tRPC mutation.

The new app mutation lives under `org.workspace.signals.create` and uses
`boundOrgProcedure`, so only active, bound organizations can create signals from
the workspace UI. The existing oRPC `signals.create` handler and the new tRPC
mutation both call a shared server helper that:

1. Validates and receives normalized input from the router.
2. Creates the `lightfast_signals` row with status `queued`.
3. Sends `app/signal.created` to Inngest.
4. Marks the signal `failed` if enqueueing fails.
5. Returns the created public signal id and queued status.

This keeps public API-key creation and in-app Clerk-session creation behavior
aligned while preserving their separate auth boundaries.

## UX

The Signals toolbar gets a `New signal` button on the right side, near the
search and display controls. The button should use a clear icon plus text on
desktop and remain compact on narrow viewports. The empty state should also
offer a secondary `New signal` action so first use is discoverable.

The create UI is a dialog that feels like a command palette but behaves like a
single chat composer:

- A compact title, such as `New signal`.
- A short description for screen readers and context.
- One large auto-growing textarea for the raw signal input.
- Enter submits, Shift+Enter inserts a newline.
- A round `ArrowUp` submit button anchored in the composer footer.
- A character count based on `SIGNAL_INPUT_MAX_LENGTH`.
- Disabled submit for blank input, over-limit input, or pending mutation.
- No suggestion chips or prompt templates in v1; the flow stays focused on one
  raw input and one submit action.

On success, the dialog clears and closes, a success toast confirms the signal
was queued, and the Signals list invalidates/refetches. If the current filter
would hide queued signals, the toast still reports success; the UI does not
silently mutate the user's filters.

## Architecture

### Server

Add a shared signal creation helper in `api/app`, close to the existing signal
routers. The helper owns enqueue failure handling so oRPC and tRPC do not
duplicate this behavior.

The helper accepts:

```ts
{
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  input: string;
}
```

For API-key calls, `createdByApiKeyId` remains the verified API key id. For
Clerk-session calls, it is `null`, which requires the DB schema and insert type
to allow UI-created signals without an API key.

`db/app` should update `createdByApiKeyId` from required to nullable. Existing
API-created rows keep their API key id. UI-created rows carry
`createdByUserId` and a null API key id. The list UI should continue to infer
row types from tRPC output rather than duplicating DB shapes.

### tRPC

Extend `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`:

- `list` remains unchanged.
- `create` uses `createSignalInput` from `@repo/api-contract`.
- The handler scopes creation to `ctx.auth.identity.orgId`.
- The handler passes `ctx.auth.identity.userId` as `createdByUserId`.
- The mutation returns the same shape as public create:
  `{ id: signal.publicId, status: "queued" }`.

### oRPC

Update `api/app/src/orpc/router/signals.ts` to call the same helper. The public
contract and response shape remain unchanged.

### AI Pipeline Reuse

The app UI does not import or call `@repo/ai`. Reuse happens through the durable
pipeline:

```text
Signals dialog
  -> org.workspace.signals.create
  -> shared create/enqueue helper
  -> lightfast_signals row, status queued
  -> app/signal.created
  -> classify-signal Inngest workflow
  -> @repo/ai/signal-classifier
  -> optional people classification routing
```

This preserves retries, idempotency, telemetry, failure codes, and the existing
people classifier handoff.

## Error Handling

- Empty or whitespace-only input is blocked client-side and rejected by
  `createSignalInput` server-side.
- Inputs longer than `SIGNAL_INPUT_MAX_LENGTH` are blocked client-side and
  rejected server-side.
- If DB insertion fails, the mutation surfaces the standard tRPC mutation error
  toast.
- If Inngest enqueue fails after the row is created, the helper marks the row
  failed with `INNGEST_ENQUEUE_FAILED` and the mutation returns an error.
- The dialog keeps the user's input when mutation submission fails.
- The Signals list continues to render failed rows with `errorCode` and
  `errorMessage` context.

## Testing

### API Tests

Add or extend `api/app/src/__tests__/workspace-signals-router.test.ts`:

- `create` trims input and creates a queued signal for a bound org.
- `create` sends `app/signal.created` with the authenticated org id.
- `create` passes `createdByApiKeyId: null` for Clerk-session creation.
- `create` rejects pending, unauthenticated, unbound, and revoked org states.
- `create` rejects invalid input before inserting.
- `create` marks the signal failed and throws when enqueueing fails.

Update `api/app/src/__tests__/signal-orpc.test.ts` only as needed to verify the
public route still passes the API key id through the shared helper path.

### DB Tests

Update signal DB tests to cover nullable `createdByApiKeyId` creation. Keep list
behavior unchanged.

### App Tests

Extend
`apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/signals-client.test.tsx`:

- Renders the `New signal` toolbar button.
- Opens and closes the create dialog.
- Blocks blank submit.
- Submits a valid signal through `trpc.org.workspace.signals.create`.
- Invalidates the current signals list query on success.
- Clears/closes the dialog on success.
- Preserves input on mutation failure.
- Shows the empty-state create action when there are no signals.

## Rollout

This can ship behind the normal bound-org workspace gate. No feature flag is
required because the workflow uses existing auth and signal infrastructure, and
the public API behavior remains unchanged.
