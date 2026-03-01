"use client";

import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
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
import { toast } from "@repo/ui/components/ui/sonner";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { FrameworkIcons } from "@repo/ui/framework-icons";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";

function FrameworkIcon({ framework, className }: { framework: string | null; className?: string }) {
  const icon = framework ? FrameworkIcons[framework] : null;
  if (icon) return icon({ className });
  return <IntegrationLogoIcons.vercel className={className} />;
}

/**
 * Vercel accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page via vercel.list).
 * Shows inline project picker when connected, connect button otherwise.
 */
export function VercelSourceItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevInstallationsRef = useRef<typeof _vercelInstallations>([]);

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

  // Auto-select first installation
  useEffect(() => {
    if (connectionInstallations.length === 0) {
      if (selectedVercelInstallation !== null) setSelectedVercelInstallation(null);
      return;
    }
    const stillExists = selectedVercelInstallation
      ? connectionInstallations.some((inst) => inst.id === selectedVercelInstallation.id)
      : false;
    if (!stillExists) {
      const first = connectionInstallations[0];
      if (first && selectedVercelInstallation?.id !== first.id) {
        setSelectedVercelInstallation(first);
      }
    }
  }, [connectionInstallations, selectedVercelInstallation, setSelectedVercelInstallation]);

  // Sync vercelInstallationId from the selected installation
  useEffect(() => {
    setVercelInstallationId(selectedVercelInstallation?.id ?? null);
  }, [selectedVercelInstallation?.id, setVercelInstallationId]);

  // Listen for postMessage from the connected page (fires before popup closes)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "vercel_connected") {
        void queryClient.invalidateQueries({
          queryKey: trpc.connections.vercel.list.queryOptions().queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: [["connections", "vercel", "listProjects"]],
        });
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [queryClient, trpc]);

  // Fetch Vercel projects (no workspaceId — workspace doesn't exist yet)
  const { data: projectsData, isLoading: isLoadingProjects, error: projectsError } = useQuery({
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
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedProject = selectedProjects[0] ?? null;

  const handleConnect = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "vercel" }),
      );
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.url,
        "vercel-install",
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
          void queryClient.invalidateQueries({
            queryKey: trpc.connections.vercel.list.queryOptions().queryKey,
          });
          void queryClient.invalidateQueries({
            queryKey: [["connections", "vercel", "listProjects"]],
          });
        }
      }, 500);
    } catch {
      toast.error("Failed to connect to Vercel. Please try again.");
    }
  };

  /** Display label for a Vercel installation */
  const getInstallationLabel = (inst: (typeof connectionInstallations)[number]) =>
    inst.accountLogin;

  return (
    <AccordionItem value="vercel">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <IntegrationLogoIcons.vercel className="h-5 w-5 shrink-0" />
          <span className="font-medium">Vercel</span>
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
              Connect Vercel to select projects
            </p>
            <Button onClick={handleConnect} variant="outline">
              <IntegrationLogoIcons.vercel className="h-4 w-4 mr-2" />
              Connect Vercel
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {selectedProject && !showPicker ? (
              /* Selected card view */
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                    <FrameworkIcon framework={selectedProject.framework} className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{selectedProject.name}</span>
                      {selectedProject.framework && (
                        <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                          {selectedProject.framework}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProjects([]);
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
                {/* Team Selector & Search */}
                <div className="flex gap-4">
                  <Select
                    value={selectedVercelInstallation?.id}
                    onValueChange={(id) => {
                      const inst = connectionInstallations.find((i) => i.id === id);
                      if (inst) {
                        setSelectedVercelInstallation(inst);
                        setSelectedProjects([]);
                      }
                    }}
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
                        Reconnect Vercel
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
                            toggleProject(project);
                            setShowPicker(false);
                          }}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                            <FrameworkIcon framework={project.framework} className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{project.name}</span>
                              {project.framework && (
                                <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
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
                <div className="text-center text-sm text-muted-foreground">
                  Missing a project?{" "}
                  <button
                    onClick={handleConnect}
                    className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
                  >
                    Reconnect Vercel →
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
