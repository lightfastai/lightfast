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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { FrameworkIcons } from "@repo/ui/framework-icons";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import { useWorkspaceForm } from "./workspace-form-provider";

function FrameworkIcon({
  framework,
  className,
}: {
  framework: string | null;
  className?: string;
}) {
  const icon = framework ? FrameworkIcons[framework] : null;
  if (icon) {
    return icon({ className });
  }
  return <IntegrationLogoIcons.vercel className={className} />;
}

/**
 * Vercel accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page via vercel.list).
 * Shows inline project picker when connected, connect button otherwise.
 */
export function VercelSourceItem() {
  const trpc = useTRPC();
  const {
    vercelInstallationId,
    setVercelInstallationId,
    vercelInstallations: _vercelInstallations,
    setVercelInstallations,
    selectedVercelInstallation,
    setSelectedVercelInstallation,
    selectedProjects,
    setSelectedProjects,
    toggleProject,
  } = useWorkspaceForm();

  const [searchQuery, setSearchQuery] = useState("");
  const [showPicker, setShowPicker] = useState(true);
  const prevInstallationsRef = useRef<typeof _vercelInstallations>([]);
  const preferNewestRef = useRef(false);
  const installationIdsBeforeRef = useRef<Set<string>>(new Set());

  const { handleConnect: connectOAuth } = useOAuthPopup({
    provider: "vercel",
    queryKeysToInvalidate: [
      trpc.connections.vercel.list.queryOptions().queryKey,
      [["connections", "vercel", "listProjects"]],
    ],
    onSuccess: () => {
      preferNewestRef.current = true;
    },
  });

  const handleConnect = () => {
    installationIdsBeforeRef.current = new Set(
      connectionInstallations.map((i) => i.id)
    );
    void connectOAuth();
  };

  // Fetch Vercel installations (prefetched by parent page RSC)
  const { data: listData } = useSuspenseQuery({
    ...trpc.connections.vercel.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const connectionInstallations = listData.installations;
  const hasConnection = connectionInstallations.length > 0;

  // Sync installations array (with ID equality check to avoid re-renders)
  useEffect(() => {
    const prevIds = prevInstallationsRef.current.map((i) => i.id).join(",");
    const newIds = connectionInstallations.map((i) => i.id).join(",");
    if (prevIds !== newIds) {
      setVercelInstallations(connectionInstallations);
      prevInstallationsRef.current = connectionInstallations;
    }
  }, [connectionInstallations, setVercelInstallations]);

  // Auto-select installation (prefer newest after OAuth)
  useEffect(() => {
    if (connectionInstallations.length === 0) {
      if (selectedVercelInstallation !== null) {
        setSelectedVercelInstallation(null);
      }
      return;
    }
    // After OAuth: prefer the newly added installation
    if (preferNewestRef.current) {
      preferNewestRef.current = false;
      const beforeIds = installationIdsBeforeRef.current;
      const newInst = connectionInstallations.find(
        (inst) => !beforeIds.has(inst.id)
      );
      if (newInst) {
        setSelectedVercelInstallation(newInst);
        setSelectedProjects([]);
        return;
      }
    }
    // Default: select first if current selection no longer exists
    const stillExists = selectedVercelInstallation
      ? connectionInstallations.some(
          (inst) => inst.id === selectedVercelInstallation.id
        )
      : false;
    if (!stillExists) {
      const first = connectionInstallations[0];
      if (first && selectedVercelInstallation?.id !== first.id) {
        setSelectedVercelInstallation(first);
      }
    }
  }, [
    connectionInstallations,
    selectedVercelInstallation,
    setSelectedVercelInstallation,
    setSelectedProjects,
  ]);

  // Sync vercelInstallationId from the selected installation
  useEffect(() => {
    setVercelInstallationId(selectedVercelInstallation?.id ?? null);
  }, [selectedVercelInstallation?.id, setVercelInstallationId]);

  // Fetch Vercel projects (no workspaceId — workspace doesn't exist yet)
  const {
    data: projectsData,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useQuery({
    ...trpc.connections.vercel.listProjects.queryOptions({
      installationId: vercelInstallationId ?? "",
    }),
    enabled: Boolean(vercelInstallationId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const projects = projectsData?.projects ?? [];
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProject = selectedProjects[0] ?? null;

  /** Display label for a Vercel installation */
  const getInstallationLabel = (
    inst: (typeof connectionInstallations)[number]
  ) => inst.accountLogin;

  return (
    <AccordionItem value="vercel">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <IntegrationLogoIcons.vercel className="h-5 w-5 shrink-0" />
          <span className="font-medium">Vercel</span>
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
                    <FrameworkIcon
                      className="h-4 w-4"
                      framework={selectedProject.framework}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {selectedProject.name}
                      </span>
                      {selectedProject.framework && (
                        <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                          {selectedProject.framework}
                        </span>
                      )}
                    </div>
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
                        setSelectedProjects([]);
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
                {/* Team Selector & Search */}
                <div className="flex gap-4">
                  <Select
                    onValueChange={(id) => {
                      const inst = connectionInstallations.find(
                        (i) => i.id === id
                      );
                      if (inst) {
                        setSelectedVercelInstallation(inst);
                        setSelectedProjects([]);
                      }
                    }}
                    value={selectedVercelInstallation?.id}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {connectionInstallations.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          <div className="flex items-center gap-2">
                            <IntegrationLogoIcons.vercel className="h-3 w-3" />
                            {getInstallationLabel(inst)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        Reconnect Vercel
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
                            toggleProject(project);
                            setShowPicker(false);
                          }}
                          type="button"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <FrameworkIcon
                              className="h-4 w-4"
                              framework={project.framework}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {project.name}
                              </span>
                              {project.framework && (
                                <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                                  {project.framework}
                                </span>
                              )}
                            </div>
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
                    Reconnect Vercel →
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Connect Vercel to select projects
            </p>
            <Button onClick={handleConnect} variant="outline">
              <IntegrationLogoIcons.vercel className="mr-2 h-4 w-4" />
              Connect Vercel
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
