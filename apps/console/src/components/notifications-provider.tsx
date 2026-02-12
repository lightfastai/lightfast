"use client";

import { useUser } from "@clerk/nextjs";
import { NotificationsProvider } from "@vendor/knock/components/provider";
import type { ReactNode } from "react";

export function ConsoleNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isLoaded } = useUser();

  // Always wrap with provider, even if user is still loading
  // This ensures Knock context is available when needed
  if (!isLoaded || !user) {
    return (
      <NotificationsProvider userId="loading">
        {children}
      </NotificationsProvider>
    );
  }

  return (
    <NotificationsProvider userId={user.id}>
      {children}
    </NotificationsProvider>
  );
}
