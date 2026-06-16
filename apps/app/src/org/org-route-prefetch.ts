import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

export async function prefetchOrgMcpRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.settings.mcpConnections.list.queryOptions()
  );
}

export async function prefetchOrgApiKeysRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.settings.orgApiKeys.list.queryOptions()
  );
}

export async function prefetchOrgBillingRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.settings.orgBilling.overview.queryOptions()
  );
}

export async function prefetchOrgGeneralSettingsRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  slug: string
) {
  await Promise.all([
    queryClient.fetchQuery(trpc.org.settings.identity.get.queryOptions()),
    queryClient.fetchQuery(
      trpc.org.settings.organization.listDomains.queryOptions({ slug })
    ),
    queryClient.fetchQuery(
      trpc.viewer.organization.listUserOrganizations.queryOptions()
    ),
  ]);
}

export async function prefetchOrgMembersRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await queryClient.fetchQuery(
    trpc.org.settings.orgMembers.list.queryOptions()
  );
}

export async function prefetchOrgSourceControlRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await Promise.all([
    queryClient.fetchQuery(trpc.org.settings.sourceControl.get.queryOptions()),
    queryClient.fetchQuery(
      trpc.org.settings.sourceControl.listRepositories.queryOptions()
    ),
  ]);
}

export async function prefetchOrgSetupBindRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  slug: string
) {
  await queryClient.fetchQuery(
    trpc.viewer.organization.getBySlug.queryOptions({ slug })
  );
}

export async function prefetchOrgSetupIndexRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  slug: string
) {
  await Promise.all([
    queryClient.fetchQuery(
      trpc.viewer.organization.getBySlug.queryOptions({ slug })
    ),
    queryClient.fetchQuery(trpc.org.settings.sourceControl.get.queryOptions()),
  ]);
}

export async function prefetchOrgSetupXConnectorRoute(
  { queryClient, trpc }: RoutePrefetchContext,
  slug: string
) {
  await Promise.all([
    queryClient.fetchQuery(
      trpc.viewer.organization.getBySlug.queryOptions({ slug })
    ),
    queryClient.fetchQuery(trpc.org.workspace.connectors.list.queryOptions()),
  ]);
}
