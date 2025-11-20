"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import type { RouterOutputs } from "@repo/console-trpc/types";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { cn } from "@repo/ui/lib/utils";

/**
 * Organization data from Clerk
 */
type OrgData = RouterOutputs["organization"]["listUserOrganizations"][number];

export function TeamSwitcher() {
  const trpc = useTRPC();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { organization: activeOrg } = useOrganization();

  // Fetch organizations
  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Find current organization
  const currentOrg = useMemo(() => {
    if (!activeOrg) return null;
    return organizations.find((org) => org.id === activeOrg.id);
  }, [activeOrg, organizations]);

  const handleSelectOrg = useCallback(
    (org: OrgData) => {
      setOpen(false);
      // Navigate to org page which shows the workspace dashboard
      router.push(`/org/${org.slug}`);
    },
    [router],
  );

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="justify-between px-2 h-9 hover:bg-accent min-w-0"
        >
          <div className="flex items-center gap-2 -ml-1 min-w-0">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] bg-foreground text-background">
                {currentOrg ? getInitials(currentOrg.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">
              {currentOrg?.name ?? "Select team"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 bg-background" align="start">
        <div className="p-2">
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium text-muted-foreground">Teams</p>
          </div>
          <div className="space-y-0.5">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrg(org)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/80 transition-colors",
                  currentOrg?.id === org.id && "bg-muted/50",
                )}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="text-[10px] bg-foreground text-background">
                    {getInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate flex-1 text-left">{org.name}</span>
                {currentOrg?.id === org.id && (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                )}
              </button>
            ))}
          </div>

          {/* Create Team */}
          <Link
            href="/onboarding"
            className="w-full flex items-center gap-2 px-2 py-1.5 mt-2 rounded-md text-sm text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            <div className="flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/50">
              <Plus className="h-3 w-3" />
            </div>
            <span>Create Team</span>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
