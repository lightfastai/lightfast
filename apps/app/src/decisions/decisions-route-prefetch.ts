import { DECISIONS_PAGE_SIZE } from "~/decisions/decisions-model";
import {
  parseDecisionProviders,
  parseDecisionStatuses,
} from "~/decisions/decisions-search-params";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchDecisionsRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  search: { provider?: string; q?: string; status?: string } = {}
) {
  const providers = parseDecisionProviders(search.provider ?? "");
  const statuses = parseDecisionStatuses(search.status ?? "");
  const searchText = search.q?.trim() || undefined;

  await Promise.all([
    queryClient.fetchInfiniteQuery(
      trpc.org.workspace.decisions.list.infiniteQueryOptions(
        {
          limit: DECISIONS_PAGE_SIZE,
          providers: providers.length ? providers : undefined,
          search: searchText,
          statuses: statuses.length ? statuses : undefined,
        },
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
