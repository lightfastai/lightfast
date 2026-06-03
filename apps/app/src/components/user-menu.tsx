"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useClerk } from "@vendor/clerk";
import { Settings } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";

const SETTINGS_HREF = "/account/settings/general";

export function UserMenu() {
  const trpc = useTRPC();
  const { signOut } = useClerk();

  const { data: profile } = useSuspenseQuery({
    ...trpc.viewer.account.get.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const identityLines = [profile.username, profile.primaryEmailAddress].filter(
    (value): value is string => Boolean(value)
  );

  const primaryIdentity = identityLines[0] ?? "User";
  const secondaryIdentity = identityLines[1] ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="size-11 rounded-full p-0 lg:size-8" variant="ghost">
          <Avatar className="size-7 lg:size-6">
            <AvatarFallback className="bg-foreground text-[10px] text-background">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-54">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="size-6">
            <AvatarFallback className="bg-foreground text-[10px] text-background">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{primaryIdentity}</p>
            {secondaryIdentity ? (
              <p className="truncate text-muted-foreground text-xs">
                {secondaryIdentity}
              </p>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={{ pathname: SETTINGS_HREF }} prefetch={true}>
            <Settings className="h-3 w-3" />
            Your Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => void signOut({ redirectUrl: "/sign-in" })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenuSkeleton() {
  return <Skeleton className="size-8 rounded-full" />;
}
