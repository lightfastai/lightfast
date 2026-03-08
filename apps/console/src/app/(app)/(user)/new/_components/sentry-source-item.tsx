"use client";

import { useTRPC } from "@repo/console-trpc/react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import { useWorkspaceForm } from "./workspace-form-provider";

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
  const {
    data: projectsData,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useQuery({
    ...trpc.connections.sentry.listProjects.queryOptions({
      installationId: sentryInstallationId ?? "",
    }),
    enabled: Boolean(sentryInstallationId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const projects = projectsData?.projects ?? [];
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProject = selectedSentryProjects[0] ?? null;

  return (
    <AccordionItem value="sentry">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <IntegrationLogoIcons.sentry className="h-5 w-5 shrink-0" />
          <span className="font-medium">Sentry</span>
          {hasConnection ? (
            <Badge className="text-xs" variant="secondary">
              Connected
            </Badge>
          ) : (
            <Badge className="text-muted-foreground text-xs" variant="outline">
              Not connected
            </Badge>
          )}
          {selectedProject && (
            <Badge className="mr-2 ml-auto text-xs" variant="default">
              1 selected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {hasConnection ? (
          <div className="space-y-4 pt-2">
            {selectedProject && !showPicker ? (
              /* Selected card view */
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <IntegrationLogoIcons.sentry className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {selectedProject.name}
                      </span>
                      {selectedProject.platform && (
                        <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                          {selectedProject.platform}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {selectedProject.slug}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      onClick={() => setShowPicker(true)}
                      size="sm"
                      variant="outline"
                    >
                      Change
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedSentryProjects([]);
                        setShowPicker(true);
                      }}
                      size="sm"
                      variant="ghost"
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
                  <div className="flex shrink-0 items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                    <IntegrationLogoIcons.sentry className="h-3 w-3" />
                    <span className="font-medium text-sm">Sentry</span>
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search projects..."
                      value={searchQuery}
                    />
                  </div>
                </div>

                {/* Project List */}
                <div className="max-h-[260px] overflow-y-auto rounded-lg border bg-card">
                  {projectsError ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <p className="text-destructive text-sm">
                        Failed to load projects. The connection may need to be
                        refreshed.
                      </p>
                      <Button
                        onClick={handleConnect}
                        size="sm"
                        variant="outline"
                      >
                        Reconnect Sentry
                      </Button>
                    </div>
                  ) : isLoadingProjects ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading projects...
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {searchQuery
                        ? "No projects match your search"
                        : "No projects found"}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredProjects.map((project) => (
                        <button
                          className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent ${
                            selectedProject?.id === project.id
                              ? "bg-accent/50"
                              : ""
                          }`}
                          key={project.id}
                          onClick={() => {
                            toggleSentryProject(project);
                            setShowPicker(false);
                          }}
                          type="button"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <IntegrationLogoIcons.sentry className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {project.name}
                              </span>
                              {project.platform && (
                                <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                                  {project.platform}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-muted-foreground text-xs">
                              {project.slug}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing project link */}
                <div className="text-center text-muted-foreground text-sm">
                  Missing a project?{" "}
                  <button
                    className="text-blue-500 underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                    onClick={handleConnect}
                  >
                    Reconnect Sentry →
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Connect Sentry to monitor errors and performance
            </p>
            <Button onClick={handleConnect} variant="outline">
              <IntegrationLogoIcons.sentry className="mr-2 h-4 w-4" />
              Connect Sentry
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
