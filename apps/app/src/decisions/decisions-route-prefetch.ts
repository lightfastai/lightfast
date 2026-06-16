import { DECISIONS_PAGE_SIZE } from "~/decisions/decisions-model";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchDecisionsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await Promise.all([
    queryClient.fetchInfiniteQuery(
      trpc.org.workspace.decisions.list.infiniteQueryOptions(
        { limit: DECISIONS_PAGE_SIZE },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor,
          staleTime: 60_000,
        }
      )
    ),
    queryClient.fetchQuery({
      ...trpc.org.workspace.decisions.views.list.queryOptions(),
      staleTime: 60_000,
    }),
  ]);
}
