import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";
import {
  processingSignalsQueryOptions,
  workingSetSignalsQueryOptions,
} from "./signals-queries";

export async function prefetchSignalsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await Promise.all([
    queryClient.fetchQuery({
      ...workingSetSignalsQueryOptions(),
      staleTime: 30_000,
    }),
    queryClient.fetchQuery({
      ...processingSignalsQueryOptions(),
      staleTime: 5000,
    }),
    queryClient.fetchQuery({
      ...trpc.org.workspace.signals.views.list.queryOptions(),
      staleTime: 60_000,
    }),
  ]);
}
