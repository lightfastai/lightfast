"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import {
  Plus,
  Search,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";

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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button className="gap-2" asChild>
          <Link href={`/new?teamSlug=${orgSlug}`}>
            <Plus className="h-4 w-4" />
            New workspace
          </Link>
        </Button>
      </div>

      {/* Empty States */}
      {filteredWorkspaces.length === 0 && searchQuery ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium">No workspaces found</p>
          <p className="text-xs text-muted-foreground mt-1">
            No workspaces matching &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium">No workspaces yet</p>
          <p className="text-xs text-muted-foreground mt-1">
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
                  key={workspace.id}
                  href={`/${orgSlug}/${workspace.name}`}
                  className="group"
                >
                  <Card className="h-full transition-colors py-0 hover:bg-accent/50 border-border/60 rounded-sm">
                    <CardContent className="p-5 space-y-4">
                      {/* Header: Name */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                            {workspace.name}
                          </h3>
                        </div>
                      </div>

                      {/* Created Date */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 30) return `${diffInDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
