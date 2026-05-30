# GitHub Installation Boundary Rework Design

## Context

The GitHub App installation branch introduced the right product direction: one
production-shaped GitHub setup flow, backed locally by a GitHub-compatible
emulator. The current structure still has ownership problems that will make the
feature harder to maintain:

- `api/app/src/github` sits at the API root even though this is a service-level
  integration, not a top-level API concern.
- `api/app/src/github/setup-flow.ts` owns too many concepts: callback parsing,
  redirect decisions, Redis attempt state, admin checks, GitHub OAuth, provider
  verification, DB finalization, Clerk claim mirroring, and error mapping.
- GitHub setup admin verification lives under `github`, but it is really auth
  and Clerk organization membership logic.
- The GitHub emulator should live outside `internal` because it depends on
  product contracts and owns dev infrastructure behavior.

This spec scopes a behavior-preserving rework of that structure before the
GitHub installation work is merged.

It supersedes only the structural ownership and emulator-location parts of
`docs/superpowers/specs/2026-05-30-github-compatible-emulator-boundary-design.md`.
The prior spec's production-shaped GitHub endpoint and OAuth decisions still
stand.

## Decision

Move GitHub installation orchestration into an API service boundary:

```text
api/app/src/services/github
```

Move reusable Clerk organization admin access logic into the auth boundary:

```text
api/app/src/auth
```

Move the GitHub emulator out of `internal` into a dedicated root development
emulator workspace:

```text
emulators/github
```

The rework should preserve the production-shaped GitHub App install/OAuth flow.
The only intended behavior fix is making org admin membership lookup paginated
so callback verification does not falsely deny users with many memberships.

## Goals

- Make ownership obvious from paths.
- Keep GitHub protocol behavior in `@repo/github-app-node`.
- Keep client-safe constants and schemas in `@repo/github-app-contract`.
- Keep Lightfast orchestration in `api/app/src/services/github`.
- Keep Clerk session, membership, and admin checks in `api/app/src/auth`.
- Keep emulator code out of production package paths.
- Avoid a large orchestration file by splitting setup flow responsibilities.

## Non-Goals

- No GitHub webhook implementation.
- No new durable GitHub-specific DB table.
- No schema or SQL migration changes.
- No persistence of GitHub OAuth user access tokens.
- No GitHub Enterprise Server endpoint matrix.
- No broad tRPC router redesign outside the GitHub setup routes.

## Target Boundaries

| Area | Owns | Must Not Own |
| --- | --- | --- |
| `apps/app` | UI, thin Next route handlers for `/api/github/setup` and `/api/github/oauth/callback`, proxy admission for product callbacks. | GitHub API calls, Redis state, DB writes, Clerk membership logic, emulator routes. |
| `api/app/src/services/github` | GitHub setup orchestration: config, Redis attempts, callback flow, redirect decisions, DB finalization, Clerk mirror invocation. | Generic auth membership lookup, GitHub REST payload parsing internals, UI. |
| `api/app/src/auth` | Clerk auth/session helpers, org membership lookup, org admin assertions, pagination and access errors. | GitHub-specific redirect or provider workflow logic. |
| `@repo/github-app-node` | GitHub URL builders, PKCE, OAuth code exchange, app JWTs, user-accessible installation listing and verification. | Lightfast auth, DB, Redis, Clerk, environment loading. |
| `@repo/github-app-contract` | Isomorphic route constants, error codes, client-safe schemas, normalized GitHub installation shape. | Node-only code, secrets, emulator fixtures, Lightfast DB types. |
| `emulators/github` | Local GitHub-compatible install, OAuth, API routes, fixtures, env printer, emulator tests. | Production runtime imports, Lightfast DB/Clerk/Redis logic. |
| `db/app` | Source-control binding repository helpers and conflict errors. | GitHub OAuth, Clerk mirror writes, emulator behavior. |

## API Service Layout

Target file layout:

```text
api/app/src/services/github/
  index.ts
  config.ts
  setup/
    attempts.ts
    callbacks.ts
    errors.ts
    finalize-binding.ts
    flow.ts
    redirects.ts
```

Responsibilities:

- `config.ts` resolves GitHub App config and endpoint guardrails.
- `setup/attempts.ts` owns Redis-backed install and OAuth attempt records.
- `setup/callbacks.ts` parses and validates setup/OAuth callback query data.
- `setup/redirects.ts` builds all GitHub setup redirect targets.
- `setup/errors.ts` maps domain/provider errors to `GitHubBindErrorCode`.
- `setup/finalize-binding.ts` owns DB finalization plus Clerk mirror repair
  tolerance.
- `setup/flow.ts` coordinates the install callback and OAuth callback using the
  focused helpers above.
- `index.ts` exports the public service entrypoints consumed by `apps/app` route
  handlers and tRPC routers.

`flow.ts` should stay small enough to read as orchestration. It should not
contain low-level Redis key logic, callback URL parsing details, DB recovery
logic, or Clerk membership pagination.

## Auth Layout

Create or extend an auth module for Clerk organization membership access:

```text
api/app/src/auth/clerk-org-membership.ts
```

It should provide paginated helpers such as:

```ts
findUserOrganizationMembership({
  userId,
  organizationId,
})
```

and an admin assertion such as:

```ts
assertCurrentUserIsOrgAdmin({
  clerkOrgId,
  expectedUserId,
})
```

These names are the target API. The boundary should stay in generic auth
language, not GitHub language. GitHub setup should import this auth helper
rather than own `admin-access.ts`.

Existing membership consumers should use the same helper where it removes
duplication, especially paths that currently call
`clerk.users.getOrganizationMembershipList` without pagination.

## Emulator Workspace

Move the old internal GitHub emulator package to:

```text
emulators/github
```

Keep the package filter/name as:

```json
"@repo/github-emulator"
```

Update references:

- root `package.json` `_github_emulator`
- `apps/app/package.json` `with-related-projects`
- `api/app/package.json` exports, replacing `./github` with `./services/github`
- `pnpm-workspace.yaml`
- `turbo.json`
- `pnpm-lock.yaml`
- README/docs that mention the old internal GitHub emulator path

The root workspace should include:

```yaml
- emulators/*
```

The existing `internal/*` workspace remains for true internal config packages.
The emulator package may depend on `@repo/github-app-contract` because it is now
explicitly dev infrastructure, not an `internal` package violating the internal
boundary.

## Data Flow

Start flow:

1. UI calls `trpc.org.setup.github.start`.
2. Router validates active org/admin access through auth helpers.
3. GitHub service issues an install attempt in Redis.
4. GitHub service returns a GitHub App installation URL built by
   `@repo/github-app-node`.

Setup callback:

1. `/api/github/setup` route delegates to `completeGitHubInstallationSetup`.
2. Service parses `state`, `installation_id`, and `setup_action`.
3. Service looks up the install attempt.
4. Auth helper verifies the current Clerk user is the expected org admin.
5. Service consumes the install attempt, creates an OAuth attempt with PKCE, and
   redirects to the configured GitHub OAuth authorize URL.

OAuth callback:

1. `/api/github/oauth/callback` delegates to `completeGitHubOAuthVerification`.
2. Service parses denial or success callback parameters.
3. Auth helper verifies the same org admin before consuming the OAuth attempt.
4. Service exchanges the code through `@repo/github-app-node`.
5. Service verifies the expected user-accessible installation through
   `@repo/github-app-node`.
6. Service finalizes the DB binding through `db/app`.
7. Service mirrors the compact binding claim into Clerk, tolerating mirror
   failure after the DB write.
8. Service redirects to the completion page.

## Error Handling

Error mapping stays in the GitHub service because it translates service-domain
failures into GitHub bind UI error codes.

Auth failures should come from auth-domain errors:

- unauthenticated current user
- expected user mismatch
- missing org membership
- non-admin role

The GitHub service maps those to existing bind error codes such as
`permission_required` or sign-in redirects. GitHub protocol failures remain
typed by `@repo/github-app-node` and mapped by the service.

Missing or expired attempts should continue to redirect to the neutral
`/account/teams?github_error=expired_state` route because there is no trusted
org slug.

## Testing

Update tests to follow the new paths and add coverage for the one intended
behavior fix:

- Auth membership helper paginates Clerk memberships and finds admins beyond
  the first page.
- GitHub setup flow still does not consume attempts before admin verification.
- GitHub setup flow still redirects unauthenticated callbacks to sign-in without
  consuming attempts.
- GitHub setup flow still exchanges OAuth code, verifies installation, finalizes
  DB binding, and mirrors Clerk claim.
- GitHub router tests continue to assert install URL generation.
- App route tests continue to assert route handlers are thin delegates.
- Emulator tests continue to cover install redirect, OAuth exchange, `/user`,
  and `/user/installations`.
- Workspace/package tests verify the renamed emulator package and scripts.

Expected focused verification commands:

```bash
pnpm --filter @api/app test -- src/__tests__/github-setup-flow.test.ts src/__tests__/github-setup-router.test.ts
pnpm --filter @api/app test -- src/__tests__/auth-clerk-org-membership.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts src/__tests__/proxy.test.ts
pnpm --filter @emulator/github test
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/github-app-contract test
pnpm typecheck
```

The exact auth test filename may change during implementation, but the
pagination behavior must be directly tested.

## Migration Scope

Implementation should happen as a structural move with narrow behavior changes:

1. Add the auth membership helper test first and verify it fails against the
   current one-page admin lookup behavior.
2. Move and split `api/app/src/github` into `api/app/src/services/github`.
3. Move admin access into `api/app/src/auth` and make it paginated.
4. Update app route handlers and tRPC routers to import from the service path.
5. Move the old internal GitHub emulator package to `emulators/github`.
6. Update workspace, Turbo, package scripts, and docs references.
7. Run focused tests and typecheck.

No implementation step should introduce a new durable table, new SQL migration,
or production webhook behavior.

## Success Criteria

- No `api/app/src/github` directory remains.
- GitHub setup service entrypoints live under `api/app/src/services/github`.
- `@api/app/github` is removed; external consumers import
  `@api/app/services/github`.
- GitHub admin membership checks live under `api/app/src/auth`.
- Admin membership lookup is paginated.
- No old internal GitHub emulator directory remains.
- GitHub emulator package lives at `emulators/github` and is named
  `@repo/github-emulator`.
- Root dev scripts still start the GitHub emulator through Portless.
- `apps/app` route handlers remain thin.
- Focused tests and `pnpm typecheck` pass.
