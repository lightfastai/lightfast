import { PEOPLE_PAGE_SIZE } from "~/people/people-model";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchPeopleRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await Promise.all([
    queryClient.fetchInfiniteQuery(
      trpc.org.workspace.people.list.infiniteQueryOptions(
        { limit: PEOPLE_PAGE_SIZE },
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
