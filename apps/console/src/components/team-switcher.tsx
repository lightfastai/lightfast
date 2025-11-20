"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import type { RouterOutputs } from "@repo/console-trpc/types";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { cn } from "@repo/ui/lib/utils";

/**
 * Organization data from Clerk
 */
type OrgData = RouterOutputs["organization"]["listUserOrganizations"][number];

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

  // Extract org slug from pathname (e.g., /org/someteam/... -> someteam)
  // Use URL as source of truth instead of Clerk's useOrganization() to avoid race conditions
  const currentOrgSlug = useMemo(() => {
    if (mode === "account") return null;
    const pathParts = pathname?.split("/").filter(Boolean) ?? [];
    if (pathParts[0] === "org" && pathParts[1]) {
      return pathParts[1];
    }
    return null;
  }, [pathname, mode]);

  // Find current organization by slug from URL
  const currentOrg = useMemo(() => {
    if (!currentOrgSlug) return null;
    return organizations.find((org) => org.slug === currentOrgSlug);
  }, [currentOrgSlug, organizations]);

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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="justify-between px-2 h-9 hover:bg-accent min-w-0"
        >
          <div className="flex items-center gap-2 -ml-1 min-w-0">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] bg-foreground text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">{displayText}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] space-y-1" align="start">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">Teams</p>
        </div>
        {organizations.map((org) => {
          // In account mode, no org is selected (no checkmark)
          // In organization mode, show checkmark for active org
          const isSelected =
            mode === "organization" && currentOrg?.id === org.id;

          return (
            <DropdownMenuItem key={org.id} asChild>
              <Link
                href={`/org/${org.slug}`}
                prefetch={true}
                className={cn(
                  "w-full flex items-center gap-2 cursor-pointer",
                  isSelected && "bg-muted/50",
                )}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="text-[10px] bg-foreground text-background">
                    {getInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate flex-1 text-left">{org.name}</span>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}

        {/* Create Team */}
        <DropdownMenuItem asChild>
          <Link
            href="/account/teams/new"
            prefetch={true}
            className="w-full flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <div className="flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/50">
              <Plus className="h-3 w-3" />
            </div>
            <span>Create Team</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
