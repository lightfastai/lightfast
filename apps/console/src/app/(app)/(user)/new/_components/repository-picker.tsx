"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Github, Search, Check, Loader2 } from "lucide-react";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";

/**
 * Repository Picker
 * Client island for repository selection with installation filtering and search
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
    selectedRepository,
    setSelectedRepository,
  } = useWorkspaceForm();

  // Fetch repositories for selected installation
  // Use user router for pending user support
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

  // Handle adjusting GitHub App permissions
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
              setSelectedRepository(null);
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

      {/* Repository List */}
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
          <div className="divide-y">
            {filteredRepositories.map((repo) => (
              <button
                key={repo.id}
                onClick={() => setSelectedRepository(repo)}
                className={`w-full flex items-center justify-between p-4 hover:bg-accent transition-colors text-left ${
                  selectedRepository?.id === repo.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
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
                  </div>
                </div>
                {selectedRepository?.id === repo.id && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </button>
            ))}
          </div>
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
