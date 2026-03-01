"use client";

import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";

function LinearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

/**
 * Linear accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page via linear.get).
 * Shows inline team picker when connected, connect button otherwise.
 */
export function LinearSourceItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    linearConnection,
    setLinearConnection,
    linearInstallationId,
    setLinearInstallationId,
    selectedLinearTeam,
    setSelectedLinearTeam,
  } = useWorkspaceForm();

  const [searchQuery, setSearchQuery] = useState("");
  const [showPicker, setShowPicker] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Linear connection (prefetched by parent page RSC)
  const { data: linearData, refetch: refetchConnection } = useSuspenseQuery({
    ...trpc.connections.linear.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const hasConnection = linearData !== null;

  // Sync connection to form state
  useEffect(() => {
    if (linearData?.id !== linearConnection?.id) {
      setLinearConnection(linearData);
    }
  }, [linearData, linearConnection?.id, setLinearConnection]);

  // Sync linearInstallationId from the connection
  useEffect(() => {
    setLinearInstallationId(linearData?.id ?? null);
  }, [linearData?.id, setLinearInstallationId]);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Fetch Linear teams (no workspaceId — workspace doesn't exist yet)
  const { data: teamsData, isLoading: isLoadingTeams, error: teamsError } = useQuery({
    ...trpc.connections.linear.listTeams.queryOptions({
      installationId: linearInstallationId ?? "",
    }),
    enabled: Boolean(linearInstallationId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const teams = teamsData?.teams ?? [];
  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.key.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleConnect = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "linear" }),
      );
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.url,
        "linear-install",
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
          void queryClient.invalidateQueries({
            queryKey: [["connections", "linear", "listTeams"]],
          });
        }
      }, 500);
    } catch {
      toast.error("Failed to connect to Linear. Please try again.");
    }
  };

  return (
    <AccordionItem value="linear">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <LinearIcon className="h-5 w-5 shrink-0" />
          <span className="font-medium">Linear</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
          )}
          {selectedLinearTeam && (
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
              Connect Linear to track issues and projects
            </p>
            <Button onClick={handleConnect} variant="outline">
              <LinearIcon className="h-4 w-4 mr-2" />
              Connect Linear
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {selectedLinearTeam && !showPicker ? (
              /* Selected card view */
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                    style={{ backgroundColor: selectedLinearTeam.color ?? undefined }}
                  >
                    <span className="text-xs font-bold text-white">
                      {selectedLinearTeam.key}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{selectedLinearTeam.name}</span>
                      <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                        {selectedLinearTeam.key}
                      </span>
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
                        setSelectedLinearTeam(null);
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
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search teams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Team List */}
                <div className="rounded-lg border bg-card max-h-[260px] overflow-y-auto">
                  {teamsError ? (
                    <div className="flex flex-col items-center py-6 text-center gap-3">
                      <p className="text-sm text-destructive">
                        Failed to load teams. The connection may need to be refreshed.
                      </p>
                      <Button onClick={handleConnect} variant="outline" size="sm">
                        Reconnect Linear
                      </Button>
                    </div>
                  ) : isLoadingTeams ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading teams...
                    </div>
                  ) : filteredTeams.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {searchQuery ? "No teams match your search" : "No teams found"}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredTeams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          className={`flex items-center gap-3 p-4 w-full text-left hover:bg-accent transition-colors cursor-pointer ${
                            selectedLinearTeam?.id === team.id ? "bg-accent/50" : ""
                          }`}
                          onClick={() => {
                            setSelectedLinearTeam(
                              selectedLinearTeam?.id === team.id ? null : team,
                            );
                            if (selectedLinearTeam?.id !== team.id) {
                              setShowPicker(false);
                            }
                          }}
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                            style={{ backgroundColor: team.color ?? undefined }}
                          >
                            <span className="text-xs font-bold text-white">
                              {team.key}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{team.name}</span>
                              <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                                {team.key}
                              </span>
                            </div>
                            {team.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {team.description}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing team link */}
                <div className="text-center text-sm text-muted-foreground">
                  Missing a team?{" "}
                  <button
                    onClick={handleConnect}
                    className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
                  >
                    Reconnect Linear →
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
