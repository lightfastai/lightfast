"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useOrganizationList } from "@vendor/clerk";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const RESERVED_ROUTES = new Set([
  "new",
  "account",
  "api",
  "sign-in",
  "sign-up",
]);
const CREATE_TEAM_HREF = "/account/teams/new";

export function TeamSwitcher() {
  const trpc = useTRPC();
  const pathname = usePathname();
  const router = useRouter();
  const { setActive } = useOrganizationList();
  const [open, setOpen] = useState(false);

  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const mode =
    !firstSegment || RESERVED_ROUTES.has(firstSegment)
      ? "account"
      : "organization";
  const currentOrg =
    mode === "organization"
      ? (organizations.find((org) => org.slug === firstSegment) ?? null)
      : null;

  const displayText =
    mode === "account" ? "My Account" : (currentOrg?.name ?? "Select team");
  const displayInitials =
    mode === "account" ? "MA" : (currentOrg?.initials ?? "?");

  const switchTo = async (orgId: string, slug: string) => {
    if (setActive) {
      await setActive({ organization: orgId });
    }
    router.push(`/${slug}`);
  };

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <div className="flex items-center gap-1">
        {mode === "organization" && currentOrg ? (
          <Link
            className="flex min-w-0 items-center gap-2"
            href={`/${currentOrg.slug}`}
            onClick={async (e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
                return;
              }
              e.preventDefault();
              await switchTo(currentOrg.id, currentOrg.slug ?? "");
            }}
            prefetch={true}
          >
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-base">
              {displayText}
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-base">
              {displayText}
            </span>
          </div>
        )}
        <DropdownMenuTrigger asChild>
          <Button className="h-6 w-6 rounded-full" size="sm" variant="ghost">
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="center" className="w-[220px] space-y-1">
        {organizations.map((org) => {
          const isSelected =
            mode === "organization" && currentOrg?.id === org.id;

          return (
            <DropdownMenuItem
              asChild
              className={cn(
                "cursor-pointer rounded-xl px-2",
                isSelected && "bg-muted/50"
              )}
              key={org.id}
            >
              <Link
                href={`/${org.slug}`}
                onClick={async (e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
                    return;
                  }
                  e.preventDefault();
                  setOpen(false);
                  await switchTo(org.id, org.slug ?? "");
                }}
                prefetch={true}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="bg-foreground text-[10px] text-background">
                    {org.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{org.name}</span>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-xl px-2 text-muted-foreground"
        >
          <Link href={{ pathname: CREATE_TEAM_HREF }} prefetch={true}>
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border/50 border-dashed">
              <Plus className="h-3 w-3" />
            </div>
            <span>Create Team</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamSwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-4 w-24 rounded-xl" />
    </div>
  );
}
