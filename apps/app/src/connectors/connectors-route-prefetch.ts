import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchConnectorsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.workspace.connectors.listSections.queryOptions()
  );
}
