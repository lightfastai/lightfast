import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchDeveloperConnectionsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.workspace.developerConnections.list.queryOptions()
  );
}
