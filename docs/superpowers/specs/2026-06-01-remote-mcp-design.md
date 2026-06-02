# Remote MCP Design

Date: 2026-06-01
Status: Ready for user review

## Summary

Lightfast will add a first-class hosted MCP service at `apps/mcp`, exposed in production as `https://mcp.lightfast.ai/mcp`. Hosted MCP is the recommended product path for end users. The existing local `core/mcp` package remains available for API-key based local, CI, and compatibility workflows.

Hosted MCP is user-connected and organization-bound. A connection is authorized by a specific Lightfast user, for one selected Lightfast organization, through a dynamically registered MCP client. Tool calls run as that user in that organization and include the MCP client and grant in audit and attribution.

Lightfast owns the OAuth authorization server, Dynamic Client Registration, consent, grants, token issuance, and revocation. Clerk remains the underlying user identity and session provider for the consent flow. Lightfast issues MCP-specific access and refresh tokens instead of passing Clerk tokens through to the MCP resource server.

The hosted MCP server is deployed as a separate Vercel app, uses Streamable HTTP, and uses `mcp-handler` or an equivalent MCP SDK integration on Vercel Functions. It does not participate in the Vercel Microfrontends aggregate.

References:

- [MCP transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [Vercel MCP server deployment](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)

## Goals

- Add `apps/mcp` as a separate hosted MCP resource server.
- Serve production MCP at `https://mcp.lightfast.ai/mcp`.
- Keep OAuth/DCR/consent owned by Lightfast, backed by existing Clerk user sessions and Lightfast organization membership.
- Support open Dynamic Client Registration for public clients with mandatory PKCE.
- Bind each grant to `{ userId, orgId, clientId, resource, scopes }`.
- Issue Lightfast-owned MCP access and refresh tokens.
- Use asymmetric JWT access tokens with JWKS.
- Use opaque, hashed, rotating refresh tokens when `offline_access` is requested and consented.
- Keep local `core/mcp` API-key based in v1 while moving it to the same policy-derived tool catalog as hosted MCP.
- Make `@repo/api-contract` the canonical public capability contract for API and MCP exposure policy.
- Add `@repo/mcp-tools` for Lightfast-specific MCP tool policy, registration, formatting, and tests.
- Keep `@vendor/mcp` as a thin third-party MCP SDK wrapper.
- Extract shared app service functions below tRPC, oRPC, and MCP so transports do not call each other.
- Add minimal user and org-admin UI to inspect and revoke persistent MCP grants.
- Add durable, redacted audit events for every MCP tool call.
- Add first-class MCP attribution to signal rows created through MCP.

## Non-Goals

- No hosted MCP API-key auth in v1.
- No Clerk token passthrough to `apps/mcp`.
- No MCP token introspection endpoint in v1.
- No confidential OAuth clients or client secrets in v1.
- No wildcard redirect URIs.
- No custom URI scheme redirects in v1.
- No full DCR update/delete management endpoints unless required by client compatibility.
- No stateful/resumable MCP sessions in v1.
- No legacy SSE transport support in v1.
- No MCP resources or prompts in v1; tools only.
- No grant editing in settings; revoke and reconnect only.
- No provider-specific rate-limit implementation in the v1 design. Abuse controls stay provider-agnostic and are deferred for a dedicated decision.
- No dedicated MCP kill-switch environment variables in v1.

## Service Boundaries

### `apps/mcp`

`apps/mcp` is the MCP resource server.

Responsibilities:

- Serve `POST`, `GET`, and any required Streamable HTTP methods at `/mcp`.
- Serve unauthenticated protected-resource discovery metadata.
- Validate bearer access tokens for MCP-specific claims.
- Build request-scoped MCP execution context.
- Register and execute tools through `@repo/mcp-tools`.
- Enforce tool scopes, current user membership, and org setup gates.
- Emit audit events for every tool call.
- Handle CORS for bearer-token MCP requests.

`apps/mcp` does not:

- Own user sign-in.
- Own OAuth consent UI.
- Own DCR registration.
- Accept cookies as auth.
- Accept API keys.
- Call public `/api/v1` as its execution boundary.
- Participate in `apps/app/microfrontends.json`.

Local dev should add a direct Portless service:

```json
{
  "portless": "mcp.lightfast"
}
```

The local MCP URL is `https://[wt.]mcp.lightfast.localhost/mcp`.

### `apps/app`

`apps/app` is the OAuth authorization server facade and user-facing consent surface.

Responsibilities:

- Serve OAuth authorization-server metadata.
- Serve DCR registration and registration metadata read endpoints.
- Serve OAuth authorize, token, JWKS, and revocation endpoints.
- Render the MCP consent UI.
- Use Clerk to authenticate the browser user.
- List eligible organizations for the signed-in user.
- Persist grants, authorization codes, clients, refresh tokens, and revocation state through `api/app` or app DB helpers.

The OAuth endpoints are generic, not MCP-namespaced:

```text
/.well-known/oauth-authorization-server
/oauth/register
/oauth/register/:clientId
/oauth/authorize
/oauth/token
/oauth/jwks
/oauth/revoke
```

The production issuer is the canonical Lightfast app origin, not the MCP origin. The exact origin must come from environment configuration rather than hardcoded literals. The MCP resource audience is the exact MCP resource URL.

### `api/app`

`api/app` remains the server-side application boundary for Lightfast domain behavior.

Responsibilities:

- Clerk membership resolution.
- Org setup gate resolution.
- OAuth/DCR/grant persistence helpers.
- Shared app service functions below tRPC, oRPC, and MCP.
- Signal creation/read business logic.
- Inngest enqueueing.

MCP must not call tRPC or oRPC handlers as a transport. Instead:

```text
tRPC routes   \
oRPC handlers  > shared app service functions -> db/inngest/domain helpers
MCP tools    /
```

## OAuth and DCR

### DCR Model

DCR is open with a verification layer:

- Any client can register if metadata and redirect URIs validate.
- Registered clients are global system records, not user-owned and not org-owned.
- Grants are org-bound user connections.
- No dynamically registered client is automatically verified.
- Verified status is controlled by Lightfast through a separate administrative process.
- Unverified clients can request write scopes in v1, but consent and audit must clearly show unverified status and write capability.

DCR clients are public clients in v1:

- `token_endpoint_auth_method` is `none`.
- Authorization Code + PKCE is required.
- Client secrets are not issued.

Required metadata:

- `client_name`
- at least one redirect URI
- supported response/grant metadata compatible with public Authorization Code + PKCE

Optional metadata is validated when present:

- `client_uri`
- `logo_uri`
- `tos_uri`
- `policy_uri`
- `contacts`

Optional public metadata URLs must be HTTPS and must not point at localhost, private IP ranges, or unsafe hosts. Consent UI must not hotlink arbitrary unverified `logo_uri` values.

DCR registration returns:

- `client_id`
- accepted registered metadata
- `registration_client_uri`
- `registration_access_token`

The registration access token is opaque, stored hashed, and authorizes only reading that client's registration metadata in v1.

DCR update/delete are deferred unless compatibility testing proves a target MCP client requires them.

### Redirect URI Policy

Redirect URI validation is strict:

- No wildcard redirect URIs.
- Exact redirect URI matching for HTTPS redirects.
- HTTPS redirects are allowed.
- Strict loopback redirect handling is allowed for native clients:
  - `http://127.0.0.1:{dynamic_port}/callback`
  - `http://localhost:{dynamic_port}/callback` is disabled by default and can be added only as a verified-client compatibility exception.
- Custom URI schemes are not supported in v1.

### Authorization Flow

The hosted MCP authorization flow is:

1. MCP client discovers `apps/mcp` protected-resource metadata.
2. MCP client discovers Lightfast authorization-server metadata.
3. MCP client dynamically registers with Lightfast.
4. MCP client starts Authorization Code + PKCE with `resource` set to the MCP resource URL.
5. `apps/app` authenticates the browser user with Clerk when no valid app session exists.
6. The user reviews consent, selects an organization, and approves or denies.
7. Approval creates or reuses a grant for `{ userId, orgId, clientId, resource, scopes }`.
8. Lightfast issues an opaque one-time authorization code.
9. The client exchanges the code and PKCE verifier at `/oauth/token`.
10. Lightfast issues a short-lived MCP access JWT and, when consented, an opaque refresh token.

Silent re-authorization is allowed only when an existing active grant has the same user, same org, same client, same resource, and same or narrower scopes. Broader scopes, different orgs, different clients, different resources, or revoked grants require consent again.

### Consent Denial and Invalid Requests

If the authorization request is valid and the user clicks Cancel, Lightfast redirects to the registered redirect URI with:

- `error=access_denied`
- original `state`

If the request is invalid or the redirect URI is unsafe, Lightfast does not redirect. It shows a safe local error page and logs detailed diagnostics with a request ID.

Approve and deny actions are POST-only with CSRF and state validation. GET approval is not allowed.

## Token Model

### Access Tokens

MCP access tokens are short-lived signed JWTs.

Access token requirements:

- asymmetric signing with JWKS, using `RS256` or `EdDSA`
- JWT header includes `kid`
- JWKS endpoint at `/oauth/jwks`
- short lifetime, expected 10 to 15 minutes
- exact issuer validation
- exact audience validation against the MCP resource URL
- MCP-specific token-use claim

Required claims:

- `iss`
- `aud`
- `sub` as Lightfast/Clerk user id
- `org_id`
- `client_id`
- `grant_id`
- `scope`
- `jti`
- `exp`
- `iat`
- `token_use: "mcp_access"`

`apps/mcp` rejects Clerk tokens, native desktop tokens, API keys, and Lightfast tokens that are not explicitly marked for MCP access.

### Refresh Tokens

Refresh tokens are opaque random secrets. Only their hashes are stored server-side.

Refresh tokens are issued only when `offline_access` is requested and consented.

Refresh behavior:

- rotate on every refresh
- invalidate the previous refresh token on successful rotation
- detect reuse of an old refresh token
- revoke the token family on reuse
- always load grant and token-family state during refresh

### Revocation

`/oauth/revoke` is in v1.

Revocation behavior:

- Clients can revoke their own refresh token.
- Users can revoke their own grants in settings.
- Org admins can revoke grants for their org.
- Revoking a grant invalidates its refresh-token family.
- Existing short-lived access JWTs expire naturally.
- Immediate JWT `jti` denylisting is deferred.

## Data Model

OAuth/DCR/MCP security state lives in the app database, not Clerk metadata and not Redis. Redis may be used only for explicitly short-lived transient state. SQL is the source of truth.

Use numeric internal primary keys plus opaque public IDs for all externally visible identifiers. Never expose numeric DB IDs through OAuth, MCP, settings, or audit.

Suggested tables:

- `mcp_oauth_clients`
  - internal id
  - public `clientId`
  - client name
  - metadata URLs
  - metadata JSON
  - verification status
  - registration provenance
  - timestamps
  - soft revoke/delete fields for hiding unsafe client metadata while preserving audit references
- `mcp_oauth_client_redirect_uris`
  - client public id or internal id
  - exact redirect URI
  - redirect URI kind, such as `https` or `loopback`
- `mcp_oauth_registration_tokens`
  - registration token hash
  - client id
  - expires/revoked timestamps
- `mcp_oauth_authorization_codes`
  - authorization code hash
  - client id
  - user id
  - org id
  - resource
  - scopes
  - redirect URI
  - code challenge
  - code challenge method
  - expires at
  - consumed at
- `mcp_oauth_grants`
  - public `grantId`
  - client id
  - user id
  - org id
  - resource
  - scopes
  - created at
  - last used at
  - revoked at
  - revoked by user id
  - revocation reason
- `mcp_oauth_refresh_tokens`
  - token hash
  - token family id
  - grant id
  - client id
  - user id
  - org id
  - scopes
  - expires at
  - used at
  - rotated from token id
  - revoked at
  - reuse detected at
- `mcp_audit_events`
  - request id
  - user id
  - org id
  - client id
  - grant id
  - client verification status
  - tool name
  - scopes
  - outcome
  - safe error code/message
  - latency
  - timestamps

Security records are soft-revoked, not hard-deleted by default. Historical client and grant IDs must remain resolvable enough for audit and product attribution.

No DB-level foreign keys are required. Follow existing PlanetScale/Vitess conventions and use indexed public IDs where needed.

## Signal Attribution

Signals created by MCP should carry MCP attribution in v1.

Add nullable public-ID columns to the signals table:

- `createdByMcpClientId`
- `createdByMcpGrantId`

Existing `createdByUserId` remains the user attribution. Existing `createdByApiKeyId` remains for public API key calls. MCP attribution uses public ID strings and no DB-level foreign keys.

The shared signal creation service should accept an actor shape rather than transport-specific parameters:

```ts
type AppActor =
  | { kind: "web"; userId: string; orgId: string }
  | { kind: "api_key"; userId: string; orgId: string; apiKeyId: string }
  | {
      kind: "mcp";
      userId: string;
      orgId: string;
      clientId: string;
      grantId: string;
    };
```

The exact TypeScript shape can differ, but the service boundary must preserve actor kind and attribution without faking API-key auth.

## MCP Tool Contract

### Canonical Policy

`@repo/api-contract` remains the canonical public capability contract.

Add a typed sidecar MCP policy map near the contract:

```text
packages/api-contract/src/mcp.ts
```

Every `apiContract` procedure must have an MCP policy entry. The entry either exposes the procedure to MCP or explicitly marks it not exposed with a reason. CI must fail when a public API procedure is added without an MCP policy decision.

Policy entries include:

- `expose`
- stable MCP tool name
- MCP-specific description
- required scope
- safety kind: `read` or `write`
- bound-org requirement
- audit event name or category

Existing tool names stay stable:

- `lightfast_system_health`
- `lightfast_signals_create`
- `lightfast_signals_get`

Initial scopes:

- `mcp:system:read`
- `mcp:signals:read`
- `mcp:signals:write`

Consent is all-or-deny in v1. Users cannot partially approve a subset of requested scopes.

### `@repo/mcp-tools`

Create `@repo/mcp-tools` for Lightfast-specific MCP tool behavior.

Responsibilities:

- Read `apiContract` and MCP policy.
- Verify policy coverage.
- Register tools for local and hosted MCP.
- Map tools to scopes and safety metadata.
- Adapt input/output schemas.
- Wrap tool execution.
- Format results and errors according to a tested Lightfast MCP result contract.

`@repo/mcp-tools` excludes OAuth and token validation.

The package is Lightfast-specific. It is not a general-purpose oRPC-to-MCP adapter library.

### `@vendor/mcp`

`@vendor/mcp` should become a thin vendor wrapper for third-party MCP SDK exports and compatibility shims only.

Lightfast product logic such as contract walking, tool policy, scope mapping, result formatting, and error formatting must move out of `@vendor/mcp`.

### Local `core/mcp`

`core/mcp` remains API-key based in v1.

Changes:

- Keep `LIGHTFAST_API_KEY` and optional `LIGHTFAST_API_URL`.
- Use the same policy-derived tools as hosted MCP.
- Stop blind auto-registration of all contract procedures.
- Ignore OAuth scopes locally, but still expose the same tool names, descriptions, input/output schemas, and result behavior.

Hosted OAuth MCP is the recommended user-facing path. Local API-key MCP remains for CI, headless local use, debugging, and stdio-only compatibility.

## Tool Execution

Hosted MCP tools call shared server-side app services directly, not `/api/v1` and not tRPC.

Execution context includes:

- `userId`
- `orgId`
- `clientId`
- `grantId`
- scopes
- client verification status
- request id

For product tools, `apps/mcp` enforces:

- token signature and claims
- required scope
- current user membership in `org_id`
- current org setup gate where required
- tool-level read/write policy

`system.health` can require a valid MCP connection without requiring a bound org. Product tools such as `signals.create` and `signals.get` require a currently bound org.

The JWT carries `org_id`, but product tools still enforce current membership and setup-gate state at request time. Membership-change cleanup should also revoke affected grants asynchronously when available.

## MCP Protocol Behavior

Hosted MCP serves Streamable HTTP only in v1.

The implementation is stateless per request:

- validate bearer token on every HTTP request
- create request-scoped MCP context
- execute tools within normal Vercel Function limits
- do not require sticky sessions or server memory

Tools only in v1:

- no MCP resources
- no MCP prompts

Public unauthenticated endpoints:

- protected-resource metadata
- minimal health/discovery metadata for service checks

Authenticated endpoints:

- `/mcp`
- all tools
- any user/org/client-specific data

CORS:

- handle `OPTIONS`
- allow required MCP protocol headers and `Authorization`
- never use cookie auth
- keep security headers appropriate for an API/protocol service

## Result and Error Formatting

Hosted and local MCP must share a tested result-formatting contract. The spec does not lock implementation to the current `@vendor/mcp` formatter.

Desired v1 behavior:

- Return `structuredContent` when a successful tool result is object-shaped and an output schema exists.
- Return concise text content, usually a JSON text fallback, for clients that do not use structured content.
- Return safe domain error text with `isError: true`.
- Do not expose stack traces or secret-bearing error payloads.

Error boundary:

- Missing or invalid bearer token: HTTP `401`.
- Insufficient scope: authorization error, not a successful tool result.
- Unknown tool or invalid MCP request: MCP protocol error.
- Domain failures such as missing signal or enqueue failure: tool result with `isError: true`, unless MCP SDK compatibility testing requires thrown tool errors.

## Consent UI

The consent UI is a minimal standalone OAuth screen using app auth/session plumbing, not the full workspace shell.

Main screen:

- client icon and Lightfast icon
- title: `{Client name} is requesting access to Lightfast`
- signed-in user identity
- secondary account switch or sign-out affordance
- selected organization row or selector
- redirect URI
- verification status
- concise human-readable permission summary
- unverified/write warning when applicable
- `Details` button
- `Cancel` and `Approve`

Org selection:

- If the user has one eligible org, show it as a fixed row.
- If the user has multiple eligible orgs, embed an organization selector in the consent screen.
- If the user has no eligible orgs, show an error state with no approve button.

Details sheet:

- raw scopes
- client id
- client URI
- logo URI
- policy URI
- contacts
- resource/audience
- PKCE method
- offline access/refresh behavior
- full registered metadata

Redirect URI stays on the main screen because it is security-critical.

Logos:

- Verified clients may show curated Lightfast-approved logo assets.
- Unverified clients use a conservative default icon unless a safe image pipeline validates the logo.
- Verification state is separate from logo display.

Use "organization" in OAuth/MCP consent, settings, audit, and admin surfaces.

## Settings UI

Because refresh tokens are in v1, persistent grants need visible revocation.

User settings:

- show the user's connected MCP clients
- list client name, verification status, organization, permission summary, created at, and last used
- allow revoke

Org admin settings:

- show MCP connections for the organization
- list client name, connected user, verification status, permission summary, created at, and last used
- allow org admins to revoke any grant for the org

Settings behavior:

- no grant editing in v1
- no changing scopes in place
- no changing org in place
- revoke and reconnect only
- technical details appear in a sheet/disclosure

Details include:

- client id
- grant id
- raw scopes
- resource
- redirect URI
- client URI/policy URI
- token status summary

`lastUsedAt` is best-effort and throttled. Audit records every tool call; settings timestamps are UI convenience and must not block tool execution.

## Audit

Every MCP tool call emits a durable audit event with redacted metadata.

Record:

- timestamp
- request id
- user id
- org id
- client id
- grant id
- client verification status
- tool name
- scopes
- success/failure
- latency
- safe error code/message when failed

Do not store by default:

- raw tool inputs
- raw tool outputs
- model/client payloads
- bearer tokens
- auth headers

Safe metadata such as input size, public identifiers, status, and hashes may be recorded when useful.

Secondary enrichment and analytics can happen asynchronously through Vercel `waitUntil`, Next `after`, or Inngest.

## Environment and Deployment

Production:

- `apps/mcp`: `https://mcp.lightfast.ai`
- MCP resource: `https://mcp.lightfast.ai/mcp`
- OAuth issuer: canonical Lightfast app origin from config

Local:

- `apps/mcp`: `https://[wt.]mcp.lightfast.localhost`
- full OAuth/DCR support against local app and local DB

Preview:

- limited MCP protocol smoke testing first
- no arbitrary real DCR/grant creation for each ephemeral preview URL
- full preview OAuth requires explicit preview issuer/resource configuration and isolated state

DCR clients, grants, and tokens are environment-isolated. Local clients are not valid in production, and production tokens are not valid against local MCP.

## Abuse Controls

DCR, OAuth, token, and MCP endpoints need an abuse-control boundary, but the concrete provider is deferred.

V1 should preserve a provider-agnostic interface such as:

```ts
checkOAuthAbuseLimit(context)
checkMcpAbuseLimit(context)
```

Private beta does not block on a full rate-limit provider if DCR exposure is controlled and monitored. Public launch requires concrete abuse controls for:

- DCR registration
- token exchange and refresh
- MCP tool calls
- expensive/write tools

Unkey rate limits are the likely direction if that remains the platform preference. Arcjet and Vercel Firewall remain possible alternatives or complements, but this design does not choose a provider.

## Deferred Follow-Ups

After this spec is approved, create GitHub issues for substantial deferred tracks:

- Choose and implement DCR/OAuth/MCP rate limiting, likely with Unkey rate limits.
- Dedicated hosted MCP kill switches.
- Confidential OAuth clients and client secrets.
- Custom URI scheme redirects.
- Full Vercel preview OAuth/DCR support.
- OAuth token introspection.
- Full DCR update/delete management endpoints.
- Org MCP policies: verified-only clients, read-only MCP, admin approval for write scopes.
- Immediate JWT revocation through `jti` denylist.
- Stateful/resumable MCP sessions.
- Legacy SSE transport support.
- OAuth stdio bridge mode for local `core/mcp`.
- Verified-client onboarding and domain ownership process.
- Richer MCP resources and prompts.
- Grant policy editing instead of revoke/reconnect.

## Testing and Verification

Unit tests:

- DCR metadata validation.
- Redirect URI validation, including loopback rules.
- Authorization code hashing, expiry, one-time consumption, and PKCE checks.
- Access JWT claims and JWKS verification.
- Refresh token rotation and reuse detection.
- Grant revocation behavior.
- MCP policy coverage for every `apiContract` procedure.
- Tool scope mapping.
- Result and error formatting contract.
- Shared signal service actor attribution.

Integration tests:

- Full DCR to authorize to token flow.
- Consent approval and denial.
- Existing grant silent re-authorization for same/narrower scopes.
- Broader scopes force consent.
- Org-bound grant behavior across multiple orgs.
- Hosted MCP tool call with valid token.
- Hosted MCP rejects invalid audience, wrong token type, missing scope, revoked grant on refresh, and non-member org.
- Local `core/mcp` and hosted MCP expose the same policy-derived tools.

UI tests:

- Consent screen with one org.
- Consent screen with multiple org selector.
- Unverified client warning.
- Write-scope warning.
- Details sheet.
- Invalid request safe error.
- User settings revoke.
- Org admin settings revoke.

Operational verification:

- `apps/mcp` builds independently.
- `pnpm dev` starts the direct `mcp.lightfast` Portless service.
- `apps/mcp` is not added to the MFE aggregate.
- Vercel preview smoke test can hit discovery metadata and health.

## Open Questions

There are no blocking architecture questions remaining for v1. Provider-specific rate limiting, kill switches, preview OAuth, and advanced OAuth/client features are intentionally deferred follow-ups.
