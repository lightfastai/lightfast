import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function usePinnedSessions() {
  const trpc = useTRPC();
  
  // Using suspense query for instant loading from cache
  // Error handling will bubble up to error boundary
  const query = useSuspenseQuery({
    ...trpc.chat.session.listPinned.queryOptions(),
  });

  return query;
}