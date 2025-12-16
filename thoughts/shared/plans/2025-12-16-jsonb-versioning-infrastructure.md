# JSONB Versioning Infrastructure Implementation Plan

## Overview

Add version fields to high-risk JSONB types (`sourceConfig` and `providerMetadata`) to enable safe schema evolution. Since we're pre-production, this is a clean schema change with no backward compatibility requirements.

## Current State Analysis

### Problem

Two JSONB types are actively evolving without version tracking:

1. **`sourceConfig`** (`workspace-integrations.ts:81-117`)
   - Already has evolving `status` field added post-initial design
   - Updated via blind merge pattern: `{...existing, newField}`
   - No way to detect which schema version a record conforms to

2. **`providerMetadata`** (`user-sources.ts:42-65`)
   - Complex nested `installations[]` array with 8 fields
   - GitHub app installation structure may evolve
   - Full replacement pattern is safer but schema evolution still needs tracking

### Key Discoveries

- `WorkspaceSettings` already implements versioning correctly (`version: 1` at `db/console/src/utils/workspace.ts:41`)
- No production data exists - clean schema change is possible
- Both types use discriminated union pattern on `sourceType` field
- Adding `version` creates a compound discriminator: `sourceType` + `version`

## Desired End State

### After Implementation

```typescript
// sourceConfig with version field
{
  version: 1,
  sourceType: "github",
  type: "repository",
  // ... rest of fields
}

// providerMetadata with version field
{
  version: 1,
  sourceType: "github",
  installations: [...]
}
```

### Verification

- All JSONB types have version fields
- TypeScript enforces version on new records
- `pnpm build:console && pnpm typecheck` passes
- Dev database can be reset and new records have version

## What We're NOT Doing

- **Migration utilities** - No read-time migration needed (pre-production)
- **Batch backfill scripts** - Dev data can be reset
- **Version increment logic** - Just establishing v1, future versions are separate PRs
- **ObservationActor versioning** - Lower priority, simpler structure
- **Validation schemas** - Types provide compile-time safety; runtime validation deferred

## Implementation Approach

Simple schema addition:
1. Add `version: 1` as required field to both JSONB type definitions
2. Update all code that creates these JSONB objects to include version
3. Reset dev database (or manually add version to existing records)
4. Verify builds pass

---

## Phase 1: sourceConfig Versioning

### Overview

Add `version: 1` to the `sourceConfig` JSONB type definition and update all creation sites.

### Changes Required:

#### 1. Update sourceConfig Type Definition

**File**: `db/console/src/schema/tables/workspace-integrations.ts`
**Lines**: 81-117
**Changes**: Add `version: 1` as first field in each discriminated union variant

```typescript
sourceConfig: jsonb("source_config").$type<
  | {
      version: 1;                     // ADD: Version field
      sourceType: "github";
      type: "repository";
      installationId: string;
      repoId: string;
      repoName: string;
      repoFullName: string;
      defaultBranch: string;
      isPrivate: boolean;
      isArchived: boolean;
      sync: {
        branches?: string[];
        paths?: string[];
        events?: string[];
        autoSync: boolean;
      };
      status?: {
        configStatus?: "configured" | "awaiting_config";
        configPath?: string;
        lastConfigCheck?: string;
      };
    }
  | {
      version: 1;                     // ADD: Version field
      sourceType: "vercel";
      type: "project";
      projectId: string;
      projectName: string;
      teamId?: string;
      teamSlug?: string;
      configurationId: string;
      sync: {
        events?: string[];
        autoSync: boolean;
      };
    }
>().notNull(),
```

#### 2. Update GitHub Integration Creation

**File**: `api/console/src/router/org/workspace.ts`
**Lines**: ~1218-1234 (connectGitHubRepository mutation)
**Changes**: Add `version: 1` to sourceConfig creation

Search for `sourceConfig: {` with `sourceType: "github"` and add version field:

```typescript
sourceConfig: {
  version: 1,                        // ADD
  sourceType: "github" as const,
  type: "repository" as const,
  installationId: input.installationId,
  repoId: repo.repoId,
  // ... rest unchanged
}
```

#### 3. Update Vercel Integration Creation

**File**: `api/console/src/router/org/workspace.ts`
**Changes**: Add `version: 1` to Vercel sourceConfig creation

Search for `sourceConfig: {` with `sourceType: "vercel"` and add version field:

```typescript
sourceConfig: {
  version: 1,                        // ADD
  sourceType: "vercel" as const,
  type: "project" as const,
  projectId: project.id,
  // ... rest unchanged
}
```

#### 4. Update sourceConfig Spread Updates

**File**: `api/console/src/router/m2m/sources.ts`
**Lines**: ~238-260 (updateGithubConfigStatus)
**Changes**: Ensure version is preserved in spread updates

The spread pattern `{...source.sourceConfig, status: {...}}` will preserve the version field automatically, but we should verify this is the pattern used.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @db/console build`
- [x] API compiles: `pnpm --filter @api/console build`
- [ ] Type checking passes: `pnpm typecheck`

---

## Phase 2: providerMetadata Versioning

### Overview

Add `version: 1` to the `providerMetadata` JSONB type definition and update all creation sites.

### Changes Required:

#### 1. Update providerMetadata Type Definition

**File**: `db/console/src/schema/tables/user-sources.ts`
**Lines**: 42-65
**Changes**: Add `version: 1` as first field in each discriminated union variant

```typescript
providerMetadata: jsonb("provider_metadata").$type<
  | {
      version: 1;                     // ADD: Version field
      sourceType: "github";
      installations?: {
        id: string;
        accountId: string;
        accountLogin: string;
        accountType: "User" | "Organization";
        avatarUrl: string;
        permissions: Record<string, string>;
        installedAt: string;
        lastValidatedAt: string;
      }[];
    }
  | {
      version: 1;                     // ADD: Version field
      sourceType: "vercel";
      teamId?: string;
      teamSlug?: string;
      userId: string;
      configurationId: string;
    }
>().notNull(),
```

#### 2. Update GitHub providerMetadata Creation

**File**: `api/console/src/router/user/user-sources.ts`
**Lines**: ~242-252 (validate mutation, creates new providerMetadata)
**Changes**: Add `version: 1` to providerMetadata creation

```typescript
providerMetadata: {
  version: 1,                        // ADD
  sourceType: "github" as const,
  installations: newInstallations,
},
```

#### 3. Update GitHub OAuth Callback

**File**: `api/console/src/router/user/user-sources.ts`
**Lines**: Search for initial providerMetadata creation during OAuth flow
**Changes**: Add `version: 1`

Look for where userSources are first created with GitHub metadata:

```typescript
providerMetadata: {
  version: 1,                        // ADD
  sourceType: "github" as const,
  installations: [],                 // or initial installations array
},
```

#### 4. Update Vercel providerMetadata Creation

**File**: `api/console/src/router/user/user-sources.ts`
**Changes**: Add `version: 1` to Vercel providerMetadata creation

```typescript
providerMetadata: {
  version: 1,                        // ADD
  sourceType: "vercel" as const,
  teamId: vercelTeamId,
  teamSlug: vercelTeamSlug,
  userId: vercelUserId,
  configurationId: configId,
},
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @db/console build`
- [x] API compiles: `pnpm --filter @api/console build`
- [ ] Type checking passes: `pnpm typecheck`

---

## Phase 3: Database Reset & Full Build

### Overview

Reset development database and verify complete build chain.

### Changes Required:

#### 1. Reset Development Database

Since we're pre-production, existing records don't have the version field. Options:

**Option A (Recommended)**: Manual SQL update in Drizzle Studio
```sql
-- Update sourceConfig to add version field
UPDATE lightfast_workspace_integrations
SET source_config = jsonb_set(source_config, '{version}', '1');

-- Update providerMetadata to add version field
UPDATE lightfast_user_sources
SET provider_metadata = jsonb_set(provider_metadata, '{version}', '1');
```

**Option B**: Full database reset
```bash
cd db/console
pnpm db:push  # Force schema sync (destructive)
```

#### 2. Full Build Verification

```bash
# Build all packages in order
pnpm build:console

# Type check everything
pnpm typecheck

# Lint
pnpm lint
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm build:console` completes without errors
- [x] `pnpm typecheck` passes (for relevant packages: @db/console, @api/console, @lightfast/console)
- [x] `pnpm lint` passes (for @db/console; @api/console has pre-existing lint errors unrelated to this change)
- [ ] Dev server starts: `pnpm dev:console`

#### Manual Verification:
- [ ] Connect a new GitHub repo - verify integration created with version field
- [ ] Check database via Drizzle Studio - verify `source_config.version = 1`
- [ ] Connect GitHub OAuth - verify `provider_metadata.version = 1`

---

## Testing Strategy

### Unit Tests:
- No new unit tests needed - TypeScript compiler enforces version field

### Integration Tests:
- Create new workspace integration, verify version in JSONB
- Create new user source, verify version in JSONB

### Manual Testing Steps:
1. Start dev server: `pnpm dev:console`
2. Navigate to workspace settings
3. Connect a GitHub repository
4. Open Drizzle Studio: `cd db/console && pnpm db:studio`
5. Inspect `lightfast_workspace_integrations` - verify `source_config.version = 1`
6. Inspect `lightfast_user_sources` - verify `provider_metadata.version = 1`

## Performance Considerations

- No performance impact - version is a small integer field
- JSONB access pattern unchanged
- No additional queries required

## Migration Notes

**Pre-production**: No migration needed. Either:
- Reset dev database, or
- Run SQL to add version field to existing records

**Future production migrations**: When we go to production, any schema changes to these JSONB types should:
1. Increment version number
2. Add migration utility to handle v1 → v2 transformation
3. Consider lazy vs eager migration strategy

## References

- Research document: `thoughts/shared/research/2025-12-16-jsonb-versioning-analysis.md`
- WorkspaceSettings versioning pattern: `db/console/src/utils/workspace.ts:41`
- sourceConfig schema: `db/console/src/schema/tables/workspace-integrations.ts:81-117`
- providerMetadata schema: `db/console/src/schema/tables/user-sources.ts:42-65`
- sourceConfig update pattern: `api/console/src/router/m2m/sources.ts:238-260`
