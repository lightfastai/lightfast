---
date: 2025-12-11T14:30:00+08:00
researcher: Claude
git_commit: 3caab720b323aeb3513c618596f0f16d2dcb0a0c
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Multi-Repo Workspace Architecture: Current State and Required Changes"
tags: [research, codebase, workspace, github-integration, multi-repo, lightfast-yml]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude
---

# Research: Multi-Repo Workspace Architecture

**Date**: 2025-12-11T14:30:00+08:00
**Researcher**: Claude
**Git Commit**: 3caab720b323aeb3513c618596f0f16d2dcb0a0c
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Investigate changes needed to allow a user to add multiple GitHub repos to a single workspace via UI-only method, while requiring `lightfast.yml` for any content to sync.

## Summary

**The schema already supports multi-repo workspaces** via the `workspace_integrations` join table. The `/sources/connect` UI has bulk-connect functionality. Three key changes are needed:

1. **Multi-repo selection at workspace creation** - The `/new` page currently allows only ONE repo. Should use multi-select and `bulkLinkGitHubRepositories`.
2. **Remove `["**/*"]` fallback** - Currently, repos without `lightfast.yml` sync ALL files. This should change to syncing NOTHING until config exists.
3. **Fix "unconfigured" status UX** - The status label and messaging should clearly communicate that config is required, not optional.

## Detailed Findings

### 1. Current Architecture (Already Multi-Repo)

#### Database Schema: Many-to-Many

```
workspace (1) ←→ (N) workspace_integrations ←→ (N) user_sources
```

**Evidence:** `db/console/src/schema/tables/workspace-integrations.ts:31-33`
```typescript
workspaceId: varchar("workspace_id", { length: 32 })
  .notNull()
  .references(() => orgWorkspaces.id, { onDelete: "cascade" }),
```

- No unique constraint prevents multiple repos per workspace
- Each `workspace_integrations` row = one repo connection
- Cascade deletes clean up when workspace deleted

#### UI: Bulk Connect Already Exists

**Location:** `/apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/`

- Multi-select up to 50 repos at once
- Calls `bulkLinkGitHubRepositories` mutation
- Creates multiple `workspace_integrations` records

### 2. Problem: Current Fallback Behavior

#### Location: `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts:107-172`

**Current Code:**
```typescript
// Line 108: Default empty config
let config: any = {};

// Lines 116-138: Try to fetch lightfast.yml (4 paths)
for (const path of configPaths) {
  // ... fetch and validate ...
}

// Line 147 (incremental) and Line 161 (full): THE PROBLEM
const include = config.include || ["**/*"];  // Falls back to ALL files
```

**Problem:** When no `lightfast.yml` exists:
- `config` remains `{}`
- `config.include` is `undefined`
- Fallback `["**/*"]` syncs ALL repository files

#### Required Change

```typescript
// If no config found, return empty array - sync NOTHING
if (!config.include || config.include.length === 0) {
  logger.info("No lightfast.yml config found, skipping sync", { repoFullName });
  return [];  // No files to process
}
```

### 3. Problem: "Unconfigured" Status UX

#### Where Status is Set

**Location:** `api/console/src/inngest/workflow/providers/github/push-handler.ts:159`
```typescript
configStatus: result.exists ? "configured" as const : "unconfigured" as const,
```

**Location:** `db/console/src/schema/tables/workspace-integrations.ts:99`
```typescript
status?: {
  configStatus?: "configured" | "unconfigured";
  configPath?: string;
  lastConfigCheck?: string;
}
```

#### Current UX Issues

1. **Label "unconfigured"** - Implies optional, should imply required
2. **No clear guidance** - User doesn't know they need to add `lightfast.yml`
3. **Sync happens anyway** - With fallback, "unconfigured" repos still sync everything

#### Suggested Status Changes

| Current | Suggested | Meaning |
|---------|-----------|---------|
| `unconfigured` | `pending_config` or `awaiting_config` | Config required, nothing synced yet |
| `configured` | `configured` or `active` | Config found, syncing |

### 4. Workspace Creation: Multi-Repo Selection

#### Current State (Single Repo)

**Location:** `apps/console/src/app/(app)/(user)/new/_components/`

**Current Form State** (`workspace-form-provider.tsx:43-44`):
```typescript
selectedRepository: Repository | null;
setSelectedRepository: (repo: Repository | null) => void;
```

**Current Repo Picker** (`repository-picker.tsx:138`):
```typescript
onClick={() => setSelectedRepository(repo)}  // Single selection
```

**Current Creation** (`create-workspace-button.tsx`):
- Passes single `githubRepository` to `workspaceAccess.create`
- Inline repo connection logic in create mutation

#### Required Change (Multi-Repo)

**Form State:**
```typescript
// Change from single to array
selectedRepositories: Repository[];
setSelectedRepositories: (repos: Repository[]) => void;
// Or toggle function
toggleRepository: (repo: Repository) => void;
```

**Repo Picker:**
- Add checkboxes for multi-select (like `/sources/connect` flow)
- Add "Select All" button
- Show selection count

**Creation Flow:**
1. Create workspace first (no repos)
2. Call `bulkLinkGitHubRepositories` with selected repos
3. Two-step mutation: `workspaceAccess.create` → `workspace.integrations.bulkLinkGitHubRepositories`

**Files to Update:**
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx` - Multi-repo state
- `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx` - Multi-select UI
- `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx` - Two-step creation

**Consider Component Reuse:**
The `/sources/connect` flow already has multi-select implemented in:
- `apps/console/src/components/integrations/github-repo-selector.tsx`

Could potentially reuse or share this component for the `/new` page.

### 5. Files Requiring Changes

#### Sync Logic (Remove Fallback)

**File:** `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`

| Line | Current | Required Change |
|------|---------|-----------------|
| 147 | `config.include \|\| ["**/*"]` | Return empty if no config |
| 161 | `config.include \|\| ["**/*"]` | Return empty if no config |

**New logic:**
```typescript
// After config fetch loop (line 138)
if (!config.include) {
  logger.info("No lightfast.yml found - repo not configured for sync", {
    repoFullName,
    sourceId,
  });
  return []; // Return empty - nothing to sync
}

// Then use config.include directly (no fallback)
const include = config.include;
```

#### Status Enum (Rename)

**File:** `packages/console-validation/src/schemas/sources.ts:48-56`
```typescript
// Current
export const configStatusSchema = z.enum([
  "configured",
  "unconfigured",
  "ingesting",
  "error",
  "pending",
]);

// Consider renaming "unconfigured" → "awaiting_config"
```

**File:** `db/console/src/schema/tables/workspace-integrations.ts:99`
```typescript
configStatus?: "configured" | "awaiting_config";  // Rename
```

**File:** `api/console/src/inngest/workflow/providers/github/push-handler.ts:159,176`
```typescript
configStatus: result.exists ? "configured" : "awaiting_config",
```

#### UI Components (Update Messaging)

**Files to update with new copy/guidance:**
- `apps/console/src/components/connected-sources-overview.tsx` - Show status badge
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx` - List view
- Any component displaying integration status

### 5. Data Flow After Changes

```
User connects repo via UI
         │
         ▼
workspace_integrations created
    status: { configStatus: "awaiting_config" }
         │
         ▼
Inngest sync triggered
         │
         ▼
github-sync-orchestrator
         │
         ├── Try fetch lightfast.yml
         │
         ├── Found? ──────────────┐
         │                        │
         │   No                   │ Yes
         │   │                    │
         │   ▼                    ▼
         │   Return []            Use config.include patterns
         │   (sync nothing)       Filter files
         │                        Process batches
         │                        │
         ▼                        ▼
    Status remains            Status updated to "configured"
    "awaiting_config"         Sync completes
```

### 6. UI Guidance for "Awaiting Config" Status

When a repo shows `awaiting_config` status, UI should display:

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  Configuration Required                                       │
│                                                                 │
│ This repository needs a lightfast.yml file to start indexing.  │
│                                                                 │
│ Add lightfast.yml to your repo root:                           │
│                                                                 │
│   version: 1                                                    │
│   include:                                                      │
│     - "**/*.md"                                                 │
│     - "**/*.mdx"                                                │
│     - "src/**/*.ts"                                             │
│                                                                 │
│ [View Documentation] [Copy Template]                            │
└─────────────────────────────────────────────────────────────────┘
```

### 7. lightfast.yml Schema Reference

**Location:** `packages/console-config/src/schema.ts:21-60`

```yaml
# Required fields
version: 1                    # Must be literal 1

# Sync patterns - REQUIRED (no fallback)
include:
  - "**/*.md"                 # Markdown files
  - "**/*.mdx"                # MDX files
  - "docs/**/*"               # Everything in docs/
  - "!**/node_modules/**"     # Exclude patterns with !

# DEPRECATED (single-store architecture now)
# store: my-store-name        # No longer used
```

**Config Detection Paths:** `packages/console-octokit-github/src/config-detector.ts:15`
```typescript
CONFIG_PATHS = ["lightfast.yml", ".lightfast.yml", "lightfast.yaml", ".lightfast.yaml"]
```

### 8. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-REPO WORKSPACE FLOW                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CREATE WORKSPACE (/new)                                                 │
│     └── No repo required at creation                                        │
│                                                                             │
│  2. CONNECT REPOS (/sources/connect)                                        │
│     └── Multi-select repos                                                  │
│     └── Creates workspace_integrations records                              │
│     └── Status: "awaiting_config" (no sync yet)                            │
│                                                                             │
│  3. USER ADDS lightfast.yml TO REPO                                        │
│     └── Push webhook received                                               │
│     └── Config detected                                                     │
│     └── Status: "configured"                                                │
│     └── Full sync triggered with include patterns                          │
│                                                                             │
│  4. SUBSEQUENT PUSHES                                                       │
│     └── Incremental sync                                                    │
│     └── Only files matching include patterns                               │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Code References

### Sync Logic (Needs Change)
- `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts:147` - Incremental fallback
- `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts:161` - Full sync fallback

### Status Definition (Needs Rename)
- `packages/console-validation/src/schemas/sources.ts:48-56` - ConfigStatus enum
- `db/console/src/schema/tables/workspace-integrations.ts:99` - Schema field
- `api/console/src/inngest/workflow/providers/github/push-handler.ts:159,176` - Status assignment

### Existing Multi-Repo Support (No Change Needed)
- `db/console/src/schema/tables/workspace-integrations.ts:31-33` - FK relationship
- `api/console/src/router/org/workspace.ts:1047-1189` - bulkLinkGitHubRepositories
- `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/` - UI flow

### Config Detection (No Change Needed)
- `packages/console-config/src/schema.ts:21-60` - Zod schema
- `packages/console-octokit-github/src/config-detector.ts:15` - Detection paths

## Summary of Required Changes

### 1. Multi-Repo Workspace Creation (UI)

**Files:**
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx`
- `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`

**Changes:**
- Change `selectedRepository: Repository | null` → `selectedRepositories: Repository[]`
- Add multi-select UI with checkboxes
- Split creation: `workspaceAccess.create` first, then `bulkLinkGitHubRepositories`
- Consider reusing `github-repo-selector.tsx` component

### 2. Remove Fallback (Critical)

**File:** `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`

Change from:
```typescript
const include = config.include || ["**/*"];
```

To:
```typescript
if (!config.include) {
  return []; // No config = no sync
}
const include = config.include;
```

### 3. Rename Status (UX)

Change `"unconfigured"` → `"awaiting_config"` across:
- Schema validation
- Database schema
- Push handler
- UI components

### 4. Update UI Messaging

Add clear guidance when status is `"awaiting_config"`:
- Explain that `lightfast.yml` is required
- Provide template/documentation link
- Show which repos are pending vs active

## Open Questions

1. **Migration:** How to handle existing repos currently syncing without config? Should they continue or be reset?
2. **Webhook behavior:** Should push webhooks for unconfigured repos still trigger (to detect new config)?
3. **Status history:** Should we track when config was first detected vs when sync completed?
