import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export const dynamic = "force-dynamic";

import { ProfileDataDisplay } from "./_components/profile-data-display";
import { ProfileDataLoading } from "./_components/profile-data-loading";

export default function GeneralSettingsPage() {
  // CRITICAL: Prefetch BEFORE HydrateClient wrapping
  prefetch(trpc.viewer.account.get.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<ProfileDataLoading />}>
        <ProfileDataDisplay />
      </Suspense>
    </HydrateClient>
  );
}
