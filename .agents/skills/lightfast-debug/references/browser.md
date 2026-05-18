# Browser

Use this block when the fastest path is reproducing the issue as a user in `apps/app`.

## Capability

- Browser automation or computer-use tooling when available
- Real user-path reproduction
- Client-side request and response inspection

## Owns

- sign-in and sign-up flows
- org selection and workspace switching
- navigation and page-level regressions
- client state, loading states, and streaming UI
- request payload, headers, cookies, and visible response behavior

## What To Check

- Can the issue be reproduced consistently?
- What exact click, form action, or navigation step triggers it?
- Which network request fails, hangs, or returns the wrong payload?
- Does the issue depend on browser state, auth state, or selected org?
- Is the failure visibly client-side, server-rendered, or API-backed?

## Exit Criteria

- Stable repro steps
- At least one failing request, visible UI divergence, or missing request

## Handoff

- Move to `runtime` when the failing route or service boundary is known.
- Move to `observability` when a request ID, error, or stack is visible.
- Move to `db` when the question becomes whether data was written correctly.
