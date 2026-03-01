"use client";

import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
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
import { useWorkspaceForm } from "./workspace-form-provider";

function VercelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 76 65"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
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
    vercelInstallations,
    setVercelInstallations,
    selectedVercelInstallation,
    setSelectedVercelInstallation,
    selectedProjects,
    setSelectedProjects,
    toggleProject,
  } = useWorkspaceForm();

  const [searchQuery, setSearchQuery] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevInstallationsRef = useRef<typeof vercelInstallations>([]);

  // Fetch Vercel installations (prefetched by parent page RSC)
  const { data: listData, refetch: refetchConnection } = useSuspenseQuery({
    ...trpc.connections.vercel.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const connectionInstallations = listData?.installations ?? [];
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

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

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

  const isSelected = (projectId: string) => selectedProjects.some((p) => p.id === projectId);
  const selectedFromFiltered = filteredProjects.filter((p) => isSelected(p.id)).length;

  const handleSelectAll = () => {
    const unselected = filteredProjects.filter((p) => !isSelected(p.id));
    setSelectedProjects([
      ...selectedProjects,
      ...unselected,
    ]);
  };

  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredProjects.map((p) => p.id));
    setSelectedProjects(selectedProjects.filter((p) => !filteredIds.has(p.id)));
  };

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
          void refetchConnection();
        }
      }, 500);
    } catch {
      toast.error("Failed to connect to Vercel. Please try again.");
    }
  };

  /** Display label for a Vercel installation */
  const getInstallationLabel = (inst: (typeof connectionInstallations)[number]) =>
    inst.teamSlug ?? "Personal";

  return (
    <AccordionItem value="vercel">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <VercelIcon className="h-5 w-5 shrink-0" />
          <span className="font-medium">Vercel</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
          )}
          {selectedProjects.length > 0 && (
            <Badge variant="default" className="text-xs ml-auto mr-2">
              {selectedProjects.length} selected
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
              <VercelIcon className="h-4 w-4 mr-2" />
              Connect Vercel
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Team Selector & Search */}
            <div className="flex gap-4">
              {connectionInstallations.length > 1 && (
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
                          <VercelIcon className="h-3 w-3" />
                          {getInstallationLabel(inst)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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

            {/* Selected Count & Clear */}
            {selectedProjects.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedProjects.length} project{selectedProjects.length === 1 ? "" : "s"} selected
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProjects([])}>
                  Clear all
                </Button>
              </div>
            )}

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
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <span className="text-sm text-muted-foreground">
                      {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectedFromFiltered === filteredProjects.length ? handleDeselectAll : handleSelectAll}
                    >
                      {selectedFromFiltered === filteredProjects.length ? "Deselect all" : "Select all"}
                    </Button>
                  </div>
                  <div className="divide-y">
                    {filteredProjects.map((project) => (
                      <label
                        key={project.id}
                        className={`flex items-center gap-3 p-4 hover:bg-accent transition-colors cursor-pointer ${
                          isSelected(project.id) ? "bg-accent/50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={isSelected(project.id)}
                          onCheckedChange={() => toggleProject(project)}
                        />
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                          <VercelIcon className="h-4 w-4" />
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
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
