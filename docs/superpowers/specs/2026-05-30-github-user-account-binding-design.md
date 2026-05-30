# GitHub User Account Binding Design

## Context

Lightfast already has a GitHub organization binding flow:

- `org.setup.github.start` starts a GitHub App installation flow for a
  Lightfast organization.
- `/api/github/setup` receives GitHub's installation setup callback.
- `/api/github/oauth/callback` runs GitHub App user authorization only to prove
  the signed-in Lightfast org admin can see the installation.
- `lightfast_org_source_control_bindings` is the authoritative org-level source
  control binding table.
- GitHub personal-account installations are currently rejected for org binding.

This design introduces a separate user-level binding: a Lightfast user connects
their personal GitHub user identity so future product features can attribute
GitHub activity to that user and make GitHub user-to-server API calls when a
feature explicitly requires it.

The binding is not a personal repository automation install. It is a global
Lightfast user account link backed by the existing Lightfast GitHub App's
user-to-server OAuth flow.

## Decision

Use the existing Lightfast GitHub App user authorization flow for user account
binding:

```text
/account/tasks/github
  -> GitHub App OAuth authorize
  -> /api/github/user/oauth/callback
  -> GET /user
  -> encrypted token + verified GitHub identity stored for the Clerk user
```

Do not use Clerk external account linking as the product credential source. Do
not create a separate GitHub OAuth App. Clerk remains the source of Lightfast
session identity; Lightfast owns product-provider credentials and feature gates.

V1 requires GitHub expiring user tokens. Binding fails if the OAuth token
response does not include both `refresh_token` and `refresh_token_expires_in`.
This keeps downstream features from branching around non-refreshable credential
sets.

## Glossary

- **Lightfast user**: Clerk user id, globally unique across all Lightfast orgs.
- **GitHub user account**: GitHub `User` returned by `GET /user` using a
  GitHub App user access token.
- **User account binding**: Durable link from one Clerk user to one GitHub user
  account, plus encrypted refreshable GitHub user credentials.
- **Org binding**: Existing durable link from one Clerk org to one GitHub App
  organization installation.
- **Feature-level user gate**: A feature check that requires the current
  Lightfast user to have an active GitHub user account binding.

## Goals

- Bind one GitHub user identity to one Lightfast user account globally.
- Persist refreshable GitHub App user credentials encrypted at rest.
- Reuse the existing GitHub App config, endpoint guardrails, PKCE helper,
  OAuth URL builder, local emulator origin config, and thin Next route handler
  pattern.
- Keep user account binding separate from org installation binding.
- Expose a user-level setup task at `/account/tasks/github`.
- Make future feature gates able to require user GitHub binding without also
  implying org installation binding.
- Support reconnect by replacing the user's active credential set after a new
  successful OAuth authorization.
- Keep credential plaintext out of logs, Clerk metadata, browser responses, and
  durable non-secret columns.
- Keep mutable GitHub profile fields out of durable storage. GitHub login,
  avatar, profile URL, email, name, and other user-editable fields can be fetched
  live when a feature truly needs them.

## Non-Goals

- No personal GitHub App installation binding.
- No personal repository automation through this flow.
- No separate GitHub OAuth App.
- No use of Clerk social account linking as the source of GitHub product
  credentials.
- No org-specific GitHub identity override in v1.
- No multiple active GitHub user accounts per Clerk user in v1.
- No repository picker in the user account task.
- No device flow in v1; browser OAuth is enough for the web task.
- No durable GitHub profile cache in v1.
- No manual SQL files. Schema changes go through Drizzle schema and
  `pnpm db:generate`.

## GitHub Docs Constraints

The implementation must follow GitHub App user-token semantics:

- GitHub App user access tokens are for attributing app activity to a user.
- User access tokens use fine-grained app/user intersection permissions rather
  than classic OAuth scopes.
- The web application flow should use high-entropy `state`, exact
  `redirect_uri`, and PKCE.
- Expiring user access token responses include `access_token`, `expires_in`,
  `refresh_token`, `refresh_token_expires_in`, `scope`, and `token_type`.
  Lightfast persists only the tokens and expirations; it validates the rest
  during exchange and then discards it.
- The documented expiring-token values are 8 hours for access tokens and 6
  months for refresh tokens.
- Refreshing a user token uses `grant_type=refresh_token` against the same
  OAuth token endpoint.
- `GET /user` supports GitHub App user access tokens and needs no fine-grained
  permission for public identity data.
- Users can revoke GitHub App authorization. When refresh or API calls report
  revoked credentials, Lightfast must stop using that token set and mark the
  binding unavailable.

Reference docs:

- <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>
- <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens>
- <https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user>

## Architecture

The new flow has six boundaries.

1. `apps/app` account task UI

   The page at `/account/tasks/github` shows the current user-level GitHub
   binding state and starts the OAuth flow. It is global account UI, not nested
   under an org slug.

2. `apps/app` route handlers

   A new route handler at `/api/github/user/oauth/callback` delegates to
   `api/app` and returns redirects. It must stay thin like the existing
   `/api/github/setup` and `/api/github/oauth/callback` handlers.

3. `api/app` GitHub user-account service

   The service owns Redis attempt state, callback parsing, GitHub token
   exchange, authenticated-user verification, token encryption, DB writes, and
   redirect decisions.

4. `@repo/github-app-node`

   This package owns GitHub protocol mechanics. It should be extended to parse
   refreshable token responses, refresh GitHub App user tokens, and call
   `GET /user`. It must not know about Clerk, Redis, DB, encryption keys, or
   Lightfast routes.

5. `db/app`

   The database owns the durable user account table and repository helpers.
   Follow existing PlanetScale/Drizzle conventions: `lightfast_` prefix,
   `BIGINT UNSIGNED AUTO_INCREMENT` primary key, no foreign keys, helper APIs
   that pass `db` explicitly, and `.$returningId()` followed by `SELECT` when a
   full row is needed.

6. `emulators/github`

   The local emulator should exercise the same product-shaped OAuth flow:
   authorize, token exchange with refresh token fields, refresh-token exchange,
   and `GET /user`.

Boundary rule: `api/app` orchestrates Lightfast auth, Redis, encryption, DB,
and redirects. `@repo/github-app-node` owns GitHub HTTP protocol details.
`apps/app` only renders UI and delegates callbacks.

## Data Model

Add a user-scoped table:

```text
lightfast_user_source_control_accounts
```

The name stays provider-agnostic because the row models a user account at a
source-control provider. V1 provider value is `github`.

Recommended columns:

- `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`
- `clerk_user_id VARCHAR(64) NOT NULL`
- `active_clerk_user_id VARCHAR(64) NULL`
- `active_provider_user_key VARCHAR(192) NULL`
- `provider VARCHAR(32) NOT NULL`
- `provider_user_id VARCHAR(128) NOT NULL`
- `status VARCHAR(32) NOT NULL`
- `connected_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`
- `revoked_at TIMESTAMP(3) NULL`
- `encrypted_access_token TEXT NOT NULL`
- `encrypted_refresh_token TEXT NOT NULL`
- `access_token_expires_at TIMESTAMP(3) NOT NULL`
- `refresh_token_expires_at TIMESTAMP(3) NOT NULL`
- `created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`
- `updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`

Lifecycle statuses:

- `active`: usable credential set.
- `revoked`: user disconnected or GitHub reported revoked credentials.
- `expired`: refresh token expired before renewal.
- `error`: credential set is broken but not known revoked or expired.

Indexes:

- Unique `active_clerk_user_id` to enforce one active account per Lightfast
  user. Active rows set this to `clerk_user_id`; inactive rows set it to `NULL`.
- Unique `active_provider_user_key` to enforce one active Lightfast user per
  provider user. Active rows set this to a stable key such as
  `github:<provider_user_id>`; inactive rows set it to `NULL`. This preserves
  history while allowing an explicitly revoked GitHub account to be rebound.
- Index `(clerk_user_id, status)` for user gate lookups.
- Index `(provider, provider_user_id)` for provider revocation and operational
  lookups.

Repository helpers:

- `getActiveUserSourceControlAccount(db, clerkUserId)`
- `isUserSourceControlBound(db, clerkUserId)`
- `getUserSourceControlAccountByProviderUser(db, { provider, providerUserId })`
- `finalizeActiveUserSourceControlAccount(db, input)`
- `markUserSourceControlAccountRevoked(db, { clerkUserId })`
- `markUserSourceControlAccountExpired(db, { clerkUserId })`

The helpers should mirror the conflict/error style of
`db/app/src/utils/org-binding.ts`, but remain user-account specific.

## Encryption

`api/app` must depend on `@repo/app-encryption` and validate an `ENCRYPTION_KEY`
server env var. Development may use the package's documented 32-byte test key;
production and preview must require an explicit key.

Tokens are encrypted before insert/update and decrypted only at the point of
GitHub API use or refresh. Plaintext tokens must not be returned from tRPC,
stored in Clerk metadata, written to Redis beyond the short callback exchange,
or logged.

## GitHub User Account Flow

Start:

1. UI calls `viewer.githubAccount.start`.
2. Router admits any signed-in `viewerProcedure` identity.
3. Service resolves GitHub App config and app origin.
4. Service creates a PKCE pair and Redis attempt:

   ```ts
   type GitHubUserAccountOAuthAttemptRecord = {
     codeVerifier: string;
     lightfastUserId: string;
     returnTo?: string;
     stateHash: string;
   };
   ```

5. Service returns an authorization URL built with:
   - existing GitHub App client id,
   - exact redirect URI `/api/github/user/oauth/callback`,
   - `state`,
   - PKCE challenge.

Callback:

1. `/api/github/user/oauth/callback` delegates to the service.
2. Service parses `code`, `error`, and `state`.
3. Service looks up the attempt without consuming it.
4. Service verifies the current Clerk session user matches the attempt user.
5. Service consumes the attempt.
6. Service exchanges the code for a GitHub App user token.
7. Service requires `refresh_token`, `expires_in`, and
   `refresh_token_expires_in`.
8. Service calls `GET /user` with the access token and keeps only the stable
   GitHub user id.
9. Service encrypts access and refresh tokens.
10. Service finalizes the DB account row and redirects to
    `/account/tasks/github/complete`.

Denied callback:

- If GitHub returns `error`, verify and consume the attempt, then redirect to
  `/account/tasks/github?github_error=github_authorization_denied`.

Missing or expired attempt:

- Redirect to `/account/tasks/github?github_error=expired_state`.

Unauthenticated callback:

- Redirect to sign-in with `redirect_url` set to the callback path and query,
  matching the existing org GitHub setup behavior.

## Refresh Flow

Add a token refresh helper in `api/app`:

```ts
getFreshGitHubUserAccessToken({
  db,
  clerkUserId,
  refreshWindowMs,
})
```

Behavior:

- Load the active user account.
- If the access token is still outside the refresh window, decrypt and return
  it.
- If near expiry, decrypt the refresh token and call the GitHub refresh-token
  endpoint.
- Require a refreshed `refresh_token`; GitHub may rotate it.
- Encrypt and persist the new token set by updating the active row by `id` and
  `status`. Concurrent refreshes may use last-writer-wins; both successful
  writers store valid rotated credentials for the same Clerk user.
- If refresh reports revoked credentials, mark the row `revoked`.
- If the refresh token is expired or GitHub returns an expiration error, mark
  the row `expired`.
- On transient errors, leave the row active and surface a retryable error.

V1 does not need a scheduled background refresh. Refresh happens lazily when a
feature needs a user token.

## Route Surface

Add routes:

```text
GET /api/github/user/oauth/callback
GET /account/tasks/github
GET /account/tasks/github/complete
```

Keep existing org binding routes unchanged:

```text
GET /api/github/setup
GET /api/github/oauth/callback
GET /:slug/tasks/bind
GET /:slug/tasks/bind/github/complete
```

Proxy/public route admission must include the new callback route. The account
task pages stay inside the signed-in account route group.

## tRPC Surface

Add a viewer-level router:

```text
viewer.githubAccount
```

Procedures:

- `status`: returns whether the current user has an active GitHub account
  binding, the stable provider user id, and credential lifecycle fields.
- `start`: returns `{ authorizationUrl }`.
- `sync`: re-reads DB status for the completion page after callback.
- `disconnect`: marks the account binding revoked and clears active uniqueness.

All procedures use `viewerProcedure`, not `orgProcedure`, because the binding is
global to the Lightfast user.

## Feature Gates

Start with a service/helper gate, not a new global tRPC procedure builder:

```ts
requireGitHubUserAccount({
  db,
  clerkUserId,
})
```

Features that require GitHub attribution call this helper explicitly and return
a repair hint pointing to `/account/tasks/github` when missing.

Promote to a dedicated `githubUserProcedure` only after multiple procedures
need the same gate and diagnostics.

## Error Codes

Add user-account error codes in `@repo/github-app-contract`:

- `expired_state`
- `github_authorization_denied`
- `github_transient_error`
- `github_user_not_verified`
- `missing_refresh_token`
- `github_account_already_bound`
- `lightfast_user_already_bound`
- `permission_required`

The org binding error vocabulary can share generic values, but user-specific
messages should not mention organizations or installations.

## Local GitHub Emulator

Extend `emulators/github`:

- OAuth token exchange returns `access_token`, `expires_in`,
  `refresh_token`, `refresh_token_expires_in`, `scope`, and `token_type`.
- Refresh-token exchange accepts `grant_type=refresh_token` and rotates or
  preserves a deterministic local refresh token.
- `GET /user` returns the seeded user for the bearer token. Product code should
  use only the stable user id for durable writes.
- Tests cover the user-account callback path independently from the org
  installation path.

The app/API code should not branch on emulator mode. Only endpoint config
changes between local and production.

## Revocation

Immediate v1 behavior:

- `disconnect` marks the local row `revoked`.
- Failed refresh or API calls that indicate revoked credentials mark the row
  `revoked`.
- Expired refresh tokens mark the row `expired`.

Webhook behavior:

- GitHub sends `github_app_authorization` when a user revokes app
  authorization. The user-account table and repository helpers should be ready
  for a webhook handler to mark rows revoked by GitHub user id.
- Implementing the full GitHub webhook route can remain with the broader
  GitHub webhook work unless this user-account binding is the first feature
  that depends on proactive revocation.

## Security And Privacy

- Never store user tokens in Clerk.
- Never expose encrypted token blobs to the browser.
- Redact callback query strings and token responses from logs.
- Use high-entropy state and Redis TTL for OAuth attempts.
- Consume OAuth attempts once.
- Verify callback user id before consuming the attempt.
- Keep the GitHub user id immutable for a row; reconnect creates or reactivates
  the appropriate row through repository helpers.
- Treat GitHub login, avatar, profile URL, email, and name as mutable display
  data. Do not store them durably in the binding table.

## Testing

Focused backend tests:

- OAuth attempt state is high entropy, hashed at rest, TTL-bound, and consumed
  once.
- Callback does not consume attempts before Clerk user verification.
- Callback redirects unauthenticated users to sign-in without consuming the
  attempt.
- Missing refresh token rejects the bind and does not write DB credentials.
- Successful callback exchanges code, verifies `GET /user`, encrypts token
  fields, and writes an active user account row.
- One active GitHub account per Clerk user.
- One active Lightfast user per GitHub user.
- Reconnect updates token fields and preserves the stable provider user id.
- Refresh returns existing token outside the refresh window.
- Refresh rotates encrypted access and refresh tokens inside the refresh window.
- Revoked/expired refresh failures transition the row status.

Focused app tests:

- `/api/github/user/oauth/callback` is a thin delegate.
- Proxy admits the callback route publicly enough for expired sessions to reach
  sign-in redirect logic.
- `/account/tasks/github` shows connected, disconnected, loading, and error
  states.
- Completion page calls `viewer.githubAccount.sync` and routes back to the
  account task or configured return target.

Focused package/emulator tests:

- `@repo/github-app-node` parses refreshable token responses and rejects
  invalid token payloads.
- `@repo/github-app-node` refresh helper sends `grant_type=refresh_token`.
- `@repo/github-app-node` authenticated-user helper parses `GET /user`.
- Emulator token exchange, refresh exchange, and `GET /user` match the shapes
  product code expects.

Expected verification commands for implementation:

```bash
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/github-app-contract test
pnpm --filter @repo/github-emulator test
pnpm --filter @db/app test
pnpm --filter @api/app test
pnpm --filter @lightfast/app test
pnpm check
pnpm typecheck
```

## Rollout

1. Add DB schema and helpers.
2. Extend GitHub protocol package and emulator.
3. Add user-account service flow in `api/app`.
4. Add viewer router and callback route.
5. Add account task UI.
6. Add feature gate helper.
7. Wire the first feature that requires GitHub attribution to the helper.

This can ship before any feature consumes the token, but production should not
enable a hard feature gate until `ENCRYPTION_KEY` is configured in every target
environment and the GitHub App has expiring user tokens enabled.
