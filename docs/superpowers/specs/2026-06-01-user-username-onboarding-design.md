# User Username Onboarding Design

## Context

Lightfast uses Clerk as the source of truth for user account data. The current account settings page at `/account/settings/general` reads Clerk profile data through `viewer.account.get`, including `firstName`, `lastName`, `fullName`, `username`, email, image URL, and initials. The UI currently displays the display name as disabled and does not expose username.

We want every Lightfast user to have a username. Username should be created once, then treated as immutable by Lightfast. Users should also be able to manage their first and last name from account settings.

Clerk supports `username` as a user field and can collect it during sign-up when username is enabled in the Clerk Dashboard. Clerk also enforces username uniqueness across the instance through `users.updateUser`. Clerk's documented session tasks are limited to built-in requirements such as choosing an organization, password reset, and MFA setup, so Lightfast needs an app-owned fallback gate for users who authenticate without a username.

Sources:

- Clerk username/authentication options: https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options
- Clerk user updates: https://clerk.com/docs/reference/backend/user/update-user
- Clerk session tasks: https://clerk.com/docs/guides/configure/session-tasks
- Clerk custom onboarding: https://clerk.com/docs/guides/development/add-onboarding-flow

## Goals

- Enforce that every signed-in Lightfast user has a Clerk username before accessing product or organization onboarding flows.
- Keep Clerk as the source of truth for user name and username.
- Allow users to update their first and last name from account settings.
- Allow username creation only when the Clerk user currently has no username.
- Show username as read-only after creation.
- Preserve the existing pending-session account routes and org onboarding behavior.

## Non-Goals

- Do not add a Lightfast database table for usernames.
- Do not allow username renames in Lightfast.
- Do not replace the existing Clerk sign-in/sign-up pages with a full custom auth flow.
- Do not depend on username being enabled as a sign-in identifier. Clerk Dashboard may enable username sign-in separately, but the Lightfast code only requires username to exist as a user field.

## Proposed Approach

Use a hybrid auth-flow and app-onboarding design.

Clerk should be configured to collect username during sign-up when possible. This gives new users the most natural flow and lets Clerk validate username requirements early.

Lightfast then adds a fallback username gate for any signed-in user whose Clerk profile still has `username === null`. This catches existing users, OAuth flows, and any future Clerk configuration gaps. The gate redirects missing-username users to a Lightfast-owned setup page, such as `/account/setup/username`, before team creation or app access.

The setup page is reachable during pending sessions and uses a viewer-scoped mutation to create the username in Clerk. Once the username exists, the user is redirected back to the original destination or to the normal post-auth fallback.

## Route Behavior

The app proxy should continue to allow account-owned routes during pending sessions. It should add a missing-username check for signed-in browser routes that are not public, API-owned, auth routes, or the username setup route itself.

When a signed-in user has no username:

- `/account/setup/username` renders the setup form.
- Other app-owned account routes redirect to `/account/setup/username`.
- Org routes and team onboarding redirect to `/account/setup/username` before org setup checks.
- API and tRPC auth remain enforced by procedure builders rather than proxy allowlists.

The setup redirect should include a safe `return_to` target for the original path and query. Reuse the existing safe redirect parser rules: only same-app relative paths are accepted, and invalid values fall back to the normal post-auth destination.

## Backend API

Extend `viewer.account` with two mutations:

- `updateName({ firstName, lastName })`
  - Uses `viewerProcedure`.
  - Calls `clerk.users.updateUser(userId, { firstName, lastName })`.
  - Returns the normalized account profile DTO.

- `createUsername({ username })`
  - Uses `viewerProcedure`.
  - Fetches the current Clerk user first.
  - If `user.username` already exists, throws `CONFLICT`.
  - Otherwise calls `clerk.users.updateUser(userId, { username })`.
  - Maps Clerk duplicate username errors to `CONFLICT`.
  - Returns the normalized account profile DTO.

Keep `viewer.account.get` as the read model for settings, user menu, and setup page hydration.

## Validation

Use a shared username schema in `@repo/app-validation` so client and server enforce the same basic shape before Clerk is called.

The schema should be compatible with Clerk's defaults while staying conservative:

- 4 to 64 characters.
- Lowercase Latin letters, numbers, and hyphen.
- Must start and end with a letter or number.
- No consecutive hyphens.
- Reserved app route names are rejected with an explicit user-name reserved list: `account`, `api`, `docs`, `monitoring`, `new`, `oauth`, `sign-in`, and `sign-up`.

Clerk remains the final authority for uniqueness and any stricter instance-level username rules.

## Frontend

Add a username setup page under account routes. The page should:

- Prefetch `viewer.account.get`.
- If username already exists, redirect to the normal post-auth destination.
- Render a focused form for choosing a username.
- Normalize input to lowercase.
- Show validation and duplicate-name errors inline.
- Disable submit while saving.

Update account settings so the user can manage personal account data:

- Name fields are editable and save through `viewer.account.updateName`.
- Username is editable only if missing.
- Once set, username renders read-only with short copy that it cannot be changed.
- Email remains read-only.
- Avatar remains display-only for now.

The UI should follow the existing account settings structure and the org settings form patterns: React Hook Form, Zod resolver, tRPC mutation options, React Query invalidation, and `prefetch()` before `<HydrateClient>`.

## Error Handling

- Missing authentication returns the existing `UNAUTHORIZED` diagnostic through `viewerProcedure`.
- Existing username on `createUsername` returns `CONFLICT` with a clear message.
- Duplicate username from Clerk returns `CONFLICT`.
- Clerk service failures return `INTERNAL_SERVER_ERROR` with sanitized production messaging through the existing tRPC formatter.
- Client forms should show user-facing field or toast errors without swallowing query invalidation.

## Tests

Backend tests:

- `viewer.account.get` returns username and derived initials.
- `createUsername` updates Clerk when username is missing.
- `createUsername` rejects when Clerk already has a username.
- `createUsername` maps Clerk duplicate errors to `CONFLICT`.
- `updateName` updates first and last name through Clerk.

Proxy tests:

- Signed-in users without username are redirected to `/account/setup/username`.
- `/account/setup/username` is exempt from its own redirect.
- Public, auth, and API-owned routes keep their current behavior.
- Existing pending-session account route behavior remains intact.

Frontend tests:

- Setup page prefetches account data and renders the username form.
- Settings renders username as read-only when present.
- Settings renders username input when missing.
- Name form calls the update mutation and invalidates account profile data.

## Operational Notes

Clerk Dashboard should have username enabled for sign-up. Enabling username sign-in is optional for this feature and can be decided as product configuration without changing the Lightfast implementation.

Existing users without usernames will be forced through the setup page on their next signed-in browser request. No database migration is required.
