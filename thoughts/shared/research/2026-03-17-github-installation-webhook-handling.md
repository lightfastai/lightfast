---
date: 2026-03-17T00:00:00+00:00
researcher: claude
git_commit: 14ccc061157bc66ec3d63896fec0ad103168f84a
branch: test/relay-56b1211c
repository: lightfast
topic: "GitHub installation webhook handling and repository active/deleted state management"
tags: [research, codebase, relay, github, webhooks, installation, repositories, sources, m2m]
status: complete
last_updated: 2026-03-17
---

# Research: GitHub Installation Webhook Handling and Repository State Management

**Date**: 2026-03-17
**Git Commit**: `14ccc061157bc66ec3d63896fec0ad103168f84a`
**Branch**: `test/relay-56b1211c`

## Research Question

Two GitHub `installation` webhooks (both `action: "deleted"`, `installationId: 116729484`) passed through `apps/relay/`. We need to understand how these webhooks currently flow through the system, and how to maintain active/deleted state for repositories and installations.

---

## Summary

The relay correctly receives and HMAC-verifies GitHub `installation` events. However, they always route to DLQ because the relay's connection-resolution step looks up `gatewayResources` by `providerResourceId` (a repo ID), but an `installation` event has no `repository` — only an `installation.id`. The console ingress would also skip these events even if they arrived, since no transformer is registered for `eventType: "installation"`.

The database and M2M tRPC layer already have the full machinery to handle installation and repository deletion state (`markGithubInstallationInactive`, `markGithubDeleted`, `connectionTeardownWorkflow`). The gap is that no path exists connecting the relay's inbound `installation.deleted` webhook to that machinery.

---

## Detailed Findings

### 1. What the Relay Does With `installation` Events

**Acceptance and HMAC verification**: No event-type allowlist exists in the middleware. Any GitHub event type that passes `x-hub-signature-256` verification is accepted.
- `apps/relay/src/middleware/webhook.ts:206-246` — HMAC verify step
- `packages/console-providers/src/providers/github/index.ts:127-135` — GitHub `verifySignature`

**ResourceId extraction**: For a bare `installation` event (no `repository` object at the top level), `extractResourceId` returns `String(p.installation.id)`.
- `packages/console-providers/src/providers/github/index.ts:139-151`
- For the example webhook: `resourceId = "116729484"` (the installation ID)

**Workflow step 3 — `resolve-connection`**: Queries `gatewayResources` joined to `gatewayInstallations` filtering by `providerResourceId = resourceId AND status = "active"`.
- `apps/relay/src/routes/workflows.ts:89-143`
- `gatewayResources.providerResourceId` stores **repository IDs** (e.g., `"955790356"`), NOT installation IDs
- A lookup using an installation ID (`"116729484"`) will always miss → `connectionInfo = null`

**Routing to DLQ**: When `connectionInfo` is null, step 4 publishes to the `webhook-dlq` QStash topic and sets delivery status to `"dlq"`.
- `apps/relay/src/routes/workflows.ts:145-207`

**Console ingress would skip it anyway**: Even if a connection were somehow resolved, `transformEnvelope` dispatches to `transformWebhookPayload("github", "installation", ...)` → `resolveCategory("installation")` returns `"installation"` unchanged → no key `"installation"` in the GitHub `events` map → returns `null` → logged as `"[ingress] No transformer, skipping"`.
- `packages/console-providers/src/dispatch.ts:15-32`
- `packages/console-providers/src/providers/github/index.ts:93-118` (only `pull_request` and `issues` are registered)
- `apps/console/src/app/api/gateway/ingress/route.ts:71-79`

---

### 2. The `installation` Event Payload Shape

The webhook with `action: "deleted"` carries:
- `installation.id` — the GitHub App installation ID (`116729484`)
- `repositories[]` — **all repos** that were part of this installation at deletion time
  - Each entry: `{ id, node_id, name, full_name, private }`
- `sender` — the user who performed the deletion

This is distinct from `installation_repositories` (which fires when repos are added/removed from a live installation).

The `repositories` array is available in the raw `payload` stored in `gatewayWebhookDeliveries.payload`. The relay fixture confirms this structure:
- `apps/relay/src/__fixtures__/github-installation.json`

---

### 3. Existing State Management Machinery

#### Database — Status Fields

| Table | Column | Active State | Inactive State |
|---|---|---|---|
| `lightfast_gateway_installations` | `status` varchar(50) | `active` | `revoked` |
| `lightfast_gateway_resources` | `status` varchar(50) | `active` | `removed` |
| `lightfast_workspace_integrations` | `isActive` boolean | `true` | `false` |

No `deletedAt` timestamp exists anywhere. All deletion is represented through status transitions or `ON DELETE CASCADE` FK chains.

Files:
- `db/console/src/schema/tables/gateway-installations.ts:34`
- `db/console/src/schema/tables/gateway-resources.ts:29`
- `db/console/src/schema/tables/workspace-integrations.ts:76`

#### M2M tRPC Procedures (`api/console/src/router/m2m/sources.ts`)

All require `webhookM2MProcedure` auth (internal Clerk M2M client).

| Procedure | What It Does |
|---|---|
| `markGithubInstallationInactive` (line 189) | Joins `workspaceIntegrations` → `gatewayInstallations` on `externalId = githubInstallationId`. Batch-updates `isActive = false`, `lastSyncStatus = "failed"`, `lastSyncError = "GitHub installation removed or suspended"`. Fires `integration.disconnected` activity with `reason: "installation_removed"`. |
| `markGithubRepoInactive` (line 128) | Finds all active sources for a repo ID. Batch-updates `isActive = false`. Fires `integration.disconnected` with `reason: "repository_removed"`. |
| `markGithubDeleted` (line 269) | Finds all sources (not filtered by `isActive`) for a repo ID. Batch-updates `isActive = false`, `lastSyncStatus = "failed"`, `lastSyncError = "Repository deleted on GitHub"`. Fires `integration.deleted` with `reason: "repository_deleted"`. |

#### Connection Teardown Workflow (`apps/gateway/src/workflows/connection-teardown.ts:39-147`)

Triggered by `DELETE /connections/:provider/:id` in the gateway service. Four durable steps:
1. Cancel backfill
2. Revoke OAuth token (skipped for GitHub — uses on-demand JWTs)
3. Clean Redis routing cache (deletes `gw:resource:{provider}:{resourceId}` for all active resources)
4. Soft-delete: sets `gatewayInstallations.status = "revoked"` and all `gatewayResources.status = "removed"`

This workflow covers `gatewayInstallations` and `gatewayResources` but does NOT touch `workspaceIntegrations.isActive`. The `markGithubInstallationInactive` M2M procedure covers `workspaceIntegrations`.

---

### 4. What Currently Happens With Both Levels of GitHub Deletion

#### `installation` event (`action: "deleted"`)

The entire GitHub App installation is uninstalled.

- **Relay**: Accepts, HMAC-verifies, persists to `gatewayWebhookDeliveries`, then routes to DLQ (installation ID doesn't match any `gatewayResources.providerResourceId`)
- **Console**: Never reached
- **M2M layer**: `markGithubInstallationInactive` exists but is never called from this path
- **Result**: `gatewayInstallations.status` stays `"active"`, `workspaceIntegrations.isActive` stays `true`

#### `installation_repositories` event (`action: "removed"`)

Specific repos are removed from an existing installation.

- Same relay DLQ path applies (no `repository` at top level either)
- `markGithubRepoInactive` exists but is never called

#### `repository` event (`action: "deleted"`)

An individual repository is hard-deleted on GitHub.

- Relay routes this via `repository.id` → `gatewayResources.providerResourceId` lookup → may or may not find a connection
- `markGithubDeleted` exists but there's no registered transformer for `repository` events either (only `pull_request` and `issues`)

---

### 5. Redis Routing Cache Implications

The relay's routing cache (`gw:resource:{provider}:{resourceId}`) stores `{ connectionId, orgId }` keyed by repository ID. For installation-level events, there is no relevant cache entry since the cache is indexed by repo ID, not installation ID.

When `connectionTeardownWorkflow` runs (gateway's step 3), it cleans up these cache entries. But without a path from `installation.deleted` → teardown, stale cache entries persist until TTL (86400s).
- `apps/relay/src/routes/workflows.ts:104-118` — cache lookup
- `apps/gateway/src/workflows/connection-teardown.ts:104-122` — cache cleanup

---

## Code References

- `apps/relay/src/routes/workflows.ts:89-143` — `resolve-connection` step (queries by repo ID, not installation ID)
- `apps/relay/src/routes/workflows.ts:145-207` — `route` step (DLQ path when no connection found)
- `packages/console-providers/src/providers/github/index.ts:139-151` — `extractResourceId` (returns installation.id when no repository.id)
- `packages/console-providers/src/providers/github/index.ts:93-118` — GitHub events map (only pull_request and issues)
- `packages/console-providers/src/dispatch.ts:15-32` — transformer dispatch (returns null for unknown event types)
- `api/console/src/router/m2m/sources.ts:189` — `markGithubInstallationInactive`
- `api/console/src/router/m2m/sources.ts:128` — `markGithubRepoInactive`
- `api/console/src/router/m2m/sources.ts:269` — `markGithubDeleted`
- `apps/gateway/src/workflows/connection-teardown.ts:39` — `connectionTeardownWorkflow`
- `db/console/src/schema/tables/gateway-installations.ts:19` — `gatewayInstallations` schema
- `db/console/src/schema/tables/gateway-resources.ts:12` — `gatewayResources` schema
- `db/console/src/schema/tables/workspace-integrations.ts:32` — `workspaceIntegrations` schema

## Architecture Documentation

The relay's connection-resolution step is repo-centric: it treats `resourceId` as a repository identifier and routes accordingly. Installation-level events (which have `installation.id` but no `repository.id`) do not fit this model and always fall to DLQ.

The M2M tRPC layer has explicit handlers for each level of deletion (installation-level, repo-removal, repo-hard-delete) but these are never invoked from the relay/ingress pipeline. The connection teardown workflow handles the infrastructure side (installations + resources + Redis cache) but is only reachable via the gateway's HTTP DELETE endpoint, not from an inbound webhook.

## Open Questions

1. Should `installation.deleted` bypass the normal relay workflow and be handled directly at the relay level (before the DLQ step), or should it flow through to a new ingress transformer?
2. Should `installation_repositories.removed` trigger `markGithubRepoInactive` for each affected repo, or `connectionTeardownWorkflow` for the whole installation?
3. Should the gateway's `connectionTeardownWorkflow` be callable from within the relay workflow when an installation-level deletion is detected?
4. What is the expected UI state after installation deletion — should the connection show as "revoked" in `connections.list`, or should the workspace integrations just show inactive?
