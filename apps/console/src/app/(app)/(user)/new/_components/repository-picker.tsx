"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Github, Search, Loader2 } from "lucide-react";
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
import { githubEnv } from "@repo/console-octokit-github/env";
import { useWorkspaceForm } from "./workspace-form-provider";

/**
 * Repository Picker
 * Client island for multi-repository selection with installation filtering and search
 */
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
      `https://github.com/apps/${githubEnv.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target`,
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
