"use client";

import { useMemo } from "react";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  useClerk,
  useUser,
} from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Settings } from "lucide-react";
import Link from "next/link";

interface UserDropdownMenuProps {
  className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const params = useParams();

  const settingsHref = useMemo(() => {
    const slug = params.slug;
    if (slug) {
      // Ensure slug is a string (it could be string | string[] from params)
      const slugStr = Array.isArray(slug) ? slug[0] : slug;
      return `/org/${slugStr}/settings`;
    }
    return "/settings"; // Fallback for non-org pages
  }, [params.slug]);

  const displayName = useMemo(() => {
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
            <Button variant="outline" size="icon" className={className}>
              <Avatar className="h-5 w-5">
                {user?.imageUrl ? (
                  <AvatarImage
                    src={user.imageUrl}
                    alt={displayName || "User avatar"}
                  />
                ) : (
                  <AvatarFallback className="text-[10px] bg-blue-300 text-white">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground">
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
              className="cursor-pointer"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SignedIn>
      {!isSignedIn && (
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="outline" size="sm" className={className}>
              Sign in
            </Button>
          </SignInButton>
        </SignedOut>
      )}
    </>
  );
}
