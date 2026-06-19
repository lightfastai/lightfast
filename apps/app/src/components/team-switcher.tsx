import { listUserOrganizations } from "@api/app/tanstack/organizations";
import {
  Tick02Icon as Check,
  Add01Icon as Plus,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useMounted } from "@repo/ui/hooks/use-mounted";
import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback } from "@repo/ui-v2/components/ui/avatar";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useOrganizationList } from "~/compat/clerk";
import {
  ORGANIZATION_STALE_TIME,
  organizationQueryKeys,
} from "~/organization/organization-cache";

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
  const location = useLocation();
  const navigate = useNavigate();
  const { setActive } = useOrganizationList();
  const [open, setOpen] = useState(false);
  const mounted = useMounted();

  const { data: organizations = [], isPending } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => listUserOrganizations(),
    queryKey: organizationQueryKeys.list(),
    staleTime: ORGANIZATION_STALE_TIME,
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

  if (!mounted || isPending) {
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
            <Avatar className="size-7">
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
            <Avatar className="size-7">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-base">
              {displayText}
            </span>
          </div>
        )}
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Switch team"
              className="ml-auto"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={UnfoldMoreIcon}
          />
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="center" size="sm">
        {organizations.map((org) => {
          const isSelected =
            mode === "organization" && currentOrg?.id === org.id;

          return (
            <DropdownMenuItem
              className={cn("cursor-pointer px-2", isSelected && "bg-muted/50")}
              key={org.id}
              render={
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
                />
              }
            >
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarFallback className="bg-foreground text-[10px] text-background">
                  {org.initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{org.name}</span>
              {isSelected && (
                <HugeiconsIcon
                  className="h-4 w-4 shrink-0 text-foreground"
                  icon={Check}
                />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem
          className="cursor-pointer px-2 text-muted-foreground"
          render={<Link to="/account/teams/new" />}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border/50 border-dashed">
            <HugeiconsIcon className="h-3 w-3" icon={Plus} />
          </div>
          <span>Create Team</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamSwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-7 rounded-md" />
      <Skeleton className="h-4 w-24 rounded-xl" />
    </div>
  );
}
