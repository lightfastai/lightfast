# X MCP Connector Design

**Date:** 2026-06-02
**Status:** Ready for written spec review

## Summary

Lightfast will add X as the second org-level MCP connector after Linear. The
production connector will use a reusable Lightfast-owned MCP bridge for
providers that do not offer a cloud-first remote MCP server, with X as the
first provider on that bridge.

X is a user-context service, so an org admin installs the connector by
authorizing a specific X account through OAuth 2.0 authorization code with PKCE.
Lightfast stores encrypted org-scoped X tokens, exposes a curated X MCP tool
surface through a Lightfast-authenticated MCP endpoint, discovers tools through
MCP `tools/list`, and makes the connector available to automations when the org
admin enables **Use in automations**.

The initial X tool set is read-only. Write tools such as posting, liking,
reposting, muting, blocking, DMs, list mutation, and media upload are out of v1
scope because the current connector toggle is org-wide and not per-tool.

## Current Context

Lightfast already has a generic connector foundation with a Linear-specific
provider implementation:

- `packages/connector-contract` owns provider ids, catalog metadata, tool
  manifest schemas, and tRPC input schemas.
- `db/app` owns the generic `lightfast_org_connector_connections` table and
  repository helpers.
- `api/app/src/services/connectors` owns catalog shaping, provider dispatch,
  OAuth attempts, callback finalization, token refresh, tool refresh, disconnect,
  and runtime loading.
- `packages/linear-app-node` owns provider-specific OAuth, metadata, MCP
  listing, and MCP call helpers.
- `emulators/x` already exists in local dev, but it currently covers OAuth and
  `/2/users/me` only. It has no MCP endpoint yet.
- The Connectors UI is mostly generic but still has Linear-only branches for
  connectable provider checks, missing-config copy, icon mapping, and tests.

Linear is a provider-owned remote MCP integration:

- Linear hosts `https://mcp.linear.app/mcp`.
- Lightfast can send Linear OAuth/API bearer tokens directly to Linear's MCP
  resource server because Linear owns both the OAuth token and the MCP resource.
- Linear's implementation is still the reference for MCP discovery and calls:
  connect to the configured endpoint, call `tools/list`, persist the returned
  manifest, and call tools over Streamable HTTP at runtime.

Official X sources relevant to this design:

- X documents two MCP servers: official XMCP for X API operations at a local
  `http://127.0.0.1:8000/mcp` endpoint, and hosted docs MCP at
  `https://docs.x.com/mcp`.
- XMCP loads the X OpenAPI spec at startup, exposes 200+ operation tools, uses
  OAuth 1.0a browser consent at startup, supports `X_API_TOOL_ALLOWLIST`, and
  stores OAuth tokens only in memory.
- X OAuth 2.0 supports authorization code with PKCE, two-hour access tokens by
  default, refresh tokens when `offline.access` is requested, and the scopes
  needed for v1: `tweet.read`, `users.read`, and `offline.access`.
- MCP Streamable HTTP uses JSON-RPC over HTTP and requires bearer tokens in the
  `Authorization` header when authorization is used.

Vercel infrastructure relevant to this design:

- `mcp-handler` is an open-source adapter for hosting MCP servers in Next.js and
  Nuxt routes on Vercel.
- `mcp-handler` includes OAuth/protected-resource support through
  `withMcpAuth`, which is useful for the Lightfast-owned bridge.
- Vercel's hosted MCP server is for Vercel resources; it is not a generic bridge
  for third-party APIs.

Sources:

- [X MCP Servers](https://docs.x.com/tools/mcp)
- [xdevplatform/xmcp](https://github.com/xdevplatform/xmcp)
- [X OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [Vercel MCP docs](https://vercel.com/docs/mcp)
- [Deploy MCP servers to Vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
- [mcp-handler](https://github.com/vercel/mcp-handler)
- [OAuth support in Vercel MCP adapter](https://vercel.com/changelog/oauth-support-added-to-mcp-adapter)

## Goals

- Add X as a visible, connectable provider in the existing Connectors catalog.
- Keep the connector org-scoped: one current X connection per Lightfast org.
- Let org admins connect, reconnect, refresh tools, toggle automation access,
  and disconnect X using the same connector workflows as Linear.
- Use X OAuth 2.0 authorization code with PKCE for production authorization.
- Use Lightfast MCP auth for the Lightfast-hosted MCP bridge; never use a raw X
  provider token as the MCP bearer token.
- Request only read-oriented scopes in v1:
  - `tweet.read`
  - `users.read`
  - `offline.access`
- Store encrypted X access and refresh tokens in the existing connector table.
- Discover and cache an X MCP tool manifest through MCP `tools/list` after
  connect and on explicit refresh.
- Introduce a provider-neutral MCP bridge pattern that can be reused by future
  providers that have APIs and OAuth but no production remote MCP server.
- Expose only a curated read-only X MCP tool surface in v1.
- Support deterministic local development and tests through `@repo/x-emulator`.
- Keep official XMCP as a reference and comparison target, not as production
  runtime infrastructure.

## Non-Goals

- No X write tools in v1.
- No posting, deleting, liking, reposting, following, muting, blocking, list
  mutation, DM, bookmark mutation, or media upload support in v1.
- No per-tool policy in v1.
- No per-Lightfast-user X connections in v1.
- No public third-party MCP client onboarding in v1; the X MCP endpoint is for
  Lightfast's server-side connector runtime.
- No inbound MCP bearer tokens that are raw X OAuth access tokens.
- No long-running Python XMCP process managed by Lightfast production runtime.
- No use of the hosted X docs MCP as an installed customer connector.
- No database schema change unless implementation discovers a concrete table
  constraint that prevents X from using the existing connector table.
- No manual SQL migration files.

## Chosen Approach

Lightfast will build a first-party reusable MCP bridge and use X as the first
provider on it:

1. `@repo/x-app-node` handles X OAuth, token refresh/revoke, account metadata,
   X API calls, and curated X tool definitions.
2. `api/app` adds an X provider flow parallel to `linear-flow.ts`, but uses the
   bridge for MCP discovery and calls instead of handing X tokens to an upstream
   MCP server.
3. `api/app` exposes `/api/connectors/x/mcp` as a Lightfast-hosted MCP endpoint
   for production X tool discovery and calls.
4. The MCP bridge authenticates inbound MCP requests with short-lived,
   audience-bound Lightfast MCP bearer tokens. The bridge loads the current org
   connector row, decrypts and refreshes provider tokens server-side, then calls
   the provider API.
5. `mcp-handler` is the preferred route adapter if it fits the final Next.js
   route shape; provider tool registration and auth decisions remain in
   Lightfast-owned modules so the adapter can be swapped if needed.
6. `@repo/x-emulator` provides deterministic X OAuth and X API behavior in
   local dev. The app-hosted bridge calls the emulator X API when emulator
   origins are configured.
7. The connector runtime continues to load tools from cached manifests and call
   provider MCP tools through provider-specific dispatch.

This preserves Lightfast's connector model, keeps Linear's provider-hosted MCP
path intact, and creates reusable infrastructure for providers that have APIs
but no production remote MCP service.

## Alternatives Considered

### Use Official XMCP Directly

This is rejected for production. It is local-process oriented, currently uses an
OAuth 1.0a startup browser flow, keeps tokens in memory, and exposes broad
OpenAPI-generated tools unless carefully allowlisted. That shape does not fit a
multi-org server connector runtime with encrypted persisted tokens and explicit
admin lifecycle controls.

Official XMCP remains useful as a reference for operation names, OpenAPI
generation behavior, allowlist semantics, and parity testing.

### Use Hosted Docs MCP Plus Raw X API Calls

This is rejected as the connector implementation. Docs MCP is useful for
developer research, but it does not call X API endpoints. Raw API calls without
an MCP bridge would bypass the connector system's MCP discovery/call model.

### Treat Raw X Access Tokens as MCP Bearer Tokens

This is rejected. It would copy Linear's bearer-token shape into the wrong trust
boundary. Linear owns its remote MCP server, so Linear OAuth tokens are valid
authorization for Linear MCP. For X, Lightfast owns the MCP resource server, so
the inbound MCP bearer must be a Lightfast token. X access tokens stay encrypted
at rest and are used only by the bridge server-side.

### Build the Bridge Without `mcp-handler`

This remains a fallback. Lightfast can implement Streamable HTTP directly with
`@vendor/mcp` primitives, but `mcp-handler` already solves the route-hosting and
MCP auth shape Vercel documents for Next.js. The implementation should keep the
provider registry and auth validation independent from `mcp-handler` so the
bridge is not locked into one adapter.

### Full OpenAPI-to-MCP Generation in v1

This is deferred. A generated 200+ tool surface is too broad for Lightfast's
current org-wide automation toggle. v1 should use a curated read-only subset and
leave generated/full-surface support for a later per-tool-policy design.

## Product Behavior

The Connectors page shows X as an available connector alongside Linear.

Catalog row:

- Provider id: `x`
- Display name: `X`
- Description: `Search posts and look up X accounts from Lightfast automations.`
- Builder: `Lightfast`
- Category: `Social`
- Catalog status: `available`

Connected row behavior matches Linear:

- Shows status as Connected, Needs reconnect, or Tools stale.
- Shows X account metadata as the provider account:
  - `providerActorId`: X user id from `/2/users/me`
  - `providerActorName`: `@username`
  - `metadata.name`: display name from X
  - `metadata.username`: username from X
- Shows `providerWorkspaceId: null`.
- Shows `providerWorkspaceName: "X"` so the existing detail surface has a stable
  provider label without implying a workspace.
- Shows cached read-only tool names and descriptions.
- Keeps **Use in automations** disabled when the connection is in `error`.
- Enables **Use in automations** by default only after MCP `tools/list`
  succeeds and at least one runtime-supported read-only tool is available.
- If X OAuth and account metadata succeed but MCP tool discovery fails, the
  connector remains connected with automations disabled, an empty or stale
  manifest, and `lastToolRefreshErrorAt`/`lastToolRefreshErrorCode` populated.

Callback behavior:

- Successful callback redirects to `/{orgSlug}/connectors?connector=x`.
- Failed callback redirects to
  `/{orgSlug}/connectors?connector=x&error=<safe_code>`.
- A callback where OAuth succeeds but initial tool discovery fails redirects to
  `/{orgSlug}/connectors?connector=x&error=x_tool_discovery_failed` after
  persisting the connection. The admin can retry with Refresh tools.
- The UI uses the same query-param cleanup behavior as Linear.

## Tool Surface

v1 exposes a curated read-only tool allowlist. Tool names should match X OpenAPI
operation ids where practical so they remain recognizable against official XMCP.

Initial v1 tools:

- `getUsersMe`
- `getUsersByUsername`
- `getUsersByUsernames`
- `getUsersById`
- `getUsersByIds`
- `getPostsById`
- `getPostsByIds`
- `searchPostsRecent`
- `getPostsCountsRecent`

The implementation may omit a listed tool only if the current X OpenAPI spec or
X API tier rejects it during provider-package tests; omitted tools must not be
silently replaced by a write-capable alternative.

Tool descriptions should be short and user-facing. Input schemas must be stored
server-side in the full manifest but not returned through the connector list UI,
matching Linear.

## Runtime Tool Names

X operation ids are camelCase, while the current connector runtime tool schema
only accepts lowercase provider tool names. The connector contract should relax
`connectorToolNameSchema` from lowercase-only to case-preserving ASCII tool
names:

- Keep accepted characters limited to letters, numbers, underscore, hyphen, and
  period.
- Continue rejecting whitespace and other punctuation.
- Preserve provider tool name casing in `providerToolName`.
- Continue prefixing runtime names with `<provider>__`, e.g.
  `x__getUsersByUsername`.

This avoids lossy normalization and collision risk between X operation ids.

## Backend Architecture

### `packages/connector-contract`

Changes:

- Add `x` to `CONNECTOR_PROVIDERS`.
- Add `x` to `CONNECTABLE_CONNECTOR_PROVIDERS`.
- Add the X catalog item.
- Relax `connectorToolNameSchema` to support camelCase provider tool names.
- Update contract tests for both `linear__create_issue` and
  `x__getUsersByUsername`.

### `packages/x-app-node`

Create a provider package parallel to `packages/linear-app-node`.

Responsibilities:

- Default endpoint resolution:
  - API origin: `https://api.x.com`
  - OAuth authorize URL: `https://x.com/i/oauth2/authorize`
  - OAuth token URL: `https://api.x.com/2/oauth2/token`
  - OAuth revoke URL: `https://api.x.com/2/oauth2/revoke`
  - User metadata URL: `https://api.x.com/2/users/me`
- Development/test endpoint override guard, matching Linear's custom endpoint
  policy.
- PKCE verifier/challenge generation.
- OAuth authorize URL construction:
  - `response_type=code`
  - `client_id`
  - exact `redirect_uri`
  - `scope=tweet.read users.read offline.access`
  - `state`
  - `code_challenge`
  - `code_challenge_method=S256`
- Token exchange and refresh.
- Token revoke.
- X account metadata lookup through `/2/users/me`.
- Curated X tool definitions and X API call helpers for the bridge.
- MCP client helpers that call the Lightfast-hosted X MCP endpoint with a
  Lightfast MCP bearer token.
- Sanitized error class and error codes:
  - `X_CUSTOM_ENDPOINT_FORBIDDEN`
  - `X_OAUTH_EXCHANGE_FAILED`
  - `X_TOKEN_REFRESH_FAILED`
  - `X_REVOKE_FAILED`
  - `X_METADATA_FAILED`
  - `X_MCP_FAILED`

Token endpoint authentication:

- For production confidential-client requests, use HTTP Basic authorization
  derived from X client id and client secret.
- Keep `client_id` in the form body only where X requires it for public-client
  compatibility in tests or emulator flows.
- Never log client secret, access token, refresh token, authorization code, or
  raw downstream error bodies.

### Reusable Lightfast MCP Bridge

The production X MCP bridge is a first-party TypeScript route at
`/api/connectors/x/mcp`, not the upstream Python XMCP process. The route lives
in `apps/app` and delegates to reusable bridge services in `api/app`.

Required behavior:

- Accept bearer authorization in the `Authorization` header.
- Treat the bearer as a Lightfast MCP token, never as an X user access token.
- Validate that the token is short-lived, audience-bound to the expected MCP
  endpoint/provider, scoped to the org and connection id, and issued for the
  requested purpose:
  - `purpose: "list"` for `tools/list`
  - `purpose: "call"` for tool calls
- Reject tokens whose org, provider, current connection id, audience, expiry, or
  purpose do not match the current request.
- Load the current connector connection server-side after auth. The bridge must
  reject missing, revoked, stale, or mismatched connections before listing or
  calling tools.
- Register only the curated v1 read-only tools for X.
- Convert MCP tool calls to X API v2 requests using decrypted and freshly
  refreshed X OAuth tokens loaded from the connector row.
- Mark the X connection `error` and disable automations on terminal provider
  auth failures.
- Return MCP `structuredContent` where possible and a text fallback for client
  compatibility.
- Avoid logging tool arguments, provider responses, provider tokens, or
  Lightfast MCP tokens by default.
- Use the same JSON-RPC and Streamable HTTP compatibility expectations as the
  current `@vendor/mcp` client.

The implementation should evaluate `mcp-handler` for the route adapter:

- Use `mcp-handler` and `withMcpAuth` if they support the required Next.js route
  shape, protected-resource metadata, and Streamable HTTP behavior.
- Keep token issuing/validation, connector-row loading, and provider tool
  registration in Lightfast modules rather than embedding them directly in the
  adapter callback.
- If `mcp-handler` cannot satisfy the route or auth requirements, implement the
  same bridge contract directly with `@vendor/mcp` primitives and keep the
  public route behavior unchanged.

MCP auth token requirements:

- Token format: `lfmcp_v1.<payload>.<signature>`, where `payload` is base64url
  JSON and `signature` is base64url HMAC-SHA256 over
  `lfmcp_v1.<payload>`.
- Signing secret: `CONNECTOR_MCP_AUTH_SECRET`.
- Development/test fallback: derive from `ENCRYPTION_KEY` only when
  `CONNECTOR_MCP_AUTH_SECRET` is absent.
- Maximum TTL: 5 minutes.
- Required claims:
  - `iss: "lightfast-connectors"`
  - `aud: "connector-mcp:x"`
  - `clerkOrgId`
  - `provider: "x"`
  - `connectionId`
  - `purpose: "list" | "call"`
  - `toolName` for `purpose: "call"`
  - `iat`
  - `exp`
  - `nonce`

The bridge endpoint is configured through `X_MCP_ENDPOINT`. In production and
normal local development, the app derives the default as
`${appOrigin}/api/connectors/x/mcp` unless an explicit environment override is
provided. `@repo/x-emulator` supplies X OAuth and X API origins; it does not
become the production-like MCP resource server for the X connector.

### `api/app/src/env.ts`

Add server env vars:

- `CONNECTOR_MCP_AUTH_SECRET`
- `X_API_ORIGIN`
- `X_OAUTH_ORIGIN`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `X_MCP_ENDPOINT`

`CONNECTOR_MCP_AUTH_SECRET` is required in production when X is configured.
`X_API_ORIGIN`, `X_OAUTH_ORIGIN`, and `X_MCP_ENDPOINT` are optional endpoint
overrides; production should use defaults unless a controlled test environment
needs overrides.

### `api/app/src/services/connectors/config.ts`

Add X configuration helpers parallel to Linear:

- `X_OAUTH_CALLBACK_PATH = "/api/connectors/x/oauth/callback"`
- `getXConnectorConfig`
- `requireXConnectorConfig`

Missing config for X is:

- `X_CLIENT_ID`
- `X_CLIENT_SECRET`

The config includes app origin, OAuth credentials, resolved X endpoints, and
the MCP endpoint.

### OAuth Attempts

The existing `attempts.ts` is Linear-specific. Replace it with
provider-scoped connector OAuth attempts.

New attempt records include:

- `provider: "linear" | "x"`
- `clerkOrgId`
- `lightfastUserId`
- `orgSlug`
- `mode: "connect" | "reconnect"`
- `codeVerifier`
- `stateHash`

Redis keys should include the provider, for example:

- `connector-oauth-attempt:linear:<attemptId>`
- `connector-oauth-attempt:x:<attemptId>`

State remains opaque, base64url encoded, hashed at rest, one-time consumed, and
expires after 15 minutes.

### `api/app/src/services/connectors/x-flow.ts`

Create an X flow parallel to Linear.

Responsibilities:

- Determine connect vs reconnect from the current org/provider row.
- Issue a provider-scoped OAuth attempt.
- Build the X authorize URL.
- Parse callback query params.
- Re-run Clerk session and org-admin checks before finalization.
- Exchange authorization code for X tokens.
- Fetch account metadata through `/2/users/me`.
- Revoke newly issued X tokens and abort finalization if metadata lookup fails,
  because Lightfast cannot identify the connected X account.
- Persist the new current connector row before MCP discovery:
  - `toolManifest: []` on initial connect
  - previous manifest copied forward on reconnect
  - `enabledForAutomations: false` until discovery succeeds
  - `lastToolRefreshErrorAt` and `lastToolRefreshErrorCode` set only when
    discovery fails
- Mint a short-lived Lightfast MCP token with `purpose: "list"`.
- Discover MCP tools through the configured X MCP endpoint with MCP
  `tools/list`.
- Update the persisted manifest after discovery succeeds.
- Enable automations by default only when discovery succeeds and at least one
  runtime-supported read-only tool is available.
- Preserve the persisted connection and disable automations when discovery
  fails; do not revoke the newly issued X tokens for discovery-only failure.
- Revoke previously stored X tokens during successful reconnect before replacing
  the current row.
- Encrypt new tokens before persistence.
- Refresh expiring X access tokens with compare-and-set semantics.
- Mark current X connections `error` and disable automations on terminal token
  refresh failures.
- Preserve cached manifests on non-auth MCP discovery failure.
- Disconnect by revoking upstream when possible and always marking the local
  current row revoked.

Safe callback error codes:

- `x_authorization_denied`
- `x_authorization_failed`
- `x_tool_discovery_failed`
- `x_transient_error`
- `permission_required`
- `expired_state`

### Connector Provider Dispatch

Update `api/app/src/services/connectors/index.ts`:

- `startConnectorOAuth`
- `refreshConnectorTools`
- `setConnectorAutomationEnabled`
- `disconnectConnector`

Each switch handles both `linear` and `x`.

### Runtime Loader

Update `api/app/src/services/connectors/runtime.ts` so it supports provider
dispatch instead of Linear-only behavior.

Required behavior:

- Load active, automation-enabled connections for any connectable provider.
- Derive runtime tool names using the provider id.
- Re-check the current connection before every call.
- Reject calls if the current connection is missing, not active, automation
  disabled, or the tool is no longer in the current manifest.
- For Linear, keep current behavior.
- For X, mint a short-lived Lightfast MCP token with `purpose: "call"` and the
  provider tool name, then call the configured X MCP endpoint through
  `@repo/x-app-node`.
- For X, provider token decrypt/refresh happens inside the Lightfast MCP bridge,
  not in the runtime caller.
- Mark only terminal auth errors as connector `error`.
- Keep logs redacted:
  - no tool arguments
  - no tokens
  - no provider response bodies
  - no raw downstream error messages for unknown errors

## Data Model

The existing `lightfast_org_connector_connections` table is sufficient for v1.

X field mapping:

- `provider`: `x`
- `providerWorkspaceId`: `null`
- `providerWorkspaceName`: `"X"`
- `providerActorId`: X user id
- `providerActorName`: `@username`
- `scopes`: exact returned scope strings from X
- `mcpEndpoint`: configured X MCP endpoint
- `metadata`: `{ "name": string, "username": string, "mode": "connect" | "reconnect" }`
- `toolManifest`: full server-side curated MCP tool manifest, or `[]` until
  initial bridge discovery succeeds
- `lastToolRefreshAt`: set when bridge discovery succeeds
- `lastToolRefreshErrorAt` and `lastToolRefreshErrorCode`: set when bridge
  discovery fails without making the connection invalid
- `enabledForAutomations`: `false` until successful discovery returns at least
  one runtime-supported tool

Revocation, error, refresh, and manifest behavior should reuse the existing
generic connector helpers where possible. The key X difference from current
Linear code is that MCP discovery failure after OAuth metadata success is
recoverable and should not roll back the installed connection.

## UI Design

Update the existing Connectors page rather than adding an X-specific page.

Required UI changes:

- Add an X icon or local mark in `connector-icons.tsx`.
- Replace the single `CONNECTABLE_PROVIDER = "linear"` guard with a provider
  set derived from the connector contract or an explicit local union containing
  `linear` and `x`.
- Make missing-config copy provider-aware.
- Ensure search matches X name, description, category, provider id, and cached
  tool names.
- Keep detail sheet behavior generic.
- Show X account metadata under the existing Account row.
- Keep action labels generic: Connect, Reconnect, Refresh tools, Disconnect.
- Do not add X write-risk copy in v1 because write tools are not exposed.
- In the automation toggle copy, describe X as read-only context in v1.

The X connector does not need a separate hero or route.

## App Routes and Proxy

Add public callback route:

- `apps/app/src/app/(app)/(connectors)/api/connectors/x/oauth/callback/route.ts`

Update proxy public-route allowlist:

- Add `/api/connectors/x/oauth/callback`.
- Add `/api/connectors/x/mcp(.*)` or the equivalent app-owned API bypass so
  Clerk session auth does not intercept MCP clients. The route still requires
  Lightfast MCP bearer auth.

Add the production MCP bridge route:

- `apps/app/src/app/(app)/(connectors)/api/connectors/x/mcp/route.ts`

The MCP bridge route handles its own bearer-token validation and must not rely
on Clerk session auth.

## Emulator

Extend `@repo/x-emulator`.

Current emulator support:

- OAuth authorize
- OAuth token exchange
- OAuth refresh
- OAuth revoke
- `/2/users/me`
- failure switches

Add:

- Deterministic X API responses for every curated read-only X tool.
- Failure switches for X API endpoints used by bridge call tests.
- Manifest env output:
  - `X_API_ORIGIN=${emulatorOrigin}`
  - `X_OAUTH_ORIGIN=${emulatorOrigin}`
  - `X_MCP_ENDPOINT=${LIGHTFAST_APP_ORIGIN}/api/connectors/x/mcp`

The emulator should preserve existing OAuth tests and add endpoint tests for
the X API calls made by the bridge. MCP protocol tests live primarily in
`apps/app` route tests and `@repo/x-app-node` MCP client tests because the
production-like MCP server is the Lightfast app route.

## Testing

Provider package:

- `packages/x-app-node/src/__tests__/config.test.ts`
- `packages/x-app-node/src/__tests__/oauth.test.ts`
- `packages/x-app-node/src/__tests__/metadata.test.ts`
- `packages/x-app-node/src/__tests__/mcp.test.ts`
- `packages/x-app-node/src/__tests__/tools.test.ts`

Connector contract:

- Provider catalog includes `linear` and `x`.
- Connectable providers include `linear` and `x`.
- Runtime tool names accept `x__getUsersByUsername`.
- Tool names reject whitespace and unsafe punctuation.

API services:

- Catalog lists X as available when configured.
- Catalog shows X missing config when `X_CLIENT_ID` or `X_CLIENT_SECRET` is
  absent.
- `startConnect({ provider: "x" })` builds the correct X authorize URL and
  provider-scoped attempt.
- X callback completes token exchange, metadata fetch, encrypted persistence,
  Lightfast MCP token minting, bridge `tools/list`, manifest update, and
  redirect.
- X callback keeps the connection installed with automations disabled when
  bridge `tools/list` fails after OAuth and metadata success.
- X reconnect revokes previous tokens before replacing the current row.
- Metadata failure revokes newly issued X tokens and logs redacted details.
- X token refresh handles CAS winner/loser cases like Linear.
- X refresh-tools preserves previous manifest on non-auth MCP failure.
- X disconnect wipes local tokens and manifest even when upstream revoke fails.
- Connector mutations reject non-admins for X as they do for Linear.
- MCP auth token issue/verify rejects wrong audience, expired token, wrong org,
  wrong connection id, wrong purpose, and mismatched tool name.

Runtime:

- Loads both Linear and X active automation-enabled tools.
- Filters invalid tool names.
- Re-checks current X state before calling.
- Calls X MCP with a short-lived Lightfast MCP token.
- Does not decrypt or pass raw X tokens from the runtime caller.
- Marks X connection error on terminal auth failures returned by the bridge.
- Logs success and failure data without token, arguments, or response leakage.

UI:

- Renders X available card.
- Starts X connect mutation and redirects to returned authorization URL.
- Shows provider-aware missing config.
- Opens X detail sheet for `?connector=x` when connected.
- Shows X tools and account metadata.
- Filters X by search/status.

Route/proxy:

- X OAuth callback delegates to `completeXConnectorOAuth`.
- Proxy treats `/api/connectors/x/oauth/callback` as public.
- Proxy lets `/api/connectors/x/mcp` reach the route handler without Clerk
  browser-session auth.
- X MCP route rejects missing/invalid Lightfast MCP bearer tokens.
- X MCP route lists curated tools through MCP `tools/list`.
- X MCP route calls a curated tool, refreshes X provider tokens server-side when
  needed, and never exposes provider tokens in the MCP response.

Suggested focused verification commands after implementation:

```bash
pnpm --filter @repo/connector-contract test
pnpm --filter @repo/x-app-node test
pnpm --filter @repo/x-emulator test
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts src/__tests__/connectors-runtime.test.ts src/__tests__/connectors-mcp-auth.test.ts src/__tests__/connectors-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/api/connectors/connectors-routes.test.ts src/__tests__/app/api/connectors/x-mcp-route.test.ts src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/connectors-page.test.tsx
pnpm check
pnpm typecheck
```

## Rollout

Local development:

- `pnpm dev` already starts `@repo/x-emulator`.
- `apps/app` already includes X emulator env injection through
  `with-related-projects`.
- Add `X_MCP_ENDPOINT` to the emulator manifest as the app-hosted route,
  `${LIGHTFAST_APP_ORIGIN}/api/connectors/x/mcp`, so local X connector flows
  exercise the same bridge route as production while X API calls go to the
  emulator.
- Add `CONNECTOR_MCP_AUTH_SECRET` to app environments, or allow dev/test to use
  the documented `ENCRYPTION_KEY` fallback.

Preview and production:

- X appears in the catalog.
- Admin connect action is available only when X env is configured.
- Missing config is shown as an unavailable state, matching Linear.
- X Developer Console must register the exact callback URL:
  `/api/connectors/x/oauth/callback`.
- `X_MCP_ENDPOINT` should normally be omitted in production so it derives from
  the deployed app origin. Override it only for controlled preview or test
  environments.
- Production X API rate limits and paid-tier restrictions surface as safe
  connector refresh/call errors. Lightfast does not attempt to bypass or mask
  provider tier limits.

## Security and Compliance

- Store X tokens encrypted with `@repo/app-encryption` and `ENCRYPTION_KEY`.
- Sign Lightfast MCP bearer tokens with `CONNECTOR_MCP_AUTH_SECRET`, falling
  back to `ENCRYPTION_KEY` only in development/test when the dedicated secret is
  absent.
- Never return tokens or full input schemas through tRPC.
- Never place tokens in query strings.
- Send bearer tokens only in the `Authorization` header.
- Never use raw X OAuth tokens as inbound MCP bearer tokens.
- Keep Lightfast MCP tokens short-lived and scoped to org, provider, connection,
  purpose, and tool when applicable.
- Do not log OAuth codes, token values, tool arguments, raw provider responses,
  or raw unknown downstream error messages.
- Keep custom endpoint overrides restricted to development and test unless the
  exact default production endpoint is used.
- Keep v1 tools read-only to avoid public side effects from the org-wide
  automation toggle.
- Treat `offline.access` as sensitive because it gives Lightfast refresh-token
  continuity until revoked.

## Future Work

- Add per-tool allow/deny policy.
- Add explicit human approval for X write tools.
- Add write scopes and write tools after policy exists.
- Consider generated OpenAPI-to-MCP registration once tool policy exists.
- Add provider rate-limit telemetry and user-facing quota messaging.
- Add optional docs MCP access for internal developer workflows, separate from
  customer connector installation.
- Expand the reusable bridge to additional providers that lack provider-hosted
  remote MCP servers.
- Add public third-party MCP client support only after a full external OAuth
  client model, consent UX, token audience model, and per-tool policy exist.
