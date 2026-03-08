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
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import type { LinearTeam } from "./workspace-form-provider";
import { useWorkspaceForm } from "./workspace-form-provider";

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
  const teamsError =
    teamsQueries.every((q) => q.error) && teamsQueries.length > 0
      ? (teamsQueries[0]?.error ?? null)
      : null;

  // Merge teams from all installations, tagging each with its installationId
  const teams: LinearTeam[] = useMemo(() => {
    const result: LinearTeam[] = [];
    for (let i = 0; i < linearData.length; i++) {
      const conn = linearData[i];
      if (!conn) {
        continue;
      }
      const query = teamsQueries[i];
      if (query?.data?.teams) {
        for (const team of query.data.teams) {
          result.push({ ...team, installationId: conn.id });
        }
      }
    }
    return result;
  }, [linearData, teamsQueries]);

  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AccordionItem value="linear">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <IntegrationLogoIcons.linear className="h-5 w-5 shrink-0" />
          <span className="font-medium">Linear</span>
          {hasConnection ? (
            <Badge className="text-xs" variant="secondary">
              Connected
            </Badge>
          ) : (
            <Badge className="text-muted-foreground text-xs" variant="outline">
              Not connected
            </Badge>
          )}
          {selectedLinearTeam && (
            <Badge className="mr-2 ml-auto text-xs" variant="default">
              1 selected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {hasConnection ? (
          <div className="space-y-4 pt-2">
            {selectedLinearTeam && !showPicker ? (
              /* Selected card view */
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: selectedLinearTeam.color ?? undefined,
                    }}
                  >
                    <span className="font-bold text-white text-xs">
                      {selectedLinearTeam.key}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {selectedLinearTeam.name}
                      </span>
                      <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                        {selectedLinearTeam.key}
                      </span>
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
                        setSelectedLinearTeam(null);
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
                {/* Search */}
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search teams..."
                    value={searchQuery}
                  />
                </div>

                {/* Team List */}
                <div className="max-h-[260px] overflow-y-auto rounded-lg border bg-card">
                  {teamsError ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <p className="text-destructive text-sm">
                        Failed to load teams. The connection may need to be
                        refreshed.
                      </p>
                      <Button
                        onClick={handleConnect}
                        size="sm"
                        variant="outline"
                      >
                        Reconnect Linear
                      </Button>
                    </div>
                  ) : isLoadingTeams ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading teams...
                    </div>
                  ) : filteredTeams.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {searchQuery
                        ? "No teams match your search"
                        : "No teams found"}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredTeams.map((team) => (
                        <button
                          className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent ${
                            selectedLinearTeam?.id === team.id
                              ? "bg-accent/50"
                              : ""
                          }`}
                          key={team.id}
                          onClick={() => {
                            setSelectedLinearTeam(
                              selectedLinearTeam?.id === team.id ? null : team
                            );
                            if (selectedLinearTeam?.id !== team.id) {
                              setShowPicker(false);
                            }
                          }}
                          type="button"
                        >
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: team.color ?? undefined }}
                          >
                            <span className="font-bold text-white text-xs">
                              {team.key}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {team.name}
                              </span>
                              <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                                {team.key}
                              </span>
                            </div>
                            {team.description && (
                              <p className="mt-0.5 truncate text-muted-foreground text-xs">
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
                <div className="text-center text-muted-foreground text-sm">
                  Missing a team?{" "}
                  <button
                    className="text-blue-500 underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                    onClick={handleConnect}
                  >
                    Reconnect Linear →
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Connect Linear to track issues and projects
            </p>
            <Button onClick={handleConnect} variant="outline">
              <IntegrationLogoIcons.linear className="mr-2 h-4 w-4" />
              Connect Linear
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
