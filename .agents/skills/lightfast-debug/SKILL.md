---
name: lightfast-debug
description: |
  General-purpose Lightfast debugging workflow. Triggers when the user asks to debug,
  investigate, trace, reproduce, inspect, or diagnose behavior across the app, platform,
  Inngest workflows, database state, connected providers, or observability tooling. Use as
  the broad entrypoint when no narrower skill is clearly better, when the failing surface is
  unclear, or when a bug may cross multiple systems. Prefer `lightfast-db`,
  `lightfast-inngest`, or `lightfast-sdk` for direct single-surface requests that clearly map
  to one of those tools.
---

# Lightfast Debug Skill

Use this skill as the broad debug entrypoint for Lightfast. Organize the investigation by
capability block, not by feature-specific symptoms or implementation details.

## Debug Blocks

- **Browser**: Real user reproduction in `apps/app`, including auth, navigation, client
  state, and failing network requests. Read `references/browser.md` when the problem is best
  understood from the user's path through the product.
- **Runtime**: Direct app and platform execution outside the browser. Read
  `references/runtime.md` for HTTP routes, middleware, rewrites, local dev servers,
  service-to-service calls, and streaming endpoints.
- **Inngest**: Event-driven and background execution. Read `references/inngest.md` for
  workflow runs, step failures, retries, event fanout, backfills, and cron-driven behavior.
- **DB**: Persisted system truth. Read `references/db.md` to inspect schema, rows, joins,
  and state transitions after the system has executed.
- **SDK**: Connected-provider and remote-system truth. Read `references/sdk.md` when the
  investigation depends on GitHub, Linear, Sentry, Vercel, Apollo, or other provider-backed
  actions exposed through Lightfast.
- **Observability**: Logs, traces, errors, and run timelines. Read
  `references/observability.md` when logs or traces are the fastest way to identify the
  failing boundary.

## Selection Rules

- Start with the widest block that can quickly falsify the current hypothesis.
- Keep one primary block. Add secondary blocks only when evidence crosses a system boundary.
- Prefer `browser` for "what a user sees."
- Prefer `runtime` for direct server and API behavior.
- Prefer `inngest` for async and background paths.
- Prefer `db` for "what actually persisted."
- Prefer `sdk` for provider-facing truth.
- Prefer `observability` when existing logs or traces can narrow the problem faster than a
  manual repro.

## Typical Flows

1. User-facing regression: `browser` -> `runtime` -> `observability` -> `db`
2. Webhook or background issue: `runtime` -> `inngest` -> `db` -> `observability`
3. Provider issue: `sdk` -> `runtime` or `inngest` -> `db`
4. Unknown failure: `observability` -> primary failing block -> `db`

## Debug Evidence Chain

When a debugging session may be handed off or resumed, preserve this compact evidence chain:

- **Primary block**: one of `browser`, `runtime`, `inngest`, `db`, `sdk`, `observability`.
- **Secondary blocks**: any additional blocks used after evidence crossed a boundary.
- **Entrypoint or repro**: the user action, HTTP route, event, function, query, provider action, or log source that starts the investigation.
- **Failing boundary**: the request, run, step, provider call, persisted state, or visible UI divergence that proves where the issue currently localizes.
- **Truth source**: the strongest confirming evidence, such as a response body, run status, row/query result, provider state, trace, stack, or screenshot.
- **Next decisive check**: the single next check most likely to falsify or confirm the active hypothesis.

Use these same field names in handoffs. Entire checkpoints may contain the full transcript, but this evidence chain is the resume surface a future agent should read first.

## Notes

- The existing focused skills still matter: `lightfast-db`, `lightfast-inngest`, and
  `lightfast-sdk` are the deepest tool-specific paths for those blocks.
- Use this skill to choose the right debug surface first, then load a narrower skill only if
  the investigation becomes tool-specific.
