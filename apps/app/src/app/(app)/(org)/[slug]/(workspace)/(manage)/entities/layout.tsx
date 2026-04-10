import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { RealtimeProviderWrapper } from "@repo/app-upstash-realtime/client";

export default async function EntitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch default view only — category switches are client-side fetches
  prefetch(
    trpc.entities.list.infiniteQueryOptions(
      { limit: 30 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      }
    )
  );

  return (
    <HydrateClient>
      <RealtimeProviderWrapper>{children}</RealtimeProviderWrapper>
    </HydrateClient>
  );
}
