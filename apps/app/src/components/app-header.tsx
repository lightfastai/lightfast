"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { UserMenu } from "@repo/ui/components/app-header/user-menu";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useClerk } from "@vendor/clerk/client";
import Link from "next/link";
/**
 * Application header - full width with org switcher on left and user actions on right
 */
export function AppHeader() {
  const trpc = useTRPC();
  const { signOut } = useClerk();

  const { data: profile } = useSuspenseQuery({
    ...trpc.account.get.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const email = profile.primaryEmailAddress ?? profile.username ?? "";

  const initials = (() => {
    const { firstName, lastName, fullName, username } = profile;
    if (fullName) {
      return fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
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
  })();

  return (
    <div className="flex w-full items-center pl-2">
      {/* Left side placeholder */}
      <div />

      {/* Right side - Notifications and User dropdown */}
      <div className="ml-auto flex items-center gap-3">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="https://lightfast.ai/docs/get-started/overview"
          rel="noopener noreferrer"
          target="_blank"
        >
          Docs
        </Link>
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="https://lightfast.ai/docs/api-reference"
          rel="noopener noreferrer"
          target="_blank"
        >
          API Reference
        </Link>
        <UserMenu
          email={email}
          initials={initials}
          onSignOut={() => void signOut({ redirectUrl: "/sign-in" })}
          settingsHref="/account/settings/general"
        />
      </div>
    </div>
  );
}
