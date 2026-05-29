# Manage Settings Performance Design

## Context

The manage settings subtree lives at:

`apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings`

It contains General, Members, Billing, and API Keys settings. The current route
shape is already directionally correct for Next.js App Router:

- server pages prefetch tRPC query data before hydration,
- client islands use TanStack Query and tRPC for reads and mutations,
- optimistic updates are implemented for members, invitations, API keys, and
  billing cancellation,
- role-gated controls are hidden from non-admin members.

The performance issue is inside the route internals: some client components mix
query subscription, mutation setup, derived view-model computation, local dialog
state, filtering, and row rendering in one component. Parent state changes can
therefore re-render more of the settings surface than necessary.

## Decision

Do a full performance sweep while preserving the public route structure and
visible UI. The implementation may optimize server pages, TanStack Query usage,
React client islands, helper boundaries, and tests, but it must not redesign the
settings experience.

## Goals

- Preserve existing URLs, layout hierarchy, headings, copy, role-gating, dialogs,
  optimistic behavior, and visual treatment.
- Keep Server Components as the route-level data orchestration boundary.
- Keep client islands only where interactivity, Clerk client hooks, browser
  state, or TanStack mutations require them.
- Reduce avoidable React re-renders from search input, dialog state, mutation
  pending state, and derived list sorting/filtering.
- Tighten TanStack Query option and query-key usage so invalidation and cache
  writes stay targeted and consistent.
- Extract hot component logic into focused hooks/helpers where it improves
  render stability or testability.
- Add focused tests before implementation for the behavioral contracts that
  could regress during the sweep.

## Non-Goals

- No visible redesign.
- No route moves, URL changes, or navigation item changes.
- No API contract changes for tRPC procedures.
- No new data source or persistence model.
- No virtualization unless evidence shows the current bounded lists are too
  large for memoized rows and derived filtering.
- No broad styling cleanup outside the manage settings subtree.

## Invariants

- `/${slug}/settings`, `/${slug}/settings/members`,
  `/${slug}/settings/billing`, and `/${slug}/settings/api-keys` remain the
  canonical routes.
- `SettingsLayout` still owns the settings title and sidebar navigation.
- Members still supports search, invite, role update, member removal, and
  invitation revocation.
- API Keys still supports create, copy-once secret display, revoke, delete, and
  non-admin read-only empty-state copy.
- Billing still supports plan display, plan selection hash behavior,
  cancellation confirmation, checkout, payment method management, and statement
  detail viewing.
- General settings still supports team slug/name update with optimistic
  organization-list cache updates and Clerk active-org synchronization.

## Architecture

### Server Pages

Route pages stay small and focused:

- construct the relevant tRPC query options once,
- prefetch or fetch the query before `HydrateClient`,
- render static section headers and the hydrated client island.

Use `prefetch(...)` where suspense hydration is sufficient. Use
`getQueryClient().fetchQuery(...)` only when the page must block until the data
is available before rendering the island. Do not add module-scope runtime client
initialization.

### TanStack Query

Each feature area should avoid reconstructing query keys in several places. The
implementation should introduce local helpers or hooks that provide:

- list/overview query options,
- the query key,
- targeted invalidation,
- optimistic cache read/write helpers.

The goal is to reduce accidental query-key drift and make cache writes easier to
audit. Mutation callbacks should continue to cancel, optimistically update,
rollback on error, toast on success where today does, and invalidate on settled.

### React Client Islands

Large client components should be split by responsibility without moving route
files or changing UI composition:

- query hook: subscribes to TanStack data,
- mutation hook: owns mutation setup and stable action callbacks,
- view-model helper: derives sorted, filtered, and display-ready values,
- presentational component: renders rows/sections from stable props.

Use `useDeferredValue` for search-driven filtering so typing does not force
urgent list recomputation. Use `useMemo` for sorted/filtered arrays and derived
billing values. Use `useCallback` for handlers passed to memoized children. Use
`memo` for row and section components that receive stable props and are likely
to be re-rendered by unrelated parent state.

Memoization should be purposeful. Do not wrap tiny static components if no
parent state can cause meaningful churn.

### Members

Keep the existing Members UI. Optimize by:

- deferring the search query before filtering,
- extracting member-list query and member mutation wiring,
- memoizing visible members and invitations,
- memoizing row components,
- passing stable row action callbacks,
- keeping optimistic cache helper behavior covered by tests.

### API Keys

Keep the existing API Keys UI. Optimize by:

- extracting list query/key/invalidation wiring,
- extracting revoke/delete mutation wiring,
- memoizing row rendering,
- avoiding full-list rerender work when alert dialog state changes,
- preserving create-dialog behavior and stale-secret guard.

### Billing

Keep the existing Billing UI. Optimize by:

- extracting billing overview derivation into a pure helper or hook,
- extracting plan hash synchronization into a focused hook,
- extracting cancellation mutation wiring,
- memoizing section props where they depend on derived billing values,
- keeping Clerk payment-method and statement hooks client-side.

### General

Keep the existing General UI. Optimize by:

- reusing a stable organization-list query options/key object,
- limiting form-watch render work to the team-name field,
- using stable submit and input normalization handlers,
- keeping optimistic organization-list updates and navigation behavior intact.

## Testing

Use focused Vitest tests before production changes:

- server-page tests continue to prove tRPC prefetch/fetch happens before
  hydrated client islands render,
- members tests cover admin controls, non-admin controls, optimistic mutation
  callbacks, deferred search filtering, and no-results states,
- API key tests cover admin controls, non-admin controls, optimistic revoke and
  delete rollback, and create-dialog behavior,
- billing tests cover hydrated overview usage, plan hash synchronization,
  derived section rendering, cancellation optimistic update, and existing Clerk
  payment/statement behavior,
- general settings tests cover stable slug normalization, disabled save state,
  optimistic organization cache update, rollback, and navigation after success.

Run targeted tests for changed files first, then broader `@lightfast/app`
typecheck or app test scope once the focused suite is green.

## Acceptance Criteria

- The visible settings UI is unchanged apart from incidental render timing.
- Route files remain in the current manage settings subtree.
- All existing manage settings tests pass or are intentionally updated for
  equivalent behavior.
- New tests prove the performance-sensitive contracts introduced by the sweep.
- Query keys and invalidation targets are centralized enough that each feature's
  cache writes can be audited from a focused hook/helper.
- Search, dialog, and mutation state changes no longer force avoidable
  recomputation or row rerendering across the whole list.
- The final verification includes targeted manage settings tests and
  typechecking for `@lightfast/app`.
