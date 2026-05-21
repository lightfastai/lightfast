"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useSuspenseQuery } from "@tanstack/react-query";

export function ProfileDataDisplay() {
  const trpc = useTRPC();

  const { data: profile } = useSuspenseQuery({
    ...trpc.viewer.account.get.queryOptions(),
    staleTime: 10 * 60 * 1000,
  });

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
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-semibold text-foreground text-xl">Avatar</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            This is your avatar.
          </p>
        </div>
        <Avatar className="size-10">
          <AvatarFallback className="bg-foreground text-background text-xs">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
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
        <div className="flex items-start gap-3">
          <Input
            className="flex-1 bg-muted/50"
            disabled
            type="text"
            value={profile.fullName ?? ""}
          />
          <Button disabled variant="secondary">
            Save
          </Button>
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
        <Input
          className="bg-muted/50"
          disabled
          type="email"
          value={profile.primaryEmailAddress ?? ""}
        />
      </div>
    </div>
  );
}
