import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function usePinnedSessions() {
  const trpc = useTRPC();
  
  // Using suspense query for instant loading from cache
  // Error handling will bubble up to error boundary
  const query = useSuspenseQuery({
    ...trpc.session.listPinned.queryOptions(),
    // Poll every 10 seconds to pick up title updates from Inngest
    refetchInterval: 10000,
    // Keep refetching even when window is not focused
    refetchIntervalInBackground: false,
  });

  return query;
}