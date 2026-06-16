import { PEOPLE_PAGE_SIZE } from "~/people/people-model";
import {
  parsePersonProviders,
  parsePersonTypes,
} from "~/people/people-search-params";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchPeopleRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  search: { peopleQuery?: string; provider?: string; type?: string } = {}
) {
  const providers = parsePersonProviders(search.provider ?? "");
  const types = parsePersonTypes(search.type ?? "");
  const searchText = search.peopleQuery?.trim() || undefined;

  await Promise.all([
    queryClient.fetchInfiniteQuery(
      trpc.org.workspace.people.list.infiniteQueryOptions(
        {
          limit: PEOPLE_PAGE_SIZE,
          providers: providers.length ? providers : undefined,
          search: searchText,
          types: types.length ? types : undefined,
        },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor,
          staleTime: 60_000,
        }
      )
    ),
    queryClient.fetchQuery({
      ...trpc.org.workspace.people.views.list.queryOptions(),
      staleTime: 60_000,
    }),
  ]);
}
