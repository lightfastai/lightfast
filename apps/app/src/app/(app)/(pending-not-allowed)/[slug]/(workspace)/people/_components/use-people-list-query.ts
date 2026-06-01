"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  PEOPLE_PAGE_SIZE,
  type PeopleClassificationFilters,
} from "./people-model";

export function usePeopleListQuery({
  filters,
  search,
}: {
  filters: PeopleClassificationFilters;
  search: string;
}) {
  const trpc = useTRPC();
  const normalizedSearch = search.trim() || undefined;
  const input = {
    limit: PEOPLE_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    search: normalizedSearch,
    types: filters.types.length ? filters.types : undefined,
  };

  const options = trpc.org.workspace.people.list.infiniteQueryOptions(input, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
  });

  return {
    query: useInfiniteQuery(options),
    queryKey: options.queryKey,
  };
}
