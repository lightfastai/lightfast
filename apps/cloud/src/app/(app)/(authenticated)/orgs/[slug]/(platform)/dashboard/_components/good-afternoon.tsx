"use client";

import { memo } from "react";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

const GoodAfternoon = memo(function GoodAfternoon() {
  const trpc = useTRPC();
  
  // Fetch user data
  const { data: userData } = useSuspenseQuery({
    ...trpc.user.getUser.queryOptions(),
    staleTime: Infinity, // User profile data rarely changes, cache for entire session
    gcTime: Infinity, // Keep in cache indefinitely
  });

  // Determine display name: prefer username, then firstName, then fallback
  const displayName = userData?.username || userData?.firstName || 'user';

  return (
    <div className="text-center mb-12">
      <h1 className="text-4xl font-medium text-foreground mb-4">
        Good afternoon, {displayName}
      </h1>
    </div>
  );
});

export { GoodAfternoon };