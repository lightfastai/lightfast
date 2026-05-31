# Connectors and Linear MCP Design

Date: 2026-05-31
Status: Approved for implementation planning

## Summary

Lightfast will introduce **Connectors** as an org-level marketplace for external MCP-based integrations. Linear is the only active connector in v1, but the system should be generic from the start so future connectors do not require route, schema, or UI redesign.

The v1 Linear connector is installed by a Lightfast org admin through a Linear OAuth app actor flow. After installation, Lightfast stores encrypted org-level credentials, discovers Linear MCP tools, renders those tools in the Connectors page, and makes all connector tools available to Lightfast automations when **Use in automations** is enabled.

Local development and e2e should use a deterministic Linear emulator by default. Production and preview use real Linear only when explicit Linear environment variables point at Linear's real API and MCP endpoints.

Reference assumptions:

- Linear provides an official remote MCP server at `https://mcp.linear.app/mcp`.
- Linear's MCP server supports OAuth-based authentication and can be used with an existing Linear OAuth application.
- Linear OAuth supports `read,write` scopes and app actor tokens.

Sources:

- [Linear MCP server docs](https://linear.app/docs/mcp)
- [Linear OAuth 2.0 authentication docs](https://linear.app/developers/oauth-2-0-authentication)

## Goals

- Add a top-level org workspace page at `/{slug}/connectors`.
- Add **Connectors** to the app sidebar under **Manage**, alongside Automations and Settings.
- Model Connectors after the Codex marketplace UI:
  - Large centered marketplace header.
  - Search and filter controls.
  - Featured hero section.
  - Featured connector list.
  - Connected connectors expand inline with tools and controls.
- Support one active Linear connector per Lightfast org.
- Install Linear as an org-level app actor, not as each Lightfast user.
- Request broad Linear `read,write` scopes in v1.
- Show actual MCP tools returned by the Linear MCP server or emulator.
- Allow all connector MCP tools in v1. Tool-level policy can be added later.
- Default **Use in automations** to on after successful connect.
- Keep GitHub source-control setup separate from Connectors.
- Provide a Linear emulator for repeatable local development and e2e.

## Non-Goals

- No per-user Linear connections.
- No connector-specific tool allowlist or denylist in v1.
- No separate Linear detail page.
- No marketplace install flow for any provider other than Linear.
- No replacement of existing GitHub source-control binding.
- No manual SQL migration files. Schema changes must use Drizzle generation.

## Product and UI

The Connectors page is a single-page marketplace at `/{slug}/connectors`.

The page uses the Codex marketplace header treatment and the connected-connector list pattern from the provided connector-list screenshot:

- Header:
  - Title: `Connectors`.
  - Description: "Allow Lightfast to reference other apps for more context and actions through MCP connectors."
  - Search input.
  - Builder and status filters.
  - Featured hero focused on Linear.
- Connector list:
  - Linear is active.
  - Future providers such as Slack, Notion, and Sentry appear as disabled `Coming soon` rows to preserve marketplace density without implying capability.
  - Unconnected active providers show a `Connect` action.
  - Connected providers show status, overflow menu, MCP tool chips, `See more`, and **Use in automations**.

Connected Linear row behavior:

- Shows `Connected` status with a green indicator.
- Shows tool count and the first several MCP tool names as chips.
- `See more` expands the full tool manifest inline.
- Overflow menu includes refresh tools, reconnect, and disconnect. Admin-only actions are disabled or hidden for non-admin members.
- **Use in automations** is a switch. It controls whether automation runs can access Linear MCP tools while keeping the Linear installation intact.

Access control:

- All org members can view connector catalog, connection status, and available tools.
- Org admins can connect, reconnect, disconnect, refresh tools, and toggle **Use in automations**.

Post-connect behavior:

- The Linear OAuth callback redirects back to `/{slug}/connectors`.
- Linear appears connected and expanded inline.
- **Use in automations** is enabled by default.

## Backend Architecture

Connectors should be implemented as a generic org-level system with a Linear provider adapter.

Packages and ownership:

- `packages/connector-contract`
  - Provider ids, initially `linear`.
  - Connection status schema.
  - OAuth state schema.
  - Connector catalog metadata.
  - MCP tool manifest types.
  - tRPC input/output schemas that should be shared between `api/app` and `apps/app`.
- `packages/linear-app-node`
  - Linear OAuth URL construction.
  - Authorization code exchange.
  - Token refresh and revoke helpers.
  - Linear workspace/app actor metadata lookup.
  - MCP `listTools` support against a remote Streamable HTTP endpoint.
  - No app auth or database ownership.
- `db/app`
  - Generic connection table and repository helpers.
  - Token fields are encrypted before storage by API services.
- `api/app`
  - Org auth and admin gates.
  - Connector tRPC router.
  - OAuth callback finalization service.
  - Runtime connector loading for automations.
- `apps/app`
  - Connectors page and client components.
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

The table enforces at most one active connection per `clerkOrgId` and `provider`. Use the same nullable active-mirror pattern used by existing source-control bindings because MySQL does not support partial unique indexes.

Fields:

- `id`: internal bigint primary key.
- `clerkOrgId`: Clerk org id.
- `activeOrgProviderKey`: nullable uniqueness mirror, set only for active rows.
- `provider`: controlled code, initially `linear`.
- `status`: `active`, `disabled`, `revoked`, or `error`.
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
- `toolManifest`: JSON array of MCP tools.
- `enabledForAutomations`: boolean.
- `metadata`: provider-specific JSON object.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Repository helper responsibilities:

- Get active connection by org/provider.
- List catalog connection states for org.
- Finalize active connection, revoking or superseding previous active rows for the same org/provider.
- Update cached tool manifest.
- Toggle automation enablement.
- Mark revoked.
- Mark error with provider-safe metadata.

Sensitive fields:

- Access and refresh tokens must be encrypted with the existing app encryption path before persistence.
- Decrypted tokens should exist only inside server-side OAuth, refresh, and automation runtime code.
- Tokens must never be returned through tRPC.

## API Design

Add `org.connectors` under the existing `org` tRPC router.

Procedures:

- `list`
  - Member-readable.
  - Returns catalog entries plus connection state for the active org.
  - Includes cached tool manifest and `enabledForAutomations`.
  - Does not return tokens or sensitive metadata.
- `startConnect({ provider })`
  - Admin-only.
  - Creates signed OAuth state for the active org and user.
  - Returns provider authorization URL.
- `refreshTools({ provider })`
  - Admin-only in v1.
  - Calls provider MCP `listTools` with stored credentials and updates cached manifest.
- `setAutomationEnabled({ provider, enabled })`
  - Admin-only.
  - Updates `enabledForAutomations`.
- `disconnect({ provider })`
  - Admin-only.
  - Attempts upstream revoke when supported.
  - Marks the local connection revoked even if upstream revoke is already invalid.

OAuth callback:

- Add the app route `/api/connectors/linear/oauth/callback`.
- It validates signed state, exchanges the authorization code, fetches provider metadata, discovers tools, stores the connection, and redirects to `/{slug}/connectors`.
- It should call an internal service rather than exposing finalization as a public client mutation.

Error handling:

- Invalid or expired OAuth state redirects to `/{slug}/connectors?connector=linear&error=oauth_state`.
- Denied authorization redirects with `error=access_denied`.
- Token exchange failure redirects with `error=connect_failed` and logs the provider-safe diagnostic.
- MCP discovery failure should still store the connection only if the OAuth connection is valid. The row can be active with an empty manifest and an error diagnostic prompting refresh.

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

- Request org-level app actor access with `actor=app`.
- Request broad `read,write` scopes.
- Store granted scopes.
- Store refreshable OAuth tokens when Linear returns them.
- Refresh before expiry when refresh credentials are present.

MCP:

- Use the stored access token as `Authorization: Bearer <token>` when connecting to the configured MCP endpoint.
- Fetch actual tool list through MCP discovery.
- Cache the returned tool names/descriptions/input schemas as the tool manifest.

## Emulator and Local Dev

Add `emulators/linear`, modeled after `emulators/github`.

Package:

- Name: `@repo/linear-emulator`.
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
- `/mcp` route that validates emulator-issued Bearer tokens and exposes deterministic MCP tools.
- Reset route for e2e repeatability.

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
- Extend `apps/app` `with-related-projects` to evaluate:
  - `pnpm --silent --filter @repo/linear-emulator env:sh -- --app-origin "$(portless get app.lightfast)" --emulator-origin "$(portless get linear.lightfast)"`
- Inject the resulting `LINEAR_*` env into the app dev process.

Dev URL:

- Primary: `https://linear.lightfast.localhost`.
- Worktree-prefixed: `https://<wt>.linear.lightfast.localhost`.

Real Linear should not be required for local dev or e2e.

## Automation Runtime

For v1, enabled org connector connections are MCP tool sources for automations.

Runtime behavior:

- Load active connections for the org where `enabledForAutomations=true`.
- Decrypt tokens server-side inside the automation runtime.
- Create an MCP client per enabled connection using `mcpEndpoint`.
- Discover or use live tools at runtime.
- Expose all connector MCP tools. No Lightfast-side tool allowlist or denylist in v1.
- Call tools through the connector MCP server using the stored Bearer token.
- If a token is expired and refresh is available, refresh and persist new encrypted tokens.
- If refresh fails or the provider returns auth errors, mark the connection `error` and surface reconnect-needed diagnostics.

UI manifest vs runtime:

- `toolManifest` is UI metadata and should make the page fast and stable.
- Runtime should prefer live MCP discovery/calls so automations use the current provider behavior.

Boundary:

- Connectors do not gate org setup.
- Existing GitHub source-control binding remains the setup/source-control integration.
- Linear Connector is optional and only affects available automation tools.

## Security and Permissions

- Org admin gate for connect, reconnect, refresh tools, toggle automation use, and disconnect.
- Member-readable status and tool manifests.
- Signed OAuth state must include org id, user id, provider, return path, nonce, and expiry.
- OAuth callback must validate the signed state and ensure the user still has access to the org.
- Store tokens encrypted.
- Never expose raw tokens to React components, tRPC responses, logs, or telemetry.
- Log provider errors with redacted metadata.
- Disconnect should revoke upstream when possible and always mark the local row revoked.
- Tool calls are broad in v1 by product decision; policy controls are a future enhancement.

## Testing and Verification

Backend:

- DB schema tests for indexes, active uniqueness mirror, and table exports.
- Repository helper tests for finalize, revoke, toggle, manifest refresh, and active-row replacement.
- Connector contract tests for provider ids, OAuth state, and tool manifest parsing.
- Linear provider tests for OAuth URL construction, token exchange parsing, metadata parsing, and MCP tool parsing.
- tRPC router tests for member vs admin permissions and response redaction.

Emulator:

- OAuth authorize/token/revoke happy path.
- Invalid state/client/token behavior.
- MCP `/mcp` rejects missing or invalid Bearer tokens.
- MCP `/mcp` lists deterministic tools for valid tokens.
- Reset route restores seed data.

Frontend:

- Connectors page renders catalog rows.
- Linear unconnected state shows Connect for admins.
- Non-admin members cannot mutate connection state.
- Connected Linear expands with tools and enabled automation switch.
- Coming-soon rows are disabled and do not start provider flows.

Integration/e2e:

- Local `pnpm dev` starts Linear emulator through Portless.
- Connect Linear against emulator.
- Return to `/{slug}/connectors`.
- Verify cached tool manifest is shown.
- Toggle **Use in automations**.
- Disconnect marks connection revoked.

Quality gates:

- `pnpm --filter @repo/connector-contract test typecheck`
- `pnpm --filter @repo/linear-app-node test typecheck`
- `pnpm --filter @repo/linear-emulator test typecheck`
- `pnpm --filter @db/app test typecheck`
- `pnpm --filter @api/app test typecheck`
- `pnpm --filter @lightfast/app test typecheck`
- Broader `pnpm typecheck` when the implementation touches shared contracts or route types.

## Rollout Plan

1. Add contract and schema foundations.
2. Add Linear provider package.
3. Add Linear emulator and root dev wiring.
4. Add API services and tRPC router.
5. Add OAuth callback route.
6. Add Connectors page and sidebar navigation.
7. Add automation runtime connector loading.
8. Add focused tests.
9. Run local dev/e2e verification against the emulator.

## Future Enhancements

- Per-tool allowlists and denylists.
- Tool risk labeling.
- Audit log for connector tool calls.
- Provider-specific permission review before connect.
- Multiple active connections per provider when a provider has a workspace or project-level installation concept.
- More providers in the marketplace.
- Tool manifest diffing when providers add or remove tools.
