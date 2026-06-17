import { useInfiniteQuery } from "@tanstack/react-query";
import {
  PEOPLE_PAGE_SIZE,
  type PeopleClassificationFilters,
} from "./people-model";
import { peopleListInfiniteQueryOptions } from "./people-queries";

export function usePeopleListQuery({
  filters,
  search,
}: {
  filters: PeopleClassificationFilters;
  search: string;
}) {
  const normalizedSearch = search.trim() || undefined;
  const input = {
    limit: PEOPLE_PAGE_SIZE,
    providers: filters.providers.length ? filters.providers : undefined,
    search: normalizedSearch,
    types: filters.types.length ? filters.types : undefined,
  };

  const options = peopleListInfiniteQueryOptions(input);

  return {
    query: useInfiniteQuery(options),
    queryKey: options.queryKey,
  };
}
