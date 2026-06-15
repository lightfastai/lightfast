import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { DecisionsClient } from "./_components/decisions-client";
import { DecisionsLoading } from "./_components/decisions-loading";
import { DECISIONS_PAGE_SIZE } from "./_components/decisions-model";

export const dynamic = "force-dynamic";

export default function DecisionsPage() {
  prefetch(
    trpc.org.workspace.decisions.list.infiniteQueryOptions(
      { limit: DECISIONS_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 60_000,
      }
    )
  );

  return (
    <HydrateClient>
      <Suspense fallback={<DecisionsLoading />}>
        <DecisionsClient />
      </Suspense>
    </HydrateClient>
  );
}
