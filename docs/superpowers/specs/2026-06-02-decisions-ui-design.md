# Decisions UI Design

## Goal

Add a first-pass workspace Decisions page at `/:slug/decisions` that surfaces the integration call ledger as a team-readable audit list.

## Product Language

The database/runtime primitive remains `integrationCalls`, but the user-facing concept is **Decisions**. A Decision is a recorded moment where Lightfast or a user called an external integration tool and Lightfast captured who called it, which provider/tool ran, and what happened.

## Scope

Day one is a read-only list. It should show recent Decisions for the active organization with enough context to answer:

- who called it
- what provider/tool was called
- whether it succeeded, failed, or is still running
- when it happened
- how long it took when finished
- whether redacted input/output was captured
- what error code was produced when failed

No graph visualization, payload inspector, advanced filtering, or detail route is included in this scaffold.

## Architecture

Add a DB list helper over `lightfast_integration_calls`, then expose it through an org-scoped tRPC router at `org.workspace.decisions.list`. The Next.js route `/:slug/decisions` prefetches that query and renders a client component with the hydrated rows.

The sidebar gets a Decisions nav item as a standalone workspace surface alongside Automations and Connectors. The page uses the existing dense workspace visual language: constrained width, text-first rows, small status icons, and no nested cards.

## Data Shape

The list endpoint returns recent rows ordered by newest first, scoped by `clerkOrgId`, with a capped `limit` input. The UI does not expose raw payload JSON; it only renders presence markers for `inputRedacted` and `outputRedacted`.

## Error Handling

If there are no rows, the page shows an empty state that says no Decisions have been recorded yet. Query/auth failures use the existing app error boundary behavior. Failed Decisions render their `errorCode` and omit `errorMessage` unless it is already safe to display in the ledger row.

## Testing

Add tests at the DB helper, API router, page prefetch, client rendering, sidebar nav, and proxy route-pattern layers. Use TDD for each behavior: failing test first, minimal implementation second.
