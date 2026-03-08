"use client";

import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TeamSwitcherLink } from "./team-switcher-link";

interface WorkspaceSwitcherProps {
  orgSlug: string;
  workspaceName: string;
}

export function WorkspaceSwitcher({
  orgSlug,
  workspaceName,
}: WorkspaceSwitcherProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  // Fetch organizations to get current org
  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Find current organization by slug from URL (not Clerk's active org)
  const currentOrg = orgSlug
    ? organizations.find((org) => org.slug === orgSlug)
    : null;

  // Fetch workspaces for current org by slug
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } = useQuery({
    ...trpc.workspace.listByClerkOrgSlug.queryOptions({
      clerkOrgSlug: currentOrg?.slug ?? "",
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(currentOrg?.slug),
  });

  // Find current workspace by name (name is used in URLs)
  const currentWorkspace = workspaceName
    ? workspaces.find((ws) => ws.name === workspaceName)
    : null;

  // Removed handleSelectWorkspace - now using TeamSwitcherLink pattern

  // Hide component until data is ready (after all hooks are called)
  if (!currentOrg || isLoadingWorkspaces) {
    return null;
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <div className="flex items-center gap-1">
        {/* Clickable area - navigates to workspace (no styling) */}
        {currentWorkspace ? (
          <TeamSwitcherLink
            className="flex min-w-0 items-center"
            orgId={currentOrg.id}
            orgSlug={currentOrg.slug}
            workspaceName={currentWorkspace.name}
          >
            <span className="truncate font-medium text-sm">
              {currentWorkspace.name}
            </span>
          </TeamSwitcherLink>
        ) : (
          <div className="flex min-w-0 items-center">
            <span className="truncate font-medium text-sm">
              {workspaceName}
            </span>
          </div>
        )}

        {/* Dropdown chevron trigger - shadcn ghost button */}
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        align="center"
        className="w-[280px] space-y-1 bg-background"
      >
        <div className="px-2 py-1.5">
          <p className="font-medium text-muted-foreground text-xs">
            Workspaces
          </p>
        </div>
        {workspaces.map((workspace) => {
          const isSelected = currentWorkspace?.id === workspace.id;

          return (
            <DropdownMenuItem asChild className="p-0" key={workspace.id}>
              <TeamSwitcherLink
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent focus:bg-accent",
                  isSelected && "bg-muted/50"
                )}
                onSwitch={() => setOpen(false)}
                orgId={currentOrg.id}
                orgSlug={currentOrg.slug}
                workspaceName={workspace.name}
              >
                <span className="flex-1 truncate text-left">
                  {workspace.name}
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                )}
              </TeamSwitcherLink>
            </DropdownMenuItem>
          );
        })}

        {/* Create Workspace */}
        <DropdownMenuItem asChild className="p-0">
          <Link
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent"
            href="/new"
            prefetch={true}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/50 border-dashed">
              <Plus className="h-3 w-3" />
            </div>
            <span>Create Workspace</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
