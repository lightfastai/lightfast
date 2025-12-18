---
date: 2025-12-16T19:30:00+08:00
researcher: Claude
git_commit: c6acb78a002b6316170ab05623fe727260f1623f
branch: feat/memory-layer-foundation
repository: lightfast
topic: "JSONB Versioning Analysis in @db/console Schema Tables"
tags: [research, codebase, database, jsonb, schema, versioning]
status: complete
last_updated: 2025-12-16
last_updated_by: Claude
---

# Research: JSONB Versioning Analysis in @db/console Schema Tables

**Date**: 2025-12-16T19:30:00+08:00
**Researcher**: Claude
**Git Commit**: c6acb78a002b6316170ab05623fe727260f1623f
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Investigate if all types in JSONB and other similar structures in `@db/console/src/schema/tables/` require a version script/field for easy upgrade.

## Summary

The codebase currently has **no JSONB version fields** in any table schema. There is a planned migration (`thoughts/shared/plans/2025-12-16-workspace-settings-embedding-migration.md`) that proposes adding versioning to `WorkspaceSettings`, but it is not yet implemented.

JSONB fields fall into two categories:
1. **Structured/typed** - have full Zod validation schemas in `@repo/console-validation`
2. **Open-ended/untyped** - use `Record<string, unknown>` for intentionally flexible data

## Detailed Findings

### Complete JSONB Field Inventory

| Table | Column | Type | Validation | Version Field |
|-------|--------|------|------------|---------------|
| `workspace-neural-observations` | `actor` | `ObservationActor \| null` | Inline interface | No |
| `workspace-neural-observations` | `topics` | `string[]` | None | No |
| `workspace-neural-observations` | `sourceReferences` | `ObservationReference[]` | Inline interface | No |
| `workspace-neural-observations` | `metadata` | `ObservationMetadata` | `Record<string, unknown>` | No |
| `workspace-neural-entities` | `aliases` | `string[]` | None | No |
| `workspace-actor-profiles` | `expertiseDomains` | `string[]` | None | No |
| `workspace-actor-profiles` | `contributionTypes` | `string[]` | None | No |
| `workspace-actor-profiles` | `activeHours` | `Record<string, number>` | None | No |
| `workspace-actor-profiles` | `frequentCollaborators` | `string[]` | None | No |
| `workspace-temporal-states` | `stateMetadata` | `Record<string, unknown>` | None | No |
| `workspace-observation-clusters` | `keywords` | `string[]` | None | No |
| `workspace-observation-clusters` | `primaryEntities` | `string[]` | None | No |
| `workspace-observation-clusters` | `primaryActors` | `string[]` | None | No |
| `workspace-integrations` | `sourceConfig` | Discriminated union | Inline interface | No |
| `workspace-workflow-runs` | `input` | `WorkflowInput` | Zod schema | No |
| `workspace-workflow-runs` | `output` | `WorkflowOutput` | Zod schema | No |
| `user-sources` | `providerMetadata` | Discriminated union | Inline interface | No |
| `org-workspaces` | `settings` | `WorkspaceSettings` | Inline interface | No |
| `workspace-knowledge-documents` | `sourceMetadata` | untyped | None | No |
| `workspace-knowledge-documents` | `relationships` | untyped | None | No |
| `workspace-operations-metrics` | `tags` | `OperationMetricTags` | Zod schema | No |
| `workspace-user-activities` | `metadata` | `ActivityMetadata` | Zod schema | No |
| `workspace-webhook-payloads` | `payload` | `Record<string, unknown>` | None | No |
| `workspace-webhook-payloads` | `headers` | `Record<string, string>` | None | No |

### JSONB Types by Complexity

#### Simple Array Types (No versioning needed)
- `topics`, `aliases`, `keywords`, `primaryEntities`, `primaryActors`, `expertiseDomains`, `contributionTypes`, `frequentCollaborators`
- These are flat `string[]` arrays with no internal structure

#### Open-Ended Record Types (Intentionally unversioned)
- `metadata` (observations), `stateMetadata`, `sourceMetadata`, `relationships`, `payload`, `headers`
- These use `Record<string, unknown>` by design for flexibility
- Raw webhook `payload` and `headers` should never be versioned (preserve original data)

#### Structured Types with Zod Validation
- **`WorkflowInput`** - `packages/console-validation/src/schemas/workflow-io.ts:50-57`
- **`WorkflowOutput`** - `packages/console-validation/src/schemas/workflow-io.ts:176-188`
- **`OperationMetricTags`** - `packages/console-validation/src/schemas/metrics.ts:252-265`
- **`ActivityMetadata`** - `packages/console-validation/src/schemas/activities.ts:548-569`

These have discriminated union schemas using the `z.discriminatedUnion()` pattern with discriminator fields (`inngestFunctionId`, `type`, `action`).

#### Structured Types with Inline Interfaces
- **`sourceConfig`** - `db/console/src/schema/tables/workspace-integrations.ts:81-117`
- **`providerMetadata`** - `db/console/src/schema/tables/user-sources.ts:42-65`
- **`WorkspaceSettings`** - `db/console/src/schema/tables/org-workspaces.ts:183-195`
- **`ObservationActor`** - `db/console/src/schema/tables/workspace-neural-observations.ts:30-35`
- **`ObservationReference`** - `db/console/src/schema/tables/workspace-neural-observations.ts:19-25`

These use TypeScript interfaces defined directly in the schema files.

### Planned Versioning (Not Yet Implemented)

The plan at `thoughts/shared/plans/2025-12-16-workspace-settings-embedding-migration.md` proposes:

```typescript
interface WorkspaceSettingsV1 {
  version: 1;
  embedding: { ... };
  repositories?: ...;
  defaults?: ...;
  features?: ...;
}
```

This is the **only versioning proposal** in the codebase. The current `WorkspaceSettings` interface does not have a `version` field.

### Current Discriminated Union Pattern

The codebase uses discriminated unions for type safety without version numbers. For example:

**`sourceConfig`** discriminates on `sourceType`:
```typescript
sourceConfig: jsonb("source_config").$type<
  | { sourceType: "github"; type: "repository"; ... }
  | { sourceType: "vercel"; type: "project"; ... }
>()
```

**`providerMetadata`** discriminates on `sourceType`:
```typescript
providerMetadata: jsonb("provider_metadata").$type<
  | { sourceType: "github"; installations?: [...] }
  | { sourceType: "vercel"; teamId?: string; ... }
>()
```

**`WorkflowInput/Output`** uses Zod discriminated unions on `inngestFunctionId`:
```typescript
z.discriminatedUnion("inngestFunctionId", [
  sourceConnectedGitHubInputSchema,
  sourceSyncGitHubInputSchema,
  ...
])
```

## Code References

- `db/console/src/schema/tables/workspace-neural-observations.ts:103` - actor jsonb field
- `db/console/src/schema/tables/workspace-neural-observations.ts:132` - topics jsonb field
- `db/console/src/schema/tables/workspace-neural-observations.ts:159` - sourceReferences jsonb field
- `db/console/src/schema/tables/workspace-neural-observations.ts:164` - metadata jsonb field
- `db/console/src/schema/tables/workspace-neural-entities.ts:73` - aliases jsonb field
- `db/console/src/schema/tables/workspace-actor-profiles.ts:49-52` - profile jsonb fields
- `db/console/src/schema/tables/workspace-temporal-states.ts:85` - stateMetadata jsonb field
- `db/console/src/schema/tables/workspace-observation-clusters.ts:59-71` - cluster jsonb fields
- `db/console/src/schema/tables/workspace-integrations.ts:81-117` - sourceConfig discriminated union
- `db/console/src/schema/tables/workspace-workflow-runs.ts:100` - input jsonb field
- `db/console/src/schema/tables/workspace-workflow-runs.ts:112` - output jsonb field
- `db/console/src/schema/tables/user-sources.ts:42-65` - providerMetadata discriminated union
- `db/console/src/schema/tables/org-workspaces.ts:88` - settings jsonb field
- `db/console/src/schema/tables/workspace-knowledge-documents.ts:41` - sourceMetadata jsonb field
- `db/console/src/schema/tables/workspace-operations-metrics.ts:108` - tags jsonb field
- `db/console/src/schema/tables/workspace-user-activities.ts:136` - metadata jsonb field
- `db/console/src/schema/tables/workspace-webhook-payloads.ts:60-66` - payload and headers jsonb fields
- `packages/console-validation/src/schemas/workflow-io.ts:50-57` - WorkflowInput Zod schema
- `packages/console-validation/src/schemas/activities.ts:548-569` - ActivityType Zod schema
- `packages/console-validation/src/schemas/metrics.ts:252-265` - OperationMetric Zod schema

## Architecture Documentation

### Current JSONB Strategy

1. **Type Safety via TypeScript/Zod**: Rather than database-level versioning, type safety is enforced through:
   - TypeScript `$type<>()` annotations on Drizzle columns
   - Zod validation schemas for complex types
   - Discriminated unions for polymorphic data

2. **No Database-Level Versioning**: The codebase relies on application-level type checking rather than storing version metadata in the JSONB payloads.

3. **Migration Approach**: Schema evolution is handled by:
   - Drizzle migrations for column-level changes
   - Application code changes for JSONB structure changes
   - No backward compatibility layer for JSONB content

### JSONB Upgrade Patterns

The codebase does not have a standardized JSONB upgrade mechanism. When JSONB structures change:
- New fields are added with optional types
- Old data may not conform to new type definitions
- No runtime migration of existing JSONB data

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2025-12-16-workspace-settings-embedding-migration.md` - Proposes first versioned JSONB schema

## Comprehensive Recommendations

Based on the usage patterns found across the codebase, here are the JSONB types that **require versioning** and those that **do not**:

### Types That NEED Version Fields

| Type | Table | Why | Risk Level |
|------|-------|-----|------------|
| `sourceConfig` | workspace-integrations | Complex nested structure with provider-specific sync configs. Already has evolving `status` field added post-deployment. | **HIGH** |
| `providerMetadata` | user-sources | OAuth installation data with nested arrays. Structure differs by provider. GitHub's `installations[]` has 8+ fields. | **HIGH** |
| `WorkspaceSettings` | org-workspaces | Already has `version: 1` in schema but code still reads legacy columns. Migration incomplete. | **HIGH** |
| `ObservationActor` | workspace-neural-observations | Simple now, but Phase 5 plans actor resolution. Will need to track which actors have been resolved. | **MEDIUM** |
| `activeHours` | workspace-actor-profiles | `Record<string, number>` today, but likely to evolve (timezone, weekly patterns, etc.) | **LOW** |

### Types That DO NOT Need Version Fields

| Type | Table | Why |
|------|-------|-----|
| `topics`, `aliases`, `keywords`, `primaryEntities`, `primaryActors` | Various | Simple `string[]` arrays - no internal structure to version |
| `metadata` (observations) | workspace-neural-observations | Intentionally `Record<string, unknown>` - schemaless by design |
| `payload`, `headers` | workspace-webhook-payloads | Raw webhook data - must preserve original structure |
| `stateMetadata` | workspace-temporal-states | Open-ended metadata - schemaless by design |
| `sourceMetadata`, `relationships` | workspace-knowledge-documents | Untyped JSONB - flexibility is the feature |

### Types With Existing Versioning Patterns

| Type | Discriminator | Pattern | Status |
|------|--------------|---------|--------|
| `WorkflowInput/Output` | `inngestFunctionId` | Zod discriminated union | Works for new variants, not schema evolution |
| `ActivityMetadata` | `action` | Zod discriminated union with `.passthrough()` | Forward-compatible via passthrough |
| `OperationMetricTags` | `type` | Zod discriminated union | Works for new metric types |

---

## Recommended Implementation

### 1. Add Version Fields to High-Risk Types

**For `sourceConfig`** (`workspace-integrations.ts:81-117`):
```typescript
sourceConfig: jsonb("source_config").$type<
  | {
      version: 1;  // ADD THIS
      sourceType: "github";
      type: "repository";
      installationId: string;
      // ... existing fields
      sync: { branches?: string[]; events?: string[]; autoSync: boolean };
      status?: { configStatus?: "configured" | "awaiting_config"; ... };
    }
  | {
      version: 1;  // ADD THIS
      sourceType: "vercel";
      // ... existing fields
    }
>().notNull()
```

**For `providerMetadata`** (`user-sources.ts:42-65`):
```typescript
providerMetadata: jsonb("provider_metadata").$type<
  | {
      version: 1;  // ADD THIS
      sourceType: "github";
      installations?: { /* existing 8 fields */ }[];
    }
  | {
      version: 1;  // ADD THIS
      sourceType: "vercel";
      // ... existing fields
    }
>().notNull()
```

### 2. Create Migration Utility Pattern

**New file**: `db/console/src/utils/jsonb-migrations.ts`
```typescript
/**
 * JSONB migration utilities
 *
 * Pattern: Read-transform-write with version checking
 */

// Type for migration functions
type JsonbMigration<T> = {
  fromVersion: number;
  toVersion: number;
  migrate: (data: unknown) => T;
};

// Example: sourceConfig migrations
export const sourceConfigMigrations: JsonbMigration<SourceConfig>[] = [
  {
    fromVersion: 0, // No version field = v0
    toVersion: 1,
    migrate: (data) => ({
      version: 1,
      ...data,
      // Add any new required fields with defaults
    }),
  },
];

// Migration runner
export function migrateSourceConfig(data: unknown): SourceConfigV1 {
  const version = (data as { version?: number })?.version ?? 0;
  let current = data;

  for (const migration of sourceConfigMigrations) {
    if (version >= migration.fromVersion && version < migration.toVersion) {
      current = migration.migrate(current);
    }
  }

  return current as SourceConfigV1;
}
```

### 3. Add Read-Time Validation Pattern

**In routers/workflows that read JSONB**:
```typescript
// api/console/src/router/m2m/sources.ts
const source = await db.query.workspaceIntegrations.findFirst({...});

// Validate and migrate on read
const sourceConfig = migrateSourceConfig(source.sourceConfig);

// If migrated, persist the new version
if (sourceConfig.version !== source.sourceConfig.version) {
  await db.update(workspaceIntegrations)
    .set({ sourceConfig })
    .where(eq(workspaceIntegrations.id, source.id));
}
```

### 4. One-Time Data Migration Scripts

**New file**: `db/console/scripts/migrate-sourceconfig-v1.ts`
```typescript
/**
 * Migrate all sourceConfig JSONB to v1 schema
 * Run: pnpm tsx db/console/scripts/migrate-sourceconfig-v1.ts
 */
async function migrateSourceConfigToV1() {
  const integrations = await db.query.workspaceIntegrations.findMany({
    where: sql`source_config->>'version' IS NULL`,
  });

  for (const integration of integrations) {
    const migrated = migrateSourceConfig(integration.sourceConfig);
    await db.update(workspaceIntegrations)
      .set({ sourceConfig: migrated })
      .where(eq(workspaceIntegrations.id, integration.id));
  }
}
```

---

## Priority Order for Implementation

1. **IMMEDIATE**: Complete `WorkspaceSettings` migration (plan exists at `thoughts/shared/plans/2025-12-16-workspace-settings-embedding-migration.md`)
   - Code still reads legacy columns, not `settings.embedding.*`
   - All new workspaces have `version: 1` but it's not used

2. **HIGH**: Add `version: 1` to `sourceConfig`
   - Already evolving (`status` field added)
   - Used in 10+ locations across workflows
   - Risk: Adding new provider types will need migrations

3. **HIGH**: Add `version: 1` to `providerMetadata`
   - Complex nested structure
   - GitHub installations array has grown
   - Risk: OAuth token refresh may need new fields

4. **MEDIUM**: Add `version: 1` to `ObservationActor`
   - Phase 5 plans actor resolution
   - Need to track resolution state

5. **LOW**: Consider `activeHours` if analytics features expand

---

## Current Gaps Identified

1. **No JSONB migration infrastructure**: No utilities for read-time migration or batch scripts
2. **WorkspaceSettings migration stalled**: `version: 1` exists but code doesn't use it
3. **sourceConfig evolving without versioning**: `status` field added without version bump
4. **No validation on read**: JSONB data assumed to match TypeScript types
5. **Spread-update pattern fragile**: `{...existing, newField}` loses type safety

## Open Questions

1. Should migrations run lazily (on read) or eagerly (batch script)?
2. Should version be part of discriminated union or separate field?
3. How to handle failed migrations without blocking reads?
