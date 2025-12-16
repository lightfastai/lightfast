"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Label } from "@repo/ui/components/ui/label";

interface WorkspaceSelectorProps {
  slug: string;
  currentWorkspaceId?: string;
}

/**
 * Workspace Selector (Client Component)
 *
 * Allows users to select which workspace's API keys to manage.
 * Organization API keys are workspace-scoped for security.
 */
export function WorkspaceSelector({
  slug,
  currentWorkspaceId,
}: WorkspaceSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();

  // Fetch workspaces for this org
  const { data: workspaces } = useSuspenseQuery({
    ...trpc.workspace.listByClerkOrgSlug.queryOptions({ clerkOrgSlug: slug }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleWorkspaceChange = (workspaceId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("workspaceId", workspaceId);
    router.push(`/${slug}/settings/api-keys?${params.toString()}`);
  };

  // If no workspaces exist, show message
  if (workspaces.length === 0) {
    return (
      <div className="p-4 bg-muted/50 border border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          No workspaces found. Create a workspace first to manage API keys.
        </p>
      </div>
    );
  }

  // If no current workspace is selected, show prominent selector
  if (!currentWorkspaceId) {
    return (
      <div className="p-6 border border-border rounded-lg bg-card space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspace-select" className="text-base font-medium">
            Select a Workspace
          </Label>
          <p className="text-sm text-muted-foreground">
            Organization API keys are scoped to individual workspaces for
            security. Select a workspace to view and manage its API keys.
          </p>
        </div>
        <Select onValueChange={handleWorkspaceChange}>
          <SelectTrigger id="workspace-select" className="w-full max-w-md">
            <SelectValue placeholder="Choose a workspace..." />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Find current workspace name
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  // Compact selector for when workspace is already selected
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="workspace-select-compact" className="text-sm font-medium">
        Workspace:
      </Label>
      <Select value={currentWorkspaceId} onValueChange={handleWorkspaceChange}>
        <SelectTrigger id="workspace-select-compact" className="w-64">
          <SelectValue>
            {currentWorkspace?.name ?? "Select workspace"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
