"use client";

import { useEffect, useState } from "react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";

/**
 * Sentry accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page via sentry.get).
 * Shows inline project picker when connected, connect button otherwise.
 */
export function SentrySourceItem() {
  const trpc = useTRPC();
  const {
    sentryConnection,
    setSentryConnection,
    sentryInstallationId,
    setSentryInstallationId,
    selectedSentryProjects,
    setSelectedSentryProjects,
    toggleSentryProject,
  } = useWorkspaceForm();

  const [searchQuery, setSearchQuery] = useState("");
  const [showPicker, setShowPicker] = useState(true);

  const { handleConnect } = useOAuthPopup({
    provider: "sentry",
    queryKeysToInvalidate: [
      trpc.connections.sentry.get.queryOptions().queryKey,
      [["connections", "sentry", "listProjects"]],
    ],
  });

  // Fetch Sentry connection (prefetched by parent page RSC)
  const { data: sentryData } = useSuspenseQuery({
    ...trpc.connections.sentry.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const hasConnection = sentryData !== null;

  // Sync connection to form state
  useEffect(() => {
    if (sentryData?.id !== sentryConnection?.id) {
      setSentryConnection(sentryData);
    }
  }, [sentryData, sentryConnection?.id, setSentryConnection]);

  // Sync sentryInstallationId from the connection
  useEffect(() => {
    setSentryInstallationId(sentryData?.id ?? null);
  }, [sentryData?.id, setSentryInstallationId]);

  // Fetch Sentry projects (no workspaceId — workspace doesn't exist yet)
  const { data: projectsData, isLoading: isLoadingProjects, error: projectsError } = useQuery({
    ...trpc.connections.sentry.listProjects.queryOptions({
      installationId: sentryInstallationId ?? "",
    }),
    enabled: Boolean(sentryInstallationId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const projects = projectsData?.projects ?? [];
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedProject = selectedSentryProjects[0] ?? null;

  return (
    <AccordionItem value="sentry">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <IntegrationLogoIcons.sentry className="h-5 w-5 shrink-0" />
          <span className="font-medium">Sentry</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
          )}
          {selectedProject && (
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
              Connect Sentry to monitor errors and performance
            </p>
            <Button onClick={handleConnect} variant="outline">
              <IntegrationLogoIcons.sentry className="h-4 w-4 mr-2" />
              Connect Sentry
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {selectedProject && !showPicker ? (
              /* Selected card view */
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                    <IntegrationLogoIcons.sentry className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{selectedProject.name}</span>
                      {selectedProject.platform && (
                        <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                          {selectedProject.platform}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedProject.slug}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSentryProjects([]);
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
                {/* Org slug header + Search */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 shrink-0">
                    <IntegrationLogoIcons.sentry className="h-3 w-3" />
                    <span className="text-sm font-medium">Sentry</span>
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Project List */}
                <div className="rounded-lg border bg-card max-h-[260px] overflow-y-auto">
                  {projectsError ? (
                    <div className="flex flex-col items-center py-6 text-center gap-3">
                      <p className="text-sm text-destructive">
                        Failed to load projects. The connection may need to be refreshed.
                      </p>
                      <Button onClick={handleConnect} variant="outline" size="sm">
                        Reconnect Sentry
                      </Button>
                    </div>
                  ) : isLoadingProjects ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading projects...
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {searchQuery ? "No projects match your search" : "No projects found"}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className={`flex items-center gap-3 p-4 w-full text-left hover:bg-accent transition-colors cursor-pointer ${
                            selectedProject?.id === project.id ? "bg-accent/50" : ""
                          }`}
                          onClick={() => {
                            toggleSentryProject(project);
                            setShowPicker(false);
                          }}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                            <IntegrationLogoIcons.sentry className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{project.name}</span>
                              {project.platform && (
                                <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                                  {project.platform}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {project.slug}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing project link */}
                <div className="text-center text-sm text-muted-foreground">
                  Missing a project?{" "}
                  <button
                    onClick={handleConnect}
                    className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
                  >
                    Reconnect Sentry →
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
