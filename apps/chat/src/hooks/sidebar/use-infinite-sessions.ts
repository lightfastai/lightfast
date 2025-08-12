import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "~/trpc/react";
import { showTRPCErrorToast } from "~/lib/trpc-errors";
import { ITEMS_PER_PAGE } from "~/components/sidebar/types";

export function useInfiniteSessions() {
  const trpc = useTRPC();
  
  const query = useInfiniteQuery({
    ...trpc.chat.session.list.infiniteQueryOptions(
      (pageParam: unknown) => ({
        limit: ITEMS_PER_PAGE,
        cursor: pageParam as string | undefined,
      })
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // If last page has fewer items than limit, we've reached the end
      if (lastPage.length < ITEMS_PER_PAGE) return undefined;
      // Use the last item's ID as the cursor for the next page
      return lastPage[lastPage.length - 1]?.id;
    },
  });

  // Handle errors with useEffect to avoid showing toast on every render
  useEffect(() => {
    if (query.error) {
      showTRPCErrorToast(query.error, "Failed to load sessions");
    }
  }, [query.error]);

  return query;
}