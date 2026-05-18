# Observability

Use this block when logs, traces, and errors are the fastest entrypoint into the failure.

## Capability

- Structured logs
- Error tracking
- Trace and request context inspection
- Run-timeline correlation across services

## Owns

- fast pivots from symptom to failing boundary
- request and run timeline reconstruction
- cross-service error correlation
- identifying whether a failure is synchronous, asynchronous, or provider-facing

## What To Check

- Is there already an error, trace, request ID, or run ID?
- Which service reported the first meaningful failure?
- What was the last successful boundary crossing before the error?
- Is the failure visible in app logs, platform logs, or workflow logs?
- Can observability narrow the primary block before manual reproduction?

## Exit Criteria

- The primary failing boundary is identified
- The next concrete check belongs to exactly one other block

## Handoff

- Move to the block named by the evidence: `runtime`, `inngest`, `db`, `sdk`, or `browser`.
- Return to `observability` when you need to re-correlate after new evidence appears.
