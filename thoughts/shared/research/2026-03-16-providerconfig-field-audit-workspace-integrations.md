---
date: 2026-03-16T00:00:00+11:00
researcher: claude
git_commit: adbb5d8f6c604bb524899e9d56be034d30da3f75
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "providerConfig field audit — workspace-integrations vs gateway-installations"
tags: [research, codebase, workspace-integrations, gateway-installations, providerConfig, schema, drizzle]
status: complete
last_updated: 2026-03-16
---

# Research: `providerConfig` Field Audit — Workspace Integrations vs Gateway Installations

**Date**: 2026-03-16
**Git Commit**: `adbb5d8f6c604bb524899e9d56be034d30da3f75`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

The `providerConfig` JSONB on `lightfast_workspace_integrations` contains stale fields from old data (example: `sync.paths`, `sync.branches`) and fields that are redundant with existing columns on `workspaceIntegrations` or with data available via a JOIN to `lightfast_gateway_installations`. The goal of this research is to:

1. Re-evaluate every field in `workspace-integrations` against `gateway-installations`
2. Identify all redundant fields (drop candidates)
3. Document all consumers so a cleanup plan can be written

---

## Summary

`workspaceIntegrations.providerConfig` currently contains a superset of what the Zod schema requires — old data has stale `sync.paths` and `sync.branches` fields that were removed from `syncSchema`. Beyond the stale data, several fields stored inside the JSONB are already captured as first-class columns on `workspaceIntegrations` itself (`sourceType` → `provider`, primary resource ID → `providerResourceId`) and can be dropped from the JSONB. Vercel-specific `teamId` and `configurationId` inside `providerConfig` are derived from `gatewayInstallations.providerAccountInfo.raw` at insert time — they are copies of installation-level data.

`workspaceIntegrations.connectedBy` duplicates `gatewayInstallations.connectedBy` — the auth middleware already traverses the FK to read the installation's `connectedBy` for ownership checks.

There are exactly **two JOIN queries** between the tables today, both using `workspaceIntegrations.installationId = gatewayInstallations.id`.

---

## Detailed Findings

### 1. Current `providerConfig` Schema (actual Zod, not old data)

**File**: `packages/console-providers/src/types.ts:16-19` — `syncSchema`
```typescript
export const syncSchema = z.object({
  events:   z.array(z.string()).optional(),
  autoSync: z.boolean(),
});
```

The current `syncSchema` has **only `events` and `autoSync`**. The old example data contains `sync.paths` and `sync.branches` which are **not in the current schema** — these are vestigial fields from an older schema version that lingers in database rows.

#### GitHub `providerConfig` variant
**File**: `packages/console-providers/src/providers/github/auth.ts:70-85`

| Field | Type | Currently stored in |
|---|---|---|
| `version` | `z.literal(1)` | `providerConfig` only |
| `sourceType` | `z.literal("github")` | `providerConfig` **AND** `workspaceIntegrations.provider` **AND** `gatewayInstallations.provider` |
| `type` | `z.literal("repository")` | `providerConfig` only |
| `repoId` | `z.string()` | `providerConfig` **AND** `workspaceIntegrations.providerResourceId` |
| `sync.events` | `z.array(z.string()).optional()` | `providerConfig` only |
| `sync.autoSync` | `z.boolean()` | `providerConfig` only |
| `status.configStatus` | `z.enum([...]).optional()` | `providerConfig` only |
| `status.configPath` | `z.string().optional()` | `providerConfig` only |
| `status.lastConfigCheck` | `z.string().optional()` | `providerConfig` only |

**Stale fields in old data (not in schema)**:
- `sync.paths` — removed from `syncSchema`, lingers in old rows
- `sync.branches` — removed from `syncSchema`, lingers in old rows

#### Vercel `providerConfig` variant
**File**: `packages/console-providers/src/providers/vercel/auth.ts:57-67`

| Field | Type | Currently stored in |
|---|---|---|
| `version` | `z.literal(1)` | `providerConfig` only |
| `sourceType` | `z.literal("vercel")` | `providerConfig` **AND** `workspaceIntegrations.provider` |
| `type` | `z.literal("project")` | `providerConfig` only |
| `projectId` | `z.string()` | `providerConfig` **AND** `workspaceIntegrations.providerResourceId` |
| `teamId` | `z.string().optional()` | `providerConfig` — derived from `gatewayInstallations.providerAccountInfo.raw.team_id` at insert |
| `configurationId` | `z.string()` | `providerConfig` — derived from `gatewayInstallations.providerAccountInfo.raw.installation_id` at insert |
| `sync.events` | `z.array(z.string()).optional()` | `providerConfig` only |
| `sync.autoSync` | `z.boolean()` | `providerConfig` only |

#### Linear `providerConfig` variant
**File**: `packages/console-providers/src/providers/linear/auth.ts:57-63`

| Field | Type | Currently stored in |
|---|---|---|
| `version` | `z.literal(1)` | `providerConfig` only |
| `sourceType` | `z.literal("linear")` | `providerConfig` **AND** `workspaceIntegrations.provider` |
| `type` | `z.literal("team")` | `providerConfig` only |
| `teamId` | `z.string()` | `providerConfig` **AND** `workspaceIntegrations.providerResourceId` (same value) |
| `sync.events` | `z.array(z.string()).optional()` | `providerConfig` only |
| `sync.autoSync` | `z.boolean()` | `providerConfig` only |

#### Sentry `providerConfig` variant
**File**: `packages/console-providers/src/providers/sentry/auth.ts:79-87`

| Field | Type | Currently stored in |
|---|---|---|
| `version` | `z.literal(1)` | `providerConfig` only |
| `sourceType` | `z.literal("sentry")` | `providerConfig` **AND** `workspaceIntegrations.provider` |
| `type` | `z.literal("project")` | `providerConfig` only |
| `projectId` | `z.string()` | `providerConfig` **AND** `workspaceIntegrations.providerResourceId` (same value) |
| `sync.events` | `z.array(z.string()).optional()` | `providerConfig` only |
| `sync.autoSync` | `z.boolean()` | `providerConfig` only |

---

### 2. Column-Level Overlap: `workspaceIntegrations` vs `gatewayInstallations`

#### `workspaceIntegrations.provider`
- **Overlap**: `gatewayInstallations.provider` (same value)
- **Current status**: Kept as denormalized fast-filter column. Comment in schema: `"Denormalized provider for fast filtering (replaces providerConfig.sourceType join)"`. Already serves as the replacement for reading `providerConfig.sourceType`.
- **Verdict**: **Keep** — intentional denormalization for query performance. The alternative (always JOINing) would be slower for the common `WHERE provider = 'github'` filter.

#### `workspaceIntegrations.connectedBy`
- **Overlap**: `gatewayInstallations.connectedBy` (same Clerk user ID)
- **How it's written**: Both are written as `ctx.auth.userId` at the same time, from the same procedure call.
- **How it's read for auth**: `packages/console-auth-middleware/src/resources.ts:110-154` — auth middleware traverses `workspaceIntegrations → gatewayInstallations.connectedBy`. It does **not** read `workspaceIntegrations.connectedBy` for auth decisions.
- **Verdict**: **Redundant** — `workspaceIntegrations.connectedBy` is written but never read back for auth, display, or filtering. The truth lives on `gatewayInstallations.connectedBy`.

#### `workspaceIntegrations.isActive`
- **Possible overlap**: `gatewayInstallations.status` (active/pending/error/revoked)
- **Verdict**: **Different semantics** — `gatewayInstallations.status` is the OAuth installation health; `workspaceIntegrations.isActive` is "is this resource connected to this workspace". A single installation can have many workspace integrations, some active and some deactivated. These are not equivalent.

#### `workspaceIntegrations.providerConfig` JSONB
Full field-level analysis above. Summary of drop candidates:
- `sourceType` — already `workspaceIntegrations.provider` column
- Primary resource ID (`repoId`/`projectId`/`teamId`) — already `workspaceIntegrations.providerResourceId` column
- `version` — never read for logic, vestigial schema marker
- Vercel `teamId` and `configurationId` — copies of `gatewayInstallations.providerAccountInfo.raw.*`

---

### 3. `gatewayInstallations` Fields NOT on `workspaceIntegrations`

These live on `gatewayInstallations` and have no equivalent on `workspaceIntegrations` — consumers that need these must JOIN:

| Field | Purpose |
|---|---|
| `externalId` | Provider-assigned installation ID (e.g., GitHub App installation integer) |
| `status` | Installation health: active/pending/error/revoked |
| `webhookSecret` | HMAC secret for webhook signature verification |
| `providerAccountInfo` | Full OAuth account metadata: `events`, `installedAt`, `lastValidatedAt`, `raw.*` |
| `backfillConfig` | Backfill depth + entityTypes — read by `notifyBackfill` and returned in `sources.list` |
| `orgId` | Org ownership — used for auth in gateway routes |
| `metadata` | Generic JSONB metadata (untyped) |

---

### 4. Active Consumers of `providerConfig` Fields

#### Fields actively read from `providerConfig`

| Field | Consumer | File:Line |
|---|---|---|
| `providerConfig.sync.events` | Event filtering (isEventAllowed) | `api/console/src/inngest/workflow/neural/event-store.ts:301-309` |
| `providerConfig.sync.events` | UI display (event count badge) | `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx:233` |
| `providerConfig.sourceType` | Type-narrowing guard for GitHub-specific ops | `api/console/src/router/m2m/sources.ts:77,115,291,300,369` |
| `providerConfig.sourceType` | Idempotency check in workspace create | `api/console/src/router/user/workspace.ts:217` |
| `providerConfig.repoId` | Idempotency check (match existing GitHub source) | `api/console/src/router/user/workspace.ts:217` |
| `providerConfig` (full object) | Returned as `metadata` and `resourceData` in sources.list | `api/console/src/router/org/workspace.ts:394,399` |
| `providerConfig` (full object) | Spread + mutate for `markGithubDeleted` | `api/console/src/router/m2m/sources.ts:291-300` |
| `providerConfig` (full object) | Spread + patch `sync.events` for `updateEvents` | `api/console/src/router/org/workspace.ts:690-705` |
| Provider-specific fields | Debug inject-event context | `apps/console/src/app/api/debug/inject-event/_lib/context.ts:11-44` |

#### `providerConfig.sourceType` usage pattern
Every consumer that reads `sourceType` from `providerConfig` is performing a type-narrowing check to access provider-specific fields. Since `workspaceIntegrations.provider` already holds this value as an indexed column, these consumers could read `provider` from the column instead.

#### `providerConfig.repoId` usage pattern
Only one consumer reads `repoId` directly (`user/workspace.ts:217`) for idempotency matching. Since `providerResourceId` holds the same value, this can use `providerResourceId` instead.

---

### 5. Existing JOIN Patterns

There are exactly **two** JOIN queries between `workspaceIntegrations` and `gatewayInstallations` in the codebase:

**JOIN 1**: `api/console/src/router/org/workspace.ts:344-368` (`workspace.sources.list`)
- Type: INNER JOIN
- Key: `workspaceIntegrations.installationId = gatewayInstallations.id`
- Fields pulled from `gatewayInstallations`: `backfillConfig` only
- Purpose: Expose backfill config alongside source list for the Sources UI

**JOIN 2**: `api/console/src/router/m2m/sources.ts:203-213` (`sources.markGithubInstallationInactive`)
- Type: INNER JOIN
- Key: `workspaceIntegrations.installationId = gatewayInstallations.id`
- Fields pulled from `gatewayInstallations`: none (join is for WHERE filtering only — `externalId + provider`)
- Purpose: Bulk-deactivate all workspace integrations belonging to a GitHub App installation by its `externalId`

---

### 6. `providerConfig` Write Sites

All insert/update sites that construct `providerConfig`:

| Site | File:Line | How providerConfig is built |
|---|---|---|
| `workspace.sources.list` (update sync) | `user/workspace.ts:224-236` | Spread existing + patch `sync` block |
| `workspace.create` (GitHub attach, insert) | `user/workspace.ts:240-257` | Inline object (no `buildProviderConfig`) |
| `linkVercelProject` (insert) | `org/workspace.ts:586-597` | Inline object using `providerAccountInfo.raw` |
| `bulkLinkResources` (insert) | `org/workspace.ts:854-870` | `PROVIDERS[provider].buildProviderConfig(...)` factory |
| `updateEvents` (patch) | `org/workspace.ts:690-705` | Spread existing + patch `sync.events` |
| `markGithubDeleted` (patch) | `m2m/sources.ts:291-308` | Spread existing + add `isArchived: true` |

The `buildProviderConfig` factory in each provider's `index.ts` builds the full discriminated union object including `sourceType`, `repoId`/`projectId`/`teamId`, `version`, `type`, and `sync.*`. The `user/workspace.ts` create path constructs the GitHub object inline and does NOT call `buildProviderConfig`.

---

### 7. Fields That Are Unique to `providerConfig` (No Equivalent Elsewhere)

These fields exist ONLY in `providerConfig` and have active consumers:

| Field | Provider | Consumer |
|---|---|---|
| `sync.events` | All | `event-store.ts` (event gate), `installed-sources.tsx` (UI), `updateEvents` mutation |
| `sync.autoSync` | All | Written at connect time, surfaced via `providerConfig` as `metadata` |
| `type` | All | Resource type discriminant (repository/project/team) — surfaced as `resourceData.type` |
| `status.configStatus` | GitHub | Config file detection result (from `connections.github.detectConfig`) |
| `status.configPath` | GitHub | Path to detected config file |
| `status.lastConfigCheck` | GitHub | Timestamp of last config scan |
| `configurationId` | Vercel | Vercel integration configuration ID (copy of `raw.installation_id`) |
| `teamId` | Vercel | Vercel team ID (copy of `raw.team_id`) — also needed for proxy calls per-project |

---

## Code References

- `db/console/src/schema/tables/workspace-integrations.ts:36-136` — Full table definition
- `db/console/src/schema/tables/gateway-installations.ts:19-81` — Full table definition
- `packages/console-providers/src/types.ts:16-19` — `syncSchema` (current: events + autoSync only)
- `packages/console-providers/src/providers/github/auth.ts:70-85` — `githubProviderConfigSchema`
- `packages/console-providers/src/providers/vercel/auth.ts:57-67` — `vercelProviderConfigSchema`
- `packages/console-providers/src/providers/linear/auth.ts:57-63` — `linearProviderConfigSchema`
- `packages/console-providers/src/providers/sentry/auth.ts:79-87` — `sentryProviderConfigSchema`
- `packages/console-providers/src/registry.ts:144-151` — `providerConfigSchema` discriminated union
- `api/console/src/router/org/workspace.ts:344-368` — JOIN query #1 (sources.list)
- `api/console/src/router/org/workspace.ts:688-708` — `updateEvents` mutation
- `api/console/src/router/m2m/sources.ts:195-213` — JOIN query #2 (markGithubInstallationInactive)
- `api/console/src/inngest/workflow/neural/event-store.ts:63-71` — `isEventAllowed()` — reads `sync.events`
- `packages/console-auth-middleware/src/resources.ts:110-154` — ownership auth via `gatewayInstallations.connectedBy`

---

## Field-by-Field Verdict Table

### `workspaceIntegrations` columns

| Column | Overlap? | Verdict |
|---|---|---|
| `id` | No | Keep |
| `workspaceId` | No | Keep |
| `installationId` | No (FK) | Keep |
| `provider` | Yes — `gatewayInstallations.provider` | **Keep** (intentional denorm, fast filter) |
| `connectedBy` | Yes — `gatewayInstallations.connectedBy` | **Drop candidate** — never read for auth/display |
| `providerConfig` | Partial | **Slim down** (see below) |
| `providerResourceId` | No | Keep (indexed, performance-critical) |
| `isActive` | No (`status` has different semantics) | Keep |
| `lastSyncedAt` | No | Keep |
| `lastSyncStatus` | No | Keep |
| `lastSyncError` | No | Keep |
| `documentCount` | No | Keep |
| `connectedAt` | No | Keep |
| `createdAt` | No | Keep |
| `updatedAt` | No | Keep |

### `providerConfig` JSONB fields

| Field | Redundant with | Verdict |
|---|---|---|
| `sourceType` | `workspaceIntegrations.provider` column | **Drop from JSONB** — use column |
| `repoId` / `projectId` / `teamId` (when == providerResourceId) | `workspaceIntegrations.providerResourceId` | **Drop from JSONB** — use column |
| `version` | Nothing (vestigial) | **Drop from JSONB** — never used for logic |
| `type` (resource type string) | Nothing | **Keep** — unique metadata |
| `sync.events` | Nothing | **Keep** — active consumer in event-store |
| `sync.autoSync` | Nothing | **Keep** — workspace-level sync toggle |
| `sync.paths` | Nothing | **Already removed from schema** — stale in old data, data migration needed |
| `sync.branches` | Nothing | **Already removed from schema** — stale in old data, data migration needed |
| `status.configStatus` | Nothing | **Keep** — GitHub config detection result |
| `status.configPath` | Nothing | **Keep** |
| `status.lastConfigCheck` | Nothing | **Keep** |
| Vercel `configurationId` | `gatewayInstallations.providerAccountInfo.raw.installation_id` | **Keep for now** — needed for per-project proxy calls; Vercel API calls use it |
| Vercel `teamId` (in config) | `gatewayInstallations.providerAccountInfo.raw.team_id` | **Keep for now** — needed alongside projectId for Vercel API routing |

---

## Architecture Documentation

### Join pattern (current and recommended)

All consumers of `workspaceIntegrations` that need installation-level data (e.g., `backfillConfig`, `externalId`, `providerAccountInfo`) already do so via `INNER JOIN gatewayInstallations ON workspaceIntegrations.installationId = gatewayInstallations.id`. The FK `installationId` is the universal join key.

The `provider` denormalization exists specifically to avoid a JOIN just to filter by provider. This pattern should be preserved.

### What `providerConfig` should contain after cleanup

```typescript
// After dropping redundant fields, providerConfig becomes purely:
// - Resource type string (type: "repository"|"project"|"team")
// - Workspace-scoped sync preferences (sync.events, sync.autoSync)
// - GitHub: config file status (status.*)
// - Vercel: teamId + configurationId (needed for Vercel API proxy calls per-project)

// All discriminant info (sourceType, primary resource ID) lives in columns,
// not in the JSONB.
```

---

## Open Questions

1. **Vercel `teamId` / `configurationId`**: Are these used in the Vercel proxy call path (gateway `POST /connections/:id/proxy/execute`)? If the proxy endpoint takes the resource as a parameter and the gateway looks up `gatewayResources` for this data, these could also be dropped. Needs further investigation of `apps/gateway/src/routes/connections.ts` Vercel proxy path.

2. **`workspaceIntegrations.connectedBy` drop**: If dropped, the `connectedBy` index (`workspace_source_connected_by_idx`) also goes away. Confirm no query filters by `workspaceIntegrations.connectedBy` before dropping.

3. **Data migration for `sync.paths` / `sync.branches`**: Old rows have these stale keys in the JSONB. A migration to strip them would clean up the data. Since Zod uses `.passthrough()` at runtime these are silently retained.

4. **`isArchived` mutation**: `markGithubDeleted` writes `providerConfig.isArchived = true` as a mutation on the JSONB — this field is not in the Zod schema. It should be tracked as a first-class column instead.
