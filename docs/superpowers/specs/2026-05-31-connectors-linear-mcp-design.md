# Connectors and Linear MCP Design

Date: 2026-05-31
Last updated: 2026-06-01
Status: Approved for implementation planning

## Summary

Lightfast will introduce **Connectors** as an org-level marketplace for external MCP-based integrations. Linear is the only connectable provider in v1, but the system should be generic from the start so future connectors do not require route, schema, or UI redesign.

The v1 Linear connector is installed by a Lightfast org admin through a Linear OAuth authorization-code flow with `actor=app`, PKCE, and broad `read,write` scopes. After installation, Lightfast stores encrypted org-level credentials, discovers Linear MCP tools, renders those tools in the Connectors page, and makes all connector tools available to the org automation runtime when **Use in automations** is enabled.

The **Use in automations** toggle is org-wide delegation to the automation runtime. It does not create per-tool policy in v1. Existing automation permissions decide who can create, edit, and run automations.

Local development and e2e should use a deterministic Linear emulator by default. Production and preview use real Linear only when explicit Linear environment variables point at Linear's real API and MCP endpoints.

Reference assumptions:

- Linear provides an official remote MCP server at `https://mcp.linear.app/mcp`.
- Linear's MCP server supports OAuth-based authentication and can be used with an existing Linear OAuth application.
- Linear OAuth supports `read,write` scopes, PKCE, and app actor tokens.

Sources:

- [Linear MCP server docs](https://linear.app/docs/mcp)
- [Linear OAuth 2.0 authentication docs](https://linear.app/developers/oauth-2-0-authentication)

## Goals

- Add a top-level bound-org workspace page at `/{slug}/connectors`.
- Add **Connectors** to the app sidebar under **Manage**, alongside Automations and Settings.
- Ship Connectors to all bound orgs once merged. Do not hide the visible route or sidebar entry behind a feature flag.
- Model Connectors after the Codex marketplace UI:
  - Large centered marketplace header.
  - Search and filter controls.
  - Featured hero section.
  - Featured connector list.
  - Connected connectors expand inline with tools and controls.
- Support one current Linear connector per Lightfast org.
- Install Linear as an org-level app actor, not as each Lightfast user.
- Request broad Linear `read,write` scopes in v1.
- Show actual MCP tools returned by the Linear MCP server or emulator.
- Allow all connector MCP tools in v1. Tool-level policy can be added later.
- Default **Use in automations** to on only when OAuth succeeds and MCP discovery returns at least one tool.
- Keep GitHub source-control setup separate from Connectors.
- Provide a Linear emulator for repeatable local development and e2e.

## Non-Goals

- No per-user Linear connections.
- No connector-specific tool allowlist or denylist in v1.
- No human confirmation step for Linear write tools in v1.
- No separate Linear detail page.
- No marketplace install flow for any provider other than Linear.
- No replacement of existing GitHub source-control binding.
- No access to Connectors before the org has completed current workspace setup.
- No manual SQL migration files. Schema changes must use Drizzle generation.

## Product and UI

The Connectors page is a single-page marketplace at `/{slug}/connectors`. It is a bound workspace product route, not a setup-exempt route.

The page uses the Codex marketplace header treatment and the connected-connector list pattern from the provided connector-list screenshot:

- Header:
  - Title: `Connectors`.
  - Description: "Allow Lightfast to reference other apps for more context and actions through MCP connectors."
  - Search input.
  - Builder and status filters.
  - Featured hero focused on Linear.
- Connector list:
  - Linear is active and connectable.
  - Future providers such as Slack, Notion, and Sentry appear as `Coming soon` catalog rows to preserve marketplace density without implying capability.
  - Unconnected active providers show a `Connect` action for admins.
  - Non-admin members see disabled mutation actions with a permission hint.
  - Connected providers show status, overflow menu, MCP tool chips, `See more`, and **Use in automations**.

The connector catalog should be data-driven from `@repo/connector-contract`. Catalog provider ids may include coming-soon providers, while the connectable provider id union is `linear` in v1. Backend mutations must only accept connectable provider ids.

Search should match provider name, provider description, and cached tool names.

Featured Linear behavior:

- Linear remains the featured hero even after connection because it is the only active v1 connector.
- When connected, the hero CTA changes to a management action rather than disappearing.

Connected Linear row behavior:

- Shows `Connected` status with a green indicator when usable.
- Shows `Needs reconnect` for auth-related `error` state. The database status remains `error`; the UI derives the label from structured error metadata such as `errorCode: "auth_required"`.
- Shows tool count and the first several MCP tool names as chips.
- `See more` expands the full display manifest inline.
- Overflow menu includes refresh tools, reconnect, and disconnect. Admin-only actions are disabled or hidden for non-admin members.
- **Use in automations** is a switch. It controls whether automation runs can access Linear MCP tools while keeping the Linear installation intact.
- In `Needs reconnect`, cached tools may remain visible, **Use in automations** is disabled, and `Reconnect` is the primary admin action.

Tool display:

- The database may store the full discovered MCP tool manifest, including input schemas.
- `org.workspace.connectors.list` returns only display-safe fields to the UI: tool name, description, and total count. It does not return input schemas.
- All org members can see tool names and descriptions, including write-capable tools such as `create_issue` and `update_issue`.

Access control:

- All bound org members can view connector catalog, connection status, and available tools.
- Org admins can connect, reconnect, disconnect, refresh tools, and toggle **Use in automations**.
- Existing automation permissions decide who can create, edit, or run automations that may use enabled connector tools.

Post-connect behavior:

- The Linear OAuth callback redirects back to `/{slug}/connectors`.
- Linear appears connected and expanded inline.
- **Use in automations** is enabled by default only if OAuth succeeds and initial MCP tool discovery succeeds with at least one tool.
- If OAuth succeeds but MCP discovery fails, Linear is still installed as `active`, but automation use stays off and the UI prompts an admin to refresh tools.

Disconnect behavior:

- Disconnect revokes upstream when possible and marks the local current row `revoked`.
- Historical revoked rows remain in the database for audit/debug purposes.
- The marketplace UI collapses Linear back to the unconnected row and hides historical cached tools.

## Backend Architecture

Connectors should be implemented as a generic bound-org system with a Linear provider adapter.

Package and dependency prep:

- Rename the existing `vendor/mcp` package to `vendor/orpc-mcp-adapter` with package name `@vendor/orpc-mcp-adapter`.
  - It keeps `registerContractTools` and the oRPC-contract-to-MCP adapter behavior currently used by `core/mcp`.
  - `core/mcp` imports `registerContractTools` from `@vendor/orpc-mcp-adapter`.
- Create a new pure MCP SDK vendor wrapper at `vendor/mcp` with package name `@vendor/mcp`.
  - It only re-exports selected `@modelcontextprotocol/sdk` client, server, transport, and type primitives.
  - It must not depend on app, api, db, packages, or oRPC code.
  - `core/mcp`, `packages/linear-app-node`, and `emulators/linear` depend on this pure wrapper for MCP protocol primitives.

Connector packages and ownership:

- `packages/connector-contract`
  - Catalog provider ids, including coming-soon providers.
  - Connectable provider ids, initially `linear`.
  - Connection status schema.
  - Connector catalog metadata.
  - Display-safe MCP tool manifest types.
  - Full server-side MCP tool manifest types.
  - tRPC input/output schemas shared between `api/app` and `apps/app`.
- `packages/linear-app-node`
  - Linear OAuth URL construction.
  - Authorization code exchange.
  - Token refresh and revoke helpers.
  - Linear workspace/app actor metadata lookup.
  - MCP `listTools` support against a remote Streamable HTTP endpoint through `@vendor/mcp`.
  - No app auth or database ownership.
- `db/app`
  - Generic connection table and repository helpers.
  - Token fields are encrypted before storage by API services.
- `api/app`
  - Bound org auth and admin gates.
  - Connector tRPC router under `org.workspace.connectors`.
  - Redis-backed OAuth attempt issuance and consumption.
  - OAuth callback finalization service.
  - Runtime connector tool loader boundary for future automation AI execution.
- `apps/app`
  - Connectors page and client components.
  - Sidebar route policy and proxy tests.
- `emulators/linear`
  - Dev-only Linear-compatible OAuth/API/MCP emulator.

Provider abstraction:

- Linear provider implementation supplies:
  - OAuth authorization URL.
  - Token exchange and refresh.
  - Token revoke.
  - Provider metadata lookup.
  - MCP endpoint resolution.
  - Tool discovery.
- The generic router and table should not contain Linear-specific column names.

## Data Model

Add a generic `org_connector_connections` table in `db/app`.

The table enforces at most one current connection per `clerkOrgId` and `provider`. Use a nullable current-row mirror because MySQL does not support partial unique indexes. The mirror value should be `${clerkOrgId}:${provider}` for current `active` and `error` rows, and `NULL` for `revoked` rows. This keeps an errored installed connector from allowing a second current row until reconnect supersedes it.

Fields:

- `id`: internal bigint primary key.
- `clerkOrgId`: Clerk org id.
- `currentOrgProviderKey`: nullable uniqueness mirror for current `active` or `error` rows.
- `provider`: controlled code, initially `linear`.
- `status`: `active`, `error`, or `revoked`.
- `connectedByUserId`: Clerk user id.
- `connectedAt`: timestamp.
- `revokedAt`: nullable timestamp.
- `providerWorkspaceId`: nullable string.
- `providerWorkspaceName`: nullable string.
- `providerActorId`: nullable string.
- `providerActorName`: nullable string.
- `encryptedAccessToken`: text.
- `encryptedRefreshToken`: nullable text.
- `accessTokenExpiresAt`: nullable timestamp.
- `refreshTokenExpiresAt`: nullable timestamp.
- `scopes`: JSON string array.
- `mcpEndpoint`: URL string.
- `toolManifest`: JSON array containing the full server-side MCP tool manifest.
- `enabledForAutomations`: boolean.
- `metadata`: provider-specific JSON object, including provider-safe error diagnostics.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Repository helper responsibilities:

- Get current connection by org/provider.
- List catalog connection states for org.
- Finalize a new current connection by atomically revoking any prior current row for the same org/provider and inserting the new active row.
- Update cached tool manifest.
- Toggle automation enablement.
- Mark revoked.
- Mark error with provider-safe metadata and automatically set `enabledForAutomations=false`.
- Update refreshed encrypted tokens with compare-and-set semantics where practical.

Reconnect behavior:

- Starting OAuth for reconnect leaves the current row untouched.
- Successful OAuth callback supersedes the old current row in one database transaction.
- Failed or abandoned reconnect leaves the existing row intact.

Sensitive fields:

- Access and refresh tokens must be encrypted with `@repo/app-encryption` and `env.ENCRYPTION_KEY` before persistence.
- Decrypted tokens should exist only inside server-side OAuth, refresh, and connector runtime code.
- Tokens must never be returned through tRPC.

## API Design

Add `org.workspace.connectors` under the existing `org.workspace` tRPC router.

Procedures:

- `list`
  - Bound-org member-readable.
  - Returns catalog entries plus connection state for the active org.
  - Includes display-safe cached tool names/descriptions/count and `enabledForAutomations`.
  - Does not return tokens, input schemas, or sensitive metadata.
- `startConnect({ provider })`
  - Bound-org admin-only.
  - Accepts only connectable provider ids.
  - Creates a Redis-backed OAuth attempt for the active org and user.
  - Returns provider authorization URL.
- `refreshTools({ provider })`
  - Bound-org admin-only in v1.
  - Calls provider MCP `listTools` with stored credentials and updates cached manifest.
  - If refresh succeeds after an initial discovery failure, admin can enable automation use.
- `setAutomationEnabled({ provider, enabled })`
  - Bound-org admin-only.
  - Updates `enabledForAutomations`.
  - Rejects enabling when the connector is not `active` or has no discovered tools.
- `disconnect({ provider })`
  - Bound-org admin-only.
  - Attempts upstream revoke when supported.
  - Marks the local connection revoked even if upstream revoke is already invalid.

OAuth attempts:

- Use a Redis-backed, one-time consumable OAuth attempt pattern matching the existing GitHub setup flow.
- Use a provider-specific prefix such as `linear-connect-oauth-attempt:`.
- TTL is 15 minutes.
- State contains only an opaque attempt id and nonce, encoded base64url.
- Redis record stores the state hash, `codeVerifier`, `clerkOrgId`, `lightfastUserId`, `orgSlug`, provider, return path, and any reconnect context.
- Callback first looks up the attempt, verifies the current user is still the expected org admin, then consumes with `getdel` before token exchange.

OAuth callback:

- Add the app route `/api/connectors/linear/oauth/callback`.
- Add this route to the public proxy allowlist so provider callbacks are not corrupted by normal signed-in route redirects.
- The route remains self-authenticating through the Redis attempt and `assertCurrentUserIsOrgAdmin`.
- It validates state, exchanges the authorization code, fetches provider metadata, discovers tools, stores the connection, and redirects to `/{slug}/connectors`.
- It should call an internal service rather than exposing finalization as a public client mutation.

Error handling:

- Invalid or expired OAuth state redirects to `/{slug}/connectors?connector=linear&error=oauth_state`.
- Denied authorization redirects with `error=access_denied`.
- Token exchange failure redirects with `error=connect_failed` and logs the provider-safe diagnostic.
- OAuth success with MCP discovery failure stores the connection as `active`, stores an empty or stale manifest with provider-safe error metadata, keeps `enabledForAutomations=false`, and redirects with a refresh-needed diagnostic.
- Refresh-token failure or provider auth failure marks the current row `error`, sets `enabledForAutomations=false`, and surfaces a reconnect-needed diagnostic.

## Routing and App Integration

Page routing:

- Add `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page.tsx`.
- Prefetch `trpc.org.workspace.connectors.list` before `<HydrateClient>`.
- Add **Connectors** to `getOrgManageItems` in the app sidebar.

Proxy:

- Add `/:slug/connectors(.*)` to `ORG_ROUTE_POLICIES` with `setupExempt: false`.
- Include it in Clerk organization sync patterns.
- Add `/api/connectors/linear/oauth/callback` to public route patterns.

## Linear Provider

Linear v1 configuration:

- `LINEAR_CLIENT_ID`
- `LINEAR_CLIENT_SECRET`
- `LINEAR_API_ORIGIN`
- `LINEAR_MCP_ENDPOINT`

Production configuration uses:

- API: `https://api.linear.app`
- MCP: `https://mcp.linear.app/mcp`

Development defaults are injected by the Linear emulator through `apps/app` `with-related-projects`.

OAuth:

- Use authorization-code OAuth with PKCE and `actor=app`.
- Do not use `client_credentials` for the v1 marketplace install flow.
- Request broad `read,write` scopes.
- Store granted scopes.
- Store refreshable OAuth tokens when Linear returns them.
- Refresh before expiry when refresh credentials are present.

MCP:

- Use the stored access token as `Authorization: Bearer <token>` when connecting to the configured MCP endpoint.
- Use the same MCP Streamable HTTP client path against emulator and production.
- Fetch actual tool list through MCP discovery.
- Cache the returned tool names/descriptions/input schemas as the full server-side tool manifest.

## Emulator and Local Dev

Add `emulators/linear`, modeled after `emulators/github`.

Package:

- Name: `@repo/linear-emulator`.
- Use the same minimal in-repo HTTP server style as `emulators/github`; do not add Express, Hono, or another framework.
- Scripts:
  - `dev`: start server.
  - `env:sh`: print shell-safe deterministic Linear env.
  - `test`: run emulator tests.
  - `typecheck`: TypeScript validation.

Files:

- `src/start.ts`
- `src/env.ts`
- `src/env-sh.ts`
- `src/fixtures.ts`
- `src/server.ts`
- `src/__tests__/server.test.ts`
- `README.md`

Seed data:

- Workspace: `lightfast-emulated`.
- App actor: `Lightfast Local`.
- OAuth client id/secret.
- Teams.
- Projects.
- Issues.
- Comments.
- Deterministic access and refresh tokens.

Routes:

- OAuth-compatible authorize route.
- OAuth token route.
- OAuth revoke route.
- Minimal Linear-compatible metadata/API routes used during connect.
- `/mcp` route that validates emulator-issued Bearer tokens and exposes deterministic MCP tools using the real MCP Streamable HTTP shape closely enough that the production provider client is used unchanged.
- Reset route for e2e repeatability.
- Deterministic failure switches for expired access tokens and refresh failure.

MCP tools:

- The emulator should expose enough tools to exercise UI expansion and automation runtime:
  - `list_issues`
  - `get_issue`
  - `create_issue`
  - `update_issue`
  - `list_comments`
  - `create_comment`
  - `list_projects`
  - Several additional deterministic tools so `See more` is meaningful.

Root dev wiring:

- Add root script task `//#_linear_emulator`.
- Start it through `portless run --name linear.lightfast`.
- Add Turbo persistent task config.
- Include `//#_linear_emulator` in root `pnpm dev` by default.
- Extend `apps/app` `with-related-projects` to evaluate:
  - `pnpm --silent --filter @repo/linear-emulator env:sh -- --app-origin "$(portless get app.lightfast)" --emulator-origin "$(portless get linear.lightfast)"`
- Inject the resulting `LINEAR_*` env into the app dev process.

Dev URL:

- Primary: `https://linear.lightfast.localhost`.
- Worktree-prefixed: `https://<wt>.linear.lightfast.localhost`.

Real Linear should not be required for local dev or e2e.

## Automation Runtime

Automations are currently scaffolded. The first implementation should add a server-side connector runtime loader boundary without forcing it into a non-existent AI executor.

Runtime loader responsibilities:

- Load current `active` connections for the org where `enabledForAutomations=true`.
- Decrypt tokens server-side inside the runtime boundary.
- Use cached manifests to register available tools at run start.
- Expose all connector MCP tools. No Lightfast-side tool allowlist or denylist in v1.
- On every connector tool call, re-check that the connection is still current, `active`, and `enabledForAutomations=true` before sending the MCP request.
- Call tools through the connector MCP server using the stored Bearer token.
- If a token is expired and refresh is available, refresh and persist new encrypted tokens.
- If refresh fails or the provider returns auth errors, mark the connection `error`, set `enabledForAutomations=false`, and fail the current tool call with a reconnect-needed error.

Tool manifest strategy:

- `toolManifest` is UI and runtime registration metadata.
- Runtime uses the cached manifest to register tools at run start.
- Runtime calls the live MCP server only when a specific connector tool is invoked.
- If cached tools include a tool that the live MCP server no longer supports, fail that tool call, mark the cached manifest stale/error metadata, and surface a refresh or reconnect prompt.
- Automatic refresh-and-retry for stale manifests is out of v1 and should be filed as a follow-up GitHub issue after v1 lands.

Boundary:

- Connectors are only reachable after the existing org setup gate is complete.
- Connectors do not affect the setup gate and do not replace GitHub source-control binding.
- Linear Connector is optional and only affects available automation tools.

## Security and Permissions

- Bound org admin gate for connect, reconnect, refresh tools, toggle automation use, and disconnect.
- Bound org member-readable status and display tool manifests.
- **Use in automations** delegates broad Linear read/write MCP access to the org automation runtime.
- Linear write tools can execute automatically inside automations in v1; there is no per-call confirmation flow.
- Disabling **Use in automations** or disconnecting should take effect on the next connector tool call, not merely the next automation run.
- OAuth state uses a short-lived Redis attempt, hashed state, PKCE, one-time consumption, org id, user id, provider, return path, nonce, and expiry.
- OAuth callback must validate the attempt and ensure the user still has admin access to the org.
- Store tokens encrypted with `@repo/app-encryption`.
- Never expose raw tokens to React components, tRPC responses, logs, or telemetry.
- Log provider errors with redacted metadata.
- Disconnect should revoke upstream when possible and always mark the local current row revoked.
- Tool calls are broad in v1 by product decision; policy controls are a future enhancement.

## Testing and Verification

Vendor prep:

- Verify the `@vendor/mcp` / `@vendor/orpc-mcp-adapter` split with typecheck.
- Verify `core/mcp` still builds/tests after import changes.

Backend:

- DB schema tests for indexes, current-row uniqueness mirror, and table exports.
- Repository helper tests for finalize, revoke, toggle, manifest refresh, mark-error behavior, and current-row replacement.
- Connector contract tests for catalog ids, connectable ids, status values, and display/full tool manifest parsing.
- Linear provider tests for OAuth URL construction, PKCE token exchange parsing, metadata parsing, refresh/revoke behavior, and MCP tool parsing.
- tRPC router tests for member vs admin permissions, bound-org gating, connectable-provider validation, and response redaction.
- OAuth attempt tests for TTL shape, hashed state, one-time consumption, and missing/expired state behavior.
- Runtime loader tests for loading enabled connections, decrypting only server-side, validating enabled state on call, and marking auth failures as `error`.

Emulator:

- OAuth authorize/token/revoke happy path.
- Invalid state/client/token behavior.
- Expired access-token and refresh-failure switches.
- MCP `/mcp` rejects missing or invalid Bearer tokens.
- MCP `/mcp` lists deterministic tools for valid tokens.
- Reset route restores seed data.

Frontend:

- Connectors page renders catalog rows.
- Linear unconnected state shows Connect for admins.
- Non-admin members cannot mutate connection state.
- Connected Linear expands with tools and enabled automation switch.
- Error Linear shows `Needs reconnect`, disabled automation switch, and cached tools when available.
- Coming-soon rows do not start provider flows.
- Search matches provider name, description, and cached tool names.

Proxy/routing:

- `/:slug/connectors(.*)` is included in Clerk organization sync.
- Unbound orgs are redirected away from `/{slug}/connectors` to setup.
- `/api/connectors/linear/oauth/callback` is public at the proxy layer and self-authenticating in the route/service.

Integration/e2e:

- Local `pnpm dev` starts Linear emulator through Portless.
- Browser e2e exercises the full Linear OAuth redirect through the emulator at least once.
- Return to `/{slug}/connectors`.
- Verify cached tool manifest is shown.
- Toggle **Use in automations**.
- Disconnect marks connection revoked and collapses the UI.

Quality gates:

- `pnpm --filter @vendor/mcp typecheck`
- `pnpm --filter @vendor/orpc-mcp-adapter typecheck`
- `pnpm --filter @lightfastai/mcp test typecheck`
- `pnpm --filter @repo/connector-contract test typecheck`
- `pnpm --filter @repo/linear-app-node test typecheck`
- `pnpm --filter @repo/linear-emulator test typecheck`
- `pnpm --filter @db/app test typecheck`
- `pnpm --filter @api/app test typecheck`
- `pnpm --filter @lightfast/app test typecheck`
- Broader `pnpm typecheck` when the implementation touches shared contracts or route types.

## Rollout Plan

1. Prep commit: rename existing `@vendor/mcp` adapter to `@vendor/orpc-mcp-adapter` and create pure `@vendor/mcp` SDK wrapper.
2. Add connector contract and schema foundations.
3. Add Linear provider package.
4. Add Linear emulator and root dev wiring.
5. Add API services and `org.workspace.connectors` tRPC router.
6. Add OAuth callback route and proxy allowlist.
7. Add Connectors page and sidebar navigation.
8. Add connector runtime loader boundary for future automation AI execution.
9. Add focused tests.
10. Run local dev/e2e verification against the emulator.

## Future Enhancements

- Per-tool allowlists and denylists.
- Tool risk labeling.
- Audit log for connector tool calls.
- Provider-specific permission review before connect.
- Multiple active connections per provider when a provider has a workspace or project-level installation concept.
- More providers in the marketplace.
- Tool manifest diffing when providers add or remove tools.
- Automatic refresh-and-retry when a cached tool manifest is stale.
