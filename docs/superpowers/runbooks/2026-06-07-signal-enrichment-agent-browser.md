# Signal Enrichment Agent Browser Runbook

Use this runbook to verify the signal-scoped entity enrichment flow locally with
the X and GitHub emulators.

## Preconditions

- Local infra env overrides are present for `apps/app`.
- The current branch has the signal entity enrichment workflow registered.
- The local org has X and GitHub connectors bound through the emulator setup.

## Start Dev

From the repository root:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Wait until the app, local Inngest, local QStash, and Portless services are
ready. The browser target is:

```bash
https://lightfast.localhost
```

## Agent Browser

In a second shell:

```bash
agent-browser open https://lightfast.localhost
agent-browser snapshot -i
```

## Verify

1. Navigate to Signals.
2. Create a signal containing both `@ava_ai` and `https://github.com/avachen`.
3. Open the created signal detail view.
4. Confirm the signal detail initially shows entity links for the X handle and
   GitHub profile URL.
5. Wait for the enrichment workflow to queue profile observations from the X
   and GitHub emulators.
6. Confirm the eligible X/GitHub links resolve to a person.
7. Navigate to People and confirm the resolved person appears with
   `entity_graph` or `mixed` provenance.
8. Capture evidence:

```bash
agent-browser snapshot -i
agent-browser screenshot /tmp/signal-enrichment-verification.png
```

## Manual Retry

If the signal has unresolved links and the enrichment request needs to be
replayed in dev, invoke the dev-only TanStack server function from an
authenticated app/dev surface:

```ts
import { retrySignalEnrichment } from "@api/app/tanstack/entity-graph";

await retrySignalEnrichment({
  data: {
    signalId: "signal_123e4567-e89b-12d3-a456-426614174000",
  },
});
```

Expected Inngest event:

```json
{
  "name": "app/signal.entity-enrichment.requested",
  "data": {
    "clerkOrgId": "<active-org-id>",
    "reason": "manual_retry",
    "signalId": "<signal-id>"
  }
}
```
