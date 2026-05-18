# Runtime

Use this block for direct app or platform behavior outside the browser.

## Capability

- Terminal-based server inspection
- Direct HTTP probing with local auth context
- Code and route inspection across `apps/app`, `apps/platform`, `api/app`, and `api/platform`

## Owns

- route handling and rewrites
- middleware and auth boundaries
- tRPC, oRPC, REST, SSE, and local dev endpoints
- service-to-service calls between app and platform
- local server startup, env loading, and process health

## What To Check

- Is the correct local service running and reachable?
- Does the request land on the expected app or platform route?
- Can the failure be reproduced directly without the browser?
- Is the auth mode correct for the endpoint: session, API key, or service JWT?
- Does the failure happen before async processing, after it, or at a boundary crossing?

## Exit Criteria

- The failing route, handler, or boundary is isolated
- Inputs and expected runtime behavior are clear

## Handoff

- Move to `inngest` when the runtime emits or depends on background work.
- Move to `db` when you need persisted confirmation.
- Move to `observability` when logs or traces will narrow the failure faster.
