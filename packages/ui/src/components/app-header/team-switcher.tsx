"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type TeamSwitcherMode = "organization" | "account";

interface Organization {
  id: string;
  name: string;
  slug: string | null;
}

interface TeamSwitcherProps {
  /** Href for "Create Team" link (e.g., "/account/teams/new") */
  createTeamHref: string;
  /**
   * Mode determines what is displayed:
   * - "organization": Shows current organization name
   * - "account": Shows "My Account" but allows switching to organizations
   */
  mode?: TeamSwitcherMode;
  /** Called when user selects an org — app should handle auth SDK (e.g., clerk.setActive) */
  onOrgSelect: (orgId: string, orgSlug: string) => Promise<void>;
  /** List of organizations the user belongs to */
  organizations: Organization[];
}

export type { Organization, TeamSwitcherMode, TeamSwitcherProps };

export function TeamSwitcher({
  organizations,
  mode = "organization",
  onOrgSelect,
  createTeamHref,
}: TeamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Extract org slug from pathname (e.g., /someteam/... -> someteam)
  const currentOrgSlug = (() => {
    if (mode === "account") {
      return null;
    }
    const pathParts = pathname.split("/").filter(Boolean);
    const reservedRoutes = ["new", "account", "api", "sign-in", "sign-up"];
    if (pathParts[0] && !reservedRoutes.includes(pathParts[0])) {
      return pathParts[0];
    }
    return null;
  })();

  const currentOrg = currentOrgSlug
    ? organizations.find((org) => org.slug === currentOrgSlug)
    : null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayText =
    mode === "account" ? "My Account" : (currentOrg?.name ?? "Select team");
  const displayInitials =
    mode === "account" ? "MA" : currentOrg ? getInitials(currentOrg.name) : "?";

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
              await onOrgSelect(currentOrg.id, currentOrg.slug ?? "");
              router.push(`/${currentOrg.slug}`);
            }}
            prefetch={true}
          >
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-sm">{displayText}</span>
          </Link>
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
                  await onOrgSelect(org.id, org.slug ?? "");
                  router.push(`/${org.slug}`);
                }}
                prefetch={true}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="bg-foreground text-[10px] text-background">
                    {getInitials(org.name)}
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
          <Link href={{ pathname: createTeamHref }} prefetch={true}>
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
