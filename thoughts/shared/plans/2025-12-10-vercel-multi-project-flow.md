# Vercel Multi-Project Connection Flow Implementation Plan

## Overview

Implement a project selector UI that allows users to browse their Vercel projects and connect multiple projects to a workspace in a single flow. This addresses the current gap where users must manually provide project IDs instead of browsing their available projects.

## Current State Analysis

### What Exists (Working)
- OAuth flow complete (`apps/console/src/app/(vercel)/api/vercel/`)
- Token encryption with AES-256-GCM (`@repo/lib/encryption`)
- Single project linking via `workspace.integrations.linkVercelProject` (`api/console/src/router/org/workspace.ts:893-998`)
- Webhook handling with signature verification (`packages/console-webhooks/src/vercel.ts`)
- Database schema with `providerResourceId` indexed for fast lookups

### What's Missing
- **`listVercelProjects` API**: Users can't browse available projects
- **`bulkLinkVercelProjects` API**: Can only link one project at a time
- **Project Selector UI**: No multi-select interface
- **Post-OAuth flow**: No automatic project selection after connecting Vercel

### Key Discoveries
- `providerResourceId` column is indexed at `workspace-integrations.ts:151` for fast webhook lookups
- `userSources.providerMetadata` contains `teamId` needed for Vercel API calls at `user-sources.ts:57-64`
- Existing `linkVercelProject` handles idempotency (reactivation) at `workspace.ts:944-962`
- Sources page uses `nuqs` for URL state management at `installed-sources.tsx:51-59`

## Desired End State

After implementation:
1. User clicks "Connect Vercel" → OAuth flow → Project selector modal auto-opens
2. User sees list of all their Vercel projects with checkboxes
3. Already-connected projects shown as disabled with "Connected" badge
4. User selects multiple projects → clicks "Connect X Projects"
5. Projects appear in workspace sources list immediately
6. "Add Projects" button available for users with existing Vercel connection

### Verification
- User can browse 100+ projects with pagination
- Multiple projects can be connected in single operation
- Connected projects receive webhook events correctly
- Sources page shows all connected Vercel projects with correct metadata

## What We're NOT Doing

- Multi-team support (one Vercel team per user for Phase 1)
- Project search/filter in selector (Phase 2)
- Automatic project discovery/sync
- Deployment history import
- Project disconnect UI (separate task)

## Implementation Approach

Use the existing patterns from GitHub integration as a reference while keeping Vercel-specific requirements. The flow follows the two-table architecture: `userSources` (OAuth credentials) → `workspaceIntegrations` (project links).

---

## Phase 1: API Layer

### Overview
Add two new tRPC procedures for listing Vercel projects and bulk-linking them to workspaces.

### Changes Required

#### 1. Add Vercel API Types

**File**: `packages/console-vercel/src/types.ts` (new file)

```typescript
/**
 * Vercel API Response Types
 * @see https://vercel.com/docs/rest-api/reference/endpoints/projects
 */

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  createdAt: number;
  latestDeployments?: {
    id: string;
    url: string;
    createdAt: number;
    readyState: string;
  }[];
  targets?: {
    production?: {
      alias?: string[];
    };
  };
}

export interface VercelProjectsResponse {
  projects: VercelProject[];
  pagination: {
    count: number;
    next: string | null;
    prev: string | null;
  };
}

export interface VercelProjectForUI {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  isConnected: boolean;
}
```

#### 2. Add `listProjects` Procedure

**File**: `api/console/src/router/user/user-sources.ts`
**Location**: Add to `vercel` nested router after `storeOAuthResult` (after line 785)

```typescript
listProjects: userScopedProcedure
  .input(
    z.object({
      userSourceId: z.string(),
      workspaceId: z.string(),
      cursor: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    // 1. Verify user owns this source
    const source = await ctx.db.query.userSources.findFirst({
      where: and(
        eq(userSources.id, input.userSourceId),
        eq(userSources.userId, ctx.auth.userId),
        eq(userSources.provider, "vercel"),
        eq(userSources.isActive, true),
      ),
    });

    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Vercel connection not found",
      });
    }

    // 2. Decrypt token
    const accessToken = decrypt(source.accessToken, env.ENCRYPTION_KEY);

    // 3. Get team ID from metadata
    const providerMetadata = source.providerMetadata;
    if (providerMetadata.provider !== "vercel") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid provider metadata",
      });
    }
    const teamId = providerMetadata.teamId;

    // 4. Call Vercel API
    const url = new URL("https://api.vercel.com/v9/projects");
    if (teamId) url.searchParams.set("teamId", teamId);
    url.searchParams.set("limit", "100");
    if (input.cursor) url.searchParams.set("until", input.cursor);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Vercel API Error]", response.status, errorText);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch Vercel projects",
      });
    }

    const data = (await response.json()) as VercelProjectsResponse;

    // 5. Get already-connected projects for this workspace
    const connected = await ctx.db.query.workspaceIntegrations.findMany({
      where: and(
        eq(workspaceIntegrations.workspaceId, input.workspaceId),
        eq(workspaceIntegrations.userSourceId, input.userSourceId),
        eq(workspaceIntegrations.isActive, true),
      ),
      columns: { providerResourceId: true },
    });

    const connectedIds = new Set(connected.map((c) => c.providerResourceId));

    // 6. Return with connection status
    return {
      projects: data.projects.map((p) => ({
        id: p.id,
        name: p.name,
        framework: p.framework,
        updatedAt: p.updatedAt,
        isConnected: connectedIds.has(p.id),
      })),
      pagination: data.pagination,
    };
  }),
```

#### 3. Add `bulkLinkVercelProjects` Procedure

**File**: `api/console/src/router/org/workspace.ts`
**Location**: Add to `integrations` nested router after `unlinkVercelProject` (after line 1040)

```typescript
bulkLinkVercelProjects: orgScopedProcedure
  .input(
    z.object({
      workspaceId: z.string(),
      userSourceId: z.string(),
      projects: z
        .array(
          z.object({
            projectId: z.string(),
            projectName: z.string(),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // 1. Verify workspace access
    const workspace = await ctx.db.query.orgWorkspaces.findFirst({
      where: and(
        eq(orgWorkspaces.id, input.workspaceId),
        eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId),
      ),
    });

    if (!workspace) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found",
      });
    }

    // 2. Verify user source ownership
    const source = await ctx.db.query.userSources.findFirst({
      where: and(
        eq(userSources.id, input.userSourceId),
        eq(userSources.userId, ctx.auth.userId),
        eq(userSources.provider, "vercel"),
      ),
    });

    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Vercel connection not found",
      });
    }

    const providerMetadata = source.providerMetadata;
    if (providerMetadata.provider !== "vercel") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid provider metadata",
      });
    }

    // 3. Get existing connections to avoid duplicates
    const existing = await ctx.db.query.workspaceIntegrations.findMany({
      where: and(
        eq(workspaceIntegrations.workspaceId, input.workspaceId),
        eq(workspaceIntegrations.userSourceId, input.userSourceId),
      ),
    });

    const existingMap = new Map(
      existing.map((e) => [e.providerResourceId, e]),
    );

    // 4. Categorize projects
    const toCreate: typeof input.projects = [];
    const toReactivate: string[] = [];
    const alreadyActive: string[] = [];

    for (const project of input.projects) {
      const existingIntegration = existingMap.get(project.projectId);
      if (!existingIntegration) {
        toCreate.push(project);
      } else if (!existingIntegration.isActive) {
        toReactivate.push(existingIntegration.id);
      } else {
        alreadyActive.push(project.projectId);
      }
    }

    const now = new Date().toISOString();

    // 5. Reactivate inactive integrations
    if (toReactivate.length > 0) {
      await ctx.db
        .update(workspaceIntegrations)
        .set({ isActive: true, updatedAt: now })
        .where(inArray(workspaceIntegrations.id, toReactivate));
    }

    // 6. Create new integrations
    if (toCreate.length > 0) {
      const integrations = toCreate.map((p) => ({
        workspaceId: input.workspaceId,
        userSourceId: input.userSourceId,
        connectedBy: ctx.auth.userId,
        providerResourceId: p.projectId,
        sourceConfig: {
          provider: "vercel" as const,
          type: "project" as const,
          projectId: p.projectId,
          projectName: p.projectName,
          teamId: providerMetadata.teamId,
          teamSlug: providerMetadata.teamSlug,
          configurationId: providerMetadata.configurationId,
          sync: {
            events: [
              "deployment.created",
              "deployment.succeeded",
              "deployment.ready",
              "deployment.error",
              "deployment.canceled",
            ],
            autoSync: true,
          },
        },
        isActive: true,
        connectedAt: now,
      }));

      await ctx.db.insert(workspaceIntegrations).values(integrations);
    }

    return {
      created: toCreate.length,
      reactivated: toReactivate.length,
      skipped: alreadyActive.length,
    };
  }),
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm --filter @api/console build`
- [x] Type checking passes: `pnpm typecheck` (Note: pre-existing errors in @vendor/mastra unrelated to this work)
- [x] Linting passes: `pnpm lint` (Note: pre-existing lint warnings, no new issues introduced)

#### Manual Verification
- [ ] `listProjects` returns projects from Vercel API with correct `isConnected` status
- [ ] `bulkLinkVercelProjects` creates multiple integrations in single call
- [ ] Already-connected projects are correctly skipped
- [ ] Inactive integrations are reactivated instead of duplicated

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual API testing before proceeding.

---

## Phase 2: UI Components

### Overview
Create the project selector modal and integrate it into the sources page flow.

### Changes Required

#### 1. Create Vercel Project Selector Component

**File**: `apps/console/src/components/integrations/vercel-project-selector.tsx` (new file)

```typescript
"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";
import { IntegrationIcons } from "@repo/ui/components/integration-icons";
import { Loader2, RefreshCw } from "lucide-react";

interface VercelProjectSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userSourceId: string;
  workspaceId: string;
  workspaceName: string;
  orgSlug: string;
  onSuccess?: () => void;
}

export function VercelProjectSelector({
  open,
  onOpenChange,
  userSourceId,
  workspaceId,
  workspaceName,
  orgSlug,
  onSuccess,
}: VercelProjectSelectorProps) {
  const trpc = useTRPC();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch projects
  const {
    data: projectsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.userSources.vercel.listProjects.queryOptions({
      userSourceId,
      workspaceId,
    }),
    enabled: open,
  });

  // Bulk link mutation
  const linkMutation = useMutation({
    ...trpc.workspace.integrations.bulkLinkVercelProjects.mutationOptions(),
    onSuccess: (result) => {
      toast.success(
        `Connected ${result.created + result.reactivated} project${
          result.created + result.reactivated === 1 ? "" : "s"
        }`,
      );
      setSelectedIds(new Set());
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to connect projects");
    },
  });

  const handleToggle = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!projectsData) return;
    const unconnectedIds = projectsData.projects
      .filter((p) => !p.isConnected)
      .map((p) => p.id);
    setSelectedIds(new Set(unconnectedIds));
  };

  const handleConnect = () => {
    if (!projectsData) return;
    const selectedProjects = projectsData.projects
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({ projectId: p.id, projectName: p.name }));

    linkMutation.mutate({
      workspaceId,
      userSourceId,
      projects: selectedProjects,
      clerkOrgSlug: orgSlug,
      workspaceName,
    });
  };

  const unconnectedCount =
    projectsData?.projects.filter((p) => !p.isConnected).length ?? 0;
  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IntegrationIcons.vercel className="h-5 w-5" />
            Select Vercel Projects
          </DialogTitle>
          <DialogDescription>
            Choose which projects to connect to "{workspaceName}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load projects</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : projectsData?.projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No projects found in your Vercel account
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select All Header */}
              {unconnectedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    {unconnectedCount} project
                    {unconnectedCount === 1 ? "" : "s"} available
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedCount === unconnectedCount}
                  >
                    Select All
                  </Button>
                </div>
              )}

              {/* Project List */}
              {projectsData?.projects.map((project) => (
                <label
                  key={project.id}
                  className={`flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 cursor-pointer ${
                    project.isConnected ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <Checkbox
                    checked={project.isConnected || selectedIds.has(project.id)}
                    disabled={project.isConnected}
                    onCheckedChange={() => handleToggle(project.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {project.name}
                      </span>
                      {project.isConnected && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Connected
                        </span>
                      )}
                    </div>
                    {project.framework && (
                      <span className="text-xs text-muted-foreground">
                        {project.framework}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={selectedCount === 0 || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              `Connect ${selectedCount} Project${selectedCount === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 2. Update Sources Page with "Add Projects" Button

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx`

**Changes**:
1. Import `VercelProjectSelector` component
2. Add state for modal visibility
3. Add "Add Vercel Projects" button when user has Vercel connection
4. Pass `onSuccess` callback to invalidate sources query

Add imports at top:
```typescript
import { VercelProjectSelector } from "@/components/integrations/vercel-project-selector";
import { Plus } from "lucide-react";
```

Add state after existing state declarations (~line 60):
```typescript
const [showVercelSelector, setShowVercelSelector] = useState(false);
```

Add query for user's Vercel source (~line 70):
```typescript
const { data: vercelSource } = useQuery({
  ...trpc.userSources.vercel.get.queryOptions(),
  staleTime: 5 * 60 * 1000,
});
```

Add invalidation helper:
```typescript
const utils = trpc.useUtils();
const handleVercelSuccess = () => {
  utils.workspace.sources.list.invalidate({
    clerkOrgSlug: orgSlug,
    workspaceName,
  });
};
```

Add button in filter bar section (after the status dropdown, ~line 127):
```typescript
{vercelSource && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowVercelSelector(true)}
  >
    <Plus className="h-4 w-4 mr-2" />
    Add Vercel Projects
  </Button>
)}
```

Add modal at end of component (before closing fragment):
```typescript
{vercelSource && (
  <VercelProjectSelector
    open={showVercelSelector}
    onOpenChange={setShowVercelSelector}
    userSourceId={vercelSource.id}
    workspaceId={workspaceId}
    workspaceName={workspaceName}
    orgSlug={orgSlug}
    onSuccess={handleVercelSuccess}
  />
)}
```

#### 3. Auto-Open Selector After OAuth

**File**: `apps/console/src/app/(vercel)/vercel/connected/page.tsx`

Update the success page to redirect with a query parameter that triggers the selector:

```typescript
// Add to redirect URL
const redirectUrl = `/${orgSlug}/${workspaceName}/sources?vercel_connected=true`;
```

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx`

Add effect to auto-open selector when `vercel_connected=true`:

```typescript
import { useSearchParams, useRouter } from "next/navigation";

// Inside component:
const searchParams = useSearchParams();
const router = useRouter();

useEffect(() => {
  if (searchParams.get("vercel_connected") === "true" && vercelSource) {
    setShowVercelSelector(true);
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete("vercel_connected");
    router.replace(url.pathname + url.search, { scroll: false });
  }
}, [searchParams, vercelSource, router]);
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm --filter @api/console build` + `pnpm --filter @lightfast/console typecheck`
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint` (Note: pre-existing lint error in connected-sources-overview.tsx unrelated to Phase 2)

#### Manual Verification
- [ ] Project selector modal opens when clicking "Add Vercel Projects"
- [ ] Projects load from Vercel API with loading state
- [ ] Already-connected projects show as disabled with badge
- [ ] Multi-select works correctly with Select All
- [ ] Connect button shows correct count and connects projects
- [ ] Success toast appears and modal closes
- [ ] Sources list updates immediately after connecting
- [ ] Modal auto-opens after OAuth callback

**Implementation Note**: After completing this phase and all automated verification passes, pause for full end-to-end manual testing before proceeding.

---

## Phase 3: Polish & Edge Cases

### Overview
Handle edge cases, improve UX, and add refresh capability.

### Changes Required

#### 1. Add Refresh Button to Project Selector

Already included in Phase 2 component with `refetch()` on error state.

Add refresh button to header as well:

```typescript
// In DialogHeader, add refresh button
<Button
  variant="ghost"
  size="icon"
  onClick={() => refetch()}
  disabled={isLoading}
>
  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
</Button>
```

#### 2. Handle OAuth Token Expiration

**File**: `api/console/src/router/user/user-sources.ts`

In `listProjects`, handle 401 responses:

```typescript
if (response.status === 401) {
  // Mark source as needing re-auth
  await ctx.db
    .update(userSources)
    .set({ isActive: false })
    .where(eq(userSources.id, input.userSourceId));

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Vercel connection expired. Please reconnect.",
  });
}
```

#### 3. Add Empty State for Sources Page

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/installed-sources.tsx`

When no integrations exist and no Vercel source connected:

```typescript
{filteredIntegrations.length === 0 && !vercelSource && (
  <div className="rounded-sm border border-border/60 bg-card p-12 text-center">
    <IntegrationIcons.vercel className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
    <h3 className="font-medium mb-2">Connect your first source</h3>
    <p className="text-sm text-muted-foreground mb-4">
      Connect Vercel to start tracking deployments in this workspace
    </p>
    <Button asChild>
      <a href="/api/vercel/authorize">Connect Vercel</a>
    </Button>
  </div>
)}
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compilation passes: `pnpm build:console`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification
- [ ] Refresh button reloads project list
- [ ] Expired OAuth token shows reconnect message
- [ ] Empty state shows Connect Vercel button
- [ ] All loading states display correctly

---

## Testing Strategy

### Unit Tests
- Test `listProjects` returns correct `isConnected` status
- Test `bulkLinkVercelProjects` handles duplicates correctly
- Test idempotency (reactivation vs creation)

### Integration Tests
- OAuth flow → project selector → sources list
- Webhook delivery after project connection
- Multiple projects connected in single operation

### Manual Testing Steps
1. Connect new Vercel account via OAuth
2. Verify project selector auto-opens
3. Select 3+ projects and connect
4. Verify all projects appear in sources list
5. Re-open selector, verify connected projects disabled
6. Trigger deployment, verify webhook received
7. Disconnect Vercel, verify sources hidden

---

## Performance Considerations

- Vercel API pagination: limit=100 per request, use cursor for more
- `providerResourceId` index ensures fast webhook lookups
- Client-side filtering for connected status (avoid extra queries)
- `staleTime: 5 minutes` for project list cache

---

## Migration Notes

No database migrations required. The existing schema supports all changes:
- `workspaceIntegrations.providerResourceId` already indexed
- `sourceConfig` JSONB already supports Vercel type
- `userSources.providerMetadata` already stores teamId

---

## References

- Research document: `thoughts/shared/research/vercel-integration/multi-project-flow-audit.md`
- Existing single link: `api/console/src/router/org/workspace.ts:893-998`
- GitHub pattern: `api/console/src/router/user/workspace.ts:200-267`
- Vercel API docs: https://vercel.com/docs/rest-api/reference/endpoints/projects
