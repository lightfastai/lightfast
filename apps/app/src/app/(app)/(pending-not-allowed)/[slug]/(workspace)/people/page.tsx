import { Suspense } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { PeopleClient } from "./_components/people-client";
import { PeopleLoading } from "./_components/people-loading";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  prefetch(trpc.org.workspace.people.list.queryOptions({ limit: 50 }));

  return (
    <HydrateClient>
      <WorkspaceSurface variant="contained">
        <Suspense fallback={<PeopleLoading />}>
          <PeopleClient />
        </Suspense>
      </WorkspaceSurface>
    </HydrateClient>
  );
}
