"use client";

import { useMemo } from "react";
import {
  SignedIn,
  useClerk,
  useUser,
} from "@clerk/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Settings } from "lucide-react";
import Link from "next/link";

interface UserDropdownMenuProps {
  className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
  const { signOut } = useClerk();
  const { isLoaded, user } = useUser();

  // Always link to personal account settings (general page)
  const settingsHref = "/account/settings/general";

  const _displayName = useMemo(() => {
    if (!user) {
      return "";
    }

    return (
      user.fullName ??
      user.username ??
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "User"
    );
  }, [user]);

  const emailAddress = useMemo(() => {
    if (!user) {
      return "";
    }

    return (
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      user.username ??
      ""
    );
  }, [user]);

  const initials = useMemo(() => {
    if (!user) {
      return "";
    }

    const { firstName, lastName, username } = user;

    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }

    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }

    if (lastName) {
      return lastName.substring(0, 2).toUpperCase();
    }

    if (username) {
      return username.substring(0, 2).toUpperCase();
    }

    return "LF";
  }, [user]);

  const handleSignOut = () => {
    void signOut();
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <>
      <SignedIn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`p-0 rounded-full size-8 ${className}`}
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px] bg-foreground text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5">
              <p className="text-sm text-muted-foreground">
                {emailAddress || "User"}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={settingsHref}
                prefetch={true}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-3 w-3" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-sm"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SignedIn>
    </>
  );
}
