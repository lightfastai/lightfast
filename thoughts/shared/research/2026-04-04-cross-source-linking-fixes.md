---
date: 2026-04-04T20:00:00+08:00
researcher: claude
git_commit: f0b528ac099fb87e29af111c7b395502d0a8520b
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Solutions for broken cross-source linking: entity pipeline, resource-level linking, and API catalog gaps"
tags: [research, codebase, cross-source, entity-graph, edge-rules, monorepo, vercel, github, sentry, solutions]
status: complete
last_updated: 2026-04-04
last_updated_note: "Added deep dive on resource-level linking: providerConfig usage patterns, bulkLink enrichment design, migration strategy"
---

# Research: Solutions for Broken Cross-Source Linking

**Date**: 2026-04-04
**Git Commit**: f0b528ac099fb87e29af111c7b395502d0a8520b
**Branch**: refactor/drop-workspace-abstraction

## Research Question

The cross-source linking system has 3 broken layers. What are the correct, minimal fixes for each?

## Summary

Three independent breakages prevent cross-source linking. Each has a targeted fix:

1. **Entity Pipeline** (edge rules dead) — Vercel transformer must emit a `commit` relation from `attributes.gitCommitSha`. One-line fix per transformer makes the existing edge rules fire.
2. **Resource-Level Linking** (no cross-provider columns) — Extend `providerConfig` JSONB per provider to store cross-provider metadata (Vercel `link.repoId` + `rootDirectory`, Sentry repo slug). No schema migration needed — it's JSONB.
3. **API Catalog** (missing endpoints) — Register Vercel `get-project` and Sentry `list-repos` / `list-code-mappings` endpoints. Fetch cross-provider metadata at connection time via `bulkLink`.

---

## Layer 1: Entity Pipeline — Making Edge Rules Fire

### The Problem

The GitHub provider declares this edge rule (`packages/app-providers/src/providers/github/index.ts:323-330`):

```ts
{ refType: "commit", matchProvider: "vercel", matchRefType: "deployment",
  relationshipType: "deploys", confidence: 1.0 }
```

This requires a `category: "commit"` entity to co-occur with a `category: "deployment"` entity in the entity graph. The pipeline breaks at 3 points:

| Break Point | Location | Issue |
|-------------|----------|-------|
| Vercel transformer | `vercel/transformers.ts:83` | `relations: []` — commit SHA is in `attributes.gitCommitSha` (line 93), never in `relations` |
| Text extraction | `entity-extraction-patterns.ts:62-67` | SHA regex assigns `category: "reference"`, not `"commit"` |
| Edge resolver filter | `edge-resolver.ts:14,33-34` | `STRUCTURAL_TYPES` excludes `"reference"`, so text-extracted SHAs never reach the resolver |

The `extractFromRelations` function at `entity-extraction-patterns.ts:186-188` already has a `case "commit"` that correctly maps to `category: "commit"`. It just never executes because no relation with `entityType: "commit"` is ever produced.

### Solution 1A: Add `commit` Relation to Vercel Transformer

**File**: `packages/app-providers/src/providers/vercel/transformers.ts`

Change `relations: []` at line 83 to emit a `commit` relation when `gitCommitSha` is present:

```ts
relations: gitMeta?.githubCommitSha
  ? [
      {
        provider: "github",
        entityType: "commit",
        entityId: gitMeta.githubCommitSha,
        title: gitMeta.githubCommitMessage ?? null,
        url: gitMeta.githubRepo
          ? `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/commit/${gitMeta.githubCommitSha}`
          : null,
        relationshipType: "triggered_by",
      },
    ]
  : [],
```

**Why this works**: `extractFromRelations` at line 186 maps `entityType: "commit"` to `category: "commit"`. The edge resolver at line 34 includes `"commit"` in `STRUCTURAL_TYPES`. The GitHub edge rule matches `refType: "commit"` + `matchRefType: "deployment"`. All existing infrastructure works — the only missing piece is the relation itself.

**What fires after this change**:
1. Vercel deployment event arrives with `gitCommitSha: "abc123..."`
2. Transformer emits `relations: [{ entityType: "commit", entityId: "abc123..." }]`
3. `extractFromRelations` produces `{ category: "commit", key: "abc123" }` (truncated to 7 chars)
4. `orgEntities` gets a row with `category: "commit", key: "abc123"`
5. `entityRefs` emitted downstream includes `{ type: "commit", key: "abc123" }`
6. `resolveEdges` includes it as a structural ref
7. If a GitHub PR event also references the same commit SHA (see 1B), co-occurrence detected
8. `findBestRule` matches GitHub rule: `refType: "commit"` + `matchRefType: "deployment"` → creates `"deploys"` edge

### Solution 1B: Add `commit` Relation to GitHub PR Transformer

**File**: `packages/app-providers/src/providers/github/transformers.ts`

The PR transformer already has `headSha` in attributes (line 82). Add a `commit` relation:

```ts
// After extractLinkedIssues produces the relations array, add:
if (pr.head.sha) {
  relations.push({
    provider: "github",
    entityType: "commit",
    entityId: pr.head.sha,
    title: null,
    url: `https://github.com/${context.resourceName}/commit/${pr.head.sha}`,
    relationshipType: "contains",
  });
}
```

**Why both 1A and 1B are needed**: The edge rule uses co-occurrence — a `commit` entity must appear in BOTH a Vercel event and a GitHub event. If only Vercel emits the commit relation, the commit entity exists but nothing co-occurs with it from GitHub's side. Both sides must produce the same `commit` entity (same `key`) for the junction table to create the co-occurrence that triggers `resolveEdges`.

### Solution 1C: Add `branch` Relations (Optional Enhancement)

Both Vercel and GitHub events carry branch data. Adding `branch` relations enables future `branch → deployment` correlation:

**Vercel** (`vercel/transformers.ts`): Add `{ entityType: "branch", entityId: gitMeta.githubCommitRef }` when present.

**GitHub PR** (`github/transformers.ts`): Add `{ entityType: "branch", entityId: pr.head.ref }`.

This is optional — no edge rule currently matches `branch`, but it populates the entity graph for future rules.

### Solution 1D: Fix Text Extraction Category (Optional)

Change `entity-extraction-patterns.ts:62` from `category: "reference"` to `category: "commit"` for SHA patterns. This makes text-extracted SHAs structurally visible.

**Trade-off**: SHA patterns have 0.7 confidence and may false-positive on hex strings that aren't commit SHAs. The `relations`-based approach (1A/1B) is higher confidence (0.98) and should be preferred. Only do this if you want belt-and-suspenders coverage.

### Impact Assessment

| Change | Files Modified | Risk |
|--------|---------------|------|
| 1A: Vercel commit relation | 1 file, ~10 lines | Low — additive, doesn't change existing entity/event data |
| 1B: GitHub PR commit relation | 1 file, ~8 lines | Low — additive |
| 1C: Branch relations | 2 files, ~16 lines | None — no rules consume branch yet |
| 1D: SHA category fix | 1 file, 1 line | Medium — may increase false-positive entities |

---

## Layer 2: Resource-Level Linking — Cross-Provider References

### The Problem

`orgIntegrations` stores each connected resource as an independent row (`db/app/src/schema/tables/org-integrations.ts:29-103`). The `providerConfig` JSONB for each provider stores only `{ provider, type, sync }` — no cross-provider references. When 3 Vercel projects deploy from 1 GitHub repo, there's no way to query "which Vercel projects are linked to this repo?"

### Solution 2A: Extend `providerConfig` Per Provider (No Migration)

Since `providerConfig` is JSONB, extend each provider's Zod schema to include cross-provider metadata. No database migration needed.

**Vercel** (`packages/app-providers/src/providers/vercel/auth.ts:57-63`):

```ts
export const vercelProviderConfigSchema = z.object({
  provider: z.literal("vercel"),
  type: z.literal("project"),
  sync: syncSchema,
  // NEW: Cross-provider linking
  linkedRepo: z.object({
    provider: z.literal("github"),  // or "gitlab", "bitbucket"
    repoId: z.number(),             // GitHub numeric repo ID
    repoSlug: z.string(),           // "owner/repo"
  }).optional(),
  rootDirectory: z.string().nullable().optional(),  // monorepo subdirectory
});
```

**Sentry** (`packages/app-providers/src/providers/sentry/auth.ts:79-85`):

```ts
export const sentryProviderConfigSchema = z.object({
  provider: z.literal("sentry"),
  type: z.literal("project"),
  sync: syncSchema,
  // NEW: Cross-provider linking
  linkedRepo: z.object({
    provider: z.literal("github"),
    repoSlug: z.string(),           // "owner/repo"
    sourceRoot: z.string().nullable(), // monorepo path from code-mappings
  }).optional(),
});
```

**Why JSONB, not new columns**:
- No schema migration needed — `providerConfig` already exists as JSONB
- Cross-provider metadata is provider-specific (Vercel has `repoId`, Sentry has `sourceRoot`)
- The discriminated union on `provider` field already handles per-provider typing
- Queryable via Drizzle's `sql` template: `sql`providerConfig->'linkedRepo'->>'repoId'``

### Solution 2B: Populate Cross-Provider Data at Connection Time

**When**: During `bulkLink` (`api/app/src/router/org/connections.ts:549-628`), after inserting each Vercel project.

**How**: After inserting the row, make a proxy call to the new `get-project` endpoint (see Layer 3) to fetch `link.repoId` and `rootDirectory`, then update `providerConfig`:

```ts
// After initial insert in bulkLink:
if (input.provider === "vercel") {
  const projectDetail = await memory.proxy.execute({
    installationId: input.gwInstallationId,
    endpointId: "get-project",
    pathParams: { projectId: resource.resourceId },
  });

  if (projectDetail.data?.link?.repoId) {
    await ctx.db
      .update(orgIntegrations)
      .set({
        providerConfig: sql`jsonb_set(
          ${orgIntegrations.providerConfig},
          '{linkedRepo}',
          ${JSON.stringify({
            provider: projectDetail.data.link.type,
            repoId: projectDetail.data.link.repoId,
            repoSlug: projectDetail.data.link.repo,
          })}::jsonb
        )`,
      })
      .where(eq(orgIntegrations.providerResourceId, resource.resourceId));
  }
}
```

**For Sentry**: Same pattern using the `list-repos` or `list-code-mappings` endpoint (see Layer 3).

### Solution 2C: Store `resourceName` (Currently Discarded)

`bulkLink` accepts `resourceName` but discards it. Add a `resourceName` column to `orgIntegrations`:

```ts
resourceName: varchar("resource_name", { length: 255 }),
```

This requires a Drizzle migration but is simple — one nullable VARCHAR column. The value is already available in the `bulkLink` input (`connections.ts:558`).

**Why this matters**: Currently `resources.list` returns `displayName: row.providerResourceId` — an opaque ID like `"567890123"`. Storing `resourceName` allows human-readable display without a live API call.

### Query Examples After Fix

```sql
-- All Vercel projects deploying from GitHub repo 567890123
SELECT * FROM lightfast_org_integrations
WHERE provider = 'vercel'
  AND provider_config->'linkedRepo'->>'repoId' = '567890123';

-- All resources linked to a specific GitHub repo (cross-provider)
SELECT * FROM lightfast_org_integrations
WHERE provider_config->'linkedRepo'->>'repoSlug' = 'owner/repo';

-- Monorepo layout: Vercel projects with their root directories
SELECT provider_resource_id, provider_config->>'rootDirectory'
FROM lightfast_org_integrations
WHERE provider = 'vercel'
  AND provider_config->'linkedRepo'->>'repoId' = '567890123';
```

---

## Layer 3: API Catalog — Register Missing Endpoints

### The Problem

Cross-provider metadata exists in each provider's API but is not registered in the catalog. The proxy system (`api/platform/src/router/memory/proxy.ts:133-139`) rejects calls to unregistered endpoints.

### Solution 3A: Register Vercel `get-project` Endpoint

**File**: `packages/app-providers/src/providers/vercel/api.ts`

Add to `vercelApi.endpoints`:

```ts
"get-project": {
  description: "Get project details including Git link and root directory",
  method: "GET" as const,
  path: "/v9/projects/{projectId}",
  responseSchema: z.object({
    id: z.string(),
    name: z.string(),
    framework: z.string().nullable().optional(),
    rootDirectory: z.string().nullable().optional(),
    sourceFilesOutsideRootDirectory: z.boolean().optional(),
    link: z.object({
      type: z.string(),
      repo: z.string(),          // "owner/repo"
      repoId: z.number(),        // GitHub numeric ID
      org: z.string().optional(),
      productionBranch: z.string().optional(),
    }).optional(),
  }),
},
```

**Note**: The `resolveResourceMeta` function in `vercel/backfill.ts:73-86` already makes a raw `fetch` to this exact endpoint. Registering it in the catalog means it can go through the proxy (with token refresh, rate limiting, etc.) instead of raw fetch.

### Solution 3B: Register Sentry `list-repos` Endpoint

**File**: `packages/app-providers/src/providers/sentry/api.ts`

```ts
"list-repos": {
  description: "List connected repositories for a Sentry organization",
  method: "GET" as const,
  path: "/api/0/organizations/{organization_slug}/repos/",
  responseSchema: z.array(z.object({
    id: z.string(),
    name: z.string(),                    // "owner/repo"
    url: z.string().optional(),
    provider: z.object({
      id: z.string(),                    // "integrations:github"
      name: z.string(),
    }),
    status: z.string(),
    externalSlug: z.string(),            // "owner/repo" — join key
    integrationId: z.string().optional(),
    defaultBranch: z.string().nullable().optional(),
  })),
},
```

### Solution 3C: Register Sentry `list-code-mappings` Endpoint

```ts
"list-code-mappings": {
  description: "List code mappings linking Sentry projects to repos",
  method: "GET" as const,
  path: "/api/0/organizations/{organization_slug}/code-mappings/",
  responseSchema: z.array(z.object({
    id: z.string(),
    projectId: z.string(),
    projectSlug: z.string(),
    repoId: z.string(),
    repoName: z.string(),               // "owner/repo"
    integrationId: z.string().optional(),
    stackRoot: z.string(),
    sourceRoot: z.string(),              // monorepo path, analogous to Vercel rootDirectory
    defaultBranch: z.string().nullable().optional(),
  })),
},
```

### Solution 3D: Extend `vercelProjectsListSchema` to Capture `link`

The existing `list-projects` endpoint schema (`vercel/api.ts:45-61`) uses `.loose()` which silently drops `link` and `rootDirectory`. Extend it:

```ts
const vercelProjectItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  framework: z.string().nullable().optional(),
  updatedAt: z.number().optional(),
  rootDirectory: z.string().nullable().optional(),
  link: z.object({
    type: z.string(),
    repo: z.string(),
    repoId: z.number(),
  }).optional(),
}).loose();
```

**Why**: This enables cross-provider linking during resource discovery (the "Add Sources" picker). When listing Vercel projects, the UI or `bulkLink` can immediately see which GitHub repo each project deploys from, without a separate `get-project` call per project.

---

## Implementation Order

These layers are independent but build on each other:

### Phase 1: API Catalog (Layer 3) — Prerequisite for Layer 2

1. Register `get-project` endpoint in Vercel API catalog (3A)
2. Extend `vercelProjectsListSchema` to capture `link` + `rootDirectory` (3D)
3. Register `list-repos` in Sentry API catalog (3B)
4. Register `list-code-mappings` in Sentry API catalog (3C)

**Effort**: ~30 lines of Zod schemas + endpoint registrations. No behavior change — just makes endpoints callable.

### Phase 2: Resource Linking (Layer 2) — Uses Phase 1 endpoints

1. Extend `vercelProviderConfigSchema` with `linkedRepo` + `rootDirectory` (2A)
2. Extend `sentryProviderConfigSchema` with `linkedRepo` (2A)
3. Add `resourceName` column to `orgIntegrations` (2C) — requires migration
4. Modify `bulkLink` to fetch and store cross-provider metadata (2B)

**Effort**: ~60 lines of schema + mutation changes. One simple DB migration.

### Phase 3: Entity Pipeline (Layer 1) — Independent of Layers 2/3

1. Add `commit` relation to Vercel transformer (1A)
2. Add `commit` relation to GitHub PR transformer (1B)
3. Optionally add `branch` relations (1C)

**Effort**: ~20 lines of transformer changes. No schema changes.

**Phase 3 can be done in parallel with Phases 1-2** since it's entirely in the transformer/entity pipeline, while Phases 1-2 are in the connection/schema layer.

---

## Code References

### Entity Pipeline
- `packages/app-providers/src/providers/vercel/transformers.ts:83` — `relations: []` (the fix point for 1A)
- `packages/app-providers/src/providers/vercel/transformers.ts:93` — `gitCommitSha` in attributes
- `packages/app-providers/src/providers/github/transformers.ts:82` — `headSha` in attributes (fix point for 1B)
- `packages/app-providers/src/providers/github/transformers.ts:23-39` — `extractLinkedIssues` produces issue relations
- `packages/app-providers/src/contracts/event.ts:20-27` — `EntityRelation` schema
- `api/platform/src/lib/entity-extraction-patterns.ts:62-67` — SHA regex → `category: "reference"`
- `api/platform/src/lib/entity-extraction-patterns.ts:186-188` — `extractFromRelations` commit case (exists but unreachable)
- `api/platform/src/lib/edge-resolver.ts:14` — `STRUCTURAL_TYPES` array
- `api/platform/src/lib/edge-resolver.ts:276-318` — `findBestRule` algorithm
- `packages/app-providers/src/providers/github/index.ts:323-349` — Edge rules declaration
- `api/platform/src/inngest/functions/memory-event-store.ts:333-370` — Entity extraction step
- `api/platform/src/inngest/functions/memory-event-store.ts:505-516` — `entityRefs` construction

### Resource Linking
- `db/app/src/schema/tables/org-integrations.ts:29-103` — Table schema (no cross-provider columns)
- `packages/app-providers/src/providers/vercel/auth.ts:57-63` — `vercelProviderConfigSchema` (fix point for 2A)
- `packages/app-providers/src/providers/sentry/auth.ts:79-85` — `sentryProviderConfigSchema` (fix point for 2A)
- `api/app/src/router/org/connections.ts:549-628` — `bulkLink` (fix point for 2B)
- `api/app/src/router/org/connections.ts:558` — `resourceName` accepted but not persisted
- `api/app/src/router/org/connections.ts:606-612` — `.values({})` missing `resourceName`

### API Catalog
- `packages/app-providers/src/providers/vercel/api.ts:104-129` — Vercel endpoints (fix point for 3A)
- `packages/app-providers/src/providers/vercel/api.ts:45-61` — `vercelProjectsListSchema` (fix point for 3D)
- `packages/app-providers/src/providers/sentry/api.ts:149-179` — Sentry endpoints (fix point for 3B/3C)
- `packages/app-providers/src/providers/vercel/backfill.ts:73-86` — Already fetches `/v9/projects/{id}` via raw fetch
- `api/platform/src/router/memory/proxy.ts:133-139` — Endpoint validation gate

### Proxy System
- `api/platform/src/router/memory/proxy.ts:89-243` — `proxyRouter.execute`
- `apps/app/src/lib/proxy.ts:79-121` — App-layer proxy logic
- `packages/app-providers/src/provider/api.ts:65-84` — `ApiEndpoint` interface

## Open Questions

1. **Backfill cross-provider data for existing connections?** — Users who already connected Vercel projects won't have `linkedRepo` in their `providerConfig`. Should a one-time migration job fetch this for all existing rows?

2. **Sentry code-mappings reliability** — Code mappings only exist if users configure stack trace linking. The `list-repos` endpoint is more reliable (repos are always present if the Sentry-GitHub integration is installed). Should we prefer `list-repos` over `list-code-mappings`?

3. **Push event transformer for GitHub** — Currently no `push` transformer exists. Adding one would create `commit` entities directly from GitHub (rather than relying on PR transformer + head SHA). Is this worth the added event volume?

4. **Co-occurrence timing window** — The `commit → deployment` edge requires both events to exist. If a Vercel deployment webhook arrives before the GitHub PR event, the edge won't be created until the PR event arrives. Is delayed edge creation acceptable, or should the entity-graph step re-evaluate edges when new entities are added?

5. **Vercel `list-projects` vs `get-project`** — Extending `list-projects` schema (3D) gets `link` data for all projects in one call during discovery. But `get-project` (3A) is needed for on-demand fetching during `bulkLink`. Both should probably be registered.

---

## Follow-up: Deep Dive on Resource-Level Linking

### How `providerConfig` Works Today

#### Type System

`providerConfig` is a JSONB column on `orgIntegrations` (`db/app/src/schema/tables/org-integrations.ts:56`), typed as `ProviderConfig` — a Zod discriminated union on `"provider"` built dynamically from all provider schemas (`packages/app-providers/src/registry.ts:160-164`).

Each provider's schema is minimal:
- **GitHub** (`github/auth.ts:70-81`): `{ provider, type: "repository", sync, status?: { configStatus?, configPath?, lastConfigCheck? } }` — only provider with `status`
- **Vercel** (`vercel/auth.ts:57-62`): `{ provider, type: "project", sync }`
- **Sentry** (`sentry/auth.ts:79-84`): `{ provider, type: "project", sync }`
- **Linear** (`linear/auth.ts`): `{ provider, type: "team", sync }`
- **Apollo** (`apollo/auth.ts:29-34`): `{ provider, type: "workspace", sync? }` — sync optional

The shared `syncSchema` (`packages/app-providers/src/provider/primitives.ts:16-19`): `{ events: string[] | undefined, autoSync: boolean }`.

#### Write Path (Single Entry Point)

`providerConfig` is written **exactly once** — during `bulkLink` at `connections.ts:597-610`:

1. `buildProviderConfig({ defaultSyncEvents })` is a pure function on the provider definition — takes only `defaultSyncEvents`, returns a static blob
2. Same blob reused for all resources in the batch (built once, applied N times)
3. `onConflictDoUpdate` at lines 613-622 does NOT overwrite `providerConfig` — only resets `status` and `updatedAt`
4. No UPDATE to `providerConfig` exists anywhere in the codebase
5. No `jsonb_set` or raw SQL mutation on `providerConfig` exists

#### Read Paths (Two Consumers)

| Consumer | File:Line | Fields Read |
|----------|-----------|-------------|
| `resources.list` | `connections.ts:518-531` | `sync.events`, `status.configStatus` — cast to anonymous type, surfaced to UI |
| `isEventAllowed` | `memory-event-store.ts:57-68` | `sync.events` — gates incoming webhooks |

`providerConfig` is **never used in a WHERE clause**. No query filters by its JSONB contents.

#### UI Display Path

The installed sources view (`installed-sources.tsx`) shows connected resources by calling `resources.list`, which returns `providerConfig` fields as `metadata.sync.events` and `metadata.status.configStatus`. The **resource display name** is resolved via a separate live API call — `generic.listResources` fetches the full list and matches by `r.id === providerResourceId`. This means every load of the sources page makes N API calls to resolve human-readable names.

### Enrichment Design: Two Approaches

#### Approach A: Inline Enrichment in `bulkLink` (Recommended)

Modify `bulkLink` to fetch cross-provider metadata before the insert, then include it in `providerConfig`:

```ts
// connections.ts:594-610, modified

const defaultSyncEvents = getDefaultSyncEvents(input.provider as ProviderName);
const baseConfig = providerDef.buildProviderConfig({ defaultSyncEvents: [...defaultSyncEvents] });

const memory = await createMemoryCaller("bulkLink");  // already imported at line 12

for (const resource of input.resources) {
  let enrichedConfig = baseConfig;

  // Vercel: fetch project details for linkedRepo + rootDirectory
  if (input.provider === "vercel") {
    try {
      const result = await memory.proxy.execute({
        installationId: input.gwInstallationId,
        endpointId: "get-project",
        pathParams: { projectId: resource.resourceId },
        queryParams: {},
      });
      if (result.status === 200 && result.data?.link) {
        enrichedConfig = {
          ...baseConfig,
          linkedRepo: {
            provider: result.data.link.type ?? "github",
            repoId: result.data.link.repoId,
            repoSlug: result.data.link.repo,
          },
          rootDirectory: result.data.rootDirectory ?? null,
        };
      }
    } catch {
      // Non-fatal — link without enrichment
    }
  }

  await ctx.db.insert(orgIntegrations).values({
    clerkOrgId: ctx.auth.orgId,
    installationId: input.gwInstallationId,
    provider: input.provider,
    providerConfig: enrichedConfig,
    providerResourceId: resource.resourceId as SourceIdentifier,
    resourceName: resource.resourceName ?? null,  // NEW: persist the name
  }).onConflictDoUpdate({
    target: [orgIntegrations.installationId, orgIntegrations.providerResourceId],
    set: {
      status: "active",
      statusReason: null,
      providerConfig: enrichedConfig,  // UPDATE config on reactivation too
      resourceName: resource.resourceName ?? null,
      updatedAt: new Date().toISOString(),
    },
  });
}
```

**Advantages**:
- Cross-provider data is available immediately after linking
- No async job to wait for or fail silently
- `createMemoryCaller` is already imported and used in 6 other procedures in the same file
- For Vercel: 1 API call per project (GET /v9/projects/{id}) — typically 1-5 projects
- For Sentry: 1 API call per org (GET /repos/) — batch response, covers all projects

**Latency impact**: Each Vercel `get-project` call adds ~200-400ms. For 3 projects, ~1s total. Acceptable since `bulkLink` is a one-time user action, not a hot path. Sentry `list-repos` is a single call regardless of project count.

**Failure mode**: Try/catch around enrichment — if the API call fails, the row is still inserted with the base config (no `linkedRepo`). Can be enriched later.

#### Approach B: Async Post-Link Enrichment via Inngest

Add a new Inngest event `connection/resource.linked` emitted after `bulkLink`, with a handler that fetches and updates `providerConfig` asynchronously.

**Advantages**: Doesn't add latency to `bulkLink`. Can retry on failure.

**Disadvantages**:
- Cross-provider data not available until async job completes (seconds to minutes)
- Requires new Inngest event schema, new function, new event emission in `bulkLink`
- More moving parts for a simple data fetch
- UI would show stale data until enrichment completes

**Recommendation**: Approach A (inline) is simpler and provides immediate data availability. The latency cost is minimal for a user-initiated one-time action.

### Schema Change Details

#### `providerConfig` Extension (No DB Migration)

Since `providerConfig` is JSONB, extending the Zod schemas is a code-only change. Existing rows with the old shape will pass validation because the new fields are `.optional()`. The discriminated union automatically accepts both old and new shapes.

**Backwards compatibility**: Read paths cast to `{ sync?, status? }` — they never access `linkedRepo` or `rootDirectory`. Adding these fields won't break any existing reader. The `isEventAllowed` function reads only `sync.events` — unaffected.

**Zod `.optional()` semantics**: `linkedRepo: z.object({...}).optional()` means the field can be `undefined` (not present in the JSON). Existing rows that lack `linkedRepo` will have `providerConfig.linkedRepo === undefined`, which is the expected behavior.

#### `resourceName` Column (Requires DB Migration)

Add to `db/app/src/schema/tables/org-integrations.ts`:

```ts
resourceName: varchar("resource_name", { length: 255 }),
```

Nullable, no default. One `pnpm db:generate` + `pnpm db:migrate` cycle.

**Impact on existing queries**: None — no query selects `resourceName` yet. The `resources.list` procedure will need updating to include it in the select and return it instead of `displayName: row.providerResourceId`.

### Sentry Enrichment: Two-Step Strategy

Sentry's cross-provider data requires a different approach than Vercel because the linking data is per-org, not per-project.

**Step 1**: During `bulkLink` for Sentry, call `list-repos` (one call per org) to get all connected repositories:

```ts
if (input.provider === "sentry") {
  try {
    const result = await memory.proxy.execute({
      installationId: input.gwInstallationId,
      endpointId: "list-repos",
      pathParams: { organization_slug: orgSlug },
      queryParams: {},
    });
    // result.data = [{ name: "owner/repo", externalSlug: "owner/repo", ... }]
    sentryRepos = result.data ?? [];
  } catch { /* non-fatal */ }
}
```

**Step 2** (optional): Call `list-code-mappings` to get project-to-repo-with-path mappings. This gives `sourceRoot` (the monorepo subdirectory), but only works if users have configured stack trace linking in Sentry.

**Step 3**: For each Sentry project being linked, look up its repo from the code-mappings response (by `projectId`). If no code-mapping exists, fall back to the first repo from `list-repos` (heuristic — Sentry orgs with one repo are common).

### Backfill Strategy for Existing Connections

Users who connected resources before the enrichment code is deployed will have `providerConfig` without `linkedRepo`. Two options:

**Option 1: One-time migration script** — Query all `orgIntegrations` rows where `provider = 'vercel'` and `providerConfig->'linkedRepo'` is null. For each, call `get-project` via the proxy and update `providerConfig` with `jsonb_set`.

**Option 2: Lazy enrichment** — When `resources.list` is called and a row lacks `linkedRepo`, trigger an enrichment fetch and cache the result. More complex but handles edge cases (expired tokens, etc.) gracefully.

**Recommendation**: Option 1 (migration script) is simpler and deterministic. Can be run as an Inngest function that iterates all rows.

### Cross-Provider Query Patterns After Implementation

```sql
-- 1. All Vercel projects linked to a specific GitHub repo
SELECT id, provider_resource_id, provider_config->>'rootDirectory' AS root_dir
FROM lightfast_org_integrations
WHERE provider = 'vercel'
  AND provider_config->'linkedRepo'->>'repoSlug' = 'owner/repo';

-- 2. Given a Vercel project, find its GitHub repo orgIntegration
SELECT gi.*
FROM lightfast_org_integrations vi
JOIN lightfast_org_integrations gi
  ON gi.clerk_org_id = vi.clerk_org_id
  AND gi.provider = 'github'
  AND gi.provider_resource_id = (vi.provider_config->'linkedRepo'->>'repoId')
WHERE vi.id = '<vercel-integration-id>';

-- 3. Monorepo layout: all apps deployed from a repo
SELECT
  provider,
  provider_resource_id,
  provider_config->>'rootDirectory' AS root_dir,
  provider_config->'linkedRepo'->>'repoSlug' AS repo
FROM lightfast_org_integrations
WHERE clerk_org_id = 'org_xxx'
  AND provider_config->'linkedRepo'->>'repoSlug' = 'owner/repo'
ORDER BY provider_config->>'rootDirectory';

-- 4. Cross-provider resource graph for an org
SELECT
  provider,
  provider_resource_id,
  resource_name,
  provider_config->'linkedRepo' AS linked_repo
FROM lightfast_org_integrations
WHERE clerk_org_id = 'org_xxx'
  AND status = 'active'
ORDER BY provider;
```

**Index consideration**: If cross-provider queries become frequent, add a GIN index on `providerConfig`:

```sql
CREATE INDEX idx_org_integrations_provider_config ON lightfast_org_integrations USING gin (provider_config jsonb_path_ops);
```

This enables efficient `@>` containment queries like `WHERE provider_config @> '{"linkedRepo": {"repoSlug": "owner/repo"}}'`.

### Code References (Follow-up)

- `api/app/src/router/org/connections.ts:12` — `createMemoryCaller` import (already available for enrichment)
- `api/app/src/router/org/connections.ts:594-599` — `buildProviderConfig` call (enrichment injection point)
- `api/app/src/router/org/connections.ts:606-612` — `.values({})` (add `resourceName` and enriched `providerConfig`)
- `api/app/src/router/org/connections.ts:613-622` — `onConflictDoUpdate` (add `providerConfig` and `resourceName` to update set)
- `api/app/src/router/org/connections.ts:493-540` — `resources.list` (update to return `resourceName` and `linkedRepo`)
- `packages/app-providers/src/providers/vercel/auth.ts:57-62` — Vercel config schema (extend with `linkedRepo`, `rootDirectory`)
- `packages/app-providers/src/providers/sentry/auth.ts:79-84` — Sentry config schema (extend with `linkedRepo`)
- `packages/app-providers/src/provider/shape.ts:28-31` — `buildProviderConfig` interface (may need enrichment params)
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/new/_components/link-sources-button.tsx:57-64` — UI sends `resourceName` already
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/_components/installed-sources.tsx` — UI resolves names via live API (would use `resourceName` column instead)
