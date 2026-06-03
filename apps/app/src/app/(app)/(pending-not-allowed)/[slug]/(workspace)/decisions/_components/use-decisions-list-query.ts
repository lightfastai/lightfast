"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  DECISIONS_PAGE_SIZE,
  type DecisionFilters,
} from "./decisions-model";

export function useDecisionsListQuery({
  filters,
  search,
}: {
  filters: DecisionFilters;
  search: string;
}) {
  const trpc = useTRPC();
  const normalizedSearch = search.trim() || undefined;
  const input = {
    limit: DECISIONS_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    search: normalizedSearch,
    statuses: filters.statuses.length ? filters.statuses : undefined,
  };

  const options = trpc.org.workspace.decisions.list.infiniteQueryOptions(input, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
  });

  return {
    query: useInfiniteQuery(options),
    queryKey: options.queryKey,
  };
}
