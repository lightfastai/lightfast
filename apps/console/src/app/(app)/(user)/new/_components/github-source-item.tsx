"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
import { useTRPC } from "@repo/console-trpc/react";
import { githubEnv } from "@repo/console-octokit-github/env";
import { useWorkspaceForm } from "./workspace-form-provider";
import { useOAuthPopup } from "./use-oauth-popup";

/**
 * GitHub accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page).
 * Shows inline repo picker when connected, connect button otherwise.
 */
export function GitHubSourceItem() {
  const trpc = useTRPC();
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
  const [showPicker, setShowPicker] = useState(true);
  const prevInstallationsRef = useRef<typeof installations>([]);
  const preferNewestRef = useRef(false);
  const installationIdsBeforeRef = useRef<Set<string>>(new Set());

  const { handleConnect: connectOAuth, openCustomUrl } = useOAuthPopup({
    provider: "github",
    queryKeysToInvalidate: [
      trpc.connections.github.list.queryOptions().queryKey,
      [["connections", "github", "repositories"]],
    ],
    onSuccess: () => {
      preferNewestRef.current = true;
    },
  });

  const handleConnect = () => {
    installationIdsBeforeRef.current = new Set(
      installations.map((i) => i.id),
    );
    void connectOAuth();
  };

  const handleAdjustPermissions = () => {
    installationIdsBeforeRef.current = new Set(
      installations.map((i) => i.id),
    );
    void openCustomUrl(
      (data) =>
        `https://github.com/apps/${githubEnv.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target?state=${data.state}`,
    );
  };

  // Fetch GitHub connection (prefetched by parent page RSC)
  const { data: connection } = useSuspenseQuery({
    ...trpc.connections.github.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const connectionInstallations = connection?.installations ?? [];
  const hasConnection = Boolean(connection && connectionInstallations.length > 0);

  // Sync gwInstallationId from the selected installation (each GitHub org
  // lives in its own gwInstallations row with a distinct id).
  useEffect(() => {
    setGwInstallationId(selectedInstallation?.gwInstallationId ?? null);
  }, [selectedInstallation?.gwInstallationId, setGwInstallationId]);

  // Sync installations array (with ID equality check to avoid re-renders)
  useEffect(() => {
    const prevIds = prevInstallationsRef.current.map((i) => i.id).join(",");
    const newIds = connectionInstallations.map((i) => i.id).join(",");
    if (prevIds !== newIds) {
      setInstallations(connectionInstallations);
      prevInstallationsRef.current = connectionInstallations;
    }
  }, [connectionInstallations, setInstallations]);

  // Auto-select installation (prefer newest after OAuth)
  useEffect(() => {
    if (connectionInstallations.length === 0) {
      if (selectedInstallation !== null) setSelectedInstallation(null);
      return;
    }
    // After OAuth: prefer the newly added installation
    if (preferNewestRef.current) {
      preferNewestRef.current = false;
      const beforeIds = installationIdsBeforeRef.current;
      const newInst = connectionInstallations.find(
        (inst) => !beforeIds.has(inst.id),
      );
      if (newInst) {
        setSelectedInstallation(newInst);
        setSelectedRepositories([]);
        return;
      }
    }
    // Default: select first if current selection no longer exists
    const stillExists = selectedInstallation
      ? connectionInstallations.some((inst) => inst.id === selectedInstallation.id)
      : false;
    if (!stillExists) {
      const first = connectionInstallations[0];
      if (first && selectedInstallation?.id !== first.id) {
        setSelectedInstallation(first);
      }
    }
  }, [connectionInstallations, selectedInstallation, setSelectedInstallation, setSelectedRepositories]);

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

  const selectedRepo = selectedRepositories[0] ?? null;

  return (
    <AccordionItem value="github">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <IntegrationLogoIcons.github className="h-5 w-5 shrink-0" />
          <span className="font-medium">GitHub</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
          )}
          {selectedRepo && (
            <Badge variant="default" className="text-xs ml-auto mr-2">
              1 selected
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
              <IntegrationLogoIcons.github className="h-4 w-4 mr-2" />
              Connect GitHub
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {selectedRepo && !showPicker ? (
              /* Selected card view */
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                    <IntegrationLogoIcons.github className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{selectedRepo.name}</span>
                      {selectedRepo.isPrivate && (
                        <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                          Private
                        </span>
                      )}
                    </div>
                    {selectedRepo.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {selectedRepo.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedRepositories([]);
                        setShowPicker(true);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {installations.map((inst) => (
                        <SelectItem key={inst.id} value={inst.accountLogin}>
                          <div className="flex items-center gap-2">
                            {inst.avatarUrl ? (
                              <Image
                                src={inst.avatarUrl}
                                alt=""
                                width={16}
                                height={16}
                                className="rounded-full"
                              />
                            ) : (
                              <IntegrationLogoIcons.github className="h-4 w-4" />
                            )}
                            {inst.accountLogin}
                          </div>
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
                <div className="rounded-lg border bg-card max-h-[260px] overflow-y-auto">
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
                    <div className="divide-y">
                      {filteredRepositories.map((repo) => (
                        <button
                          key={repo.id}
                          type="button"
                          className={`flex items-center gap-3 p-4 w-full text-left hover:bg-accent transition-colors cursor-pointer ${
                            selectedRepo?.id === repo.id ? "bg-accent/50" : ""
                          }`}
                          onClick={() => {
                            toggleRepository(repo);
                            setShowPicker(false);
                          }}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                            <IntegrationLogoIcons.github className="h-3 w-3" />
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
                        </button>
                      ))}
                    </div>
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
              </>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
