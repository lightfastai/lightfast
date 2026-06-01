# Shared Handle Username Onboarding Design

## Context

Lightfast uses Clerk as the source of truth for authenticated users and organizations. The current account settings page at `/account/settings/general` reads Clerk user profile data through `viewer.account.get`, including `firstName`, `lastName`, `fullName`, `username`, email, image URL, and initials. The UI displays name as disabled and does not expose username.

The current app also treats every non-reserved top-level segment as an organization slug. `/:slug` enters the org layout, `viewer.organization.getBySlug` resolves a Clerk organization membership, and Clerk `organizationSyncOptions` is configured with broad org patterns such as `/:slug` and `/:slug/(.*)`.

The product direction is GitHub-like routing:

- `https://lightfast.ai/<org_slug>` routes to an organization scope.
- `https://lightfast.ai/<username>` routes to a user scope.

That means organization slugs and usernames share one global Lightfast handle namespace. Clerk can enforce unique usernames within users and unique slugs within organizations, but Clerk does not document a shared uniqueness constraint across user usernames and organization slugs. Lightfast must own the global routing namespace.

Sources:

- Clerk username/authentication options: https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options
- Clerk user updates: https://clerk.com/docs/reference/backend/user/update-user
- Clerk organization object: https://clerk.com/docs/react/reference/objects/organization
- Clerk middleware organization sync: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Clerk session tasks: https://clerk.com/docs/guides/configure/session-tasks
- Clerk custom onboarding: https://clerk.com/docs/guides/development/add-onboarding-flow

## Goals

- Enforce that every signed-in Lightfast user has a globally unique Lightfast handle before product or organization onboarding access.
- Make Lightfast, not Clerk, the canonical authority for `/<handle>` routing.
- Keep Clerk as the source of truth for user profile fields and Clerk organization fields.
- Ensure user handles and organization handles cannot collide.
- Make username creation one-time and immutable in Lightfast.
- Allow users to update first and last name from account settings.
- Use an explicit, testable state machine for namespace operations.
- Preserve pending-session account routes and existing org onboarding behavior while adding the username gate.

## Non-Goals

- Do not implement user-profile product pages beyond the routing foundation required for shared handles.
- Do not allow username renames.
- Do not replace Clerk sign-in/sign-up pages with a full custom auth flow.
- Do not depend on username being enabled as a sign-in identifier. Clerk Dashboard may enable username sign-in separately.
- Do not rely on Clerk to resolve `/<handle>` as user versus organization.

## Proposed Approach

Use a hybrid auth-flow and app-onboarding design, backed by a durable Lightfast namespace registry.

Clerk should be configured to collect username during sign-up when possible. Lightfast then adds a fallback username gate for any signed-in user whose Lightfast namespace row or Clerk username is missing. This catches existing users, OAuth flows, and Clerk configuration gaps.

Every top-level handle is represented in Lightfast DB before it becomes routable. User username creation, organization creation, and organization rename must all participate in the same namespace reservation system. The namespace registry is the canonical source for `/<handle>` routing. Clerk is updated as an external side effect after Lightfast reserves the handle.

Use XState to define the legal transition graph for namespace operations. Store every durable operation state in MySQL tables and drive the operation from request handlers or reconciliation jobs. XState does not own durable state and does not directly hide database or Clerk side effects.

## Data Model

Add `lightfast_namespaces`:

- `id`
- `handle`: normalized lowercase handle, unique.
- `kind`: `user | org`.
- `clerkUserId`: set for user handles.
- `clerkOrgId`: set for org handles.
- `status`: `reserved | active | released`.
- `activeOperationId`: current operation that owns the reservation/finalization.
- `createdAt`, `updatedAt`, `releasedAt`.

Add `lightfast_namespace_operations`:

- `id`
- `operationType`: `create_user_username | create_org_slug | backfill_existing_handle`.
- `ownerKind`: `user | org`.
- `clerkUserId` or `clerkOrgId`.
- `fromHandle`: unset for the first rollout.
- `toHandle`: normalized target handle.
- `status`: `started | namespace_reserved | clerk_applied | finalized | failed | compensating`.
- `idempotencyKey`: unique per logical operation.
- `errorCode`, `errorMessage`.
- `createdAt`, `updatedAt`, `expiresAt`.

Indexes:

- Unique index on `lightfast_namespaces.handle`.
- Unique index on `lightfast_namespace_operations.idempotencyKey`.
- Lookup indexes on namespace owner columns and operation status/updatedAt for reconciliation.

Follow existing `@db/app` PlanetScale/Drizzle conventions: `mysqlTable("lightfast_<name>")`, no foreign keys, app-level referential integrity, generated migrations through `pnpm db:generate`, and no hand-written SQL.

## State Machine

Add a small XState machine for namespace operations. The workspace does not currently depend on `xstate`, so implementation should add it intentionally through the workspace catalog/package dependency where the transition model lives.

The durable transition graph:

```text
started
  -> namespace_reserved
  -> clerk_applied
  -> finalized

namespace_reserved
  -> failed

clerk_applied
  -> finalized
  -> compensating

compensating
  -> finalized
  -> failed
```

Rules:

- XState defines allowed transitions and test fixtures.
- The database stores the current state.
- Request handlers and reconciliation jobs load the operation, ask the transition model what is legal, execute one side effect, and persist the next state.
- Side effects stay in explicit services: `reserveNamespace`, `applyClerkUsername`, `applyClerkOrgSlug`, `finalizeNamespace`, `releaseReservation`, and `reconcileNamespaceOperation`.
- Every side effect is idempotent by operation id and owner id.

## Operation Semantics

User username creation:

1. Create or reuse a `create_user_username` operation by idempotency key.
2. Reserve `toHandle` in `lightfast_namespaces` with `kind = user`, `status = reserved`, and the Clerk user id.
3. Fetch the Clerk user.
4. If Clerk already has the same username for the same user, mark `clerk_applied`.
5. If Clerk has a different username, fail with `CONFLICT`.
6. Otherwise call `clerk.users.updateUser(userId, { username })`.
7. Finalize the namespace row as `active`.

Organization creation:

1. Reserve the requested org handle through `create_org_slug`.
2. Create the Clerk organization with the same slug.
3. Finalize the namespace row with the Clerk organization id.
4. If Clerk creation fails, release or fail the reservation.

Organization rename:

The first rollout disables organization handle renames. Existing org settings rename actions must reject with a clear message before calling Clerk. Shipping username enforcement while org renames bypass the namespace registry would leave the shared namespace inconsistent.

## Failure Modes

Concurrent claims for the same handle are resolved by the unique `handle` index. One reservation wins; the other returns `CONFLICT`.

If Lightfast reserves a handle and Clerk fails, the operation moves to `failed` and the reservation is released or left with `expiresAt` for cleanup.

If Clerk applies the change and Lightfast fails to finalize, reconciliation re-fetches Clerk. If Clerk already has the requested handle for the same owner, the operation finalizes the namespace row.

If a Clerk API call times out, the next drive step re-fetches Clerk before retrying. If Clerk applied the handle, finalize. If Clerk did not apply the handle, retry or fail according to the operation state.

If existing Clerk users and organizations already collide during rollout, the backfill audit must report the collision and block enforcement until the product decision is made for that specific pair.

## Route Behavior

`/<handle>` resolution goes through Lightfast namespace lookup before org membership resolution.

- No namespace row: `notFound()`.
- `kind = org`: verify the signed-in user has access to the Clerk organization id, set or confirm active org as needed, then render the org workspace/settings route.
- `kind = user`: return `notFound()` for product pages in the first rollout. User-scope pages are outside this rollout, but the handle remains reserved.

The current broad Clerk `organizationSyncOptions` patterns conflict with shared handles because they treat `/:slug` as organization-shaped before Lightfast resolves the handle. The implementation must narrow Clerk org sync to routes that have already been resolved as org routes, or move org activation into the Lightfast route/access layer instead of relying on broad `/:slug` middleware matching.

When a signed-in user has no active user namespace:

- `/account/setup/username` renders the setup form.
- Other signed-in app routes redirect to `/account/setup/username`.
- The username gate runs before org/team onboarding redirects.
- Public, auth, API-owned, and tRPC route behavior remains owned by existing middleware and procedure gates.

The setup redirect includes a safe `return_to` target for the original path and query. Reuse existing safe redirect parser rules: only same-app relative paths are accepted, and invalid values fall back to the normal post-auth destination.

## Backend API

Extend `viewer.account` with:

- `updateName({ firstName, lastName })`
  - Uses `viewerProcedure`.
  - Calls `clerk.users.updateUser(userId, { firstName, lastName })`.
  - Returns the normalized account profile DTO.

- `createUsername({ username, idempotencyKey })`
  - Uses `viewerProcedure`.
  - Validates the username as a Lightfast handle.
  - Drives a `create_user_username` namespace operation.
  - Rejects if the Clerk user already has a different username.
  - Returns the normalized account profile DTO and namespace handle.

Update organization creation so it reserves and finalizes handles through namespace operations. Update organization settings rename APIs so they reject rename attempts with a clear message before calling Clerk.

Keep `viewer.account.get` as the read model for settings, user menu, and setup page hydration. It should include enough namespace status to distinguish "Clerk username exists but namespace backfill is incomplete" from "username missing".

## Validation

Use a shared Lightfast handle schema in `@repo/app-validation` for both usernames and org slugs.

The schema:

- 4 to 64 characters.
- Lowercase Latin letters, numbers, and hyphen.
- Must start and end with a letter or number.
- No consecutive hyphens.
- Rejects the existing top-level reserved route names from `@repo/app-reserved-names`.

Clerk remains the final authority for any stricter provider-level rules, but Lightfast rejects handles that cannot be safely routed before calling Clerk.

## Frontend

Add a username setup page under account routes. The page:

- Prefetches `viewer.account.get`.
- Redirects away if the user already has an active user namespace and Clerk username.
- Renders a focused username form.
- Normalizes input to lowercase.
- Sends an idempotency key with the create request.
- Shows validation, duplicate-handle, and operation-failed errors inline.
- Disables submit while saving.

Update account settings:

- Name fields are editable through `viewer.account.updateName`.
- Username is editable only when missing.
- Once set, username renders read-only with copy that it is a stable Lightfast handle.
- Email remains read-only.
- Avatar remains display-only for now.

Follow existing account settings and org settings patterns: React Hook Form, Zod resolver, tRPC mutation options, React Query invalidation, and `prefetch()` before `<HydrateClient>`.

## Backfill And Rollout

Before enforcing the username gate:

1. Inventory existing Clerk organization slugs.
2. Inventory existing Clerk usernames.
3. Normalize all handles through the new Lightfast handle schema.
4. Insert non-conflicting active namespace rows through `backfill_existing_handle` operations.
5. Report user/org collisions and invalid handles.
6. Do not enable enforcement until collisions have explicit product resolutions.

Backfill is required because Clerk may already contain usernames and organization slugs that are independently valid but globally conflicting.

## Error Handling

- Missing authentication returns the existing `UNAUTHORIZED` diagnostic through `viewerProcedure`.
- Existing Lightfast namespace handle returns `CONFLICT`.
- Existing Clerk username on the same user with a different value returns `CONFLICT`.
- Clerk duplicate errors return `CONFLICT`.
- Unknown Clerk failures return `INTERNAL_SERVER_ERROR`.
- Stuck operations are visible through operation status and repaired by reconciliation.
- Client forms show field or mutation errors without hiding query invalidation.

## Tests

Namespace model tests:

- Legal XState transitions are accepted.
- Illegal transitions are rejected.
- Terminal states are not re-driven.

Database/service tests:

- Concurrent reservations for the same handle produce one winner.
- User username creation finalizes when Clerk update succeeds.
- User username creation finalizes after a timeout when Clerk already applied the username.
- Reservation is released or marked failed when Clerk rejects the update.
- Backfill detects user/org handle collisions.

Backend router tests:

- `viewer.account.get` returns username and namespace status.
- `createUsername` uses namespace operation state and rejects existing handles.
- `updateName` updates first and last name through Clerk.
- Organization create uses namespace reservation.
- Organization rename rejects before calling Clerk.

Proxy/routing tests:

- `/<handle>` resolves through namespace before org access.
- Org handles still enforce Clerk organization membership.
- User handles do not trigger org-only behavior.
- Missing-username users redirect to `/account/setup/username`.
- `/account/setup/username` is exempt from its own redirect.
- Public, auth, API-owned, and tRPC routes keep current behavior.

Frontend tests:

- Setup page prefetches account data and renders the username form.
- Setup form sends an idempotency key.
- Settings renders username as read-only when active.
- Settings renders username input when missing.
- Name form calls the update mutation and invalidates account profile data.

## Operational Notes

Clerk Dashboard should have username enabled for sign-up. Enabling username sign-in is optional.

Existing users without usernames will be forced through the setup page after namespace backfill and enforcement are enabled.

No manual SQL files should be written. Generate schema changes with `pnpm db:generate`, apply locally with the repo's standard PlanetScale flow, and keep migrations compatible with Vitess limitations.
