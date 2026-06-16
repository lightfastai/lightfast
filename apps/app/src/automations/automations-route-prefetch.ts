import { AUTOMATION_RUNS_PAGE_LIMIT } from "~/automations/automations-cache";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchAutomationDetailRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  automationId: string
) {
  await Promise.all([
    queryClient.fetchQuery(
      trpc.org.workspace.automations.get.queryOptions({
        id: automationId,
      })
    ),
    queryClient.fetchQuery(
      trpc.org.workspace.automations.listRuns.queryOptions({
        id: automationId,
        limit: AUTOMATION_RUNS_PAGE_LIMIT,
      })
    ),
  ]);
}

export async function prefetchAutomationsListRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.workspace.automations.list.queryOptions()
  );
}

export async function prefetchAutomationCreateRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.workspace.connectors.list.queryOptions()
  );
}
