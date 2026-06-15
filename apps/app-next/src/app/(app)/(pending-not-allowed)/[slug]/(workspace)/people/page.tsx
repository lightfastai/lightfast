import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { PeopleClient } from "./_components/people-client";
import { PeopleLoading } from "./_components/people-loading";
import { PEOPLE_PAGE_SIZE } from "./_components/people-model";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  prefetch(
    trpc.org.workspace.people.list.infiniteQueryOptions(
      { limit: PEOPLE_PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 60_000,
      }
    )
  );

  return (
    <HydrateClient>
      <Suspense fallback={<PeopleLoading />}>
        <PeopleClient />
      </Suspense>
    </HydrateClient>
  );
}
