import { useOrganizationList } from "@clerk/tanstack-react-start";
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
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Suspense, useState } from "react";
import { useTRPC } from "~/trpc/react";

const RESERVED_ROUTES = new Set([
  "new",
  "account",
  "api",
  "sign-in",
  "sign-up",
]);

export function TeamSwitcherSlot() {
  return (
    <Suspense fallback={<TeamSwitcherSkeleton />}>
      <TeamSwitcher />
    </Suspense>
  );
}

export function TeamSwitcher() {
  const trpc = useTRPC();
  const location = useLocation();
  const navigate = useNavigate();
  const { setActive } = useOrganizationList();
  const [open, setOpen] = useState(false);

  const { data: organizations = [], isPending } = useQuery({
    ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  const firstSegment = location.pathname.split("/").filter(Boolean)[0];
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

  const switchTo = async (orgId: string, slug: string | null | undefined) => {
    if (!slug) {
      return;
    }
    if (setActive) {
      await setActive({ organization: orgId });
    }
    await navigate({ to: "/$slug", params: { slug } });
  };

  if (isPending) {
    return <TeamSwitcherSkeleton />;
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <div className="flex items-center gap-1">
        {mode === "organization" && currentOrg?.slug ? (
          <Link
            className="flex min-h-11 min-w-0 items-center gap-2 lg:min-h-0"
            onClick={async (event) => {
              if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              await switchTo(currentOrg.id, currentOrg.slug);
            }}
            params={{ slug: currentOrg.slug }}
            to="/$slug"
          >
            <Avatar className="size-7 lg:size-6">
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
          <Button
            aria-label="Switch team"
            className="size-11 rounded-full lg:h-6 lg:w-6"
            size="sm"
            variant="ghost"
          >
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
              className={cn("cursor-pointer px-2", isSelected && "bg-muted/50")}
              key={org.id}
            >
              <Link
                onClick={async (event) => {
                  if (
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  setOpen(false);
                  await switchTo(org.id, org.slug);
                }}
                params={{ slug: org.slug ?? "" }}
                to="/$slug"
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
          className="cursor-pointer px-2 text-muted-foreground"
        >
          <Link to="/account/teams/new">
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
