"use client";

import { useState } from "react";
import { useTRPC } from "@repo/console-trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { toast } from "@repo/ui/components/ui/sonner";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Loader2, RefreshCw } from "lucide-react";

interface VercelProjectSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userSourceId: string;
  workspaceId: string;
  workspaceName: string;
  onSuccess?: () => void;
}

export function VercelProjectSelector({
  open,
  onOpenChange,
  userSourceId,
  workspaceId,
  workspaceName,
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
      const count = result.created + result.reactivated;
      toast.success(
        `Connected ${count} project${count === 1 ? "" : "s"}`,
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
    });
  };

  const unconnectedCount =
    projectsData?.projects.filter((p) => !p.isConnected).length ?? 0;
  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <IntegrationIcons.vercel className="h-5 w-5" />
              Select Vercel Projects
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <DialogDescription>
            Choose which projects to connect to &quot;{workspaceName}&quot;
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
