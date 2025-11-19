"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useTRPC } from "@repo/console-trpc/react";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Icons } from "@repo/ui/components/icons";

export function AuthenticatedHeader() {
  const trpc = useTRPC();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { organization: activeOrg } = useOrganization();

  // Use prefetched organizations from layout
  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false, // Use prefetched server data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });

  // Find current organization based on Clerk's active org
  const currentOrg = useMemo(() => {
    if (!activeOrg) return null;
    return organizations.find((org) => org.id === activeOrg.id);
  }, [activeOrg, organizations]);

  const handleSelectOrg = useCallback(
    (org: {
      id: string;
      name: string;
      slug: string;
      role: string;
      imageUrl: string;
    }) => {
      setOpen(false);
      router.push(`/org/${org.slug}`);
    },
    [router],
  );

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-background">
      {/* Left side - Logo + Org dropdown */}
      <div className="flex items-center gap-3">
        {/* Lightfast Logo */}
        <Icons.logoShort className="size-5" />

        {/* Org Dropdown */}
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <span className="text-sm font-medium">
                {currentOrg?.name ?? "Select organization"}
              </span>
              <Badge variant="secondary" className="text-xs">
                Hobby
              </Badge>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSelectOrg(org)}
                className="cursor-pointer text-sm"
              >
                <span>{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setOpen(false);
                router.push("/onboarding");
              }}
              className="cursor-pointer text-sm"
            >
              Create new organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right side - User avatar */}
      <UserDropdownMenu />
    </header>
  );
}
