"use client";

import { useTRPC } from "@repo/console-trpc/react";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TeamSwitcherLink } from "./team-switcher-link";

type TeamSwitcherMode = "organization" | "account";

interface TeamSwitcherProps {
  /**
   * Mode determines what is displayed:
   * - "organization": Shows current organization name
   * - "account": Shows "My Account" but allows switching to organizations
   */
  mode?: TeamSwitcherMode;
}

export function TeamSwitcher({ mode = "organization" }: TeamSwitcherProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fetch organizations
  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Extract org slug from pathname (e.g., /someteam/... -> someteam)
  // Use URL as source of truth instead of Clerk's useOrganization() to avoid race conditions
  const currentOrgSlug = (() => {
    if (mode === "account") {
      return null;
    }
    const pathParts = pathname.split("/").filter(Boolean);
    // First path part is the org slug (unless it's a reserved route like /new, /account, /api)
    const reservedRoutes = ["new", "account", "api", "sign-in", "sign-up"];
    if (pathParts[0] && !reservedRoutes.includes(pathParts[0])) {
      return pathParts[0];
    }
    return null;
  })();

  // Find current organization by slug from URL
  const currentOrg = currentOrgSlug
    ? organizations.find((org) => org.slug === currentOrgSlug)
    : null;

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine display text and avatar based on mode
  const displayText =
    mode === "account" ? "My Account" : (currentOrg?.name ?? "Select team");
  const displayInitials =
    mode === "account" ? "MA" : currentOrg ? getInitials(currentOrg.name) : "?";

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <div className="flex items-center gap-1">
        {/* Clickable area - navigates to org (no styling) */}
        {mode === "organization" && currentOrg ? (
          <TeamSwitcherLink
            className="flex min-w-0 items-center gap-2"
            orgId={currentOrg.id}
            orgSlug={currentOrg.slug}
          >
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-sm">{displayText}</span>
          </TeamSwitcherLink>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-sm">{displayText}</span>
          </div>
        )}

        {/* Dropdown chevron trigger - shadcn ghost button */}
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start" className="w-[280px] space-y-1">
        <div className="px-2 py-1.5">
          <p className="font-medium text-muted-foreground text-xs">Teams</p>
        </div>
        {organizations.map((org) => {
          // In account mode, no org is selected (no checkmark)
          // In organization mode, show checkmark for active org
          const isSelected =
            mode === "organization" && currentOrg?.id === org.id;

          return (
            <DropdownMenuItem asChild className="p-0" key={org.id}>
              <TeamSwitcherLink
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent focus:bg-accent",
                  isSelected && "bg-muted/50"
                )}
                onSwitch={() => setOpen(false)}
                orgId={org.id}
                orgSlug={org.slug}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="bg-foreground text-[10px] text-background">
                    {getInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-left">{org.name}</span>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                )}
              </TeamSwitcherLink>
            </DropdownMenuItem>
          );
        })}

        {/* Create Team */}
        <DropdownMenuItem asChild className="p-0">
          <Link
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent"
            href="/account/teams/new"
            prefetch={true}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/50 border-dashed">
              <Plus className="h-3 w-3" />
            </div>
            <span>Create Team</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
