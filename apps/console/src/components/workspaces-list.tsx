"use client";

import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface WorkspacesListProps {
  orgSlug: string;
}

export function WorkspacesList({ orgSlug }: WorkspacesListProps) {
  const trpc = useTRPC();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch workspaces for this organization (prefetched in layout via user endpoint)
  const { data: workspaces = [] } = useSuspenseQuery({
    ...trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
      clerkOrgSlug: orgSlug,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Filter workspaces by search query (search by name)
  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Search and Create Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces..."
            value={searchQuery}
          />
        </div>
        <Button asChild className="gap-2" size="sm">
          <Link href={`/new?teamSlug=${orgSlug}`}>
            <Plus className="h-4 w-4" />
            New workspace
          </Link>
        </Button>
      </div>

      {/* Empty States */}
      {filteredWorkspaces.length === 0 && searchQuery ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="font-medium text-sm">No workspaces found</p>
          <p className="mt-1 text-muted-foreground text-xs">
            No workspaces matching &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-medium text-sm">No workspaces yet</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Create your first workspace to get started
          </p>
        </div>
      ) : (
        <>
          {/* Workspaces Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkspaces.map((workspace) => {
              return (
                <Link
                  prefetch
                  className="group"
                  href={`/${orgSlug}/${workspace.name}`}
                  key={workspace.id}
                >
                  <Card className="h-full rounded-md border-border/50 bg-card/40 py-0 transition-colors hover:bg-accent/50">
                    <CardContent className="space-y-4 p-5">
                      {/* Header: Name */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-semibold text-base transition-colors group-hover:text-primary">
                            {workspace.name}
                          </h3>
                        </div>
                      </div>

                      {/* Created Date */}
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Created {formatRelativeTime(workspace.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return "just now";
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
