import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { ITEMS_PER_PAGE } from "../types";

export function useInfiniteSessions() {
  const trpc = useTRPC();
  
  return useInfiniteQuery({
    ...trpc.chat.session.list.infiniteQueryOptions(
      (pageParam) => ({
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
}