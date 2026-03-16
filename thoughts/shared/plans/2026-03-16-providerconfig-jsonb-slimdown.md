# `providerConfig` JSONB Slim-Down & Schema Cleanup

## Overview

Clean up `workspaceIntegrations.providerConfig` JSONB to remove fields that duplicate indexed columns, are vestigial, or were written by mistake. Drop `workspaceIntegrations.connectedBy` column (zero reads). Run a JSONB data migration to strip stale keys from existing rows.

**Research doc**: `thoughts/shared/research/2026-03-16-providerconfig-field-audit-workspace-integrations.md`

---

## Current State

`providerConfig` JSONB currently stores:

| Field | Status |
|---|---|
| `version: 1` | Vestigial — never read for any logic |
| `sourceType: "github"` | Redundant with `provider` column; used only for TypeScript discriminated union narrowing |
| `repoId` / `projectId` / `teamId` (resource IDs) | Redundant with `providerResourceId` column |
| Vercel `teamId` | Runtime reads come from `providerAccountInfo.raw.team_id`, not here |
| Vercel `configurationId` | Only used in OAuth callback from query string, not read from DB |
| `sync.events`, `sync.autoSync` | Active — keep |
| `type: "repository"/"project"/"team"` | Keep — no column equivalent |
| GitHub `status.*` | Keep — config detection results |
| `sync.branches`, `sync.paths` | Stale — removed from `syncSchema` long ago; GitHub factory still writes them |
| `isArchived: true` | Written by `markGithubDeleted` but never read; `isActive: false` is sufficient |

`workspaceIntegrations.connectedBy`: written at 3 insert sites, never read by any query or auth middleware (auth reads `gatewayInstallations.connectedBy` via FK).

---

## Desired End State

After this plan, `providerConfig` JSONB contains only:

```typescript
// All providers
{
  provider: "github" | "vercel" | "linear" | "sentry",  // renamed from sourceType — kept for TS discriminated union
  type: "repository" | "project" | "team",
  sync: { events?: string[], autoSync: boolean },
}
// GitHub only (plus the above)
{
  status?: { configStatus?: string, configPath?: string, lastConfigCheck?: string }
}
```

`workspaceIntegrations.connectedBy` column is dropped.

---

## What We're NOT Doing

- Adding `isArchived` as a column — `isActive: false` is the authoritative deleted state; `isArchived` has zero readers
- Changing the `provider` column denormalization (intentional for SQL filtering)
- Modifying sync logic, event-store, or backfill
- Changing `gatewayInstallations` schema

---

## Implementation Approach

4 phases, each independently deployable:

1. **Phase 1**: Fix write paths — stop perpetuating bad data (no schema/DB changes)
2. **Phase 2**: Rename `sourceType` → `provider` in Zod schemas + update all consumers (atomic TypeScript change)
3. **Phase 3**: Drop `version`, resource IDs, Vercel-specific fields from schemas + consumers (atomic TypeScript change)
4. **Phase 4**: DB migrations — drop `connectedBy` column; JSONB cleanup migration

**Zero-downtime note for Phase 2/4b:** The JSONB rename of `sourceType` → `provider` in existing rows must happen *before* Phase 2 code deploys in production (migration runs first). To handle the transition safely, Phase 4b migration *adds* `provider` without removing `sourceType` in the same statement. A subsequent cleanup migration strips `sourceType`. Old code reading `sourceType` still works during the transition window because the field is preserved until the cleanup migration.

---

## Phase 1: Fix Write Paths

**No DB migration. No schema change. Safe to deploy first.**

### 1.1 GitHub `buildProviderConfig` — stop writing `sync.branches`/`sync.paths`

**File**: `packages/console-providers/src/providers/github/index.ts:259-270`

```typescript
// BEFORE
buildProviderConfig: ({ resourceId, defaultSyncEvents }) => ({
  version: 1 as const,
  sourceType: "github" as const,
  type: "repository" as const,
  repoId: resourceId,
  sync: {
    branches: ["main"],   // ← remove
    paths: ["**/*"],      // ← remove
    events: [...defaultSyncEvents],
    autoSync: true,
  },
}),

// AFTER (leave version/sourceType/repoId for Phase 2/3)
buildProviderConfig: ({ resourceId, defaultSyncEvents }) => ({
  version: 1 as const,
  sourceType: "github" as const,
  type: "repository" as const,
  repoId: resourceId,
  sync: {
    events: [...defaultSyncEvents],
    autoSync: true,
  },
}),
```

### 1.2 `markGithubDeleted` — stop writing `isArchived: true` into JSONB

**File**: `api/console/src/router/m2m/sources.ts:298-310`

Remove the `providerConfig` field entirely from the update set. `isActive: false` is already set and is the authoritative state.

```typescript
// BEFORE
const updatedConfig = {
  ...source.providerConfig,
  isArchived: true,
};
return db.update(workspaceIntegrations).set({
  isActive: false,
  providerConfig: updatedConfig,   // ← remove these two lines
  // ...
})

// AFTER — just remove the providerConfig mutation; keep isActive/lastSync* fields
return db.update(workspaceIntegrations).set({
  isActive: false,
  lastSyncedAt: now,
  lastSyncStatus: "failed",
  lastSyncError: "Repository deleted on GitHub",
  updatedAt: now,
})
```

Since `source.providerConfig` is no longer accessed in this loop, verify the SELECT query at lines 273–278 still needs `providerConfig`. After Phase 2 also migrates the `sourceType` filter, `providerConfig` can be removed from that SELECT entirely — but leave that for Phase 2.

### Success Criteria — Phase 1

#### Automated:
- [x] `pnpm typecheck`
- [x] `pnpm check`

#### Manual:
- [ ] Connect a new GitHub repo; inspect the resulting `providerConfig` in DB — confirm no `sync.branches`/`sync.paths` keys
- [ ] Trigger a repo deletion webhook; confirm `workspaceIntegrations` row has `isActive = false` and `providerConfig` is unchanged (no `isArchived` key)

---

## Phase 2: Rename `sourceType` → `provider` in Schemas and Consumers

**Atomic — schema rename and all consumer updates in a single commit. No DB migration yet.**

This phase:
- Renames the discriminant key in all 4 Zod schemas from `sourceType` to `provider`
- Updates the discriminated union key
- Updates all 4 `buildProviderConfig` factories + 2 inline write sites
- Updates all consumer reads from `cfg.sourceType` → `cfg.provider`

### 2.1 Update 4 Zod schemas (rename discriminant)

For each file, change `sourceType: z.literal("<provider>")` → `provider: z.literal("<provider>")`:

**`packages/console-providers/src/providers/github/auth.ts:71`**
```typescript
// BEFORE
sourceType: z.literal("github"),
// AFTER
provider: z.literal("github"),
```

Same change in:
- `packages/console-providers/src/providers/vercel/auth.ts:59`
- `packages/console-providers/src/providers/linear/auth.ts:59`
- `packages/console-providers/src/providers/sentry/auth.ts:81`

### 2.2 Update discriminated union key

**File**: `packages/console-providers/src/registry.ts:144`

```typescript
// BEFORE
export const providerConfigSchema = z.discriminatedUnion("sourceType", [
// AFTER
export const providerConfigSchema = z.discriminatedUnion("provider", [
```

### 2.3 Update `buildProviderConfig` factories (4 files)

For each file, change `sourceType: "<provider>" as const` → `provider: "<provider>" as const`:

- `packages/console-providers/src/providers/github/index.ts:261`
- `packages/console-providers/src/providers/vercel/index.ts:151`
- `packages/console-providers/src/providers/linear/index.ts:264`
- `packages/console-providers/src/providers/sentry/index.ts:169`

### 2.4 Update inline providerConfig write sites (2 files)

**`api/console/src/router/org/workspace.ts:586-597`** (linkVercelProject):
```typescript
// BEFORE
sourceType: "vercel" as const,
// AFTER
provider: "vercel" as const,
```

**`api/console/src/router/user/workspace.ts:248-256`** (workspace create):
```typescript
// BEFORE
sourceType: "github" as const,
// AFTER
provider: "github" as const,
```

Also update the update path at `user/workspace.ts:224-225`:
```typescript
// BEFORE
if (currentConfig.sourceType === "github") {
// AFTER
if (currentConfig.provider === "github") {
```

### 2.5 Update consumer reads from `providerConfig.sourceType` → `integration.provider`

These consumers can use the `provider` **column** directly (already in the SELECT result) instead of going into the JSONB:

**`api/console/src/router/m2m/sources.ts`** — 4 locations:
```typescript
// Line 80: findByGithubRepoId
if (source && source.providerConfig.sourceType !== "github")
→ if (source && source.provider !== "github")

// Line 118: getSourceIdByGithubRepoId
// Currently does a redundant second DB query (findFirst) just to check sourceType.
// Simplify: source already has provider column from the initial select()
if (fullSource?.providerConfig.sourceType !== "github") { return null; }
→ Replace the entire findFirst block:
if (source.provider !== "github") { return null; }
// (Delete the redundant db.query.workspaceIntegrations.findFirst call)

// Line 291: markGithubDeleted
.filter((source) => source.providerConfig.sourceType === "github")
→ .filter((source) => source.provider === "github")
// After Phase 1 removed isArchived spread, providerConfig is no longer accessed
// in this function — remove providerConfig from the SELECT at line 195 too

// Line 372: updateGithubMetadata
.filter((source) => source.providerConfig.sourceType === "github")
→ .filter((source) => source.provider === "github")
```

**`api/console/src/router/user/workspace.ts:216-217`**:
```typescript
// BEFORE (uses both sourceType and repoId from JSONB)
const existing = existingResult.find((ws) => {
  const data = ws.providerConfig;
  return data.sourceType === "github" && data.repoId === repo.repoId;
});
// AFTER Phase 2 (migrate sourceType only; repoId migration deferred to Phase 3)
const existing = existingResult.find((ws) => {
  const data = ws.providerConfig;
  return data.provider === "github" && data.repoId === repo.repoId;
});
```

**`apps/console/src/app/api/debug/inject-event/_lib/context.ts`** — 4 narrowing checks:
```typescript
// BEFORE
const c = cfg.sourceType === "github" ? cfg : null;
// AFTER
const c = cfg.provider === "github" ? cfg : null;
// (same pattern for vercel/linear/sentry)
```

**`packages/console-test-data/src/cli/seed-integrations.ts:129`**:
```typescript
// BEFORE
const provider = source.providerConfig.sourceType;
// AFTER
const provider = source.providerConfig.provider;
```

Also update the hardcoded `DEMO_SOURCES` objects at `seed-integrations.ts:39-109` — each inline providerConfig literal has `sourceType: "<provider>"`. Change to `provider: "<provider>"` for all four entries (github, vercel, sentry, linear).

### 2.6 Update UI consumers of `metadata.sourceType`

`org/workspace.ts:394` returns `providerConfig` as `metadata` in the sources list response. The UI reads `metadata.sourceType` in two files:

**`apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx`** — 5 locations, all rename `metadata.sourceType` → `metadata.provider`:
```typescript
// Line 93: provider display name lookup
PROVIDER_DISPLAY[metadata.sourceType].displayName
→ PROVIDER_DISPLAY[metadata.provider].displayName

// Line 107: Map grouping key
const type = integration.metadata.sourceType;
→ const type = integration.metadata.provider;

// Line 218: tRPC query param
provider: metadata.sourceType,
→ provider: metadata.provider,

// Line 231: GitHub-specific narrowing
metadata.sourceType === "github"
→ metadata.provider === "github"

// Line 302: SourceSettingsForm prop
provider={metadata.sourceType}
→ provider={metadata.provider}
```

**`apps/console/src/lib/resource-label.ts`** — switch discriminant rename only (resource IDs deferred to Phase 3):
```typescript
// BEFORE
export function getResourceLabel(metadata: Source["metadata"]): string {
  switch (metadata.sourceType) {
// AFTER
export function getResourceLabel(metadata: Source["metadata"]): string {
  switch (metadata.provider) {
```

### Success Criteria — Phase 2

#### Automated:
- [x] `pnpm typecheck` (critical — schema rename cascades through all type consumers)
- [x] `pnpm check`
- [x] `pnpm --filter @repo/console-providers test`

#### Manual:
- [ ] Check `providerConfig` on a freshly linked source — confirm `provider` key present, no `sourceType` key
- [ ] Sources list page renders correctly — provider grouping and display names correct
- [ ] GitHub webhook findByGithubRepoId works end-to-end

---

## Phase 3: Drop `version`, Resource IDs, and Vercel-Specific Fields

**Atomic — schema field removals and all consumer migrations in a single commit. No DB migration yet.**

### 3.1 Update 4 Zod schemas — remove `version`, resource ID, and Vercel fields

**`packages/console-providers/src/providers/github/auth.ts`**:
```typescript
// BEFORE
export const githubProviderConfigSchema = z.object({
  version: z.literal(1),
  provider: z.literal("github"),
  type: z.literal("repository"),
  repoId: z.string(),
  sync: syncSchema,
  status: z.object({ ... }).optional(),
});

// AFTER
export const githubProviderConfigSchema = z.object({
  provider: z.literal("github"),
  type: z.literal("repository"),
  sync: syncSchema,
  status: z.object({
    configStatus: z.enum(["configured", "awaiting_config"]).optional(),
    configPath: z.string().optional(),
    lastConfigCheck: z.string().optional(),
  }).optional(),
});
```

**`packages/console-providers/src/providers/vercel/auth.ts`**:
```typescript
// AFTER
export const vercelProviderConfigSchema = z.object({
  provider: z.literal("vercel"),
  type: z.literal("project"),
  sync: syncSchema,
});
// Removed: version, projectId, teamId, configurationId
```

**`packages/console-providers/src/providers/linear/auth.ts`**:
```typescript
// AFTER
export const linearProviderConfigSchema = z.object({
  provider: z.literal("linear"),
  type: z.literal("team"),
  sync: syncSchema,
});
// Removed: version, teamId
```

**`packages/console-providers/src/providers/sentry/auth.ts`**:
```typescript
// AFTER
export const sentryProviderConfigSchema = z.object({
  provider: z.literal("sentry"),
  type: z.literal("project"),
  sync: syncSchema,
});
// Removed: version, projectId
```

### 3.2 Update `buildProviderConfig` factories — stop writing dropped fields

**`packages/console-providers/src/providers/github/index.ts`**:
```typescript
buildProviderConfig: ({ defaultSyncEvents }) => ({
  provider: "github" as const,
  type: "repository" as const,
  sync: { events: [...defaultSyncEvents], autoSync: true },
}),
// Removed: version, repoId (resourceId param no longer needed for config)
```

**`packages/console-providers/src/providers/vercel/index.ts`**:
```typescript
buildProviderConfig: ({ defaultSyncEvents }) => ({
  provider: "vercel" as const,
  type: "project" as const,
  sync: { events: [...defaultSyncEvents], autoSync: true },
}),
// Removed: version, projectId, teamId, configurationId
// providerAccountInfo param no longer needed for buildProviderConfig
```

**`packages/console-providers/src/providers/linear/index.ts`**:
```typescript
buildProviderConfig: ({ defaultSyncEvents }) => ({
  provider: "linear" as const,
  type: "team" as const,
  sync: { events: [...defaultSyncEvents], autoSync: true },
}),
// Removed: version, teamId
```

**`packages/console-providers/src/providers/sentry/index.ts`**:
```typescript
buildProviderConfig: ({ defaultSyncEvents }) => ({
  provider: "sentry" as const,
  type: "project" as const,
  sync: { events: [...defaultSyncEvents], autoSync: true },
}),
// Removed: version, projectId
```

Check `define.ts` — if `buildProviderConfig` signature includes `providerAccountInfo` in the required params, update it. Vercel's factory no longer needs `providerAccountInfo` (only needed for `teamId`/`configurationId`, now dropped).

### 3.3 Update inline write sites

**`api/console/src/router/org/workspace.ts:586-597`** (linkVercelProject):
```typescript
providerConfig: {
  provider: "vercel" as const,
  type: "project" as const,
  sync: { events: [...getDefaultSyncEvents("vercel")], autoSync: true },
},
// Removed: version, projectId, teamId, configurationId
```

**`api/console/src/router/user/workspace.ts:248-256`** (workspace create):
```typescript
providerConfig: {
  provider: "github" as const,
  type: "repository" as const,
  sync: repo.syncConfig,
},
// Removed: version, repoId
```

**`api/console/src/router/user/workspace.ts:229-235`** (update existing):
```typescript
providerConfig: { ...currentConfig, sync: repo.syncConfig },
// Unchanged — spread still works; Phase 4b migration strips old fields from DB
```

### 3.4 Migrate `user/workspace.ts` idempotency check

**`api/console/src/router/user/workspace.ts:215-218`**:
```typescript
// BEFORE
const existing = existingResult.find((ws) => {
  const data = ws.providerConfig;
  return data.provider === "github" && data.repoId === repo.repoId;
});

// AFTER — use columns entirely; no JSONB access
const existing = existingResult.find(
  (ws) => ws.provider === "github" && ws.providerResourceId === repo.repoId
);
```

### 3.5 Update `debug/inject-event/context.ts` — use `providerResourceId` instead of JSONB resource IDs

```typescript
// BEFORE
case "github": {
  const c = cfg.provider === "github" ? cfg : null;
  return `... Repo ID: ${c?.repoId ?? "567890123"} ...`
}
case "vercel": {
  const c = cfg.provider === "vercel" ? cfg : null;
  return `... Project ID: ${c?.projectId ?? "prj_example"} Team ID: ${c?.teamId ?? "team_example"} ...`
}
case "linear": {
  const c = cfg.provider === "linear" ? cfg : null;
  return `... Team ID: ${c?.teamId ?? "team_example"} ...`
}
case "sentry": {
  const c = cfg.provider === "sentry" ? cfg : null;
  return `... Project ID: ${c?.projectId ?? "123456"} ...`
}

// AFTER — cfg narrowing still works for remaining fields (status, sync), but
// resource IDs come from the column and Vercel teamId from installation
case "github": {
  return `... Repo ID: ${integration.providerResourceId} ...`
}
case "vercel": {
  const raw = installation.providerAccountInfo?.raw as { team_id?: string } | undefined;
  return `... Project ID: ${integration.providerResourceId} Team ID: ${raw?.team_id ?? "team_example"} ...`
}
case "linear": {
  return `... Team ID: ${integration.providerResourceId} ...`
}
case "sentry": {
  return `... Project ID: ${integration.providerResourceId} ...`
}
```

The `const cfg = integration.providerConfig` line and the individual `const c = cfg.provider === "..." ? cfg : null` narrowing checks can be removed entirely if no other field from `cfg` is accessed (only `status.*` for GitHub is left, if needed elsewhere in this function).

### 3.6 Update `resource-label.ts` — use `displayName` instead of JSONB resource IDs

`apps/console/src/lib/resource-label.ts` currently reads `metadata.repoId`, `metadata.projectId`, and `metadata.teamId` from the JSONB. After Phase 3, those fields are gone. The sources list response already returns `providerResourceId` as `displayName` (`org/workspace.ts:386`), so the label is already available at the call site.

```typescript
// BEFORE — reads provider-specific ID from JSONB
export function getResourceLabel(metadata: Source["metadata"]): string {
  switch (metadata.provider) {
    case "github": return metadata.repoId;
    case "vercel": return metadata.projectId;
    case "linear": return metadata.teamId;
    case "sentry": return metadata.projectId;
  }
}

// AFTER — delete the function entirely; update both call sites to use displayName
// installed-sources.tsx:94
const resourceLabel = getResourceLabel(metadata);
→ const resourceLabel = integration.displayName;

// installed-sources.tsx:214
const rawResourceId = getResourceLabel(metadata);
→ const rawResourceId = integration.displayName;
```

Delete `apps/console/src/lib/resource-label.ts` after migrating both call sites.

### 3.7 Update integration test seeds

Two integration tests hardcode `providerConfig` inline with the old field names. Update them to match the new slim schema:

**`packages/integration-tests/src/neural-pipeline.integration.test.ts:247-253`**:
```typescript
// BEFORE
providerConfig: {
  version: 1,
  sourceType: "github",
  type: "repository",
  repoId: "567890123",
  sync: { autoSync: true },
}
// AFTER
providerConfig: {
  provider: "github",
  type: "repository",
  sync: { autoSync: true },
}
```

**`packages/integration-tests/src/event-ordering.integration.test.ts:955-961`**:
```typescript
// BEFORE
providerConfig: {
  version: 1,
  sourceType: "github",
  type: "repository",
  repoId: RESOURCE_ID,
  sync: { autoSync: true },
}
// AFTER
providerConfig: {
  provider: "github",
  type: "repository",
  sync: { autoSync: true },
}
```

### 3.8 Update `DEMO_SOURCES` in seed-integrations

**`packages/console-test-data/src/cli/seed-integrations.ts:39-109`** — update all 4 provider configs to drop `version` and resource IDs:

```typescript
// GitHub (lines 41-52): remove version, repoId
// Vercel (lines 56-69): remove version, projectId, teamId, configurationId
// Sentry (lines 81-92): remove version, projectId
// Linear (lines 95-107): remove version, teamId
// All: rename sourceType → provider (already done in Phase 2.5)
```

### 3.9 Update `buildProviderConfig` interface in `define.ts`

**`packages/console-providers/src/define.ts:361-367`**:

After Phase 3 removes resource IDs from `providerConfig`, the `resourceId` parameter is no longer used by GitHub, Linear, or Sentry factories (Vercel never used it for the JSONB either — `projectId` came from `resourceId` but is now dropped). Remove `resourceId` from the interface:

```typescript
// BEFORE
readonly buildProviderConfig: (params: {
  resourceId: string;
  resourceName: string;
  installationExternalId: string;
  providerAccountInfo: BaseProviderAccountInfo | null;
  defaultSyncEvents: readonly string[];
}) => z.infer<TProviderConfigSchema>;

// AFTER
readonly buildProviderConfig: (params: {
  defaultSyncEvents: readonly string[];
}) => z.infer<TProviderConfigSchema>;
// Remove resourceId, resourceName, installationExternalId, providerAccountInfo
// (none are needed to construct the slim config object)
```

Also update the one call site at `org/workspace.ts:861-867` (`bulkLinkResources`) to stop passing the removed params.

### Success Criteria — Phase 3

#### Automated:
- [x] `pnpm typecheck`
- [x] `pnpm check`
- [x] `pnpm --filter @repo/console-providers test`
- [ ] `pnpm --filter @repo/integration-tests test` (if runnable locally)

#### Manual:
- [ ] Link a new resource for each provider (GitHub, Vercel, Linear, Sentry)
- [ ] Inspect `providerConfig` in DB — confirm only `provider`, `type`, `sync` (and GitHub `status` if populated)
- [ ] Sources list page renders correctly — provider display name, resource label, event count all correct
- [ ] Debug inject-event tool still generates realistic payloads for all 4 providers

---

## Phase 4: DB Migrations

### Phase 4a: Drop `workspaceIntegrations.connectedBy`

**Files to change first (code before schema)**:

Remove `connectedBy: ctx.auth.userId` from all 3 insert sites:
1. `api/console/src/router/org/workspace.ts:585` (linkVercelProject insert)
2. `api/console/src/router/org/workspace.ts:~860` (bulkLinkResources insert)
3. `api/console/src/router/user/workspace.ts:247` (workspace create insert)

Then update the Drizzle schema:

**`db/console/src/schema/tables/workspace-integrations.ts`**:
- Remove lines `connected_by` column definition (`varchar("connected_by", ...).notNull()`)
- Remove `connectedByIdx` index entry (`workspace_source_connected_by_idx`)

Generate migration:
```bash
cd db/console && pnpm db:generate
# Review generated migration — should be a single DROP COLUMN statement
pnpm db:migrate
```

### Phase 4b: JSONB Cleanup Migration

This is a custom data migration SQL file. After Phase 4a migration is generated, add the next sequential migration file to `db/console/drizzle/`.

**Migration SQL** (two statements in sequence):

```sql
-- Statement 1: Rename sourceType → provider in JSONB for existing rows
-- This is ADDITIVE first (keeps sourceType for backward compat during deploy window)
UPDATE lightfast_workspace_integrations
SET provider_config = provider_config || jsonb_build_object('provider', provider_config->>'sourceType')
WHERE provider_config ? 'sourceType' AND NOT (provider_config ? 'provider');

-- Statement 2: Strip all stale/dropped top-level keys
-- Run after new code has fully deployed (can be a separate migration if needed)
UPDATE lightfast_workspace_integrations
SET provider_config = provider_config
  - 'sourceType'
  - 'version'
  - 'repoId'
  - 'projectId'
  - 'teamId'
  - 'configurationId'
  - 'isArchived'
WHERE provider_config ?| ARRAY['sourceType', 'version', 'repoId', 'projectId', 'teamId', 'configurationId', 'isArchived'];

-- Statement 3: Strip stale nested sync keys (sync.paths, sync.branches)
UPDATE lightfast_workspace_integrations
SET provider_config = jsonb_set(
  jsonb_set(
    provider_config,
    '{sync}',
    (provider_config -> 'sync') - 'paths'
  ),
  '{sync}',
  (provider_config -> 'sync') - 'branches'
)
WHERE (provider_config -> 'sync') ?| ARRAY['paths', 'branches'];
```

**Migration ordering note**: Statement 1 (add `provider`) should be in a migration that runs before the Phase 2 code deploy. Statements 2+3 (strip stale keys) can be in the same migration or a follow-up one after full deploy — they are safe to run at any time since the new code no longer writes these fields.

Apply:
```bash
cd db/console && pnpm db:migrate
```

### Success Criteria — Phase 4

#### Automated:
- [x] `pnpm db:migrate` runs cleanly
- [x] `pnpm typecheck` (connectedBy removal causes TypeScript errors at write sites — must be fixed first)
- [x] `pnpm check`

#### Manual:
- [x] `SELECT COUNT(*) FROM lightfast_workspace_integrations WHERE provider_config ? 'sourceType'` → 0
- [x] `SELECT COUNT(*) FROM lightfast_workspace_integrations WHERE provider_config ? 'version'` → 0
- [x] `SELECT COUNT(*) FROM lightfast_workspace_integrations WHERE provider_config -> 'sync' ? 'paths'` → 0
- [x] `SELECT id, provider_config FROM lightfast_workspace_integrations LIMIT 5` — confirm slim schema: only `provider`, `type`, `sync`, and optionally `status` for GitHub
- [ ] `DESCRIBE lightfast_workspace_integrations` (or `\d` equivalent) — confirm `connected_by` column absent

---

## Testing Strategy

### After Phase 1:
- Manual: link a repo, check JSONB structure
- Manual: test webhook deletion path

### After Phase 2:
- `pnpm typecheck` is the primary gate (schema rename cascades everywhere, including UI consumers)
- Manual: end-to-end webhook flow (findByGithubRepoId, updateGithubMetadata)
- Manual: sources list page loads and renders correctly

### After Phase 3:
- `pnpm typecheck` again
- Manual: test all 4 providers can link resources
- Manual: sources list page — resource labels, event counts, and settings form still render correctly

### After Phase 4:
- SQL validation queries above
- Manual: full integration flow with any provider

---

## References

- Research doc: `thoughts/shared/research/2026-03-16-providerconfig-field-audit-workspace-integrations.md`
- `db/console/src/schema/tables/workspace-integrations.ts` — full table schema
- `packages/console-providers/src/registry.ts` — discriminated union
- `packages/console-providers/src/define.ts:361` — `buildProviderConfig` interface signature
- `api/console/src/router/org/workspace.ts` — `sources.list` response shape (line 385-400), `updateEvents`, `linkVercelProject`, `bulkLinkResources`
- `api/console/src/router/m2m/sources.ts` — webhook M2M procedures
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx` — UI consumer (5 sourceType reads)
- `apps/console/src/lib/resource-label.ts` — UI helper (reads sourceType + resource IDs from metadata)
- `packages/console-test-data/src/cli/seed-integrations.ts` — DEMO_SOURCES hardcoded configs
- `packages/integration-tests/src/neural-pipeline.integration.test.ts:241` — inline providerConfig seed
- `packages/integration-tests/src/event-ordering.integration.test.ts:949` — inline providerConfig seed
- `packages/console-auth-middleware/src/resources.ts` — ownership auth (reads `gatewayInstallations.connectedBy` only)
