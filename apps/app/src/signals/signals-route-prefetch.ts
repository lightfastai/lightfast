import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "~/signals/signals-model";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchSignalsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await Promise.all([
    queryClient.fetchQuery({
      ...trpc.org.workspace.signals.workingSet.queryOptions(),
      staleTime: 30_000,
    }),
    queryClient.fetchQuery({
      ...trpc.org.workspace.signals.list.queryOptions({
        limit: PROCESSING_SIGNALS_LIMIT,
        statuses: [...signalProcessingStatuses],
      }),
      staleTime: 5000,
    }),
    queryClient.fetchQuery({
      ...trpc.org.workspace.signals.views.list.queryOptions(),
      staleTime: 60_000,
    }),
  ]);
}
