# GitHub-Compatible Emulator Boundary Design

## Context

The GitHub org binding emulator slice proved the local setup flow, but it leaked
emulator-specific behavior into product runtime code:

- `api/app` starts binding through an emulator-only config path.
- Redis bind attempts persist emulator origin and fixture account context.
- OAuth verification calls an emulator-specific verifier.
- `apps/app` exposes `/api/dev/github/install` as a public app route.
- Shared GitHub metadata records whether a binding was verified by the emulator.

That shape creates security and developer experience risk. App and API code
should not need to know whether GitHub is real or local. Local development should
exercise the same production-like GitHub App flow, with endpoint configuration
changing only for local development and tests.

This design replaces the current emulator-aware slice with a GitHub-compatible
emulator boundary. It amends the local-development parts of
`docs/superpowers/specs/2026-05-27-github-org-binding-design.md`; the durable
binding model and Lightfast-initiated GitHub App setup decision remain in force.

## Decision

Use one product code path for GitHub App installation setup.

```text
apps/app UI
  -> org.setup.github.start
  -> GitHub installation URL

local:
  https://github.lightfast.localhost/apps/lightfast-local/installations/new
    -> emulators/github handles install redirect
    -> https://lightfast.localhost/api/github/setup

production:
  https://github.com/apps/<slug>/installations/new
    -> GitHub handles install redirect
    -> https://app.lightfast.ai/api/github/setup
```

`emulators/github` becomes local infrastructure that speaks enough
GitHub-compatible web, OAuth, and API behavior for the app/API to run the same
flow. Product code must not branch on an emulator mode.

For v1 local development, use one combined GitHub-compatible origin for install,
OAuth, and API endpoints:

```text
https://github.lightfast.localhost
```

The design does not model GitHub's real `github.com` and `api.github.com` split
yet. The endpoint config should still be structured so a split can be added
later without changing binding workflow code.

## Goals

- Remove emulator-specific state, routes, metadata, and verifier calls from
  `api/app` and `apps/app`.
- Keep `apps/app` GitHub route handlers thin and product-shaped.
- Keep `api/app` responsible for Lightfast orchestration only: auth, Redis
  attempts, DB finalization, Clerk claim sync, and redirect decisions.
- Move GitHub protocol behavior into `@repo/github-app-node`.
- Make `emulators/github` compatible with the protocol helpers used for
  real GitHub.
- Fail closed outside local development and tests if any custom GitHub endpoint
  is configured.
- Preserve the existing local `pnpm dev` experience.

## Non-Goals

- No GitHub Enterprise Server support.
- No full GitHub App installation UI reimplementation.
- No GitHub-first unclaimed installation flow.
- No webhook redesign in this specific boundary change, except keeping the
  future webhook route product-shaped as `/api/github/webhook`.
- No new durable GitHub-specific binding table.
- No persistence of GitHub user access tokens.

## Target Boundaries

| Area | Owns | Must Not Own |
| --- | --- | --- |
| `apps/app` | Product UI, `/api/github/setup`, `/api/github/oauth/callback`, future `/api/github/webhook` route handlers, proxy admission for product callbacks. | Dev install shims, emulator route names, GitHub API calls, DB writes, Redis attempts. |
| `api/app/src/github` | Lightfast binding workflow, env resolution, Redis attempts, admin checks, DB finalization, Clerk claim mirror, redirect mapping. | Emulator context, emulator-specific verification, GitHub REST payload parsing beyond workflow inputs. |
| `@repo/github-app-node` | GitHub URL builders, PKCE, OAuth exchange, user-accessible installation listing, installation verification, app JWTs, webhook signature helpers. | Lightfast auth, DB, Clerk, Redis, environment loading. |
| `@repo/github-app-contract` | Isomorphic constants, client-safe schemas, error codes, normalized GitHub installation schema. | Emulator constants, Node-only code, secrets, Lightfast DB types. |
| `emulators/github` | Local GitHub-compatible install/OAuth/API routes, deterministic seed, dev env printer, emulator tests. | Production runtime imports, Lightfast DB/Clerk/Redis logic. |

## Product Routes

Keep these routes in `apps/app`:

```text
GET  /api/github/setup
GET  /api/github/oauth/callback
POST /api/github/webhook       # future production webhook work
```

Remove this route from `apps/app`:

```text
GET /api/dev/github/install
```

The app proxy should admit setup and OAuth callbacks as public routes because
they need Clerk middleware context but must not be protected product pages. The
future webhook route should bypass Clerk enforcement and authenticate with
GitHub webhook signature verification.

No `apps/app` route should contain `dev/github` or emulator naming after this
redesign.

## Emulator Routes

`emulators/github` should provide the local equivalents of the GitHub
routes used by the binding flow:

```text
GET  /apps/:slug/installations/new
GET  /login/oauth/authorize
POST /login/oauth/access_token
GET  /user
GET  /user/installations
```

Behavior:

- `GET /apps/:slug/installations/new` accepts `state`, validates the app slug
  against the deterministic seed, and redirects to the Lightfast setup URL with
  `installation_id`, `setup_action=install`, and the original `state`.
- `GET /login/oauth/authorize` validates `client_id`, `redirect_uri`, PKCE
  challenge fields, and `state`, then redirects to the callback with a short
  lived local `code` and the original `state`.
- `POST /login/oauth/access_token` validates the local code, client id, client
  secret, redirect URI, and PKCE verifier, then returns a GitHub-shaped token
  response.
- `GET /user` returns the seeded OAuth user for the bearer token.
- `GET /user/installations` returns the seeded organization installation in the
  same normalized shape the real verifier expects.

The emulator may keep using `@emulators/github` internally where useful, but it
must cover gaps at the boundary by adding routes or adapters inside
`emulators/github`, not inside `api/app`.

## GitHub Endpoint Config

Introduce a generic GitHub endpoint config in `api/app` and pass it into
`@repo/github-app-node` helpers.

Conceptual shape:

```ts
type GitHubAppEndpoints = {
  apiBaseUrl: string;
  oauthAuthorizeUrl: string;
  oauthTokenUrl: string;
  webBaseUrl: string;
};
```

Defaults:

```text
webBaseUrl        https://github.com
apiBaseUrl        https://api.github.com
oauthAuthorizeUrl https://github.com/login/oauth/authorize
oauthTokenUrl     https://github.com/login/oauth/access_token
```

Local dev may set a single custom origin such as
`GITHUB_APP_ENDPOINT_ORIGIN=https://github.lightfast.localhost`. `api/app`
resolves that into all endpoint URLs for v1. A future split-origin config can be
added without changing the binding workflow.

Endpoint guardrails:

- `VERCEL_ENV=production` and `VERCEL_ENV=preview` must reject any non-default
  GitHub endpoint config at startup or before issuing a setup URL.
- Custom endpoint config is allowed only in local development and tests.
- After this migration, `GITHUB_INSTALL_URL_OVERRIDE` is unsupported. Any
  runtime that still receives it should reject configuration rather than fall
  back to the old dev shim path.

## Binding Start Flow

`org.setup.github.start` should:

1. Validate the Lightfast user is an admin of the selected org.
2. Resolve GitHub App config and GitHub endpoints.
3. Issue a Redis install attempt with only Lightfast state:

```ts
type GitHubBindInstallAttemptRecord = {
  clerkOrgId: string;
  lightfastUserId: string;
  orgSlug: string;
  stateHash: string;
};
```

4. Return a GitHub installation URL:

```text
<webBaseUrl>/apps/<appSlug>/installations/new?state=<state>
```

The procedure must not call `getGitHubEmulatorConfig`, store emulator context,
or include fixture data in the state.

## Setup Callback Flow

`GET /api/github/setup` delegates to `api/app`.

The helper should:

1. Read `state`, `installation_id`, and optional `setup_action`.
2. Look up and validate the Redis install attempt.
3. Require the same Lightfast user to still be an admin of the target org.
4. Reject missing or mismatched state before writing any DB state.
5. Consume the install attempt.
6. Create PKCE values.
7. Issue a Redis OAuth attempt:

```ts
type GitHubBindOAuthAttemptRecord = {
  clerkOrgId: string;
  codeVerifier: string;
  lightfastUserId: string;
  orgSlug: string;
  providerInstallationId: string;
  stateHash: string;
};
```

8. Redirect to the configured GitHub OAuth authorize URL.

The OAuth authorize URL is GitHub-shaped in both local and production:

```text
<oauthAuthorizeUrl>?client_id=...&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256
```

## OAuth Callback Flow

`GET /api/github/oauth/callback` delegates to `api/app`.

The helper should:

1. Handle OAuth denial by redirecting to the bind page with
   `github_authorization_denied`.
2. Validate and consume the Redis OAuth attempt.
3. Require the same Lightfast user to still be an admin of the target org.
4. Exchange the OAuth code using the configured token URL.
5. Verify the candidate installation using a production-shaped helper:

```ts
verifyGitHubUserInstallation({
  apiBaseUrl,
  expectedInstallationId,
  userAccessToken,
});
```

6. Require the installation target to be an organization.
7. Finalize the binding through `finalizeActiveOrgProviderBinding`.
8. Mirror the bound status into Clerk metadata.
9. Redirect to the completion page so the browser can reload the Clerk session.

The helper must discard the user access token after verification.

## Verification Helper

Replace `verifyGitHubEmulatorInstallation` with production-shaped helpers in
`@repo/github-app-node`:

```ts
listGitHubUserAccessibleInstallations(input)
verifyGitHubUserInstallation(input)
```

The verifier should:

- call `GET /user/installations` with the OAuth bearer token;
- page through results until it finds the expected installation id;
- normalize the matching installation;
- reject personal-user installations;
- return the normalized installation used by DB finalization.

The same helper should pass against real GitHub responses and the local emulator
responses. Emulator-specific assumptions belong in emulator tests, not in the
runtime verifier.

## Metadata

Binding metadata should describe the verified GitHub installation, not the
environment that verified it.

Keep:

- `events`
- `githubAppId`
- `githubAppSlug`
- `githubSetupAction`
- `permissions`
- `repositorySelection`

Remove:

- `verifiedBy: "github_emulator"`
- `verifiedBy: "github_user_installations"`

If a later audit requirement needs verification provenance, add a generic
workflow version or verification method that is not environment-specific.

## Local Dev Flow

Root `pnpm dev` should continue starting `emulators/github` through
Portless at:

```text
https://github.lightfast.localhost
```

The app dev process should receive deterministic non-secret GitHub App values
and the generic endpoint origin from the emulator env printer:

```text
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_WEBHOOK_SECRET
GITHUB_APP_ENDPOINT_ORIGIN
```

The env printer should stop emitting `GITHUB_INSTALL_URL_OVERRIDE`.

No worktree-specific emulator URLs should be copied into
`apps/app/.vercel/.env.development.local`; they should continue to be injected
by the `with-related-projects` wrapper.

## Security Requirements

- No product runtime route may include `dev/github`.
- No Redis attempt may store emulator origin, fixture login, or local install
  URL data.
- No DB binding metadata may encode emulator verification.
- Preview and production must reject custom GitHub endpoints.
- OAuth `state` remains high entropy, hashed at rest, short lived, and consumed
  once.
- PKCE verifier remains ephemeral in Redis and must not be logged.
- The callback must not trust `installation_id` until the OAuth user-accessible
  installation verifier finds the same id.
- The OAuth user token must not be persisted.
- The local emulator may use deterministic secrets, but those secrets must stay
  in `emulators/github` and local injected env only.

## Migration Plan

1. Extend `emulators/github` with GitHub-compatible install, OAuth, and
   `GET /user/installations` behavior.
2. Add endpoint-config support and production guardrails in `api/app`.
3. Replace emulator-specific URL and verifier helpers in
   `@repo/github-app-node` with production-shaped protocol helpers.
4. Remove emulator fields from Redis attempt records and setup flow logic.
5. Delete `/api/dev/github/install` from `apps/app` and remove it from proxy
   public route patterns.
6. Remove `GITHUB_INSTALL_URL_OVERRIDE` from app env and local env printing.
7. Remove environment-specific `verifiedBy` metadata.
8. Update tests to prove local and production-shaped flows use the same app/API
   workflow.

## Testing

Focused tests should cover:

- `emulators/github` installation URL redirects with preserved `state`.
- Emulator OAuth authorize/token exchange with PKCE.
- Emulator `GET /user/installations` returns a GitHub-shaped organization
  installation.
- GitHub endpoint config defaults to real GitHub.
- Production rejects custom endpoint origin/config.
- `org.setup.github.start` builds a GitHub-shaped installation URL for both
  default and local endpoints.
- Redis install and OAuth attempts contain no emulator fields.
- Setup callback redirects to a configured OAuth authorize URL without knowing
  whether it is local or real GitHub.
- OAuth callback verifies via `GET /user/installations` and writes a binding.
- Metadata contains no `verifiedBy` environment value.
- `apps/app` has no `/api/dev/github/install` route and proxy no longer admits
  that path.
- Package-boundary tests keep `emulators/github` out of production
  package imports.

## Rollout

This is a breaking local-dev boundary change but should not require a production
data migration. Existing local bindings with `verifiedBy: "github_emulator"` can
be deleted in local databases or ignored. Production should not have valid
emulator-created bindings because the current slice rejects production setup.

After implementation, the local manual check should be:

```text
pnpm dev
open https://lightfast.localhost
connect GitHub organization
observe redirect through https://github.lightfast.localhost
complete setup
land back in the Lightfast org with a DB-backed bound session
```

The user-visible app flow should not mention local emulation at any point.
