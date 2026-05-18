# DB

Use this block when you need the persisted truth of what the system actually did.

## Capability

- Read-only Postgres inspection
- Schema, row, and join analysis
- Cross-checking Drizzle schema against live data

## Owns

- presence or absence of records
- state transitions across tables
- duplicate or missing writes
- cross-table join paths for end-to-end debugging
- data-model confirmation when UI or logs are ambiguous

## What To Check

- Do the expected rows exist?
- Did the expected state transition happen?
- Which join chain best explains this incident?
- Is the bug a write failure, a read mismatch, or a stale UI interpretation?
- Are there duplicate, orphaned, or contradictory records?

## Exit Criteria

- A clear statement of what persisted and what did not
- The key rows and joins that explain the current state

## Handoff

- Move to `runtime` or `inngest` once the missing or incorrect write path is known.
- Move to `sdk` if the DB state must be compared with provider truth.
