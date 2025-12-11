# Multi-Repo Workspace Architecture Implementation Plan

## Overview

Implement changes to allow users to add multiple GitHub repos to a single workspace via UI, while requiring `lightfast.yml` for any content to sync. The schema already supports multi-repo workspaces - this plan focuses on three key changes:

1. **Multi-repo selection at workspace creation** - The `/new` page currently allows only ONE repo
2. **Remove `["**/*"]` fallback** - Repos without `lightfast.yml` should sync NOTHING
3. **Fix "unconfigured" status UX** - Clear messaging that config is required

## Current State Analysis

### Existing Multi-Repo Support (No Change Needed)
- **Database**: `workspace_integrations` is a many-to-many join table (`workspace-integrations.ts:31-33`)
- **Bulk Connect**: `/sources/connect` page already supports multi-select up to 50 repos
- **Mutation**: `bulkLinkGitHubRepositories` exists at `api/console/src/router/org/workspace.ts:1049-1191`

### Key Discoveries
- **Fallback Location**: `github-sync-orchestrator.ts:147` and `:161` both use `config.include || ["**/*"]`
- **Single Repo State**: `workspace-form-provider.tsx:75` uses `selectedRepository: Repository | null`
- **Existing Multi-Select**: `github-repo-selector.tsx` is a reusable dialog component with checkboxes

## Desired End State

After implementation:
1. Users can select multiple repositories when creating a workspace
2. Repositories without `lightfast.yml` do NOT sync any files (no fallback to `["**/*"]`)
3. UI clearly shows which repos need configuration with actionable guidance
4. Status enum uses `awaiting_config` instead of `unconfigured` for clarity

### Verification
- Create workspace with 3 repos, none have `lightfast.yml` → all show "awaiting_config", zero files synced
- Add `lightfast.yml` to one repo, push → that repo syncs, status changes to "configured"
- Other repos remain "awaiting_config" with zero files synced

## What We're NOT Doing

- Changing the database schema (already supports multi-repo)
- Modifying the `/sources/connect` bulk flow (already works)
- Adding new validation schemas for `lightfast.yml` (already validated)
- Building new webhook handlers (push handler already detects config)

---

## Phase 1: Remove Fallback in Sync Orchestrator

### Overview
Remove the `["**/*"]` fallback so repos without `lightfast.yml` sync zero files.

### Changes Required

#### 1. GitHub Sync Orchestrator
**File**: `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`

**Current Code (lines 107-172)**:
```typescript
// Line 108: Config starts empty
let config: any = {};

// Lines 116-138: Try to fetch config (may remain empty)

// Line 147 (incremental): Falls back to all files
const include = config.include || ["**/*"];

// Line 161 (full sync): Falls back to all files
const include = config.include || ["**/*"];
```

**New Code**:
```typescript
// After config fetch loop (around line 138)
// If no config found, return empty array - sync NOTHING
if (!config.include || config.include.length === 0) {
  logger.info("No lightfast.yml config found - skipping sync", {
    repoFullName,
    sourceId,
  });
  return []; // Return empty array - no files to process
}

// Then use config.include directly (no fallback)
// Line 147 becomes:
const include = config.include;

// Line 161 becomes:
const include = config.include;
```

### Success Criteria

#### Automated Verification:
- [ ] Build passes: `pnpm build:console`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Connect repo WITHOUT `lightfast.yml` → zero files synced
- [ ] Connect repo WITH `lightfast.yml` → files matching patterns synced
- [ ] Check Inngest logs show "No lightfast.yml config found - skipping sync"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Rename Status Enum

### Overview
Rename `"unconfigured"` to `"awaiting_config"` for clearer UX messaging.

### Changes Required

#### 1. Validation Schema
**File**: `packages/console-validation/src/schemas/sources.ts`

**Current (line 48-54)**:
```typescript
export const configStatusSchema = z.enum([
  "configured",
  "unconfigured",  // ← Rename this
  "ingesting",
  "error",
  "pending",
]);
```

**New**:
```typescript
export const configStatusSchema = z.enum([
  "configured",
  "awaiting_config",  // ← Renamed
  "ingesting",
  "error",
  "pending",
]);
```

#### 2. Database Schema Type
**File**: `db/console/src/schema/tables/workspace-integrations.ts`

**Current (line 99)**:
```typescript
configStatus?: "configured" | "unconfigured";
```

**New**:
```typescript
configStatus?: "configured" | "awaiting_config";
```

#### 3. Push Handler Status Assignment
**File**: `api/console/src/inngest/workflow/providers/github/push-handler.ts`

**Current (line 159)**:
```typescript
configStatus: result.exists ? "configured" as const : "unconfigured" as const,
```

**New**:
```typescript
configStatus: result.exists ? "configured" as const : "awaiting_config" as const,
```

#### 4. M2M API Schema
**File**: `api/console/src/router/m2m/sources.ts`

**Current (line 25)**:
```typescript
configStatus: z.enum(["configured", "unconfigured"]),
```

**New**:
```typescript
configStatus: z.enum(["configured", "awaiting_config"]),
```

#### 5. Sources Service
**File**: `packages/console-api-services/src/sources.ts`

**Current (line 98)**:
```typescript
configStatus: "configured" | "unconfigured";
```

**New**:
```typescript
configStatus: "configured" | "awaiting_config";
```

### Success Criteria

#### Automated Verification:
- [ ] Build passes: `pnpm build:console`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Search codebase for remaining "unconfigured" strings: `grep -r "unconfigured" --include="*.ts" --include="*.tsx"`

#### Manual Verification:
- [ ] Connect repo without config → status shows "awaiting_config" in database
- [ ] Push `lightfast.yml` to repo → status changes to "configured"

**Implementation Note**: After completing this phase, pause for manual verification before proceeding to Phase 3.

---

## Phase 3: Multi-Repo Selection at Workspace Creation

### Overview
Update the `/new` page to allow selecting multiple repositories using the existing `GitHubRepoSelector` dialog component.

### Changes Required

#### 1. Workspace Form Provider - Multi-Repo State
**File**: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`

**Current State (lines 43-44)**:
```typescript
selectedRepository: Repository | null;
setSelectedRepository: (repo: Repository | null) => void;
```

**New State**:
```typescript
// Change single repo to array
selectedRepositories: Repository[];
setSelectedRepositories: (repos: Repository[]) => void;
// Helper to toggle individual repo selection
toggleRepository: (repo: Repository) => void;
```

**Implementation**:
```typescript
// Line 75: Change from single to array
const [selectedRepositories, setSelectedRepositories] = useState<Repository[]>([]);

// Add toggle helper
const toggleRepository = (repo: Repository) => {
  setSelectedRepositories((prev) => {
    const exists = prev.find((r) => r.id === repo.id);
    if (exists) {
      return prev.filter((r) => r.id !== repo.id);
    }
    return [...prev, repo];
  });
};

// Update context value (lines 83-91)
value={{
  selectedRepositories,
  setSelectedRepositories,
  toggleRepository,
  // ... rest unchanged
}}
```

#### 2. Repository Picker - Multi-Select UI
**File**: `apps/console/src/app/(app)/(user)/new/_components/repository-picker.tsx`

**Replace Current Implementation** with dialog-based multi-select:

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Github, Search, Loader2, X } from "lucide-react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";

interface RepositoryPickerProps {
  userSourceId: string | null;
  refetchIntegration: () => void;
}

export function RepositoryPicker({ userSourceId, refetchIntegration }: RepositoryPickerProps) {
  const trpc = useTRPC();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    installations,
    selectedInstallation,
    setSelectedInstallation,
    selectedRepositories,
    toggleRepository,
    setSelectedRepositories,
  } = useWorkspaceForm();

  // Fetch repositories for selected installation
  const { data: repositoriesData, isLoading: isLoadingRepos } = useQuery({
    ...trpc.userSources.github.repositories.queryOptions({
      integrationId: userSourceId ?? "",
      installationId: selectedInstallation?.id ?? "",
    }),
    enabled: Boolean(userSourceId && selectedInstallation),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const repositories = repositoriesData ?? [];
  const filteredRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Check if repo is selected
  const isSelected = (repoId: string) =>
    selectedRepositories.some((r) => r.id === repoId);

  // Handle select all
  const handleSelectAll = () => {
    const unselected = filteredRepositories.filter((r) => !isSelected(r.id));
    setSelectedRepositories([...selectedRepositories, ...unselected]);
  };

  // Handle deselect all
  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredRepositories.map((r) => r.id));
    setSelectedRepositories(selectedRepositories.filter((r) => !filteredIds.has(r.id)));
  };

  // Count selected from current filtered list
  const selectedFromFiltered = filteredRepositories.filter((r) => isSelected(r.id)).length;

  // Handle GitHub App permissions adjustment
  const handleAdjustPermissions = () => {
    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      "https://github.com/apps/lightfastai-dev/installations/select_target",
      "github-permissions",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        void refetchIntegration();
      }
    }, 500);
  };

  return (
    <div className="space-y-4">
      {/* Installation Selector & Search */}
      <div className="flex gap-4">
        <Select
          value={selectedInstallation?.accountLogin}
          onValueChange={(login) => {
            const installation = installations.find(
              (inst) => inst.accountLogin === login,
            );
            if (installation) {
              setSelectedInstallation(installation);
              // Clear selections when changing installation
              setSelectedRepositories([]);
            }
          }}
        >
          <SelectTrigger className="w-[300px]">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {installations.map((installation) => (
              <SelectItem
                key={installation.id}
                value={installation.accountLogin}
              >
                {installation.accountLogin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Selected Count & Actions */}
      {selectedRepositories.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedRepositories.length} repositor{selectedRepositories.length === 1 ? "y" : "ies"} selected
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedRepositories([])}>
            Clear all
          </Button>
        </div>
      )}

      {/* Repository List with Checkboxes */}
      <div className="rounded-lg border bg-card max-h-[300px] overflow-y-auto">
        {isLoadingRepos ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading repositories...
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery
              ? "No repositories match your search"
              : "No repositories found"}
          </div>
        ) : (
          <>
            {/* Select All Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <span className="text-sm text-muted-foreground">
                {filteredRepositories.length} repositor{filteredRepositories.length === 1 ? "y" : "ies"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectedFromFiltered === filteredRepositories.length ? handleDeselectAll : handleSelectAll}
              >
                {selectedFromFiltered === filteredRepositories.length ? "Deselect all" : "Select all"}
              </Button>
            </div>

            {/* Repository List */}
            <div className="divide-y">
              {filteredRepositories.map((repo) => (
                <label
                  key={repo.id}
                  className={`flex items-center gap-3 p-4 hover:bg-accent transition-colors cursor-pointer ${
                    isSelected(repo.id) ? "bg-accent/50" : ""
                  }`}
                >
                  <Checkbox
                    checked={isSelected(repo.id)}
                    onCheckedChange={() => toggleRepository(repo)}
                  />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Github className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{repo.name}</span>
                      {repo.isPrivate && (
                        <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {repo.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Missing Repository Link */}
      <div className="text-center text-sm text-muted-foreground">
        Missing Git repository?{" "}
        <button
          onClick={handleAdjustPermissions}
          className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
        >
          Adjust GitHub App Permissions →
        </button>
      </div>
    </div>
  );
}
```

#### 3. Create Workspace Button - Two-Step Creation
**File**: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx`

**Changes**:
1. Read `selectedRepositories` array instead of `selectedRepository`
2. Create workspace first (without repos)
3. Call `bulkLinkGitHubRepositories` with selected repos

```typescript
// Line 43: Change to read array
const { selectedRepositories, userSourceId, selectedInstallation } =
  useWorkspaceForm();

// In handleCreateWorkspace, replace single repo logic (lines 154-180):
try {
  // Step 1: Create workspace (without repositories)
  const workspace = await createWorkspaceMutation.mutateAsync({
    clerkOrgId: selectedOrgId,
    workspaceName,
    // Note: Remove githubRepository parameter - we'll link separately
  });

  // Step 2: Bulk link repositories if any selected
  if (selectedRepositories.length > 0 && userSourceId && selectedInstallation) {
    await bulkLinkMutation.mutateAsync({
      workspaceId: workspace.id,
      userSourceId,
      installationId: selectedInstallation.id,
      repositories: selectedRepositories.map((repo) => ({
        repoId: repo.id,
        repoFullName: repo.fullName,
      })),
    });
  }

  // Success toast
  const repoCount = selectedRepositories.length;
  toast({
    title: "Workspace created!",
    description: repoCount > 0
      ? `${workspaceName} has been created with ${repoCount} repositor${repoCount === 1 ? "y" : "ies"}.`
      : `${workspaceName} workspace is ready. Add sources to get started.`,
  });

  // Navigation...
}
```

**Add bulk link mutation**:
```typescript
// After createWorkspaceMutation definition (around line 121)
const bulkLinkMutation = useMutation(
  trpc.workspace.integrations.bulkLinkGitHubRepositories.mutationOptions({
    onError: (error) => {
      console.error("Failed to link repositories:", error);
      // Note: Workspace is already created, just show warning
      toast({
        title: "Repositories not linked",
        description: "Workspace created, but failed to connect repositories. You can add them later.",
        variant: "destructive",
      });
    },
  }),
);
```

#### 4. Update Type Exports
**File**: `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`

Update the interface to export the new types:
```typescript
interface WorkspaceFormState {
  // Multi-repo selection
  selectedRepositories: Repository[];
  setSelectedRepositories: (repos: Repository[]) => void;
  toggleRepository: (repo: Repository) => void;
  // ... rest unchanged
}
```

### Success Criteria

#### Automated Verification:
- [ ] Build passes: `pnpm build:console`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Can select multiple repos with checkboxes on `/new` page
- [ ] "Select all" / "Deselect all" buttons work
- [ ] Selected count displays correctly
- [ ] Creating workspace with 3 repos creates 3 `workspace_integrations` records
- [ ] Creating workspace with 0 repos works (no error)
- [ ] Changing GitHub installation clears repo selection

**Implementation Note**: After completing this phase, pause for comprehensive manual testing before proceeding to Phase 4.

---

## Phase 4: UI Status Display and Guidance

### Overview
Display the configuration status in UI with clear guidance for repos awaiting config.

### Changes Required

#### 1. Installed Sources Component
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx`

Add status badge and guidance message for `awaiting_config` status:

```typescript
// In the source list item rendering, after the source name:
{source.metadata?.status?.configStatus === "awaiting_config" && (
  <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          Configuration Required
        </p>
        <p className="text-amber-700 dark:text-amber-300 mt-1">
          Add a <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded text-xs">lightfast.yml</code> file to start indexing.
        </p>
      </div>
    </div>
  </div>
)}
```

#### 2. Config Template Component (New)
**File**: `apps/console/src/components/config-template-dialog.tsx`

Create a dialog that shows the config template:

```typescript
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

const CONFIG_TEMPLATE = `version: 1
include:
  - "**/*.md"
  - "**/*.mdx"
  - "docs/**/*"
`;

export function ConfigTemplateDialog({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CONFIG_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>lightfast.yml Configuration</DialogTitle>
          <DialogDescription>
            Add this file to your repository root to start indexing.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
            {CONFIG_TEMPLATE}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>version</strong>: Always set to 1</p>
          <p><strong>include</strong>: Glob patterns for files to index</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3. Connected Sources Overview
**File**: `apps/console/src/components/connected-sources-overview.tsx`

Add status indicator showing how many repos need config:

```typescript
// In the summary section
const awaitingConfigCount = sources.filter(
  (s) => s.metadata?.status?.configStatus === "awaiting_config"
).length;

{awaitingConfigCount > 0 && (
  <div className="text-sm text-amber-600">
    {awaitingConfigCount} source{awaitingConfigCount === 1 ? "" : "s"} awaiting configuration
  </div>
)}
```

### Success Criteria

#### Automated Verification:
- [ ] Build passes: `pnpm build:console`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Repos with `awaiting_config` show amber warning banner
- [ ] Warning includes clear instruction to add `lightfast.yml`
- [ ] Config template dialog opens and copy works
- [ ] Connected sources overview shows count of awaiting repos
- [ ] After adding config file, warning disappears on next sync

---

## Testing Strategy

### Unit Tests
- Test `toggleRepository` function adds/removes repos correctly
- Test status enum validation accepts new `awaiting_config` value

### Integration Tests
- Connect repo without config → verify zero documents created
- Connect repo with config → verify documents match include patterns
- Push config to unconfigured repo → verify status changes and sync triggers

### Manual Testing Steps
1. Create workspace, select 3 repos (none have `lightfast.yml`)
2. Verify all show "awaiting_config" status
3. Verify zero files synced for each
4. Add `lightfast.yml` to one repo with `include: ["**/*.md"]`
5. Push commit, verify webhook triggers
6. Verify that repo status changes to "configured"
7. Verify only `.md` files are synced
8. Other repos remain "awaiting_config"

## Performance Considerations

- Multi-repo creation uses `bulkLinkGitHubRepositories` (single DB transaction)
- No performance impact from removing fallback (actually reduces unnecessary processing)
- Status check is O(1) lookup in JSONB field

## Migration Notes

### Existing Data
- Existing repos with `"unconfigured"` status will need migration
- Run SQL: `UPDATE workspace_integrations SET source_config = jsonb_set(source_config, '{status,configStatus}', '"awaiting_config"') WHERE source_config->'status'->>'configStatus' = 'unconfigured'`
- Alternatively, handle both values in UI during transition period

### Backwards Compatibility
- The sync orchestrator change is NOT backwards compatible by design
- Repos that were syncing everything will now sync nothing until configured
- This is the intended behavior per the requirement

## References

- Research document: `thoughts/shared/research/2025-12-11-multi-repo-workspace-architecture-research.md`
- Bulk link mutation: `api/console/src/router/org/workspace.ts:1049-1191`
- GitHub repo selector: `apps/console/src/components/integrations/github-repo-selector.tsx`
- Sync orchestrator: `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`
