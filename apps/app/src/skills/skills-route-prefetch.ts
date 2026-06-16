import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchSkillsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, {
      staleTime: 0,
    })
  );
}
