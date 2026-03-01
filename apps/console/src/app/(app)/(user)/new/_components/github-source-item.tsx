"use client";

import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Github, Search, Loader2 } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { githubEnv } from "@repo/console-octokit-github/env";
import { useWorkspaceForm } from "./workspace-form-provider";

/**
 * GitHub accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page).
 * Shows inline repo picker when connected, connect button otherwise.
 */
export function GitHubSourceItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    gwInstallationId,
    setGwInstallationId,
    installations,
    setInstallations,
    selectedInstallation,
    setSelectedInstallation,
    selectedRepositories,
    setSelectedRepositories,
    toggleRepository,
  } = useWorkspaceForm();

  const [searchQuery, setSearchQuery] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevInstallationsRef = useRef<typeof installations>([]);

  // Fetch GitHub connection (prefetched by parent page RSC)
  const { data: connection, refetch: refetchConnection } = useSuspenseQuery({
    ...trpc.connections.github.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const connectionInstallations = connection?.installations ?? [];
  const hasConnection = Boolean(connection && connectionInstallations.length > 0);

  // Sync gwInstallationId when connection changes
  useEffect(() => {
    setGwInstallationId(connection?.id ?? null);
  }, [connection?.id, setGwInstallationId]);

  // Sync installations array (with ID equality check to avoid re-renders)
  useEffect(() => {
    const prevIds = prevInstallationsRef.current.map((i) => i.id).join(",");
    const newIds = connectionInstallations.map((i) => i.id).join(",");
    if (prevIds !== newIds) {
      setInstallations(connectionInstallations);
      prevInstallationsRef.current = connectionInstallations;
    }
  }, [connectionInstallations, setInstallations]);

  // Auto-select first installation
  useEffect(() => {
    if (connectionInstallations.length === 0) {
      if (selectedInstallation !== null) setSelectedInstallation(null);
      return;
    }
    const stillExists = selectedInstallation
      ? connectionInstallations.some((inst) => inst.id === selectedInstallation.id)
      : false;
    if (!stillExists) {
      const first = connectionInstallations[0];
      if (first && selectedInstallation?.id !== first.id) {
        setSelectedInstallation(first);
      }
    }
  }, [connectionInstallations, selectedInstallation, setSelectedInstallation]);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Fetch repos for selected installation
  const { data: repositoriesData, isLoading: isLoadingRepos } = useQuery({
    ...trpc.connections.github.repositories.queryOptions({
      integrationId: gwInstallationId ?? "",
      installationId: selectedInstallation?.id ?? "",
    }),
    enabled: Boolean(gwInstallationId && selectedInstallation),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const repositories = repositoriesData ?? [];
  const filteredRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isSelected = (repoId: string) => selectedRepositories.some((r) => r.id === repoId);
  const selectedFromFiltered = filteredRepositories.filter((r) => isSelected(r.id)).length;

  const handleSelectAll = () => {
    const unselected = filteredRepositories.filter((r) => !isSelected(r.id));
    setSelectedRepositories([...selectedRepositories, ...unselected]);
  };

  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredRepositories.map((r) => r.id));
    setSelectedRepositories(selectedRepositories.filter((r) => !filteredIds.has(r.id)));
  };

  const handleAdjustPermissions = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "github" }),
      );
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        `https://github.com/apps/${githubEnv.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target?state=${data.state}`,
        "github-permissions",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
      );
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (popup?.closed) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          void refetchConnection();
        }
      }, 500);
    } catch {
      toast.error("Failed to adjust GitHub permissions. Please try again.");
    }
  };

  const handleConnect = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "github" }),
      );
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.url,
        "github-install",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
      );
      if (!popup || popup.closed) {
        alert("Popup was blocked. Please allow popups for this site.");
        return;
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (popup.closed) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          void refetchConnection();
        }
      }, 500);
    } catch {
      toast.error("Failed to connect to GitHub. Please try again.");
    }
  };

  return (
    <AccordionItem value="github">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <Github className="h-5 w-5 shrink-0" />
          <span className="font-medium">GitHub</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
          )}
          {selectedRepositories.length > 0 && (
            <Badge variant="default" className="text-xs ml-auto mr-2">
              {selectedRepositories.length} selected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {!hasConnection ? (
          <div className="flex flex-col items-center py-6 text-center gap-4">
            <p className="text-sm text-muted-foreground">
              Connect GitHub to select repositories
            </p>
            <Button onClick={handleConnect} variant="outline">
              <Github className="h-4 w-4 mr-2" />
              Connect GitHub
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Installation Selector & Search */}
            <div className="flex gap-4">
              <Select
                value={selectedInstallation?.accountLogin}
                onValueChange={(login) => {
                  const inst = installations.find((i) => i.accountLogin === login);
                  if (inst) {
                    setSelectedInstallation(inst);
                    setSelectedRepositories([]);
                  }
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {installations.map((inst) => (
                    <SelectItem key={inst.id} value={inst.accountLogin}>
                      {inst.accountLogin}
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
            <div className="r max-h-[260px] overflow-y-auto">
              {isLoadingRepos ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading repositories...
                </div>
              ) : filteredRepositories.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? "No repositories match your search" : "No repositories found"}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <span className="text-sm text-muted-foreground">
                      {filteredRepositories.length} repo{filteredRepositories.length === 1 ? "" : "s"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectedFromFiltered === filteredRepositories.length ? handleDeselectAll : handleSelectAll}
                    >
                      {selectedFromFiltered === filteredRepositories.length ? "Deselect all" : "Select all"}
                    </Button>
                  </div>
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                          <Github className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{repo.name}</span>
                            {repo.isPrivate && (
                              <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{repo.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Missing repository link */}
            <div className="text-center text-sm text-muted-foreground">
              Missing a repository?{" "}
              <button
                onClick={handleAdjustPermissions}
                className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
              >
                Adjust GitHub App permissions →
              </button>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
