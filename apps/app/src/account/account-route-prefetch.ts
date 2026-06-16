import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchAccountGithubStatus({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(trpc.viewer.githubAccount.status.queryOptions());
}

export async function prefetchAccountMcpConnections({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.viewer.account.mcpConnections.list.queryOptions()
  );
}

export async function prefetchAccountProfile({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(trpc.viewer.account.get.queryOptions());
}
