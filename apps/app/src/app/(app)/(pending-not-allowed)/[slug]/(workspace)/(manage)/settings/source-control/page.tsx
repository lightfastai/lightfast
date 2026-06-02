import { HydrateClient, prefetch, trpc } from "~/trpc/server";

import { SourceControlSettingsClient } from "./_components/source-control-settings-client";

export default async function SourceControlSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Settings layout already verified org access; no additional checks needed here
  const { slug } = await params;

  prefetch(trpc.org.settings.sourceControl.get.queryOptions());
  prefetch(trpc.org.settings.sourceControl.listRepositories.queryOptions());

  return (
    <HydrateClient>
      <SourceControlSettingsClient slug={slug} />
    </HydrateClient>
  );
}
