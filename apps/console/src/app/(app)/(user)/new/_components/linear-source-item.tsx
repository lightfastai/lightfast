"use client";

import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery, useQueries } from "@tanstack/react-query";
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
import { useOAuthPopup } from "./use-oauth-popup";
import type { LinearTeam } from "./workspace-form-provider";

/**
 * Linear accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page via linear.get).
 * Shows inline team picker when connected, connect button otherwise.
 * Aggregates teams from all Linear installations.
 */
export function LinearSourceItem() {
  const trpc = useTRPC();
  const {
    linearConnections,
    setLinearConnections,
    selectedLinearTeam,
    setSelectedLinearTeam,
  } = useWorkspaceForm();

  const [searchQuery, setSearchQuery] = useState("");
  const [showPicker, setShowPicker] = useState(true);

  const { handleConnect } = useOAuthPopup({
    provider: "linear",
    queryKeysToInvalidate: [
      trpc.connections.linear.get.queryOptions().queryKey,
      [["connections", "linear", "listTeams"]],
    ],
  });

  // Fetch Linear connections (prefetched by parent page RSC)
  const { data: linearData } = useSuspenseQuery({
    ...trpc.connections.linear.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const hasConnection = linearData.length > 0;

  // Sync connections to form state
  useEffect(() => {
    const currentIds = linearConnections.map((c) => c.id).join(",");
    const newIds = linearData.map((c) => c.id).join(",");
    if (currentIds !== newIds) {
      setLinearConnections(linearData);
    }
  }, [linearData, linearConnections, setLinearConnections]);

  // Fetch teams from ALL installations in parallel
  const teamsQueries = useQueries({
    queries: linearData.map((conn) => ({
      ...trpc.connections.linear.listTeams.queryOptions({
        installationId: conn.id,
      }),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const isLoadingTeams = teamsQueries.some((q) => q.isLoading);
  const teamsError = teamsQueries.every((q) => q.error) && teamsQueries.length > 0
    ? teamsQueries[0]?.error ?? null
    : null;

  // Merge teams from all installations, tagging each with its installationId
  const teams: LinearTeam[] = useMemo(() => {
    const result: LinearTeam[] = [];
    for (let i = 0; i < linearData.length; i++) {
      const conn = linearData[i];
      if (!conn) continue;
      const query = teamsQueries[i];
      if (query?.data?.teams) {
        for (const team of query.data.teams) {
          result.push({ ...team, installationId: conn.id });
        }
      }
    }
    return result;
  }, [linearData, teamsQueries]);

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.key.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <AccordionItem value="linear">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <IntegrationLogoIcons.linear className="h-5 w-5 shrink-0" />
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
              <IntegrationLogoIcons.linear className="h-4 w-4 mr-2" />
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
