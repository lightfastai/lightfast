"use client";

import { useUser } from "@clerk/nextjs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { NotificationsProvider } from "@vendor/knock/components/provider";
import type { ReactNode } from "react";

export function ConsoleNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const trpc = useTRPC();

  // Fetch signed user token for Knock (required for enhanced security)
  // Only fetch if user is loaded - suspense query will wait until data is available
  const { data: userToken } = useSuspenseQuery({
    ...trpc.notifications.getToken.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Token valid for 5 minutes
  });

  // Always wrap with provider, even if user is still loading
  // This ensures Knock context is available when needed
  if (!isLoaded || !user) {
    return (
      <NotificationsProvider userId="loading" userToken={null}>
        {children}
      </NotificationsProvider>
    );
  }

  return (
    <NotificationsProvider userId={user.id} userToken={userToken as string | null}>
      {children}
    </NotificationsProvider>
  );
}
