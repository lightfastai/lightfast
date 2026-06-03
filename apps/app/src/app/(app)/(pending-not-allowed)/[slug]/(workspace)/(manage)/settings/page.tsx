import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

import { IdentitySoulCard } from "./_components/identity-soul-card";
import { IdentitySoulLoading } from "./_components/identity-soul-loading";
import { TeamGeneralSettingsClient } from "./_components/team-general-settings-client";
import { TeamProfileLoading } from "./_components/team-profile-loading";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Settings layout already verified org access; no additional checks needed here
  const { slug } = await params;

  // Prefetch every query the client tree reads via useSuspenseQuery. The
  // organization list is also prefetched by the ancestor ShellDataBoundary;
  // repeating it here keeps this route self-documenting and is a no-op dedupe.
  prefetch(trpc.org.settings.identity.get.queryOptions());
  prefetch(trpc.viewer.organization.listUserOrganizations.queryOptions());

  return (
    <HydrateClient>
      <div className="space-y-10">
        <div>
          <h2 className="font-medium font-pp text-2xl text-foreground">
            General
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage your team's profile and preferences.
          </p>
        </div>

        <Suspense fallback={<TeamProfileLoading />}>
          <TeamGeneralSettingsClient slug={slug} />
        </Suspense>

        <Suspense fallback={<IdentitySoulLoading />}>
          <IdentitySoulCard slug={slug} />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
