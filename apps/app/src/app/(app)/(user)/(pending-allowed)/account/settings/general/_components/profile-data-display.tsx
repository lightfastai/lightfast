"use client";

import { useTRPC } from "@repo/app-trpc/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useSuspenseQuery } from "@tanstack/react-query";

/**
 * Profile Data Display
 *
 * Client component that fetches and displays user profile data.
 * Uses useSuspenseQuery with prefetched server data.
 *
 * Architecture:
 * - Server prefetches data in page.tsx
 * - HydrateClient passes data to client
 * - This component uses cached data (no client-side fetch)
 * - refetchOnMount/refetchOnWindowFocus disabled to prevent unnecessary fetches
 */
export function ProfileDataDisplay() {
  const trpc = useTRPC();

  const { data: profile } = useSuspenseQuery({
    ...trpc.account.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // 10 minutes - user profile rarely changes
  });

  // Get initials for avatar fallback
  const initials = profile.fullName
    ? profile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          General
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your personal account settings.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Avatar</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your avatar.
          </p>
          <p className="text-muted-foreground text-sm">
            Click on the avatar to upload a custom one from your files.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage
              alt={profile.fullName ?? "User"}
              src={profile.imageUrl}
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        <p className="text-muted-foreground text-sm">
          An avatar is optional but strongly recommended.
        </p>
      </div>

      {/* Display Name Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">
            Display Name
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Please enter your full name, or a display name you are comfortable
            with.
          </p>
        </div>

        <div className="w-full space-y-4">
          <div>
            <Input
              className="bg-muted/50"
              disabled
              type="text"
              value={profile.fullName ?? ""}
            />
          </div>

          <p className="text-muted-foreground text-sm">
            Please use 32 characters at maximum.
          </p>

          <div className="flex justify-end">
            <Button disabled variant="secondary">
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Email Section (Read-only) */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Email</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Your primary email address.
          </p>
        </div>

        <div className="w-full">
          <Input
            className="bg-muted/50"
            disabled
            type="email"
            value={profile.primaryEmailAddress ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
