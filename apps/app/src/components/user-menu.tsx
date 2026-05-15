"use client";

import { useTRPC } from "@repo/app-trpc/react";
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
import { useClerk } from "@vendor/clerk/client";
import { Settings } from "lucide-react";
import Link from "next/link";

const SETTINGS_HREF = "/account/settings/general";

export function UserMenu() {
  const trpc = useTRPC();
  const { signOut } = useClerk();

  const { data: profile } = useSuspenseQuery({
    ...trpc.pendingAllowed.account.get.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const email = profile.primaryEmailAddress ?? profile.username ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="size-8 rounded-full p-0" variant="ghost">
          <Avatar className="size-6">
            <AvatarFallback className="bg-foreground text-[10px] text-background">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-54">
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-sm">{email || "User"}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
          <Link href={{ pathname: SETTINGS_HREF }} prefetch={true}>
            <Settings className="h-3 w-3" />
            Your Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-xl"
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
