import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";

export default async function EntityDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;

  prefetch(trpc.entities.get.queryOptions({ externalId: entityId }));
  prefetch(
    trpc.entities.getEvents.infiniteQueryOptions(
      { externalId: entityId, limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    )
  );

  return <HydrateClient>{children}</HydrateClient>;
}
