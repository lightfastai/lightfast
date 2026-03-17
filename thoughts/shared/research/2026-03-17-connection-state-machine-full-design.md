---
date: 2026-03-17T00:00:00+00:00
researcher: claude
git_commit: 14ccc061157bc66ec3d63896fec0ad103168f84a
branch: test/relay-56b1211c
repository: lightfast
topic: "Complete connection state machine: all scenarios, status design, cross-provider teardown"
tags: [research, design, relay, gateway, github, vercel, linear, sentry, webhooks, installation, state-machine, workspace-integrations]
status: complete
last_updated: 2026-03-17
---

# Research: Complete Connection State Machine

**Date**: 2026-03-17
**Git Commit**: `14ccc061157bc66ec3d63896fec0ad103168f84a`
**Branch**: `test/relay-56b1211c`

## Research Question

Every possible connection lifecycle scenario across all providers. What states need to exist, how `connectionTeardownWorkflow` must be extended to handle provider-initiated lifecycle events (GitHub `installation.deleted`, etc.), and why `workspaceIntegrations.isActive` boolean should become a proper `status` enum that works for all providers.

---

## Current State Summary (as-is)

Three tables hold connection state:

| Table | Status Field | Current Values |
|---|---|---|
| `gatewayInstallations` | `status` varchar | `active \| pending* \| error \| revoked` |
| `gatewayResources` | `status` varchar | `active \| removed` |
| `workspaceIntegrations` | `isActive` boolean + `lastSyncStatus` varchar | `true/false` + `success\|failed\|pending` |

`* pending` is defined in schema comment but never written by any production code path.

The relay's connection-resolution step (`workflows.ts:89`) is repo-centric — it looks up `gatewayResources.providerResourceId`. Installation-level events (`installation.id`) never match and always go to DLQ.

---

## Complete Scenario Matrix

### GitHub

---

#### SCENARIO G-1: First-time GitHub App installation

**Trigger**: User clicks "Connect GitHub" in Lightfast console

**Flow**:
1. `GET /connections/github/authorize` → Redis `gw:oauth:state:<token>` written (TTL 600s)
2. User authorizes on GitHub
3. `GET /connections/github/callback` → `gatewayInstallations` upserted with `status: "active"`, `gatewayTokens` upserted (encrypted JWT)
4. Redis result key written: `gw:oauth:result:<state>`

**Tables affected**: `gatewayInstallations` (insert, `status: "active"`), `gatewayTokens` (insert)
**Status after**: installation `active`, no resources yet, no workspace integrations

---

#### SCENARIO G-2: User adds a repository as a source in a workspace

**Trigger**: User selects a repo in workspace setup or Sources page

**Flow**:
1. `POST /connections/:id/resources` (gateway) → `gatewayResources` upserted with `status: "active"`, Redis `gw:resource:github:<repoId>` set (no TTL)
2. `workspace.integrations.bulkLinkResources` (console tRPC) → `workspaceIntegrations` created with `isActive: true`

**Tables affected**: `gatewayResources` (insert, `status: "active"`), `workspaceIntegrations` (insert, `isActive: true`)
**Status after**: resource `active`, workspace integration `isActive: true`

---

#### SCENARIO G-3: User adds a second repo to the same installation

**Trigger**: User links another repo from the same GitHub installation

**Flow**: Same as G-2, new rows created for the new `providerResourceId`

---

#### SCENARIO G-4: User disconnects a specific repo in Lightfast UI

**Trigger**: User clicks "Disconnect" on a specific source in workspace

**Flow**:
1. `workspace.integrations.disconnect` (console tRPC) → `workspaceIntegrations.isActive = false`
2. `DELETE /connections/:id/resources/:resourceId` (gateway) → `gatewayResources.status = "removed"`, Redis `gw:resource:github:<repoId>` DEL

**Tables affected**: `workspaceIntegrations` (`isActive: false`), `gatewayResources` (`status: "removed"`)
**Redis affected**: `gw:resource:github:<repoId>` deleted
**Status after**: resource `removed`, workspace integration `isActive: false`
**✅ Fully handled**

---

#### SCENARIO G-5: User disconnects entire GitHub connection in Lightfast Settings

**Trigger**: User clicks "Disconnect" on GitHub in org-level Settings > Sources

**Flow**:
1. `connections.disconnect` (console tRPC `org/connections.ts:119`) → `gatewayInstallations.status = "revoked"` (direct DB write, `api/console/src/router/org/connections.ts:127`)
2. **No teardown workflow triggered from this path**

**Tables NOT touched**: `gatewayResources` (still `active`), `workspaceIntegrations` (`isActive` unchanged), `gatewayTokens` (row remains)
**Redis NOT touched**: `gw:resource:github:*` keys remain (stale routing cache)

**⚠️ Gap**: The relay will continue routing webhooks from these repos to the console for up to 86400s (Redis TTL). `workspaceIntegrations.isActive` remains `true`. The token row remains. This is the `connections.disconnect` tRPC vs `DELETE /connections/:provider/:id` gateway endpoint divergence.

---

#### SCENARIO G-6: GitHub App installation deleted BY USER ON GITHUB (not in Lightfast)

**Trigger**: User goes to GitHub.com → Settings → GitHub Apps → removes Lightfast

**GitHub fires**: `installation` webhook with `action: "deleted"`, `installation.id`, `repositories[]` (all repos that were part of this installation)

**Current relay flow**:
1. HMAC verified ✅
2. `extractResourceId` returns `String(installation.id)` (no `repository` field at top level)
3. `resolve-connection` step: looks up `gatewayResources` by `providerResourceId = installationId` → no match (resources are stored by REPO ID)
4. `route` step → DLQ ❌

**Tables NOT touched**: everything remains as-is
**❌ Not handled**

**What should happen**:
- Look up `gatewayInstallations` by `externalId = installation.id`
- Trigger `connectionTeardownWorkflow` with `reason: "provider_revoked"`
- Teardown workflow sets: `gatewayInstallations.status = "revoked"`, all `gatewayResources.status = "removed"`, Redis cleaned
- `workspaceIntegrations` for all repos in this installation → new status `"revoked"`

---

#### SCENARIO G-7: GitHub App installation SUSPENDED (GitHub Admin action)

**Trigger**: GitHub suspends the app installation (policy violation, billing, etc.)

**GitHub fires**: `installation` webhook with `action: "suspend"`

**Current relay flow**: Same DLQ path as G-6 ❌

**What should happen**:
- Look up installation by `externalId`
- Set `gatewayInstallations.status = "suspended"` ← new status value needed
- Do NOT revoke token (suspension is temporary, token may still be valid for re-auth)
- `workspaceIntegrations` → new status `"suspended"`
- On `action: "unsuspend"` → restore to `active`

---

#### SCENARIO G-8: Repositories added to existing installation via GitHub

**Trigger**: User goes to GitHub → GitHub App settings → adds more repos to the Lightfast installation

**GitHub fires**: `installation_repositories` webhook with `action: "added"`, `repositories_added[]`

**Current relay flow**: `eventType = "installation_repositories"`, `resourceId = installation.id` (no top-level `repository`) → DLQ ❌

**What should happen**:
- These repos are now accessible to Lightfast
- `gatewayResources` rows could be created proactively (optional — or wait for user to explicitly add)
- At minimum: surface them in the "add source" picker without requiring re-OAuth
- **Note**: Adding to `gatewayResources` here would require the gateway to handle this event

---

#### SCENARIO G-9: Repositories removed from existing installation via GitHub

**Trigger**: User goes to GitHub → GitHub App settings → removes specific repos from installation (installation still exists)

**GitHub fires**: `installation_repositories` webhook with `action: "removed"`, `repositories_removed[]`

**Current relay flow**: DLQ ❌

**What should happen**:
- For each repo in `repositories_removed`:
  - `gatewayResources.status = "removed"` where `providerResourceId = repo.id`
  - Redis `gw:resource:github:<repoId>` DEL
  - `workspaceIntegrations` for this repo → new status `"removed"` (resource removed from installation but installation active)

---

#### SCENARIO G-10: Repository deleted on GitHub (hard delete)

**Trigger**: User deletes a repository on GitHub

**GitHub fires**: `repository` event with `action: "deleted"`, `repository.id`

**Current relay flow**:
1. `resourceId = repo.id` (repository IS present in payload)
2. `resolve-connection` may find a match in `gatewayResources`
3. Console ingress: `transformWebhookPayload("github", "repository", ...)` → `resolveCategory("repository")` returns `"repository"` → `events["repository"]` = undefined → returns `null` → logged `"[ingress] No transformer, skipping"` ❌

**`markGithubDeleted` m2m procedure exists but is never called from the webhook pipeline**

**What should happen**:
- Gateway receives this event and routes it
- `gatewayResources.status = "removed"` where `providerResourceId = repo.id`
- Redis DEL
- `workspaceIntegrations` → new status `"deleted"`

---

#### SCENARIO G-11: Repository renamed on GitHub

**Trigger**: User renames a repo on GitHub

**GitHub fires**: `repository` event with `action: "renamed"`, `repository.id`, `repository.name` (new), `changes.repository.name.from` (old)

**Current relay flow**: Same as G-10 — console ingress skips ❌

**What should happen**:
- `gatewayResources.resourceName` updated to new name
- `workspaceIntegrations.providerConfig` may need updating if it stores the repo name
- **Note**: `providerResourceId` (numeric ID) stays the same — rename doesn't break the routing

---

#### SCENARIO G-12: GitHub App reinstalled after deletion (same installation ID)

**Trigger**: User uninstalls and reinstalls the GitHub App (GitHub often reuses the installation ID)

**GitHub fires**: `installation` with `action: "created"`, same `installation.id`

**Current relay flow**:
- OAuth callback flow handles reinstall via upsert on `(provider, externalId)` → `status: "active"` (`connections.ts:341`)
- The special GitHub fallback at `connections.ts:209` handles missing `state` param using `installation_id` query param

**Tables affected**: `gatewayInstallations` upserted `status: "active"`, `gatewayTokens` upserted
**✅ Partially handled** (OAuth flow covers it; `installation.created` webhook itself goes to DLQ but the user is redirected through OAuth anyway)

---

#### SCENARIO G-13: OAuth token expired, refresh succeeds

**Trigger**: Internal API call via gateway proxy

**Flow**: `forceRefreshToken()` at `connections.ts:595` → `providerDef.oauth.refreshToken()` → `updateTokenRecord()` writes new `accessToken` + `expiresAt` to `gatewayTokens`

**✅ Handled** (GitHub doesn't use stored tokens so this is moot for GitHub, but applies to other providers)

---

#### SCENARIO G-14: OAuth 401 — token invalid, refresh fails

**Trigger**: `GET /connections/:id/proxy/execute` receives 401 from upstream, refresh also fails

**Flow**: Currently only `connections.generic.listResources` (`connections.ts:577`) writes `status = "error"` on 401. The proxy route itself does not update status.

**⚠️ Partial**: installation marked `error` only in the resource-listing path, not on general proxy 401s

---

### Vercel

---

#### SCENARIO V-1: First-time Vercel connection

Same as G-1 flow. `gatewayInstallations` upserted `status: "active"`.
**✅ Handled**

#### SCENARIO V-2: User links a Vercel project to a workspace

`workspace.integrations.linkVercelProject` → `workspaceIntegrations` created/updated with `isActive: true`.
**✅ Handled**

#### SCENARIO V-3: User unlinks a Vercel project in Lightfast

`workspace.integrations.unlinkVercelProject` → `workspaceIntegrations.isActive = false`
**✅ Handled** (though `gatewayResources` is not touched for Vercel in this path)

#### SCENARIO V-4: User disconnects Vercel entirely in Lightfast

`connections.vercel.disconnect` → `gatewayInstallations.status = "revoked"` (direct DB write, no teardown workflow).
Same gap as G-5: resources and workspace integrations untouched.
**⚠️ Gap**

#### SCENARIO V-5: Vercel integration removed ON VERCEL

**Vercel fires**: `integration-configuration.removed` webhook

**Current relay flow**: `eventType = "integration-configuration.removed"` → `resolveCategory` strips to `"integration-configuration"` → no matching resource lookup by this event type → DLQ ❌

**What should happen**: Same as G-6 — trigger teardown, mark `workspaceIntegrations` revoked

#### SCENARIO V-6: Vercel project deleted

**Vercel fires**: `project.removed` webhook

**Current relay flow**: `resolveCategory` strips to `"project"` → `events["project"]` = undefined → skipped ❌

**What should happen**: Mark specific `workspaceIntegrations` as `"deleted"`, remove `gatewayResources` row

---

### Linear

#### SCENARIO L-1 through L-3: Connect, link, unlink

Same pattern as Vercel. `workspaceIntegrations.isActive` is the toggle.
**✅ Handled**

#### SCENARIO L-4: OAuth token revoked on Linear

Linear does not fire a webhook when OAuth is revoked. Discovery only happens on next API call (401 → `status: "error"` in the resource-listing path).
**⚠️ Passive detection only**

#### SCENARIO L-5: Linear workspace/project deleted

`Project.deleted` event IS in the Linear `events` map (`linear/index.ts:228`). Has a transformer.
**✅ Flows through relay → console ingress** (but no handler in Inngest that marks `workspaceIntegrations` inactive)

---

### Sentry

#### SCENARIO S-1 through S-3: Connect, link, unlink

Same pattern. `workspaceIntegrations.isActive` toggle.
**✅ Handled**

#### SCENARIO S-4: Sentry app uninstalled

**Sentry fires**: `installation.deleted` event (via `sentry-hook-resource: installation` header)

**Current relay flow**: `eventType = "installation"` → `events["installation"]` undefined → skipped ❌

**What should happen**: Same as G-6

---

## Status Design: `isActive` Boolean → `status` Enum

### Why boolean is insufficient

Currently `isActive: false` conflates five different states that have different UX implications and reactivation paths:

| Scenario | Current | What the user sees |
|---|---|---|
| User disconnected it | `isActive: false` | No context why |
| Provider revoked installation | `isActive: false` | No context why |
| Provider suspended installation | `isActive: false` | No context why |
| Repo removed from installation | `isActive: false` | No context why |
| Repo hard-deleted on GitHub | `isActive: false` | No context why |

`lastSyncError` text strings like `"GitHub installation removed or suspended"` carry this context today but are never surfaced in the UI (the column is never selected in any tRPC query response).

### Proposed `workspaceIntegrations.status` enum

```ts
type WorkspaceIntegrationStatus =
  | "active"        // syncing normally
  | "disconnected"  // user removed this source in Lightfast (can re-link)
  | "revoked"       // provider-side: installation deleted/uninstalled
  | "removed"       // resource removed from installation, but installation still active
  | "deleted"       // resource hard-deleted on provider (repo deleted, project deleted)
  | "suspended"     // installation temporarily suspended by provider
  | "error"         // auth failure / repeated sync errors
```

### Cross-provider applicability

| Status | GitHub trigger | Vercel trigger | Linear trigger | Sentry trigger |
|---|---|---|---|---|
| `active` | repo linked | project linked | org linked | org linked |
| `disconnected` | user removes source in Lightfast | user unlinks project | user disconnects | user disconnects |
| `revoked` | `installation.deleted` webhook | `integration-configuration.removed` webhook | OAuth revoked (passive) | `installation.deleted` webhook |
| `removed` | `installation_repositories.removed` webhook | N/A | N/A | N/A |
| `deleted` | `repository.deleted` webhook | `project.removed` webhook | `Project.deleted` webhook | N/A |
| `suspended` | `installation.suspend` webhook | N/A | N/A | N/A |
| `error` | 401 on API, persistent sync failure | 401 on API | 401 on API | 401 on API |

### Migration from `isActive`

Old writes and their new status equivalents:

| Old write | By | New status |
|---|---|---|
| `isActive = false` via `markGithubInstallationInactive` | GitHub `installation.deleted` webhook | `"revoked"` |
| `isActive = false` via `markGithubRepoInactive` | repo removed from installation | `"removed"` |
| `isActive = false` via `markGithubDeleted` | repo deleted on GitHub | `"deleted"` |
| `isActive = false` via `workspace.integrations.disconnect` | user action in Lightfast | `"disconnected"` |
| `isActive = false` via `workspace.integrations.unlinkVercelProject` | user action in Lightfast | `"disconnected"` |
| `isActive = true` (insert/update) | user links source | `"active"` |

`lastSyncStatus` and `lastSyncError` columns can be retained for sync-specific state, but the primary connection lifecycle state should live in `status`.

### UI implications

| Status | Indicator | User message |
|---|---|---|
| `active` | Green dot | — |
| `disconnected` | Grey | "Disconnected by you" |
| `revoked` | Red | "GitHub App was uninstalled — reconnect GitHub" |
| `removed` | Orange | "Removed from GitHub App — re-add repo to app" |
| `deleted` | Red | "Repository was deleted on GitHub" |
| `suspended` | Amber | "GitHub App suspended" |
| `error` | Red | "Sync error — check connection" |

---

## `connectionTeardownWorkflow` — Required Changes

### Current 4-step flow

1. `cancel-backfill` — QStash to backfill service
2. `revoke-token` — OAuth token revocation (skipped for GitHub)
3. `cleanup-cache` — Redis `gw:resource:*` DEL for all active resources
4. `soft-delete` — `gatewayInstallations.status = "revoked"`, all `gatewayResources.status = "removed"`

### Missing: workspace integrations update

The workflow currently never touches `workspaceIntegrations`. Step 4 sets `gatewayInstallations.status = "revoked"` but leaves all `workspaceIntegrations.isActive = true`.

### Required additions

**Payload extension**: Add `reason` to `TeardownPayload`:

```ts
type TeardownPayload = {
  installationId: string
  orgId: string
  provider: SourceType
  reason: "user_disconnect" | "provider_revoked" | "provider_suspended" | "provider_repo_removed" | "provider_repo_deleted"
  // for partial teardowns (repo-level events):
  resourceIds?: string[]  // providerResourceIds — if present, only affect these resources
}
```

**New step 3.5 — `update-workspace-integrations`** (between cache cleanup and soft-delete):

```
For full teardown (no resourceIds):
  UPDATE workspaceIntegrations
  SET status = mapTeardownReasonToStatus(reason)   // revoked | suspended
  JOIN gatewayInstallations ON installationId
  WHERE gatewayInstallations.id = installationId

For partial teardown (resourceIds present):
  UPDATE workspaceIntegrations
  SET status = mapTeardownReasonToStatus(reason)   // removed | deleted
  WHERE installationId = installationId
    AND providerResourceId IN (resourceIds)
```

**Step 4 modification** for suspension:

When `reason === "provider_suspended"`:
- Set `gatewayInstallations.status = "suspended"` (not `"revoked"`)
- Do NOT set `gatewayResources.status = "removed"` (resources still exist, just inaccessible)
- Step 2 (revoke token) should also be skipped for suspension

**Unsuspend path**: New gateway endpoint or workflow that sets `status = "active"` back on both `gatewayInstallations` and `workspaceIntegrations` when `installation.unsuspend` fires.

### Relay routing change

In `apps/relay/src/routes/workflows.ts`, the `route` step (currently: null connectionInfo → DLQ) needs a new branch:

```
if eventType is in ["installation", "installation_repositories"] AND provider === "github":
  → route to gateway instead of DLQ or console
  → publish to ${gatewayUrl}/webhooks/github/installation
  → payload: { action, installationId, repositories? }

if eventType === "repository" AND action === "deleted" AND provider === "github":
  → route to gateway
  → payload: { action: "deleted", repositoryId, installationId? }
```

For Vercel (`integration-configuration.removed`, `project.removed`) and Sentry (`installation.deleted`):
- Same pattern — detect these lifecycle event types in the relay route step and forward to gateway

### New gateway endpoint

```
POST /webhooks/:provider/lifecycle
```

Receives installation-level and resource-level lifecycle events from the relay. Determines teardown scope and triggers `connectionTeardownWorkflow` with the appropriate `reason` and `resourceIds`.

For GitHub `installation.deleted`:
- Look up `gatewayInstallations` by `externalId = installationId`
- Trigger full teardown with `reason: "provider_revoked"`

For GitHub `installation.suspend`:
- Trigger teardown with `reason: "provider_suspended"` (different behavior in workflow)

For GitHub `installation.unsuspend`:
- Reactivate: `gatewayInstallations.status = "active"`, `workspaceIntegrations.status = "active"` for all in this installation

For GitHub `installation_repositories.removed`:
- For each `repo.id` in `repositories_removed`: trigger partial teardown with `reason: "provider_repo_removed"`, `resourceIds: [repo.id]`

For GitHub `repository.deleted`:
- Partial teardown `reason: "provider_repo_deleted"`, `resourceIds: [repository.id]`

For Vercel `integration-configuration.removed`:
- Full teardown `reason: "provider_revoked"`

For Sentry `installation.deleted`:
- Full teardown `reason: "provider_revoked"`

---

## Current State Gaps Summary

| Gap | Impact | Affected Scenarios |
|---|---|---|
| `installation.deleted` webhook goes to DLQ | Installation stays `active` after GitHub uninstall | G-6, S-4 |
| `installation_repositories.removed` goes to DLQ | Resources stay `active` after GitHub App repo removal | G-9 |
| `repository.deleted` has no transformer | Repo stays `active` after GitHub deletion | G-10 |
| `connections.disconnect` tRPC doesn't call teardown workflow | Redis stale, resources not soft-deleted | G-5, V-4 |
| `connectionTeardownWorkflow` never touches `workspaceIntegrations` | UI sources don't reflect teardown | All teardown scenarios |
| `workspaceIntegrations.isActive` boolean can't distinguish revoke reasons | UI can't explain why source is inactive | All inactive scenarios |
| `gatewayInstallations` has no `suspended` status | Can't model temporary suspension | G-7 |
| `gatewayTokens` never cleaned up in soft-delete | Stale encrypted tokens accumulate | All teardown scenarios |
| `pending` status defined in schema comment but never written | Unused status value | G-1 (should use pending during OAuth flow?) |

---

## Code References

- `apps/relay/src/routes/workflows.ts:89-207` — resolve-connection and route steps (where lifecycle event detection needs adding)
- `apps/gateway/src/workflows/connection-teardown.ts:39-147` — current 4-step teardown
- `apps/gateway/src/routes/connections.ts:968-1001` — `DELETE /connections/:provider/:id` (teardown trigger)
- `apps/gateway/src/routes/connections.ts:119-145` — `connections.disconnect` tRPC (direct DB write, no teardown)
- `api/console/src/router/m2m/sources.ts:189-261` — `markGithubInstallationInactive` (touches `workspaceIntegrations` but never called from webhook pipeline)
- `api/console/src/router/m2m/sources.ts:128-177` — `markGithubRepoInactive`
- `api/console/src/router/m2m/sources.ts:269-335` — `markGithubDeleted`
- `db/console/src/schema/tables/workspace-integrations.ts:32-118` — current schema (`isActive` boolean)
- `db/console/src/schema/tables/gateway-installations.ts:34` — `status` column (comment shows `active|pending|error|revoked`)
- `packages/console-providers/src/providers/github/index.ts:139-151` — `extractResourceId` (returns installation.id when no repo.id)
- `packages/console-providers/src/providers/vercel/index.ts:344-356` — Vercel lifecycle event strings
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx:209-306` — current UI status rendering (only green/amber, ignores `lastSyncStatus`)
