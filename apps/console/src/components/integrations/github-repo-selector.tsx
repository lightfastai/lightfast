"use client";

import { useState } from "react";
import { useTRPC } from "@repo/console-trpc/react";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { RefreshCw, Search, Lock, Globe } from "lucide-react";

interface GitHubRepoSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gwInstallationId: string;
  installationId: string;
  clerkOrgSlug: string;
  workspaceName: string;
  connectedRepoIds?: Set<string>;
  onSelect?: (repos: { id: string; name: string; fullName: string }[]) => void;
}

const EMPTY_CONNECTED_REPO_IDS = new Set<string>();

export function GitHubRepoSelector({
  open,
  onOpenChange,
  gwInstallationId,
  installationId,
  clerkOrgSlug: _clerkOrgSlug,
  workspaceName,
  connectedRepoIds = EMPTY_CONNECTED_REPO_IDS,
  onSelect,
}: GitHubRepoSelectorProps) {
  const trpc = useTRPC();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch repositories
  const {
    data: repos,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...trpc.connections.github.repositories.queryOptions({
      integrationId: gwInstallationId,
      installationId,
    }),
    enabled: open,
  });

  // Filter repos by search
  const filteredRepos = repos?.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (repoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!filteredRepos) return;
    const unconnectedIds = filteredRepos
      .filter((r) => !connectedRepoIds.has(r.id))
      .map((r) => r.id);
    setSelectedIds(new Set(unconnectedIds));
  };

  const handleConfirm = () => {
    if (!repos || !onSelect) return;
    const selectedRepos = repos
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, fullName: r.fullName }));
    onSelect(selectedRepos);
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  const unconnectedCount =
    filteredRepos?.filter((r) => !connectedRepoIds.has(r.id)).length ?? 0;
  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <IntegrationIcons.github className="h-5 w-5" />
              Select Repositories
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <DialogDescription>
            Choose repositories to connect to &quot;{workspaceName}&quot;
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load repositories</p>
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
          ) : filteredRepos?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No repositories match your search"
                : "No repositories found"}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select All Header */}
              {unconnectedCount > 0 && (
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    {unconnectedCount} repositor
                    {unconnectedCount === 1 ? "y" : "ies"} available
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

              {/* Repository List */}
              {filteredRepos?.map((repo) => {
                const isConnected = connectedRepoIds.has(repo.id);
                return (
                  <label
                    key={repo.id}
                    htmlFor={`repo-checkbox-${repo.id}`}
                    className={`flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 cursor-pointer ${
                      isConnected ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <Checkbox
                      id={`repo-checkbox-${repo.id}`}
                      checked={isConnected || selectedIds.has(repo.id)}
                      disabled={isConnected}
                      onCheckedChange={() => handleToggle(repo.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {repo.fullName}
                        </span>
                        {repo.isPrivate ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        )}
                        {isConnected && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Connected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {repo.language && <span>{repo.language}</span>}
                        {repo.stargazersCount > 0 && (
                          <span>{repo.stargazersCount} stars</span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            {selectedCount > 0 ? (
              `Select ${selectedCount} Repositor${selectedCount === 1 ? "y" : "ies"}`
            ) : (
              "Select Repositories"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
