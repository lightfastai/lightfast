"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { NotificationsProvider } from "@vendor/knock/components/provider";
import type { ReactNode } from "react";

export function ConsoleNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const trpc = useTRPC();
  const { data: profile } = useSuspenseQuery({
    ...trpc.account.get.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <NotificationsProvider userId={profile.id}>
      {children}
    </NotificationsProvider>
  );
}
