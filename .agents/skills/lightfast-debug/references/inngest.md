# Inngest

Use this block for any event-driven or background-execution path.

## Capability

- Local Inngest dev server inspection
- Function discovery, event sending, direct invocation, and run-status inspection

## Owns

- event-triggered workflows
- step-by-step run debugging
- retries, cancellations, and backfills
- cron-triggered health and maintenance tasks
- async fanout after runtime entrypoints

## What To Check

- Was the expected event emitted?
- Which function should have handled it?
- Did a run get created, and if not, where did the chain stop?
- Which step failed, retried, or stalled?
- Is the problem reproducible by direct invoke or only through real event flow?

## Exit Criteria

- The relevant function, run, and failing step are identified
- The issue is classified as missing trigger, bad input, step failure, retry behavior, or downstream dependency failure

## Handoff

- Move to `runtime` when the event was never emitted or the entrypoint is wrong.
- Move to `db` to verify workflow side effects.
- Move to `observability` for timeline correlation across runs and services.
